// Quadro da montagem (V0.8.2): arrastar o profissional para o dia ou para a vaga, ou escolher
// o profissional (pincel) e tocar nas vagas. No celular não há arrastar: vale o pincel.
import { useMemo, useState } from 'react';
import { Eraser, Search, Undo2, X } from 'lucide-react';
import { buildMonthWeeks, countByProfessional, fillWeekday, horarioKey, listHorarios, pickSlotForDay, shortName } from '@/lib/allocationBoard';
import { extractSpecialty, formatDateBR } from '@/lib/escalaUtils';

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAY_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const ERASER = '__borracha__';

const hourLabel = row => `${String(row.start_time || '').slice(0, 2)}–${String(row.end_time || '').slice(0, 2)}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export default function AllocationBoard({ rows, draft, setDraft, pool, professionalMap, sectorMap, getBlockReason, workloadWarningFor }) {
  const [brush, setBrush] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(null); // { text, tone: 'ok' | 'warn' | 'error' }
  const [history, setHistory] = useState([]);
  const [dragOver, setDragOver] = useState('');
  // Horário em que soltar no dia ou no dia da semana põe o profissional ('' = só soltando sobre a vaga).
  const [turn, setTurn] = useState('');
  const horarios = useMemo(() => listHorarios(rows), [rows]);
  const turnLabel = horarios.find(h => h.key === turn)?.label || '';

  const weeks = useMemo(() => buildMonthWeeks(rows), [rows]);
  const load = useMemo(() => countByProfessional(draft), [draft]);
  const manySectors = useMemo(() => new Set(rows.map(r => String(r.sector_id))).size > 1, [rows]);
  const manySpecialties = useMemo(() => new Set(rows.map(r => extractSpecialty(r))).size > 1, [rows]);
  const nameOf = id => professionalMap[String(id)]?.name || 'Profissional';
  const firstName = id => String(nameOf(id)).trim().split(/\s+/)[0];

  // Com o pincel na mão, as vagas abertas em que ele pode ficar ganham destaque.
  const eligibleOpen = useMemo(() => {
    if (!brush || brush === ERASER) return null;
    const set = new Set();
    rows.forEach(row => { if (!draft[String(row.id)] && (!turn || horarioKey(row) === turn) && !getBlockReason(row, brush, draft)) set.add(String(row.id)); });
    return set;
  }, [brush, draft, rows, getBlockReason, turn]);

  const filteredPool = useMemo(() => {
    const term = search.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!term) return pool;
    return pool.filter(p => `${p.name} ${p.specialty || ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(term));
  }, [pool, search]);

  const commit = (next, text, tone = 'ok') => {
    setHistory(prev => [...prev.slice(-29), draft]);
    setDraft(next);
    setStatus({ text, tone });
  };
  const undo = () => {
    if (history.length === 0) return;
    setDraft(history[history.length - 1]);
    setHistory(prev => prev.slice(0, -1));
    setStatus({ text: 'Desfeito.', tone: 'ok' });
  };
  const slotText = row => `${formatDateBR(row.date)} ${row.start_time}`;

  const assign = (row, profId, base = draft) => {
    const freed = { ...base, [String(row.id)]: '' };
    const reason = getBlockReason(row, profId, freed);
    if (reason) { setStatus({ text: `Não entrou: ${reason}.`, tone: 'error' }); return; }
    const next = { ...freed, [String(row.id)]: String(profId) };
    const warning = workloadWarningFor(profId, row, next);
    commit(next, `${firstName(profId)} em ${slotText(row)}.${warning ? ` Atenção: ${warning}.` : ''}`, warning ? 'warn' : 'ok');
  };

  const clearSlot = row => {
    const current = draft[String(row.id)];
    if (!current) return;
    commit({ ...draft, [String(row.id)]: '' }, `${firstName(current)} saiu de ${slotText(row)}.`);
  };

  const onSlotClick = row => {
    const current = draft[String(row.id)];
    if (brush === ERASER) { clearSlot(row); return; }
    if (!brush) {
      if (!current) setStatus({ text: 'Escolha um profissional na lista (ou arraste o nome) e toque nas vagas.', tone: 'warn' });
      return;
    }
    if (String(current) === String(brush)) { clearSlot(row); return; }
    assign(row, brush);
  };

  const dropOnDay = (day, profId) => {
    if (day.rows.some(row => String(draft[String(row.id)]) === String(profId))) {
      setStatus({ text: `${firstName(profId)} já está em ${formatDateBR(day.date)}.`, tone: 'warn' });
      return;
    }
    const dayRows = turn ? day.rows.filter(row => horarioKey(row) === turn) : day.rows;
    const openKinds = new Set(dayRows.filter(row => !draft[String(row.id)]).map(horarioKey));
    if (!turn && openKinds.size > 1) {
      setStatus({ text: `${formatDateBR(day.date)} tem horários diferentes: solte sobre a vaga do horário certo ou escolha o horário acima (manhã, tarde, noite).`, tone: 'warn' });
      return;
    }
    const pick = pickSlotForDay(dayRows, profId, draft, getBlockReason);
    if (!pick.row) { setStatus({ text: `Não entrou em ${formatDateBR(day.date)}${turnLabel ? ` (${turnLabel})` : ''}: ${pick.reason}.`, tone: 'error' }); return; }
    assign(pick.row, profId);
  };

  const onDayClick = day => {
    if (!brush || brush === ERASER || day.rows.length === 0) return;
    dropOnDay(day, brush);
  };

  const fillWholeWeekday = weekday => {
    if (!brush || brush === ERASER) {
      setStatus({ text: `Escolha um profissional e toque em "${WEEKDAY_LABELS[weekday]}" para colocá-lo em toda ${WEEKDAY_LONG[weekday]} do período.`, tone: 'warn' });
      return;
    }
    if (!turn && horarios.length > 1) {
      setStatus({ text: `Escolha o horário acima (manhã, tarde, noite) para colocar em toda ${WEEKDAY_LONG[weekday]}.`, tone: 'warn' });
      return;
    }
    const result = fillWeekday(turn ? rows.filter(row => horarioKey(row) === turn) : rows, weekday, brush, draft, getBlockReason);
    if (result.filled === 0 && result.skipped.length === 0) {
      setStatus({ text: `${firstName(brush)} já está em todas as ${WEEKDAY_LONG[weekday]}s.`, tone: 'warn' });
      return;
    }
    if (result.filled === 0) {
      setStatus({ text: `${firstName(brush)} não entrou em nenhuma ${WEEKDAY_LONG[weekday]}${result.skipped[0] ? `: ${result.skipped[0].reason}` : ''}.`, tone: 'error' });
      return;
    }
    const skippedText = result.skipped.length ? ` Ficou de fora em ${result.skipped.map(s => formatDateBR(s.date).slice(0, 5)).join(', ')} (${result.skipped[0].reason}).` : '';
    commit(result.draft, `${firstName(brush)} em ${plural(result.filled, WEEKDAY_LONG[weekday], `${WEEKDAY_LONG[weekday]}s`)}${turnLabel ? ` (${turnLabel})` : ''}.${skippedText}`, result.skipped.length ? 'warn' : 'ok');
  };

  // Arrastar: do nome na lista ({ profId }) ou de uma vaga preenchida ({ profId, fromRowId }).
  const readDrag = e => { try { return JSON.parse(e.dataTransfer.getData('text/plain') || 'null'); } catch { return null; } };
  const startDrag = (e, payload) => { e.dataTransfer.setData('text/plain', JSON.stringify(payload)); e.dataTransfer.effectAllowed = 'move'; };
  const dropOnSlot = (e, row) => {
    e.preventDefault(); e.stopPropagation(); setDragOver('');
    const data = readDrag(e);
    if (!data?.profId) return;
    if (data.fromRowId && String(data.fromRowId) === String(row.id)) return;
    const current = draft[String(row.id)];
    if (current && String(current) !== String(data.profId)) {
      setStatus({ text: `Esta vaga já é de ${firstName(current)}. Tire antes (×) ou solte em outro dia.`, tone: 'error' });
      return;
    }
    const base = data.fromRowId ? { ...draft, [String(data.fromRowId)]: '' } : draft;
    assign(row, data.profId, base);
  };
  const dropOnPool = e => {
    e.preventDefault(); setDragOver('');
    const data = readDrag(e);
    if (data?.fromRowId) clearSlot({ ...rows.find(r => String(r.id) === String(data.fromRowId)) });
  };

  const toneClass = {
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200',
    warn: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200',
    error: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200'
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto lg:overflow-visible">
      <div className="flex items-center gap-2 min-h-9">
        <p role="status" aria-live="polite" className={`flex-1 min-w-0 rounded-xl border px-3 py-1.5 text-[11px] font-medium ${status ? toneClass[status.tone] : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'}`}>
          {status?.text || 'Arraste o nome para a vaga (ou para o dia, com o horário escolhido). Ou toque no nome e depois nas vagas; tocar no dia da semana (Seg, Ter…) coloca em todos eles.'}
        </p>
        <button type="button" onClick={undo} disabled={history.length === 0} className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 px-2.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer disabled:cursor-default">
          <Undo2 className="h-3.5 w-3.5" /> Desfazer
        </button>
      </div>

      {horarios.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Horário ao soltar no dia">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Horário ao soltar no dia:</span>
          {[{ key: '', label: 'só sobre a vaga' }, ...horarios].map(h => (
            <button key={h.key || 'vaga'} type="button" onClick={() => setTurn(h.key)} aria-pressed={turn === h.key}
              className={`h-7 rounded-lg border px-2.5 text-[11px] font-semibold cursor-pointer ${turn === h.key ? 'border-sky-500 bg-sky-600 text-white' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-sky-300'}`}>
              {h.label}
            </button>
          ))}
        </div>
      )}

      <div className="lg:flex-1 lg:min-h-0 flex flex-col lg:flex-row gap-3">
        {/* Profissionais */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver('pool'); }}
          onDragLeave={() => setDragOver('')}
          onDrop={dropOnPool}
          className={`lg:w-60 shrink-0 flex flex-col gap-2 rounded-2xl border p-2 ${dragOver === 'pool' ? 'border-rose-400 bg-rose-50/60 dark:bg-rose-950/20' : 'border-slate-200 dark:border-slate-800'}`}
        >
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Buscar entre ${pool.length}`} aria-label="Buscar profissional" className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 pl-8 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </label>
          <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto lg:flex-1 lg:min-h-0 pb-1">
            <button type="button" onClick={() => setBrush(b => (b === ERASER ? '' : ERASER))} aria-pressed={brush === ERASER}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer ${brush === ERASER ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200 ring-1 ring-rose-500' : 'border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>
              <Eraser className="h-3.5 w-3.5" /> Borracha
            </button>
            {filteredPool.map(p => {
              const active = String(brush) === String(p.id);
              return (
                <button
                  type="button"
                  key={p.id}
                  draggable
                  onDragStart={e => startDrag(e, { profId: String(p.id) })}
                  onClick={() => setBrush(b => (String(b) === String(p.id) ? '' : String(p.id)))}
                  aria-pressed={active}
                  title={`${p.name}${p.specialty ? ` · ${p.specialty}` : ''}`}
                  className={`shrink-0 lg:w-full flex items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-left cursor-grab active:cursor-grabbing ${active ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/30 ring-1 ring-sky-500' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-300'}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">{shortName(p.name)}</span>
                    {manySpecialties && p.specialty && <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">{p.specialty}</span>}
                  </span>
                  <span className={`shrink-0 rounded-full px-1.5 text-[10px] font-bold tabular-nums ${load[String(p.id)] ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-400'}`}>{load[String(p.id)] || 0}</span>
                </button>
              );
            })}
            {filteredPool.length === 0 && <p className="px-1 text-[11px] text-slate-500">Ninguém com esse nome para estas vagas.</p>}
          </div>
        </div>

        {/* Calendário */}
        <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="sticky top-0 z-10 hidden sm:grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
            {WEEKDAY_LABELS.map((label, i) => (
              <button type="button" key={label} onClick={() => fillWholeWeekday(i)} title={`Colocar o profissional escolhido em toda ${WEEKDAY_LONG[i]}`}
                className={`py-1.5 text-[11px] font-semibold cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-950/30 ${i === 0 || i === 6 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`}>
                {label}
              </button>
            ))}
          </div>
          {weeks.map(week => (
            <div key={week[0].date} className="grid grid-cols-1 sm:grid-cols-7 border-b border-slate-200 dark:border-slate-800 last:border-b-0">
              {week.map(day => {
                const hasRows = day.rows.length > 0;
                if (!hasRows && !day.inRange) return <div key={day.date} className="hidden sm:block bg-slate-50/60 dark:bg-slate-900/30 sm:border-r last:border-r-0 border-slate-200 dark:border-slate-800" />;
                const open = day.rows.filter(r => !draft[String(r.id)]).length;
                return (
                  <div
                    key={day.date}
                    onDragOver={e => { if (hasRows) { e.preventDefault(); setDragOver(day.date); } }}
                    onDragLeave={() => setDragOver(d => (d === day.date ? '' : d))}
                    onDrop={e => { e.preventDefault(); setDragOver(''); const data = readDrag(e); if (data?.profId && !data.fromRowId) dropOnDay(day, data.profId); }}
                    onClick={() => onDayClick(day)}
                    className={`min-w-0 p-1.5 sm:border-r last:border-r-0 border-slate-200 dark:border-slate-800 ${dragOver === day.date ? 'bg-sky-50 dark:bg-sky-950/30' : ''} ${hasRows ? '' : 'hidden sm:block'}`}
                  >
                    <div className="mb-1 flex items-center justify-between px-0.5 text-[11px]">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        <span className="sm:hidden">{WEEKDAY_LABELS[new Date(`${day.date}T12:00:00`).getDay()]} </span>{day.date.slice(8, 10)}/{day.date.slice(5, 7)}
                      </span>
                      {hasRows && <span className={open ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}>{open ? `${open} aberta${open > 1 ? 's' : ''}` : 'completo'}</span>}
                    </div>
                    <div className="space-y-1">
                      {day.rows.map(row => {
                        const id = draft[String(row.id)];
                        const mine = brush && String(id) === String(brush);
                        const canTake = eligibleOpen?.has(String(row.id));
                        const dim = eligibleOpen && !id && !canTake;
                        const label = `${formatDateBR(row.date)} ${row.start_time}–${row.end_time}${manySpecialties ? ` · ${extractSpecialty(row)}` : ''}${manySectors ? ` · ${sectorMap[String(row.sector_id)]?.name || ''}` : ''}`;
                        return (
                          <div
                            key={row.id}
                            role="button"
                            tabIndex={0}
                            draggable={Boolean(id)}
                            onDragStart={e => { e.stopPropagation(); startDrag(e, { profId: String(id), fromRowId: String(row.id) }); }}
                            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOver(String(row.id)); }}
                            onDrop={e => dropOnSlot(e, row)}
                            onClick={e => { e.stopPropagation(); onSlotClick(row); }}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSlotClick(row); } }}
                            title={id ? `${label} · ${nameOf(id)}` : `${label} · vaga aberta`}
                            className={`group flex items-center gap-1 rounded-lg border px-1.5 py-1 text-[11px] leading-tight cursor-pointer select-none
                              ${dragOver === String(row.id) ? 'ring-2 ring-sky-500' : ''}
                              ${id
                                ? (mine ? 'border-sky-400 bg-sky-100 dark:bg-sky-900/40 text-sky-900 dark:text-sky-100' : 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-slate-800 dark:text-slate-100')
                                : canTake ? 'border-dashed border-sky-400 bg-sky-50/60 dark:bg-sky-950/20 text-sky-700 dark:text-sky-300'
                                : `border-dashed border-slate-300 dark:border-slate-700 text-slate-400 ${dim ? 'opacity-40' : ''}`}`}
                          >
                            <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{hourLabel(row)}</span>
                            <span className="min-w-0 flex-1 truncate font-semibold">{id ? shortName(nameOf(id)) : 'vaga'}</span>
                            {id && (
                              <button type="button" aria-label={`Tirar ${nameOf(id)} desta vaga`} onClick={e => { e.stopPropagation(); clearSlot(row); }}
                                className="shrink-0 rounded p-0.5 text-slate-400 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100">
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
