import { useCallback, useMemo } from 'react';
import { useAppData } from '@/lib/useAppData';

// "Todas as unidades" (escolha global do topo), V0.9.7: as unidades que o gestor administra e se a
// tela deve juntar todas. Mesma regra do Corpo Clínico e do Painel.
export function useUnitScope() {
  const { units = [], user, selectedUnitId, allUnitsView, isManager } = useAppData();
  const managedUnits = useMemo(() => {
    const allowed = Array.isArray(user?.data?.allowed_unit_ids) ? user.data.allowed_unit_ids.map(String) : [];
    return units.filter(u => user?.role === 'admin' || allowed.length === 0 || allowed.includes(String(u.id)));
  }, [units, user]);
  const managedKey = managedUnits.map(u => String(u.id)).join('|');
  const managedUnitIds = useMemo(() => (managedKey ? managedKey.split('|') : []), [managedKey]);
  const isAllUnits = Boolean(isManager && allUnitsView) && managedUnitIds.length > 1;
  const scopeKey = isAllUnits ? managedKey : String(selectedUnitId || '');
  const scopeUnitIds = useMemo(() => (scopeKey ? scopeKey.split('|') : []), [scopeKey]);
  const namesKey = units.map(u => `${u.id}=${u.name}`).join('|');
  const unitNameById = useMemo(() => Object.fromEntries(units.map(u => [String(u.id), u.name])), [namesKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const unitName = useCallback(id => unitNameById[String(id)] || 'Unidade', [unitNameById]);
  const inScope = useCallback(unitId => scopeUnitIds.includes(String(unitId)), [scopeUnitIds]);
  return { managedUnits, managedUnitIds, isAllUnits, scopeUnitIds, unitName, inScope };
}
