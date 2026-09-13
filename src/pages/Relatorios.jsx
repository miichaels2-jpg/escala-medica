import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Database,
  Download,
  Eye,
  FileText,
  Filter,
  History,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  Menu,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingDown,
  UserCheck,
  Users,
  X,
  FileCheck2,
} from 'lucide-react';

/* ============================================================
   CONFIGURAÇÕES
============================================================ */

const SHIFT_STATUS = {
  CONFIRMED: 'confirmado',
  PENDING: 'pendente',
  CANCELLED: 'cancelado',
  OPEN: 'vago',
};

const REMUNERATION_TYPE = {
  HOUR: 'hora',
  DAILY: 'diaria',
  MONTHLY: 'mensal',
};

const REPORT_CONFIG = {
  executiva: { label: 'Visão Executiva', icon: LayoutDashboard },
  produtividade: { label: 'Produtividade & Horas', icon: Clock3 },
  cobertura: { label: 'Cobertura por Setor', icon: Building2 },
  financeiro: { label: 'Repasse Financeiro', icon: DollarSign },
  auditoria: { label: 'Log de Auditoria', icon: ShieldCheck },
};

/* ============================================================
   FUNÇÕES UTILITÁRIAS
============================================================ */

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatNumber(value, decimals = 0) {
  return safeNumber(value).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatCurrency(value = 0) {
  return `R$ ${safeNumber(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeDate(dateValue) {
  if (!dateValue) return '';
  const value = String(dateValue).trim();
  if (!value) return '';
  const datePart = value.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  return '';
}

function formatDateBR(dateValue) {
  const value = normalizeDate(dateValue);
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* ============================================================
   EXPORTAÇÃO CSV E PDF (A4 CORPORATIVO)
============================================================ */

function downloadCSV(payload) {
  const rows = [];
  rows.push([payload.title]);
  rows.push([`Instituição: ${payload.companyName}`]);
  rows.push([`Filtros: ${payload.subtitle}`]);
  rows.push([]);

  if (payload.sections?.length) {
    payload.sections.forEach((section) => {
      rows.push([section.title]);
      rows.push(section.columns);
      rows.push(...section.rows);
      if (section.totalsRow) rows.push(section.totalsRow);
      rows.push([]);
    });
  } else {
    rows.push(payload.columns);
    rows.push(...payload.rows);
    if (payload.totalsRow) rows.push(payload.totalsRow);
  }

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(';'))
    .join('\n');

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${payload.title.toLowerCase().replaceAll(/[^a-z0-9]+/gi, '-')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadPDF(payload) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Permita pop-ups no navegador para gerar o relatório em PDF.');
    return;
  }

  const renderTable = (columns, rows, totalsRow) => `
    <table>
      <thead>
        <tr>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
      </tbody>
      ${totalsRow ? `<tfoot><tr>${totalsRow.map(cell => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></tfoot>` : ''}
    </table>
  `;

  const sectionsHtml = payload.sections?.length
    ? payload.sections.map((section) => `
        <div class="section-title">${escapeHtml(section.title)}</div>
        ${section.rows.length ? renderTable(section.columns, section.rows, section.totalsRow) : '<p>Nenhum dado encontrado.</p>'}
      `).join('')
    : renderTable(payload.columns, payload.rows, payload.totalsRow);

  const kpisHtml = payload.kpis?.length
    ? `<div class="kpis">
        ${payload.kpis.map((kpi) => `
          <div class="kpi-box">
            <div class="kpi-label">${escapeHtml(kpi.label)}</div>
            <div class="kpi-value">${escapeHtml(kpi.value)}</div>
          </div>
        `).join('')}
       </div>`
    : '';

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>${escapeHtml(payload.title)}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        * { box-sizing: border-box; font-family: 'Arial', sans-serif; }
        body { margin: 0; padding: 0; color: #0f172a; font-size: 10px; background: #ffffff; }
        
        .header { border-bottom: 2px solid #0ea5e9; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header-title { font-size: 20px; font-weight: 900; text-transform: uppercase; margin: 0 0 4px; color: #0f172a; }
        .header-sub { font-size: 11px; color: #64748b; margin: 0; }
        .header-meta { text-align: right; font-size: 9px; color: #475569; line-height: 1.5; }
        .header-meta strong { color: #0f172a; }
        
        .kpis { display: flex; gap: 10px; margin-bottom: 20px; }
        .kpi-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; background: #f8fafc; }
        .kpi-label { font-size: 8px; text-transform: uppercase; font-weight: bold; color: #64748b; margin-bottom: 4px; }
        .kpi-value { font-size: 16px; font-weight: 900; color: #0284c7; }
        
        .section-title { font-size: 12px; font-weight: bold; color: #0f172a; margin: 20px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 25px; page-break-inside: auto; }
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
        tr { page-break-inside: avoid; break-inside: avoid; }
        th, td { padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left; vertical-align: middle; }
        th { background: #f1f5f9; font-size: 9px; color: #334155; text-transform: uppercase; }
        td { font-size: 10px; color: #1e293b; }
        tbody tr:nth-child(even) { background: #f8fafc; }
        tfoot th { background: #e2e8f0; color: #0f172a; font-size: 10px; }
        
        .signatures { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; page-break-inside: avoid; }
        .sig-line { border-top: 1px solid #94a3b8; padding-top: 6px; font-size: 10px; font-weight: bold; color: #334155; }
        
        .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #cbd5e1; font-size: 8px; color: #94a3b8; display: flex; justify-content: space-between; }
        
        @media screen {
          body { padding: 30px; background: #f1f5f9; }
          .document-container { max-width: 1100px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border-radius: 8px; }
          .no-print { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 20px; }
          .no-print button { padding: 8px 16px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 12px; }
          .btn-print { background: #0284c7; color: white; }
          .btn-close { background: #e2e8f0; color: #0f172a; }
        }
        @media print {
          .no-print { display: none !important; }
          .document-container { box-shadow: none; padding: 0; max-width: 100%; }
        }
      </style>
    </head>
    <body>
      <div class="document-container">
        <div class="no-print">
          <button class="btn-print" onclick="window.print()">Imprimir / Salvar PDF</button>
          <button class="btn-close" onclick="window.close()">Fechar</button>
        </div>
        
        <div class="header">
          <div>
            <h1 class="header-title">${escapeHtml(payload.title)}</h1>
            <p class="header-sub"><strong>Instituição:</strong> ${escapeHtml(payload.companyName)}</p>
            <p class="header-sub"><strong>Filtros aplicados:</strong> ${escapeHtml(payload.subtitle)}</p>
          </div>
          <div class="header-meta">
            <div><strong>Emissão:</strong> ${new Date().toLocaleString('pt-BR')}</div>
            <div><strong>Emitido por:</strong> ${escapeHtml(payload.generatedBy)}</div>
            <div><strong>Página oficial gerada via sistema</strong></div>
          </div>
        </div>

        ${kpisHtml}
        ${sectionsHtml}

        <div class="signatures">
          <div class="sig-line">Responsável pela Emissão</div>
          <div class="sig-line">Diretoria / Aprovação</div>
        </div>

        <div class="footer">
          <span>Documento gerado pela Central de Inteligência Hospitalar.</span>
          <span>Impresso em A4 Paisagem (Landscape)</span>
        </div>
      </div>
      <script>
        window.onload = function() { setTimeout(function() { window.print(); }, 500); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

/* ============================================================
   GERADOR DE PAYLOAD UNIFICADO
============================================================ */

function buildReportPayload({
  tab, company, user, filtersLabel, overview, byProfessional, bySector, auditLogs, totalFinancialEstimate
}) {
  const companyName = company?.name || 'Hospital';
  const generatedBy = user?.data?.full_name || user?.data?.name || undefined;
  const base = { companyName, generatedBy, subtitle: filtersLabel };

  if (tab === 'conselho') {
    const totalHours = byProfessional.reduce((total, p) => total + p.hours, 0);
    const averageCoverage = bySector.length
      ? Math.round(bySector.reduce((t, [, data]) => t + (data.total ? (data.filled / data.total) * 100 : 0), 0) / bySector.length)
      : 0;

    return {
      ...base,
      key: tab,
      title: 'Relatório Consolidado do Conselho',
      kpis: [
        { label: 'Plantões totais', value: overview.total },
        { label: 'Plantões confirmados', value: overview.confirmed },
        { label: 'Cobertura média', value: `${averageCoverage}%` },
        { label: 'Repasse estimado', value: formatCurrency(totalFinancialEstimate) },
      ],
      sections: [
        {
          title: 'Resumo Operacional',
          columns: ['Indicador', 'Resultado'],
          rows: [
            ['Total de plantões', overview.total],
            ['Plantões confirmados', overview.confirmed],
            ['Plantões pendentes', overview.pending],
            ['Vagas abertas', overview.open],
            ['Plantões cancelados', overview.canceled],
            ['Horas totais', `${totalHours}h`],
            ['Profissionais envolvidos', byProfessional.length],
            ['Setores mapeados', bySector.length],
          ],
        },
        {
          title: 'Produtividade por Profissional',
          columns: ['Profissional', 'Especialidade', 'Confirmados', 'Pendentes', 'Cancelados', 'Horas'],
          rows: byProfessional.map((p) => [p.name, p.category, p.confirmed, p.pending, p.canceled, `${p.hours}h`]),
          totalsRow: ['TOTAL', '', overview.confirmed, overview.pending, overview.canceled, `${totalHours}h`],
        },
        {
          title: 'Cobertura por Setor',
          columns: ['Setor', 'Total', 'Preenchidos', 'Vagas Abertas', 'Cancelados', 'Cobertura %'],
          rows: bySector.map(([name, data]) => {
            const percentage = data.total ? Math.round((data.filled / data.total) * 100) : 0;
            return [name, data.total, data.filled, data.open, data.canceled, `${percentage}%`];
          }),
        },
        {
          title: 'Repasse Financeiro Estimado',
          columns: ['Profissional', 'Modelo', 'Quantidade / Horas', 'Total Estimado'],
          rows: byProfessional.map((p) => [
            p.name,
            p.remunerationType === 'diaria' ? 'Por Plantão / Diária' : p.remunerationType === 'mensal' ? 'Fixo Mensal' : 'Horista',
            p.remunerationType === 'hora' ? `${p.hours}h` : `${p.confirmed} plantão(ões)`,
            formatCurrency(p.estimatedPay),
          ]),
          totalsRow: ['TOTAL', '', `${totalHours}h`, formatCurrency(totalFinancialEstimate)],
        },
        {
          title: 'Auditoria e Ocorrências',
          columns: ['Data', 'Horário', 'Profissional', 'Setor', 'Status', 'Observação'],
          rows: auditLogs.map((log) => [
            formatDateBR(log.date),
            `${log.start_time || '--'} - ${log.end_time || '--'}`,
            log.professional_name || 'Vago',
            log.sector_name || 'Geral',
            log.status || '—',
            log.notes || '—',
          ]),
        },
      ],
    };
  }

  if (tab === 'produtividade') {
    const totalHours = byProfessional.reduce((total, p) => total + p.hours, 0);
    return {
      ...base,
      key: tab,
      title: 'Produtividade do Corpo Clínico',
      kpis: [
        { label: 'Profissionais ativos', value: byProfessional.length },
        { label: 'Horas totais', value: `${totalHours}h` },
        { label: 'Confirmados', value: overview.confirmed },
        { label: 'Pendentes', value: overview.pending },
      ],
      columns: ['Profissional', 'Especialidade', 'Confirmados', 'Pendentes', 'Cancelados', 'Horas Totais'],
      rows: byProfessional.map((p) => [p.name, p.category, p.confirmed, p.pending, p.canceled, `${p.hours}h`]),
      totalsRow: ['TOTAL', '', overview.confirmed, overview.pending, overview.canceled, `${totalHours}h`],
      emptyMessage: 'Nenhum profissional com plantões no período selecionado.',
    };
  }

  if (tab === 'cobertura') {
    const rows = bySector.map(([name, data]) => {
      const pct = data.total ? Math.round((data.filled / data.total) * 100) : 0;
      return [name, data.total, data.filled, data.open, data.canceled, `${pct}%`];
    });
    const avgCov = bySector.length ? Math.round(bySector.reduce((t, [, data]) => t + (data.total ? (data.filled / data.total) * 100 : 0), 0) / bySector.length) : 0;
    return {
      ...base,
      key: tab,
      title: 'Cobertura Operacional por Setor',
      kpis: [
        { label: 'Setores mapeados', value: bySector.length },
        { label: 'Cobertura média', value: `${avgCov}%` },
        { label: 'Vagas abertas', value: overview.open },
      ],
      columns: ['Setor', 'Turnos Totais', 'Preenchidos', 'Vagas Abertas', 'Cancelados', '% Cobertura'],
      rows,
      emptyMessage: 'Sem dados de setores para os filtros selecionados.',
    };
  }

  if (tab === 'financeiro') {
    const totalHours = byProfessional.reduce((t, p) => t + p.hours, 0);
    return {
      ...base,
      key: tab,
      title: 'Projeção de Repasse Financeiro',
      kpis: [
        { label: 'Total estimado', value: formatCurrency(totalFinancialEstimate) },
        { label: 'Profissionais', value: byProfessional.length },
        { label: 'Horas faturáveis', value: `${totalHours}h` },
      ],
      columns: ['Profissional', 'Modelo', 'Quantidade / Horas', 'Total a Liquidar'],
      rows: byProfessional.map((p) => [
        p.name,
        p.remunerationType === 'diaria' ? 'Por Plantão / Diária' : p.remunerationType === 'mensal' ? 'Fixo Mensal' : 'Horista',
        p.remunerationType === 'hora' ? `${p.hours}h` : `${p.confirmed} plantão(ões)`,
        formatCurrency(p.estimatedPay),
      ]),
      totalsRow: ['TOTAL', '', `${totalHours}h`, formatCurrency(totalFinancialEstimate)],
      emptyMessage: 'Nenhum valor a liquidar para os filtros selecionados.',
    };
  }

  return {
    ...base,
    key: tab,
    title: 'Log de Auditoria e Plantões Cancelados',
    kpis: [
      { label: 'Eventos totais', value: auditLogs.length },
      { label: 'Cancelamentos', value: overview.canceled },
    ],
    columns: ['Data', 'Horário', 'Profissional', 'Setor', 'Status', 'Observação'],
    rows: auditLogs.map((log) => [
      formatDateBR(log.date),
      `${log.start_time || '--'} - ${log.end_time || '--'}`,
      log.professional_name || 'Vago',
      log.sector_name || 'Geral',
      log.status || '—',
      log.notes || '—',
    ]),
    emptyMessage: 'Nenhum evento registrado no período.',
  };
}

/* ============================================================
   COMPONENTE PRINCIPAL
============================================================ */

export default function CentralInteligenciaHospitalar() {
  const { user, company, loading } = useAppData();

  const [shifts, setShifts] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [activeTab, setActiveTab] = useState('conselho');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSector, setSelectedSector] = useState('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id;

  const loadData = async () => {
    if (!companyId) return;
    setLoadingData(true);
    try {
      const f = { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) };
      const [s, p, sec] = await Promise.all([
        base44.entities.Shift.filter(f, '-date', 1500).catch(() => []),
        base44.entities.Professional.filter(f, '-created_date', 800).catch(() => []),
        base44.entities.Sector.filter(f, '-created_date', 200).catch(() => [])
      ]);
      setShifts(Array.isArray(s) ? s : []);
      setProfessionals(Array.isArray(p) ? p : []);
      setSectors(Array.isArray(sec) ? sec : []);
    } catch (e) {
      console.error('Erro ao carregar dados:', e);
      setShifts([]); setProfessionals([]); setSectors([]);
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
        const remType = p.remuneration_type || 'hora';
        let baseRate = 120;
        if (remType === 'hora') baseRate = Number(p.hourly_rate) || 120;
        else if (remType === 'diaria') baseRate = Number(p.daily_rate) || 1500;
        else if (remType === 'mensal') {
          const monthly = Number(p.monthly_salary) || 18000;
          const monthlyHours = Number(p.monthly_work_hours) || 220; // Ajustado para rate correto
          baseRate = monthlyHours > 0 ? monthly / monthlyHours : 0;
        }

        map[p.id] = {
          name: p.name || 'Sem Nome',
          category: p.specialty || p.category || 'Geral',
          confirmed: 0, pending: 0, canceled: 0, hours: 0, estimatedPay: 0,
          remunerationType: remType, hourlyRate: baseRate,
        };
      });
    }

    filteredShifts.forEach((s) => {
      if (!s || !s.professional_id) return;
      if (!map[s.professional_id]) {
        map[s.professional_id] = {
          name: s.professional_name || '—', category: 'Profissional',
          confirmed: 0, pending: 0, canceled: 0, hours: 0, estimatedPay: 0,
          remunerationType: 'hora', hourlyRate: 120,
        };
      }
      const pEntry = map[s.professional_id];

      if (s.status === 'confirmado') {
        pEntry.confirmed += 1;
        const dur = Number(s.duration_hours) || 12;
        pEntry.hours += dur;

        if (pEntry.remunerationType === 'diaria') {
          pEntry.estimatedPay += pEntry.hourlyRate; // paga fixo por plantão
        } else if (pEntry.remunerationType === 'mensal') {
          pEntry.estimatedPay += dur * pEntry.hourlyRate; // rate é salário/horas_mes
        } else {
          pEntry.estimatedPay += dur * pEntry.hourlyRate; // horista
        }
      }
      if (s.status === 'pendente') pEntry.pending += 1;
      if (s.status === 'cancelado') pEntry.canceled += 1;
    });

    return Object.values(map).filter((m) => m.confirmed > 0 || m.pending > 0 || m.canceled > 0).sort((a, b) => b.hours - a.hours);
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

  const reportPayload = useMemo(() => {
    return buildReportPayload({ tab: activeTab, company, user, filtersLabel, overview, byProfessional, bySector, auditLogs, totalFinancialEstimate });
  }, [activeTab, company, user, filtersLabel, overview, byProfessional, bySector, auditLogs, totalFinancialEstimate]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      
      {/* SIDEBAR CORPORATIVA (Visível no Desktop) */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-72 bg-slate-950 text-slate-300 flex flex-col transition-transform duration-300 shadow-2xl
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center shadow-lg shadow-sky-900/50">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-black text-sm text-white tracking-wider">CENTRAL DE</div>
            <div className="text-[10px] font-bold text-sky-400">INTELIGÊNCIA HOSPITALAR</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-3 mb-2">Painel Diretor</div>
            <button onClick={() => { setActiveTab('conselho'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${activeTab === 'conselho' ? 'bg-sky-600 text-white font-bold shadow-md' : 'hover:bg-slate-900 hover:text-white'}`}>
              <ClipboardList className="w-4 h-4" /> Resumo Consolidado
            </button>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-3 mb-2">Operacional</div>
            <button onClick={() => { setActiveTab('produtividade'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all mb-1 ${activeTab === 'produtividade' ? 'bg-sky-600 text-white font-bold shadow-md' : 'hover:bg-slate-900 hover:text-white'}`}>
              <Clock className="w-4 h-4" /> Produtividade & Horas
            </button>
            <button onClick={() => { setActiveTab('cobertura'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all mb-1 ${activeTab === 'cobertura' ? 'bg-sky-600 text-white font-bold shadow-md' : 'hover:bg-slate-900 hover:text-white'}`}>
              <TrendingUp className="w-4 h-4" /> Cobertura por Setor
            </button>
            <button onClick={() => { setActiveTab('financeiro'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${activeTab === 'financeiro' ? 'bg-sky-600 text-white font-bold shadow-md' : 'hover:bg-slate-900 hover:text-white'}`}>
              <DollarSign className="w-4 h-4" /> Repasse Financeiro
            </button>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-3 mb-2">Governança</div>
            <button onClick={() => { setActiveTab('auditoria'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${activeTab === 'auditoria' ? 'bg-sky-600 text-white font-bold shadow-md' : 'hover:bg-slate-900 hover:text-white'}`}>
              <ShieldCheck className="w-4 h-4" /> Log de Auditoria
            </button>
          </div>
        </div>
      </aside>

      {mobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />}

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Header Mobile */}
        <div className="lg:hidden bg-slate-950 text-white p-4 flex items-center justify-between sticky top-0 z-30">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 bg-white/10 rounded-lg">
            <Menu className="w-5 h-5" />
          </button>
          <div className="font-bold text-sm tracking-wide">Inteligência Hospitalar</div>
          <div className="w-9" />
        </div>

        <div className="p-5 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900">{REPORT_CONFIG[activeTab]?.label || 'Relatórios'}</h1>
              <p className="text-sm text-slate-500 mt-1">Os indicadores abaixo refletem somente os dados aplicados no filtro.</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button onClick={() => downloadCSV(reportPayload)} variant="outline" className="border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-bold text-xs h-10 px-4 gap-2 shadow-sm">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar CSV
              </Button>
              <Button onClick={() => downloadPDF(reportPayload)} className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-10 px-5 gap-2 shadow-md">
                <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
              </Button>
            </div>
          </div>

          <Card className="p-5 border-slate-200 shadow-sm bg-white rounded-2xl">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
              <Filter className="w-4 h-4 text-sky-600" /> Refinar Busca
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Data Inicial</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 text-xs bg-slate-50" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Data Final</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 text-xs bg-slate-50" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Setor Assistencial</label>
                <Select value={String(selectedSector)} onValueChange={setSelectedSector}>
                  <SelectTrigger className="h-10 text-xs bg-slate-50"><SelectValue placeholder="Todos os setores" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os setores</SelectItem>
                    {sectors.map((s) => (
                      <SelectItem key={s.id} value={String(s.name)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {loadingData ? (
            <div className="flex justify-center p-16"><Loader2 className="w-8 h-8 animate-spin text-sky-600" /></div>
          ) : (
            <>
              {activeTab === 'conselho' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {reportPayload.kpis.map((kpi, idx) => (
                      <Card key={idx} className="p-5 border-slate-200 shadow-sm bg-white rounded-2xl">
                        <div className="text-[10px] uppercase font-bold text-slate-400">{kpi.label}</div>
                        <div className="text-2xl font-black text-slate-900 mt-1">{kpi.value}</div>
                      </Card>
                    ))}
                  </div>

                  {reportPayload.sections.map((section, idx) => (
                    <Card key={idx} className="p-0 border-slate-200 shadow-sm bg-white rounded-2xl overflow-hidden">
                      <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
                        <h3 className="font-bold text-sm text-slate-900">{section.title}</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                          <thead className="bg-slate-50 text-slate-500 uppercase">
                            <tr>
                              {section.columns.map(col => <th key={col} className="px-6 py-3 font-bold">{col}</th>)}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {section.rows.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-slate-50/50">
                                {row.map((cell, cIdx) => <td key={cIdx} className="px-6 py-3">{cell}</td>)}
                              </tr>
                            ))}
                          </tbody>
                          {section.totalsRow && (
                            <tfoot className="bg-slate-50 font-black text-slate-900">
                              <tr>
                                {section.totalsRow.map((cell, idx) => <td key={idx} className="px-6 py-3">{cell}</td>)}
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {activeTab !== 'conselho' && (
                <Card className="p-0 border-slate-200 shadow-sm bg-white rounded-2xl overflow-hidden">
                  <div className="px-6 py-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-sky-600" /> {reportPayload.title}
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    {reportPayload.rows.length === 0 ? (
                      <div className="py-16 text-center text-sm text-slate-400">{reportPayload.emptyMessage}</div>
                    ) : (
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-500 uppercase">
                          <tr>
                            {reportPayload.columns.map(col => <th key={col} className="px-6 py-3 font-bold">{col}</th>)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {reportPayload.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50/50">
                              {row.map((cell, cIdx) => <td key={cIdx} className="px-6 py-3 text-slate-700">{cell}</td>)}
                            </tr>
                          ))}
                        </tbody>
                        {reportPayload.totalsRow && (
                          <tfoot className="bg-slate-50 font-black text-slate-900 border-t border-slate-200">
                            <tr>
                              {reportPayload.totalsRow.map((cell, idx) => <td key={idx} className="px-6 py-3">{cell}</td>)}
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    )}
                  </div>
                </Card>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  );
}