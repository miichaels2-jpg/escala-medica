// Produtividade: lançamento diário e extrato por profissional.
import { AlertTriangle, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate, formatNumber, formatUnitRate, getProductivityDayStatus } from '@/lib/reportUtils';

export default function ProductivityReports({ activeTab, hospitalName, periodLabel, productivityReport, selectedProductivityProfessionalId, selectedProductivityRows, selectedProductivitySummary, setSelectedProductivityProfessionalId }) {
  return (
    <>
      {activeTab === 'produtividade_diaria' && (
        <div className="space-y-5">
          {!productivityReport.available ? (
            <Card className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center dark:border-amber-500/30 dark:bg-amber-950/20">
              <AlertTriangle className="mx-auto h-8 w-8 text-amber-600 dark:text-amber-400" />
              <h3 className="mt-3 text-base font-semibold text-amber-900 dark:text-amber-200">
                {productivityReport.error ? 'Configuração inválida' : 'Regra de produtividade não configurada para esta unidade'}
              </h3>
              <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
                {productivityReport.error || 'A apuração diária está vinculada a uma única unidade configurada em Faturamento. Nenhum rateio foi estimado para esta consulta.'}
              </p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'Atendimentos em dias fechados', value: formatNumber(productivityReport.totals.attendance), tone: 'text-sky-600 dark:text-cyan-400' },
                  { label: 'Pool efetivamente rateado', value: formatCurrency(productivityReport.totals.pool), tone: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Plantões produtivos', value: formatNumber(productivityReport.totals.shifts), tone: 'text-indigo-600 dark:text-indigo-400' },
                  { label: 'Dias pendentes', value: formatNumber(productivityReport.totals.pendingDays), tone: 'text-amber-600 dark:text-amber-400' }
                ].map(metric => (
                  <Card key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-medium text-slate-500">{metric.label}</p>
                    <p className={`mt-2 text-xl font-semibold ${metric.tone}`}>{metric.value}</p>
                  </Card>
                ))}
              </div>

              <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex flex-col gap-2 border-b border-slate-100 pb-3 dark:border-slate-700/50 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Fechamento diário da regra</h3>
                    <p className="mt-1 text-[11px] text-slate-500">Pool configurado: {formatCurrency(productivityReport.dailyPool)} por dia. O rateio usa todos os profissionais produtivos da unidade, independentemente dos filtros de exibição.</p>
                  </div>
                  <span className="text-[10px] font-medium text-slate-500">{hospitalName}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 text-xs font-medium text-slate-500 dark:border-slate-700">
                      <tr>
                        <th className="py-3 pr-3">Data</th>
                        <th className="py-3 px-3 text-right">Atendimentos</th>
                        <th className="py-3 px-3 text-right">Plantões produtivos</th>
                        <th className="py-3 px-3 text-right">Pool aplicado</th>
                        <th className="py-3 px-3 text-right">Valor por atendimento</th>
                        <th className="py-3 pl-3 text-right">Situação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {productivityReport.days.map(day => (
                        <tr key={day.date}>
                          <td className="py-3 pr-3 font-semibold">{formatDate(day.date)}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{day.complete ? formatNumber(day.totalAttendance) : 'Pendente'}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{day.items.reduce((sum, item) => sum + item.shifts, 0)}</td>
                          <td className="py-3 px-3 text-right tabular-nums font-semibold">{day.complete ? formatCurrency(day.totalAttendance > 0 ? day.poolAmount : 0) : '—'}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{day.complete && day.totalAttendance > 0 ? formatCurrency(day.poolAmount / day.totalAttendance) : '—'}</td>
                          <td className={`py-3 pl-3 text-right font-semibold ${day.complete ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            {getProductivityDayStatus(day)}
                          </td>
                        </tr>
                      ))}
                      {productivityReport.days.length === 0 && <tr><td colSpan="6" className="py-8 text-center text-slate-500">Nenhum plantão produtivo na unidade dentro do período.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 border-b border-slate-100 pb-3 dark:border-slate-700/50">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Rateio por profissional e dia</h3>
                  <p className="mt-1 text-[11px] text-slate-500">Valor individual = atendimentos do profissional × pool diário ÷ atendimentos totais do dia. Os valores só são liberados quando todos os registros do dia estão completos e os plantões terminaram.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 text-xs font-medium text-slate-500 dark:border-slate-700">
                      <tr>
                        <th className="py-3 pr-3">Data</th>
                        <th className="py-3 px-3">Profissional</th>
                        <th className="py-3 px-3">Setor(es)</th>
                        <th className="py-3 px-3 text-right">Plantões</th>
                        <th className="py-3 px-3 text-right">Total do dia</th>
                        <th className="py-3 px-3 text-right">Atendimentos individuais</th>
                        <th className="py-3 px-3 text-right">Valor / atendimento</th>
                        <th className="py-3 px-3 text-right">Pool diário</th>
                        <th className="py-3 px-3 text-right">Valor rateado</th>
                        <th className="py-3 pl-3 text-right">Situação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {productivityReport.rows.map((row, index) => (
                        <tr key={`${row.date}:${row.professional.id}:${index}`}>
                          <td className="py-3 pr-3 font-semibold">{formatDate(row.date)}</td>
                          <td className="py-3 px-3 font-semibold">{row.professional.name}</td>
                          <td className="py-3 px-3 text-slate-500">{row.sectors}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{row.shifts}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{row.complete ? formatNumber(productivityReport.days.find(day => day.date === row.date)?.totalAttendance) : 'Pendente'}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{row.attendance ?? '—'}</td>
                          <td className="py-3 px-3 text-right tabular-nums">                                {row.unitRate === null ? '—' : formatUnitRate(row.unitRate)}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{row.complete ? formatCurrency(productivityReport.dailyPool) : '—'}</td>
                          <td className="py-3 px-3 text-right tabular-nums font-semibold">{row.complete ? formatCurrency(row.amount) : '—'}</td>
                          <td className={`py-3 pl-3 text-right font-semibold ${row.complete ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            {row.complete ? 'Rateado' : row.pendingReason}
                          </td>
                        </tr>
                      ))}
                      {productivityReport.rows.length === 0 && <tr><td colSpan="10" className="py-8 text-center text-slate-500">Nenhum profissional corresponde aos filtros aplicados.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="mb-4 border-b border-slate-100 pb-3 text-sm font-semibold text-slate-900 dark:border-slate-700/50 dark:text-white">Acumulado por profissional no período</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 text-xs font-medium text-slate-500 dark:border-slate-700">
                      <tr>
                        <th className="py-3 pr-3">Profissional</th>
                        <th className="py-3 px-3 text-right">Plantões</th>
                        <th className="py-3 px-3 text-right">Atendimentos em dias fechados</th>
                        <th className="py-3 px-3 text-right">Saldo acumulado</th>
                        <th className="py-3 pl-3 text-right">Dias pendentes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {productivityReport.professionalTotals.map(item => (
                        <tr key={item.professional.id}>
                          <td className="py-3 pr-3 font-semibold">{item.professional.name}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{item.shifts}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{formatNumber(item.attendance)}</td>
                          <td className="py-3 px-3 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(item.amount)}</td>
                          <td className="py-3 pl-3 text-right font-semibold text-amber-600 dark:text-amber-400">{item.pendingDays}</td>
                        </tr>
                      ))}
                      {productivityReport.professionalTotals.length === 0 && <tr><td colSpan="5" className="py-8 text-center text-slate-500">Nenhum profissional corresponde aos filtros aplicados.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {activeTab === 'produtividade_profissional' && (
        <div className="space-y-5">
          {!productivityReport.available ? (
            <Card className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center dark:border-amber-500/30 dark:bg-amber-950/20">
              <AlertTriangle className="mx-auto h-8 w-8 text-amber-600 dark:text-amber-400" />
              <h3 className="mt-3 text-base font-semibold text-amber-900 dark:text-amber-200">
                {productivityReport.error ? 'Configuração inválida' : 'Regra de produtividade não configurada para esta unidade'}
              </h3>
              <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
                {productivityReport.error || 'O extrato individual usa o pool diário configurado para a unidade selecionada. Nenhum valor será estimado sem essa regra.'}
              </p>
            </Card>
          ) : (
            <>
              <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)] sm:items-end">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Extrato individual de produtividade</h3>
                    <p className="mt-1 text-[11px] text-slate-500">Escolha o profissional para detalhar atendimentos, plantões e valores do período.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">Profissional produtivo</Label>
                    <Select
                      value={selectedProductivitySummary ? String(selectedProductivityProfessionalId) : ''}
                      onValueChange={setSelectedProductivityProfessionalId}
                    >
                      <SelectTrigger className="h-11 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-sky-500 dark:focus:ring-cyan-500 transition-colors">
                        <SelectValue placeholder="Selecione um profissional" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white z-[99999] max-h-[300px]">
                        {productivityReport.professionalTotals.map(item => (
                          <SelectItem key={item.professional.id} value={String(item.professional.id)}>
                            {item.professional.name}{item.professional.specialty ? ` · ${item.professional.specialty}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="mt-4 rounded-xl bg-sky-50 p-3 text-[11px] font-medium text-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
                  Cálculo diário: <strong>{formatCurrency(productivityReport.dailyPool)} ÷ total de atendimentos do dia</strong> = valor por atendimento. O valor do profissional é esse valor multiplicado pelos atendimentos dele. O rateio considera todos os profissionais produtivos escalados na unidade; dias incompletos ficam pendentes e não entram no saldo.
                </p>
              </Card>

              {!selectedProductivitySummary ? (
                <Card className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
                  <Users className="mx-auto h-8 w-8 text-slate-400" />
                  <h3 className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {productivityReport.professionalTotals.length > 0 ? 'Selecione um profissional' : 'Nenhum profissional produtivo encontrado'}
                  </h3>
                  <p className="mt-2 text-xs text-slate-500">
                    {productivityReport.professionalTotals.length > 0
                      ? 'O extrato detalhado e as opções de impressão ficarão disponíveis após a seleção.'
                      : 'Não há plantões produtivos para os filtros e período informados.'}
                  </p>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: 'Plantões no período', value: formatNumber(selectedProductivitySummary.shifts), tone: 'text-indigo-600 dark:text-indigo-400' },
                      { label: 'Atendimentos em dias fechados', value: formatNumber(selectedProductivitySummary.attendance), tone: 'text-sky-600 dark:text-cyan-400' },
                      { label: 'Valor acumulado fechado', value: formatCurrency(selectedProductivitySummary.amount), tone: 'text-emerald-600 dark:text-emerald-400' },
                      { label: 'Dias pendentes', value: formatNumber(selectedProductivitySummary.pendingDays), tone: 'text-amber-600 dark:text-amber-400' }
                    ].map(metric => (
                      <Card key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-xs font-medium text-slate-500">{metric.label}</p>
                        <p className={`mt-2 text-xl font-semibold ${metric.tone}`}>{metric.value}</p>
                      </Card>
                    ))}
                  </div>

                  <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 border-b border-slate-100 pb-3 dark:border-slate-700/50">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {selectedProductivitySummary.professional.name}
                      </h3>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {selectedProductivitySummary.professional.specialty || 'Especialidade não informada'} · {hospitalName} · {periodLabel}
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[850px] text-left text-xs">
                        <thead className="border-b border-slate-200 text-xs font-medium text-slate-500 dark:border-slate-700">
                          <tr>
                            <th className="py-3 pr-3">Data</th>
                            <th className="py-3 px-3">Setor(es)</th>
                            <th className="py-3 px-3 text-right">Plantões</th>
                            <th className="py-3 px-3 text-right">Atendimentos individuais</th>
                            <th className="py-3 px-3 text-right">Total de atendimentos no dia</th>
                            <th className="py-3 px-3 text-right">Valor / atendimento</th>
                            <th className="py-3 px-3 text-right">Valor rateado</th>
                            <th className="py-3 pl-3 text-right">Situação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {selectedProductivityRows.map(row => {
                            const day = productivityReport.days.find(item => item.date === row.date);
                            return (
                              <tr key={`${row.date}:${row.professional.id}`}>
                                <td className="py-3 pr-3 font-semibold">{formatDate(row.date)}</td>
                                <td className="py-3 px-3">{row.sectors}</td>
                                <td className="py-3 px-3 text-right tabular-nums">{row.shifts}</td>
                                <td className="py-3 px-3 text-right tabular-nums">{row.attendance ?? 'Não lançado'}</td>
                                <td className="py-3 px-3 text-right tabular-nums">{row.complete ? formatNumber(day?.totalAttendance) : 'Pendente'}</td>
                                <td className="py-3 px-3 text-right tabular-nums">{row.unitRate === null ? '—' : formatUnitRate(row.unitRate)}</td>
                                <td className="py-3 px-3 text-right tabular-nums font-semibold">{row.complete ? formatCurrency(row.amount) : '—'}</td>
                                <td className={`py-3 pl-3 text-right font-semibold ${row.complete ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                  {row.complete ? 'Rateado' : row.pendingReason}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-900/60">
                            <td className="py-3 pr-3" colSpan="2">Total fechado no período</td>
                            <td className="py-3 px-3 text-right tabular-nums">{selectedProductivitySummary.shifts}</td>
                            <td className="py-3 px-3 text-right tabular-nums">{formatNumber(selectedProductivitySummary.attendance)}</td>
                            <td className="py-3 px-3 text-right">—</td>
                            <td className="py-3 px-3 text-right">—</td>
                            <td className="py-3 px-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatCurrency(selectedProductivitySummary.amount)}</td>
                            <td className="py-3 pl-3 text-right">
                              {selectedProductivitySummary.pendingDays ? `${selectedProductivitySummary.pendingDays} pendente(s) · saldo parcial` : 'Completo'}
                            </td>
                          </tr>
                          {selectedProductivityRows.length === 0 && (
                            <tr><td colSpan="8" className="py-8 text-center text-slate-500">Nenhum plantão produtivo encontrado para este profissional no período.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      )}

    </>
  );
}
