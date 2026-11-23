import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Send, Pencil, UserMinus } from 'lucide-react';

// Grade da escala: uma tabela por setor. Cada linha é uma vaga de um turno (mesmo horário e
// especialidade); cada coluna é um dia do mês. O "+" abre a lista de quem pode assumir.
// Não grava nada sozinha: chama onAssign / onUnassign / onEdit / onCreate da tela Escala,
// que usam as mesmas regras de sempre (choque de horário, férias, carga, setor autorizado).

const WEEKDAY_LETTER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function turnLabel(start) {
  return start >= '18:00' || start < '06:00' ? 'Noturno' : start >= '12:00' ? 'Tarde' : 'Diurno';
}

// Agrupa os plantões de um setor em turnos e numera as vagas de cada dia.
function buildRows(sectorShifts, extractSpecialty) {
  const groups = new Map();
  sectorShifts.forEach(shift => {
    const specialty = extractSpecialty(shift) || 'Geral';
    const key = `${shift.start_time}|${shift.end_time}|${specialty}`;
    if (!groups.has(key)) groups.set(key, { key, start: shift.start_time, end: shift.end_time, specialty, byDate: new Map() });
    const g = groups.get(key);
    if (!g.byDate.has(shift.date)) g.byDate.set(shift.date, []);
    g.byDate.get(shift.date).push(shift);
  });
  const rows = [];
  [...groups.values()]
    .sort((a, b) => String(a.start).localeCompare(String(b.start)) || a.specialty.localeCompare(b.specialty, 'pt-BR'))
    .forEach(g => {
      let slots = 0;
      g.byDate.forEach(list => {
        // vagas preenchidas primeiro, depois por id: a posição de cada pessoa fica estável
        list.sort((a, b) => Number(!a.professional_id) - Number(!b.professional_id) || String(a.id).localeCompare(String(b.id)));
        slots = Math.max(slots, list.length);
      });
      for (let i = 0; i < slots; i++) rows.push({ group: g, index: i, total: slots });
    });
  return rows;
}

export default function ScheduleGrid({
  days, sectors, shifts, todayStr, isManager, helpers,
  getCandidates, onAssign, onUnassign, onEdit, onCreate, onAddTurn, emptyActions
}) {
  const { isVacant, isShiftPast, extractSpecialty, getInitials, formatFullName, professionalName } = helpers;
  const [popover, setPopover] = useState(null); // { shift | blank, rect }
  const [busy, setBusy] = useState(false);


  useEffect(() => {
    if (!popover) return undefined;
    const close = (e) => { if (e.key === 'Escape') setPopover(null); };
    const onScroll = () => setPopover(null);
    window.addEventListener('keydown', close);
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('keydown', close); window.removeEventListener('resize', onScroll); };
  }, [popover]);

  const sections = useMemo(() => sectors.map(sector => {
    const sectorShifts = shifts.filter(s => String(s.sector_id) === String(sector.id));
    return { sector, rows: buildRows(sectorShifts, extractSpecialty), count: sectorShifts.length };
  }), [sectors, shifts, extractSpecialty]);

  const visibleSections = sections.filter(s => s.count > 0 || sectors.length === 1);

  const openAt = (e, payload) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPopover({ ...payload, rect: { left: r.left, top: r.top, bottom: r.bottom, width: r.width } });
  };

  const run = async (fn) => {
    setBusy(true);
    try { const ok = await fn(); if (ok !== false) setPopover(null); } finally { setBusy(false); }
  };

  if (!visibleSections.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
        <p className="font-semibold text-slate-800 dark:text-slate-100">Nenhum plantão neste mês.</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Monte os turnos do mês ou copie a escala do mês anterior.</p>
        {emptyActions}
      </div>
    );
  }

  const cols = `minmax(132px, 160px) repeat(${days.length}, minmax(28px, 1fr))`;

  return (
    <div className="space-y-4">
      {visibleSections.map(({ sector, rows }) => (
        <section key={sector.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {sectors.length > 1 && (
            <h3 className="px-4 pt-4 text-base font-semibold text-slate-900 dark:text-white">{sector.name}</h3>
          )}
          {rows.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{sector.name} ainda não tem turnos neste mês.</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Monte os turnos do mês ou copie a escala do mês anterior.</p>
              {emptyActions}
            </div>
          ) : (
            <div className="overflow-x-auto px-3 sm:px-4 pb-4 pt-3">
              <div className="min-w-max lg:min-w-0" style={{ display: 'grid', gridTemplateColumns: cols, gap: 3 }}>
                <div className="sticky left-0 z-10 bg-white dark:bg-slate-900" />
                {days.map(d => {
                  const key = dateKey(d);
                  const weekend = d.getDay() === 0 || d.getDay() === 6;
                  const isToday = key === todayStr;
                  return (
                    <div key={key} className={`text-center text-[11px] leading-tight py-1 rounded-lg ${isToday ? 'bg-sky-100 dark:bg-sky-500/20' : ''}`}>
                      <div className={weekend ? 'text-sky-700 dark:text-sky-300' : 'text-slate-500 dark:text-slate-400'}>{WEEKDAY_LETTER[d.getDay()]}</div>
                      <div className={`font-semibold ${isToday ? 'text-sky-700 dark:text-sky-300' : 'text-slate-800 dark:text-slate-100'}`}>{d.getDate()}</div>
                    </div>
                  );
                })}

                {rows.map(({ group, index, total }, ri) => {
                  const firstOfGroup = index === 0;
                  return (
                    <div key={`${group.key}-${index}`} className="contents">
                      <div className={`sticky left-0 z-10 bg-white dark:bg-slate-900 pr-2 text-xs leading-tight flex flex-col justify-center ${firstOfGroup && ri > 0 ? 'pt-3' : ''}`}>
                        {firstOfGroup ? (
                          <>
                            <span className="font-semibold text-slate-900 dark:text-white">{turnLabel(group.start)} {group.start}–{group.end}</span>
                            <span className="text-slate-500 dark:text-slate-400 truncate" title={group.specialty}>{group.specialty}{total > 1 ? ` · vaga 1` : ''}</span>
                          </>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">vaga {index + 1}</span>
                        )}
                      </div>
                      {days.map(d => {
                        const key = dateKey(d);
                        const shift = (group.byDate.get(key) || [])[index];
                        const cellPad = firstOfGroup && ri > 0 ? 'mt-3' : '';
                        if (!shift) {
                          return isManager ? (
                            <button key={key} type="button" title={`Criar plantão ${group.start}–${group.end} em ${d.getDate()}`}
                              onClick={(e) => openAt(e, { blank: { date: key, sector_id: sector.id, start_time: group.start, end_time: group.end, specialty: group.specialty } })}
                              className={`${cellPad} h-9 rounded-lg flex items-center justify-center text-slate-300 dark:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-500 cursor-pointer`} aria-label={`Sem plantão em ${d.getDate()}`}>·</button>
                          ) : <div key={key} className={`${cellPad} h-9 flex items-center justify-center text-slate-300 dark:text-slate-700`}>·</div>;
                        }
                        const vacant = isVacant(shift);
                        const past = isShiftPast(shift);
                        const name = professionalName(shift);
                        const active = popover?.shift && String(popover.shift.id) === String(shift.id);
                        if (vacant) {
                          return (
                            <button key={key} type="button" disabled={!isManager}
                              onClick={(e) => isManager && openAt(e, { shift })}
                              title={past ? 'Furo: plantão passou sem profissional' : 'Vaga em aberto: clique para escalar'}
                              className={`${cellPad} h-9 rounded-lg flex items-center justify-center text-base cursor-pointer disabled:cursor-default ${active ? 'border-2 border-sky-600 bg-sky-50 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200' : past ? 'border border-dashed border-rose-400 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300' : 'border border-dashed border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}`}>
                              {past ? '!' : <Plus className="w-4 h-4" />}
                            </button>
                          );
                        }
                        return (
                          <button key={key} type="button" title={`${formatFullName(name)} · ${shift.start_time}–${shift.end_time}`}
                            onClick={(e) => (isManager ? openAt(e, { shift }) : null)}
                            className={`${cellPad} h-9 rounded-lg text-[11px] font-semibold flex items-center justify-center ${active ? 'ring-2 ring-sky-600' : ''} ${past ? 'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400' : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'} ${isManager ? 'hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer' : 'cursor-default'}`}>
                            {getInitials(name)}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-slate-100 dark:bg-slate-800" />Escalado</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded border border-dashed border-amber-400 bg-amber-50 dark:bg-amber-500/10" />Vaga em aberto</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded border border-dashed border-rose-400 bg-rose-50 dark:bg-rose-500/10" />Furo (já passou)</span>
                {isManager && onAddTurn && (
                  <button type="button" onClick={() => onAddTurn(sector)} className="ml-auto flex items-center gap-1 font-medium text-sky-700 dark:text-sky-300 hover:underline cursor-pointer">
                    <Plus className="w-3.5 h-3.5" /> Adicionar turnos ao setor
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      ))}

      {popover && (
        <>
          <button type="button" aria-label="Fechar" onClick={() => setPopover(null)} className="fixed inset-0 z-[60] cursor-default bg-slate-950/10 sm:bg-transparent" />
          <GridPopover

            popover={popover}
            busy={busy}
            helpers={helpers}
            getCandidates={getCandidates}
            onClose={() => setPopover(null)}
            onAssign={(shift, prof) => run(() => onAssign(shift, prof))}
            onUnassign={(shift) => run(() => onUnassign(shift))}
            onEdit={(shift) => { setPopover(null); onEdit(shift); }}
            onCreate={(blank) => { setPopover(null); onCreate(blank); }}
          />
        </>
      )}
    </div>
  );
}

function GridPopover({ popover, busy, helpers, getCandidates, onClose, onAssign, onUnassign, onEdit, onCreate }) {
  const [showOthers, setShowOthers] = useState(false);
  const { isVacant, isShiftPast, formatFullName, getInitials, professionalName, sectorName, formatDay } = helpers;
  const { shift, blank, rect } = popover;
  const width = 300;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const left = Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 12));
  const spaceBelow = window.innerHeight - rect.bottom - 16;
  const spaceAbove = rect.top - 16;
  const below = spaceBelow >= 360 || spaceBelow >= spaceAbove;
  const style = isMobile ? {} : below
    ? { left, top: rect.bottom + 8, width, maxHeight: spaceBelow }
    : { left, bottom: window.innerHeight - rect.top + 8, width, maxHeight: spaceAbove };
  const boxClass = isMobile
    ? 'fixed inset-x-0 bottom-0 z-[61] rounded-t-2xl max-h-[80vh] overflow-y-auto'
    : 'fixed z-[61] rounded-2xl overflow-y-auto';

  if (blank) {
    return (
      <div role="dialog" aria-label="Criar plantão" style={style} className={`${boxClass} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-4`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatDay(blank.date)} · {blank.start_time}–{blank.end_time}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sectorName(blank.sector_id)} · sem plantão neste dia</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-1 -m-1 text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <button type="button" onClick={() => onCreate(blank)} className="mt-3 w-full h-9 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold cursor-pointer">Criar plantão neste dia</button>
      </div>
    );
  }

  const vacant = isVacant(shift);
  const past = isShiftPast(shift);
  const { available, unavailable } = getCandidates(shift);
  const sameSpec = available.filter(c => c.sameSpecialty);
  const otherSpec = available.filter(c => !c.sameSpecialty);
  const listed = showOthers || sameSpec.length === 0 ? [...sameSpec, ...otherSpec] : sameSpec;
  const name = professionalName(shift);

  return (
    <div role="dialog" aria-label="Plantão" style={style} className={`${boxClass} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatDay(shift.date)} · {shift.start_time}–{shift.end_time}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{sectorName(shift.sector_id)} · {helpers.extractSpecialty(shift)}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="p-1 -m-1 text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
      </div>

      {!vacant && (
        <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2.5">
          <span className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 text-xs font-semibold flex items-center justify-center shrink-0">{getInitials(name)}</span>
          <span className="flex-1 min-w-0 text-sm font-medium text-slate-900 dark:text-white truncate">{formatFullName(name)}</span>
        </div>
      )}

      {past ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Este plantão já passou. Para mudar, use “Editar”, que pede a justificativa do ajuste.</p>
      ) : (
        <>
          <p className="mt-3 mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">{vacant ? 'Quem pode assumir' : 'Trocar por'}</p>
          {available.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-1">Ninguém livre e autorizado neste horário.</p>
          ) : (
            <ul className="space-y-0.5">
              {listed.map(({ prof, hours, warning, sameSpecialty }) => (
                <li key={prof.id}>
                  <button type="button" disabled={busy} onClick={() => onAssign(shift, prof)}
                    className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-sky-50 dark:hover:bg-sky-500/10 disabled:opacity-50 cursor-pointer">
                    <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center justify-center shrink-0">{getInitials(prof.name)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-slate-900 dark:text-white truncate">{formatFullName(prof.name)}</span>
                      <span className={`block text-[11px] truncate ${warning ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}>
                        {warning || `${prof.specialty || 'Sem especialidade'}${sameSpecialty ? '' : ' · outra especialidade'}`}
                      </span>
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums shrink-0">{hours}h no mês</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!showOthers && sameSpec.length > 0 && otherSpec.length > 0 && (
            <button type="button" onClick={() => setShowOthers(true)} className="mt-1 px-2 text-xs font-medium text-sky-700 dark:text-sky-300 hover:underline cursor-pointer">
              Mostrar outras especialidades ({otherSpec.length})
            </button>
          )}
          {unavailable.length > 0 && (
            <p className="mt-2 text-[11px] text-slate-400 leading-snug">
              Não podem: {unavailable.slice(0, 4).map(u => `${formatFullName(u.prof.name).split(' ')[0]} (${u.reason})`).join(', ')}{unavailable.length > 4 ? ` e mais ${unavailable.length - 4}` : ''}
            </p>
          )}
        </>
      )}

      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
        {!vacant && !past && (
          <button type="button" disabled={busy} onClick={() => onUnassign(shift)} className="flex-1 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 cursor-pointer">
            <UserMinus className="w-4 h-4" /> Liberar vaga
          </button>
        )}
        {vacant && !past && (
          <span className="flex-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"><Send className="w-3.5 h-3.5" /> Vaga aberta já aparece no Mural</span>
        )}
        <button type="button" onClick={() => onEdit(shift)} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer">
          <Pencil className="w-4 h-4" /> Editar
        </button>
      </div>
    </div>
  );
}
