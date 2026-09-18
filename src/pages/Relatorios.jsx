import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3, Users, DollarSign, Building2,
  CalendarDays, ShieldAlert, CheckCircle2,
  Activity, Clock, Printer as PrinterIcon,
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
  vago: 'Vago',
  vaga_perdida: 'Vaga Perdida'
};

const STATUS_COLORS = {
  programado: 'bg-blue-500/10 text-blue-500 border-blue-500/30 print:bg-blue-100 print:text-blue-700',
  confirmado: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 print:bg-emerald-100 print:text-emerald-700',
  pendente: 'bg-amber-500/10 text-amber-500 border-amber-500/30 print:bg-amber-100 print:text-amber-700',
  concluida: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 print:bg-emerald-100 print:text-emerald-700',
  realizado: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 print:bg-emerald-100 print:text-emerald-700',
  cancelado: 'bg-rose-500/10 text-rose-500 border-rose-500/30 print:bg-rose-100 print:text-rose-700',
  vago: 'bg-rose-500/10 text-rose-500 border-rose-500/30 font-black animate-pulse print:bg-rose-100 print:text-rose-700'
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

function toTitleCase(str) {
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
  const rawSecName = shift.sector_name || sectors.find(item => String(item.id) === String(shift.sector_id))?.name || '';
  const n = normalize(rawSecName);
  if (!n || n === 'setor' || n.includes('setor geral')) return '';
  return toTitleCase(rawSecName);
}

function isVacant(shift) {
  const name = normalize(getShiftName(shift));
  const hasProf = Boolean((shift.professional_id && String(shift.professional_id).trim() !== '') || (name && name !== ''));
  
  if (!hasProf) return true;
  if (normalize(shift.status) === 'vago') return true;
  if (name.includes('vaga') || name.includes('descoberto') || name.includes('aberto') || name === 'plantao sem profissional') return true;
  
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
    <span className={`inline-flex rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-wider border ${STATUS_COLORS[key] || 'bg-slate-800 text-slate-300 border-slate-700 print:bg-slate-100 print:text-slate-600'}`}>
      {STATUS_LABELS[key] || status || 'Sem status'}
    </span>
  );
}

export default function Relatorios() {
  const { shifts = [], sectors = [], professionals = [], company } = useAppData();

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
    (professionals || []).forEach(p => {
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
      const statusNorm = normalize(shift.status || '');
      
      // Exclui sumariamente plantões cancelados ou perdidos do relatório financeiro/operacional
      if (statusNorm.includes('cancelad') || statusNorm.includes('perdid')) return false;

      const secName = getSectorName(shift, sectors);
      if (!secName) return false; // Exclui fantasmas

      if (appliedFilters.sector !== 'todos' && String(shift.sector_id) !== String(appliedFilters.sector)) return false;

      const shiftDate = String(shift.date || shift.start_date || shift.data || '').slice(0, 10);
      if (shiftDate && !shiftDate.includes(`${yStr}-${mStr}`)) return false;

      if (term) {
        const profName = normalize(getShiftName(shift));
        if (!profName.includes(term) && !normalize(secName).includes(term)) return false;
      }

      return true;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
    
    filteredShifts.forEach(shift => {
      const sName = getSectorName(shift, sectors);
      const id = String(shift.sector_id || sName);
      
      if (!map[id]) {
        map[id] = { id, name: sName, total: 0, filled: 0, vacant: 0, hours: 0, cost: 0 };
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
        map[key] = { id: shift.professional_id || key, name: toTitleCase(name), shifts: 0, hours: 0, sectors: new Set(), cost: 0 };
      }
      
      const item = map[key];
      item.shifts += 1;
      item.hours += getShiftHours(shift);
      
      const sName = getSectorName(shift, sectors);
      if (sName) item.sectors.add(sName);
      
      item.cost += getProfessionalCost(getProf(shift), getShiftHours(shift));
    });

    return Object.values(map).map(item => ({ ...item, sectors: Array.from(item.sectors).join(', ') })).sort((a, b) => b.shifts - a.shifts);
  }, [filteredShifts, sectors, getProf]);

  const credentialAudit = useMemo(() => {
    let valid = 0, expired = 0, nearExpiry = 0, missing = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    (professionals || []).forEach(p => {
      const meta = getProfessionalMeta(p);
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

    return { valid, expired, nearExpiry, missing, total: (professionals || []).length };
  }, [professionals]);

  // Exportação Real para Excel (.xls com formatação de tabela)
  const handleExportExcel = () => {
    if (!hasSearched || !filteredShifts.length) {
      alert('Nenhum dado para exportar com os filtros atuais.');
      return;
    }

    const data = filteredShifts.map(s => ({
      Data: formatDate(s.date),
      Setor: getSectorName(s, sectors),
      Profissional: isVacant(s) ? 'Vaga em Aberto' : toTitleCase(getShiftName(s)),
      Horario: `${s.start_time || ''} - ${s.end_time || ''}`,
      Horas: getShiftHours(s),
      Status: isVacant(s) ? 'Vago' : (s.status || 'Ativo'),
      Custo_R$: formatCurrency(getProfessionalCost(getProf(s), getShiftHours(s)))
    }));

    let tableRows = '';
    const headers = Object.keys(data[0]);
    tableRows += '<tr>' + headers.map(h => `<th style="background-color: #0ea5e9; color: white; font-weight: bold; border: 1px solid #cbd5e1; padding: 10px; text-align: left;">${h.replace('_', ' ')}</th>`).join('') + '</tr>';
    
    data.forEach((row, i) => {
      const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
      tableRows += `<tr>` + headers.map(h => `<td style="background-color: ${bg}; border: 1px solid #cbd5e1; padding: 8px; color: #334155;">${row[h] !== null && row[h] !== undefined ? row[h] : ''}</td>`).join('') + `</tr>`;
    });

    const title = `Relatório Operacional de Escalas - ${MONTH_NAMES[Number(appliedFilters.month) - 1]} ${appliedFilters.year}`;

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 12px; }
        </style>
      </head>
      <body>
        <h2 style="color: #0f172a; font-family: Arial, sans-serif;">${title}</h2>
        <p style="font-family: Arial, sans-serif; color: #64748b; margin-bottom: 20px;">
          Hospital: ${company?.name || 'Sistema'}<br/>
          Setor Filtrado: ${appliedFilters.sector === 'todos' ? 'Todos os Setores' : (sectors.find(s => String(s.id) === String(appliedFilters.sector))?.name || '')}
        </p>
        <table>
          ${tableRows}
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Escalas_${appliedFilters.month}_${appliedFilters.year}.xls`;
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

  const periodLabel = `${MONTH_NAMES[Number(appliedFilters.month) - 1]} ${appliedFilters.year}`;

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 p-4 md:p-8 space-y-6 font-sans print:bg-white print:text-slate-900 print:p-0 print:m-0 print:block">
      
      {/* CSS GLOBAL PARA QUEBRA DE PÁGINA PERFEITA NO PDF */}
      <style>
        {`
          @media print {
            @page { size: A4 portrait; margin: 12mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; color: black; }
            .print-break-after { page-break-after: always; }
            .print-break-avoid { page-break-inside: avoid; }
            .scrollbar-hide::-webkit-scrollbar { display: none; }
            .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
          }
        `}
      </style>

      {/* TOPO EXECUTIVO PREMIUM MEDITECH (Oculto na impressão) */}
      <div className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 md:p-8 text-white shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 print:hidden">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" /> {company?.name || 'Gestão Hospitalar'} • BI Executivo
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            Central de Relatórios & Inteligência
          </h1>
          <p className="text-xs text-slate-400 font-medium max-w-2xl">
            Ambiente corporativo de auditoria de escalas, telemetria financeira e conformidade assistencial.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
          <Button 
            onClick={handleExportExcel}
            variant="outline" disabled={!hasSearched}
            className="w-full sm:w-auto h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 rounded-2xl border-slate-700 gap-2 cursor-pointer disabled:opacity-50 shadow-md"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Exportar Planilha Excel
          </Button>

          <Button 
            onClick={handlePrint} disabled={!hasSearched}
            className="w-full sm:w-auto h-11 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs px-6 rounded-2xl shadow-lg gap-2 cursor-pointer transition-all hover:scale-105 disabled:opacity-50 border border-cyan-500"
          >
            <PrinterIcon className="w-4 h-4" /> Imprimir Dossiê Executivo
          </Button>
        </div>
      </div>

      {/* CABEÇALHO ELEGANTE PARA IMPRESSÃO (PDF) */}
      <div className="hidden print:flex flex-col items-center justify-center border-b-2 border-slate-900 pb-6 mb-8 space-y-2">
        <h1 className="text-3xl font-black uppercase text-slate-900 tracking-wider">{company?.name || 'Hospital Santa Clara'}</h1>
        <p className="text-sm font-bold text-slate-600 uppercase tracking-widest bg-slate-100 px-4 py-1 rounded-full border border-slate-300">Diretoria Médica & Gestão de Escalas - Dossiê Oficial</p>
        <div className="flex justify-between w-full text-xs text-slate-500 pt-4 px-8">
          <span><b>Período Filtrado:</b> {periodLabel}</span>
          <span><b>Data Emissão:</b> {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</span>
        </div>
      </div>

      {/* PAINEL DE FILTROS ROBUSTO */}
      <Card className="p-5 rounded-3xl border border-slate-800 bg-[#1e293b] shadow-xl space-y-4 print:hidden">
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
              placeholder="Nome médico ou setor..." 
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
            Para garantir altíssima performance no cruzamento de dados, defina os parâmetros e clique em <b>Aplicar Filtros</b>.
          </p>
        </Card>
      ) : (
        <>
          {/* ABAS ESTILO DASHBOARD MEDITECH */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 print:hidden scrollbar-hide">
            {[
              { id: 'executivo', label: 'Dashboard Executivo', icon: BarChart3 },
              { id: 'escalas', label: 'Escalas & Turnos', icon: CalendarDays },
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

          {/* O BLOCO DE IMPRESSÃO RENDERIZA TUDO EM SEQUÊNCIA, A TELA RENDERIZA SÓ A ABA */}
          <div className="space-y-6 print:block">
            
            {/* ========================================================================= */}
            {/* 1. VISÃO EXECUTIVA */}
            {/* ========================================================================= */}
            <div className={`${activeTab === 'executivo' ? 'block' : 'hidden print:block'} print-break-after space-y-6`}>
              
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-2 print-break-avoid">
                <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 shadow-lg relative overflow-hidden group print:border-slate-300 print:bg-white print:text-black print:shadow-none">
                  <div className="absolute right-0 top-0 opacity-10 group-hover:scale-110 transition-transform">
                     <Activity className="w-24 h-24 -mt-4 -mr-4 text-cyan-500" />
                  </div>
                  <div className="relative">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 print:text-slate-500">Volume de Plantões</p>
                    <p className="mt-2 text-4xl font-black text-white font-mono tracking-tight print:text-black">{formatNumber(totalShiftsCount)}</p>
                    <div className="mt-3 text-xs text-slate-400 font-bold flex items-center gap-2">
                      <span className="text-cyan-400 print:text-cyan-600">{filledShiftsCount} Preenchidos</span>
                      {vacantShiftsCount > 0 && <span className="text-rose-400 px-2 py-0.5 bg-rose-500/10 rounded-full print:bg-transparent print:px-0 print:border print:border-rose-300">{vacantShiftsCount} Vagos</span>}
                    </div>
                  </div>
                </Card>

                <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 shadow-lg relative overflow-hidden group print:border-slate-300 print:bg-white print:text-black print:shadow-none">
                  <div className="absolute right-0 top-0 opacity-10 group-hover:scale-110 transition-transform">
                     <Target className="w-24 h-24 -mt-4 -mr-4 text-emerald-500" />
                  </div>
                  <div className="relative">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 print:text-slate-500">Taxa de Cobertura</p>
                    <p className={`mt-2 text-4xl font-black font-mono tracking-tight ${coverageRate >= 98 ? 'text-emerald-400 print:text-emerald-600' : coverageRate >= 90 ? 'text-amber-400 print:text-amber-600' : 'text-rose-400 print:text-rose-600'}`}>
                      {coverageRate}%
                    </p>
                    <div className="mt-3 text-xs text-slate-400 font-bold">Meta Institucional: &gt; 98%</div>
                  </div>
                </Card>

                <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 shadow-lg relative overflow-hidden group print:border-slate-300 print:bg-white print:text-black print:shadow-none">
                  <div className="absolute right-0 top-0 opacity-10 group-hover:scale-110 transition-transform">
                     <DollarSign className="w-24 h-24 -mt-4 -mr-4 text-amber-500" />
                  </div>
                  <div className="relative">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 print:text-slate-500">Custo Projetado</p>
                    <p className="mt-2 text-4xl font-black text-amber-400 font-mono tracking-tight print:text-amber-600">{formatCurrency(financialSummary.totalCost)}</p>
                    <div className="mt-3 text-xs text-slate-400 font-bold">{formatNumber(financialSummary.hours)} Horas Totais Assistenciais</div>
                  </div>
                </Card>

                <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 shadow-lg relative overflow-hidden group print:border-slate-300 print:bg-white print:text-black print:shadow-none">
                  <div className="absolute right-0 top-0 opacity-10 group-hover:scale-110 transition-transform">
                     <ShieldAlert className="w-24 h-24 -mt-4 -mr-4 text-rose-500" />
                  </div>
                  <div className="relative">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 print:text-slate-500">Compliance Geral</p>
                    <p className="mt-2 text-4xl font-black text-white font-mono tracking-tight print:text-black">
                       {Math.round(((credentialAudit.valid + credentialAudit.nearExpiry) / Math.max(1, credentialAudit.total)) * 100)}%
                    </p>
                    <div className="mt-3 text-[10px] text-slate-400 font-bold flex flex-col gap-0.5">
                       <span className={credentialAudit.expired > 0 ? 'text-rose-400 print:text-rose-600' : ''}>{credentialAudit.expired} Vencidos</span>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:grid-cols-1 print-break-avoid">
                {/* DONUT CHART (BED CAPACITY OVERVIEW STYLE) */}
                <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 shadow-lg flex flex-col items-center justify-center print:border-slate-300 print:bg-white print:shadow-none">
                  <h3 className="w-full text-left text-xs font-black uppercase tracking-widest text-slate-400 mb-6 print:text-slate-500">Ocupação da Escala</h3>
                  
                  <div className="relative w-48 h-48">
                    <svg viewBox="0 0 36 36" className="w-full h-full">
                      <path className="text-slate-800 print:text-slate-200" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5" />
                      <path className={`${coverageRate === 100 ? 'text-cyan-400 print:text-cyan-600' : 'text-cyan-500 print:text-cyan-600'}`} strokeDasharray={`${coverageRate}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest print:text-slate-500">Total Turnos</span>
                      <span className="text-3xl font-black text-white font-mono print:text-black">{totalShiftsCount}</span>
                    </div>
                  </div>

                  <div className="mt-8 w-full space-y-2">
                    <div className="flex items-center justify-between text-xs">
                       <span className="flex items-center gap-2 text-slate-300 font-bold print:text-slate-700">
                         <span className="w-3 h-3 rounded-full bg-cyan-400"></span> Preenchidos:
                       </span>
                       <span className="font-mono text-white print:text-black">{filledShiftsCount} ({coverageRate}%)</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                       <span className="flex items-center gap-2 text-slate-300 font-bold print:text-slate-700">
                         <span className="w-3 h-3 rounded-full bg-slate-700 print:bg-slate-300"></span> Vagos:
                       </span>
                       <span className="font-mono text-white print:text-black">{vacantShiftsCount} ({100 - coverageRate}%)</span>
                    </div>
                  </div>
                </Card>

                {/* GRAFICO DE BARRAS POR SETOR */}
                <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 shadow-lg lg:col-span-2 print:border-slate-300 print:bg-white print:shadow-none">
                  <div className="flex items-center justify-between border-b border-slate-700/50 pb-4 print:border-slate-200">
                     <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 print:text-slate-500">Eficiência por Setor (Top 6)</h3>
                  </div>

                  <div className="mt-6 h-48 flex items-end justify-between gap-2 px-2">
                    {sectorMetrics.slice(0, 6).map((sec, idx) => {
                      const pct = sec.total > 0 ? Math.round((sec.filled / sec.total) * 100) : 0;
                      return (
                        <div key={idx} className="flex flex-col items-center flex-1 gap-2 group">
                           <div className="text-[10px] font-mono font-bold text-slate-400 print:text-slate-600 transition-opacity">
                             {pct}%
                           </div>
                           <div className="w-full max-w-[40px] h-32 bg-slate-800 rounded-sm relative overflow-hidden print:bg-slate-200 print:border print:border-slate-300">
                              <div 
                                className={`absolute bottom-0 w-full rounded-sm transition-all duration-1000 ${pct >= 90 ? 'bg-cyan-400 print:bg-cyan-500' : pct >= 70 ? 'bg-amber-400 print:bg-amber-500' : 'bg-rose-400 print:bg-rose-500'} `}
                                style={{ height: `${pct}%` }}
                              ></div>
                           </div>
                           <div className="text-[9px] font-black uppercase text-slate-300 text-center leading-tight truncate w-full print:text-slate-700" title={sec.name}>
                             {sec.name.split(' ')[0]}
                           </div>
                        </div>
                      );
                    })}
                    {sectorMetrics.length === 0 && (
                      <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">Nenhum dado de setor validado.</div>
                    )}
                  </div>
                </Card>
              </div>

              {/* ALERTAS CRÍTICOS - Somente Vagas FUTURAS OU HOJE */}
              {(() => {
                const today = new Date();
                today.setHours(0,0,0,0);
                const upcomingVacantItems = vacantShiftItems.filter(v => {
                  if (!v.date) return false;
                  const sDate = new Date(v.date);
                  return sDate >= today;
                });

                if (upcomingVacantItems.length === 0) return null;

                return (
                  <Card className="rounded-3xl border border-rose-500/30 bg-rose-950/20 p-6 shadow-lg print:border-rose-300 print:bg-white print:shadow-none print-break-avoid">
                    <div className="flex items-center gap-3 border-b border-rose-500/20 pb-4 print:border-rose-200">
                      <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse print:animate-none" />
                      <h3 className="text-sm font-black uppercase tracking-widest text-rose-400 print:text-rose-600">Alerta Crítico: Plantões Futuros Descobertos ({upcomingVacantItems.length})</h3>
                    </div>
                    
                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {upcomingVacantItems.slice(0, 12).map((v, i) => (
                        <div key={i} className="p-4 rounded-2xl bg-[#1e293b] border border-rose-500/20 flex items-center justify-between shadow-sm print:bg-white print:border-slate-300">
                          <div>
                            <strong className="text-xs font-black text-white block print:text-black">{getSectorName(v, sectors)}</strong>
                            <span className="text-[10px] text-slate-400 print:text-slate-500">Data: {formatDate(v.date)}</span>
                          </div>
                          <span className="font-mono text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/20 print:text-rose-700 print:bg-rose-100">
                            {v.start_time} - {v.end_time}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })()}
            </div>

            {/* ========================================================================= */}
            {/* 2. ESCALAS */}
            {/* ========================================================================= */}
            <div className={`${activeTab === 'escalas' ? 'block' : 'hidden print:block'} print-break-after`}>
              <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 shadow-lg print:border-slate-300 print:bg-white print:shadow-none">
                <div className="flex items-center justify-between border-b border-slate-700/50 pb-4 print:border-slate-300">
                  <h3 className="font-black text-sm uppercase tracking-widest text-cyan-400 print:text-slate-800 flex items-center gap-2">
                    <CalendarDays className="w-5 h-5" /> Relatório Detalhado de Escalas & Turnos
                  </h3>
                  <span className="text-xs font-bold text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-700 print:bg-slate-100 print:border-slate-300 print:text-slate-600">{filteredShifts.length} registros</span>
                </div>

                <div className="overflow-x-auto mt-4 print:overflow-visible">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-700 text-[10px] font-black uppercase text-slate-500 tracking-wider print:border-slate-300 print:text-slate-600">
                        <th className="py-3 px-3">Data</th>
                        <th className="py-3 px-3">Setor</th>
                        <th className="py-3 px-3">Profissional Alocado</th>
                        <th className="py-3 px-3">Horário</th>
                        <th className="py-3 px-3">Horas</th>
                        <th className="py-3 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 font-medium print:divide-slate-200">
                      {filteredShifts.map((s, idx) => {
                        const isVago = isVacant(s);
                        return (
                          <tr key={s.id || idx} className="hover:bg-slate-900/50 transition-colors print:hover:bg-transparent">
                            <td className="py-3 px-3 font-bold font-mono text-slate-300 print:text-slate-900">{formatDate(s.date)}</td>
                            <td className="py-3 px-3 text-slate-300 print:text-slate-700">{getSectorName(s, sectors)}</td>
                            <td className={`py-3 px-3 font-black ${isVago ? 'text-rose-400' : 'text-white print:text-slate-900'}`}>
                              {isVago ? '⚠️ VAGA EM ABERTO' : toTitleCase(getShiftName(s))}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-400 print:text-slate-600">{s.start_time || '07:00'} - {s.end_time || '19:00'}</td>
                            <td className="py-3 px-3 font-mono text-cyan-400 print:text-slate-800">{getShiftHours(s)}h</td>
                            <td className="py-3 px-3"><StatusBadge status={isVago ? 'vago' : s.status} /></td>
                          </tr>
                        );
                      })}
                      {filteredShifts.length === 0 && (
                        <tr><td colSpan="6" className="py-8 text-center text-slate-500">Nenhum plantão validado.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* ========================================================================= */}
            {/* 3. PROFISSIONAIS */}
            {/* ========================================================================= */}
            <div className={`${activeTab === 'profissionais' ? 'block' : 'hidden print:block'} print-break-after`}>
              <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 shadow-lg print:border-slate-300 print:bg-white print:shadow-none">
                <div className="flex items-center justify-between border-b border-slate-700/50 pb-4 print:border-slate-300">
                  <h3 className="font-black text-sm uppercase tracking-widest text-emerald-400 print:text-slate-800 flex items-center gap-2">
                    <Stethoscope className="w-5 h-5" /> Matriz de Produtividade Clínica
                  </h3>
                  <span className="text-xs font-bold text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-700 print:bg-slate-100 print:border-slate-300 print:text-slate-600">{professionalMetrics.length} atuantes</span>
                </div>

                <div className="overflow-x-auto mt-4 print:overflow-visible">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-700 text-[10px] font-black uppercase text-slate-500 tracking-wider print:border-slate-300 print:text-slate-600">
                        <th className="py-3 px-3">Profissional</th>
                        <th className="py-3 px-3">Setores de Atuação</th>
                        <th className="py-3 px-3 text-center">Plantões</th>
                        <th className="py-3 px-3 text-right">Carga Horária</th>
                        <th className="py-3 px-3 text-right">Custo Gerado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 font-medium print:divide-slate-200">
                      {professionalMetrics.map((doc, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/50 transition-colors print:hover:bg-transparent">
                          <td className="py-3 px-3 font-bold text-white print:text-slate-900 flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-slate-800 text-cyan-400 font-black flex items-center justify-center text-[10px] border border-slate-700 print:bg-slate-100 print:border-slate-300 print:text-slate-800">
                              {doc.name.substring(0,2).toUpperCase()}
                            </div>
                            {doc.name}
                          </td>
                          <td className="py-3 px-3 text-slate-400 print:text-slate-600">{doc.sectors}</td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-white print:text-slate-900">{doc.shifts}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400 print:text-emerald-700">{doc.hours}h</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-amber-400 print:text-slate-900">{formatCurrency(doc.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* ========================================================================= */}
            {/* 4. FINANCEIRO E SETORES */}
            {/* ========================================================================= */}
            <div className={`${activeTab === 'financeiro' ? 'block' : 'hidden print:block'} print-break-after`}>
              <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 shadow-lg print:border-slate-300 print:bg-white print:shadow-none">
                <div className="flex items-center justify-between border-b border-slate-700/50 pb-4 print:border-slate-300">
                  <h3 className="font-black text-sm uppercase tracking-widest text-amber-400 print:text-slate-800 flex items-center gap-2">
                    <DollarSign className="w-5 h-5" /> Inteligência Financeira e Orçamento
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4 print-break-avoid">
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-inner print:bg-white print:border-slate-300 print:shadow-none">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider print:text-slate-600">Custo Total Previsto</span>
                    <div className="text-2xl font-black font-mono text-white mt-2 print:text-slate-900">{formatCurrency(financialSummary.totalCost)}</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-inner print:bg-white print:border-emerald-300 print:shadow-none">
                    <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider print:text-emerald-700">Realizado</span>
                    <div className="text-2xl font-black font-mono text-emerald-400 mt-2 print:text-emerald-800">{formatCurrency(financialSummary.executedCost)}</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-inner print:bg-white print:border-amber-300 print:shadow-none">
                    <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider print:text-amber-700">Pendente</span>
                    <div className="text-2xl font-black font-mono text-amber-400 mt-2 print:text-amber-800">{formatCurrency(financialSummary.pendingCost)}</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 shadow-inner print:bg-white print:border-rose-300 print:shadow-none">
                    <span className="text-[10px] font-black uppercase text-rose-400 tracking-wider print:text-rose-700">Vagas (Não alocado)</span>
                    <div className="text-2xl font-black font-mono text-rose-400 mt-2 print:text-rose-800">{formatCurrency(financialSummary.vacantCost)}</div>
                  </div>
                </div>

                <div className="mt-8 border-t border-slate-700/50 pt-6 print:border-slate-300">
                  <h4 className="text-xs font-black uppercase text-slate-400 mb-4 print:text-slate-600">Distribuição Financeira por Setor Clínico</h4>
                  <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-700 text-[10px] font-black uppercase text-slate-500 tracking-wider print:border-slate-300 print:text-slate-600">
                          <th className="py-2 px-2">Setor Hospitalar</th>
                          <th className="py-2 px-2 text-right">Turnos Cobertos</th>
                          <th className="py-2 px-2 text-right">Horas Consumidas</th>
                          <th className="py-2 px-2 text-right">Valor Projetado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50 print:divide-slate-200 font-medium">
                        {sectorMetrics.map((sec, idx) => (
                          <tr key={idx}>
                            <td className="py-3 px-2 font-bold text-white print:text-slate-900">{sec.name}</td>
                            <td className="py-3 px-2 text-right text-slate-400 print:text-slate-600">{sec.filled} / {sec.total}</td>
                            <td className="py-3 px-2 text-right font-mono text-slate-400 print:text-slate-600">{sec.hours}h</td>
                            <td className="py-3 px-2 text-right font-mono font-black text-amber-400 print:text-slate-900">{formatCurrency(sec.cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            </div>

            {/* ========================================================================= */}
            {/* 5. GOVERNANÇA */}
            {/* ========================================================================= */}
            <div className={`${activeTab === 'governanca' ? 'block' : 'hidden print:block'}`}>
              <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 shadow-lg print:border-slate-300 print:bg-white print:shadow-none print-break-avoid">
                <div className="flex items-center justify-between border-b border-slate-700/50 pb-4 print:border-slate-300">
                  <h3 className="font-black text-sm uppercase tracking-widest text-indigo-400 print:text-slate-800 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5" /> Conformidade de Credenciais e Documentação
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4">
                  <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-inner print:bg-white print:border-emerald-300 print:shadow-none">
                    <div className="flex items-center gap-2 mb-2">
                       <div className="w-2 h-2 rounded-full bg-emerald-400" />
                       <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider print:text-emerald-700">Válidos</span>
                    </div>
                    <div className="text-3xl font-black font-mono text-emerald-400 print:text-emerald-800">{credentialAudit.valid}</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-inner print:bg-white print:border-amber-300 print:shadow-none">
                    <div className="flex items-center gap-2 mb-2">
                       <div className="w-2 h-2 rounded-full bg-amber-400" />
                       <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider print:text-amber-700">Vencem 30 dias</span>
                    </div>
                    <div className="text-3xl font-black font-mono text-amber-400 print:text-amber-800">{credentialAudit.nearExpiry}</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 shadow-inner print:bg-white print:border-rose-300 print:shadow-none">
                    <div className="flex items-center gap-2 mb-2">
                       <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse print:animate-none" />
                       <span className="text-[10px] font-black uppercase text-rose-400 tracking-wider print:text-rose-700">Vencidos</span>
                    </div>
                    <div className="text-3xl font-black font-mono text-rose-400 print:text-rose-800">{credentialAudit.expired}</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-inner print:bg-white print:border-slate-300 print:shadow-none">
                    <div className="flex items-center gap-2 mb-2">
                       <div className="w-2 h-2 rounded-full bg-slate-400" />
                       <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider print:text-slate-600">Sem Cadastro</span>
                    </div>
                    <div className="text-3xl font-black font-mono text-slate-400 print:text-slate-800">{credentialAudit.missing}</div>
                  </div>
                </div>
                
                <div className="mt-6 p-4 rounded-xl border border-slate-700/50 bg-slate-900/50 text-xs text-slate-400 leading-relaxed print:border-slate-300 print:bg-white print:text-slate-600">
                  <b>Política de Alocação e Compliance:</b> Médicos com CRM ou credencial principal vencida receberão alerta automático no painel de escala e podem sofrer bloqueio sistêmico para novas alocações futuras, impactando a liberação de honorários no fechamento financeiro. A atualização cadastral deve ser feita no módulo Corpo Clínico imediatamente.
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}