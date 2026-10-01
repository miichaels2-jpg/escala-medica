import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { inferUnassignedShiftUnitId } from '@/lib/unitAssignment';

let globalState = {
  user: null,
  company: { id: 'cmp_principal', name: 'Hospital Principal', units: [{ id: 'unit_h1', name: 'Unidade Matriz' }] },
  units: [{ id: 'unit_h1', name: 'Unidade Matriz' }],
  selectedUnitId: 'unit_h1',
  professionals: [],
  sectors: [],
  shifts: [],
  swaps: [],
  notifications: [],
  loading: true,
  dataWarnings: [],
  unassignedShifts: [],
};

const listeners = new Set();
let isFetching = false;

function updateGlobal(patch) {
  globalState = { ...globalState, ...patch };
  listeners.forEach(fn => fn());
}

async function fetchTable(tableName, filterObj = {}, limit = 5000) {
  let query = supabase.from(tableName).select('*');
  for (const key in filterObj) {
    query = query.eq(key, filterObj[key]);
  }
  const { data, error } = await query.limit(limit);
  if (error) throw new Error(error.message || `Falha ao consultar ${tableName}.`);
  return data || [];
}

async function fetchAllData() {
  if (isFetching) return;
  isFetching = true;
  const dataWarnings = [];

  try {
    let currentUser = null;
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData?.session;

    if (session?.user) {
      const { data: profile, error: profileError } = await supabase.from('users').select('*').eq('id', session.user.id).single();
      if (profileError && profileError.code !== 'PGRST116') {
        dataWarnings.push(`Perfil do usuário não carregou: ${profileError.message}`);
        console.error('[Supabase] Falha ao carregar perfil do usuário:', profileError);
      }
      currentUser = { ...session.user, ...(profile || {}) };
    }

    if (!currentUser) {
      try {
        const localUserStr = window.localStorage.getItem('scale_logged_user');
        const isSessionActive = window.localStorage.getItem('escala_medica_session') === 'active';
        if (localUserStr && isSessionActive) {
          currentUser = JSON.parse(localUserStr);
        }
      } catch {}
    }

    if (!currentUser) {
      currentUser = {
        id: 'usr_guest',
        full_name: 'Usuário Convidado',
        email: 'guest@hospital.com',
        role: 'user',
        data: { status: 'aprovado', app_role: 'assistencial' }
      };
    }

    const compId = currentUser?.data?.company_id || currentUser?.company_id || 'cmp_principal';
    
    const { data: compData, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', compId)
      .maybeSingle();
    if (companyError) dataWarnings.push(`Dados da empresa não carregaram: ${companyError.message}`);

    const company = compData || { 
      id: compId, 
      name: 'Hospital Principal', 
      data: { units: [{ id: 'unit_h1', name: 'Unidade Matriz' }] } 
    };
    
    const activeUnits = Array.isArray(company.units) && company.units.length > 0 
      ? company.units 
      : (company.data?.units || [{ id: 'unit_h1', name: 'Unidade Matriz' }]);

    const preferredUnitId = (() => {
      try {
        return window.localStorage.getItem('scale_selected_unit') || currentUser?.data?.selected_unit_id;
      } catch (error) {
        console.warn('Não foi possível ler a unidade selecionada:', error);
        return currentUser?.data?.selected_unit_id;
      }
    })();
    const selectedUnitId = activeUnits.some(unit => String(unit.id) === String(preferredUnitId))
      ? String(preferredUnitId)
      : String(activeUnits[0]?.id || 'unit_h1');

    const tableRequests = [
      ['professionals', fetchTable('professionals', { company_id: compId })],
      ['sectors', fetchTable('sectors', { company_id: compId })],
      ['shifts', fetchTable('shifts', { company_id: compId })],
      ['shift_swaps', fetchTable('shift_swaps', { company_id: compId })],
      ['users', fetchTable('users')]
    ];
    const tableResults = await Promise.allSettled(tableRequests.map(([, request]) => request));
    const loadedTables = tableResults.map((result, index) => {
      if (result.status === 'fulfilled') return result.value;
      const tableName = tableRequests[index][0];
      const message = result.reason?.message || String(result.reason || 'Erro desconhecido');
      dataWarnings.push(`Dados de ${tableName} não carregaram: ${message}`);
      console.error(`[Supabase] Falha ao carregar ${tableName}:`, result.reason);
      return [];
    });
    const [rawProfs, secRes, rawShifts, rawSwaps, allUsers] = loadedTables;

    const enrichedProfs = rawProfs.map(prof => {
      let cachedMeta = {};
      try {
        const str = window.localStorage.getItem(`prof_meta_${prof.id}`);
        if (str) cachedMeta = JSON.parse(str);
      } catch {}

      const linkedUser = allUsers.find(u => String(u.id) === String(prof.user_id) || String(u.data?.professional_id) === String(prof.id));
      const userMeta = linkedUser?.data || {};
      const profileData = prof.data && typeof prof.data === 'object' && !Array.isArray(prof.data)
        ? prof.data
        : {};
      const profileMetadata = prof.metadata && typeof prof.metadata === 'object' && !Array.isArray(prof.metadata)
        ? prof.metadata
        : {};

      return {
        ...prof,
        app_role: profileData.app_role || profileMetadata.app_role || userMeta.app_role || cachedMeta.app_role || 'assistencial',
        username: linkedUser?.username || userMeta.username || cachedMeta.username || '',
        data: { ...cachedMeta, ...userMeta, ...profileMetadata, ...profileData }
      };
    });

    const unitIds = new Set(activeUnits.map(unit => String(unit.id)));
    const professionalsById = new Map(enrichedProfs.map(prof => [String(prof.id), prof]));
    const sectorsById = new Map(secRes.map(sector => [String(sector.id), sector]));
    const normalizedShifts = rawShifts.map(shift => {
      if (shift.unit_id && unitIds.has(String(shift.unit_id))) return shift;
      const sectorUnitId = sectorsById.get(String(shift.sector_id))?.unit_id;
      const professional = professionalsById.get(String(shift.professional_id));
      const allowedUnitIds = Array.isArray(professional?.data?.allowed_unit_ids)
        ? professional.data.allowed_unit_ids
        : Array.isArray(professional?.unit_ids) ? professional.unit_ids
          : professional?.unit_id ? [professional.unit_id] : [];
      const inferredUnitId = inferUnassignedShiftUnitId({
        units: activeUnits,
        sectorUnitId,
        professionalUnitIds: allowedUnitIds
      });

      return inferredUnitId
        ? { ...shift, unit_id: inferredUnitId, unit_assignment_inferred: true }
        : shift;
    });
    const unassignedShifts = normalizedShifts.filter(shift => !shift.unit_id || !unitIds.has(String(shift.unit_id)));
    if (unassignedShifts.length > 0) {
      dataWarnings.push(`${unassignedShifts.length} plantão(ões) sem unidade definida foram isolados dos relatórios por unidade para evitar duplicidade.`);
    }
    const resolvedShiftUnits = new Map(normalizedShifts.filter(shift => shift.unit_id).map(shift => [String(shift.id), shift.unit_id]));
    const normalizedSwaps = rawSwaps.map(swap => {
      if (swap.unit_id && unitIds.has(String(swap.unit_id))) return swap;
      const linkedUnitId = resolvedShiftUnits.get(String(swap.shift_id));
      const inferredUnitId = linkedUnitId || (activeUnits.length === 1 ? String(activeUnits[0].id) : null);
      return inferredUnitId ? { ...swap, unit_id: String(inferredUnitId) } : swap;
    });

    updateGlobal({
      user: currentUser,
      company,
      units: activeUnits,
      selectedUnitId,
      professionals: enrichedProfs,
      sectors: secRes,
      shifts: normalizedShifts,
      swaps: normalizedSwaps,
      unassignedShifts,
      dataWarnings,
      loading: false
    });
  } catch (err) {
    console.error('Erro ao sincronizar dados:', err);
    updateGlobal({ loading: false, dataWarnings: [`Falha ao sincronizar os dados da plataforma: ${err?.message || err}`] });
  } finally {
    isFetching = false;
  }
}

export function useAppData() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(t => t + 1);
    listeners.add(listener);
    fetchAllData();
    return () => listeners.delete(listener);
  }, []);

  const syncGlobalData = useCallback(() => {
    fetchAllData();
  }, []);

  const setSelectedUnitId = useCallback((newId) => {
    const validUnit = globalState.units.some(unit => String(unit.id) === String(newId));
    if (!validUnit) {
      console.error(`Unidade selecionada não encontrada: ${newId}`);
      return;
    }
    window.localStorage.setItem('scale_selected_unit', String(newId));
    updateGlobal({ selectedUnitId: String(newId) });
  }, []);

  const user = globalState.user;
  const userAppRole = user?.data?.app_role || (user?.role === 'admin' ? 'gestor' : 'assistencial');
  const isAdmin = user?.role === 'admin' || userAppRole === 'gestor' || user?.email === 'admin@admin.com';
  const isCoordinator = isAdmin || userAppRole === 'coordenador';
  const isBilling = isAdmin || userAppRole === 'faturamento';
  const isManager = isAdmin || isCoordinator;
  const isAssistencial = userAppRole === 'assistencial' || userAppRole === 'medico';

  // BLINDAGEM DE DADOS: Fatiando os dados globais para mostrar SÓ os da unidade selecionada
  const unitSectors = useMemo(() => globalState.sectors.filter(s => !s.unit_id || String(s.unit_id) === String(globalState.selectedUnitId)), [globalState.sectors, globalState.selectedUnitId]);
  const unitShifts = useMemo(() => globalState.shifts.filter(s => String(s.unit_id) === String(globalState.selectedUnitId)), [globalState.shifts, globalState.selectedUnitId]);
  const unitSwaps = useMemo(() => globalState.swaps.filter(s => String(s.unit_id) === String(globalState.selectedUnitId)), [globalState.swaps, globalState.selectedUnitId]);
  
  const unitProfessionals = useMemo(() => globalState.professionals.filter(p => {
    const allowedUnits = p.data?.allowed_unit_ids || [];
    return String(p.unit_id) === String(globalState.selectedUnitId) ||
      allowedUnits.some(unitId => String(unitId) === String(globalState.selectedUnitId));
  }), [globalState.professionals, globalState.selectedUnitId]);

  const professionalMap = useMemo(() => {
    const m = {};
    unitProfessionals.forEach(p => { if (p?.id) m[p.id] = p; });
    return m;
  }, [unitProfessionals]);

  const sectorMap = useMemo(() => {
    const m = {};
    unitSectors.forEach(s => { if (s?.id) m[String(s.id)] = s; });
    return m;
  }, [unitSectors]);

  const currentProfessional = useMemo(() => {
    if (user && globalState.professionals.length) {
      const found = globalState.professionals.find(p => 
        String(p.user_id) === String(user.id) || 
        String(p.id) === String(user.data?.professional_id) ||
        (p.email && user.email && p.email.toLowerCase() === user.email.toLowerCase())
      );
      if (found) return found;
    }
    return {
      id: user?.data?.professional_id || user?.id || 'temp_user_id',
      name: user?.full_name || 'Profissional',
      email: user?.email || '',
      specialty: user?.data?.specialty || 'Clínica Geral',
      status: 'ativo'
    };
  }, [user]);

  return {
    ...globalState,
    sectors: unitSectors,
    shifts: unitShifts,
    swaps: unitSwaps,
    professionals: unitProfessionals,
    allCompanyProfessionals: globalState.professionals,
    allCompanySectors: globalState.sectors,
    professionalMap,
    sectorMap,
    isAdmin,
    isCoordinator,
    isBilling,
    isManager,
    isAssistencial,
    userAppRole,
    isApproved: true,
    currentProfessional,
    setSelectedUnitId,
    syncGlobalData,
    refreshAllData: syncGlobalData
  };
}

export function AppDataProvider({ children }) {
  return <>{children}</>;
}