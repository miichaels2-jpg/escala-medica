import React, { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Clock, Calendar, TrendingUp, FileText, FileSpreadsheet, 
  ShieldCheck, AlertTriangle, Users, Building2, Activity, Filter, Loader2, Download, DollarSign, BarChart3
} from 'lucide-react';
import { exportReportPDF, exportReportCSV } from '@/lib/exportReport';

export default function Relatorios() {
  const { user, company, loading } = useAppData();
  const [shifts, setShifts] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [activeTab, setActiveTab] = useState('produtividade');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSector, setSelectedSector] = useState('all');

  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id;

  const loadData = async () => {
    if (!companyId) return;
    setLoadingData(true);
    try {
      const f = { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) };
      const [s, p, sec] = await Promise.all([
        base44.entities.Shift.filter(f, '-date', 1000).catch(() => []),
        base44.entities.Professional.filter(f, '-created_date', 500).catch(() => []),
        base44.entities.Sector.filter(f, '-created_date', 100).catch(() => [])
      ]);
      setShifts(Array.isArray(s) ? s : []);
      setProfessionals(Array.isArray(p) ? p : []);
      setSectors(Array.isArray(sec) ? sec : []);
    } catch (e) {
      console.error('Erro ao carregar dados de relatório:', e);
      setShifts([]);
      setProfessionals([]);
      setSectors([]);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!loading) loadData();
  }, [loading, companyId, unitId]);

  const filteredShifts = useMemo(() => {
    if (!Array.isArray(shifts)) return [];
    return shifts.filter((s) => {
      if (!s) return false;
      const sDate = typeof s.date === 'string' ? s.date.split('T')[0] : '';
      const matchStart = !startDate || sDate >= startDate;
      const matchEnd = !endDate || sDate <= endDate;
      const matchSector = selectedSector === 'all' || String(s.sector_id) === String(selectedSector) || s.sector_name === selectedSector;
      return matchStart && matchEnd && matchSector;
    });
  }, [shifts, startDate, endDate, selectedSector]);

  const byProfessional = useMemo(() => {
    const map = {};
    if (Array.isArray(professionals)) {
      professionals.forEach((p) => {
        if (!p || !p.id) return;
        map[p.id] = { 
          name: p.name || 'Sem Nome', 
          category: p.specialty || p.category || 'Geral', 
          confirmed: 0, 
          pending: 0, 
          canceled: 0,
          hours: 0,
          estimatedPay: 0,
          hourlyRate: Number(p.hourly_rate) || 120
        };
      });
    }

    filteredShifts.forEach((s) => {
      if (!s || !s.professional_id) return;
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

  const bySector = useMemo(() => {
    const map = {};
    filteredShifts.forEach((s) => {
      if (!s) return;
      const key = s.sector_name || 'Geral';
      if (!map[key]) map[key] = { total: 0, filled: 0, open: 0, canceled: 0 };
      map[key].total += 1;
      if (s.status === 'confirmado' || s.status === 'pendente') map[key].filled += 1;
      if (s.status === 'vago') map[key].open += 1;
      if (s.status === 'cancelado') map[key].canceled += 1;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [filteredShifts]);

  const auditLogs = useMemo(() => {
    return filteredShifts.filter(s => s && (s.status === 'cancelado' || s.notes));
  }, [filteredShifts]);

  const overview = useMemo(() => ({
    total: filteredShifts.length,
    confirmed: filteredShifts.filter((s) => s?.status === 'confirmado').length,
    pending: filteredShifts.filter((s) => s?.status === 'pendente').length,
    open: filteredShifts.filter((s) => s?.status === 'vago').length,
    canceled: filteredShifts.filter((s) => s?.status === 'cancelado').length,
  }), [filteredShifts]);

  const totalFinancialEstimate = useMemo(() => {
    return byProfessional.reduce((acc, p) => acc + (p?.estimatedPay || 0), 0);
  }, [byProfessional]);

  // FUNÇÕES DE DOWNLOAD ESPECÍFICAS PARA CADA ABA (ISOLADAS)
  const handleDownloadPDF = () => {
    let titleSuffix = 'Relatório Geral';
    let customData = { overview, byProfessional, bySector };

    if (activeTab === 'produtividade') {
      titleSuffix = 'Produtividade do Corpo Clínico';
      customData = { overview: { title: titleSuffix, total: overview.total }, byProfessional };
    } else if (activeTab === 'cobertura') {
      titleSuffix = 'Cobertura Operacional por Setor';
      customData = { overview: { title: titleSuffix, total: overview.total }, bySector };
    } else if (activeTab === 'financeiro') {
      titleSuffix = 'Projeção de Repasse Financeiro';
      customData = { overview: { title: titleSuffix, totalEstimate: totalFinancialEstimate }, byProfessional };
    } else if (activeTab === 'auditoria') {
      titleSuffix = 'Log de Auditoria e Plantões Cancelados';
      customData = { overview: { title: titleSuffix }, auditLogs };
    }

    exportReportPDF({ company: company || { name: 'Hospital' }, ...customData, titleSuffix });
  };

  const handleDownloadCSV = () => {
    let customData = { byProfessional, bySector, overview };
    if (activeTab === 'produtividade') customData = { byProfessional };
    else if (activeTab === 'cobertura') customData = { bySector };
    else if (activeTab === 'financeiro') customData = { byProfessional };
    else if (activeTab === 'auditoria') customData = { auditLogs };

    exportReportCSV(customData);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      
      {/* HEADER EXECUTIVO HOSPITALAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-950 to-sky-950 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sky-400">
            <BarChart3 className="w-4 h-4" /> Inteligência Gerencial & Governança
          </div>
          <h1 className="text-3xl font-black tracking-tight">Central de Relatórios</h1>
          <p className="text-xs text-slate-300 max-w-xl">
            Painel unificado de auditoria, dimensionamento de equipes e controle de repasses da instituição.
          </p>
        </div>

        {/* BOTÕES DE DOWNLOAD RÁPIDO DO CONTEXTO ATUAL */}
        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={handleDownloadPDF} className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs h-10 px-4 gap-2 shadow-lg">
            <FileText className="w-4 h-4" /> Baixar PDF desta Aba
          </Button>
          <Button onClick={handleDownloadCSV} variant="outline" className="border-white/20 text-white bg-white/10 hover:bg-white/20 font-bold text-xs h-10 px-4 gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* ABAS DE NAVEGAÇÃO DOS RELATÓRIOS */}
      <div className="flex items-center bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab('produtividade')}
          className={`flex-1 min-w-[160px] px-4 py-2.5 text-xs font-bold rounded-xl transition-all text-center whitespace-nowrap ${activeTab === 'produtividade' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          ⏱️ Produtividade & Horas
        </button>
        <button
          onClick={() => setActiveTab('cobertura')}
          className={`flex-1 min-w-[160px] px-4 py-2.5 text-xs font-bold rounded-xl transition-all text-center whitespace-nowrap ${activeTab === 'cobertura' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          🏥 Cobertura por Setor
        </button>
        <button
          onClick={() => setActiveTab('financeiro')}
          className={`flex-1 min-w-[160px] px-4 py-2.5 text-xs font-bold rounded-xl transition-all text-center whitespace-nowrap ${activeTab === 'financeiro' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          💰 Repasse Financeiro
        </button>
        <button
          onClick={() => setActiveTab('auditoria')}
          className={`flex-1 min-w-[160px] px-4 py-2.5 text-xs font-bold rounded-xl transition-all text-center whitespace-nowrap ${activeTab === 'auditoria' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          🛡️ Log de Auditoria
        </button>
      </div>

      {/* BARRA DE FILTROS INTELIGENTES (OPCIONAL) */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
          <Filter className="w-4 h-4 text-sky-600" /> Filtros Rápidos:
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full flex-1">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">De (Opcional)</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-xs bg-slate-50 dark:bg-slate-800" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">Até (Opcional)</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 text-xs bg-slate-50 dark:bg-slate-800" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">Setor Específico</label>
            <Select value={String(selectedSector)} onValueChange={setSelectedSector}>
              <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800"><SelectValue placeholder="Todos os setores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores (Geral)</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={String(s.name)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(startDate || endDate || selectedSector !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setStartDate(''); setEndDate(''); setSelectedSector('all'); }} className="text-xs text-red-500 shrink-0 h-9">
            Redefinir Filtros
          </Button>
        )}
      </div>

      {/* CARDS DE RESUMO EXECUTIVO (KPIs) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400">Total Analisado</div>
          <div className="text-2xl font-black text-slate-800 dark:text-white mt-1">{overview.total}</div>
          <div className="text-[10px] text-slate-500">Plantões no escopo</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-emerald-600">Confirmados</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{overview.confirmed}</div>
          <div className="text-[10px] text-emerald-600 font-semibold">Postos ocupados</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-amber-600">Pendentes</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{overview.pending}</div>
          <div className="text-[10px] text-amber-600 font-semibold">Aguardando aceite</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-red-600">Vagas Abertas</div>
          <div className="text-2xl font-black text-red-600 mt-1">{overview.open}</div>
          <div className="text-[10px] text-red-600 font-semibold">Risco de desfalque</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm col-span-2 sm:col-span-1">
          <div className="text-[10px] uppercase font-bold text-sky-600">Cancelados</div>
          <div className="text-2xl font-black text-sky-600 mt-1">{overview.canceled}</div>
          <div className="text-[10px] text-sky-600 font-semibold">Soft deletes</div>
        </Card>
      </div>

      {/* CORPO DO RELATÓRIO (CONTAINER PRINCIPAL) */}
      {loadingData ? (
        <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-sky-600" /></div>
      ) : (
        <div className="space-y-6">
          
          {/* ABA 1: PRODUTIVIDADE & HORAS */}
          {activeTab === 'produtividade' && (
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 rounded-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-sky-600" /> Carga Horária & Produtividade do Corpo Clínico
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Total de horas válidas e plantões confirmados por profissional.</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200">
                  {byProfessional.length} ativos no período
                </span>
              </div>

              {byProfessional.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">Nenhum dado encontrado para os filtros selecionados.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="p-3.5 font-bold">Profissional</th>
                        <th className="p-3.5 font-bold">Especialidade</th>
                        <th className="p-3.5 font-bold text-center">Confirmados</th>
                        <th className="p-3.5 font-bold text-center">Pendentes</th>
                        <th className="p-3.5 font-bold text-right">Horas Totais</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {byProfessional.map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-3.5 font-bold text-slate-900 dark:text-white">{p.name}</td>
                          <td className="p-3.5 text-sky-600 font-semibold uppercase text-xs">{p.category}</td>
                          <td className="p-3.5 text-center font-bold text-emerald-600">{p.confirmed}</td>
                          <td className="p-3.5 text-center font-bold text-amber-600">{p.pending}</td>
                          <td className="p-3.5 text-right font-black text-slate-800 dark:text-white">{p.hours}h</td>
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
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 rounded-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-sky-600" /> Cobertura Operacional por Setor
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Mapeamento de furos de escala e postos descobertos por ala hospitalar.</p>
                </div>
              </div>

              {bySector.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">Sem dados suficientes.</p>
              ) : (
                <div className="space-y-4">
                  {bySector.map(([name, data]) => {
                    const pct = data.total ? Math.round((data.filled / data.total) * 100) : 0;
                    return (
                      <div key={name} className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-sky-600" /> {name}
                          </span>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            {pct}% preenchido · <span className="text-red-600 font-black">{data.open} vagas abertas</span> · {data.total} turnos totais
                          </span>
                        </div>
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden p-0.5">
                          <div className={`h-full rounded-full transition-all duration-500 ${pct < 70 ? 'bg-red-500' : pct < 90 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
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
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 rounded-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-600" /> Projeção de Repasse & Honorários
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Cálculo automatizado do montante a ser liquidado ao corpo clínico.</p>
                </div>
                <div className="text-right bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                  <div className="text-2xl font-black text-emerald-600">R$ {totalFinancialEstimate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <div className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">Total Global Estimado</div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="p-3.5 font-bold">Profissional</th>
                      <th className="p-3.5 font-bold text-center">Horas Validadas</th>
                      <th className="p-3.5 font-bold text-center">Valor Base / Hora</th>
                      <th className="p-3.5 font-bold text-right">Total a Liquidar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {byProfessional.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">{p.name}</td>
                        <td className="p-3.5 text-center font-semibold">{p.hours}h</td>
                        <td className="p-3.5 text-center text-slate-500">R$ {p.hourlyRate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3.5 text-right font-black text-emerald-600">R$ {p.estimatedPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ABA 4: LOG DE AUDITORIA */}
          {activeTab === 'auditoria' && (
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 rounded-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-sky-600" /> Log de Auditoria & Modificações
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Rastreabilidade completa de cancelamentos e alterações em plantões.</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200">
                  {auditLogs.length} eventos registrados
                </span>
              </div>

              {auditLogs.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">Nenhum evento de cancelamento ou alteração registrado no período.</p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-4 rounded-2xl border border-red-200 dark:border-red-950/60 bg-red-50/30 dark:bg-red-950/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            Plantão Cancelado / Ajustado
                          </span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Data: {log.date} ({log.start_time} - {log.end_time})
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                          Profissional: <b className="text-slate-800 dark:text-white">{log.professional_name || 'Vago'}</b> · Setor: <b className="text-slate-800 dark:text-white">{log.sector_name || 'Geral'}</b>
                        </div>
                        {log.notes && (
                          <div className="text-xs text-red-700 dark:text-red-300 font-mono mt-1 bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-red-100 dark:border-red-900">
                            📝 {log.notes}
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 shrink-0 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
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

    </div>
  );
}