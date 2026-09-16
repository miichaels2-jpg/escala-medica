import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';

// Estado compartilhado em memória para que todas as telas conversem instantaneamente
let globalState = {
  user: {
    id: 'usr_admin',
    full_name: 'Administrador',
    email: 'admin@admin.com',
    role: 'admin',
    data: { status: 'aprovado', app_role: 'manager', company_id: 'cmp_principal' }
  },
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
    if (base44?.auth?.me) {
      currentUser = await base44.auth.me().catch(() => null);
    }

    const compId = currentUser?.data?.company_id || 'cmp_principal';
    let compData = null;
    try {
      compData = await base44.entities?.Company?.get(compId).catch(() => null);
    } catch (e) {}

    const company = compData || { id: compId, name: 'Hospital Principal', units: [{ id: 'unit_h1', name: 'Unidade Matriz' }] };
    const units = Array.isArray(company.units) && company.units.length > 0 
      ? company.units 
      : [{ id: 'unit_h1', name: 'Unidade Matriz' }];

    const selectedUnitId = currentUser?.data?.selected_unit_id || units[0].id;

    // Busca todas as entidades principais em paralelo
    const [pRes, secRes, sRes, swRes] = await Promise.all([
      base44?.entities?.Professional?.filter({ company_id: compId }, '-created_date', 1000).catch(() => []),
      base44?.entities?.Sector?.filter({ company_id: compId }, 'name', 300).catch(() => []),
      base44?.entities?.Shift?.filter({ company_id: compId }, '-date', 5000).catch(() => []),
      base44?.entities?.ShiftSwap?.filter({ company_id: compId }, '-created_date', 1000).catch(() => [])
    ]);

    updateGlobal({
      user: currentUser || globalState.user,
      company,
      units,
      selectedUnitId,
      professionals: Array.isArray(pRes) ? pRes : pRes?.data || [],
      sectors: Array.isArray(secRes) ? secRes : secRes?.data || [],
      shifts: Array.isArray(sRes) ? sRes : sRes?.data || [],
      swaps: Array.isArray(swRes) ? swRes : swRes?.data || [],
      loading: false
    });
  } catch (err) {
    console.error('Erro ao carregar dados centrais:', err);
    updateGlobal({ loading: false });
  } finally {
    isFetching = false;
  }
}

// Hook principal utilizado em todas as páginas
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
  const isAdmin = user?.role === 'admin' || user?.data?.app_role === 'admin' || user?.email === 'admin@admin.com';
  const isManager = isAdmin || user?.data?.app_role === 'manager' || user?.data?.app_role === 'gestor';

  const currentProfessional = useMemo(() => {
    if (!globalState.professionals.length || !user) return null;
    return globalState.professionals.find(p => 
      String(p.user_id) === String(user.id) || 
      String(p.id) === String(user.data?.professional_id) ||
      (p.email && user.email && p.email.toLowerCase() === user.email.toLowerCase())
    ) || null;
  }, [globalState.professionals, user]);

  return {
    ...globalState,
    isAdmin,
    isManager,
    isApproved: true,
    currentProfessional,
    setSelectedUnitId,
    syncGlobalData,
    refreshAllData: syncGlobalData
  };
}

// Componente seguro para não quebrar quem ainda tiver a tag AppDataProvider no JSX
export function AppDataProvider({ children }) {
  return <>{children}</>;
}