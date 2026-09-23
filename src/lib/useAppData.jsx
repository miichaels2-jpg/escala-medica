import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

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
};

const listeners = new Set();
let isFetching = false;

function updateGlobal(patch) {
  globalState = { ...globalState, ...patch };
  listeners.forEach(fn => fn());
}

async function fetchTable(tableName, filterObj = {}, limit = 5000) {
  try {
    let query = supabase.from(tableName).select('*');
    for (const key in filterObj) {
      query = query.eq(key, filterObj[key]);
    }
    const { data, error } = await query.limit(limit);
    if (error) {
      console.warn(`[Supabase] Erro/Tabela '${tableName}' ausente. (Ignorado).`);
      return [];
    }
    return data || [];
  } catch (err) {
    return [];
  }
}

async function fetchAllData() {
  if (isFetching) return;
  isFetching = true;

  try {
    let currentUser = null;
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      const { data: profile } = await supabase.from('users').select('*').eq('id', session.user.id).single();
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
    
    let compData = null;
    try {
      const { data } = await supabase.from('companies').select('*').eq('id', compId).single();
      compData = data;
    } catch {}

    const company = compData || { 
      id: compId, 
      name: 'Hospital Principal', 
      data: { units: [{ id: 'unit_h1', name: 'Unidade Matriz' }] } 
    };
    
    const activeUnits = Array.isArray(company.units) && company.units.length > 0 
      ? company.units 
      : (company.data?.units || [{ id: 'unit_h1', name: 'Unidade Matriz' }]);

    const savedUnitId = window.localStorage.getItem('scale_selected_unit');
    const selectedUnitId = savedUnitId || currentUser?.data?.selected_unit_id || activeUnits[0]?.id || 'unit_h1';

    const [rawProfs, secRes, sRes, swRes, allUsers] = await Promise.all([
      fetchTable('professionals', { company_id: compId }),
      fetchTable('sectors', { company_id: compId }),
      fetchTable('shifts', { company_id: compId }),
      fetchTable('shift_swaps', { company_id: compId }),
      fetchTable('users')
    ]);

    const enrichedProfs = rawProfs.map(prof => {
      let cachedMeta = {};
      try {
        const str = window.localStorage.getItem(`prof_meta_${prof.id}`);
        if (str) cachedMeta = JSON.parse(str);
      } catch {}

      const linkedUser = allUsers.find(u => String(u.id) === String(prof.user_id) || String(u.data?.professional_id) === String(prof.id));
      const userMeta = linkedUser?.data || {};

      return {
        ...prof,
        app_role: userMeta.app_role || cachedMeta.app_role || 'assistencial',
        username: linkedUser?.username || userMeta.username || cachedMeta.username || '',
        data: { ...userMeta, ...cachedMeta }
      };
    });

    updateGlobal({
      user: currentUser,
      company,
      units: activeUnits,
      selectedUnitId,
      professionals: enrichedProfs,
      sectors: secRes,
      shifts: sRes,
      swaps: swRes,
      loading: false
    });
  } catch (err) {
    console.error('Erro ao sincronizar dados:', err);
    updateGlobal({ loading: false });
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
    window.localStorage.setItem('scale_selected_unit', newId);
    updateGlobal({ selectedUnitId: newId });
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
  const unitShifts = useMemo(() => globalState.shifts.filter(s => !s.unit_id || String(s.unit_id) === String(globalState.selectedUnitId)), [globalState.shifts, globalState.selectedUnitId]);
  const unitSwaps = useMemo(() => globalState.swaps.filter(s => !s.unit_id || String(s.unit_id) === String(globalState.selectedUnitId)), [globalState.swaps, globalState.selectedUnitId]);
  
  const unitProfessionals = useMemo(() => globalState.professionals.filter(p => {
    const allowedUnits = p.data?.allowed_unit_ids || [];
    return String(p.unit_id) === String(globalState.selectedUnitId) || allowedUnits.includes(String(globalState.selectedUnitId));
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