import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

export function useAppData() {
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem('medscale_session_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const isFetchingRef = useRef(false);

  const refreshData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const currentUser = await base44.auth.me();
      if (currentUser) {
        setUser((prev) => {
          // Só altera o estado se o ID ou papel realmente mudarem, evitando re-render loop
          if (JSON.stringify(prev) !== JSON.stringify(currentUser)) {
            return currentUser;
          }
          return prev;
        });

        const compId = currentUser?.data?.company_id || 'cmp_principal';
        const comp = await base44.entities.Company.get(compId);
        if (comp) {
          setCompany((prev) => {
            if (JSON.stringify(prev) !== JSON.stringify(comp)) return comp;
            return prev;
          });
        }
      }
    } catch (err) {
      console.error('Erro ao buscar dados do app:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return {
    user,
    company,
    loading,
    refreshData
  };
}