import { useMemo } from 'react';
import { ArrowRight, Building2 } from 'lucide-react';
import { getShiftDateTimeRange, isShiftVacant } from '@/lib/shiftLiveStatus';
import { getShiftUrgency } from '@/lib/urgentVacancies';

export const SWITCH_UNIT_EVENT = 'scalemedic:switch-unit';

function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Visão "Todas as unidades" do gestor: um cartão por hospital com o essencial
// do momento. "Abrir" troca a unidade selecionada (mesma ação do cabeçalho).
export default function UnitsOverview({ units, shifts, selectedUnitId, now = new Date() }) {
  const rows = useMemo(() => {
    const today = localDate(now);
    const monthPrefix = today.slice(0, 7);
    const weekAhead = now.getTime() + 7 * 86400000;
    return (units || []).map(unit => {
      const unitShifts = (shifts || []).filter(s => s && String(s.unit_id) === String(unit.id) && !String(s.status || '').toLowerCase().includes('cancel'));
      const todayShifts = unitShifts.filter(s => String(s.date).slice(0, 10) === today);
      let openWeek = 0, urgent = 0, missedMonth = 0;
      unitShifts.forEach(s => {
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
      return {
        unit,
        todayFilled: todayShifts.filter(s => !isShiftVacant(s)).length,
        todayTotal: todayShifts.length,
        openWeek,
        urgent,
        missedMonth
      };
    });
  }, [units, shifts, now]);

  if (rows.length < 2) return null;

  const openUnit = unitId => window.dispatchEvent(new CustomEvent(SWITCH_UNIT_EVENT, { detail: String(unitId) }));

  return (
    <section aria-label="Suas unidades" className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Suas unidades ({rows.length})</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ unit, todayFilled, todayTotal, openWeek, urgent, missedMonth }) => {
          const current = String(unit.id) === String(selectedUnitId);
          return (
            <div key={unit.id} className={`rounded-2xl border bg-white dark:bg-slate-900 p-4 shadow-sm ${current ? 'border-sky-400 dark:border-sky-600' : 'border-slate-200 dark:border-slate-800'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-900 dark:text-white truncate">{unit.name}</span>
                </div>
                {current ? (
                  <span className="shrink-0 rounded-full bg-sky-100 dark:bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-800 dark:text-sky-300">Aberta agora</span>
                ) : (
                  <button type="button" onClick={() => openUnit(unit.id)} className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:underline cursor-pointer">
                    Abrir <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Plantões hoje</dt>
                  <dd className="text-base font-semibold text-slate-900 dark:text-white">{todayFilled}/{todayTotal}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Vagas em 7 dias</dt>
                  <dd className={`text-base font-semibold ${openWeek ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>{openWeek}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Urgentes (24 h)</dt>
                  <dd className={`text-base font-semibold ${urgent ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>{urgent}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Furos no mês</dt>
                  <dd className={`text-base font-semibold ${missedMonth ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>{missedMonth}</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
    </section>
  );
}
