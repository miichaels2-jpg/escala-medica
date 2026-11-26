// Escalas publicadas e status "PAGO" do Faturamento: ficam no Supabase (tabelas
// published_schedules e payment_statuses), iguais em qualquer computador ou celular.

export function publishedKey(unitId, sectorId, year, month) {
  return `${unitId}|${sectorId}|${Number(year)}|${Number(month)}`;
}

export function paymentKey(unitId, professionalId, month) {
  return `${unitId}|${professionalId}|${month}`;
}

export function sanitizeRanges(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(range => range && /^\d{4}-\d{2}-\d{2}$/.test(String(range.start_date)) && /^\d{4}-\d{2}-\d{2}$/.test(String(range.end_date)))
    .map(range => ({
      start_date: String(range.start_date),
      end_date: String(range.end_date),
      ...(range.published_at ? { published_at: String(range.published_at) } : {})
    }));
}

// O dia do plantão está dentro de um período publicado do setor? Vaga de rascunho não vai para
// o Mural nem gera aviso (V0.8.7; o banco confere de novo ao assumir).
export function isShiftPublished(shift, getPublishedRanges, fallbackUnitId) {
  const date = String(shift?.date || '').slice(0, 10);
  const [year, month] = date.split('-').map(Number);
  if (!year || !month || typeof getPublishedRanges !== 'function') return false;
  return (getPublishedRanges(shift.unit_id || fallbackUnitId, shift.sector_id, year, month) || [])
    .some(range => date >= range.start_date && date <= range.end_date);
}
