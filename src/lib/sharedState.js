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
