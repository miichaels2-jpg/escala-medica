// Custos do período por setor.
import { AlertTriangle, DollarSign } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/reportUtils';

export default function FinancialReport({ activeTab, financialSummary, sectorMetrics }) {
  return (
    <>
      {activeTab === 'financeiro' && (
        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 pb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-slate-400" /> Custos do período
            </h3>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
            Mesma base do Faturamento: salário mensal proporcional aos dias do período e dividido entre os plantões do profissional; produtividade pelo rateio dos dias fechados; demais regimes pela tarifa cadastrada.
          </p>
          {financialSummary.shiftsMissingRate > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{financialSummary.shiftsMissingRate} plantão(ões) ocupado(s) sem valor configurado. Esses registros não entram nos totais até que a remuneração seja cadastrada.</span>
            </div>
          )}
          {financialSummary.shiftsAwaitingProduction > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-indigo-300 bg-indigo-50 p-3 text-xs font-semibold text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{financialSummary.shiftsAwaitingProduction} plantão(ões) por produtividade estão em dias ainda não fechados (falta lançar atendimentos ou o plantão não terminou) e só entram no valor depois do fechamento.</span>
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 min-w-0">
              <span className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">Previsto (ocupados)</span>
              <div className="text-xl sm:text-2xl font-semibold tabular-nums text-slate-900 dark:text-white mt-1 break-words">{formatCurrency(financialSummary.totalCost)}</div>
            </div>
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 min-w-0">
              <span className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400"><span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />Realizado</span>
              <div className="text-xl sm:text-2xl font-semibold tabular-nums text-slate-900 dark:text-white mt-1 break-words">{formatCurrency(financialSummary.executedCost)}</div>
            </div>
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 min-w-0">
              <span className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400"><span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />Pendente</span>
              <div className="text-xl sm:text-2xl font-semibold tabular-nums text-slate-900 dark:text-white mt-1 break-words">{formatCurrency(financialSummary.pendingCost)}</div>
            </div>
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 min-w-0">
              <span className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400"><span className="w-2 h-2 rounded-full bg-rose-500" aria-hidden="true" />Vagas sem profissional</span>
              <div className="text-xl sm:text-2xl font-semibold tabular-nums text-slate-900 dark:text-white mt-1 break-words">{formatCurrency(financialSummary.vacantCost)}</div>
            </div>
          </div>
          {financialSummary.payrollWithoutShifts > 0 && (
            <div className="mt-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs text-slate-600 dark:text-slate-300">
                Folha mensal de {financialSummary.professionalsWithoutShifts} profissional(is) sem plantão no período: <b className="tabular-nums text-slate-900 dark:text-white">{formatCurrency(financialSummary.payrollWithoutShifts)}</b>
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-300">
                Total comparável ao Faturamento: <b className="tabular-nums text-slate-900 dark:text-white">{formatCurrency(financialSummary.comparableTotal)}</b>
              </span>
            </div>
          )}
          <div className="mt-8 border-t border-slate-100 dark:border-slate-700/50 pt-6">
            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-4">Orçamento por Setor Clínico</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500">
                    <th className="py-2 px-2">Setor Clínico</th>
                    <th className="py-2 px-2 text-right">Horas Assistenciais</th>
                    <th className="py-2 px-2 text-right">Custo Projetado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {sectorMetrics.map((sec, idx) => (
                    <tr key={idx}>
                      <td className="py-3 px-2 font-semibold text-slate-900 dark:text-white">{sec.name}</td>
                      <td className="py-3 px-2 text-right tabular-nums text-slate-600 dark:text-slate-400">{sec.hours}h</td>
                      <td className="py-3 px-2 text-right tabular-nums font-semibold text-slate-900 dark:text-white">{formatCurrency(sec.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
