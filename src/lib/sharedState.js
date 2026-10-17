// Escalas publicadas e status "PAGO" do Faturamento.
// Ficam no Supabase (tabelas published_schedules e payment_statuses) para que
// todos os gestores, em qualquer computador ou celular, vejam a mesma informação.
// Versões antigas guardavam isso só no navegador (localStorage); na primeira
// abertura de cada navegador esses registros são enviados ao banco.

export const PUBLISHED_STORAGE_PREFIX = 'scale_published_ranges_';
export const PAYMENTS_STORAGE_KEY = 'scale_faturamento_pagos';

export function publishedKey(unitId, sectorId, year, month) {
  return `${unitId}|${sectorId}|${Number(year)}|${Number(month)}`;
}

export function paymentKey(unitId, professionalId, month) {
  return `${unitId}|${professionalId}|${month}`;
}

// As chaves antigas juntavam IDs com "_", e o ID legado da unidade também tem
// "_" (unit_h1). Por isso a unidade é identificada pela lista de unidades conhecidas.
function splitLeadingUnit(rest, units) {
  const candidates = units
    .flatMap(unit => [unit.id, unit.legacy_id].filter(Boolean).map(id => ({ id: String(id), unitId: String(unit.id) })))
    .sort((a, b) => b.id.length - a.id.length);
  const match = candidates.find(candidate => rest.startsWith(`${candidate.id}_`));
  return match ? { unitId: match.unitId, remainder: rest.slice(match.id.length + 1) } : null;
}

export function parseLegacyPublishedKey(storageKey, units) {
  if (!storageKey.startsWith(PUBLISHED_STORAGE_PREFIX)) return null;
  const split = splitLeadingUnit(storageKey.slice(PUBLISHED_STORAGE_PREFIX.length), units);
  if (!split) return null;
  const match = /^(.+)_(\d{4})_(\d{1,2})$/.exec(split.remainder);
  if (!match) return null;
  const month = Number(match[3]);
  if (month < 1 || month > 12) return null;
  return { unitId: split.unitId, sectorId: match[1], year: Number(match[2]), month };
}

export function parseLegacyPaymentKey(key, units) {
  const split = splitLeadingUnit(key, units);
  if (!split) return null;
  const match = /^(.+)_(\d{4}-\d{2})$/.exec(split.remainder);
  if (!match) return null;
  return { unitId: split.unitId, professionalId: match[1], month: match[2] };
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

// Formato mais antigo do "PAGO": `${profissional}_${AAAA-MM}`, sem unidade.
// Esses registros pertencem à unidade principal do profissional.
function parseUnscopedPaymentKey(key, professionals, units) {
  const match = /^(.+)_(\d{4}-\d{2})$/.exec(key);
  if (!match) return null;
  const professional = (professionals || []).find(p => String(p.id) === match[1]);
  if (!professional) return null;
  const primary = professional.unit_id || professional.data?.allowed_unit_ids?.[0] || professional.unit_ids?.[0];
  const unit = units.find(u => String(u.id) === String(primary) || (u.legacy_id && String(u.legacy_id) === String(primary)));
  return unit ? { unitId: String(unit.id), professionalId: match[1], month: match[2] } : null;
}

export function readLegacySharedState(storage, units, professionals = []) {
  const published = [];
  const payments = [];
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      const parsed = key && parseLegacyPublishedKey(key, units);
      if (!parsed) continue;
      try {
        const ranges = sanitizeRanges(JSON.parse(storage.getItem(key) || '[]'));
        if (ranges.length) published.push({ ...parsed, ranges });
      } catch {}
    }
    const rawPayments = JSON.parse(storage.getItem(PAYMENTS_STORAGE_KEY) || '{}');
    if (rawPayments && typeof rawPayments === 'object' && !Array.isArray(rawPayments)) {
      Object.entries(rawPayments).forEach(([key, paid]) => {
        if (paid !== true) return;
        const parsed = parseLegacyPaymentKey(key, units) || parseUnscopedPaymentKey(key, professionals, units);
        if (parsed) payments.push(parsed);
      });
    }
  } catch {}
  return { published, payments };
}
