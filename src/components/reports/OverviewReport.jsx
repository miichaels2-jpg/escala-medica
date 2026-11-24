// Visão geral: vagas em aberto e o painel de gestão (gráficos).
import { Suspense } from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { lazyPage } from '@/lib/lazyPage';
import { formatDate, getSectorName, getShiftHours, isShiftPast, isVacant } from '@/lib/reportUtils';

// Os gráficos (recharts) pesam ~400 KB: só baixam quando alguém abre a Visão geral.
// lazyPage: se o arquivo sumiu por uma versão nova, recarrega em vez de mostrar erro.
const ManagementBI = lazyPage(() => import('@/components/reports/ManagementBI'));
const chartsFallback = <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-4 border-slate-200 dark:border-slate-700 border-t-sky-600 rounded-full animate-spin" /></div>;

export default function OverviewReport({ activeTab, coverageRate, credentialAudit, filterSummary, filteredShifts, financialSummary, hospitalName, isAllUnits, periodLabel, professionalMetrics, scopeUnitIds, sectorMetrics, sectors, setActiveTab, shiftCost, unitNameById, vacantShiftItems }) {
  return (
    <>
      {/* VISÃO GERAL */}
      {activeTab === 'bi' && vacantShiftItems.length > 0 && (
        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Vagas sem profissional</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{vacantShiftItems.filter(isShiftPast).length} furo(s) já passados · {vacantShiftItems.filter(v => !isShiftPast(v)).length} em aberto</p>
            </div>
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          </div>
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {vacantShiftItems.slice(0, 5).map((v, i) => {
              const isPast = isShiftPast(v);
              return (
                <li key={v.id || i} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-24 shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{formatDate(v.date)}</span>
                  <span className="flex-1 min-w-0 truncate font-medium text-slate-900 dark:text-white">{getSectorName(v, sectors)}</span>
                  <span className="hidden sm:block tabular-nums text-slate-500 dark:text-slate-400">{v.start_time && v.end_time ? `${v.start_time}–${v.end_time}` : 'Sem horário'}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${isPast ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'}`}>
                    {isPast ? 'Furo' : 'Em aberto'}
                  </span>
                </li>
              );
            })}
          </ul>
          {vacantShiftItems.length > 5 && (
            <button type="button" onClick={() => setActiveTab('escalas')} className="mt-2 flex items-center gap-1 text-sm font-medium text-sky-700 dark:text-sky-300 hover:underline cursor-pointer">
              Ver todas as {vacantShiftItems.length} em Escalas <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </Card>
      )}

      {activeTab === 'bi' && (
        <Suspense fallback={chartsFallback}>
          <ManagementBI
            unitBreakdown={isAllUnits ? scopeUnitIds.map(unitId => {
              const list = filteredShifts.filter(s => String(s.unit_id) === unitId);
              const filled = list.filter(s => !isVacant(s)).length;
              return {
                id: unitId,
                name: unitNameById[unitId] || 'Unidade',
                shifts: list.length,
                coverage: list.length ? Math.round((filled / list.length) * 100) : null,
                vacant: list.length - filled,
                hours: list.reduce((sum, s) => sum + getShiftHours(s), 0),
                cost: list.reduce((sum, s) => sum + (isVacant(s) ? 0 : shiftCost(s)), 0)
              };
            }) : null}
            shifts={filteredShifts}
            isVacant={isVacant}
            shiftCost={shiftCost}
            getShiftHours={getShiftHours}
            isShiftPast={isShiftPast}
            financialSummary={financialSummary}
            coverageRate={coverageRate}
            sectorMetrics={sectorMetrics}
            professionalMetrics={professionalMetrics}
            credentialAudit={credentialAudit}
            periodLabel={periodLabel}
            hospitalName={hospitalName}
            filterSummary={filterSummary}
          />
        </Suspense>
      )}

    </>
  );
}
