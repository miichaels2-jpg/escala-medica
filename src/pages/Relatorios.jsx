import React, { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Clock, Calendar, TrendingUp, FileText, FileSpreadsheet, 
  ShieldCheck, AlertTriangle, Users, Building2, Activity, Filter, RefreshCw
} from 'lucide-react';
import { exportReportPDF, exportReportCSV } from '@/lib/exportReport';

export default function Relatorios() {
  const { user, company, loading } = useAppData();
  const [shifts, setShifts] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Filtros Avançados de Relatório
  const [activeTab, setActiveTab] = useState('produtividade'); // produtividade, financeiro, auditoria, cobertura
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSector, setSelectedSector] = useState('all');

  const companyId = user?.data?.company_id;
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id;

  const loadData = async () => {
    setLoadingData(true);
    try {
      const f = companyId ? { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) } : {};
      const [s, p, sec] = await Promise.all([
        base44.entities.Shift.filter(f, '-date', 1000).catch(() => []),
        base44.entities.Professional.filter(f, '-created_date', 500).catch(() => []),
        base44.entities.Sector.filter(f, '-created_date', 100).catch(() => [])
      ]);
      setShifts(s || []);
      setProfessionals(p || []);
      setSectors(sec || []);
    } catch (e) {
      console.error('Erro ao carregar dados de relatório:', e);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!loading) loadData();
  }, [loading, companyId, unitId]);

  // Filtragem de plantões por Data e Setor
  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      const sDate = s.date ? s.date.split('T')[0] : '';
      const matchStart = !startDate || sDate >= startDate;
      const matchEnd = !endDate || sDate <= endDate;
      const matchSector = selectedSector === 'all' || String(s.sector_id) === String(selectedSector) || s.sector_name === selectedSector;
      return matchStart && matchEnd && matchSector;
    });
  }, [shifts, startDate, endDate, selectedSector]);

  // 1. Container de Produtividade & Horas por Profissional
  const byProfessional = useMemo(() => {
    const map = {};
    professionals.forEach((p) => {
      map[p.id] = { 
        name: p.name, 
        category: p.specialty || p.category || 'Geral', 
        confirmed: 0, 
        pending: 0, 
        canceled: 0,
        hours: 0,
        estimatedPay: 0,
        hourlyRate: Number(p.hourly_rate) || 120
      };
    });

    filteredShifts.forEach((s) => {
      if (!s.professional_id) return;
      if (!map[s.professional_id]) {
        map[s.professional_id] = { 
          name: s.professional_name || '—', 
          category: 'Profissional', 
          confirmed: 0, 
          pending: 0, 
          canceled: 0,
          hours: 0,
          estimatedPay: 0,
          hourlyRate: 120
        };
      }
      if (s.status === 'confirmado') {
        map[s.professional_id].confirmed += 1;
        const dur = Number(s.duration_hours) || 12;
        map[s.professional_id].hours += dur;
        map[s.professional_id].estimatedPay += dur * map[s.professional_id].hourlyRate;
      }
      if (s.status === 'pendente') map[s.professional_id].pending += 1;
      if (s.status === 'cancelado') map[s.professional_id].canceled += 1;
    });

    return Object.values(map)
      .filter((m) => m.confirmed > 0 || m.pending > 0 || m.canceled > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [filteredShifts, professionals]);

  // 2. Container de Cobertura por Setor
  const bySector = useMemo(() => {
    const map = {};
    filteredShifts.forEach((s) => {
      const key = s.sector_name || 'Geral';
      if (!map[key]) map[key] = { total: 0, filled: 0, open: 0, canceled: 0 };
      map[key].total += 1;
      if (s.status === 'confirmado' || s.status === 'pendente') map[key].filled += 1;
      if (s.status === 'vago') map[key].open += 1;
      if (s.status === 'cancelado') map[key].canceled += 1;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [filteredShifts]);

  // 3. Container de Auditoria de Alterações / Exclusões (Soft Deletes / Cancelados)
  const auditLogs = useMemo(() => {
    return filteredShifts.filter(s => s.status === 'cancelado' || s.notes);
  }, [filteredShifts]);

  const overview = {
    total: filteredShifts.length,
    confirmed: filteredShifts.filter((s) => s.status === 'confirmado').length,
    pending: filteredShifts.filter((s) => s.status === 'pendente').length,
    open: filteredShifts.filter((s) => s.status === 'vago').length,
    canceled: filteredShifts.filter((s) => s.status === 'cancelado').length,
  };

  const totalFinancialEstimate = useMemo(() => {
    return byProfessional.reduce((acc, p) => acc + p.estimatedPay, 0);
  }, [byProfessional]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* HEADER ENTERPRISE */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Central de Relatórios & Auditoria</h1>
          <p className="text-sm text-slate-500">
            Indicadores gerenciais, produtividade do corpo clínico, repasses e rastreabilidade da instituição.
          </p>
        </div>

        {/* Abas de Navegação dos Relatórios */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('produtividade')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'produtividade' ? 'bg-white shadow-sm text-sky-700 dark:bg-slate-700 dark:text-sky-300' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Produtividade & Horas
          </button>
          <button
            onClick={() => setActiveTab('cobertura')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'cobertura' ? 'bg-white shadow-sm text-sky-700 dark:bg-slate-700 dark:text-sky-300' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Cobertura por Setor
          </button>
          <button
            onClick={() => setActiveTab('financeiro')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'financeiro' ? 'bg-white shadow-sm text-sky-700 dark:bg-slate-700 dark:text-sky-300' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Repasse Financeiro
          </button>
          <button
            onClick={() => setActiveTab('auditoria')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${activeTab === 'auditoria' ? 'bg-white shadow-sm text-sky-700 dark:bg-slate-700 dark:text-sky-300' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Log de Auditoria
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS CRUZADOS */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
          <Filter className="w-4 h-4 text-sky-600" /> Filtros:
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full flex-1">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">Data Inicial</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-xs" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">Data Final</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 text-xs" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">Setor / Ala</label>
            <Select value={selectedSector} onValueChange={setSelectedSector}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todos os setores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(startDate || endDate || selectedSector !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setStartDate(''); setEndDate(''); setSelectedSector('all'); }} className="text-xs text-red-500 shrink-0">
            Limpar Filtros
          </Button>
        )}
      </div>

      {/* CONTAINER DE VISÃO GERAL (KPIs) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400">Total Analisado</div>
          <div className="text-2xl font-black text-slate-800 dark:text-white mt-1">{overview.total}</div>
          <div className="text-[10px] text-slate-500">Plantões no período</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-emerald-600">Confirmados</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{overview.confirmed}</div>
          <div className="text-[10px] text-emerald-600 font-semibold">Escala guarnecida</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-amber-600">Pendentes</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{overview.pending}</div>
          <div className="text-[10px] text-amber-600 font-semibold">Aguardando aceite</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-red-600">Vagas Abertas</div>
          <div className="text-2xl font-black text-red-600 mt-1">{overview.open}</div>
          <div className="text-[10px] text-red-600 font-semibold">Furos de escala</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm col-span-2 sm:col-span-1">
          <div className="text-[10px] uppercase font-bold text-sky-600">Cancelados / Auditados</div>
          <div className="text-2xl font-black text-sky-600 mt-1">{overview.canceled}</div>
          <div className="text-[10px] text-sky-600 font-semibold">Soft deletes</div>
        </Card>
      </div>

      {/* CONTEÚDO DINÂMICO CONFORME ABA SELECIONADA */}
      {loadingData ? (
        <div className="flex justify-center p-16"><Loader2 className="w-8 h-8 animate-spin text-sky-600" /></div>
      ) : (
        <div className="space-y-6">
          {/* ABA 1: PRODUTIVIDADE */}
          {activeTab === 'produtividade' && (
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <h3 className="font-bold text-base text-slate-800 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-sky-600" /> Produtividade & Carga Horária do Corpo Clínico
                </h3>
                <span className="text-xs font-semibold text-slate-400">{byProfessional.length} profissionais com atividade</span>
              </div>

              {byProfessional.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-10">Nenhum dado encontrado para os filtros selecionados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3 font-semibold">Profissional</th>
                        <th className="p-3 font-semibold">Especialidade / Categoria</th>
                        <th className="p-3 font-semibold text-center">Confirmados</th>
                        <th className="p-3 font-semibold text-center">Pendentes</th>
                        <th className="p-3 font-semibold text-right">Horas Trabalhadas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {byProfessional.map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="p-3 font-bold text-slate-900 dark:text-white">{p.name}</td>
                          <td className="p-3 text-sky-600 font-semibold uppercase text-xs">{p.category}</td>
                          <td className="p-3 text-center font-bold text-emerald-600">{p.confirmed}</td>
                          <td className="p-3 text-center font-bold text-amber-600">{p.pending}</td>
                          <td className="p-3 text-right font-black text-slate-800 dark:text-white">{p.hours}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* ABA 2: COBERTURA POR SETOR */}
          {activeTab === 'cobertura' && (
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <h3 className="font-bold text-base text-slate-800 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-sky-600" /> Cobertura Operacional & Gargalos por Setor
                </h3>
              </div>

              {bySector.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-10">Sem dados suficientes.</p>
              ) : (
                <div className="space-y-4">
                  {bySector.map(([name, data]) => {
                    const pct = data.total ? Math.round((data.filled / data.total) * 100) : 0;
                    return (
                      <div key={name} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 dark:text-white text-sm">{name}</span>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            {pct}% preenchido · <span className="text-red-600">{data.open} vagas abertas</span> · {data.total} total
                          </span>
                        </div>
                        <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pct < 70 ? 'bg-red-500' : pct < 90 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* ABA 3: REPASSE FINANCEIRO */}
          {activeTab === 'financeiro' && (
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-bold text-base text-slate-800 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" /> Projeção de Repasse & Faturamento Clínico
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Estimativa baseada nas horas confirmadas e valor hora padrão do profissional.</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-emerald-600">R$ {totalFinancialEstimate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Estimado</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3 font-semibold">Profissional</th>
                      <th className="p-3 font-semibold text-center">Horas Validadas</th>
                      <th className="p-3 font-semibold text-center">Valor / Hora</th>
                      <th className="p-3 font-semibold text-right">Total a Repassar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {byProfessional.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{p.name}</td>
                        <td className="p-3 text-center font-semibold">{p.hours}h</td>
                        <td className="p-3 text-center text-slate-500">R$ {p.hourlyRate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right font-black text-emerald-600">R$ {p.estimatedPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ABA 4: LOG DE AUDITORIA */}
          {activeTab === 'auditoria' && (
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-bold text-base text-slate-800 dark:text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-sky-600" /> Log de Auditoria & Plantões Cancelados
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Rastreabilidade completa de ações administrativas e exclusões lógicas (Soft Deletes).</p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {auditLogs.length} registros auditados
                </span>
              </div>

              {auditLogs.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-10">Nenhum evento de cancelamento ou alteração registrado no período.</p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-4 rounded-xl border border-red-200 dark:border-red-950/60 bg-red-50/40 dark:bg-red-950/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            Cancelado / Modificado
                          </span>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Data do Plantão: <b>{log.date}</b> ({log.start_time} - {log.end_time})
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          Profissional: <b>{log.professional_name || 'Vago'}</b> · Setor: <b>{log.sector_name || 'Geral'}</b>
                        </div>
                        {log.notes && (
                          <div className="text-xs text-red-700 dark:text-red-300 font-mono mt-1 bg-white/60 dark:bg-slate-900/60 p-2 rounded border border-red-100 dark:border-red-900">
                            📝 {log.notes}
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 shrink-0">
                        ID: {log.id}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* BOTÕES FLUTUANTES DE DOWNLOAD (PADRÃO ESTABELECIDO) */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-40">
        <button
          onClick={() => exportReportPDF({ company, byProfessional, bySector, overview })}
          className="flex items-center gap-2 bg-sky-600 text-white px-4 py-3 rounded-xl shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:bg-sky-700 font-bold text-xs"
        >
          <FileText className="w-5 h-5" />
          <span>Baixar Relatório (PDF)</span>
        </button>
        <button
          onClick={() => exportReportCSV({ byProfessional, bySector, overview })}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:bg-emerald-700 font-bold text-xs"
        >
          <FileSpreadsheet className="w-5 h-5" />
          <span>Exportar Dados (CSV)</span>
        </button>
      </div>
    </div>
  );
}