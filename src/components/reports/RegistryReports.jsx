// Bases de setores e profissionais, aniversariantes e produção por profissional.
import { Building2, Contact2, Gift, Stethoscope } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { formatCurrency, formatDate, getProfessionalRemuneration, isCredentialExpired, normalize, titleCase } from '@/lib/reportUtils';

export default function RegistryReports({ activeTab, birthDaysList, enrichedSectors, filteredProfessionals, hospitalName, professionalMetrics, selectedUnitId }) {
  return (
    <>
      {/* ABA BASE DE SETORES */}
      {activeTab === 'base_setores' && (
        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 pb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5" /> Estrutura de Setores ({enrichedSectors.length})
            </h3>
          </div>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500">
                  <th className="py-3 px-3">Nome do Setor</th>
                  <th className="py-3 px-3">Especialidade Exigida</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">Plantões no Período</th>
                  <th className="py-3 px-3 text-right">Custo Projetado (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {enrichedSectors.map((s, idx) => (
                  <tr key={s.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-3 font-medium text-slate-900 dark:text-white">{titleCase(s.name)}</td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{s.specialty || 'Não definida'}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${normalize(s.status) === 'inativo' ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>
                        {s.status || 'Ativo'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center tabular-nums font-semibold text-slate-900 dark:text-white">{s.shiftsCount}</td>
                    <td className="py-3 px-3 text-right tabular-nums font-semibold text-slate-900 dark:text-white">{formatCurrency(s.totalCost)}</td>
                  </tr>
                ))}
                {enrichedSectors.length === 0 && (
                  <tr><td colSpan="5" className="py-8 text-center text-slate-500">Nenhum setor atende aos filtros atuais.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ABA BASE DE PROFISSIONAIS */}
      {activeTab === 'base_profissionais' && (
        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 pb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Contact2 className="w-5 h-5" /> Base do Corpo Clínico ({filteredProfessionals.length})
            </h3>
          </div>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500">
                  <th className="py-3 px-3">Nome Completo</th>
                  <th className="py-3 px-3">Especialidade</th>
                  <th className="py-3 px-3">Remuneração · {hospitalName}</th>
                  <th className="py-3 px-3">Documento (CRM)</th>
                  <th className="py-3 px-3">Vencimento Doc.</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {filteredProfessionals.map((p, idx) => {
                  const expiryDate = p.document_expiry || p.documentExpiry || p.valid_until;
                  const isExpired = isCredentialExpired(expiryDate);
                  return (
                    <tr key={p.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-3 font-medium text-slate-900 dark:text-white">{titleCase(p.name)}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{p.specialty}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">{getProfessionalRemuneration(p, selectedUnitId)}</td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300 tabular-nums">{p.document || '—'}</td>
                      <td className={`py-3 px-3 tabular-nums ${isExpired ? 'text-rose-600 dark:text-rose-500 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                        {formatDate(expiryDate)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${normalize(p.status) === 'inativo' ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>
                          {p.status || 'Ativo'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredProfessionals.length === 0 && (
                  <tr><td colSpan="6" className="py-8 text-center text-slate-500">Nenhum profissional encontrado com os filtros atuais.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* NOVA ABA: ANIVERSARIANTES */}
      {activeTab === 'aniversariantes' && (
        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 pb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Gift className="w-5 h-5" /> Aniversariantes do Mês ({birthDaysList.length})
            </h3>
          </div>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500">
                  <th className="py-3 px-3 text-center w-24">Dia</th>
                  <th className="py-3 px-3">Profissional</th>
                  <th className="py-3 px-3 text-center">Idade</th>
                  <th className="py-3 px-3">Setor / Especialidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {birthDaysList.map((p, idx) => (
                  <tr key={p.id || idx} className="hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-colors">
                    <td className="py-3 px-3 text-center">
                      <span className="bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 font-semibold px-3 py-1 rounded-xl text-lg">
                        {p.birthDayNum}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900 dark:text-white text-sm">{titleCase(p.name)}</td>
                    <td className="py-3 px-3 text-center tabular-nums font-semibold text-slate-500">{p.ageTurns} anos</td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{p.specialty}</td>
                  </tr>
                ))}
                {birthDaysList.length === 0 && (
                  <tr><td colSpan="4" className="py-8 text-center text-slate-500">Nenhum aniversariante encontrado neste período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ABA PROFISSIONAIS (PRODUTIVIDADE) */}
      {activeTab === 'profissionais' && (
        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 pb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Stethoscope className="w-5 h-5" /> Matriz de Produtividade Clínica ({professionalMetrics.length})
            </h3>
          </div>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500">
                  <th className="py-3 px-3">Profissional</th>
                  <th className="py-3 px-3">Especialidade</th>
                  <th className="py-3 px-3 text-center">Nº Plantões</th>
                  <th className="py-3 px-3 text-right">Carga Horária</th>
                  <th className="py-3 px-3 text-right">Honorários (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {professionalMetrics.map((doc, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-3 font-medium text-slate-900 dark:text-white flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-sky-600 dark:text-cyan-400 font-semibold flex items-center justify-center text-[10px] border border-slate-200 dark:border-slate-700">
                        {doc.name.substring(0,2).toUpperCase()}
                      </div>
                      {doc.name}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{doc.specialty}</td>
                    <td className="py-3 px-3 text-center tabular-nums font-semibold text-slate-900 dark:text-white">{doc.shifts}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{doc.hours}h</td>
                    <td className="py-3 px-3 text-right tabular-nums font-semibold text-slate-900 dark:text-white">{formatCurrency(doc.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

    </>
  );
}
