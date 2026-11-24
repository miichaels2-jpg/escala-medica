// Relatórios de escalas e de trocas/Mural.
import { ArrowLeftRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDate, getSectorName, isShiftPast, isVacant, titleCase } from '@/lib/reportUtils';

export default function ScheduleReports({ activeTab, filteredShifts, sectors, setShiftRowsLimit, shiftRowsLimit, swapsList }) {
  return (
    <>
      {/* ABA ESCALAS */}
      {activeTab === 'escalas' && (
        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 pb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-slate-400" /> Plantões do período ({filteredShifts.length})
            </h3>
          </div>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-500">
                  <th className="py-3 px-3">Data</th>
                  <th className="py-3 px-3">Setor</th>
                  <th className="py-3 px-3">Profissional Alocado</th>
                  <th className="py-3 px-3">Horário</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {filteredShifts.slice(0, shiftRowsLimit).map((s, idx) => {
                  const isVago = isVacant(s);
                  const isPast = isShiftPast(s);
                  let profNameRender = titleCase(s.professional_name) || 'Não Identificado';
                  let badgeClass = 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30';
                  let badgeText = s.status || 'Confirmado';

                  if (isVago) {
                    if (isPast) {
                      profNameRender = <span className="text-rose-700 dark:text-rose-300">Sem profissional (furo)</span>;
                      badgeClass = 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-500 border-rose-200 dark:border-rose-500/50';
                      badgeText = 'Furo';
                    } else {
                      profNameRender = <span className="text-amber-700 dark:text-amber-300">Vaga em aberto</span>;
                      badgeClass = 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-500/30';
                      badgeText = 'Vago';
                    }
                  }

                  return (
                    <tr key={s.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-3 tabular-nums text-slate-600 dark:text-slate-300">{formatDate(s.date)}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{getSectorName(s, sectors)}</td>
                      <td className="py-3 px-3 font-medium text-slate-900 dark:text-white">{profNameRender}</td>
                      <td className="py-3 px-3 tabular-nums text-slate-500 dark:text-slate-400">{s.start_time && s.end_time ? `${s.start_time}–${s.end_time}` : 'Sem horário'}</td>
                      <td className="py-3 px-3"><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeClass}`}>{String(badgeText).charAt(0).toUpperCase() + String(badgeText).slice(1)}</span></td>
                    </tr>
                  );
                })}
                {filteredShifts.length === 0 && (
                  <tr><td colSpan="5" className="py-8 text-center text-slate-500">Nenhum plantão filtrado no período.</td></tr>
                )}
                {filteredShifts.length > shiftRowsLimit && (
                  <tr><td colSpan="5" className="pt-3 text-center">
                    <Button type="button" variant="outline" onClick={() => setShiftRowsLimit(n => n + 100)} className="h-9 rounded-xl text-sm cursor-pointer">
                      Mostrar mais ({filteredShifts.length - shiftRowsLimit} restantes)
                    </Button>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* NOVA ABA: TROCAS E MURAL */}
      {activeTab === 'trocas' && (
        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 pb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5" /> Histórico de Trocas e Repasses ({swapsList.length})
            </h3>
          </div>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500">
                  <th className="py-3 px-3">Data</th>
                  <th className="py-3 px-3">Setor Clínico</th>
                  <th className="py-3 px-3 text-center">Horário</th>
                  <th className="py-3 px-3">Dono Original</th>
                  <th className="py-3 px-3">Assumido Por</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {swapsList.map((s, idx) => (
                  <tr key={s.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-3 tabular-nums text-slate-600 dark:text-slate-300">{formatDate(s.date)}</td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{getSectorName(s, sectors)}</td>
                    <td className="py-3 px-3 tabular-nums text-center text-slate-500 dark:text-slate-400">{s.start_time} - {s.end_time}</td>
                    <td className="py-3 px-3 font-semibold text-rose-600 dark:text-rose-400">{s.requester}</td>
                    <td className="py-3 px-3 font-medium text-slate-900 dark:text-white">{s.currentProf}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${s.isPending ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-400'}`}>
                        {s.swapStatus}
                      </span>
                    </td>
                  </tr>
                ))}
                {swapsList.length === 0 && (
                  <tr><td colSpan="6" className="py-8 text-center text-slate-500">Nenhum repasse ou troca registrada com base nos filtros atuais.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

    </>
  );
}
