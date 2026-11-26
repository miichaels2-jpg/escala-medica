// Indicadores da escala (tela Indicadores): retrato do período, distribuição da equipe,
// trocas e repasses, segurança do plantão (regras de Configurações), rankings e pendências.
// Só lê o que o sistema já registra: plantões (com as marcas do Mural) e trocas diretas.
import { getShiftDateTimeRange, getShiftName, isShiftVacant } from './shiftLiveStatus.js';
import { isProfessionalAuthorizedForSector } from './sectorAccess.js';
import { DEFAULT_WORKLOAD_RULES } from './workload.js';

export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const TURNS = [
  { id: 'manha', label: 'Manhã' },
  { id: 'tarde', label: 'Tarde' },
  { id: 'noite', label: 'Noite' }
];

const norm = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const tag = (notes, name) => String(notes || '').match(new RegExp(`\\[${name}:\\s*([^\\]]+)\\]`, 'i'))?.[1]?.trim() || '';
const dateOf = shift => String(shift?.date || '').slice(0, 10);
const round1 = n => Math.round((Number(n) || 0) * 10) / 10;
const pad = n => String(n).padStart(2, '0');

export function weekdayOf(date) {
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

// Manhã começa entre 5h e 11h59; tarde entre 12h e 17h59; o resto é noite.
export function shiftTurn(shift) {
  const start = String(shift?.start_time || '07:00').padStart(5, '0');
  if (start >= '05:00' && start < '12:00') return 'manha';
  if (start >= '12:00' && start < '18:00') return 'tarde';
  return 'noite';
}

export function shiftSpecialty(shift) {
  return shift?.target_specialty || tag(shift?.notes, 'ESP') || '';
}

function hoursOf(shift) {
  const range = getShiftDateTimeRange(shift);
  return range ? (range.end - range.start) / 3600000 : 0;
}

function median(values) {
  const list = values.filter(v => v > 0).sort((a, b) => a - b);
  if (!list.length) return 0;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
}

// Trocas, repasses e vagas assumidas no período (pela data do plantão).
export function collectMovements({ shifts = [], swaps = [], start, end, nameOf = id => id, sectorName = () => '' }) {
  const inPeriod = date => date >= start && date <= end;
  const items = [];
  shifts.forEach(shift => {
    const date = dateOf(shift);
    if (!inPeriod(date) || norm(shift.status).includes('cancel')) return;
    const notes = String(shift.notes || '');
    const base = { date, weekday: weekdayOf(date), time: [shift.start_time, shift.end_time].filter(Boolean).join('–'), sector: sectorName(shift), shiftId: shift.id };
    const transfer = tag(notes, 'TRANSFERENCIA');
    const direct = tag(notes, 'ASSUNCAO_DIRETA');
    if (transfer) {
      const [from, to] = transfer.split('->').map(s => s.trim());
      items.push({ ...base, kind: 'repasse', status: 'feita', from, to });
    } else if (direct) {
      items.push({ ...base, kind: 'vaga', status: 'feita', from: '', to: direct });
    }
    if (notes.includes('[AGUARDANDO_GESTOR]') || shift.status === 'aguardando_aprovacao_gestor') {
      items.push({ ...base, kind: 'repasse', status: 'aberta', from: tag(notes, 'SOLICITADO_POR') || getShiftName(shift), to: '', waiting: 'coordenação' });
    } else if (notes.includes('[DISPONIVEL_MURAL]') && isShiftVacant(shift)) {
      items.push({ ...base, kind: 'repasse', status: 'aberta', from: tag(notes, 'ORIGEM_MURAL'), to: '', waiting: 'alguém assumir' });
    }
  });
  swaps.forEach(swap => {
    if (swap?.swap_type !== 'troca_direta') return;
    const date = String(swap.shift_date || '').slice(0, 10);
    if (!date || !inPeriod(date)) return;
    const open = ['aguardando_colega', 'aguardando_gestor'].includes(swap.status);
    if (swap.status !== 'aprovada' && !open) return;
    items.push({
      date,
      weekday: weekdayOf(date),
      time: swap.shift_time || '',
      sector: swap.sector_name || '',
      kind: 'troca',
      status: open ? 'aberta' : 'feita',
      from: swap.requester_name || nameOf(swap.requester_professional_id),
      to: swap.target_name || nameOf(swap.target_professional_id),
      waiting: swap.status === 'aguardando_colega' ? 'colega' : swap.status === 'aguardando_gestor' ? 'coordenação' : ''
    });
  });
  return items.sort((a, b) => a.date.localeCompare(b.date) || String(a.time).localeCompare(String(b.time)));
}

// Plantões emendados acima do limite e semanas acima do máximo (mesmas regras do aviso da Escala).
export function findSafetyCases({ shifts = [], start, end, rules = DEFAULT_WORKLOAD_RULES, nameOf = id => id }) {
  const byProf = new Map();
  shifts.forEach(shift => {
    if (!shift?.professional_id || isShiftVacant(shift) || norm(shift.status).includes('cancel')) return;
    const range = getShiftDateTimeRange(shift);
    if (!range) return;
    const list = byProf.get(String(shift.professional_id)) || [];
    list.push(range);
    byProf.set(String(shift.professional_id), list);
  });
  const toKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const cases = [];
  byProf.forEach((ranges, profId) => {
    ranges.sort((a, b) => a.start - b.start);
    // Blocos: plantões que encostam um no outro, sem intervalo.
    let block = null;
    const blocks = [];
    ranges.forEach(r => {
      if (block && r.start <= block.end) block.end = new Date(Math.max(block.end, r.end));
      else { block = { start: r.start, end: r.end }; blocks.push(block); }
    });
    blocks.forEach(b => {
      const hours = (b.end - b.start) / 3600000;
      const date = toKey(b.start);
      if (hours > rules.max_continuous_hours && date >= start && date <= end) {
        cases.push({ kind: 'emendado', professionalId: profId, name: nameOf(profId), date, hours: Math.round(hours), limit: rules.max_continuous_hours });
      }
    });
    // Semanas de segunda a domingo.
    const weeks = new Map();
    ranges.forEach(r => {
      let cursor = new Date(r.start);
      while (cursor < r.end) {
        const monday = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - ((cursor.getDay() + 6) % 7));
        const next = new Date(monday); next.setDate(monday.getDate() + 7);
        const until = new Date(Math.min(r.end, next));
        const key = toKey(monday);
        weeks.set(key, (weeks.get(key) || 0) + (until - cursor) / 3600000);
        cursor = until;
      }
    });
    weeks.forEach((hours, monday) => {
      const sunday = new Date(`${monday}T12:00:00`); sunday.setDate(sunday.getDate() + 6);
      if (hours > rules.max_weekly_hours && toKey(sunday) >= start && monday <= end) {
        cases.push({ kind: 'semana', professionalId: profId, name: nameOf(profId), date: monday, hours: Math.round(hours), limit: rules.max_weekly_hours });
      }
    });
  });
  return cases.sort((a, b) => b.hours - a.hours || a.date.localeCompare(b.date));
}

const top = (counts, n = 5) => [...counts.entries()]
  .filter(([name]) => name)
  .map(([name, count]) => ({ name, count }))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'))
  .slice(0, n);

/**
 * @param {object} o
 * @param {Array} o.shifts plantões da unidade (todas as datas; o período filtra)
 * @param {Array} o.professionals profissionais da unidade
 * @param {Array} [o.swaps] trocas diretas da unidade
 * @param {string} o.start "AAAA-MM-DD"
 * @param {string} o.end "AAAA-MM-DD"
 * @param {string} [o.sectorId] setor ('' = todos)
 * @param {string} [o.specialty] especialidade ('' = todas)
 * @param {Function} [o.isPublished] plantão → já publicado?
 * @param {object} [o.rules] regras de carga (getWorkloadRules)
 * @param {Function} [o.sectorName] plantão → nome do setor
 */
export function computeIndicators({ shifts = [], professionals = [], swaps = [], start, end, sectorId = '', specialty = '', isPublished = () => true, rules = DEFAULT_WORKLOAD_RULES, sectorName = () => '' }) {
  const profById = new Map(professionals.filter(p => p?.id).map(p => [String(p.id), p]));
  const nameOf = id => profById.get(String(id))?.name || '';
  const matchesShift = s => (!sectorId || String(s.sector_id) === String(sectorId)) && (!specialty || norm(shiftSpecialty(s)) === norm(specialty));
  const scoped = shifts.filter(s => s && !norm(s.status).includes('cancel') && matchesShift(s));
  const period = scoped.filter(s => { const d = dateOf(s); return d >= start && d <= end; });
  const filled = period.filter(s => !isShiftVacant(s));

  // Retrato
  const turns = { manha: 0, tarde: 0, noite: 0 };
  period.forEach(s => { turns[shiftTurn(s)] += 1; });
  const published = period.filter(s => isPublished(s)).length;
  const eligible = professionals.filter(p => p?.id && String(p.status || 'ativo') === 'ativo' &&
    (!specialty || norm(p.specialty) === norm(specialty)) &&
    (!sectorId || isProfessionalAuthorizedForSector(p, sectorId)));
  const portrait = {
    professionals: eligible.length,
    total: period.length,
    published,
    draft: period.length - published,
    vacant: period.length - filled.length,
    filled: filled.length,
    sectors: new Set(period.map(s => String(s.sector_id))).size,
    turns
  };

  // Distribuição de horas (inclui quem não tem plantão no período)
  const hoursByProf = new Map(eligible.map(p => [String(p.id), { hours: 0, shifts: 0 }]));
  filled.forEach(s => {
    const id = String(s.professional_id);
    if (!hoursByProf.has(id)) return;
    const row = hoursByProf.get(id);
    row.hours += hoursOf(s);
    row.shifts += 1;
  });
  const people = eligible.map(p => ({ id: String(p.id), name: p.name || 'Profissional', specialty: p.specialty || '', hours: round1(hoursByProf.get(String(p.id)).hours), shifts: hoursByProf.get(String(p.id)).shifts }));
  const reference = round1(median(people.map(p => p.hours)));
  const distribution = {
    reference,
    people: [...people].sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name, 'pt-BR')),
    above: reference ? people.filter(p => p.hours > reference * 1.25).length : 0,
    below: reference ? people.filter(p => p.hours < reference * 0.5).length : 0,
    withoutShifts: people.filter(p => p.shifts === 0).length
  };

  // Trocas e repasses
  const movements = collectMovements({ shifts: scoped, swaps: sectorId || specialty ? [] : swaps, start, end, nameOf, sectorName });
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  const byDate = new Map();
  movements.forEach(m => {
    byWeekday[m.weekday] += 1;
    byDate.set(m.date, (byDate.get(m.date) || 0) + 1);
  });
  const done = movements.filter(m => m.status === 'feita');
  const took = new Map(); const released = new Map(); const swapped = new Map();
  done.forEach(m => {
    if (m.kind === 'troca') { [m.from, m.to].forEach(n => swapped.set(n, (swapped.get(n) || 0) + 1)); return; }
    took.set(m.to, (took.get(m.to) || 0) + 1);
    if (m.kind === 'repasse') released.set(m.from, (released.get(m.from) || 0) + 1);
  });
  movements.filter(m => m.kind === 'repasse' && m.status === 'aberta').forEach(m => released.set(m.from, (released.get(m.from) || 0) + 1));

  const safety = findSafetyCases({ shifts: scoped, start, end, rules, nameOf });

  return {
    start,
    end,
    portrait,
    distribution,
    movements: {
      list: movements,
      total: movements.length,
      done: done.length,
      open: movements.length - done.length,
      byWeekday,
      byDate,
      byKind: { troca: movements.filter(m => m.kind === 'troca').length, repasse: movements.filter(m => m.kind === 'repasse').length, vaga: movements.filter(m => m.kind === 'vaga').length }
    },
    rankings: { took: top(took), released: top(released), swapped: top(swapped) },
    pending: movements.filter(m => m.status === 'aberta'),
    safety: {
      cases: safety,
      continuous: safety.filter(c => c.kind === 'emendado').length,
      weekly: safety.filter(c => c.kind === 'semana').length,
      people: new Set(safety.map(c => c.professionalId)).size,
      rules
    }
  };
}

// Uma frase do que fazer em cada bloco (vazio quando não há o que sugerir).
export function buildSuggestions(ind) {
  const p = ind.portrait;
  const s = {};
  if (p.draft > 0) s.portrait = `${p.draft === 1 ? '1 plantão ainda está' : `${p.draft} plantões ainda estão`} em rascunho: publique para a equipe ver.`;
  else if (p.vacant > 0) s.portrait = `${p.vacant === 1 ? '1 vaga continua aberta' : `${p.vacant} vagas continuam abertas`}: ofereça no Mural ou escale pela Grade.`;
  const d = ind.distribution;
  if (d.below > 0 && p.vacant > 0) s.distribution = `${d.below === 1 ? '1 pessoa está' : `${d.below} pessoas estão`} com menos da metade das horas do grupo e há ${p.vacant === 1 ? '1 vaga aberta' : `${p.vacant} vagas abertas`}: ofereça a elas primeiro.`;
  else if (d.above > 0) s.distribution = `${d.above === 1 ? '1 pessoa está' : `${d.above} pessoas estão`} bem acima das horas do grupo: vale dividir melhor nos próximos meses.`;
  if (ind.pending.length > 0) s.movements = `${ind.pending.length === 1 ? '1 pedido está' : `${ind.pending.length} pedidos estão`} esperando resposta: veja as pendências.`;
  if (ind.safety.cases.length > 0) s.safety = `${ind.safety.people === 1 ? '1 pessoa passa' : `${ind.safety.people} pessoas passam`} dos limites de Configurações: revise antes do plantão.`;
  return s;
}
