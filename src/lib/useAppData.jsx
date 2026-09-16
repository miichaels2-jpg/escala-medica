import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';

const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  // Estado de Autenticação
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Estado Multi-Hospital
  const [units, setUnits] = useState([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');

  // Memória Central Integrada
  const [professionals, setProfessionals] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [swaps, setSwaps] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);

  // Inicialização e Autenticação
  useEffect(() => {
    const initAuth = async () => {
      setAuthLoading(true);
      try {
        const currentUser = await base44.auth.getUser(); 
        if (currentUser) {
          setUser(currentUser);
          const compId = currentUser.data?.company_id || 'cmp_principal';
          const compData = await base44.entities.Company.get(compId).catch(() => ({ id: compId, name: 'Hospital Principal' }));
          setCompany(compData);
          
          const loadedUnits = Array.isArray(compData?.units) && compData.units.length > 0 
            ? compData.units 
            : [{ id: 'unit_h1', name: 'Unidade Matriz' }];
          setUnits(loadedUnits);
          
          const defaultUnit = currentUser.data?.selected_unit_id || loadedUnits[0].id;
          setSelectedUnitId(defaultUnit);
        }
      } catch (e) {
        console.warn('Usuário não autenticado.');
      } finally {
        setAuthLoading(false);
      }
    };
    initAuth();
  }, []);

  // Sincronizador Global
  const syncGlobalData = useCallback(async () => {
    const companyId = user?.data?.company_id || company?.id;
    if (!companyId || !selectedUnitId) return;

    setGlobalLoading(true);
    try {
      const query = { company_id: companyId, unit_id: selectedUnitId };

      const [pRes, secRes, sRes, swRes, notifRes] = await Promise.all([
        base44.entities.Professional.filter({ company_id: companyId }, '-created_date', 1000).catch(() => []),
        base44.entities.Sector.filter(query, 'name', 300).catch(() => []),
        base44.entities.Shift.filter(query, '-date', 5000).catch(() => []),
        base44.entities.ShiftSwap.filter(query, '-created_date', 1000).catch(() => []),
        base44.entities.Notification ? base44.entities.Notification.filter({ recipient_user_id: user?.id }, '-created_date', 100).catch(() => []) : Promise.resolve([])
      ]);

      setProfessionals(Array.isArray(pRes) ? pRes : pRes?.data || []);
      setSectors(Array.isArray(secRes) ? secRes : secRes?.data || []);
      setShifts(Array.isArray(sRes) ? sRes : sRes?.data || []);
      setSwaps(Array.isArray(swRes) ? swRes : swRes?.data || []);
      setNotifications(Array.isArray(notifRes) ? notifRes : notifRes?.data || []);
    } catch (err) {
      console.error('Erro no DataSyncService:', err);
    } finally {
      setGlobalLoading(false);
    }
  }, [user, company, selectedUnitId]);

  useEffect(() => {
    if (!authLoading && user) {
      syncGlobalData();
    }
  }, [authLoading, user, selectedUnitId, syncGlobalData]);

  // Permissões e Perfis
  const isAdmin = user?.role === 'admin';
  const isManager = isAdmin || user?.data?.app_role === 'manager' || user?.data?.app_role === 'gestor';
  const isApproved = user?.data?.status === 'aprovado' || isAdmin;

  const currentProfessional = useMemo(() => {
    if (!professionals.length || !user) return null;
    return professionals.find(p => String(p.user_id) === String(user.id) || String(p.id) === String(user.data?.professional_id)) || null;
  }, [professionals, user]);

  const value = {
    user,
    company,
    units,
    selectedUnitId,
    setSelectedUnitId,
    isAdmin,
    isManager,
    isApproved,
    currentProfessional,
    professionals,
    sectors,
    shifts,
    swaps,
    notifications,
    loading: authLoading || globalLoading,
    syncGlobalData
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    // Fallback de segurança para não dar crash caso esqueça o Provider
    return { loading: false, user: null, professionals: [], shifts: [] };
  }
  return context;
}