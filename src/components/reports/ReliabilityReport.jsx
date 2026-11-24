// Confiabilidade: quem cumpre os plantões (só gestão).
import { Card } from '@/components/ui/card';

export default function ReliabilityReport({ activeTab, isManager, reliabilityRows }) {
  return (
    <>
      {/* ABA FINANCEIRO */}
      {activeTab === 'confiabilidade' && isManager && (() => {
        const mostDone = [...reliabilityRows].sort((a, b) => b.done - a.done || b.hours - a.hours)[0];
        const topCover = [...reliabilityRows].sort((a, b) => b.covered - a.covered)[0];
        const topRelease = [...reliabilityRows].sort((a, b) => b.released - a.released)[0];
        const tone = index => index === null ? 'text-slate-400' : index >= 95 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : index >= 85 ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
        return (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <b>Índice</b> = plantões que a pessoa manteve ÷ plantões que eram dela (mantidos + repassados ao Mural). <b>Vagas cobertas</b> = vagas abertas ou repasses de colegas que ela assumiu. Faltas e ponto não entram (o ponto é opcional). Visível só para a gestão.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Mais plantões cumpridos', row: mostDone?.done ? mostDone : null, value: mostDone?.done ? `${mostDone.done} plantão(ões) · ${mostDone.hours} h · ${mostDone.nights} noite(s)` : '—' },
                { label: 'Mais vagas cobertas', row: topCover?.covered ? topCover : null, value: topCover?.covered ? `${topCover.covered} vaga(s)` : '—' },
                { label: 'Mais repasses', row: topRelease?.released ? topRelease : null, value: topRelease?.released ? `${topRelease.released} repasse(s)` : '—' }
              ].map(card => (
                <Card key={card.label} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{card.label}</span>
                  <span className="mt-1 block text-lg font-semibold text-slate-900 dark:text-white truncate">{card.row ? card.row.name : 'Ninguém no período'}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-300">{card.value}</span>
                </Card>
              ))}
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-4 py-2.5 font-medium">#</th>
                    <th className="px-4 py-2.5 font-medium">Profissional</th>
                    <th className="px-4 py-2.5 font-medium text-right">Realizados</th>
                    <th className="px-4 py-2.5 font-medium text-right">Horas</th>
                    <th className="px-4 py-2.5 font-medium text-right">Noites</th>
                    <th className="px-4 py-2.5 font-medium text-right">Fins de semana</th>
                    <th className="px-4 py-2.5 font-medium text-right">Vagas cobertas</th>
                    <th className="px-4 py-2.5 font-medium text-right">Repasses</th>
                    <th className="px-4 py-2.5 font-medium text-right">Trocas diretas</th>
                    <th className="px-4 py-2.5 font-medium text-right">Índice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reliabilityRows.length === 0 && (
                    <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">Nenhum plantão de profissional no período.</td></tr>
                  )}
                  {reliabilityRows.map((row, index) => (
                    <tr key={row.id}>
                      <td className="px-4 py-2.5 text-slate-400">{index + 1}</td>
                      <td className="px-4 py-2.5">
                        <span className="block font-medium text-slate-900 dark:text-white">{row.name}</span>
                        {row.specialty && <span className="block text-xs text-slate-500">{row.specialty}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{row.done}<span className="text-slate-400"> / {row.scheduled}</span></td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{row.hours}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{row.nights}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{row.weekends}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{row.covered}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{row.released}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{row.directSwaps}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${tone(row.index)}`}>{row.index === null ? '—' : `${row.index}%`}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

    </>
  );
}
