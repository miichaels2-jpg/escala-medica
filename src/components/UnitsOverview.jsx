import { useMemo } from 'react';
import { Building2, Layers } from 'lucide-react';
import { getShiftDateTimeRange, isShiftVacant } from '@/lib/shiftLiveStatus';
import { getShiftUrgency } from '@/lib/urgentVacancies';

export const ALL_UNITS = 'todas';

// Pede ao layout para trocar a unidade selecionada (mesma ação do seletor do
// cabeçalho) e, opcionalmente, abrir uma tela depois: { unitId, path }.
export const SWITCH_UNIT_EVENT = 'scalemedic:switch-unit';
export function requestUnitSwitch(unitId, path) {
  window.dispatchEvent(new CustomEvent(SWITCH_UNIT_EVENT, { detail: { unitId: String(unitId), path } }));
}

function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function summarize(shifts, now) {
  const today = localDate(now);
  const monthPrefix = today.slice(0, 7);
  const weekAhead = now.getTime() + 7 * 86400000;
  const active = (shifts || []).filter(s => s && !String(s.status || '').toLowerCase().includes('cancel'));
  const todayShifts = active.filter(s => String(s.date).slice(0, 10) === today);
  let openWeek = 0, urgent = 0, missedMonth = 0;
  active.forEach(s => {
    if (!isShiftVacant(s)) return;
    const range = getShiftDateTimeRange(s);
    if (!range) return;
    if (range.end <= now) {
      if (String(s.date).startsWith(monthPrefix)) missedMonth += 1;
      return;
    }
    if (range.start.getTime() <= weekAhead) openWeek += 1;
    if (getShiftUrgency(s, now)) urgent += 1;
  });
  return { todayFilled: todayShifts.filter(s => !isShiftVacant(s)).length, todayTotal: todayShifts.length, openWeek, urgent, missedMonth };
}

// Filtro do Painel do gestor: "Todas as unidades" ou um hospital, com o essencial de cada um.
export default function UnitsOverview({ units, shifts, scope, onScopeChange, now = new Date() }) {
  const cards = useMemo(() => {
    const unitIds = (units || []).map(u => String(u.id));
    const inScope = (shifts || []).filter(s => unitIds.includes(String(s.unit_id)));
    return [
      { id: ALL_UNITS, name: `Todas as unidades (${unitIds.length})`, all: true, ...summarize(inScope, now) },
      ...(units || []).map(unit => ({
        id: String(unit.id),
        name: unit.name,
        ...summarize(inScope.filter(s => String(s.unit_id) === String(unit.id)), now)
      }))
    ];
  }, [units, shifts, now]);

  if ((units || []).length < 2) return null;

  return (
    <section aria-label="Unidades do painel" className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Mostrar no painel</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="Unidade do painel">
        {cards.map(card => {
          const selected = String(scope) === card.id;
          const Icon = card.all ? Layers : Building2;
          return (
            <button
              key={card.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onScopeChange(card.id)}
              className={`text-left rounded-2xl border bg-white dark:bg-slate-900 p-4 shadow-sm transition-colors cursor-pointer ${selected ? 'border-sky-500 ring-2 ring-sky-500/30' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${selected ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400'}`} />
                <span className="font-semibold text-slate-900 dark:text-white truncate">{card.name}</span>
              </span>
              <span className="mt-3 grid grid-cols-4 gap-2 text-xs">
                <Metric label="Hoje" value={`${card.todayFilled}/${card.todayTotal}`} />
                <Metric label="Vagas 7 d" value={card.openWeek} tone={card.openWeek ? 'amber' : null} />
                <Metric label="Urgentes" value={card.urgent} tone={card.urgent ? 'rose' : null} />
                <Metric label="Furos mês" value={card.missedMonth} tone={card.missedMonth ? 'rose' : null} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Metric({ label, value, tone }) {
  const color = tone === 'rose' ? 'text-rose-700 dark:text-rose-400' : tone === 'amber' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white';
  return (
    <span className="block min-w-0">
      <span className="block truncate text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`block text-base font-semibold ${color}`}>{value}</span>
    </span>
  );
}
