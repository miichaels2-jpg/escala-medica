import React, { useState, useMemo, useCallback } from 'react';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3, Users, DollarSign, Building2,
  CalendarDays, ShieldAlert, CheckCircle2,
  Activity, Clock, Printer as PrinterIcon, ArrowUpRight,
  AlertTriangle, Stethoscope, FileSpreadsheet,
  Filter, Check, Target, ShieldCheck
} from 'lucide-react';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const STATUS_LABELS = {
  programado: 'Programado',
  confirmado: 'Confirmado',
  pendente: 'Pendente',
  concluida: 'Concluído',
  concluído: 'Concluído',
  realizado: 'Realizado',
  em_andamento: 'Em andamento',
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
  vago: 'bg-rose-500/10 text-rose-400 border-rose-500/30 font-black animate-pulse'
};

function safeNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = typeof value === 'number' ? value : parseFloat(String(value).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(number) ? number : fallback;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeNumber(value));
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(safeNumber(value));
}

function formatDate(value) {
  if (!value) return '—';
  const clean = String(value).split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return clean;
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function titleCase(str) {
  if (!str) return '';
  const acr = ['UTI', 'UCO', 'PA', 'PS', 'CCO'];
  return str.toLowerCase().split(' ').map(w => {
    if (acr.includes(w.toUpperCase())) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

function getShiftName(shift) {
  return shift.professional_name || shift.professional?.name || shift.professionalName || '';
}

function getSectorName(shift, sectors) {
  if (shift.sector_name && normalize(shift.sector_name) !== 'setor geral' && normalize(shift.sector_name) !== 'setor') return shift.sector_name;
  const sector = sectors.find(item => String(item.id) === String(shift.sector_id));
  return sector?.name || 'Setor Não Informado';
}

function isVacant(shift) {
  const name = normalize(getShiftName(shift));
  const hasProfId = Boolean(shift.professional_id);
  const hasName = Boolean(name);

  // Se o status explicita "vago" ou o nome tem palavras-chave de vaga
  if (normalize(shift.status) === 'vago') return true;
  if (name.includes('vaga') || name.includes('descoberto') || name.includes('aberto') || name === 'plantao sem profissional') return true;

  // Se ID e Nome estiverem ausentes simultaneamente
  if (!hasProfId && !hasName) return true;

  // Caso tenha nome (ex: "Medico Teste") mas sem ID gravado, NÃO é vaga.
  return false;
}

function getShiftHours(shift) {
  const explicit = safeNumber(shift.duration_hours ?? shift.hours ?? shift.total_hours, 0);
  if (explicit > 0) return explicit;

  if (shift.start_time && shift.end_time) {
    const [startH, startM] = String(shift.start_time).split(':').map(Number);
    const [endH, endM] = String(shift.end_time).split(':').map(Number);
    if (Number.isFinite(startH) && Number.isFinite(startM) && Number.isFinite(endH) && Number.isFinite(endM)) {
      let start = startH * 60 + startM;
      let end = endH * 60 + endM;
      if (end <= start) end += 24 * 60;
      return (end - start) / 60;
    }
  }
  return 12;
}

function getProfessionalMeta(professional) {
  if (!professional) return {};
  const sources = [professional, professional.data, professional.metadata];
  return Object.assign({}, ...sources.filter(source => source && typeof source === 'object' && !Array.isArray(source)));
}

function getProfessionalCost(professional, hours) {
  if (!professional) return 0;
  const meta = getProfessionalMeta(professional);
  const type = normalize(meta.remuneration_type || meta.remunerationType || meta.payment_type || 'mensal');

  if (type === 'hora' || type === 'hourly') {
    return hours * safeNumber(meta.hourly_rate ?? meta.hourlyRate ?? meta.valor_hora, 0);
  }
  if (type === 'diaria' || type === 'daily' || type === 'plantao') {
    return safeNumber(meta.daily_rate ?? meta.dailyRate ?? meta.valor_plantao, 0);
  }
  return safeNumber(meta.monthly_salary ?? meta.monthlySalary ?? meta.salary ?? meta.salario, 0) / 20;
}

function StatusBadge({ status }) {
  const key = normalize(status);
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border ${STATUS_COLORS[key] || 'bg-slate-800 text-slate-300 border-slate-700'}`}>
      {STATUS_LABELS[key] || status || 'Sem status'}
    </span>
  );
}

export default function Relatorios() {
  const { shifts = [], sectors = [], professionals = [], company, selectedUnitId, units = [] } = useAppData();

  const [activeTab, setActiveTab] = useState('executivo');
  const [selectedMonth, setSelectedMonth] = useState(() => String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [selectedSector, setSelectedSector] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');

  const [hasSearched, setHasSearched] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
    sector: 'todos',
    search: ''
  });

  const handleApplyFilters = () => {
    setAppliedFilters({
      month: selectedMonth,
      year: selectedYear,
      sector: selectedSector,
      search: searchQuery
    });
    setHasSearched(true);
  };

  const profMap = useMemo(() => {
    const map = {};
    professionals.forEach(p => {
      const meta = getProfessionalMeta(p);
      const merged = { ...p, ...meta };
      if (p.id) map[String(p.id)] = merged;
      if (p.name) map[normalize(p.name)] = merged;
    });
    return map;
  }, [professionals]);

  const getProf = useCallback(shift => {
    return profMap[String(shift.professional_id)] || profMap[normalize(getShiftName(shift))];
  }, [profMap]);

  const filteredShifts = useMemo(() => {
    if (!hasSearched) return [];
    
    const mStr = String(appliedFilters.month).padStart(2, '0');
    const yStr = appliedFilters.year;
    const term = normalize(appliedFilters.search);

    return shifts.filter(shift => {
      if (!shift) return false;
      if (normalize(shift.status) === 'cancelado') return false;

      // Limpeza de lixo e orfãos
      const rawSecName = getSectorName(shift, sectors);
      const secName = normalize(rawSecName);
      if (!secName || secName === 'setor' || secName.includes('setor geral')) return false;

      if (appliedFilters.sector !== 'todos' && String(shift.sector_id) !== String(appliedFilters.sector)) return false;

      const shiftDate = String(shift.date || shift.start_date || shift.data || '').slice(0, 10);
      if (shiftDate) {
        if (!shiftDate.includes(`${yStr}-${mStr}`)) return false;
      }

      if (term) {
        const profName = normalize(getShiftName(shift));
        if (!profName.includes(term) && !secName.includes(term)) return false;
      }

      return true;
    });
  }, [shifts, sectors, appliedFilters, hasSearched]);

  const { totalShiftsCount, filledShiftsCount, vacantShiftsCount, vacantShiftItems } = useMemo(() => {
    let filled = 0;
    let vacantItems = [];

    filteredShifts.forEach(s => {
      if (!isVacant(s)) {
        filled++;
      } else {
        vacantItems.push(s);
      }
    });

    return { 
      totalShiftsCount: filteredShifts.length, 
      filledShiftsCount: filled, 
      vacantShiftsCount: filteredShifts.length - filled, 
      vacantShiftItems: vacantItems 
    };
  }, [filteredShifts]);

  const coverageRate = totalShiftsCount > 0 ? Math.round((filledShiftsCount / totalShiftsCount) * 100) : 100;

  const financialSummary = useMemo(() => {
    let totalCost = 0, executedCost = 0, pendingCost = 0, vacantCost = 0, totalHours = 0;

    filteredShifts.forEach(shift => {
      const hours = getShiftHours(shift);
      totalHours += hours;
      const professional = getProf(shift);
      
      const cost = safeNumber(shift.total_cost ?? shift.cost ?? shift.valor_total, 0) || getProfessionalCost(professional, hours);

      if (isVacant(shift)) {
        vacantCost += cost;
      } else {
        totalCost += cost;
        const status = normalize(shift.status);
        if (status === 'concluida' || status === 'concluido' || status === 'realizado') {
          executedCost += cost;
        } else {
          pendingCost += cost;
        }
      }
    });

    return { totalCost, executedCost, pendingCost, vacantCost, hours: totalHours };
  }, [filteredShifts, getProf]);

  const sectorMetrics = useMemo(() => {
    const map = {};
    sectors.forEach(sector => {
      const n = normalize(sector.name);
      if (n && n !== 'setor' && !n.includes('setor geral')) {
        map[String(sector.id)] = { id: sector.id, name: titleCase(sector.name), total: 0, filled: 0, vacant: 0, hours: 0, cost: 0 };
      }
    });

    filteredShifts.forEach(shift => {
      const id = String(shift.sector_id || 'unmapped');
      const sName = getSectorName(shift, sectors);
      
      if (!map[id]) {
        map[id] = { id, name: titleCase(sName), total: 0, filled: 0, vacant: 0, hours: 0, cost: 0 };
      }
      
      const item = map[id];
      item.total += 1;
      item.hours += getShiftHours(shift);
      
      if (isVacant(shift)) item.vacant += 1;
      else item.filled += 1;
      
      item.cost += getProfessionalCost(getProf(shift), getShiftHours(shift));
    });

    return Object.values(map).filter(item => item.total > 0).sort((a, b) => b.total - a.total);
  }, [sectors, filteredShifts, getProf]);

  const professionalMetrics = useMemo(() => {
    const map = {};
    filteredShifts.forEach(shift => {
      if (isVacant(shift)) return;
      
      const name = getShiftName(shift);
      const key = String(shift.professional_id || normalize(name));
      
      if (!map[key]) {
        map[key] = { id: shift.professional_id || key, name: titleCase(name), shifts: 0, hours: 0, sectors: new Set(), cost: 0 };
      }
      
      const item = map[key];
      item.shifts += 1;
      item.hours += getShiftHours(shift);
      
      const sName = getSectorName(shift, sectors);
      if (sName) item.sectors.add(titleCase(sName));
      
      item.cost += getProfessionalCost(getProf(shift), getShiftHours(shift));
    });

    return Object.values(map).map(item => ({ ...item, sectors: Array.from(item.sectors).join(', ') })).sort((a, b) => b.shifts - a.shifts);
  }, [filteredShifts, sectors, getProf]);

  const credentialAudit = useMemo(() => {
    let valid = 0, expired = 0, nearExpiry = 0, missing = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    professionals.forEach(professional => {
      const meta = getProfessionalMeta(professional);
      const expiry = meta.document_expiry || meta.documentExpiry || meta.valid_until || '';
      
      if (!expiry) { missing += 1; return; }
      const expiryDate = new Date(expiry);
      if (Number.isNaN(expiryDate.getTime())) { missing += 1; return; }
      
      expiryDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) expired += 1;
      else if (diffDays <= 30) nearExpiry += 1;
      else valid += 1;
    });

    return { valid, expired, nearExpiry, missing, total: professionals.length };
  }, [professionals]);

  const periodLabel = `${MONTH_NAMES[Number(appliedFilters.month) - 1]} ${appliedFilters.year}`;

  // GERADOR DE EXCEL NATIVO (HTML TABLE HACK .xls) COM ESTILIZAÇÃO
  const handleExportXLS = () => {
    if (!hasSearched) {
      alert('Atenção: Aplique os filtros antes de exportar a planilha.');
      return;
    }
    
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
      <meta charset="utf-8">
      <style>
        table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 12px; }
        th { background-color: #0891b2; color: #ffffff; font-weight: bold; padding: 10px; border: 1px solid #cbd5e1; text-align: left; }
        td { padding: 8px; border: 1px solid #cbd5e1; vertical-align: middle; }
        .vago { color: #be123c; font-weight: bold; background-color: #ffe4e6; }
        .title { font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #0f172a; }
      </style>
      </head>
      <body>
        <div class="title">Dossiê Executivo de Escalas e Plantões - ${periodLabel}</div>
        <table>
          <thead>
            <tr>
              <th>Data do Plantão</th>
              <th>Setor de Atuação</th>
              <th>Profissional Alocado</th>
              <th>Horário</th>
              <th>Status Operacional</th>
              <th>Carga Horária</th>
              <th>Custo Estimado (R$)</th>
            </tr>
          </thead>
          <tbody>
    `;

    filteredShifts.forEach(s => {
      const isVago = isVacant(s);
      const profName = isVago ? 'VAGA EM ABERTO (ALERTA)' : titleCase(s.professional_name);
      const rowClass = isVago ? 'class="vago"' : '';
      const cost = getProfessionalCost(getProf(s), getShiftHours(s));
      
      html += `
        <tr ${rowClass}>
          <td>${formatDate(s.date)}</td>
          <td>${getSectorName(s, sectors)}</td>
          <td>${profName}</td>
          <td>${s.start_time || ''} às ${s.end_time || ''}</td>
          <td>${isVago ? 'Vago / Pendente' : (s.status || 'Ativo')}</td>
          <td>${getShiftHours(s)}h</td>
          <td>${cost.toFixed(2).replace('.', ',')}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Relatorio_Escalas_${appliedFilters.month}_${appliedFilters.year}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!hasSearched) {
      alert('Atenção: Aplique os filtros para renderizar a telemetria antes de gerar o PDF.');
      return;
    }
    window.print();
  };

  return (
    <>
      {/* ========================================== */}
      {/* MODO TELA (DARK THEME / APP)                 */}
      {/* ========================================== */}
      <div className="min-h-screen bg-[#0B1120] text-slate-100 p-4 md:p-8 space-y-6 font-sans print:hidden">
        
        {/* TOPO EXECUTIVO PREMIUM MEDITECH */}
        <div className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 md:p-8 text-white shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
              <Activity className="w-4 h-4 text-cyan-400 animate-pulse" /> {company?.name || 'Meditech Hospital Admin'} • Intelligence CCO
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Central de Inteligência Hospitalar & BI
            </h1>
            <p className="text-xs text-slate-400 font-medium max-w-2xl">
              Ambiente corporativo de auditoria de escalas, telemetria financeira e conformidade assistencial.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <Button 
              onClick={handleExportXLS}
              variant="outline" disabled={!hasSearched}
              className="w-full sm:w-auto h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 rounded-2xl border-slate-700 gap-2 cursor-pointer disabled:opacity-50 shadow-md"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Exportar Planilha (.xls)
            </Button>

            <Button 
              onClick={handlePrint} disabled={!hasSearched}
              className="w-full sm:w-auto h-11 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs px-6 rounded-2xl shadow-lg gap-2 cursor-pointer transition-all hover:scale-105 disabled:opacity-50 border border-cyan-500"
            >
              <PrinterIcon className="w-4 h-4" /> Imprimir Dossiê (PDF)
            </Button>
          </div>
        </div>

        {/* PAINEL DE FILTROS ROBUSTO */}
        <Card className="p-5 rounded-3xl border border-slate-800 bg-[#1e293b] shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/50 pb-3">
            <span className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Filter className="w-4 h-4 text-cyan-400" /> Parâmetros Analíticos
            </span>
            <span className="text-[11px] text-amber-400 font-bold bg-amber-500/10 px-3 py-1 rounded-md border border-amber-500/30">
              ⚠️ Aplique os filtros para renderizar a telemetria
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Mês Ref.</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-11 text-xs font-bold bg-[#0B1120] border-slate-700 text-white rounded-xl focus:ring-cyan-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white z-[99999]">
                  {MONTH_NAMES.map((name, idx) => (<SelectItem key={idx + 1} value={String(idx + 1)}>{name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Ano</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="h-11 text-xs font-bold bg-[#0B1120] border-slate-700 text-white rounded-xl focus:ring-cyan-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white z-[99999]">
                  {['2025', '2026', '2027', '2028'].map(yr => (<SelectItem key={yr} value={yr}>{yr}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Setor Clínico</Label>
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectTrigger className="h-11 text-xs font-bold bg-[#0B1120] border-slate-700 text-white rounded-xl focus:ring-cyan-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white z-[99999] max-h-[300px]">
                  <SelectItem value="todos">🏥 Todos (Consolidado)</SelectItem>
                  {(sectors || []).map(s => {
                    const sName = (s.name || '').trim();
                    if (!sName || sName.toLowerCase() === 'setor' || sName.toLowerCase() === 'setor geral') return null;
                    return <SelectItem key={s.id} value={String(s.id)}>{sName}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Busca Específica</Label>
              <Input 
                placeholder="Ex: Nome do médico..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-11 text-xs bg-[#0B1120] border-slate-700 text-white rounded-xl focus:border-cyan-500"
              />
            </div>

            <div>
              <Button 
                onClick={handleApplyFilters}
                className="w-full h-11 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs rounded-xl shadow-lg gap-2 cursor-pointer transition-all border border-cyan-500/50"
              >
                <Check className="w-4 h-4" /> Aplicar Filtros
              </Button>
            </div>
          </div>
        </Card>

        {/* ESTADO INICIAL: AGUARDANDO FILTRO */}
        {!hasSearched ? (
          <Card className="p-16 md:p-24 rounded-3xl border border-dashed border-slate-800 bg-[#1e293b]/50 text-center space-y-4 shadow-xl">
            <div className="w-20 h-20 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/20">
              <Filter className="w-10 h-10 animate-pulse" />
            </div>
            <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">Central Pronta para Análise</h3>
            <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
              Para garantir altíssima performance no processamento da folha e cruzamento de dados, defina os parâmetros e clique em <b>Aplicar Filtros</b>.
            </p>
          </Card>
        ) : (
          <>
            {/* ABAS ESTILO MEDITECH DASHBOARD */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {[
                { id: 'executivo', label: 'Dashboard Executivo', icon: BarChart3 },
                { id: 'escalas', label: 'Escalas & Vagas', icon: CalendarDays },
                { id: 'profissionais', label: 'Produtividade Médica', icon: Users },
                { id: 'financeiro', label: 'Inteligência Financeira', icon: DollarSign },
                { id: 'governanca', label: 'Auditoria de CRM', icon: ShieldCheck },
              ].map(tab => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-6 py-4 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2.5 shrink-0 border ${
                      isActive 
                        ? 'bg-cyan-600 text-white border-cyan-500 shadow-lg shadow-cyan-900/50' 
                        : 'bg-[#1e293b] border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {tab.label}
                  </button>
                );
              })}
            </div>

            {/* CONTEÚDO DAS ABAS */}
            <div className="space-y-6">
              
              {/* 1. EXECUTIVO */}
              {activeTab === 'executivo' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-5 shadow-lg relative overflow-hidden group">
                      <div className="absolute right-0 top-0 opacity-10 group-hover:scale-110 transition-transform">
                         <Activity className="w-24 h-24 -mt-4 -mr-4 text-teal-500" />
                      </div>
                      <div className="relative">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total de Plantões</p>
                        <p className="mt-2 text-3xl font-black text-white font-mono tracking-tight">{formatNumber(totalShiftsCount)}</p>
                        <div className="mt-3 text-xs text-slate-400 font-bold flex items-center gap-2">
                          <span className="text-teal-400">{filledShiftsCount} Preenchidos</span>
                          {vacantShiftsCount > 0 && <span className="text-rose-400 px-2 py-0.5 bg-rose-500/10 rounded-full">{vacantShiftsCount} Vagos</span>}
                        </div>
                        <div className="mt-4 h-6 w-full">
                           <svg viewBox="0 0 100 20" className="w-full h-full stroke-teal-500 fill-none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                             <polyline points="0,15 20,5 40,10 60,2 80,12 100,5" />
                           </svg>
                        </div>
                      </div>
                    </Card>

                    <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-5 shadow-lg relative overflow-hidden group">
                      <div className="absolute right-0 top-0 opacity-10 group-hover:scale-110 transition-transform">
                         <Target className="w-24 h-24 -mt-4 -mr-4 text-emerald-500" />
                      </div>
                      <div className="relative">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Taxa de Cobertura</p>
                        <p className={`mt-2 text-3xl font-black font-mono tracking-tight ${coverageRate >= 98 ? 'text-emerald-400' : coverageRate >= 90 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {coverageRate}%
                        </p>
                        <div className="mt-3 text-xs text-slate-400 font-bold">Meta Hospitalar: &gt; 98%</div>
                        <div className="mt-4 h-6 w-full">
                           <svg viewBox="0 0 100 20" className="w-full h-full stroke-emerald-500 fill-none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                             <polyline points="0,18 20,15 40,8 60,5 80,2 100,0" />
                           </svg>
                        </div>
                      </div>
                    </Card>

                    <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-5 shadow-lg relative overflow-hidden group">
                      <div className="absolute right-0 top-0 opacity-10 group-hover:scale-110 transition-transform">
                         <DollarSign className="w-24 h-24 -mt-4 -mr-4 text-amber-500" />
                      </div>
                      <div className="relative">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Custo Projetado</p>
                        <p className="mt-2 text-3xl font-black text-amber-400 font-mono tracking-tight">{formatCurrency(financialSummary.totalCost)}</p>
                        <div className="mt-3 text-xs text-slate-400 font-bold">{formatNumber(financialSummary.hours)} Horas Assistenciais</div>
                        <div className="mt-4 h-6 w-full">
                           <svg viewBox="0 0 100 20" className="w-full h-full stroke-amber-500 fill-none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                             <polyline points="0,15 20,18 40,12 60,8 80,10 100,2" />
                           </svg>
                        </div>
                      </div>
                    </Card>

                    <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-5 shadow-lg relative overflow-hidden group">
                      <div className="absolute right-0 top-0 opacity-10 group-hover:scale-110 transition-transform">
                         <ShieldAlert className="w-24 h-24 -mt-4 -mr-4 text-rose-500" />
                      </div>
                      <div className="relative">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Compliance Doc</p>
                        <p className="mt-2 text-3xl font-black text-white font-mono tracking-tight">
                           {Math.round(((credentialAudit.valid + credentialAudit.nearExpiry) / Math.max(1, credentialAudit.total)) * 100)}%
                        </p>
                        <div className="mt-3 text-[10px] text-slate-400 font-bold flex flex-col gap-0.5">
                           <span className={credentialAudit.expired > 0 ? 'text-rose-400' : ''}>{credentialAudit.expired} Vencidos</span>
                           <span className="text-amber-400">{credentialAudit.nearExpiry} Vencem em 30d</span>
                        </div>
                      </div>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 shadow-lg flex flex-col items-center justify-center">
                      <h3 className="w-full text-left text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Visão Geral de Capacidade</h3>
                      <div className="relative w-48 h-48">
                        <svg viewBox="0 0 36 36" className="w-full h-full">
                          <path className="text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5" />
                          <path className={`${coverageRate === 100 ? 'text-teal-400' : 'text-teal-500'}`} strokeDasharray={`${coverageRate}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Turnos</span>
                          <span className="text-3xl font-black text-white font-mono">{totalShiftsCount}</span>
                        </div>
                      </div>
                      <div className="mt-8 w-full space-y-2">
                        <div className="flex items-center justify-between text-xs">
                           <span className="flex items-center gap-2 text-slate-300 font-bold">
                             <span className="w-3 h-3 rounded-full bg-teal-400"></span> Preenchidos:
                           </span>
                           <span className="font-mono text-white">{filledShiftsCount} ({coverageRate}%)</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                           <span className="flex items-center gap-2 text-slate-300 font-bold">
                             <span className="w-3 h-3 rounded-full bg-slate-700"></span> Vagos:
                           </span>
                           <span className="font-mono text-white">{vacantShiftsCount} ({100 - coverageRate}%)</span>
                        </div>
                      </div>
                    </Card>

                    <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 shadow-lg lg:col-span-2">
                      <div className="flex items-center justify-between border-b border-slate-700/50 pb-4">
                         <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Eficiência por Setor (Top 6)</h3>
                         <span className="text-[10px] text-cyan-400 font-bold bg-cyan-500/10 px-2 py-1 rounded-md border border-cyan-500/20">
                           {periodLabel}
                         </span>
                      </div>

                      <div className="mt-6 h-48 flex items-end justify-between gap-2 px-2">
                        {sectorMetrics.slice(0, 6).map((sec, idx) => {
                          const pct = sec.total > 0 ? Math.round((sec.filled / sec.total) * 100) : 0;
                          return (
                            <div key={idx} className="flex flex-col items-center flex-1 gap-2 group">
                               <div className="text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                 {pct}%
                               </div>
                               <div className="w-full max-w-[40px] h-32 bg-slate-800 rounded-sm relative overflow-hidden">
                                  <div 
                                    className={`absolute bottom-0 w-full rounded-sm transition-all duration-1000 ${pct >= 90 ? 'bg-teal-400' : pct >= 70 ? 'bg-amber-400' : 'bg-rose-400'}`}
                                    style={{ height: `${pct}%` }}
                                  ></div>
                               </div>
                               <div className="text-[9px] font-black uppercase text-slate-300 text-center leading-tight truncate w-full" title={sec.name}>
                                 {sec.name.split(' ')[0]}
                               </div>
                            </div>
                          );
                        })}
                        {sectorMetrics.length === 0 && (
                          <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">Nenhum dado de setor.</div>
                        )}
                      </div>
                    </Card>
                  </div>

                  {vacantShiftItems.length > 0 && (
                    <Card className="rounded-3xl border border-rose-500/30 bg-rose-950/20 p-6 shadow-lg">
                      <div className="flex items-center gap-3 border-b border-rose-500/20 pb-4">
                        <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
                        <h3 className="text-sm font-black uppercase tracking-widest text-rose-400">Alerta Crítico: Plantões Descobertos ({vacantShiftItems.length})</h3>
                      </div>
                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {vacantShiftItems.slice(0, 12).map((v, i) => (
                          <div key={i} className="p-3 rounded-2xl bg-[#1e293b] border border-rose-500/20 flex items-center justify-between shadow-sm">
                            <div>
                              <strong className="text-xs text-white block">{getSectorName(v, sectors)}</strong>
                              <span className="text-[10px] text-slate-400">Data: {formatDate(v.date)}</span>
                            </div>
                            <span className="font-mono text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/20">
                              {v.start_time} - {v.end_time}
                            </span>
                          </div>
                        ))}
                        {vacantShiftItems.length > 12 && (
                          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xs text-slate-400 font-bold">
                            + {vacantShiftItems.length - 12} vagas pendentes
                          </div>
                        )}
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* 2. ESCALAS */}
              {activeTab === 'escalas' && (
                <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 shadow-lg space-y-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between border-b border-slate-700/50 pb-4">
                    <h3 className="font-black text-sm uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                      <CalendarDays className="w-5 h-5" /> Relatório Detalhado de Escalas & Turnos
                    </h3>
                    <span className="text-xs font-bold text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-700">{filteredShifts.length} registros</span>
                  </div>
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-700 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          <th className="py-3 px-3">Data</th>
                          <th className="py-3 px-3">Setor</th>
                          <th className="py-3 px-3">Profissional Alocado</th>
                          <th className="py-3 px-3">Horário</th>
                          <th className="py-3 px-3">Horas</th>
                          <th className="py-3 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50 font-medium">
                        {filteredShifts.map((s, idx) => {
                          const isVago = isVacant(s);
                          return (
                            <tr key={s.id || idx} className="hover:bg-slate-900/50 transition-colors">
                              <td className="py-3 px-3 font-bold font-mono text-slate-300">{formatDate(s.date)}</td>
                              <td className="py-3 px-3 text-slate-300">{getSectorName(s, sectors)}</td>
                              <td className={`py-3 px-3 font-black ${isVago ? 'text-rose-400' : 'text-white'}`}>
                                {isVago ? '⚠️ VAGA EM ABERTO' : titleCase(s.professional_name)}
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-400">{s.start_time || '07:00'} - {s.end_time || '19:00'}</td>
                              <td className="py-3 px-3 font-mono text-cyan-400">{getShiftHours(s)}h</td>
                              <td className="py-3 px-3"><StatusBadge status={isVago ? 'vago' : s.status} /></td>
                            </tr>
                          );
                        })}
                        {filteredShifts.length === 0 && (
                          <tr><td colSpan="6" className="py-8 text-center text-slate-500">Nenhum plantão encontrado nos filtros atuais.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* 3. PROFISSIONAIS */}
              {activeTab === 'profissionais' && (
                <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 shadow-lg space-y-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between border-b border-slate-700/50 pb-4">
                    <h3 className="font-black text-sm uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                      <Stethoscope className="w-5 h-5" /> Matriz de Produtividade Clínica
                    </h3>
                    <span className="text-xs font-bold text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-700">{professionalMetrics.length} atuantes</span>
                  </div>
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-700 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          <th className="py-3 px-3">Profissional</th>
                          <th className="py-3 px-3">Setores de Atuação</th>
                          <th className="py-3 px-3 text-center">Plantões</th>
                          <th className="py-3 px-3 text-right">Carga Horária</th>
                          <th className="py-3 px-3 text-right">Custo Gerado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50 font-medium">
                        {professionalMetrics.map((doc, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/50 transition-colors">
                            <td className="py-3 px-3 font-bold text-white flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-slate-800 text-cyan-400 font-black flex items-center justify-center text-[10px] border border-slate-700">
                                {doc.name.substring(0,2).toUpperCase()}
                              </div>
                              {doc.name}
                            </td>
                            <td className="py-3 px-3 text-slate-400">{doc.sectors}</td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-white">{doc.shifts}</td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">{doc.hours}h</td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">{formatCurrency(doc.cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* 4. FINANCEIRO */}
              {activeTab === 'financeiro' && (
                <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 shadow-lg space-y-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between border-b border-slate-700/50 pb-4">
                    <h3 className="font-black text-sm uppercase tracking-widest text-amber-400 flex items-center gap-2">
                      <DollarSign className="w-5 h-5" /> Inteligência Financeira e Orçamento
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4">
                    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-inner">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Custo Total Previsto</span>
                      <div className="text-2xl font-black font-mono text-white mt-2">{formatCurrency(financialSummary.totalCost)}</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-inner">
                      <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Realizado</span>
                      <div className="text-2xl font-black font-mono text-emerald-400 mt-2">{formatCurrency(financialSummary.executedCost)}</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-inner">
                      <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">Pendente</span>
                      <div className="text-2xl font-black font-mono text-amber-400 mt-2">{formatCurrency(financialSummary.pendingCost)}</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 shadow-inner">
                      <span className="text-[10px] font-black uppercase text-rose-400 tracking-wider">Vagas (Não alocado)</span>
                      <div className="text-2xl font-black font-mono text-rose-400 mt-2">{formatCurrency(financialSummary.vacantCost)}</div>
                    </div>
                  </div>
                  <div className="mt-8 border-t border-slate-700/50 pt-6">
                    <h4 className="text-xs font-black uppercase text-slate-400 mb-4">Custos por Setor</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-700 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                            <th className="py-2 px-2">Setor</th>
                            <th className="py-2 px-2 text-right">Horas Consumidas</th>
                            <th className="py-2 px-2 text-right">Valor Projetado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 font-medium">
                          {sectorMetrics.map((sec, idx) => (
                            <tr key={idx}>
                              <td className="py-3 px-2 font-bold text-white">{sec.name}</td>
                              <td className="py-3 px-2 text-right font-mono text-slate-400">{sec.hours}h</td>
                              <td className="py-3 px-2 text-right font-mono font-black text-amber-400">{formatCurrency(sec.cost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Card>
              )}

              {/* 5. GOVERNANÇA */}
              {activeTab === 'governanca' && (
                <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 shadow-lg space-y-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between border-b border-slate-700/50 pb-4">
                    <h3 className="font-black text-sm uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5" /> Conformidade de Credenciais e Documentação
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4">
                    <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-inner">
                      <div className="flex items-center gap-2 mb-2">
                         <div className="w-2 h-2 rounded-full bg-emerald-400" />
                         <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Válidos</span>
                      </div>
                      <div className="text-3xl font-black font-mono text-emerald-400">{credentialAudit.valid}</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-inner">
                      <div className="flex items-center gap-2 mb-2">
                         <div className="w-2 h-2 rounded-full bg-amber-400" />
                         <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">Vencem 30 dias</span>
                      </div>
                      <div className="text-3xl font-black font-mono text-amber-400">{credentialAudit.nearExpiry}</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 shadow-inner">
                      <div className="flex items-center gap-2 mb-2">
                         <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                         <span className="text-[10px] font-black uppercase text-rose-400 tracking-wider">Vencidos</span>
                      </div>
                      <div className="text-3xl font-black font-mono text-rose-400">{credentialAudit.expired}</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-inner">
                      <div className="flex items-center gap-2 mb-2">
                         <div className="w-2 h-2 rounded-full bg-slate-400" />
                         <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Sem Cadastro</span>
                      </div>
                      <div className="text-3xl font-black font-mono text-slate-400">{credentialAudit.missing}</div>
                    </div>
                  </div>
                  <div className="mt-6 p-4 rounded-xl border border-slate-700/50 bg-slate-900/50 text-xs text-slate-400">
                    <b>Política de Alocação:</b> Médicos com CRM ou credencial principal vencida receberão alerta automático no painel de escala e podem sofrer bloqueio sistêmico para novas alocações.
                  </div>
                </Card>
              )}
            </div>
          </>
        )}
      </div>

      {/* ========================================== */}
      {/* MODO IMPRESSÃO (PDF BRANCO E FORMATADO)      */}
      {/* ========================================== */}
      {hasSearched && (
        <div className="hidden print:block bg-white text-slate-900 w-full font-sans text-[11px] leading-relaxed">
          
          {/* PAGE 1: HEADER + KPIs */}
          <div className="print:break-after-page">
            <div className="border-b-2 border-slate-900 pb-3 mb-6">
              <h1 className="text-xl font-black uppercase text-slate-900">{company?.name || 'Hospital Santa Clara'}</h1>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Diretoria Médica - Dossiê Executivo Consolidado</p>
              <div className="flex justify-between text-[10px] text-slate-500 pt-2 mt-2 border-t border-slate-200">
                <span><b>Período Analisado:</b> {periodLabel}</span>
                <span><b>Emissão:</b> {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</span>
              </div>
            </div>

            <h2 className="text-sm font-black bg-slate-100 p-2 mb-4 border border-slate-300 uppercase">1. Visão Executiva & Indicadores Chave</h2>
            <div className="grid grid-cols-4 gap-4 mb-8">
               <div className="border border-slate-300 p-3 rounded-lg">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Total de Plantões</span>
                  <div className="text-xl font-black">{totalShiftsCount}</div>
                  <div className="text-[9px] text-emerald-600 font-bold">{filledShiftsCount} Preenchidos / <span className="text-rose-600">{vacantShiftsCount} Vagos</span></div>
               </div>
               <div className="border border-slate-300 p-3 rounded-lg">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Taxa de Cobertura Global</span>
                  <div className="text-xl font-black">{coverageRate}%</div>
                  <div className="text-[9px] text-slate-500">Meta: &gt; 98%</div>
               </div>
               <div className="border border-slate-300 p-3 rounded-lg">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Custo Projetado Estimado</span>
                  <div className="text-xl font-black">{formatCurrency(financialSummary.totalCost)}</div>
                  <div className="text-[9px] text-slate-500">{financialSummary.hours} Horas Assistenciais</div>
               </div>
               <div className="border border-slate-300 p-3 rounded-lg">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Compliance Regulatória</span>
                  <div className="text-xl font-black">{Math.round(((credentialAudit.valid + credentialAudit.nearExpiry) / Math.max(1, credentialAudit.total)) * 100)}%</div>
                  <div className="text-[9px] text-rose-600 font-bold">{credentialAudit.expired} Vencidos / {credentialAudit.nearExpiry} a Vencer</div>
               </div>
            </div>

            <h2 className="text-sm font-black bg-slate-100 p-2 mb-4 border border-slate-300 uppercase">2. Desempenho e Eficiência por Setor</h2>
            <table className="w-full text-left text-[10px] border-collapse border border-slate-300 mb-8">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 uppercase">
                  <th className="p-2 border-r border-slate-300">Setor Clínico</th>
                  <th className="p-2 border-r border-slate-300 text-center">Turnos T.</th>
                  <th className="p-2 border-r border-slate-300 text-center">Alocados</th>
                  <th className="p-2 border-r border-slate-300 text-center">Vagos</th>
                  <th className="p-2 border-r border-slate-300 text-center">Cobertura</th>
                  <th className="p-2 text-right">Custo Estimado</th>
                </tr>
              </thead>
              <tbody>
                {sectorMetrics.map((sec, idx) => {
                  const pct = sec.total > 0 ? Math.round((sec.filled / sec.total) * 100) : 100;
                  return (
                    <tr key={idx} className="border-b border-slate-300">
                      <td className="p-2 border-r border-slate-300 font-bold">{sec.name}</td>
                      <td className="p-2 border-r border-slate-300 text-center">{sec.total}</td>
                      <td className="p-2 border-r border-slate-300 text-center">{sec.filled}</td>
                      <td className={`p-2 border-r border-slate-300 text-center font-bold ${sec.vacant > 0 ? 'text-rose-600' : ''}`}>{sec.vacant}</td>
                      <td className="p-2 border-r border-slate-300 text-center">{pct}%</td>
                      <td className="p-2 text-right">{formatCurrency(sec.cost)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <h2 className="text-sm font-black bg-slate-100 p-2 mb-4 border border-slate-300 uppercase">3. Detalhamento Financeiro Consolidade</h2>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="border border-slate-300 p-3 rounded-lg bg-slate-50">
                 <span className="text-[9px] font-bold text-slate-500 uppercase">Total Previsto Global</span>
                 <div className="text-lg font-black">{formatCurrency(financialSummary.totalCost)}</div>
              </div>
              <div className="border border-slate-300 p-3 rounded-lg bg-emerald-50/50">
                 <span className="text-[9px] font-bold text-slate-500 uppercase">Valor Realizado</span>
                 <div className="text-lg font-black text-emerald-800">{formatCurrency(financialSummary.executedCost)}</div>
              </div>
              <div className="border border-slate-300 p-3 rounded-lg bg-amber-50/50">
                 <span className="text-[9px] font-bold text-slate-500 uppercase">Valor Pendente</span>
                 <div className="text-lg font-black text-amber-800">{formatCurrency(financialSummary.pendingCost)}</div>
              </div>
              <div className="border border-slate-300 p-3 rounded-lg bg-rose-50/50">
                 <span className="text-[9px] font-bold text-slate-500 uppercase">Custo de Vagas em Aberto</span>
                 <div className="text-lg font-black text-rose-800">{formatCurrency(financialSummary.vacantCost)}</div>
              </div>
            </div>
          </div>

          {/* PAGE 2: VAGAS (ALERTA) E PROFISSIONAIS */}
          <div className="print:break-after-page">
            <h2 className="text-sm font-black bg-rose-100 text-rose-900 p-2 mb-4 border border-rose-300 uppercase">4. Alerta de Segurança: Vagas Descobertas ({vacantShiftItems.length})</h2>
            {vacantShiftItems.length > 0 ? (
              <table className="w-full text-left text-[10px] border-collapse border border-slate-300 mb-8">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 uppercase">
                    <th className="p-2 border-r border-slate-300">Data</th>
                    <th className="p-2 border-r border-slate-300">Setor Clínico</th>
                    <th className="p-2 text-center">Horário do Turno</th>
                  </tr>
                </thead>
                <tbody>
                  {vacantShiftItems.map((v, i) => (
                    <tr key={i} className="border-b border-slate-300">
                      <td className="p-2 border-r border-slate-300 font-bold">{formatDate(v.date)}</td>
                      <td className="p-2 border-r border-slate-300">{getSectorName(v, sectors)}</td>
                      <td className="p-2 text-rose-700 font-bold text-center">{v.start_time} - {v.end_time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-[11px] mb-8 text-emerald-800 font-bold p-3 border border-emerald-300 bg-emerald-50 rounded-lg">✓ Nenhuma vaga em aberto identificada neste período. Escala com 100% de conformidade.</p>
            )}

            <h2 className="text-sm font-black bg-slate-100 p-2 mb-4 border border-slate-300 uppercase">5. Matriz de Produtividade & Horas Médicas</h2>
            <table className="w-full text-left text-[10px] border-collapse border border-slate-300 mb-4">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 uppercase">
                  <th className="p-2 border-r border-slate-300">Profissional Registrado</th>
                  <th className="p-2 border-r border-slate-300">Setores de Atuação no Período</th>
                  <th className="p-2 border-r border-slate-300 text-center">Nº Plantões</th>
                  <th className="p-2 border-r border-slate-300 text-center">Horas</th>
                  <th className="p-2 text-right">Custo Estimado</th>
                </tr>
              </thead>
              <tbody>
                {professionalMetrics.map((doc, idx) => (
                  <tr key={idx} className="border-b border-slate-300">
                    <td className="p-2 border-r border-slate-300 font-bold">{doc.name}</td>
                    <td className="p-2 border-r border-slate-300">{doc.sectors}</td>
                    <td className="p-2 border-r border-slate-300 text-center">{doc.shifts}</td>
                    <td className="p-2 border-r border-slate-300 text-center">{doc.hours}h</td>
                    <td className="p-2 text-right">{formatCurrency(doc.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </>
  );
}