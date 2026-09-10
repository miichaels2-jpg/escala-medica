import { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useAppData() {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);
      if (me?.data?.company_id) {
        try {
          const comp = await base44.entities.Company.get(me.data.company_id);
          const selectedUnitId = me?.data?.selected_unit_id || comp?.selected_unit_id || comp?.units?.[0]?.id;
          if (comp) {
            setCompany({
              ...comp,
              selected_unit_id: selectedUnitId,
              units: comp.units || [],
              current_unit: (comp.units || []).find((unit) => unit.id === selectedUnitId) || comp.units?.[0] || null
            });
          }
        } catch (e) {
          /* company may not exist yet */
        }
      }
    } catch (e) {
      /* not logged in */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { user, company, loading, refresh };
}