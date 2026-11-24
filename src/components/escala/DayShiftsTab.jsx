// Aba "Plantão do dia": quem está em cada setor hoje.
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { extractSpecialty, formatFullName, isVacant, sentenceCase } from '@/lib/escalaUtils';

export default function DayShiftsTab({ PILL_TONES, activeTab, handlePrintA4Landscape, liveNow, professionalMap, sectorMap, shiftPill, tvData }) {
  return (
    <>
      {/* ========================================================================= */}
      {/* 4. ABA 2: PLANTÃO DO DIA (RESTAURADA E OPERACIONAL)                       */}
      {/* ========================================================================= */}
      {activeTab === 'dia' && (
        <div className="space-y-5 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Plantão do dia</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{sentenceCase(liveNow.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }))}</p>
              </div>
              <Button onClick={handlePrintA4Landscape} variant="outline" className="h-10 text-sm font-medium px-4 rounded-xl gap-2 cursor-pointer">
                <Printer className="w-4 h-4" /> Imprimir (A4 deitado)
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500 dark:text-slate-400 text-xs font-medium border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Setor</th>
                    <th className="py-2.5 px-3">Horário</th>
                    <th className="py-2.5 px-3">Profissional</th>
                    <th className="py-2.5 px-3">Especialidade</th>
                    <th className="py-2.5 px-3">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tvData.tableDayShifts.length === 0 ? (
                    <tr><td colSpan="5" className="py-8 text-center text-slate-400">Nenhum plantão registrado tocando o dia de hoje.</td></tr>
                  ) : (
                    tvData.tableDayShifts.map(shift => {
                      const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
                      const sector = sectorMap[String(shift.sector_id)];
                      const realSpecialty = extractSpecialty(shift, prof);
                      const validName = prof?.name || shift.professional_name;

                      const [sYear, sMonth, sDay] = (shift.date || '').split('-');
                      const formattedDate = sDay && sMonth ? `${sDay}/${sMonth}/${sYear}` : shift.date;

                      const pill = shiftPill(shift);
                      return (
                        <tr key={shift.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{sector?.name || 'Setor'}</td>
                          <td className="py-2.5 px-3 tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">{formattedDate.slice(0, 5)} · {shift.start_time}–{shift.end_time}</td>
                          <td className="py-2.5 px-3 text-slate-900 dark:text-slate-100">{isVacant(shift) ? <span className="text-slate-500">Sem profissional</span> : formatFullName(validName)}</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{realSpecialty}</td>
                          <td className="py-2.5 px-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PILL_TONES[pill.tone]}`}>{pill.label}</span></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
