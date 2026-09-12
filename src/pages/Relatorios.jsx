import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Clock, TrendingUp, FileText, FileSpreadsheet,
  ShieldCheck, Building2, Filter, Loader2, DollarSign, BarChart3,
  Eye, X, Leaf, Sparkles, Calendar, CheckCircle2, Copy, Printer, Search
} from 'lucide-react';
import { exportReportPDF, exportReportCSV } from '@/lib/exportReport';

function formatCurrency(value = 0) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return d && m && y ? `${d}/${m}/${y}` : dateStr;
}

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
  const [previewOpen, setPreviewOpen] = useState(false);

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
      console.error('Erro ao carregar dados:', e);
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

  // Motor de faturamento real alinhado com o módulo de Faturamento
  const byProfessional = useMemo(() => {
    const map = {};
    if (Array.isArray(professionals)) {
      professionals.forEach((p) => {
        if (!p || !p.id) return;
        const remType = p.remuneration_type || 'hora';
        let baseRate = 120;
        if (remType === 'hora') baseRate = Number(p.hourly_rate) || 120;
        else if (remType === 'diaria') baseRate = Number(p.daily_rate) || 1500;
        else if (remType === 'mensal') baseRate = Number(p.monthly_salary) || 18000;

        map[p.id] = {
          name: p.name || 'Sem Nome',
          category: p.specialty || p.category || 'Geral',
          confirmed: 0,
          pending: 0,
          canceled: 0,
          hours: 0,
          estimatedPay: 0,
          remunerationType: remType,
          hourlyRate: baseRate,
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
          remunerationType: 'hora',
          hourlyRate: 120,
        };
      }
      const profEntry = map[s.professional_id];

      if (s.status === 'confirmado') {
        profEntry.confirmed += 1;
        const dur = Number(s.duration_hours) || 12;
        profEntry.hours += dur;

        if (profEntry.remunerationType === 'diaria') {
          profEntry.estimatedPay += profEntry.hourlyRate;
        } else if (profEntry.remunerationType === 'mensal') {
          profEntry.estimatedPay = profEntry.hourlyRate;
        } else {
          profEntry.estimatedPay += dur * profEntry.hourlyRate;
        }
      }
      if (s.status === 'pendente') profEntry.pending += 1;
      if (s.status === 'cancelado') profEntry.canceled += 1;
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
    return filteredShifts.filter((s) => s && (s.status === 'cancelado' || s.notes));
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

  const filtersLabel = useMemo(() => {
    const parts = [];
    parts.push(startDate ? `de ${formatDateBR(startDate)}` : 'sem data inicial');
    parts.push(endDate ? `até ${formatDateBR(endDate)}` : 'até data final em aberto');
    parts.push(selectedSector === 'all' ? 'todos os setores' : `setor "${selectedSector}"`);
    return parts.join(' · ');
  }, [startDate, endDate, selectedSector]);

  const handleDownloadPDF = () => {
    exportReportPDF({
      company: company || { name: 'Hospital' },
      byProfessional,
      bySector,
      overview,
      auditLogs,
      totalFinancialEstimate,
      titleSuffix: `Relatório Consolidado - ${filtersLabel}`
    });
  };

  const handleDownloadCSV = () => {
    exportReportCSV({ byProfessional, bySector, overview, auditLogs });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans text-slate-900 dark:text-slate-100">
      {/* Header Executivo Adaptado para Diurno/Noturno */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-950 to-sky-950 p-6 rounded-3xl text-white shadow-xl">
        <div>
          <h1 className="text-2xl font-black">Relatórios</h1>
          <p className="text-xs text-slate-300 mt-1">Horas trabalhadas, distribuição de plantões, repasses e auditoria.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleDownloadPDF} className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs h-10 px-4 gap-2">
            <FileText className="w-4 h-4" /> Baixar PDF
          </Button>
          <Button onClick={handleDownloadCSV} variant="outline" className="border-white/20 text-white bg-white/10 hover:bg-white/20 font-bold text-xs h-10 px-4 gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Abas de Navegação */}
      <div className="flex items-center bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm gap-1 overflow-x-auto">
        <button onClick={() => setActiveTab('produtividade')} className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${activeTab === 'produtividade' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
          ⏱️ Produtividade & Horas
        </button>
        <button onClick={() => setActiveTab('cobertura')} className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${activeTab === 'cobertura' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
          🏥 Cobertura por Setor
        </button>
        <button onClick={() => setActiveTab('financeiro')} className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${activeTab === 'financeiro' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
          💰 Repasse Financeiro
        </button>
        <button onClick={() => setActiveTab('auditoria')} className={`flex-1 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${activeTab === 'auditoria' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
          🛡️ Log de Auditoria
        </button>
      </div>

      {/* Filtros Opcionais */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
          <Filter className="w-4 h-4 text-sky-600" /> Filtros:
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full flex-1">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700" placeholder="Data Inicial" />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700" placeholder="Data Final" />
          <Select value={String(selectedSector)} onValueChange={setSelectedSector}>
            <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700"><SelectValue placeholder="Todos os setores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {sectors.map((s) => (
                <SelectItem key={s.id} value={String(s.name)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(startDate || endDate || selectedSector !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setStartDate(''); setEndDate(''); setSelectedSector('all'); }} className="text-xs text-red-500 shrink-0">
            Limpar
          </Button>
        )}
      </div>

      {/* Visão Geral (KPIs) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400">Total Analisado</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{overview.total}</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-emerald-600">Confirmados</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{overview.confirmed}</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-amber-600">Pendentes</div>
          <div className="text-2xl font-black text-amber-600 mt-1">{overview.pending}</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-red-600">Vagas Abertas</div>
          <div className="text-2xl font-black text-red-600 mt-1">{overview.open}</div>
        </Card>
      </div>

      {/* Conteúdo da Aba Ativa */}
      {loadingData ? (
        <div className="flex justify-center p-16"><Loader2 className="w-8 h-8 animate-spin text-sky-600" /></div>
      ) : (
        <div className="space-y-6">
          {activeTab === 'produtividade' && (
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 rounded-2xl">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Produtividade & Horas por Profissional</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-xs">
                    <tr>
                      <th className="p-3">Profissional</th>
                      <th className="p-3">Especialidade</th>
                      <th className="p-3 text-center">Confirmados</th>
                      <th className="p-3 text-center">Pendentes</th>
                      <th className="p-3 text-right">Horas Totais</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {byProfessional.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{p.name}</td>
                        <td className="p-3 text-sky-600 font-semibold uppercase text-xs">{p.category}</td>
                        <td className="p-3 text-center font-bold text-emerald-600">{p.confirmed}</td>
                        <td className="p-3 text-center font-bold text-amber-600">{p.pending}</td>
                        <td className="p-3 text-right font-black text-slate-900 dark:text-white">{p.hours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'cobertura' && (
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 rounded-2xl">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Cobertura por Setor</h3>
              <div className="space-y-4">
                {bySector.map(([name, data]) => {
                  const pct = data.total ? Math.round((data.filled / data.total) * 100) : 0;
                  return (
                    <div key={name} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-bold text-slate-900 dark:text-white">{name}</span>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{pct}% preenchido · <span className="text-red-600 font-bold">{data.open} vagas</span></span>
                      </div>
                      <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${pct < 70 ? 'bg-red-500' : pct < 90 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {activeTab === 'financeiro' && (
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 rounded-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Projeção de Repasse & Faturamento</h3>
                <div className="text-right bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                  <div className="text-xl font-black text-emerald-600">{formatCurrency(totalFinancialEstimate)}</div>
                  <div className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">Total Global Estimado</div>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-xs">
                    <tr>
                      <th className="p-3">Profissional</th>
                      <th className="p-3 text-center">Horas Validadas</th>
                      <th className="p-3 text-right">Total a Liquidar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {byProfessional.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{p.name}</td>
                        <td className="p-3 text-center font-semibold">{p.hours}h</td>
                        <td className="p-3 text-right font-black text-emerald-600">{formatCurrency(p.estimatedPay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'auditoria' && (
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 rounded-2xl">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Log de Auditoria & Cancelamentos</h3>
              <div className="space-y-3">
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-10">Nenhum evento registrado no período.</p>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="p-4 rounded-xl border border-red-200 dark:border-red-950/60 bg-red-50/40 dark:bg-red-950/20 flex justify-between items-center gap-3 text-xs">
                      <div>
                        <div className="font-bold text-red-800 dark:text-red-200">Cancelado em {formatDateBR(log.date)} ({log.start_time} - {log.end_time})</div>
                        <div className="text-slate-600 dark:text-slate-400 mt-0.5">Profissional: <b>{log.professional_name || 'Vago'}</b> · Setor: <b>{log.sector_name}</b></div>
                        {log.notes && <div className="text-red-700 dark:text-red-300 font-mono mt-1">📝 {log.notes}</div>}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">ID: {log.id}</div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}

          {activeTab === 'executiva' && (
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 rounded-2xl">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Resumo Executivo</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Painel sintético gerencial pronto para reuniões de conselho e tomada de decisão.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-400 uppercase font-bold">Total de Turnos</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{overview.total}</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-400 uppercase font-bold">Custo Projetado</div>
                  <div className="text-2xl font-black text-emerald-600 mt-1">{formatCurrency(totalFinancialEstimate)}</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-400 uppercase font-bold">Taxa de Ocupação</div>
                  <div className="text-2xl font-black text-sky-600 mt-1">{overview.total ? Math.round((overview.confirmed / overview.total) * 100) : 0}%</div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}