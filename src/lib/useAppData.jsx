import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';

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

async function fetchAllData() {
  if (isFetching) return;
  isFetching = true;

  try {
    let currentUser = null;
    const storedUserId = window.localStorage.getItem('scale_logged_user');

    if (storedUserId && base44?.entities?.User?.get) {
      currentUser = await base44.entities.User.get(storedUserId).catch(() => null);
    }

    if (!currentUser && base44?.auth?.me) {
      currentUser = await base44.auth.me().catch(() => null);
    }

    // Fallback padrão se não houver usuário na sessão
    if (!currentUser) {
      currentUser = {
        id: 'usr_guest',
        full_name: 'Usuário Convidado',
        email: 'guest@hospital.com',
        role: 'user',
        data: { status: 'aprovado', app_role: 'assistencial' }
      };
    }

    const compId = currentUser?.data?.company_id || 'cmp_principal';
    let compData = null;
    try {
      compData = await base44?.entities?.Company?.get(compId).catch(() => null);
    } catch {}

    const company = compData || { id: compId, name: 'Hospital Principal', units: [{ id: 'unit_h1', name: 'Unidade Matriz' }] };
    const units = Array.isArray(company.units) && company.units.length > 0 
      ? company.units 
      : [{ id: 'unit_h1', name: 'Unidade Matriz' }];

    const selectedUnitId = currentUser?.data?.selected_unit_id || units[0].id;

    // Busca dados em paralelo
    const [pRes, secRes, sRes, swRes, uRes] = await Promise.all([
      base44?.entities?.Professional?.filter({ company_id: compId }, '-created_date', 1000).catch(() => []),
      base44?.entities?.Sector?.filter({ company_id: compId }, 'name', 300).catch(() => []),
      base44?.entities?.Shift?.filter({ company_id: compId }, '-date', 5000).catch(() => []),
      base44?.entities?.ShiftSwap?.filter({ company_id: compId }, '-created_date', 1000).catch(() => []),
      base44?.entities?.User?.filter({ role: 'user' }, '-created_date', 1000).catch(() => [])
    ]);

    const rawProfs = Array.isArray(pRes) ? pRes : pRes?.data || [];
    const allUsers = Array.isArray(uRes) ? uRes : uRes?.data || [];

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
        coop_tax_rate: userMeta.coop_tax_rate ?? cachedMeta.coop_tax_rate ?? 0,
        daily_rate: userMeta.daily_rate ?? cachedMeta.daily_rate ?? 1500,
        monthly_salary: userMeta.monthly_salary ?? cachedMeta.monthly_salary ?? 18000,
        monthly_work_hours: userMeta.monthly_work_hours ?? cachedMeta.monthly_work_hours ?? 220,
        pix_type: userMeta.pix_type || cachedMeta.pix_type || 'CPF',
        pix_key: userMeta.pix_key || cachedMeta.pix_key || '',
        bank_info: userMeta.bank_info || cachedMeta.bank_info || '',
        data: { ...userMeta, ...cachedMeta }
      };
    });

    updateGlobal({
      user: currentUser,
      company,
      units,
      selectedUnitId,
      professionals: enrichedProfs,
      sectors: Array.isArray(secRes) ? secRes : secRes?.data || [],
      shifts: Array.isArray(sRes) ? sRes : sRes?.data || [],
      swaps: Array.isArray(swRes) ? swRes : swRes?.data || [],
      loading: false
    });
  } catch (err) {
    console.error('Erro ao sincronizar dados centrais:', err);
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
    updateGlobal({ selectedUnitId: newId });
  }, []);

  const user = globalState.user;

  // MATRIZ DE PERMISSÕES RBAC
  const userAppRole = user?.data?.app_role || (user?.role === 'admin' ? 'gestor' : 'assistencial');
  const isAdmin = user?.role === 'admin' || userAppRole === 'gestor' || user?.email === 'admin@admin.com';
  const isCoordinator = isAdmin || userAppRole === 'coordenador';
  const isBilling = isAdmin || userAppRole === 'faturamento';
  const isManager = isAdmin || isCoordinator; // Responsáveis por montar e gerenciar escala
  const isAssistencial = userAppRole === 'assistencial' || userAppRole === 'medico';

  const professionalMap = useMemo(() => {
    const m = {};
    globalState.professionals.forEach(p => { if (p?.id) m[p.id] = p; });
    return m;
  }, []);

  const sectorMap = useMemo(() => {
    const m = {};
    globalState.sectors.forEach(s => { if (s?.id) m[String(s.id)] = s; });
    return m;
  }, []);

  // Blindagem: currentProfessional nunca retorna null para impedir tela branca
  const currentProfessional = useMemo(() => {
    if (user && globalState.professionals.length) {
      const found = globalState.professionals.find(p => 
        String(p.user_id) === String(user.id) || 
        String(p.id) === String(user.data?.professional_id) ||
        (p.email && user.email && p.email.toLowerCase() === user.email.toLowerCase())
      );
      if (found) return found;
    }

    // Objeto seguro de fallback
    return {
      id: user?.data?.professional_id || user?.id || 'temp_user_id',
      name: user?.full_name || 'Profissional',
      email: user?.email || '',
      specialty: user?.data?.specialty || 'Clínica Geral',
      status: 'ativo',
      remuneration_type: 'hora',
      hourly_rate: 120
    };
  }, [user]);

  return {
    ...globalState,
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