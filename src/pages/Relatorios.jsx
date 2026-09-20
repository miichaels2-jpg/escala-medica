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
  Filter, Check, Target, ShieldCheck, Contact2
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
  const type = normalize(meta.remuneration_type || meta.remunerationType || meta.payment_type || 'mensal');

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
  
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [dateStart, setDateStart] = useState(firstDay);
  const [dateEnd, setDateEnd] = useState(lastDay);
  const [selectedSector, setSelectedSector] = useState('todos');
  const [profStatusFilter, setProfStatusFilter] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');

  const [hasSearched, setHasSearched] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({
    start: firstDay,
    end: lastDay,
    sector: 'todos',
    profStatus: 'todos',
    search: ''
  });

  const handleApplyFilters = () => {
    setAppliedFilters({
      start: dateStart,
      end: dateEnd,
      sector: selectedSector,
      profStatus: profStatusFilter,
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

  // Filtragem flexível com ORDENAÇÃO CRESCENTE DE DATA/HORA
  const filteredShifts = useMemo(() => {
    if (!hasSearched) return [];
    const term = normalize(appliedFilters.search);

    const filtered = shifts.filter(shift => {
      if (!shift || normalize(shift.status) === 'cancelado') return false;
      const rawSecName = getSectorName(shift, sectors);
      const secName = normalize(rawSecName);
      if (!secName || secName === 'setor' || secName.includes('setor geral')) return false;
      if (appliedFilters.sector !== 'todos' && String(shift.sector_id) !== String(appliedFilters.sector)) return false;

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

    return filtered.sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const timeA = a.start_time || '00:00';
      const timeB = b.start_time || '00:00';
      return timeA.localeCompare(timeB);
    });
  }, [shifts, sectors, appliedFilters, hasSearched]);

  const filteredProfessionals = useMemo(() => {
    if (!hasSearched) return [];
    const term = normalize(appliedFilters.search);
    
    return professionals.filter(p => {
      const status = normalize(p.status || 'ativo');
      if (appliedFilters.profStatus === 'ativo' && status !== 'ativo') return false;
      if (appliedFilters.profStatus === 'inativo' && status !== 'inativo') return false;
      
      const meta = getProfessionalMeta(p);
      const name = normalize(p.name);
      const spec = normalize(meta.specialty || '');
      
      if (term && !name.includes(term) && !spec.includes(term)) return false;
      return true;
    }).map(p => {
      const meta = getProfessionalMeta(p);
      return {
        ...p,
        ...meta,
        specialty: titleCase(meta.specialty || meta.main_sector || 'Clínico Geral')
      };
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [professionals, appliedFilters, hasSearched]);

  const { totalShiftsCount, filledShiftsCount, vacantShiftsCount, vacantShiftItems } = useMemo(() => {
    let filled = 0;
    let vacantItems = [];
    filteredShifts.forEach(s => {
      if (!isVacant(s)) filled++;
      else vacantItems.push(s);
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
      if (!map[id]) map[id] = { id, name: titleCase(sName), total: 0, filled: 0, vacant: 0, hours: 0, cost: 0 };
      
      const item = map[id];
      item.total += 1;
      item.hours += getShiftHours(shift);
      if (isVacant(shift)) item.vacant += 1;
      else item.filled += 1;
      item.cost += getProfessionalCost(getProf(shift), getShiftHours(shift));
    });
    return Object.values(map).filter(item => item.total > 0).sort((a, b) => b.total - a.total);
  }, [sectors, filteredShifts, getProf]);

  const enrichedSectors = useMemo(() => {
    if (!hasSearched) return [];
    const term = normalize(appliedFilters.search);

    return sectors.filter(s => {
      const n = normalize(s.name);
      const spec = normalize(s.specialty);
      if (term && !n.includes(term) && !spec.includes(term)) return false;
      if (appliedFilters.sector !== 'todos' && String(s.id) !== String(appliedFilters.sector)) return false;
      return true;
    }).map(s => {
      const metric = sectorMetrics.find(m => String(m.id) === String(s.id));
      return {
        ...s,
        shiftsCount: metric ? metric.total : 0,
        totalCost: metric ? metric.cost : 0,
        totalHours: metric ? metric.hours : 0
      };
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [sectors, sectorMetrics, appliedFilters, hasSearched]);

  const professionalMetrics = useMemo(() => {
    const map = {};
    filteredProfessionals.forEach(p => {
      const name = normalize(p.name);
      if (name) {
        map[name] = { 
          id: p.id || name, 
          name: titleCase(p.name), 
          specialty: p.specialty,
          shifts: 0, hours: 0, sectors: new Set(), cost: 0 
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
          shifts: 0, hours: 0, sectors: new Set(), cost: 0 
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
  }, [filteredShifts, filteredProfessionals, sectors, getProf]);

  const credentialAudit = useMemo(() => {
    let valid = 0, expired = 0, nearExpiry = 0, missing = 0;
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);

    filteredProfessionals.forEach(p => {
      const expiry = p.document_expiry || p.documentExpiry || p.valid_until || '';
      if (!expiry) { missing += 1; return; }
      const expiryDate = new Date(expiry);
      if (Number.isNaN(expiryDate.getTime())) { missing += 1; return; }
      
      expiryDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((expiryDate.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) expired += 1;
      else if (diffDays <= 30) nearExpiry += 1;
      else valid += 1;
    });

    return { valid, expired, nearExpiry, missing, total: filteredProfessionals.length };
  }, [filteredProfessionals]);

  const periodLabel = `${formatDate(appliedFilters.start)} até ${formatDate(appliedFilters.end)}`;
  const hospitalName = company?.name || 'Hospital Principal';

  // ==========================================
  // EXPORTAÇÃO EXCEL NATIVA
  // ==========================================
  const triggerExcelExport = (mode) => {
    if (!hasSearched) {
      alert('Atenção: Aplique os filtros antes de exportar a planilha.');
      return;
    }

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
              <div class="h1">${hospitalName} - Relatório de Gestão Hospitalar</div>
              <div class="h2">Período Filtrado: ${periodLabel}</div>
            </td>
          </tr>
          <tr><td colspan="7" style="border:none;"></td></tr>
    `;

    if (mode === 'all' || activeTab === 'escalas') {
      html += `
          <tr><td colspan="7" class="section-title">EXTRATO DETALHADO DE ESCALAS (Cronológico)</td></tr>
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
      html += `<tr><td colspan="7" style="border:none; height:20px;"></td></tr>`;
    }

    if (mode === 'all' || activeTab === 'base_setores') {
      html += `
          <tr><td colspan="5" class="section-title">ESTRUTURA DE SETORES</td></tr>
          <tr>
            <th>Nome do Setor</th>
            <th>Especialidade Exigida</th>
            <th>Status</th>
            <th>Plantões no Período</th>
            <th>Custo Projetado (R$)</th>
          </tr>
      `;
      enrichedSectors.forEach((s, i) => {
        const rowClass = i % 2 === 0 ? '' : 'class="row-alt"';
        html += `
          <tr ${rowClass}>
            <td style="font-weight:bold;">${titleCase(s.name)}</td>
            <td>${s.specialty || 'Não def.'}</td>
            <td>${(s.status || 'Ativo').toUpperCase()}</td>
            <td>${s.shiftsCount}</td>
            <td class="money">${s.totalCost.toFixed(2).replace('.', ',')}</td>
          </tr>
        `;
      });
      html += `<tr><td colspan="5" style="border:none; height:20px;"></td></tr>`;
    }

    if (mode === 'all' || activeTab === 'base_profissionais') {
      html += `
          <tr><td colspan="10" class="section-title">BASE DE PROFISSIONAIS (CORPO CLÍNICO)</td></tr>
          <tr>
            <th>Nome Completo</th>
            <th>Especialidade</th>
            <th>Status</th>
            <th>Documento (CRM)</th>
            <th>Vencimento Doc.</th>
            <th>Telefone</th>
            <th>E-mail</th>
            <th>Tipo Remuneração</th>
            <th>Banco</th>
            <th>Chave PIX</th>
          </tr>
      `;
      filteredProfessionals.forEach((p, i) => {
        const rowClass = i % 2 === 0 ? '' : 'class="row-alt"';
        const vencimento = formatDate(p.document_expiry || p.documentExpiry || p.valid_until);
        const isVencido = p.document_expiry && new Date(p.document_expiry) < new Date() ? 'class="furo"' : '';
        html += `
          <tr ${rowClass}>
            <td style="font-weight:bold;">${titleCase(p.name)}</td>
            <td>${p.specialty || 'Não inf.'}</td>
            <td>${(p.status || 'Ativo').toUpperCase()}</td>
            <td>${p.document || 'Não inf.'}</td>
            <td ${isVencido}>${vencimento}</td>
            <td>${p.phone || p.telefone || 'Não inf.'}</td>
            <td>${p.email || 'Não inf.'}</td>
            <td>${titleCase(p.remuneration_type || p.payment_type || 'Mensal')}</td>
            <td>${p.bank_name || p.banco || 'Não inf.'}</td>
            <td>${p.pix_key || p.chave_pix || p.pix || 'Não inf.'}</td>
          </tr>
        `;
      });
      html += `<tr><td colspan="10" style="border:none; height:20px;"></td></tr>`;
    }

    if (mode === 'all' || activeTab === 'profissionais') {
      html += `
          <tr><td colspan="6" class="section-title">MATRIZ DE PRODUTIVIDADE MÉDICA (No Período)</td></tr>
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
      html += `<tr><td colspan="6" style="border:none; height:20px;"></td></tr>`;
    }

    if (mode === 'all' || activeTab === 'financeiro') {
      html += `
          <tr><td colspan="4" class="section-title">RELATÓRIO FINANCEIRO OPERACIONAL</td></tr>
          <tr>
            <th colspan="2">Total Previsão Global</th>
            <th colspan="2" style="background-color: #047857;">Realizado Concluído</th>
          </tr>
          <tr>
            <td colspan="2" class="money" style="font-weight:bold; font-size:16px;">${financialSummary.totalCost.toFixed(2).replace('.', ',')}</td>
            <td colspan="2" class="money" style="font-weight:bold; font-size:16px; color:#047857;">${financialSummary.executedCost.toFixed(2).replace('.', ',')}</td>
          </tr>
          <tr>
            <th colspan="2" style="background-color: #b45309;">Valor Pendente a Realizar</th>
            <th colspan="2" style="background-color: #be123c;">Valor Retido (Vagas e Furos)</th>
          </tr>
          <tr>
            <td colspan="2" class="money" style="font-weight:bold; font-size:16px; color:#b45309;">${financialSummary.pendingCost.toFixed(2).replace('.', ',')}</td>
            <td colspan="2" class="money" style="font-weight:bold; font-size:16px; color:#be123c;">${financialSummary.vacantCost.toFixed(2).replace('.', ',')}</td>
          </tr>
          <tr><td colspan="4" style="border:none; height: 20px;"></td></tr>
          <tr><td colspan="4" class="section-title">CUSTOS DESDOBRADOS POR SETOR CLÍNICO</td></tr>
          <tr>
            <th colspan="2">Setor Clínico / Unidade</th>
            <th class="text-center">Horas Assistenciais</th>
            <th class="text-right">Alocação Orçamentária (R$)</th>
          </tr>
      `;
      sectorMetrics.forEach((sec, i) => {
        const rowClass = i % 2 === 0 ? '' : 'class="row-alt"';
        html += `
          <tr ${rowClass}>
            <td colspan="2" style="font-weight:bold;">${sec.name}</td>
            <td style="text-align:center;">${sec.hours}h</td>
            <td class="money">${sec.cost.toFixed(2).replace('.', ',')}</td>
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
    link.download = `Relatorio_${mode === 'all' ? 'Completo' : activeTab}_${appliedFilters.start}_a_${appliedFilters.end}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ==========================================
  // IMPRESSÃO HTML PURA (Isolada, A4 Branco c/ Quebra)
  // ==========================================
  const triggerPrint = (mode) => {
    if (!hasSearched) {
      alert('Atenção: Aplique os filtros para renderizar a telemetria antes de imprimir.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Permita pop-ups para abrir o relatório de impressão.');
      return;
    }

    const docEmissao = `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`;

    let printHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Dossiê Oficial - ${hospitalName}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, Helvetica, sans-serif; background: #ffffff !important; color: #000000 !important; font-size: 11px; padding: 10px; }
          
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
          .h-title { font-size: 24px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin-bottom: 4px; }
          .h-subtitle { font-size: 13px; font-weight: bold; color: #334155; text-transform: uppercase; }
          .h-info { display: flex; justify-content: space-between; font-size: 10px; margin-top: 15px; padding-top: 8px; border-top: 1px solid #cbd5e1; }
          
          .section-title { font-size: 13px; font-weight: 900; background-color: #f1f5f9; padding: 8px; border: 1px solid #94a3b8; text-transform: uppercase; margin-bottom: 12px; page-break-after: avoid; }
          .section-title.alert { background-color: #fee2e2; color: #9f1239; border-color: #fda4af; }
          
          table { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 30px; page-break-inside: auto; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th { background-color: #f8fafc; border: 1px solid #94a3b8; padding: 8px; text-align: left; font-size: 9.5px; font-weight: 900; text-transform: uppercase; }
          td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: middle; }
          
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .furo { color: #be123c; font-weight: bold; background-color: #fff1f2; }
          .vago { color: #d97706; font-weight: bold; background-color: #fffbeb; }
          
          .grid-4 { display: table; width: 100%; margin-bottom: 20px; border-collapse: separate; border-spacing: 10px 0; }
          .grid-card { display: table-cell; border: 1px solid #94a3b8; padding: 12px; border-radius: 6px; width: 25%; }
          .card-title { font-size: 9px; font-weight: bold; color: #475569; text-transform: uppercase; margin-bottom: 6px; }
          .card-value { font-size: 18px; font-weight: 900; }
          .card-sub { font-size: 9px; font-weight: bold; margin-top: 4px; }
          
          .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #94a3b8; text-align: center; font-size: 9px; color: #64748b; }
          
          .break-before { page-break-before: always; }
          .break-inside-avoid { page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="h-title">${hospitalName}</div>
          <div class="h-subtitle">Dossiê Executivo Oficial - ScaleMedic</div>
          <div class="h-info">
            <span><b>Período Analisado:</b> ${periodLabel}</span>
            <span><b>Emissão:</b> ${docEmissao}</span>
          </div>
        </div>
    `;

    if (mode === 'all' || activeTab === 'executivo') {
      printHtml += `
        <div class="section-title break-inside-avoid">1. Resumo Operacional Global</div>
        <div class="grid-4 break-inside-avoid">
          <div class="grid-card">
            <div class="card-title">Total de Plantões</div>
            <div class="card-value">${totalShiftsCount}</div>
            <div class="card-sub" style="color:#059669;">${filledShiftsCount} Preenchidos</div>
          </div>
          <div class="grid-card">
            <div class="card-title">Taxa de Cobertura</div>
            <div class="card-value">${coverageRate}%</div>
            <div class="card-sub" style="color:#475569;">Meta: > 98%</div>
          </div>
          <div class="grid-card">
            <div class="card-title">Custo Projetado Est.</div>
            <div class="card-value">${formatCurrency(financialSummary.totalCost)}</div>
            <div class="card-sub" style="color:#475569;">${financialSummary.hours}h Assistenciais</div>
          </div>
          <div class="grid-card">
            <div class="card-title">Profissionais Ativos</div>
            <div class="card-value">${filteredProfessionals.length}</div>
            <div class="card-sub" style="color:#e11d48;">${credentialAudit.expired} Vencidos</div>
          </div>
        </div>
      `;

      if (vacantShiftItems.length > 0) {
        printHtml += `
          <div class="section-title alert break-inside-avoid">Atenção: Ocorrências de Furos e Vagas Abertas (${vacantShiftItems.length})</div>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Setor Clínico</th>
                <th class="text-center">Horário</th>
                <th class="text-center">Diagnóstico</th>
              </tr>
            </thead>
            <tbody>
        `;
        vacantShiftItems.forEach(v => {
          const isPast = isShiftPast(v);
          printHtml += `
            <tr>
              <td class="font-bold">${formatDate(v.date)}</td>
              <td>${getSectorName(v, sectors)}</td>
              <td class="text-center font-bold">${v.start_time} - ${v.end_time}</td>
              <td class="text-center ${isPast ? 'furo' : 'vago'}">${isPast ? 'NÃO OCUPADO (FALTA)' : 'VAGA PENDENTE'}</td>
            </tr>
          `;
        });
        printHtml += `</tbody></table>`;
      }
    }

    if (mode === 'all' || activeTab === 'escalas') {
      printHtml += `
        <div class="section-title ${mode === 'all' ? 'break-before' : 'break-inside-avoid'}">Extrato Detalhado de Escalas (Cronológico)</div>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Setor Clínico</th>
              <th>Profissional</th>
              <th class="text-center">Horário</th>
              <th class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
      `;
      filteredShifts.forEach(s => {
        const isVago = isVacant(s);
        const isPast = isShiftPast(s);
        let profName = titleCase(s.professional_name);
        let badgeText = s.status || 'Confirmado';
        let rowClass = '';

        if (isVago) {
          if (isPast) { profName = 'NÃO OCUPADO (FURO)'; badgeText = 'Sem Cobertura'; rowClass = 'furo'; }
          else { profName = 'VAGA EM ABERTO'; badgeText = 'Vago'; rowClass = 'vago'; }
        }

        printHtml += `
          <tr>
            <td class="font-bold">${formatDate(s.date)}</td>
            <td>${getSectorName(s, sectors)}</td>
            <td class="${rowClass}">${profName}</td>
            <td class="text-center font-bold">${s.start_time} - ${s.end_time}</td>
            <td class="text-center ${rowClass}">${badgeText.toUpperCase()}</td>
          </tr>
        `;
      });
      printHtml += `</tbody></table>`;
    }

    if (mode === 'all' || activeTab === 'base_setores') {
      printHtml += `
        <div class="section-title ${mode === 'all' ? 'break-before' : 'break-inside-avoid'}">Estrutura de Setores</div>
        <table>
          <thead>
            <tr>
              <th>Nome do Setor</th>
              <th>Especialidade Exigida</th>
              <th>Status</th>
              <th class="text-center">Plantões no Período</th>
              <th class="text-right">Custo Projetado (R$)</th>
            </tr>
          </thead>
          <tbody>
      `;
      enrichedSectors.forEach(s => {
        printHtml += `
          <tr>
            <td class="font-bold">${titleCase(s.name)}</td>
            <td>${s.specialty || 'Não def.'}</td>
            <td>${(s.status || 'Ativo').toUpperCase()}</td>
            <td class="text-center">${s.shiftsCount}</td>
            <td class="text-right font-bold">${formatCurrency(s.totalCost)}</td>
          </tr>
        `;
      });
      printHtml += `</tbody></table>`;
    }

    if (mode === 'all' || activeTab === 'base_profissionais') {
      printHtml += `
        <div class="section-title ${mode === 'all' ? 'break-before' : 'break-inside-avoid'}">Base do Corpo Clínico (${filteredProfessionals.length} profissionais)</div>
        <table>
          <thead>
            <tr>
              <th>Nome Completo</th>
              <th>Especialidade</th>
              <th>Documento (CRM)</th>
              <th>Vencimento Doc.</th>
              <th class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
      `;
      filteredProfessionals.forEach(p => {
        const expiryDate = p.document_expiry || p.documentExpiry || p.valid_until;
        const isExpired = expiryDate && new Date(expiryDate) < new Date();
        printHtml += `
          <tr>
            <td class="font-bold">${titleCase(p.name)}</td>
            <td>${p.specialty}</td>
            <td>${p.document || '—'}</td>
            <td class="${isExpired ? 'furo' : ''}">${formatDate(expiryDate)}</td>
            <td class="text-center">${(p.status || 'Ativo').toUpperCase()}</td>
          </tr>
        `;
      });
      printHtml += `</tbody></table>`;
    }

    if (mode === 'all' || activeTab === 'profissionais') {
      printHtml += `
        <div class="section-title ${mode === 'all' ? 'break-before' : 'break-inside-avoid'}">Matriz de Produtividade Médica</div>
        <table>
          <thead>
            <tr>
              <th>Profissional</th>
              <th>Especialidade</th>
              <th class="text-center">Nº Plantões</th>
              <th class="text-center">Horas Realizadas</th>
              <th class="text-right">Honorários Brutos (R$)</th>
            </tr>
          </thead>
          <tbody>
      `;
      professionalMetrics.forEach(doc => {
        printHtml += `
          <tr>
            <td class="font-bold">${doc.name}</td>
            <td>${doc.specialty}</td>
            <td class="text-center font-bold">${doc.shifts}</td>
            <td class="text-center">${doc.hours}h</td>
            <td class="text-right font-bold">${formatCurrency(doc.cost)}</td>
          </tr>
        `;
      });
      printHtml += `</tbody></table>`;
    }

    if (mode === 'all' || activeTab === 'financeiro') {
      printHtml += `
        <div class="section-title ${mode === 'all' ? 'break-before' : 'break-inside-avoid'}">Relatório Financeiro Operacional</div>
        
        <div class="grid-4 break-inside-avoid" style="margin-bottom: 30px;">
          <div class="grid-card">
            <div class="card-title">Valor Total Previsão</div>
            <div class="card-value">${formatCurrency(financialSummary.totalCost)}</div>
          </div>
          <div class="grid-card" style="background-color: #f0fdf4; border-color: #86efac;">
            <div class="card-title" style="color: #047857;">Realizado Concluído</div>
            <div class="card-value" style="color: #047857;">${formatCurrency(financialSummary.executedCost)}</div>
          </div>
          <div class="grid-card" style="background-color: #fffbeb; border-color: #fcd34d;">
            <div class="card-title" style="color: #b45309;">Pendente a Realizar</div>
            <div class="card-value" style="color: #b45309;">${formatCurrency(financialSummary.pendingCost)}</div>
          </div>
          <div class="grid-card" style="background-color: #fff1f2; border-color: #fda4af;">
            <div class="card-title" style="color: #be123c;">Vagas e Furos</div>
            <div class="card-value" style="color: #be123c;">${formatCurrency(financialSummary.vacantCost)}</div>
          </div>
        </div>

        <div class="section-title break-inside-avoid">Desdobramento de Custos por Setor</div>
        <table>
          <thead>
            <tr>
              <th>Setor Clínico / Unidade</th>
              <th class="text-center">Horas Assistenciais</th>
              <th class="text-right">Alocação Orçamentária (R$)</th>
            </tr>
          </thead>
          <tbody>
      `;
      sectorMetrics.forEach(sec => {
        printHtml += `
          <tr>
            <td class="font-bold">${sec.name}</td>
            <td class="text-center">${sec.hours}h</td>
            <td class="text-right font-bold">${formatCurrency(sec.cost)}</td>
          </tr>
        `;
      });
      printHtml += `</tbody></table>`;
    }

    printHtml += `
        <div class="footer">
          Documento processado eletronicamente através do sistema Meditech Hospital Admin.<br/>
          Informações confidenciais - Uso exclusivo da Diretoria Médica e Operacional.
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();

    // Aguarda o HTML ser renderizado pelo navegador antes de chamar o print
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 p-4 md:p-8 space-y-6 font-sans transition-colors duration-300">
      
      {/* TOPO EXECUTIVO */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] p-6 md:p-8 shadow-xl flex flex-col xl:flex-row xl:items-center justify-between gap-6 transition-colors duration-300">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-sky-600 dark:text-cyan-400">
            <Activity className="w-4 h-4 text-sky-600 dark:text-cyan-400 animate-pulse" /> {hospitalName} • Intelligence CCO
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Central de Relatórios & BI Hospitalar
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-2xl">
            Filtre períodos personalizados para auditoria de produtividade, furos de escala, corpo clínico e consolidação de custos.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={() => triggerExcelExport('current')} variant="outline" disabled={!hasSearched} className="flex-1 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold text-[11px] px-4 rounded-xl border-slate-200 dark:border-slate-700 gap-2 cursor-pointer shadow-sm disabled:opacity-50 transition-colors">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Excel (Aba)
            </Button>
            <Button onClick={() => triggerExcelExport('all')} variant="outline" disabled={!hasSearched} className="flex-1 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold text-[11px] px-4 rounded-xl border-slate-200 dark:border-slate-700 gap-2 cursor-pointer shadow-sm disabled:opacity-50 transition-colors">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Excel (Tudo)
            </Button>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={() => triggerPrint('current')} disabled={!hasSearched} className="flex-1 bg-sky-600 hover:bg-sky-700 dark:bg-cyan-700 dark:hover:bg-cyan-600 text-white font-bold text-[11px] px-4 rounded-xl shadow-md gap-2 cursor-pointer disabled:opacity-50 border border-sky-500 dark:border-cyan-500/50 transition-colors">
              <PrinterIcon className="w-4 h-4" /> PDF (Aba)
            </Button>
            <Button onClick={() => triggerPrint('all')} disabled={!hasSearched} className="flex-1 bg-sky-700 hover:bg-sky-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-black text-[11px] px-4 rounded-xl shadow-md gap-2 cursor-pointer transition-all disabled:opacity-50 border border-sky-600 dark:border-cyan-500">
              <PrinterIcon className="w-4 h-4" /> Dossiê (Tudo)
            </Button>
          </div>
        </div>
      </div>

      {/* PAINEL DE FILTROS PERSONALIZÁVEL */}
      <Card className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] shadow-md space-y-4 transition-colors">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 pb-3">
          <span className="text-xs font-black uppercase tracking-wider text-sky-600 dark:text-cyan-400 flex items-center gap-2">
            <Filter className="w-4 h-4 text-sky-600 dark:text-cyan-400" /> Parâmetros Analíticos Livres
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Data Inicial</Label>
            <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-11 text-xs bg-slate-50 dark:bg-[#0B1120] border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-sky-500 dark:focus:ring-cyan-500 dark:[color-scheme:dark] transition-colors" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Data Final</Label>
            <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-11 text-xs bg-slate-50 dark:bg-[#0B1120] border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-sky-500 dark:focus:ring-cyan-500 dark:[color-scheme:dark] transition-colors" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Setor Clínico</Label>
            <Select value={selectedSector} onValueChange={setSelectedSector}>
              <SelectTrigger className="h-11 text-xs font-bold bg-slate-50 dark:bg-[#0B1120] border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-sky-500 dark:focus:ring-cyan-500 transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white z-[99999] max-h-[300px]">
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
            <Label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Status do Médico</Label>
            <Select value={profStatusFilter} onValueChange={setProfStatusFilter}>
              <SelectTrigger className="h-11 text-xs font-bold bg-slate-50 dark:bg-[#0B1120] border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-sky-500 dark:focus:ring-cyan-500 transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white z-[99999]">
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Somente Ativos</SelectItem>
                <SelectItem value="inativo">Somente Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Busca Específica</Label>
            <Input placeholder="Médico ou setor..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-11 text-xs bg-slate-50 dark:bg-[#0B1120] border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:border-sky-500 dark:focus:border-cyan-500 transition-colors" />
          </div>
          <div>
            <Button onClick={handleApplyFilters} className="w-full h-11 bg-sky-600 hover:bg-sky-700 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-black text-xs rounded-xl shadow-lg gap-2 cursor-pointer transition-colors border-none dark:border-solid dark:border-cyan-500/50">
              <Check className="w-4 h-4" /> Extrair Dados
            </Button>
          </div>
        </div>
      </Card>

      {/* ESTADO INICIAL */}
      {!hasSearched ? (
        <Card className="p-16 md:p-24 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-[#1e293b]/50 text-center space-y-4 shadow-sm transition-colors">
          <div className="w-20 h-20 rounded-full bg-sky-50 dark:bg-cyan-500/10 text-sky-500 dark:text-cyan-400 flex items-center justify-center mx-auto border border-sky-100 dark:border-cyan-500/20">
            <Filter className="w-10 h-10 animate-pulse" />
          </div>
          <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Pronto para Análise</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">Defina o período desejado e os parâmetros de busca acima e clique em <b>Extrair Dados</b>.</p>
        </Card>
      ) : (
        <>
          {/* ABAS DE NAVEGAÇÃO DA TELA */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {[
              { id: 'executivo', label: 'Dashboard Executivo', icon: BarChart3 },
              { id: 'escalas', label: 'Extrato de Plantões', icon: CalendarDays },
              { id: 'base_setores', label: 'Estrutura de Setores', icon: Building2 },
              { id: 'base_profissionais', label: 'Base de Profissionais', icon: Contact2 },
              { id: 'profissionais', label: 'Produtividade Médica', icon: Users },
              { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button 
                  key={tab.id} 
                  onClick={() => setActiveTab(tab.id)} 
                  className={`px-6 py-4 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2.5 shrink-0 border ${
                    isActive 
                      ? 'bg-sky-600 dark:bg-cyan-600 text-white border-sky-600 dark:border-cyan-500 shadow-md shadow-sky-600/20 dark:shadow-cyan-900/50' 
                      : 'bg-white dark:bg-[#1e293b] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
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
                  <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] p-5 shadow-sm dark:shadow-lg relative overflow-hidden group transition-colors">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Total de Plantões</p>
                    <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">{formatNumber(totalShiftsCount)}</p>
                    <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 font-bold flex flex-col gap-1">
                      <span className="text-emerald-600 dark:text-teal-400">{filledShiftsCount} Ocupados</span>
                      {vacantShiftsCount > 0 && <span className="text-rose-600 dark:text-rose-400">{vacantShiftsCount} Furos/Vagos</span>}
                    </div>
                  </Card>
                  <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] p-5 shadow-sm dark:shadow-lg relative overflow-hidden group transition-colors">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Taxa de Ocupação Real</p>
                    <p className={`mt-2 text-3xl font-black font-mono tracking-tight ${coverageRate >= 98 ? 'text-emerald-600 dark:text-emerald-400' : coverageRate >= 90 ? 'text-amber-500 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>{coverageRate}%</p>
                    <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 font-bold">Meta Hospitalar: &gt; 98%</div>
                  </Card>
                  <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] p-5 shadow-sm dark:shadow-lg relative overflow-hidden group transition-colors">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Custo Total Global</p>
                    <p className="mt-2 text-3xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight">{formatCurrency(financialSummary.totalCost)}</p>
                    <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 font-bold">{formatNumber(financialSummary.hours)} Horas Calculadas</div>
                  </Card>
                  <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] p-5 shadow-sm dark:shadow-lg relative overflow-hidden group transition-colors">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Profissionais Filtrados</p>
                    <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">{filteredProfessionals.length}</p>
                    <div className="mt-3 text-[10px] text-slate-500 dark:text-slate-400 font-bold flex flex-col gap-0.5">
                       <span className={credentialAudit.expired > 0 ? 'text-rose-600 dark:text-rose-400' : ''}>{credentialAudit.expired} Docs Vencidos</span>
                       <span className="text-amber-600 dark:text-amber-400">{credentialAudit.nearExpiry} Vencem em 30d</span>
                    </div>
                  </Card>
                </div>

                {vacantShiftItems.length > 0 && (
                  <Card className="rounded-3xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/20 p-6 shadow-sm dark:shadow-lg transition-colors">
                    <div className="flex items-center gap-3 border-b border-rose-200 dark:border-rose-500/20 pb-4">
                      <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-500 animate-pulse" />
                      <h3 className="text-sm font-black uppercase tracking-widest text-rose-800 dark:text-rose-400">Ocorrências: Furos de Escala ou Vagas em Aberto ({vacantShiftItems.length})</h3>
                    </div>
                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {vacantShiftItems.slice(0, 15).map((v, i) => {
                        const isPast = isShiftPast(v);
                        return (
                          <div key={i} className={`p-3 rounded-2xl border flex items-center justify-between shadow-sm transition-colors ${
                            isPast 
                              ? 'bg-rose-100 dark:bg-rose-950/50 border-rose-300 dark:border-rose-500/50' 
                              : 'bg-amber-50 dark:bg-[#1e293b] border-amber-200 dark:border-amber-500/30'
                          }`}>
                            <div>
                              <strong className="text-xs text-slate-900 dark:text-white block">{getSectorName(v, sectors)}</strong>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">Data: {formatDate(v.date)}</span>
                            </div>
                            <span className={`font-mono text-[10px] font-bold px-2 py-1 rounded-lg border ${
                              isPast 
                                ? 'bg-rose-200 dark:bg-rose-500/20 text-rose-800 dark:text-rose-400 border-rose-300 dark:border-rose-500/30' 
                                : 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                            }`}>
                              {isPast ? 'NÃO OCUPADO' : 'EM ABERTO'}
                            </span>
                          </div>
                        );
                      })}
                      {vacantShiftItems.length > 15 && (
                        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 font-bold transition-colors">
                          + {vacantShiftItems.length - 15} registros na aba Escalas
                        </div>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ABA ESCALAS */}
            {activeTab === 'escalas' && (
              <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] p-6 shadow-sm dark:shadow-lg animate-in fade-in zoom-in-95 duration-300 transition-colors">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 pb-4">
                  <h3 className="font-black text-sm uppercase tracking-widest text-sky-600 dark:text-cyan-400 flex items-center gap-2">
                    <CalendarDays className="w-5 h-5" /> Extrato de Escalas ({filteredShifts.length})
                  </h3>
                </div>
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase text-slate-500 dark:text-slate-500 tracking-wider">
                        <th className="py-3 px-3">Data</th>
                        <th className="py-3 px-3">Setor</th>
                        <th className="py-3 px-3">Profissional Alocado</th>
                        <th className="py-3 px-3">Horário</th>
                        <th className="py-3 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 font-medium">
                      {filteredShifts.map((s, idx) => {
                        const isVago = isVacant(s);
                        const isPast = isShiftPast(s);
                        let profNameRender = titleCase(s.professional_name) || 'Não Identificado';
                        let badgeClass = 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30';
                        let badgeText = s.status || 'Confirmado';

                        if (isVago) {
                          if (isPast) {
                            profNameRender = <span className="text-rose-600 dark:text-rose-500">⚠️ FALTA / NÃO OCUPADO</span>;
                            badgeClass = 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-500 border-rose-200 dark:border-rose-500/50';
                            badgeText = 'Furo de Escala';
                          } else {
                            profNameRender = <span className="text-amber-600 dark:text-amber-400">⚠️ VAGA EM ABERTO</span>;
                            badgeClass = 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-500/30';
                            badgeText = 'Vago';
                          }
                        }

                        return (
                          <tr key={s.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                            <td className="py-3 px-3 font-bold font-mono text-slate-700 dark:text-slate-300">{formatDate(s.date)}</td>
                            <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{getSectorName(s, sectors)}</td>
                            <td className={`py-3 px-3 font-black text-slate-900 dark:text-white`}>{profNameRender}</td>
                            <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">{s.start_time || '07:00'} - {s.end_time || '19:00'}</td>
                            <td className="py-3 px-3"><span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase border ${badgeClass}`}>{badgeText}</span></td>
                          </tr>
                        );
                      })}
                      {filteredShifts.length === 0 && (
                        <tr><td colSpan="5" className="py-8 text-center text-slate-500">Nenhum plantão filtrado no período.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* ABA BASE DE SETORES */}
            {activeTab === 'base_setores' && (
              <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] p-6 shadow-sm dark:shadow-lg animate-in fade-in zoom-in-95 duration-300 transition-colors">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 pb-4">
                  <h3 className="font-black text-sm uppercase tracking-widest text-sky-600 dark:text-sky-400 flex items-center gap-2">
                    <Building2 className="w-5 h-5" /> Estrutura de Setores ({enrichedSectors.length})
                  </h3>
                </div>
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        <th className="py-3 px-3">Nome do Setor</th>
                        <th className="py-3 px-3">Especialidade Exigida</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-center">Plantões no Período</th>
                        <th className="py-3 px-3 text-right">Custo Projetado (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 font-medium">
                      {enrichedSectors.map((s, idx) => (
                        <tr key={s.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                          <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{titleCase(s.name)}</td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{s.specialty || 'Não definida'}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${normalize(s.status) === 'inativo' ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>
                              {s.status || 'Ativo'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">{s.shiftsCount}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">{formatCurrency(s.totalCost)}</td>
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
              <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] p-6 shadow-sm dark:shadow-lg animate-in fade-in zoom-in-95 duration-300 transition-colors">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 pb-4">
                  <h3 className="font-black text-sm uppercase tracking-widest text-sky-600 dark:text-sky-400 flex items-center gap-2">
                    <Contact2 className="w-5 h-5" /> Base do Corpo Clínico ({filteredProfessionals.length})
                  </h3>
                </div>
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        <th className="py-3 px-3">Nome Completo</th>
                        <th className="py-3 px-3">Especialidade</th>
                        <th className="py-3 px-3">Documento (CRM)</th>
                        <th className="py-3 px-3">Vencimento Doc.</th>
                        <th className="py-3 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 font-medium">
                      {filteredProfessionals.map((p, idx) => {
                        const expiryDate = p.document_expiry || p.documentExpiry || p.valid_until;
                        const isExpired = expiryDate && new Date(expiryDate) < new Date();
                        return (
                          <tr key={p.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                            <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{titleCase(p.name)}</td>
                            <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{p.specialty}</td>
                            <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-mono">{p.document || '—'}</td>
                            <td className={`py-3 px-3 font-mono ${isExpired ? 'text-rose-600 dark:text-rose-500 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                              {formatDate(expiryDate)}
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${normalize(p.status) === 'inativo' ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>
                                {p.status || 'Ativo'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredProfessionals.length === 0 && (
                        <tr><td colSpan="5" className="py-8 text-center text-slate-500">Nenhum profissional encontrado com os filtros atuais.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* ABA PROFISSIONAIS (PRODUTIVIDADE) */}
            {activeTab === 'profissionais' && (
              <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] p-6 shadow-sm dark:shadow-lg animate-in fade-in zoom-in-95 duration-300 transition-colors">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 pb-4">
                  <h3 className="font-black text-sm uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <Stethoscope className="w-5 h-5" /> Matriz de Produtividade Clínica ({professionalMetrics.length})
                  </h3>
                </div>
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        <th className="py-3 px-3">Profissional</th>
                        <th className="py-3 px-3">Especialidade</th>
                        <th className="py-3 px-3 text-center">Nº Plantões</th>
                        <th className="py-3 px-3 text-right">Carga Horária</th>
                        <th className="py-3 px-3 text-right">Honorários (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 font-medium">
                      {professionalMetrics.map((doc, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                          <td className="py-3 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-sky-600 dark:text-cyan-400 font-black flex items-center justify-center text-[10px] border border-slate-200 dark:border-slate-700">
                              {doc.name.substring(0,2).toUpperCase()}
                            </div>
                            {doc.name}
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{doc.specialty}</td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">{doc.shifts}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{doc.hours}h</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">{formatCurrency(doc.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* ABA FINANCEIRO */}
            {activeTab === 'financeiro' && (
              <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] p-6 shadow-sm dark:shadow-lg animate-in fade-in zoom-in-95 duration-300 transition-colors">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 pb-4">
                  <h3 className="font-black text-sm uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <DollarSign className="w-5 h-5" /> Inteligência Financeira e Orçamento
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4">
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-inner">
                    <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Total Previsão Global</span>
                    <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-2">{formatCurrency(financialSummary.totalCost)}</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 shadow-sm dark:shadow-inner">
                    <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-400">Valor Realizado</span>
                    <div className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400 mt-2">{formatCurrency(financialSummary.executedCost)}</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 shadow-sm dark:shadow-inner">
                    <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-400">Valor Pendente</span>
                    <div className="text-2xl font-black font-mono text-amber-700 dark:text-amber-400 mt-2">{formatCurrency(financialSummary.pendingCost)}</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 shadow-sm dark:shadow-inner">
                    <span className="text-[10px] font-black uppercase text-rose-800 dark:text-rose-400">Desfalques (Vagas)</span>
                    <div className="text-2xl font-black font-mono text-rose-700 dark:text-rose-400 mt-2">{formatCurrency(financialSummary.vacantCost)}</div>
                  </div>
                </div>
                <div className="mt-8 border-t border-slate-100 dark:border-slate-700/50 pt-6">
                  <h4 className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 mb-4">Orçamento por Setor Clínico</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          <th className="py-2 px-2">Setor Clínico</th>
                          <th className="py-2 px-2 text-right">Horas Assistenciais</th>
                          <th className="py-2 px-2 text-right">Custo Projetado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 font-medium">
                        {sectorMetrics.map((sec, idx) => (
                          <tr key={idx}>
                            <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">{sec.name}</td>
                            <td className="py-3 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{sec.hours}h</td>
                            <td className="py-3 px-2 text-right font-mono font-black text-amber-600 dark:text-amber-400">{formatCurrency(sec.cost)}</td>
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
  );
}