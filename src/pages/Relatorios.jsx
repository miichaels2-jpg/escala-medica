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
  Activity, Clock, Printer as PrinterIcon,
  AlertTriangle, Stethoscope, FileSpreadsheet,
  Filter, Check, Target, ShieldCheck, XCircle
} from 'lucide-react';

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
  return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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

  if (normalize(shift.status) === 'vago') return true;
  if (name.includes('vaga') || name.includes('descoberto') || name.includes('aberto') || name === 'plantao sem profissional') return true;
  if (!hasProfId && !hasName) return true;
  return false;
}

// Verifica se o plantão já passou comparando a data+hora final com o momento atual
function isShiftPast(shift) {
  if (!shift || !shift.date) return false;
  try {
    const dateStr = shift.date.split('T')[0];
    const endStr = shift.end_time || '23:59';
    const shiftEnd = new Date(`${dateStr}T${endStr}:00`);
    return shiftEnd < new Date();
  } catch (e) {
    return false;
  }
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
  const type = normalize(meta.remuneration_type || meta.remunerationType || 'mensal');

  if (type === 'hora' || type === 'hourly') {
    return hours * safeNumber(meta.hourly_rate ?? meta.hourlyRate ?? meta.valor_hora, 0);
  }
  if (type === 'diaria' || type === 'daily' || type === 'plantao') {
    return safeNumber(meta.daily_rate ?? meta.dailyRate ?? meta.valor_plantao, 0);
  }
  return safeNumber(meta.monthly_salary ?? meta.monthlySalary ?? meta.salary ?? meta.salario, 0) / 20;
}

export default function Relatorios() {
  const { shifts = [], sectors = [], professionals = [], company } = useAppData();

  const [activeTab, setActiveTab] = useState('executivo');
  const [printMode, setPrintMode] = useState('current'); // 'current' | 'all'
  
  // Datas padrão: Primeiro e Último dia do mês atual
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [dateStart, setDateStart] = useState(firstDay);
  const [dateEnd, setDateEnd] = useState(lastDay);
  const [selectedSector, setSelectedSector] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');

  const [hasSearched, setHasSearched] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({
    start: firstDay,
    end: lastDay,
    sector: 'todos',
    search: ''
  });

  const handleApplyFilters = () => {
    setAppliedFilters({
      start: dateStart,
      end: dateEnd,
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

  // Filtragem flexível baseada em Período Personalizado com ORDENAÇÃO CRESCENTE
  const filteredShifts = useMemo(() => {
    if (!hasSearched) return [];
    
    const term = normalize(appliedFilters.search);

    const filtered = shifts.filter(shift => {
      if (!shift || normalize(shift.status) === 'cancelado') return false;

      // Limpeza de lixo e orfãos
      const rawSecName = getSectorName(shift, sectors);
      const secName = normalize(rawSecName);
      if (!secName || secName === 'setor' || secName.includes('setor geral')) return false;

      if (appliedFilters.sector !== 'todos' && String(shift.sector_id) !== String(appliedFilters.sector)) return false;

      // Filtro de Data Flexível
      const shiftDate = String(shift.date || shift.start_date || shift.data || '').slice(0, 10);
      if (shiftDate) {
        if (appliedFilters.start && shiftDate < appliedFilters.start) return false;
        if (appliedFilters.end && shiftDate > appliedFilters.end) return false;
      }

      if (term) {
        const profName = normalize(getShiftName(shift));
        if (!profName.includes(term) && !secName.includes(term)) return false;
      }

      return true;
    });

    // ORDENAÇÃO CRESCENTE POR DATA E HORA DE INÍCIO
    return filtered.sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const timeA = a.start_time || '00:00';
      const timeB = b.start_time || '00:00';
      return timeA.localeCompare(timeB);
    });

  }, [shifts, sectors, appliedFilters, hasSearched]);

  // Indicadores
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
        if (status === 'concluida' || status === 'concluido' || status === 'realizado' || isShiftPast(shift)) {
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

  // Exibir TODOS os profissionais
  const professionalMetrics = useMemo(() => {
    const map = {};
    
    // Alimenta todos os profissionais ativos
    professionals.forEach(p => {
      const meta = getProfessionalMeta(p);
      const name = normalize(p.name);
      if (name) {
        map[name] = { 
          id: p.id || name, 
          name: titleCase(p.name), 
          specialty: titleCase(meta.specialty || meta.main_sector || 'Clínico Geral'),
          shifts: 0, 
          hours: 0, 
          sectors: new Set(), 
          cost: 0 
        };
      }
    });

    filteredShifts.forEach(shift => {
      if (isVacant(shift)) return;
      
      let rawName = getShiftName(shift);
      let normName = normalize(rawName);
      
      if (!normName) {
        normName = `desconhecido_${shift.id}`;
        rawName = 'Profissional Não Identificado';
      }

      if (!map[normName]) {
        const prof = getProf(shift);
        map[normName] = { 
          id: shift.professional_id || normName, 
          name: titleCase(prof?.name || rawName), 
          specialty: titleCase(prof?.specialty || 'Não Informada'),
          shifts: 0, 
          hours: 0, 
          sectors: new Set(), 
          cost: 0 
        };
      }
      
      const item = map[normName];
      item.shifts += 1;
      const h = getShiftHours(shift);
      item.hours += h;
      
      const sName = getSectorName(shift, sectors);
      if (sName) item.sectors.add(titleCase(sName));
      
      item.cost += getProfessionalCost(getProf(shift), h);
    });

    return Object.values(map).map(item => ({ 
      ...item, 
      sectors: item.sectors.size > 0 ? Array.from(item.sectors).join(', ') : '—' 
    })).sort((a, b) => b.shifts - a.shifts);
  }, [filteredShifts, professionals, sectors, getProf]);

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

  const periodLabel = `${formatDate(appliedFilters.start)} até ${formatDate(appliedFilters.end)}`;

  // ==========================================
  // EXPORTAÇÃO EXCEL NATIVA COM ESTILO (CSS in XLS)
  // ==========================================
  const triggerExcelExport = (mode) => {
    if (!hasSearched) {
      alert('Atenção: Aplique os filtros antes de exportar a planilha.');
      return;
    }

    const hospitalName = company?.name || 'Hospital Principal';

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; }
        table { border-collapse: collapse; width: 100%; font-size: 13px; }
        th { background-color: #0e7490; color: #ffffff; font-weight: bold; padding: 12px; border: 1px solid #cbd5e1; text-align: left; text-transform: uppercase; }
        td { padding: 10px; border: 1px solid #cbd5e1; vertical-align: middle; }
        .row-alt { background-color: #f8fafc; }
        .vago { color: #d97706; font-weight: bold; background-color: #fef3c7; }
        .furo { color: #be123c; font-weight: bold; background-color: #ffe4e6; }
        .header-main { background-color: #ffffff; text-align: center; padding: 15px; border: none; }
        .h1 { font-size: 24px; font-weight: bold; color: #0f172a; margin: 0; }
        .h2 { font-size: 14px; color: #475569; margin: 5px 0 0 0; }
        .money { mso-number-format:"_-* #\\,##0\\.00_-\\;\\-* #\\,##0\\.00_-\\;_-* &quot;-&quot;??_-\\;_-@_-"; }
        .section-title { font-size: 16px; font-weight: bold; color: #0f172a; background-color: #e2e8f0; padding: 10px; text-align: left; border: 1px solid #cbd5e1; }
      </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="7" class="header-main">
              <div class="h1">${hospitalName} - Dossiê de Inteligência Corporativa</div>
              <div class="h2">Período de Análise Filtrado: ${periodLabel}</div>
            </td>
          </tr>
          <tr><td colspan="7" style="border:none;"></td></tr>
    `;

    if (mode === 'all' || activeTab === 'escalas') {
      html += `
          <tr><td colspan="7" class="section-title">1. EXTRATO DETALHADO DE ESCALAS (ORDEM CRESCENTE)</td></tr>
          <tr>
            <th>Data do Plantão</th>
            <th>Setor de Atuação</th>
            <th>Profissional Alocado</th>
            <th>Horário</th>
            <th>Status Operacional</th>
            <th>Carga (h)</th>
            <th>Custo Estimado (R$)</th>
          </tr>
      `;
      filteredShifts.forEach((s, i) => {
        const isVago = isVacant(s);
        const isPast = isShiftPast(s);
        let statusTexto = s.status || 'Confirmado';
        let profName = titleCase(getShiftName(s)) || 'Não Identificado';
        let rowClass = i % 2 === 0 ? '' : 'class="row-alt"';

        if (isVago) {
          if (isPast) { profName = 'FALTA / NÃO OCUPADO'; statusTexto = 'Furo de Escala'; rowClass = 'class="furo"'; }
          else { profName = 'VAGA EM ABERTO'; statusTexto = 'Vago'; rowClass = 'class="vago"'; }
        }

        const cost = getProfessionalCost(getProf(s), getShiftHours(s));
        html += `
          <tr ${rowClass}>
            <td>${formatDate(s.date)}</td>
            <td>${getSectorName(s, sectors)}</td>
            <td>${profName}</td>
            <td>${s.start_time || ''} às ${s.end_time || ''}</td>
            <td>${statusTexto}</td>
            <td>${getShiftHours(s)}h</td>
            <td class="money">${cost.toFixed(2).replace('.', ',')}</td>
          </tr>
        `;
      });
      html += `<tr><td colspan="7" style="border:none;"></td></tr>`;
    }

    if (mode === 'all' || activeTab === 'profissionais') {
      html += `
          <tr><td colspan="6" class="section-title">2. MATRIZ DE PRODUTIVIDADE MÉDICA (CORPO CLÍNICO)</td></tr>
          <tr>
            <th>Nome do Profissional</th>
            <th>Especialidade Principal</th>
            <th>Setores Atuados no Período</th>
            <th>Nº Plantões</th>
            <th>Horas Realizadas</th>
            <th>Honorários Brutos (R$)</th>
          </tr>
      `;
      professionalMetrics.forEach((doc, i) => {
        const rowClass = i % 2 === 0 ? '' : 'class="row-alt"';
        html += `
          <tr ${rowClass}>
            <td style="font-weight:bold;">${doc.name}</td>
            <td>${doc.specialty}</td>
            <td>${doc.sectors}</td>
            <td style="text-align:center;">${doc.shifts}</td>
            <td style="text-align:center;">${doc.hours}h</td>
            <td class="money">${doc.cost.toFixed(2).replace('.', ',')}</td>
          </tr>
        `;
      });
    }

    html += `
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Dossie_${mode === 'all' ? 'Completo' : activeTab}_${appliedFilters.start}_a_${appliedFilters.end}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const triggerPrint = (mode) => {
    if (!hasSearched) {
      alert('Atenção: Aplique os filtros para renderizar a telemetria antes de imprimir.');
      return;
    }
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <>
      {/* ========================================== */}
      {/* MODO TELA (DARK THEME / APP)                 */}
      {/* ========================================== */}
      <div className="min-h-screen bg-[#0B1120] text-slate-100 p-4 md:p-8 space-y-6 font-sans print:hidden">
        
        {/* TOPO EXECUTIVO PREMIUM MEDITECH */}
        <div className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 md:p-8 text-white shadow-2xl flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
              <Activity className="w-4 h-4 text-cyan-400 animate-pulse" /> {company?.name || 'Meditech CCO'} • Intelligence
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Central de Relatórios & BI Hospitalar
            </h1>
            <p className="text-xs text-slate-400 font-medium max-w-2xl">
              Filtre períodos personalizados para auditoria de produtividade, furos de escala e consolidação de custos.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <div className="flex gap-2 w-full sm:w-auto">
              <Button onClick={() => triggerExcelExport('current')} variant="outline" disabled={!hasSearched} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] px-4 rounded-xl border-slate-700 gap-2 cursor-pointer shadow-md disabled:opacity-50">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Excel (Aba)
              </Button>
              <Button onClick={() => triggerExcelExport('all')} variant="outline" disabled={!hasSearched} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] px-4 rounded-xl border-slate-700 gap-2 cursor-pointer shadow-md disabled:opacity-50">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Excel (Tudo)
              </Button>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button onClick={() => triggerPrint('current')} disabled={!hasSearched} className="flex-1 bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-[11px] px-4 rounded-xl shadow-lg gap-2 cursor-pointer disabled:opacity-50 border border-cyan-500/50">
                <PrinterIcon className="w-4 h-4" /> PDF (Aba)
              </Button>
              <Button onClick={() => triggerPrint('all')} disabled={!hasSearched} className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-[11px] px-4 rounded-xl shadow-lg gap-2 cursor-pointer transition-all disabled:opacity-50 border border-cyan-500">
                <PrinterIcon className="w-4 h-4" /> Dossiê Completo
              </Button>
            </div>
          </div>
        </div>

        {/* PAINEL DE FILTROS PERSONALIZÁVEL */}
        <Card className="p-5 rounded-3xl border border-slate-800 bg-[#1e293b] shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/50 pb-3">
            <span className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Filter className="w-4 h-4 text-cyan-400" /> Parâmetros Analíticos Livres
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Data Inicial</Label>
              <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-11 text-xs bg-[#0B1120] border-slate-700 text-white rounded-xl focus:ring-cyan-500 [color-scheme:dark]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Data Final</Label>
              <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-11 text-xs bg-[#0B1120] border-slate-700 text-white rounded-xl focus:ring-cyan-500 [color-scheme:dark]" />
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
              <Label className="text-[10px] font-black uppercase text-slate-400">Busca Rápida</Label>
              <Input placeholder="Nome do médico..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-11 text-xs bg-[#0B1120] border-slate-700 text-white rounded-xl focus:border-cyan-500" />
            </div>
            <div>
              <Button onClick={handleApplyFilters} className="w-full h-11 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs rounded-xl shadow-lg gap-2 cursor-pointer transition-all border border-cyan-500/50">
                <Check className="w-4 h-4" /> Extrair Dados
              </Button>
            </div>
          </div>
        </Card>

        {/* ESTADO INICIAL */}
        {!hasSearched ? (
          <Card className="p-16 md:p-24 rounded-3xl border border-dashed border-slate-800 bg-[#1e293b]/50 text-center space-y-4 shadow-xl">
            <div className="w-20 h-20 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/20">
              <Filter className="w-10 h-10 animate-pulse" />
            </div>
            <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">Pronto para Análise</h3>
            <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">Defina o período desejado e os parâmetros de busca acima e clique em <b>Extrair Dados</b>.</p>
          </Card>
        ) : (
          <>
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {[
                { id: 'executivo', label: 'Dashboard Executivo', icon: BarChart3 },
                { id: 'escalas', label: 'Extrato de Plantões', icon: CalendarDays },
                { id: 'profissionais', label: 'Produtividade Médica', icon: Users },
                { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
              ].map(tab => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-6 py-4 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2.5 shrink-0 border ${isActive ? 'bg-cyan-600 text-white border-cyan-500 shadow-lg shadow-cyan-900/50' : 'bg-[#1e293b] border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                    <Icon className="w-4 h-4" /> {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-6">
              {/* ABA EXECUTIVO */}
              {activeTab === 'executivo' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-5 shadow-lg relative overflow-hidden group">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total de Plantões</p>
                      <p className="mt-2 text-3xl font-black text-white font-mono tracking-tight">{formatNumber(totalShiftsCount)}</p>
                      <div className="mt-3 text-[11px] text-slate-400 font-bold flex flex-col gap-1">
                        <span className="text-teal-400">{filledShiftsCount} Ocupados</span>
                        {vacantShiftsCount > 0 && <span className="text-rose-400">{vacantShiftsCount} Furos/Vagos</span>}
                      </div>
                    </Card>
                    <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-5 shadow-lg relative overflow-hidden group">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Taxa de Ocupação Real</p>
                      <p className={`mt-2 text-3xl font-black font-mono tracking-tight ${coverageRate >= 98 ? 'text-emerald-400' : coverageRate >= 90 ? 'text-amber-400' : 'text-rose-400'}`}>{coverageRate}%</p>
                      <div className="mt-3 text-[11px] text-slate-400 font-bold">Meta Hospitalar: &gt; 98%</div>
                    </Card>
                    <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-5 shadow-lg relative overflow-hidden group">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Custo Total Global</p>
                      <p className="mt-2 text-3xl font-black text-amber-400 font-mono tracking-tight">{formatCurrency(financialSummary.totalCost)}</p>
                      <div className="mt-3 text-[11px] text-slate-400 font-bold">{formatNumber(financialSummary.hours)} Horas Calculadas</div>
                    </Card>
                    <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-5 shadow-lg relative overflow-hidden group">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Profissionais Cadastrados</p>
                      <p className="mt-2 text-3xl font-black text-white font-mono tracking-tight">{professionals.length}</p>
                      <div className="mt-3 text-[10px] text-slate-400 font-bold flex flex-col gap-0.5">
                         <span className={credentialAudit.expired > 0 ? 'text-rose-400' : ''}>{credentialAudit.expired} Docs Vencidos</span>
                         <span className="text-amber-400">{credentialAudit.nearExpiry} Vencem em 30d</span>
                      </div>
                    </Card>
                  </div>
                  {vacantShiftItems.length > 0 && (
                    <Card className="rounded-3xl border border-rose-500/30 bg-rose-950/20 p-6 shadow-lg">
                      <div className="flex items-center gap-3 border-b border-rose-500/20 pb-4">
                        <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
                        <h3 className="text-sm font-black uppercase tracking-widest text-rose-400">Ocorrências: Furos de Escala ou Vagas em Aberto ({vacantShiftItems.length})</h3>
                      </div>
                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {vacantShiftItems.slice(0, 15).map((v, i) => {
                          const isPast = isShiftPast(v);
                          return (
                            <div key={i} className={`p-3 rounded-2xl border flex items-center justify-between shadow-sm ${isPast ? 'bg-rose-950/50 border-rose-500/50' : 'bg-[#1e293b] border-amber-500/30'}`}>
                              <div>
                                <strong className="text-xs text-white block">{getSectorName(v, sectors)}</strong>
                                <span className="text-[10px] text-slate-400">Data: {formatDate(v.date)}</span>
                              </div>
                              <span className={`font-mono text-[10px] font-bold px-2 py-1 rounded-lg border ${isPast ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}>
                                {isPast ? 'NÃO OCUPADO' : 'EM ABERTO'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* ABA ESCALAS */}
              {activeTab === 'escalas' && (
                <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 shadow-lg animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between border-b border-slate-700/50 pb-4">
                    <h3 className="font-black text-sm uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                      <CalendarDays className="w-5 h-5" /> Extrato de Escalas ({filteredShifts.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-700 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          <th className="py-3 px-3">Data</th>
                          <th className="py-3 px-3">Setor</th>
                          <th className="py-3 px-3">Profissional Alocado</th>
                          <th className="py-3 px-3">Horário</th>
                          <th className="py-3 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50 font-medium">
                        {filteredShifts.map((s, idx) => {
                          const isVago = isVacant(s);
                          const isPast = isShiftPast(s);
                          let profNameRender = titleCase(s.professional_name) || 'Não Identificado';
                          let badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                          let badgeText = s.status || 'Confirmado';

                          if (isVago) {
                            if (isPast) {
                              profNameRender = <span className="text-rose-500">⚠️ FALTA / NÃO OCUPADO</span>;
                              badgeClass = 'bg-rose-500/20 text-rose-500 border-rose-500/50';
                              badgeText = 'Furo de Escala';
                            } else {
                              profNameRender = <span className="text-amber-400">⚠️ VAGA EM ABERTO</span>;
                              badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
                              badgeText = 'Vago';
                            }
                          }

                          return (
                            <tr key={s.id || idx} className="hover:bg-slate-900/50 transition-colors">
                              <td className="py-3 px-3 font-bold font-mono text-slate-300">{formatDate(s.date)}</td>
                              <td className="py-3 px-3 text-slate-300">{getSectorName(s, sectors)}</td>
                              <td className={`py-3 px-3 font-black text-white`}>{profNameRender}</td>
                              <td className="py-3 px-3 font-mono text-slate-400">{s.start_time || '07:00'} - {s.end_time || '19:00'}</td>
                              <td className="py-3 px-3"><span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase border ${badgeClass}`}>{badgeText}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* ABA PROFISSIONAIS */}
              {activeTab === 'profissionais' && (
                <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 shadow-lg animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between border-b border-slate-700/50 pb-4">
                    <h3 className="font-black text-sm uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                      <Stethoscope className="w-5 h-5" /> Matriz de Produtividade Clínica ({professionalMetrics.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-700 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          <th className="py-3 px-3">Profissional</th>
                          <th className="py-3 px-3">Especialidade</th>
                          <th className="py-3 px-3 text-center">Nº Plantões</th>
                          <th className="py-3 px-3 text-right">Carga Horária</th>
                          <th className="py-3 px-3 text-right">Honorários (R$)</th>
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
                            <td className="py-3 px-3 text-slate-400">{doc.specialty}</td>
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

              {/* ABA FINANCEIRO */}
              {activeTab === 'financeiro' && (
                <Card className="rounded-3xl border border-slate-800 bg-[#1e293b] p-6 shadow-lg animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between border-b border-slate-700/50 pb-4">
                    <h3 className="font-black text-sm uppercase tracking-widest text-amber-400 flex items-center gap-2">
                      <DollarSign className="w-5 h-5" /> Inteligência Financeira e Orçamento
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4">
                    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-inner">
                      <span className="text-[10px] font-black uppercase text-slate-400">Total Previsão Global</span>
                      <div className="text-2xl font-black font-mono text-white mt-2">{formatCurrency(financialSummary.totalCost)}</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-inner">
                      <span className="text-[10px] font-black uppercase text-emerald-400">Valor Realizado</span>
                      <div className="text-2xl font-black font-mono text-emerald-400 mt-2">{formatCurrency(financialSummary.executedCost)}</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-inner">
                      <span className="text-[10px] font-black uppercase text-amber-400">Valor Pendente</span>
                      <div className="text-2xl font-black font-mono text-amber-400 mt-2">{formatCurrency(financialSummary.pendingCost)}</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 shadow-inner">
                      <span className="text-[10px] font-black uppercase text-rose-400">Custo de Vagas / Furos</span>
                      <div className="text-2xl font-black font-mono text-rose-400 mt-2">{formatCurrency(financialSummary.vacantCost)}</div>
                    </div>
                  </div>
                  <div className="mt-8 border-t border-slate-700/50 pt-6">
                    <h4 className="text-xs font-black uppercase text-slate-400 mb-4">Orçamento por Setor Clínico</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-700 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                            <th className="py-2 px-2">Setor Clínico</th>
                            <th className="py-2 px-2 text-right">Horas Assistenciais</th>
                            <th className="py-2 px-2 text-right">Custo Projetado</th>
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
            </div>
          </>
        )}
      </div>

      {/* ========================================== */}
      {/* MODO IMPRESSÃO (NATIVO BROWSER - A4 HTML)    */}
      {/* ========================================== */}
      <div className="hidden print:block w-full text-black bg-white p-4 font-sans text-xs">
        {hasSearched ? (
          <>
            {/* CABEÇALHO */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6">
              <h1 className="text-2xl font-black uppercase text-slate-900">{company?.name || 'Hospital Santa Clara'}</h1>
              <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">Dossiê Executivo de Escalas & Corpo Clínico</p>
              <div className="flex justify-between mt-2 pt-2 border-t border-slate-300 text-[10px]">
                <span><b>Período Analisado:</b> {periodLabel}</span>
                <span><b>Data da Emissão:</b> {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</span>
              </div>
            </div>

            {/* SEÇÃO RENDERIZADA BASEADA NO PRINTMODE (ABA OU TUDO) */}
            {(printMode === 'all' || activeTab === 'executivo') && (
              <div className="mb-8 break-inside-avoid">
                <h2 className="text-sm font-black bg-slate-100 p-2 border border-slate-300 uppercase mb-4">1. Resumo Operacional Global</h2>
                <table className="w-full text-left border-collapse border border-slate-300 mb-6 text-[11px]">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <th className="p-2 border-r border-slate-300 bg-slate-50 w-1/4">Total de Plantões:</th>
                      <td className="p-2 border-r border-slate-300 font-bold">{totalShiftsCount}</td>
                      <th className="p-2 border-r border-slate-300 bg-slate-50 w-1/4">Preenchidos / Vagos:</th>
                      <td className="p-2 font-bold">{filledShiftsCount} / <span className="text-rose-600">{vacantShiftsCount}</span></td>
                    </tr>
                    <tr>
                      <th className="p-2 border-r border-slate-300 bg-slate-50">Taxa de Cobertura:</th>
                      <td className="p-2 border-r border-slate-300 font-bold">{coverageRate}%</td>
                      <th className="p-2 border-r border-slate-300 bg-slate-50">Custo Total Projetado:</th>
                      <td className="p-2 font-bold">{formatCurrency(financialSummary.totalCost)}</td>
                    </tr>
                  </tbody>
                </table>

                {vacantShiftItems.length > 0 && (
                  <>
                    <h2 className="text-sm font-black bg-rose-100 text-rose-900 p-2 border border-rose-300 uppercase mb-4">Atenção: Ocorrências de Furos e Vagas em Aberto ({vacantShiftItems.length})</h2>
                    <table className="w-full text-left border-collapse border border-slate-300 mb-8 text-[10px]">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 uppercase">
                          <th className="p-2 border-r border-slate-300">Data</th>
                          <th className="p-2 border-r border-slate-300">Setor Clínico</th>
                          <th className="p-2 border-r border-slate-300 text-center">Horário</th>
                          <th className="p-2 text-center">Diagnóstico</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vacantShiftItems.map((v, i) => {
                          const isPast = isShiftPast(v);
                          return (
                            <tr key={i} className="border-b border-slate-300 break-inside-avoid">
                              <td className="p-2 border-r border-slate-300 font-bold">{formatDate(v.date)}</td>
                              <td className="p-2 border-r border-slate-300">{getSectorName(v, sectors)}</td>
                              <td className="p-2 border-r border-slate-300 font-mono text-center">{v.start_time} - {v.end_time}</td>
                              <td className={`p-2 font-bold text-center ${isPast ? 'text-rose-700 bg-rose-50' : 'text-amber-700 bg-amber-50'}`}>
                                {isPast ? 'NÃO OCUPADO (FURO DE ESCALA)' : 'VAGA PENDENTE NO FUTURO'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            )}

            {(printMode === 'all' || activeTab === 'profissionais') && (
              <div className="mb-8 break-inside-avoid">
                <h2 className="text-sm font-black bg-slate-100 p-2 border border-slate-300 uppercase mb-4">Matriz de Produtividade Médica (Todos os Profissionais)</h2>
                <table className="w-full text-left border-collapse border border-slate-300 text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 uppercase">
                      <th className="p-2 border-r border-slate-300">Profissional</th>
                      <th className="p-2 border-r border-slate-300">Especialidade</th>
                      <th className="p-2 border-r border-slate-300 text-center">Nº Plantões</th>
                      <th className="p-2 border-r border-slate-300 text-center">Horas</th>
                      <th className="p-2 text-right">Honorários (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {professionalMetrics.map((doc, idx) => (
                      <tr key={idx} className="border-b border-slate-300 break-inside-avoid">
                        <td className="p-2 border-r border-slate-300 font-bold">{doc.name}</td>
                        <td className="p-2 border-r border-slate-300">{doc.specialty}</td>
                        <td className="p-2 border-r border-slate-300 text-center font-bold">{doc.shifts}</td>
                        <td className="p-2 border-r border-slate-300 text-center font-mono">{doc.hours}h</td>
                        <td className="p-2 text-right font-mono font-bold">{formatCurrency(doc.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(printMode === 'all' || activeTab === 'financeiro') && (
              <div className="mb-8 break-inside-avoid">
                <h2 className="text-sm font-black bg-slate-100 p-2 border border-slate-300 uppercase mb-4">Relatório de Inteligência Financeira e Custos</h2>
                <table className="w-full text-left border-collapse border border-slate-300 mb-6 text-[11px]">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <th className="p-2 border-r border-slate-300 bg-slate-50 w-1/4">Valor Total Previsão Global:</th>
                      <td className="p-2 border-r border-slate-300 font-bold">{formatCurrency(financialSummary.totalCost)}</td>
                      <th className="p-2 border-r border-slate-300 bg-emerald-50 w-1/4 text-emerald-800">Valor Realizado Concluído:</th>
                      <td className="p-2 font-bold text-emerald-800 bg-emerald-50">{formatCurrency(financialSummary.executedCost)}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <th className="p-2 border-r border-slate-300 bg-amber-50 text-amber-800">Valor Pendente a Realizar:</th>
                      <td className="p-2 border-r border-slate-300 font-bold text-amber-800 bg-amber-50">{formatCurrency(financialSummary.pendingCost)}</td>
                      <th className="p-2 border-r border-slate-300 bg-rose-50 text-rose-800">Valor Retido (Vagas e Furos):</th>
                      <td className="p-2 font-bold text-rose-800 bg-rose-50">{formatCurrency(financialSummary.vacantCost)}</td>
                    </tr>
                  </tbody>
                </table>

                <h2 className="text-sm font-black bg-slate-100 p-2 border border-slate-300 uppercase mb-4">Desdobramento de Custos por Setor</h2>
                <table className="w-full text-left border-collapse border border-slate-300 text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 uppercase">
                      <th className="p-2 border-r border-slate-300">Setor Clínico / Unidade</th>
                      <th className="p-2 border-r border-slate-300 text-center">Horas Assistenciais</th>
                      <th className="p-2 text-right">Alocação Orçamentária (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectorMetrics.map((sec, idx) => (
                      <tr key={idx} className="border-b border-slate-300 break-inside-avoid">
                        <td className="p-2 border-r border-slate-300 font-bold">{sec.name}</td>
                        <td className="p-2 border-r border-slate-300 text-center font-mono">{sec.hours}h</td>
                        <td className="p-2 text-right font-mono font-bold">{formatCurrency(sec.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(printMode === 'all' || activeTab === 'escalas') && (
              <div className="mb-8 break-inside-avoid">
                <h2 className="text-sm font-black bg-slate-100 p-2 border border-slate-300 uppercase mb-4">Extrato Detalhado de Escalas de Trabalho</h2>
                <table className="w-full text-left border-collapse border border-slate-300 text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 uppercase">
                      <th className="p-2 border-r border-slate-300">Data</th>
                      <th className="p-2 border-r border-slate-300">Setor Clínico</th>
                      <th className="p-2 border-r border-slate-300">Profissional</th>
                      <th className="p-2 border-r border-slate-300 text-center">Horário</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShifts.map((s, idx) => {
                      const isVago = isVacant(s);
                      const isPast = isShiftPast(s);
                      let profNameRender = titleCase(s.professional_name);
                      let badgeText = s.status || 'Confirmado';
                      let cssClass = '';

                      if (isVago) {
                        if (isPast) { profNameRender = 'NÃO OCUPADO (FURO)'; badgeText = 'Sem Cobertura'; cssClass = 'text-rose-700 font-bold'; }
                        else { profNameRender = 'VAGA EM ABERTO'; badgeText = 'Vago'; cssClass = 'text-amber-700 font-bold'; }
                      }

                      return (
                        <tr key={s.id || idx} className="border-b border-slate-300 break-inside-avoid">
                          <td className="p-2 border-r border-slate-300 font-bold">{formatDate(s.date)}</td>
                          <td className="p-2 border-r border-slate-300">{getSectorName(s, sectors)}</td>
                          <td className={`p-2 border-r border-slate-300 ${cssClass}`}>{profNameRender}</td>
                          <td className="p-2 border-r border-slate-300 font-mono text-center">{s.start_time} - {s.end_time}</td>
                          <td className={`p-2 text-center uppercase ${cssClass}`}>{badgeText}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-12 text-center text-[10px] text-slate-500">
              Documento gerado eletronicamente através do sistema Meditech Hospital Admin.<br/>
              Confidencial - Uso restrito à diretoria médica.
            </div>
          </>
        ) : (
          <div className="text-center p-20 text-xl font-bold">Nenhum filtro aplicado. Impossível gerar dossiê.</div>
        )}
      </div>

    </>
  );
}