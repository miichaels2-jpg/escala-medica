export function inferUnassignedShiftUnitId({ units = [], sectorUnitId, professionalUnitIds = [] }) {
  const knownUnitIds = new Set(units.map(unit => String(unit.id)));
  const normalizedSectorUnitId = sectorUnitId == null ? '' : String(sectorUnitId);
  if (normalizedSectorUnitId && knownUnitIds.has(normalizedSectorUnitId)) return normalizedSectorUnitId;

  const allowedUnitIds = [...new Set(professionalUnitIds.map(String))]
    .filter(unitId => knownUnitIds.has(unitId));
  if (allowedUnitIds.length === 1) return allowedUnitIds[0];
  if (units.length === 1) return String(units[0].id);
  return null;
}
