import React, { useState, useMemo } from 'react';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, TrendingUp, Users, DollarSign, Building2, 
  CalendarDays, Download, FileText, ShieldAlert, CheckCircle2, 
  Activity, Clock, Award, Printer, PieChart, Layers, ArrowUpRight,
  AlertTriangle, Stethoscope, Briefcase, FileSpreadsheet, Filter, Check,
  Gauge, History, ShieldCheck, Database, Printer as PrinterIcon, Search,
  ArrowDownRight, CircleDollarSign, CalendarX, ShieldCheck as ShieldPass
} from 'lucide-react';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const STATUS_LABELS = {
  programado: 'Programado',
  confirmado: 'Confirmado',
  pendente: 'Pendente',
  concluida: 'Concluído',
  concluído: 'Concluído',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
  vago: 'Vago'
};

const STATUS_COLORS = {
  programado: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  confirmado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  pendente: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  concluida: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  realizado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  cancelado: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  vago: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
};

function safeNumber(val, fb = 0) {
  if (val === null || val === undefined || val === '') return fb;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : fb;
}

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeNumber(val));
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return clean;
}

function normalize(str) {
  return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function toTitleCase(str) {
  if (!str) return '';
  const acr = ['UTI', 'UCO', 'PA', 'PS', 'CCO'];
  return str.toLowerCase().split(' ').map(w => {
    if (acr.includes(w.toUpperCase())) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

export default function Relatorios() {
  const { shifts = [], sectors = [], professionals = [], company, units = [], selectedUnitId } = useAppData();

  const [activeTab, setActiveTab] = useState('executivo');
  const [selectedMonth, setSelectedMonth] = useState(() => String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedSector, setSelectedSector] = useState('todos');
  const [selectedStatus, setSelectedStatus] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Controle de filtro aplicado para grandes volumes hospitalares
  const [hasSearched, setHasSearched] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({
    month: String(new Date().getMonth() + 1),
    year: '2026',
    sector: 'todos',
    status: 'todos',
    search: ''
  });

  const handleApplyFilters = () => {
    setAppliedFilters({
      month: selectedMonth,
      year: selectedYear,
      sector: selectedSector,
      status: selectedStatus,
      search: searchQuery
    });
    setHasSearched(true);
  };

  function getProfMeta(prof) {
    if (!prof) return {};
    try {
      const stored = window.localStorage.getItem(`prof_meta_${prof.id}`);
      if (stored) return JSON.parse(stored);
    } catch {}
    if (prof.data && typeof prof.data === 'object') return prof.data;
    return {};
  }

  const profMap = useMemo(() => {
    const map = {};
    (professionals || []).forEach(p => {
      const meta = getProfMeta(p);
      const merged = { ...p, ...meta };
      if (p.id) map[String(p.id)] = merged;
      if (p.name) map[normalize(p.name)] = merged;
    });
    return map;
  }, [professionals]);

  const filteredShifts = useMemo(() => {
    if (!hasSearched) return [];
    const mStr = String(appliedFilters.month).padStart(2, '0');
    const yStr = appliedFilters.year;
    const term = normalize(appliedFilters.search);

    return (shifts || []).filter(s => {
      if (!s || normalize(s.status) === 'cancelado') return false;

      const secName = (s.sector_name || sectors.find(sec => String(sec.id) === String(s.sector_id))?.name || '').trim();
      if (!secName || secName.toLowerCase() === 'setor' || secName === '') return false;

      if (appliedFilters.sector !== 'todos' && String(s.sector_id) !== String(appliedFilters.sector)) return false;
      if (appliedFilters.status !== 'todos' && normalize(s.status) !== normalize(appliedFilters.status)) return false;

      const sDate = String(s.date || s.start_date || '');
      if (sDate) {
        if (!sDate.includes(`${yStr}-${mStr}`)) return false;
      }

      if (term) {
        const profName = normalize(s.professional_name || '');
        const sNameNorm = normalize(secName);
        if (!profName.includes(term) && !sNameNorm.includes(term)) return false;
      }

      return true;
    });
  }, [shifts, sectors, appliedFilters, hasSearched]);

  const { totalShiftsCount, filledShiftsCount, vacantShiftsCount, vacantShiftItems } = useMemo(() => {
    let total = filteredShifts.length;
    let filled = 0;
    let vacantItems = [];

    filteredShifts.forEach(s => {
      const hasProf = Boolean(s.professional_id && String(s.professional_id).trim() !== '');
      const isVagoStatus = normalize(s.status) === 'vago';
      const name = normalize(s.professional_name || '');
      const isVagoName = name.includes('vaga') || name.includes('descoberto') || name.includes('aberto') || name === '';

      if (hasProf && !isVagoStatus && !isVagoName) {
        filled++;
      } else {
        vacantItems.push(s);
      }
    });

    return { totalShiftsCount: total, filledShiftsCount: filled, vacantShiftsCount: total - filled, vacantShiftItems: vacantItems };
  }, [filteredShifts]);

  const coverageRate = totalShiftsCount > 0 ? Math.round((filledShiftsCount / totalShiftsCount) * 100) : 100;

  const financialSummary = useMemo(() => {
    let totalCost = 0;
    let executedCost = 0;
    let pendingCost = 0;
    let vacantCost = 0;
    let totalHours = 0;

    filteredShifts.forEach(s => {
      const hours = Number(s.duration_hours) || 12;
      totalHours += hours;

      const prof = profMap[String(s.professional_id)] || profMap[normalize(s.professional_name)];
      let cost = 0;

      if (prof) {
        const type = normalize(prof.remuneration_type || 'mensal');
        if (type === 'hora' || type === 'hourly') {
          cost = hours * safeNumber(prof.hourly_rate, 120);
        } else if (type === 'diaria' || type === 'daily') {
          cost = safeNumber(prof.daily_rate, 1500);
        } else {
          cost = safeNumber(prof.monthly_salary, 1672) / 20;
        }
      } else if (s.professional_id && normalize(s.status) !== 'vago') {
        cost = 1672 / 20;
      }

      if (vacantShiftItems.includes(s)) {
        vacantCost += cost;
      } else {
        totalCost += cost;
        const st = normalize(s.status);
        if (st === 'concluida' || st === 'concluído' || st === 'realizado') {
          executedCost += cost;
        } else {
          pendingCost += cost;
        }
      }
    });

    return { totalCost, executedCost, pendingCost, vacantCost, totalHours };
  }, [filteredShifts, profMap, vacantShiftItems]);

  const sectorMetrics = useMemo(() => {
    const map = {};
    (sectors || []).forEach(sec => {
      const sName = (sec.name || '').trim();
      if (!sName || sName.toLowerCase() === 'setor') return;
      map[sec.id] = { id: sec.id, name: toTitleCase(sName), total: 0, filled: 0, vacant: 0, hours: 0, cost: 0 };
    });

    filteredShifts.forEach(s => {
      const secName = (s.sector_name || sectors.find(sec => String(sec.id) === String(s.sector_id))?.name || '').trim();
      if (!secName || secName.toLowerCase() === 'setor') return;

      const secId = s.sector_id || secName;
      if (!map[secId]) {
        map[secId] = { id: secId, name: toTitleCase(secName), total: 0, filled: 0, vacant: 0, hours: 0, cost: 0 };
      }

      const item = map[secId];
      item.total += 1;
      const hours = Number(s.duration_hours) || 12;
      item.hours += hours;

      const hasProf = Boolean(s.professional_id && String(s.professional_id).trim() !== '');
      const isVagoStatus = normalize(s.status) === 'vago';
      const name = normalize(s.professional_name || '');
      const isVagoName = name.includes('vaga') || name.includes('descoberto') || name === '';

      if (hasProf && !isVagoStatus && !isVagoName) {
        item.filled += 1;
      } else {
        item.vacant += 1;
      }

      const prof = profMap[String(s.professional_id)] || profMap[normalize(s.professional_name)];
      if (prof) {
        const type = normalize(prof.remuneration_type || 'mensal');
        if (type === 'hora') item.cost += hours * safeNumber(prof.hourly_rate, 120);
        else if (type === 'diaria') item.cost += safeNumber(prof.daily_rate, 1500);
        else item.cost += safeNumber(prof.monthly_salary, 1672) / 20;
      }
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [sectors, filteredShifts, profMap]);

  const professionalMetrics = useMemo(() => {
    const map = {};
    filteredShifts.forEach(s => {
      const profName = s.professional_name;
      if (!profName) return;
      const normName = normalize(profName);
      if (normName.includes('vaga') || normName.includes('descoberto') || normName === '') return;

      const key = String(s.professional_id || normName);
      if (!map[key]) {
        map[key] = {
          name: toTitleCase(profName),
          shifts: 0,
          hours: 0,
          sectors: new Set(),
          cost: 0
        };
      }

      const item = map[key];
      item.shifts += 1;
      const hours = Number(s.duration_hours) || 12;
      item.hours += hours;

      const secName = s.sector_name || sectors.find(sec => String(sec.id) === String(s.sector_id))?.name || 'Geral';
      item.sectors.add(toTitleCase(secName));

      const prof = profMap[String(s.professional_id)] || profMap[normName];
      if (prof) {
        const type = normalize(prof.remuneration_type || 'mensal');
        if (type === 'hora') item.cost += hours * safeNumber(prof.hourly_rate, 120);
        else if (type === 'diaria') item.cost += safeNumber(prof.daily_rate, 1500);
        else item.cost += safeNumber(prof.monthly_salary, 1672) / 20;
      }
    });

    return Object.values(map).map(item => ({
      ...item,
      sectors: Array.from(item.sectors).join(', ')
    })).sort((a, b) => b.shifts - a.shifts);
  }, [filteredShifts, sectors, profMap]);

  const credentialAudit = useMemo(() => {
    let valid = 0;
    let expired = 0;
    let nearExpiry = 0;
    let missing = 0;
    const todayMs = new Date().setHours(0,0,0,0);

    (professionals || []).forEach(p => {
      const meta = getProfMeta(p);
      const expiry = p.document_expiry || meta.document_expiry || '';
      if (!expiry) {
        missing++;
        return;
      }
      const [exY, exM, exD] = expiry.split('-').map(Number);
      const expiryMs = new Date(exY, exM - 1, exD).getTime();
      const diffDays = Math.round((expiryMs - todayMs) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) expired++;
      else if (diffDays <= 30) nearExpiry++;
      else valid++;
    });

    return { valid, expired, nearExpiry, missing, total: (professionals || []).length };
  }, [professionals]);

  const handleExportCSV = (rows, filename) => {
    if (!rows.length) {
      alert('Nenhum dado para exportar com os filtros atuais. Aplique os filtros primeiro.');
      return;
    }
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(';'),
      ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!hasSearched) {
      alert('Por favor, aplique os filtros antes de gerar o relatório em PDF.');
      return;
    }
    window.print();
  };

  const periodLabel = `${MONTH_NAMES[Number(appliedFilters.month) - 1]} ${appliedFilters.year}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6 font-sans print:bg-white print:text-slate-900 print:p-0">
      
      {/* HEADER EXECUTIVO ESTILO CCO PREMIUM */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 md:p-8 text-white shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 print:hidden">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" /> Meditech Hospital Admin Portal • Intelligence CCO
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            Central de Inteligência Hospitalar & Relatórios Executivos
          </h1>
          <p className="text-xs text-slate-400 font-medium max-w-2xl">
            Ambiente corporativo de auditoria, escalas, telemetria financeira e conformidade do corpo clínico.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button 
            onClick={() => handleExportCSV(filteredShifts.map(s => ({
              Data: formatDate(s.date),
              Setor: s.sector_name || 'Setor',
              Profissional: s.professional_name || 'Vago',
              Inicio: s.start_time || '',
              Fim: s.end_time || '',
              Status: s.status || 'Ativo'
            })), `dossie_executivo_${appliedFilters.month}_${appliedFilters.year}.csv`)}
            variant="outline"
            disabled={!hasSearched}
            className="h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 rounded-2xl border-slate-700 gap-2 cursor-pointer disabled:opacity-50 shadow-md"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Exportar Excel (.csv)
          </Button>

          <Button 
            onClick={handlePrint}
            disabled={!hasSearched}
            className="h-11 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs px-6 rounded-2xl shadow-lg gap-2 cursor-pointer transition-all hover:scale-105 disabled:opacity-50"
          >
            <PrinterIcon className="w-4 h-4" /> Imprimir Dossiê Executivo (PDF)
          </Button>
        </div>
      </div>

      {/* CABEÇALHO PARA IMPRESSÃO (PDF) */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-6 mb-6 space-y-1">
        <h1 className="text-2xl font-black uppercase text-slate-900">{company?.name || 'Hospital Santa Clara'}</h1>
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Diretoria Médica & Gestão de Escalas - Dossiê Executivo Oficial</p>
        <div className="flex justify-between text-xs text-slate-500 pt-2">
          <span><b>Período:</b> {periodLabel}</span>
          <span><b>Emissão:</b> {new Date().toLocaleDateString('pt-BR')}</span>
        </div>
      </div>

      {/* PAINEL DE FILTROS ROBUSTO */}
      <Card className="p-5 rounded-3xl border border-slate-800 bg-slate-900 shadow-xl space-y-4 print:hidden">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyan-400" /> Parâmetros de Consulta Analítica
          </span>
          <span className="text-[11px] text-amber-400 font-bold bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
            ⚠️ Aplique os filtros para renderizar os dados
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-slate-400">Mês de Referência</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-11 text-xs font-bold bg-slate-950 border-slate-800 text-white rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white z-[99999]">
                {MONTH_NAMES.map((name, idx) => (
                  <SelectItem key={idx + 1} value={String(idx + 1)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-slate-400">Ano</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="h-11 text-xs font-bold bg-slate-950 border-slate-800 text-white rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white z-[99999]">
                {['2025', '2026', '2027', '2028'].map(yr => (
                  <SelectItem key={yr} value={yr}>{yr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-slate-400">Setor Hospitalar</Label>
            <Select value={selectedSector} onValueChange={setSelectedSector}>
              <SelectTrigger className="h-11 text-xs font-bold bg-slate-950 border-slate-800 text-white rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white z-[99999]">
                <SelectItem value="todos">🏥 Todos os Setores (Consolidado)</SelectItem>
                {(sectors || []).map(s => {
                  const sName = (s.name || '').trim();
                  if (!sName || sName.toLowerCase() === 'setor') return null;
                  return <SelectItem key={s.id} value={String(s.id)}>{sName}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-black uppercase text-slate-400">Busca por Nome ou Setor</Label>
            <Input 
              placeholder="Digite o nome..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-11 text-xs bg-slate-950 border-slate-800 text-white rounded-2xl"
            />
          </div>

          <div>
            <Button 
              onClick={handleApplyFilters}
              className="w-full h-11 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs rounded-2xl shadow-lg gap-2 cursor-pointer transition-all"
            >
              <Check className="w-4 h-4" /> Aplicar Filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* ESTADO INICIAL: AGUARDANDO FILTRO */}
      {!hasSearched ? (
        <Card className="p-20 rounded-3xl border border-dashed border-slate-800 bg-slate-900/60 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/30">
            <Filter className="w-8 h-8 animate-pulse" />
          </div>
          <h3 className="text-lg font-black text-white">Central de Inteligência Pronta para Análise</h3>
          <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            Para garantir alta performance e evitar carregamento excessivo de dados, configure os parâmetros de período e setor acima e clique em <b>"Aplicar Filtros"</b>.
          </p>
        </Card>
      ) : (
        <>
          {/* ABAS ESTILO DASHBOARD PROFISSIONAL */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 print:hidden">
            {[
              { id: 'executivo', label: 'Visão Executiva & KPIs', icon: BarChart3 },
              { id: 'escalas', label: 'Escalas & Plantões', icon: CalendarDays },
              { id: 'profissionais', label: 'Produtividade Clínica', icon: Users },
              { id: 'financeiro', label: 'Inteligência Financeira', icon: DollarSign },
              { id: 'governanca', label: 'Governança & CRM', icon: ShieldCheck },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-3.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2.5 shrink-0 border ${
                    isActive 
                      ? 'bg-cyan-600 text-white border-cyan-500 shadow-lg shadow-cyan-950/50' 
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                  }`}
                >
                  <Icon className="w-4 h-4" /> {tab.label}
                </button>
              );
            })}
          </div>

          {/* CONTEÚDO DAS ABAS */}
          <div className="space-y-6 print:block">
            
            {/* 1. EXECUTIVO */}
            {(activeTab === 'executivo' || true) && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-2">
                  <Card className="p-5 rounded-3xl border border-slate-800 bg-slate-900 shadow-xl space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Volume de Plantões</span>
                    <div className="text-3xl font-black text-white font-mono">{totalShiftsCount}</div>
                    <p className="text-[11px] text-emerald-400 font-semibold">
                      <b>{filledShiftsCount}</b> preenchidos · <span className={vacantShiftsCount > 0 ? "text-rose-400 font-bold" : ""}><b>{vacantShiftsCount}</b> vagos</span>
                    </p>
                  </Card>

                  <Card className="p-5 rounded-3xl border border-slate-800 bg-slate-900 shadow-xl space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Taxa de Cobertura Global</span>
                    <div className="text-3xl font-black text-emerald-400 font-mono">{coverageRate}%</div>
                    <p className="text-[11px] text-slate-400 font-medium">Meta hospitalar: &gt; 98%</p>
                  </Card>

                  <Card className="p-5 rounded-3xl border border-slate-800 bg-slate-900 shadow-xl space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Custo Orçamentário Total</span>
                    <div className="text-3xl font-black text-white font-mono">{formatCurrency(financialSummary.totalCost)}</div>
                    <p className="text-[11px] text-slate-400 font-medium">Honorários estimados ({financialSummary.totalHours}h)</p>
                  </Card>

                  <Card className="p-5 rounded-3xl border border-slate-800 bg-slate-900 shadow-xl space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Compliance de Credenciais</span>
                    <div className="text-3xl font-black text-cyan-400 font-mono">
                      {Math.round(((credentialAudit.valid + credentialAudit.nearExpiry) / Math.max(1, credentialAudit.total)) * 100)}%
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">
                      <b>{credentialAudit.expired}</b> vencido(s) · <b>{credentialAudit.nearExpiry}</b> próximos
                    </p>
                  </Card>
                </div>

                {/* DESEMPENHO POR SETOR */}
                <Card className="p-6 rounded-3xl border border-slate-800 bg-slate-900 shadow-xl space-y-5 print:break-inside-avoid">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="font-black text-base text-white flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-cyan-400" /> Desempenho Operacional por Setor ({periodLabel})
                      </h3>
                      <p className="text-xs text-slate-400">Volume de turnos, cobertura e custos segregados por unidade</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2">
                    {sectorMetrics.map((sec, idx) => {
                      const pct = sec.total > 0 ? Math.round((sec.filled / sec.total) * 100) : 100;
                      return (
                        <div key={idx} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 shadow-md">
                          <div className="flex items-center justify-between">
                            <strong className="text-sm font-black text-white truncate">{sec.name}</strong>
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                              pct >= 90 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}>
                              {pct}% Cobertura
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                            <span>Alocados: <b className="text-white">{sec.filled}</b></span>
                            <span>Vagos: <b className={sec.vacant > 0 ? 'text-rose-400 font-black' : 'text-white'}>{sec.vacant}</b></span>
                            <span>Custo: <b className="font-mono text-emerald-400">{formatCurrency(sec.cost)}</b></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}

            {/* 2. ESCALAS */}
            {(activeTab === 'escalas' || true) && (
              <Card className="p-6 rounded-3xl border border-slate-800 bg-slate-900 shadow-xl space-y-4 print:break-inside-avoid print:mt-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-black text-base text-white flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-cyan-400" /> Relatório Detalhado de Escalas & Turnos ({filteredShifts.length} registros)
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        <th className="py-3 px-3">Data</th>
                        <th className="py-3 px-3">Setor</th>
                        <th className="py-3 px-3">Profissional Alocado</th>
                        <th className="py-3 px-3">Horário</th>
                        <th className="py-3 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-medium">
                      {filteredShifts.slice(0, 50).map((s, idx) => {
                        const isVago = !s.professional_id || normalize(s.status) === 'vago' || (s.professional_name || '').toLowerCase().includes('vaga');
                        return (
                          <tr key={s.id || idx} className="hover:bg-slate-950 transition-colors">
                            <td className="py-3 px-3 font-bold font-mono text-slate-300">{formatDate(s.date)}</td>
                            <td className="py-3 px-3 text-slate-300">{s.sector_name || 'Setor Geral'}</td>
                            <td className={`py-3 px-3 font-black ${isVago ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
                              {isVago ? '⚠️ VAGA EM ABERTO' : toTitleCase(s.professional_name)}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-400">{s.start_time || '07:00'} - {s.end_time || '19:00'}</td>
                            <td className="py-3 px-3">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${isVago ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
                                {isVago ? 'Vago' : (s.status || 'Confirmado')}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* 3. PROFISSIONAIS */}
            {(activeTab === 'profissionais' || true) && (
              <Card className="p-6 rounded-3xl border border-slate-800 bg-slate-900 shadow-xl space-y-4 print:break-inside-avoid print:mt-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-black text-base text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-400" /> Produtividade & Carga Horária do Corpo Clínico
                  </h3>
                  <span className="text-xs font-mono text-slate-400">{professionalMetrics.length} médicos atuantes</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        <th className="py-3 px-3">Profissional</th>
                        <th className="py-3 px-3">Setores de Atuação</th>
                        <th className="py-3 px-3 text-center">Plantões</th>
                        <th className="py-3 px-3 text-right">Carga Horária</th>
                        <th className="py-3 px-3 text-right">Custo Estimado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-medium">
                      {professionalMetrics.map((doc, idx) => (
                        <tr key={idx} className="hover:bg-slate-950 transition-colors">
                          <td className="py-3 px-3 font-bold text-white flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-xl bg-cyan-500/20 text-cyan-400 font-black flex items-center justify-center text-[10px] border border-cyan-500/30">
                              {doc.name.substring(0,2).toUpperCase()}
                            </div>
                            {doc.name}
                          </td>
                          <td className="py-3 px-3 text-slate-400">{doc.sectors}</td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-white">{doc.shifts}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">{doc.hours}h</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-white">{formatCurrency(doc.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* 4. FINANCEIRO */}
            {(activeTab === 'financeiro' || true) && (
              <Card className="p-6 rounded-3xl border border-slate-800 bg-slate-900 shadow-xl space-y-4 print:break-inside-avoid print:mt-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-black text-base text-white flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-amber-400" /> Inteligência Financeira & Custos Assistenciais
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 shadow-md">
                    <span className="text-[10px] font-black uppercase text-emerald-400">Custo Realizado</span>
                    <div className="text-2xl font-black font-mono text-emerald-300 mt-1">{formatCurrency(financialSummary.executedCost)}</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-500/30 shadow-md">
                    <span className="text-[10px] font-black uppercase text-amber-400">Custo Pendente</span>
                    <div className="text-2xl font-black font-mono text-amber-300 mt-1">{formatCurrency(financialSummary.pendingCost)}</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-rose-950/30 border border-rose-500/30 shadow-md">
                    <span className="text-[10px] font-black uppercase text-rose-400">Custo Potencial de Vagas</span>
                    <div className="text-2xl font-black font-mono text-rose-300 mt-1">{formatCurrency(financialSummary.vacantCost)}</div>
                  </div>
                </div>
              </Card>
            )}

            {/* 5. GOVERNANÇA */}
            {(activeTab === 'governanca' || true) && (
              <Card className="p-6 rounded-3xl border border-slate-800 bg-slate-900 shadow-xl space-y-4 print:break-inside-avoid print:mt-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-black text-base text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" /> Governança de Credenciais & CRM
                  </h3>
                  <span className="text-xs font-mono text-slate-400">{credentialAudit.total} profissionais cadastrados</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30">
                    <div className="flex items-center gap-3">
                      <div className="w-3.5 h-3.5 rounded-full bg-emerald-400" />
                      <span className="text-xs font-bold text-emerald-200">Documentos Válidos</span>
                    </div>
                    <strong className="font-mono text-emerald-300 text-sm">{credentialAudit.valid}</strong>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30">
                    <div className="flex items-center gap-3">
                      <div className="w-3.5 h-3.5 rounded-full bg-amber-400" />
                      <span className="text-xs font-bold text-amber-200">Vencem em até 30 dias</span>
                    </div>
                    <strong className="font-mono text-amber-300 text-sm">{credentialAudit.nearExpiry}</strong>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30">
                    <div className="flex items-center gap-3">
                      <div className="w-3.5 h-3.5 rounded-full bg-rose-400 animate-pulse" />
                      <span className="text-xs font-bold text-rose-200">Credenciais Vencidas</span>
                    </div>
                    <strong className="font-mono text-rose-300 text-sm font-black">{credentialAudit.expired}</strong>
                  </div>
                </div>
              </Card>
            )}

          </div>
        </>
      )}

    </div>
  );
}

function getSectorName(shift, sectors) {
  if (shift.sector_name) return toTitleCase(shift.sector_name);
  const sec = sectors.find(s => String(s.id) === String(shift.sector_id));
  return toTitleCase(sec?.name || 'Setor Geral');
}