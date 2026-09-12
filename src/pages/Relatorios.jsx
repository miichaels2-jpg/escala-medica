import React, { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Clock, Calendar, TrendingUp, FileText, FileSpreadsheet, 
  ShieldCheck, AlertTriangle, Users, Building2, Activity, Filter, Loader2, Download, DollarSign, BarChart3, Eye, Printer
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

  // EXPORTAÇÕES ISOLADAS E CORRETAS POR ABA
  const handleDownloadPDF = () => {
    const dateRangeLabel = startDate || endDate ? `Período: ${startDate || 'Início'} até ${endDate || 'Hoje'}` : 'Consolidado Geral';
    
    if (activeTab === 'produtividade') {
      exportReportPDF({
        company: company || { name: 'Hospital' },
        titleSuffix: `Relatório de Produtividade e Horas - ${dateRangeLabel}`,
        overview: { total: overview.total, confirmed: overview.confirmed },
        byProfessional
      });
    } else if (activeTab === 'cobertura') {
      exportReportPDF({
        company: company || { name: 'Hospital' },
        titleSuffix: `Relatório de Cobertura Operacional por Setor - ${dateRangeLabel}`,
        overview: { total: overview.total, open: overview.open },
        bySector: bySector.map(([name, data]) => ({ name, ...data }))
      });
    } else if (activeTab === 'financeiro') {
      exportReportPDF({
        company: company || { name: 'Hospital' },
        titleSuffix: `Relatório de Projeção de Repasse Financeiro - ${dateRangeLabel}`,
        overview: { totalEstimate: totalFinancialEstimate },
        byProfessional: byProfessional.map(p => ({ name: p.name, hours: p.hours, estimatedPay: p.estimatedPay }))
      });
    } else if (activeTab === 'auditoria') {
      exportReportPDF({
        company: company || { name: 'Hospital' },
        titleSuffix: `Relatório de Log de Auditoria e Modificações - ${dateRangeLabel}`,
        overview: { totalCanceled: auditLogs.length },
        auditLogs
      });
    }
  };

  const handleDownloadCSV = () => {
    if (activeTab === 'produtividade') {
      exportReportCSV({ type: 'produtividade', data: byProfessional });
    } else if (activeTab === 'cobertura') {
      exportReportCSV({ type: 'cobertura', data: bySector.map(([name, data]) => ({ setor: name, ...data })) });
    } else if (activeTab === 'financeiro') {
      exportReportCSV({ type: 'financeiro', data: byProfessional.map(p => ({ profissional: p.name, horas: p.hours, totalEstimado: p.estimatedPay })) });
    } else if (activeTab === 'auditoria') {
      exportReportCSV({ type: 'auditoria', data: auditLogs });
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      
      {/* HEADER EXECUTIVO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-950 to-sky-950 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sky-400">
            <BarChart3 className="w-4 h-4" /> Inteligência Executiva & Governança
          </div>
          <h1 className="text-3xl font-black tracking-tight">Central de Relatórios</h1>
          <p className="text-xs text-slate-300 max-w-xl">
            Visualize os dados analíticos na tela em tempo real e emita documentos certificados conforme a necessidade operacional.
          </p>
        </div>
      </div>

      {/* ABAS DE NAVEGAÇÃO DOS RELATÓRIOS */}
      <div className="flex items-center bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab('produtividade')}
          className={`flex-1 min-w-[150px] px-4 py-3 text-xs font-bold rounded-xl transition-all text-center whitespace-nowrap ${activeTab === 'produtividade' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          ⏱️ Produtividade & Horas
        </button>
        <button
          onClick={() => setActiveTab('cobertura')}
          className={`flex-1 min-w-[150px] px-4 py-3 text-xs font-bold rounded-xl transition-all text-center whitespace-nowrap ${activeTab === 'cobertura' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          🏥 Cobertura por Setor
        </button>
        <button
          onClick={() => setActiveTab('financeiro')}
          className={`flex-1 min-w-[150px] px-4 py-3 text-xs font-bold rounded-xl transition-all text-center whitespace-nowrap ${activeTab === 'financeiro' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          💰 Repasse Financeiro
        </button>
        <button
          onClick={() => setActiveTab('auditoria')}
          className={`flex-1 min-w-[150px] px-4 py-3 text-xs font-bold rounded-xl transition-all text-center whitespace-nowrap ${activeTab === 'auditoria' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          🛡️ Log de Auditoria
        </button>
      </div>

      {/* BARRA DE FILTROS E AÇÕES DE IMPRESSÃO */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full flex-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 hidden sm:flex">
            <Filter className="w-4 h-4 text-sky-600" /> Filtrar:
          </div>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-xs bg-slate-50 dark:bg-slate-800 w-full sm:w-auto" title="Data Inicial" />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 text-xs bg-slate-50 dark:bg-slate-800 w-full sm:w-auto" title="Data Final" />
          <Select value={String(selectedSector)} onValueChange={setSelectedSector}>
            <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800 w-full sm:w-[200px]"><SelectValue placeholder="Todos os setores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {sectors.map((s) => (
                <SelectItem key={s.id} value={String(s.name)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(startDate || endDate || selectedSector !== 'all') && (
            <Button variant="ghost" size="sm" onClick={() => { setStartDate(''); setEndDate(''); setSelectedSector('all'); }} className="text-xs text-red-500 shrink-0">
              Limpar
            </Button>
          )}
        </div>

        {/* BOTÕES DE EXPORTAÇÃO EXCLUSIVOS DA ABA ATIVA */}
        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
          <Button onClick={handleDownloadPDF} className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs h-9 px-3.5 gap-1.5 shadow-sm">
            <FileText className="w-3.5 h-3.5" /> Baixar PDF
          </Button>
          <Button onClick={handleDownloadCSV} variant="outline" className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs h-9 px-3.5 gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* PRÉ-VISUALIZAÇÃO INTERATIVA (O CONTEÚDO DA TELA) */}
      {loadingData ? (
        <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-sky-600" /></div>
      ) : (
        <div className="space-y-6">
          
          {/* ABA 1: PRÉ-VISUALIZAÇÃO DE PRODUTIVIDADE */}
          {activeTab === 'produtividade' && (
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 rounded-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-sky-600" /> Pré-visualização: Produtividade & Carga Horária
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Estes dados refletem exatamente o que será impresso no relatório oficial.</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200">
                  {byProfessional.length} registros ativos
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

          {/* ABA 2: PRÉ-VISUALIZAÇÃO DE COBERTURA */}
          {activeTab === 'cobertura' && (
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 rounded-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-sky-600" /> Pré-visualização: Cobertura Operacional por Setor
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Indicador gerencial de postos guarnecidos vs. descobertos.</p>
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

          {/* ABA 3: PRÉ-VISUALIZAÇÃO FINANCEIRA */}
          {activeTab === 'financeiro' && (
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 rounded-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-600" /> Pré-visualização: Projeção de Repasses
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Valores calculados com base nas horas trabalhadas e validadas.</p>
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

          {/* ABA 4: PRÉ-VISUALIZAÇÃO DE AUDITORIA */}
          {activeTab === 'auditoria' && (
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 rounded-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-sky-600" /> Pré-visualização: Log de Auditoria & Modificações
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Histórico rastreável de plantões cancelados ou ajustados pela gestão.</p>
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