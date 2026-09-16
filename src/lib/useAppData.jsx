import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';

const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [units, setUnits] = useState([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');

  const [professionals, setProfessionals] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [swaps, setSwaps] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      setAuthLoading(true);
      try {
        // ==========================================
        // LEITURA DA CHAVE MESTRA (BYPASS)
        // ==========================================
        const isBypass = window.localStorage.getItem('admin_master_bypass') === 'true';
        if (isBypass) {
          const mockAdmin = {
            id: 'mock_admin_id_999',
            email: 'admin@admin.com',
            full_name: 'Administrador Master',
            role: 'admin',
            data: { status: 'aprovado', app_role: 'manager', company_id: 'cmp_principal' }
          };
          setUser(mockAdmin);
          setCompany({ id: 'cmp_principal', name: 'Hospital Principal', units: [{ id: 'unit_h1', name: 'Unidade Matriz' }] });
          setUnits([{ id: 'unit_h1', name: 'Unidade Matriz' }]);
          setSelectedUnitId('unit_h1');
          setAuthLoading(false);
          return;
        }

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

  const syncGlobalData = useCallback(async () => {
    const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
    if (!companyId) return;

    setGlobalLoading(true);
    try {
      const query = { company_id: companyId, ...(selectedUnitId ? { unit_id: selectedUnitId } : {}) };

      const [pRes, secRes, sRes, swRes] = await Promise.all([
        base44.entities.Professional.filter({ company_id: companyId }, '-created_date', 1000).catch(() => []),
        base44.entities.Sector.filter(query, 'name', 300).catch(() => []),
        base44.entities.Shift.filter(query, '-date', 5000).catch(() => []),
        base44.entities.ShiftSwap.filter(query, '-created_date', 1000).catch(() => [])
      ]);

      setProfessionals(Array.isArray(pRes) ? pRes : pRes?.data || []);
      setSectors(Array.isArray(secRes) ? secRes : secRes?.data || []);
      setShifts(Array.isArray(sRes) ? sRes : sRes?.data || []);
      setSwaps(Array.isArray(swRes) ? swRes : swRes?.data || []);
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
    return { loading: false, user: null, professionals: [], shifts: [] };
  }
  return context;
}