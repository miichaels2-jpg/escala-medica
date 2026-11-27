// Sobreaviso (V0.10.3): quem fica de reserva em cada setor e dia. Fica nos dados da empresa,
// company.data.standby = { "unidade|setor|AAAA-MM-DD": [idDoProfissional, ...] }, como os turnos padrão.
// Se abrir um furo, quem está de sobreaviso aparece primeiro para a coordenação, recebe o chamado
// ("Chamar sobreaviso") e vê a vaga no topo do Mural.

const KEEP_DAYS = 60;

export const standbyKey = (unitId, sectorId, date) => `${unitId}|${sectorId}|${String(date).slice(0, 10)}`;

export function getStandby(company, unitId, sectorId, date) {
  const list = company?.data?.standby?.[standbyKey(unitId, sectorId, date)];
  return Array.isArray(list) ? list.map(String) : [];
}

export const isOnStandby = (company, professionalId, shift) =>
  Boolean(professionalId) && getStandby(company, shift?.unit_id, shift?.sector_id, shift?.date).includes(String(professionalId));

// Dados da empresa com a lista do dia trocada; apaga as listas com mais de 60 dias.
export function withStandby(companyData, unitId, sectorId, date, ids, today = new Date().toISOString().slice(0, 10)) {
  const data = { ...(companyData || {}) };
  const limit = new Date(`${today}T12:00:00`);
  limit.setDate(limit.getDate() - KEEP_DAYS);
  const cutoff = limit.toISOString().slice(0, 10);
  const all = Object.fromEntries(Object.entries(data.standby || {}).filter(([key]) => (key.split('|')[2] || '') >= cutoff));
  const clean = [...new Set((ids || []).map(String).filter(Boolean))];
  const key = standbyKey(unitId, sectorId, date);
  if (clean.length) all[key] = clean;
  else delete all[key];
  data.standby = all;
  return data;
}

// Próximos sobreavisos de um profissional: [{ unitId, sectorId, date }], do mais próximo ao mais distante.
export function standbyDaysFor(company, professionalId, today = new Date().toISOString().slice(0, 10)) {
  return Object.entries(company?.data?.standby || {})
    .filter(([key, ids]) => Array.isArray(ids) && ids.map(String).includes(String(professionalId)) && (key.split('|')[2] || '') >= today)
    .map(([key]) => { const [unitId, sectorId, date] = key.split('|'); return { unitId, sectorId, date }; })
    .sort((a, b) => a.date.localeCompare(b.date));
}
