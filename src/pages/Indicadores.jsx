// Indicadores da escala (gestão): retrato do período, distribuição da equipe, trocas e
// repasses, segurança do plantão, rankings e pendências. Cada bloco abre a lista completa,
// com Excel e impressão, e traz uma frase do que fazer.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, ArrowUpRight, ArrowLeftRight, CalendarRange, Download, HandHeart, Lightbulb, ListChecks, Printer, Repeat, ShieldAlert, Users, X } from 'lucide-react';
import { useAppData } from '@/lib/useAppData';
import PageHero from '@/components/PageHero';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TURNS, WEEKDAY_SHORT, buildSuggestions, computeIndicators, shiftSpecialty, shiftTurn } from '@/lib/indicators';
import { monthRange, percentChange, previousRange } from '@/lib/monthSummary';
import { getWorkloadRules } from '@/lib/workload';
import { getShiftName, isShiftVacant } from '@/lib/shiftLiveStatus';
import { escapeHtml } from '@/lib/printBranding';
import { buildPrintDocument, openPrintWindow, printHeader, printLogos } from '@/lib/printLayout';
import { formatDateBR, getLocalDateString } from '@/lib/format';

const num = value => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value || 0);
const KIND_LABEL = { troca: 'Troca direta', repasse: 'Repasse pelo Mural', vaga: 'Vaga assumida' };
const TURN_COLOR = { manha: 'bg-amber-500 dark:bg-amber-400', tarde: 'bg-sky-600 dark:bg-sky-500', noite: 'bg-indigo-800 dark:bg-indigo-400' };
const CARD = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5';

function Delta({ current, previous, goodWhenUp = null, unit = '%' }) {
  const change = unit === '%' ? percentChange(current, previous) : current - previous;
  if (change === null || !previous) return <span className="text-xs text-slate-500 dark:text-slate-400">sem período anterior</span>;
  if (change === 0) return <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><ArrowRight className="w-3 h-3" /> igual ao anterior</span>;
  const up = change > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const tone = goodWhenUp === null ? 'text-slate-600 dark:text-slate-300' : up === goodWhenUp ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400';
  return <span className={`inline-flex items-center gap-1 text-xs font-medium ${tone}`}><Icon className="w-3 h-3" aria-hidden="true" />{up ? '+' : '−'}{num(Math.abs(change))}{unit} sobre o anterior</span>;
}

function Block({ title, icon: Icon, tip, onList, listLabel = 'Ver lista', className = '', children }) {
  return (
    <section className={`${CARD} flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
          {Icon && <Icon className="w-4 h-4 text-slate-400" aria-hidden="true" />}{title}
        </h2>
        {onList && <button type="button" onClick={onList} className="shrink-0 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:underline cursor-pointer">{listLabel}</button>}
      </div>
      <div className="mt-4 flex-1">{children}</div>
      {tip && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-sky-50 dark:bg-sky-500/10 px-3 py-2 text-xs text-sky-900 dark:text-sky-200">
          <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />{tip}
        </p>
      )}
    </section>
  );
}

function Stat({ label, value, children, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`min-w-0 text-left ${onClick ? 'cursor-pointer rounded-lg -m-1 p-1 hover:bg-slate-50 dark:hover:bg-slate-800/60' : ''}`}>
      <span className="block text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className="mt-0.5 block text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{value}</span>
      {children && <span className="mt-0.5 block">{children}</span>}
    </Tag>
  );
}

// Barras com a mesma escala; a linha vertical marca a mediana do grupo.
function HoursBars({ people, max, reference }) {
  if (!people.length) return <p className="text-sm text-slate-500 dark:text-slate-400">Ninguém neste filtro.</p>;
  return (
    <ul className="space-y-2.5">
      {people.map(p => (
        <li key={p.id} className="grid grid-cols-[minmax(0,9rem)_1fr_3.5rem] items-center gap-3 text-sm">
          <span className="truncate text-slate-700 dark:text-slate-200" title={p.name}>{p.name}</span>
          <span className="relative h-3 rounded-full bg-slate-100 dark:bg-slate-800" title={`${p.name}: ${num(p.hours)} h em ${p.shifts} plantão(ões)`}>
            <span className="absolute inset-y-0 left-0 rounded-full bg-sky-600 dark:bg-sky-500" style={{ width: `${max ? Math.max(p.hours ? 2 : 0, (p.hours / max) * 100) : 0}%` }} />
            {reference > 0 && <span className="absolute -top-1 -bottom-1 w-0.5 bg-slate-500 dark:bg-slate-300" style={{ left: `${Math.min(100, (reference / max) * 100)}%` }} aria-hidden="true" />}
          </span>
          <span className="text-right font-semibold tabular-nums text-slate-900 dark:text-white">{num(p.hours)} h</span>
        </li>
      ))}
    </ul>
  );
}

function VerticalBars({ items, height = 'h-32', showLabels = true }) {
  const max = Math.max(1, ...items.map(i => i.value));
  return (
    <div>
      <div className={`flex items-end gap-1 ${height}`}>
        {items.map(item => (
          <div key={item.key} className="group relative flex h-full flex-1 flex-col justify-end" title={item.title}>
            {showLabels && item.value > 0 && <span className="mb-0.5 text-center text-[10px] tabular-nums text-slate-500 dark:text-slate-400">{item.value}</span>}
            <span className={`block rounded-t ${item.weekend ? 'bg-sky-600 dark:bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'} group-hover:opacity-80`} style={{ height: `${(item.value / max) * 100}%`, minHeight: item.value ? 3 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {items.map(item => <span key={item.key} className={`flex-1 text-center text-[10px] text-slate-500 dark:text-slate-400 ${item.minor ? 'invisible sm:visible' : ''}`}>{item.label}</span>)}
      </div>
    </div>
  );
}

function Ranking({ title, rows, unit }) {
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</h3>
      {rows.length ? (
        <ol className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row, i) => (
            <li key={row.name} className="flex items-center gap-2 py-2 text-sm">
              <span className="w-4 text-xs tabular-nums text-slate-400">{i + 1}</span>
              <span className="flex-1 truncate text-slate-800 dark:text-slate-100" title={row.name}>{row.name}</span>
              <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{row.count}</span>
              <span className="sr-only">{unit}</span>
            </li>
          ))}
        </ol>
      ) : <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Nada no período.</p>}
    </div>
  );
}

export default function Indicadores() {
  const navigate = useNavigate();
  const { shifts = [], professionals = [], sectors = [], swaps = [], company, units = [], selectedUnitId, getPublishedRanges, user } = useAppData();
  const today = getLocalDateString();
  const [preset, setPreset] = useState('mes');
  const [custom, setCustom] = useState(() => monthRange(today.slice(0, 7)));
  const [sectorId, setSectorId] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [list, setList] = useState(null);

  const [start, end] = useMemo(() => {
    if (preset === 'anterior') return previousRange(...monthRange(today.slice(0, 7)));
    if (preset === 'custom' && custom[0] && custom[1] && custom[0] <= custom[1]) return custom;
    return monthRange(today.slice(0, 7));
  }, [preset, custom, today]);
  const [prevStart, prevEnd] = useMemo(() => previousRange(start, end), [start, end]);

  const unit = units.find(u => String(u.id) === String(selectedUnitId));
  const sectorById = useMemo(() => new Map(sectors.map(s => [String(s.id), s.name])), [sectors]);
  const sectorName = s => sectorById.get(String(s.sector_id)) || s.sector_name || 'Setor';
  const nameOf = s => professionals.find(p => String(p.id) === String(s.professional_id))?.name || getShiftName(s);
  // Só as especialidades que aparecem nos plantões (cargos administrativos ficam de fora).
  const specialties = useMemo(() => [...new Set(shifts.map(shiftSpecialty).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')), [shifts]);

  const options = useMemo(() => {
    const isPublished = s => {
      const [y, m] = String(s.date).slice(0, 7).split('-').map(Number);
      return getPublishedRanges(s.unit_id || selectedUnitId, s.sector_id, y, m).some(r => r.start_date <= s.date.slice(0, 10) && r.end_date >= s.date.slice(0, 10));
    };
    return { shifts, professionals, swaps, sectorId, specialty, isPublished, rules: getWorkloadRules(company), sectorName: s => sectorById.get(String(s.sector_id)) || s.sector_name || 'Setor' };
  }, [shifts, professionals, swaps, sectorId, specialty, company, getPublishedRanges, selectedUnitId, sectorById]);

  const ind = useMemo(() => computeIndicators({ ...options, start, end }), [options, start, end]);
  const prev = useMemo(() => computeIndicators({ ...options, start: prevStart, end: prevEnd }), [options, prevStart, prevEnd]);
  const tips = buildSuggestions(ind);

  const periodLabel = `${formatDateBR(start)} a ${formatDateBR(end)}`;
  const scopeLabel = [unit?.name, sectorId ? sectorById.get(String(sectorId)) : 'Todos os setores', specialty || ''].filter(Boolean).join(' · ');
  const people = ind.distribution.people;
  const maxHours = Math.max(1, ...people.map(p => p.hours), ind.distribution.reference);
  // Equipe pequena: as duas listas dividem o grupo, sem repetir ninguém.
  const topCount = Math.min(5, Math.ceil(people.length / 2));
  const mostHours = people.slice(0, topCount);
  const leastHours = people.slice(topCount).reverse().slice(0, 5);
  const periodShifts = useMemo(() => shifts
    .filter(s => s && !String(s.status || '').toLowerCase().includes('cancel'))
    .filter(s => (!sectorId || String(s.sector_id) === String(sectorId)) && (!specialty || shiftSpecialty(s).toLowerCase() === specialty.toLowerCase()))
    .filter(s => String(s.date).slice(0, 10) >= start && String(s.date).slice(0, 10) <= end)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.start_time).localeCompare(String(b.start_time))), [shifts, sectorId, specialty, start, end]);

  // Dias do período (até 62) para o gráfico por dia.
  const days = useMemo(() => {
    const out = [];
    const cursor = new Date(`${start}T12:00:00`);
    const last = new Date(`${end}T12:00:00`);
    while (cursor <= last && out.length < 62) {
      const key = getLocalDateString(cursor);
      const wd = cursor.getDay();
      out.push({ key, label: String(cursor.getDate()), minor: cursor.getDate() !== 1 && cursor.getDate() % 5 !== 0, value: ind.movements.byDate.get(key) || 0, weekend: wd === 0 || wd === 6, title: `${formatDateBR(key)} (${WEEKDAY_SHORT[wd]}): ${ind.movements.byDate.get(key) || 0} movimentação(ões)` });
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }, [start, end, ind]);

  const movementColumns = [
    { header: 'Data', key: 'date', type: 'date' },
    { header: 'Dia', key: 'weekday' },
    { header: 'Horário', key: 'time' },
    { header: 'Tipo', key: 'kind' },
    { header: 'De', key: 'from' },
    { header: 'Para', key: 'to' },
    { header: 'Setor', key: 'sector' },
    { header: 'Situação', key: 'status' }
  ];
  const movementRows = items => items.map(m => ({
    date: m.date, weekday: WEEKDAY_SHORT[m.weekday], time: m.time || '—', kind: KIND_LABEL[m.kind], from: m.from || '—', to: m.to || '—', sector: m.sector || '—',
    status: m.status === 'feita' ? 'Feita' : `Em aberto${m.waiting ? ` (esperando ${m.waiting})` : ''}`
  }));

  const openList = {
    shifts: () => setList({
      title: 'Plantões do período',
      columns: [{ header: 'Data', key: 'date', type: 'date' }, { header: 'Horário', key: 'time' }, { header: 'Turno', key: 'turn' }, { header: 'Setor', key: 'sector' }, { header: 'Profissional', key: 'prof' }, { header: 'Publicação', key: 'pub' }],
      rows: periodShifts.map(s => ({ date: String(s.date).slice(0, 10), time: `${s.start_time}–${s.end_time}`, turn: TURNS.find(t => t.id === shiftTurn(s)).label, sector: sectorName(s), prof: isShiftVacant(s) ? 'Vaga aberta' : nameOf(s), pub: options.isPublished(s) ? 'Publicado' : 'Rascunho' }))
    }),
    vacant: () => setList({
      title: 'Vagas abertas no período',
      columns: [{ header: 'Data', key: 'date', type: 'date' }, { header: 'Horário', key: 'time' }, { header: 'Setor', key: 'sector' }, { header: 'Especialidade', key: 'spec' }],
      rows: periodShifts.filter(isShiftVacant).map(s => ({ date: String(s.date).slice(0, 10), time: `${s.start_time}–${s.end_time}`, sector: sectorName(s), spec: shiftSpecialty(s) || '—' }))
    }),
    people: () => setList({
      title: 'Horas por profissional',
      subtitle: `Mediana do grupo: ${num(ind.distribution.reference)} h`,
      columns: [{ header: 'Profissional', key: 'name' }, { header: 'Especialidade', key: 'specialty' }, { header: 'Plantões', key: 'shifts', type: 'int' }, { header: 'Horas', key: 'hours', type: 'hours' }, { header: 'Em relação ao grupo', key: 'vs' }],
      rows: people.map(p => ({ name: p.name, specialty: p.specialty || '—', shifts: p.shifts, hours: p.hours, vs: !ind.distribution.reference ? '—' : p.hours > ind.distribution.reference * 1.25 ? 'Bem acima' : p.hours < ind.distribution.reference * 0.5 ? 'Bem abaixo' : 'Na média' }))
    }),
    movements: (items = ind.movements.list, title = 'Trocas, repasses e vagas assumidas') => setList({ title, columns: movementColumns, rows: movementRows(items) }),
    safety: () => setList({
      title: 'Segurança do plantão',
      subtitle: `Limites de Configurações: ${ind.safety.rules.max_continuous_hours} h emendadas e ${ind.safety.rules.max_weekly_hours} h na semana`,
      columns: [{ header: 'Profissional', key: 'name' }, { header: 'O que aconteceu', key: 'what' }, { header: 'Quando', key: 'when' }, { header: 'Horas', key: 'hours', type: 'int' }],
      rows: ind.safety.cases.map(c => ({ name: c.name || 'Profissional', what: c.kind === 'emendado' ? `Plantões emendados acima de ${c.limit} h` : `Semana acima de ${c.limit} h`, when: c.kind === 'emendado' ? formatDateBR(c.date) : `Semana de ${formatDateBR(c.date)}`, hours: c.hours }))
    })
  };

  const turnsTotal = Math.max(1, ind.portrait.total);

  return (
    <div className="p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6 font-sans bg-slate-100 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      <PageHero title="Indicadores" subtitle="Como a escala está distribuída no período: equipe, trocas, segurança e pendências." />

      <section className={`${CARD} flex flex-wrap items-end gap-3`} aria-label="Filtros">
        <label className="text-xs text-slate-500 dark:text-slate-400">
          Período
          <select value={preset} onChange={e => setPreset(e.target.value)} className="mt-1 block h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-white">
            <option value="mes">Este mês</option>
            <option value="anterior">Mês passado</option>
            <option value="custom">Escolher datas</option>
          </select>
        </label>
        {preset === 'custom' && (
          <>
            <label className="text-xs text-slate-500 dark:text-slate-400">De
              <input type="date" value={custom[0]} onChange={e => setCustom([e.target.value, custom[1]])} className="mt-1 block h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-white" />
            </label>
            <label className="text-xs text-slate-500 dark:text-slate-400">Até
              <input type="date" value={custom[1]} onChange={e => setCustom([custom[0], e.target.value])} className="mt-1 block h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-white" />
            </label>
          </>
        )}
        <label className="text-xs text-slate-500 dark:text-slate-400">
          Setor
          <select value={sectorId} onChange={e => setSectorId(e.target.value)} className="mt-1 block h-10 max-w-[16rem] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-white">
            <option value="">Todos os setores</option>
            {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500 dark:text-slate-400">
          Especialidade
          <select value={specialty} onChange={e => setSpecialty(e.target.value)} className="mt-1 block h-10 max-w-[16rem] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-white">
            <option value="">Todas</option>
            {specialties.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <p className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><CalendarRange className="w-3.5 h-3.5" /> {periodLabel} · comparado com {formatDateBR(prevStart)} a {formatDateBR(prevEnd)}</p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Block title="Retrato da escala" icon={ListChecks} tip={tips.portrait} onList={openList.shifts}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Stat label="Profissionais ativos" value={num(ind.portrait.professionals)} />
            <Stat label="Plantões no período" value={num(ind.portrait.total)} onClick={openList.shifts}><Delta current={ind.portrait.total} previous={prev.portrait.total} /></Stat>
            <Stat label="Publicados" value={`${num(ind.portrait.published)} de ${num(ind.portrait.total)}`}>{ind.portrait.draft > 0 && <span className="text-xs text-amber-700 dark:text-amber-400">{ind.portrait.draft} em rascunho</span>}</Stat>
            <Stat label="Vagas abertas" value={num(ind.portrait.vacant)} onClick={openList.vacant}><Delta current={ind.portrait.vacant} previous={prev.portrait.vacant} goodWhenUp={false} unit="" /></Stat>
          </div>
          <div className="mt-5">
            <span className="text-xs text-slate-500 dark:text-slate-400">Plantões por turno</span>
            <div className="mt-1.5 flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="img" aria-label={TURNS.map(t => `${t.label}: ${ind.portrait.turns[t.id]}`).join(', ')}>
              {TURNS.map(t => ind.portrait.turns[t.id] > 0 && <span key={t.id} className={`${TURN_COLOR[t.id]} border-r-2 border-white dark:border-slate-900 last:border-r-0`} style={{ width: `${(ind.portrait.turns[t.id] / turnsTotal) * 100}%` }} title={`${t.label}: ${ind.portrait.turns[t.id]}`} />)}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
              {TURNS.map(t => <span key={t.id} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${TURN_COLOR[t.id]}`} />{t.label} <b className="tabular-nums">{ind.portrait.turns[t.id]}</b></span>)}
            </div>
          </div>
        </Block>

        <Block title="Trocas e repasses" icon={ArrowLeftRight} tip={tips.movements} onList={() => openList.movements()}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Stat label="Feitas" value={num(ind.movements.done)}><Delta current={ind.movements.done} previous={prev.movements.done} /></Stat>
            <Stat label="Em aberto" value={num(ind.movements.open)} onClick={ind.pending.length ? () => openList.movements(ind.pending, 'Pendências') : undefined} />
          </div>
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
            {ind.movements.byKind.troca} troca(s) direta(s) · {ind.movements.byKind.repasse} repasse(s) pelo Mural · {ind.movements.byKind.vaga} vaga(s) assumida(s)
          </p>
          <div className="mt-4">
            <span className="text-xs text-slate-500 dark:text-slate-400">Por dia da semana do plantão</span>
            <div className="mt-2">
              <VerticalBars height="h-24" items={WEEKDAY_SHORT.map((label, i) => ({ key: label, label, value: ind.movements.byWeekday[i], weekend: i === 0 || i === 6, title: `${label}: ${ind.movements.byWeekday[i]}` }))} />
            </div>
            <p className="mt-2 flex gap-3 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" /> dia de semana</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-sky-600 dark:bg-sky-500" /> fim de semana</span>
            </p>
          </div>
        </Block>

        <Block title="Segurança do plantão" icon={ShieldAlert} tip={tips.safety} onList={ind.safety.cases.length ? openList.safety : undefined}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Stat label={`Emendados acima de ${ind.safety.rules.max_continuous_hours} h`} value={num(ind.safety.continuous)} />
            <Stat label={`Semanas acima de ${ind.safety.rules.max_weekly_hours} h`} value={num(ind.safety.weekly)} />
          </div>
          {ind.safety.cases.length ? (
            <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {ind.safety.cases.slice(0, 4).map(c => (
                <li key={`${c.kind}-${c.professionalId}-${c.date}`} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate text-slate-800 dark:text-slate-100">{c.name || 'Profissional'}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{c.kind === 'emendado' ? `Emendados em ${formatDateBR(c.date)}` : `Semana de ${formatDateBR(c.date)}`}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-rose-700 dark:text-rose-400">{c.hours} h</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Ninguém passou dos limites no período.</p>}
          <button type="button" onClick={() => navigate('/configuracoes')} className="mt-3 text-xs text-slate-500 dark:text-slate-400 hover:underline cursor-pointer">Limites em Configurações › Regras da escala</button>
        </Block>
      </div>

      <Block title="Distribuição da equipe" icon={Users} tip={tips.distribution} onList={openList.people} listLabel="Ver todos">
        <p className="-mt-2 mb-4 text-xs text-slate-500 dark:text-slate-400">
          Horas escaladas no período. A linha marca a mediana do grupo ({num(ind.distribution.reference)} h): serve para dividir as vagas de forma justa, não para controlar jornada.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">Mais horas</h3>
            <HoursBars people={mostHours} max={maxHours} reference={ind.distribution.reference} />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">Menos horas {ind.distribution.withoutShifts > 0 && <span className="font-normal text-slate-500 dark:text-slate-400">({ind.distribution.withoutShifts} sem plantão)</span>}</h3>
            <HoursBars people={leastHours} max={maxHours} reference={ind.distribution.reference} />
          </div>
        </div>
      </Block>

      <Block title="Movimentações por dia" icon={Repeat} onList={ind.movements.total ? () => openList.movements() : undefined}>
        {ind.movements.total ? (
          <>
            <VerticalBars height="h-36" items={days} showLabels={days.length <= 31} />
            <p className="mt-2 flex gap-3 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" /> dia de semana</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-sky-600 dark:bg-sky-500" /> fim de semana</span>
            </p>
          </>
        ) : <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma troca, repasse ou vaga assumida no período.</p>}
      </Block>

      <Block title="Quem mais movimentou" icon={HandHeart}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Ranking title="Assumiram vagas e repasses" rows={ind.rankings.took} unit="plantões assumidos" />
          <Ranking title="Repassaram plantões" rows={ind.rankings.released} unit="plantões repassados" />
          <Ranking title="Trocas diretas" rows={ind.rankings.swapped} unit="trocas" />
        </div>
      </Block>

      <Block title="Pendências" icon={ListChecks} onList={ind.pending.length ? () => openList.movements(ind.pending, 'Pendências') : undefined}>
        {ind.pending.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 dark:text-slate-400"><th className="py-2 pr-3 font-medium">Data</th><th className="py-2 pr-3 font-medium">Horário</th><th className="py-2 pr-3 font-medium">Tipo</th><th className="py-2 pr-3 font-medium">De</th><th className="py-2 pr-3 font-medium">Esperando</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ind.pending.slice(0, 8).map((m, i) => (
                  <tr key={`${m.date}-${i}`}>
                    <td className="py-2 pr-3 tabular-nums">{formatDateBR(m.date)} <span className="text-xs text-slate-500">{WEEKDAY_SHORT[m.weekday]}</span></td>
                    <td className="py-2 pr-3 tabular-nums">{m.time || '—'}</td>
                    <td className="py-2 pr-3">{KIND_LABEL[m.kind]}</td>
                    <td className="py-2 pr-3">{m.from || '—'}</td>
                    <td className="py-2 pr-3">{m.waiting}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={() => navigate('/trocas')} className="mt-3 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:underline cursor-pointer">Resolver no Mural</button>
          </div>
        ) : <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum pedido esperando resposta.</p>}
      </Block>

      <ListDialog list={list} onClose={() => setList(null)} company={company} unit={unit} scopeLabel={scopeLabel} periodLabel={periodLabel} issuedBy={user?.full_name || ''} />
    </div>
  );
}

// Lista completa de um bloco, com Excel e impressão.
function ListDialog({ list, onClose, company, unit, scopeLabel, periodLabel, issuedBy }) {
  const [busy, setBusy] = useState(false);
  if (!list) return null;
  const cell = (row, col) => (col.type === 'date' && row[col.key] ? formatDateBR(row[col.key]) : col.type === 'hours' ? `${num(row[col.key])} h` : row[col.key] ?? '—');

  const exportExcel = async () => {
    setBusy(true);
    try {
      const { addSheet, createWorkbook, downloadWorkbook, excelFileName } = await import('@/lib/excelLayout');
      const book = await createWorkbook({ company, unit });
      addSheet(book, {
        name: list.title,
        orgName: unit?.name || company?.name || '',
        title: list.title,
        subtitle: `${periodLabel} · ${scopeLabel}`,
        meta: list.subtitle ? [['Observação', list.subtitle]] : [],
        blocks: [{ type: 'table', columns: list.columns.map(c => ({ header: c.header, key: c.key, type: c.type === 'date' ? 'date' : c.type === 'hours' ? 'hours' : c.type === 'int' ? 'int' : 'text' })), rows: list.rows, empty: 'Nada no período.' }]
      });
      await downloadWorkbook(book, excelFileName(list.title, unit?.name || '', periodLabel));
    } catch (error) {
      alert(`Não foi possível gerar a planilha. ${error?.message || ''}`);
    } finally {
      setBusy(false);
    }
  };

  const print = () => {
    const body = `<section class="pl-sheet">
      ${printHeader({ logos: printLogos({ company, unit }), orgName: unit?.name || company?.name || '', title: list.title, subtitle: `${scopeLabel}${list.subtitle ? ` · ${list.subtitle}` : ''}`, meta: [['Período', periodLabel]] })}
      <table class="pl-table"><thead><tr>${list.columns.map(c => `<th${['int', 'hours'].includes(c.type) ? ' class="pl-num"' : ''}>${escapeHtml(c.header)}</th>`).join('')}</tr></thead>
      <tbody>${list.rows.map(row => `<tr>${list.columns.map(c => `<td${['int', 'hours'].includes(c.type) ? ' class="pl-num"' : ''}>${escapeHtml(cell(row, c))}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${list.columns.length}" class="pl-muted">Nada no período.</td></tr>`}</tbody></table>
    </section>`;
    const html = buildPrintDocument({ docTitle: `${list.title} · ${periodLabel}`, issuedBy, orientation: list.columns.length > 5 ? 'landscape' : 'portrait', body });
    if (!openPrintWindow(html)) alert('Permita pop-ups para imprimir.');
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col bg-white dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-slate-900 dark:text-white">{list.title}</DialogTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400">{periodLabel} · {scopeLabel}{list.subtitle ? ` · ${list.subtitle}` : ''} · {list.rows.length} linha(s)</p>
        </DialogHeader>
        <div className="flex gap-2">
          <button type="button" onClick={exportExcel} disabled={busy || !list.rows.length} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"><Download className="w-3.5 h-3.5" /> {busy ? 'Gerando…' : 'Exportar Excel'}</button>
          <button type="button" onClick={print} disabled={!list.rows.length} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"><Printer className="w-3.5 h-3.5" /> Imprimir</button>
          <button type="button" onClick={onClose} className="ml-auto inline-flex h-9 items-center gap-1 rounded-xl px-3 text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"><X className="w-3.5 h-3.5" /> Fechar</button>
        </div>
        <div className="flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
          {list.rows.length ? (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800"><tr>{list.columns.map(c => <th key={c.key} className={`px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 ${['int', 'hours'].includes(c.type) ? 'text-right' : ''}`}>{c.header}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {list.rows.map((row, i) => <tr key={i}>{list.columns.map(c => <td key={c.key} className={`px-3 py-2 text-slate-800 dark:text-slate-100 ${['int', 'hours'].includes(c.type) ? 'text-right tabular-nums' : ''}`}>{cell(row, c)}</td>)}</tr>)}
              </tbody>
            </table>
          ) : <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">Nada no período.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
