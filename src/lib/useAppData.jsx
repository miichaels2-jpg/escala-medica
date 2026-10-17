import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { inferUnassignedShiftUnitId, resolveUnitId } from '@/lib/unitAssignment';
import {
  PAYMENTS_STORAGE_KEY, PUBLISHED_STORAGE_PREFIX, paymentKey, publishedKey, readLegacySharedState, sanitizeRanges
} from '@/lib/sharedState';

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
  publishedRanges: {},
  paymentStatuses: {},
  sharedStateRemote: false,
};

const listeners = new Set();
let isFetching = false;
let activeFetch = null;
let refetchRequested = false;

function updateGlobal(patch) {
  globalState = { ...globalState, ...patch };
  listeners.forEach(fn => fn());
}

function migrateLegacyUnitStorage(activeUnits) {
  try {
    const mappings = activeUnits.filter(unit => unit.id && unit.legacy_id &&
      String(unit.id) !== String(unit.legacy_id));
    if (mappings.length === 0) return;

    const keys = Object.keys(window.localStorage);
    mappings.forEach(unit => {
      const oldPrefix = `scale_published_ranges_${unit.legacy_id}_`;
      keys.filter(key => key.startsWith(oldPrefix)).forEach(oldKey => {
        const newKey = `scale_published_ranges_${unit.id}_${oldKey.slice(oldPrefix.length)}`;
        const oldValue = window.localStorage.getItem(oldKey);
        const newValue = window.localStorage.getItem(newKey);
        if (oldValue === null) return;
        if (newValue === null) {
          window.localStorage.setItem(newKey, oldValue);
        } else {
          try {
            const oldRanges = JSON.parse(oldValue);
            const newRanges = JSON.parse(newValue);
            if (!Array.isArray(oldRanges) || !Array.isArray(newRanges)) {
              console.warn('As faixas locais de publicação têm formato inesperado; a cópia antiga foi mantida:', oldKey);
              return;
            }
            window.localStorage.setItem(newKey, JSON.stringify([...new Set([...newRanges, ...oldRanges])]));
          } catch (error) {
            console.warn('Não foi possível consolidar faixas de publicação locais após migrar o ID da unidade:', error);
            return;
          }
        }
        window.localStorage.removeItem(oldKey);
      });
    });
  } catch (error) {
    console.warn('Não foi possível migrar as faixas de publicação locais para os UUIDs hospitalares:', error);
  }
}

// Colunas públicas de users: senha/hash nunca são lidos pelo app.
export const USER_PUBLIC_COLUMNS = 'id,username,email,full_name,role,data,created_date,updated_date';

async function fetchTable(tableName, filterObj = {}, limit = 5000, columns = '*') {
  let query = supabase.from(tableName).select(columns);
  for (const key in filterObj) {
    query = query.eq(key, filterObj[key]);
  }
  const { data, error } = await query.limit(limit);
  if (error) {
    const queryError = new Error(error.message || `Falha ao consultar ${tableName}.`);
    queryError.code = error.code;
    throw queryError;
  }
  return data || [];
}

function readSharedStateFromRows(publishedRows, paymentRows, resolveStoredUnitId) {
  const publishedRanges = {};
  (publishedRows || []).forEach(row => {
    const ranges = sanitizeRanges(row.ranges);
    if (ranges.length) publishedRanges[publishedKey(resolveStoredUnitId(row.unit_id), row.sector_id, row.year, row.month)] = ranges;
  });
  const paymentStatuses = {};
  (paymentRows || []).forEach(row => {
    if (row.paid) paymentStatuses[paymentKey(resolveStoredUnitId(row.unit_id), row.professional_id, row.month)] = true;
  });
  return { publishedRanges, paymentStatuses };
}

async function buildSharedState({ companyId, units, professionals, resolveStoredUnitId, remote, publishedRows, paymentRows, dataWarnings }) {
  let legacy = { published: [], payments: [] };
  try { legacy = readLegacySharedState(window.localStorage, units, professionals); } catch {}

  if (!remote) {
    // Banco ainda sem as tabelas: segue funcionando com o que está neste navegador.
    const publishedRanges = {};
    legacy.published.forEach(item => { publishedRanges[publishedKey(item.unitId, item.sectorId, item.year, item.month)] = item.ranges; });
    const paymentStatuses = {};
    legacy.payments.forEach(item => { paymentStatuses[paymentKey(item.unitId, item.professionalId, item.month)] = true; });
    return { publishedRanges, paymentStatuses };
  }

  const state = readSharedStateFromRows(publishedRows, paymentRows, resolveStoredUnitId);
  const uploadedFlag = `scale_shared_state_uploaded_${companyId}`;
  let alreadyUploaded = false;
  try { alreadyUploaded = window.localStorage.getItem(uploadedFlag) === 'true'; } catch {}
  if (alreadyUploaded) return state;

  // Envia uma única vez o que existia só neste navegador e ainda não está no banco.
  const publishedToUpload = legacy.published
    .filter(item => !state.publishedRanges[publishedKey(item.unitId, item.sectorId, item.year, item.month)])
    .map(item => ({
      company_id: companyId, unit_id: item.unitId, sector_id: String(item.sectorId),
      year: item.year, month: item.month, ranges: item.ranges, updated_by: 'migracao-navegador'
    }));
  const paymentsToUpload = legacy.payments
    .filter(item => !state.paymentStatuses[paymentKey(item.unitId, item.professionalId, item.month)])
    .map(item => ({
      company_id: companyId, unit_id: item.unitId, professional_id: String(item.professionalId),
      month: item.month, paid: true, paid_at: new Date().toISOString(), paid_by: 'migracao-navegador'
    }));

  try {
    if (publishedToUpload.length) {
      const { error } = await supabase.from('published_schedules')
        .upsert(publishedToUpload, { onConflict: 'company_id,unit_id,sector_id,year,month', ignoreDuplicates: true });
      if (error) throw error;
      publishedToUpload.forEach(row => { state.publishedRanges[publishedKey(row.unit_id, row.sector_id, row.year, row.month)] = row.ranges; });
    }
    if (paymentsToUpload.length) {
      const { error } = await supabase.from('payment_statuses')
        .upsert(paymentsToUpload, { onConflict: 'company_id,unit_id,professional_id,month', ignoreDuplicates: true });
      if (error) throw error;
      paymentsToUpload.forEach(row => { state.paymentStatuses[paymentKey(row.unit_id, row.professional_id, row.month)] = true; });
    }
    try { window.localStorage.setItem(uploadedFlag, 'true'); } catch {}
  } catch (error) {
    console.error('[Supabase] Falha ao enviar publicações/pagamentos salvos neste navegador:', error);
    dataWarnings.push(`Publicações ou pagamentos salvos só neste navegador ainda não foram enviados ao banco: ${error.message}`);
  }
  return state;
}

export async function savePublishedRanges({ unitId, sectorId, year, month, ranges, updatedBy }) {
  const key = publishedKey(unitId, sectorId, year, month);
  const cleanRanges = sanitizeRanges(ranges);
  const companyId = String(globalState.company?.id || 'cmp_principal');

  if (globalState.sharedStateRemote) {
    const scope = { company_id: companyId, unit_id: String(unitId), sector_id: String(sectorId), year: Number(year), month: Number(month) };
    const request = cleanRanges.length
      ? supabase.from('published_schedules').upsert(
          [{ ...scope, ranges: cleanRanges, updated_by: updatedBy || null, updated_date: new Date().toISOString() }],
          { onConflict: 'company_id,unit_id,sector_id,year,month' }
        )
      : supabase.from('published_schedules').delete().match(scope);
    const { error } = await request;
    if (error) throw new Error(error.message || 'Não foi possível salvar a publicação da escala.');
  } else {
    const storageKey = `${PUBLISHED_STORAGE_PREFIX}${unitId}_${sectorId}_${year}_${month}`;
    if (cleanRanges.length) window.localStorage.setItem(storageKey, JSON.stringify(cleanRanges));
    else window.localStorage.removeItem(storageKey);
  }

  const next = { ...(globalState.publishedRanges || {}) };
  if (cleanRanges.length) next[key] = cleanRanges; else delete next[key];
  updateGlobal({ publishedRanges: next });
}

export async function savePaymentStatus({ unitId, professionalId, month, paid, updatedBy }) {
  const key = paymentKey(unitId, professionalId, month);
  const companyId = String(globalState.company?.id || 'cmp_principal');

  if (globalState.sharedStateRemote) {
    const { error } = await supabase.from('payment_statuses').upsert([{
      company_id: companyId,
      unit_id: String(unitId),
      professional_id: String(professionalId),
      month,
      paid: Boolean(paid),
      paid_at: paid ? new Date().toISOString() : null,
      paid_by: paid ? (updatedBy || null) : null,
      updated_date: new Date().toISOString()
    }], { onConflict: 'company_id,unit_id,professional_id,month' });
    if (error) throw new Error(error.message || 'Não foi possível salvar o status de pagamento.');
  } else {
    const stored = JSON.parse(window.localStorage.getItem(PAYMENTS_STORAGE_KEY) || '{}');
    stored[`${unitId}_${professionalId}_${month}`] = Boolean(paid);
    window.localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(stored));
  }

  const next = { ...(globalState.paymentStatuses || {}) };
  if (paid) next[key] = true; else delete next[key];
  updateGlobal({ paymentStatuses: next });
}

// Garante que uma sincronização pedida durante outra em andamento não seja
// descartada: ela roda logo em seguida e quem aguardou recebe os dados novos.
function fetchAllData() {
  if (isFetching) {
    refetchRequested = true;
    return activeFetch;
  }
  isFetching = true;
  activeFetch = (async () => {
    try {
      do {
        refetchRequested = false;
        await loadAllData();
      } while (refetchRequested);
    } finally {
      isFetching = false;
      activeFetch = null;
    }
  })();
  return activeFetch;
}

async function loadAllData() {
  const dataWarnings = [];

  try {
    let currentUser = null;
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData?.session;

    if (session?.user) {
      const { data: profile, error: profileError } = await supabase.from('users').select(USER_PUBLIC_COLUMNS).eq('id', session.user.id).single();
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

    const tableRequests = [
      ['units', fetchTable('units', { company_id: compId })],
      ['professionals', fetchTable('professionals', { company_id: compId })],
      ['sectors', fetchTable('sectors', { company_id: compId })],
      ['shifts', fetchTable('shifts', { company_id: compId })],
      ['shift_swaps', fetchTable('shift_swaps', { company_id: compId })],
      ['users', fetchTable('users', {}, 5000, USER_PUBLIC_COLUMNS)],
      ['published_schedules', fetchTable('published_schedules', { company_id: compId })],
      ['payment_statuses', fetchTable('payment_statuses', { company_id: compId })]
    ];
    const tableResults = await Promise.allSettled(tableRequests.map(([, request]) => request));
    let sharedStateRemote = true;
    const loadedTables = tableResults.map((result, index) => {
      if (result.status === 'fulfilled') return result.value;
      const tableName = tableRequests[index][0];
      const error = result.reason;
      if (tableName === 'units' && error?.code === 'PGRST205') return [];
      if (['published_schedules', 'payment_statuses'].includes(tableName) && error?.code === 'PGRST205') {
        sharedStateRemote = false;
        return [];
      }
      const message = error?.message || String(error || 'Erro desconhecido');
      dataWarnings.push(`Dados de ${tableName} não carregaram: ${message}`);
      console.error(`[Supabase] Falha ao carregar ${tableName}:`, error);
      return [];
    });
    const [unitRows, rawProfs, secRes, rawShifts, rawSwaps, allUsers, publishedRows, paymentRows] = loadedTables;

    const activeUnits = unitRows.length > 0
      ? unitRows
      : Array.isArray(company.units) && company.units.length > 0
      ? company.units
      : (company.data?.units || [{ id: 'unit_h1', name: 'Unidade Matriz' }]);
    migrateLegacyUnitStorage(activeUnits);

    const resolveStoredUnitId = value => {
      const match = activeUnits.find(unit =>
        String(unit.id) === String(value) ||
        (unit.legacy_id && String(unit.legacy_id) === String(value))
      );
      return match ? String(match.id) : value;
    };
    const originalUserData = currentUser?.data || {};
    const normalizedUserData = {
      ...originalUserData,
      ...(originalUserData.selected_unit_id
        ? { selected_unit_id: resolveStoredUnitId(originalUserData.selected_unit_id) }
        : {}),
      ...(Array.isArray(originalUserData.allowed_unit_ids)
        ? { allowed_unit_ids: originalUserData.allowed_unit_ids.map(resolveStoredUnitId) }
        : {})
    };
    if (JSON.stringify(normalizedUserData) !== JSON.stringify(originalUserData)) {
      currentUser = { ...currentUser, data: normalizedUserData };
      try {
        window.localStorage.setItem('scale_logged_user', JSON.stringify(currentUser));
      } catch (error) {
        console.warn('Não foi possível atualizar os vínculos locais do usuário com os UUIDs hospitalares:', error);
      }
    }

    const preferredUnitId = (() => {
      try {
        return window.localStorage.getItem('scale_selected_unit') || currentUser?.data?.selected_unit_id;
      } catch (error) {
        console.warn('Não foi possível ler a unidade selecionada:', error);
        return currentUser?.data?.selected_unit_id;
      }
    })();
    const selectedUnitId = resolveUnitId(activeUnits, preferredUnitId) || 'unit_h1';
    if (selectedUnitId && String(selectedUnitId) !== String(preferredUnitId)) {
      try {
        window.localStorage.setItem('scale_selected_unit', selectedUnitId);
      } catch (error) {
        console.warn('Não foi possível atualizar o identificador da unidade selecionada:', error);
      }
    }

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

    const { publishedRanges, paymentStatuses } = await buildSharedState({
      companyId: String(company.id || compId),
      units: activeUnits,
      professionals: enrichedProfs,
      resolveStoredUnitId,
      remote: sharedStateRemote,
      publishedRows,
      paymentRows,
      dataWarnings
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
      publishedRanges,
      paymentStatuses,
      sharedStateRemote,
      dataWarnings,
      loading: false
    });
  } catch (err) {
    console.error('Erro ao sincronizar dados:', err);
    updateGlobal({ loading: false, dataWarnings: [`Falha ao sincronizar os dados da plataforma: ${err?.message || err}`] });
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

  const syncGlobalData = useCallback(() => fetchAllData(), []);

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
  }, [user, globalState.professionals]);

  return {
    ...globalState,
    sectors: unitSectors,
    shifts: unitShifts,
    swaps: unitSwaps,
    professionals: unitProfessionals,
    allCompanyProfessionals: globalState.professionals,
    allCompanySectors: globalState.sectors,
    allCompanyShifts: globalState.shifts,
    getPublishedRanges: (unitId, sectorId, year, month) =>
      globalState.publishedRanges?.[publishedKey(unitId, sectorId, year, month)] || [],
    isPaymentMarkedPaid: (unitId, professionalId, month) =>
      Boolean(globalState.paymentStatuses?.[paymentKey(unitId, professionalId, month)]),
    savePublishedRanges,
    savePaymentStatus,
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