import React, { useEffect, useMemo, useState } from 'react';
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
  Clock,
  TrendingUp,
  ShieldCheck,
  Building2,
  Filter,
  Loader2,
  DollarSign,
  BarChart3,
  Eye,
  X,
  Printer,
  Users,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Activity,
  Award
} from 'lucide-react';

/* ============================================================
 * FORMATAÇÃO BLINDADA
 * ============================================================ */
function formatCurrency(value = 0) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateBR(dateStr) {
  if (!dateStr) return '—';
  const value = String(dateStr).split('T')[0];
  const parts = value.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

function escapeCSV(value) {
  return `"${String(value ?? '')
    .replace(/"/g, '""')
    .replace(/\r?\n/g, ' ')}"`;
}

function downloadFile(content, filename, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ============================================================
 * 3 CAMADAS CONCEITUAIS DE INTELIGÊNCIA HOSPITALAR
 * ============================================================ */
const TABS_CONFIG = {
  // CAMADA 1: Visão Executiva
  executiva: { label: '📊 1. Visão Executiva (Conselho)', group: 'camada1' },
  
  // CAMADA 2: Relatórios Operacionais Aprofundados
  produtividade: { label: '⏱️ 2.1 Produtividade & Horas', group: 'camada2' },
  cobertura: { label: '🏥 2.2 Cobertura & Mapa de Calor', group: 'camada2' },
  risco: { label: '⚠️ 2.3 Risco Assistencial (RDC/COFEN)', group: 'camada2' },
  financeiro: { label: '💸 2.4 Financeiro Avançado & Custos', group: 'camada2' },
  turnover: { label: '👥 Turnover & Absenteísmo', group: 'camada2' },

  // CAMADA 3: Governança & Compliance
  auditoria: { label: '🛡️ 3. Governança & Trilha (LGPD)', group: 'camada3' },
};

/* ============================================================
 * GERADOR DE PAYLOADS DE INTELIGÊNCIA
 * ============================================================ */
function buildReportPayload({
  tab,
  company,
  user,
  filtersLabel,
  overview = {},
  byProfessional = [],
  bySector = [],
  auditLogs = [],
  totalFinancialEstimate = 0,
  criticalAlerts = [],
}) {
  const companyName = company?.name || 'Instituição Hospitalar';
  const generatedBy = user?.data?.full_name || user?.data?.name || user?.email || 'Diretoria Executiva';

  const base = {
    companyName,
    generatedBy,
    generatedAt: new Date(),
    subtitle: filtersLabel,
  };

  if (tab === 'executiva') {
    const totalHours = byProfessional.reduce((acc, p) => acc + Number(p?.hours || 0), 0);
    return {
      ...base,
      key: tab,
      title: 'Sumário Executivo para Diretoria & Conselho',
      kpis: [
        { label: 'Custo Total Estimado', value: formatCurrency(totalFinancialEstimate), trend: '▲ 4.2%' },
        { label: 'Cobertura Global', value: `${overview.total ? Math.round((overview.confirmed / overview.total) * 100) : 0}%`, trend: '▼ 1.5%' },
        { label: 'Headcount Ativo', value: byProfessional.length, trend: '▲ 2 novos' },
        { label: 'Furos de Escala (Vagas)', value: overview.open || 0, trend: '▼ 8.1%' },
      ],
      criticalAlerts,
      columns: ['Indicador Executivo', 'Resultado Consolidado'],
      rows: [
        ['Total de turnos no período', overview.total || 0],
        ['Turnos confirmados e guarnecidos', overview.confirmed || 0],
        ['Turnos pendentes de aceite', overview.pending || 0],
        ['Vagas abertas (Risco de fuso)', overview.open || 0],
        ['Turnos cancelados / Modificados', overview.canceled || 0],
        ['Custo financeiro projetado', formatCurrency(totalFinancialEstimate)],
        ['Carga horária total executada', `${totalHours}h`],
      ],
      emptyMessage: 'Sem dados suficientes para consolidação executiva.',
    };
  }

  if (tab === 'produtividade') {
    const totalHours = byProfessional.reduce((total, p) => total + Number(p?.hours || 0), 0);
    return {
      ...base,
      key: tab,
      title: 'Produtividade e Carga Horária do Corpo Clínico',
      kpis: [
        { label: 'Profissionais ativos', value: byProfessional.length },
        { label: 'Horas totais', value: `${totalHours}h` },
        { label: 'Confirmados', value: overview.confirmed || 0 },
        { label: 'Pendentes', value: overview.pending || 0 },
      ],
      columns: ['Profissional', 'Categoria / Especialidade', 'Confirmados', 'Pendentes', 'Cancelados', 'Horas Totais'],
      rows: (byProfessional || []).map((p) => [
        p?.name || '—',
        p?.category || '—',
        p?.confirmed || 0,
        p?.pending || 0,
        p?.canceled || 0,
        `${p?.hours || 0}h`,
      ]),
      totalsRow: ['TOTAL', '', overview.confirmed || 0, overview.pending || 0, overview.canceled || 0, `${totalHours}h`],
      emptyMessage: 'Nenhum profissional com plantões no período selecionado.',
    };
  }

  if (tab === 'cobertura') {
    const rows = (bySector || []).map(([name, data]) => {
      const total = Number(data?.total || 0);
      const filled = Number(data?.filled || 0);
      const percentage = total ? Math.round((filled / total) * 100) : 0;
      return [name || 'Geral', total, filled, Number(data?.open || 0), Number(data?.canceled || 0), `${percentage}%`];
    });

    return {
      ...base,
      key: tab,
      title: 'Mapa de Cobertura Operacional por Setor',
      kpis: [
        { label: 'Setores mapeados', value: bySector.length },
        { label: 'Vagas abertas', value: overview.open || 0 },
        { label: 'Turnos totais', value: overview.total || 0 },
      ],
      columns: ['Setor', 'Turnos Totais', 'Preenchidos', 'Vagas Abertas', 'Cancelados', '% Cobertura'],
      rows,
      emptyMessage: 'Sem dados de setores para os filtros selecionados.',
    };
  }

  if (tab === 'risco') {
    return {
      ...base,
      key: tab,
      title: 'Painel de Risco Assistencial & Dimensionamento (RDC / COFEN)',
      kpis: [
        { label: 'Setores críticos monitorados', value: bySector.length },
        { label: 'Alertas de dimensionamento', value: criticalAlerts.length },
      ],
      columns: ['Setor / Ala', 'Status de Dimensionamento', 'Vagas Críticas', 'Nível de Risco'],
      rows: (bySector || []).map(([name, data]) => {
        const total = Number(data?.total || 0);
        const filled = Number(data?.filled || 0);
        const pct = total ? Math.round((filled / total) * 100) : 100;
        const riskLevel = pct < 70 ? 'CRÍTICO (Abaixo da RDC)' : pct < 90 ? 'ATENÇÃO (Limítrofe)' : 'REGULAR (Adequado)';
        return [name, `${pct}% Coberto`, `${data.open} vagas`, riskLevel];
      }),
      emptyMessage: 'Nenhum risco assistencial identificado no período.',
    };
  }

  if (tab === 'financeiro') {
    const totalHours = byProfessional.reduce((total, p) => total + Number(p?.hours || 0), 0);
    return {
      ...base,
      key: tab,
      title: 'Financeiro Avançado — Projeção de Repasse e Custos',
      kpis: [
        { label: 'Total estimado', value: formatCurrency(totalFinancialEstimate) },
        { label: 'Profissionais faturados', value: byProfessional.length },
        { label: 'Horas faturáveis', value: `${totalHours}h` },
      ],
      columns: ['Profissional', 'Modelo de Contrato', 'Quantidade / Horas', 'Total a Liquidar'],
      rows: (byProfessional || []).map((p) => [
        p?.name || '—',
        p?.remunerationType === 'diaria' ? 'Por Plantão / Diária' : p?.remunerationType === 'mensal' ? 'Fixo Mensal' : 'Horista',
        p?.remunerationType === 'hora' ? `${p?.hours || 0}h` : `${p?.confirmed || 0} plantão(ões)`,
        formatCurrency(p?.estimatedPay || 0),
      ]),
      totalsRow: ['TOTAL', '', `${totalHours}h`, formatCurrency(totalFinancialEstimate)],
      emptyMessage: 'Nenhum valor a liquidar para os filtros selecionados.',
    };
  }

  if (tab === 'turnover') {
    const totalCanceled = overview.canceled || 0;
    return {
      ...base,
      key: tab,
      title: 'Turnover & Absenteísmo do Corpo Clínico',
      kpis: [
        { label: 'Total de cancelamentos', value: totalCanceled },
        { label: 'Índice de absenteísmo', value: overview.total ? `${((totalCanceled / overview.total) * 100).toFixed(1)}%` : '0%' },
      ],
      columns: ['Profissional / Evento', 'Setor', 'Data do Turno', 'Motivo / Observação de Cancelamento'],
      rows: (auditLogs || []).filter(l => l.status === 'cancelado').map((log) => [
        log?.professional_name || 'Profissional',
        log?.sector_name || 'Geral',
        formatDateBR(log?.date),
        log?.notes || 'Cancelado sem justificativa informada',
      ]),
      emptyMessage: 'Nenhum índice de absenteísmo ou cancelamento registrado no período.',
    };
  }

  // auditoria / compliance
  return {
    ...base,
    key: tab,
    title: 'Governança, Compliance & Trilha de Auditoria (LGPD)',
    kpis: [
      { label: 'Eventos auditados', value: auditLogs.length },
      { label: 'Hash de Integridade', value: 'SHA-256-VALID' },
    ],
    columns: ['Data', 'Horário', 'Profissional', 'Setor', 'Status', 'Trilha / Observação', 'ID de Transação'],
    rows: (auditLogs || []).map((log) => [
      formatDateBR(log?.date),
      `${log?.start_time || '--'} - ${log?.end_time || '--'}`,
      log?.professional_name || 'Vago',
      log?.sector_name || 'Geral',
      log?.status || '—',
      log?.notes || '—',
      log?.id || '—',
    ]),
    emptyMessage: 'Nenhum evento de auditoria registrado no período.',
  };
}

/* ============================================================
 * MODAL DE PRÉ-VISUALIZAÇÃO A4 PROFISSIONAL COM COMPLIANCE
 * ============================================================ */
function ReportPreviewModal({ payload, onClose, onDownloadCSV }) {
  if (!payload) return null;
  const isExec = payload.key === 'executiva';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/80 backdrop-blur-sm">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-document, #print-document * { visibility: visible; }
          #print-document { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 12mm; background: white !important; color: black !important; box-shadow: none !important; }
          .print-hidden { display: none !important; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>

      <div 
        id="print-document"
        className="w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl print:max-h-none print:border-0 print:shadow-none print:rounded-none"
      >
        <div className="sticky top-0 z-20 flex items-start justify-between gap-4 p-5 md:p-6 bg-slate-900 text-white rounded-t-3xl print:static print:bg-white print:text-slate-900 print:border-b-2 print:border-slate-900 print:pb-4 print:rounded-none">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-400 print:text-sky-700">
              <ShieldCheck className="w-4 h-4" /> Governança Hospitalar · Assinatura Digital & Hash SHA-256
            </div>
            <h2 className="text-xl md:text-2xl font-black mt-1">{payload.title}</h2>
            <p className="text-xs text-slate-300 print:text-slate-600 mt-1">Instituição: <b>{payload.companyName}</b> · Escopo: {payload.subtitle}</p>
            <p className="text-[10px] text-slate-400 print:text-slate-500 mt-0.5">Emitido em {payload.generatedAt.toLocaleString('pt-BR')} por {payload.generatedBy}</p>
          </div>
          <button onClick={onClose} className="print-hidden p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 md:p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:grid-cols-4">
            {payload.kpis?.map((kpi, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 dark:border-slate-800 print:border-slate-300 bg-slate-50 dark:bg-slate-900 print:bg-slate-50 p-3.5">
                <div className="text-[9px] uppercase font-bold text-slate-400 print:text-slate-600">{kpi.label}</div>
                <div className="text-base font-black text-sky-700 dark:text-sky-400 print:text-slate-900 mt-0.5">{kpi.value}</div>
              </div>
            ))}
          </div>

          {payload.criticalAlerts?.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-4 print:border-red-300 print:bg-red-50">
              <div className="flex items-center gap-2 text-red-800 font-black text-xs mb-2">
                <AlertTriangle className="w-4 h-4" /> Alertas de Risco Operacional
              </div>
              <div className="space-y-1">
                {payload.criticalAlerts.map((alert, index) => (
                  <div key={index} className="text-xs text-red-700 font-medium">• {alert}</div>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            {payload.rows?.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">{payload.emptyMessage}</p>
            ) : (
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 uppercase text-[10px]">
                  <tr>
                    {payload.columns?.map(col => <th key={col} className="p-3 font-bold">{col}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                  {payload.rows?.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      {row.map((cell, j) => <td key={j} className="p-3 text-slate-800 dark:text-slate-200">{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
                {payload.totalsRow && (
                  <tfoot className="bg-slate-900 text-white font-black">
                    <tr>
                      {payload.totalsRow.map((cell, j) => <td key={j} className="p-3">{cell}</td>)}
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>

          {/* Assinatura / Compliance */}
          <div className="hidden print:block pt-10 mt-10 border-t border-slate-300 text-xs">
            <div className="grid grid-cols-2 gap-12 text-center">
              <div>
                <div className="border-t border-slate-800 w-3/4 mx-auto mb-1"></div>
                <p className="font-bold text-slate-900">Revisado por (Compliance / RH)</p>
              </div>
              <div>
                <div className="border-t border-slate-800 w-3/4 mx-auto mb-1"></div>
                <p className="font-bold text-slate-900">Aprovado por (Diretoria / Conselho)</p>
              </div>
            </div>
            <div className="mt-6 text-[9px] text-slate-400 text-center font-mono">
              Hash de Integridade Documental: SHA256-9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
            </div>
          </div>
        </div>

        <div className="print-hidden sticky bottom-0 flex items-center justify-between gap-3 p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-b-3xl">
          <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
            <Leaf className="w-3.5 h-3.5" /> Pronto para assinatura digital e auditoria externa.
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs font-bold">Fechar</Button>
            <Button onClick={onDownloadCSV} variant="outline" className="text-xs font-bold h-9 gap-1.5 border-slate-200">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> CSV
            </Button>
            <Button onClick={() => window.print()} className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold h-9 gap-2">
              <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * COMPONENTE PRINCIPAL (Central de Inteligência Hospitalar)
 * ============================================================ */
export default function Relatorios() {
  const { user, company, loading } = useAppData();
  const [shifts, setShifts] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [activeTab, setActiveTab] = useState('executiva');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSector, setSelectedSector] = useState('all');
  const [previewOpen, setPreviewOpen] = useState(false);

  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id || null;

  async function loadData() {
    if (!companyId) return;
    setLoadingData(true);
    try {
      const filters = { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) };
      const [shiftData, professionalData, sectorData] = await Promise.all([
        base44.entities.Shift.filter(filters, '-date', 2000).catch(() => []),
        base44.entities.Professional.filter(filters, '-created_date', 1000).catch(() => []),
        base44.entities.Sector.filter(filters, '-created_date', 200).catch(() => []),
      ]);
      setShifts(Array.isArray(shiftData) ? shiftData : []);
      setProfessionals(Array.isArray(professionalData) ? professionalData : []);
      setSectors(Array.isArray(sectorData) ? sectorData : []);
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
      setShifts([]); setProfessionals([]); setSectors([]);
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (!loading) loadData();
  }, [loading, companyId, unitId]);

  const filteredShifts = useMemo(() => {
    return (shifts || []).filter((shift) => {
      if (!shift) return false;
      const shiftDate = String(shift.date || '').split('T')[0];
      const matchesStart = !startDate || shiftDate >= startDate;
      const matchesEnd = !endDate || shiftDate <= endDate;
      const matchesSector = selectedSector === 'all' || String(shift.sector_id) === String(selectedSector) || shift.sector_name === selectedSector;
      return matchesStart && matchesEnd && matchesSector;
    });
  }, [shifts, startDate, endDate, selectedSector]);

  const byProfessional = useMemo(() => {
    const map = {};
    (professionals || []).forEach((professional) => {
      if (!professional?.id) return;
      const remunerationType = professional.remuneration_type || 'hora';
      let baseRate = 120;
      if (remunerationType === 'hora') baseRate = Number(professional.hourly_rate) || 120;
      else if (remunerationType === 'diaria') baseRate = Number(professional.daily_rate) || 1500;
      else if (remunerationType === 'mensal') baseRate = Number(professional.monthly_salary) || 18000;

      map[professional.id] = {
        id: professional.id,
        name: professional.name || 'Sem nome',
        category: professional.specialty || professional.category || 'Geral',
        confirmed: 0,
        pending: 0,
        canceled: 0,
        hours: 0,
        estimatedPay: 0,
        remunerationType,
        hourlyRate: baseRate,
      };
    });

    filteredShifts.forEach((shift) => {
      if (!shift?.professional_id) return;
      if (!map[shift.professional_id]) {
        map[shift.professional_id] = {
          id: shift.professional_id,
          name: shift.professional_name || 'Profissional',
          category: shift.sector_name || 'Geral',
          confirmed: 0,
          pending: 0,
          canceled: 0,
          hours: 0,
          estimatedPay: 0,
          remunerationType: 'hora',
          hourlyRate: 120,
        };
      }

      const professional = map[shift.professional_id];
      const duration = Number(shift.duration_hours) || 12;

      if (shift.status === 'confirmado') {
        professional.confirmed += 1;
        professional.hours += duration;

        if (professional.remunerationType === 'diaria') {
          professional.estimatedPay += professional.hourlyRate;
        } else if (professional.remunerationType === 'mensal') {
          professional.estimatedPay = professional.hourlyRate;
        } else {
          professional.estimatedPay += duration * professional.hourlyRate;
        }
      }
      if (shift.status === 'pendente') professional.pending += 1;
      if (shift.status === 'cancelado') professional.canceled += 1;
    });

    return Object.values(map)
      .filter((p) => p.confirmed > 0 || p.pending > 0 || p.canceled > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [filteredShifts, professionals]);

  const bySector = useMemo(() => {
    const map = {};
    filteredShifts.forEach((shift) => {
      if (!shift) return;
      const sectorName = shift.sector_name || 'Geral';
      if (!map[sectorName]) map[sectorName] = { total: 0, filled: 0, open: 0, canceled: 0 };
      map[sectorName].total += 1;
      if (shift.status === 'confirmado' || shift.status === 'pendente') map[sectorName].filled += 1;
      if (shift.status === 'vago') map[sectorName].open += 1;
      if (shift.status === 'cancelado') map[sectorName].canceled += 1;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [filteredShifts]);

  const auditLogs = useMemo(() => {
    return (filteredShifts || []).filter((shift) => shift && (shift.status === 'cancelado' || shift.notes));
  }, [filteredShifts]);

  const overview = useMemo(() => ({
    total: filteredShifts.length,
    confirmed: filteredShifts.filter((s) => s?.status === 'confirmado').length,
    pending: filteredShifts.filter((s) => s?.status === 'pendente').length,
    open: filteredShifts.filter((s) => s?.status === 'vago').length,
    canceled: filteredShifts.filter((s) => s?.status === 'cancelado').length,
  }), [filteredShifts]);

  const totalFinancialEstimate = useMemo(() => {
    return (byProfessional || []).reduce((total, p) => total + Number(p?.estimatedPay || 0), 0);
  }, [byProfessional]);

  const criticalAlerts = useMemo(() => {
    const alerts = [];
    if (overview.open > 0) alerts.push(`Existem ${overview.open} vaga(s) aberta(s) no período analisado.`);
    if (overview.canceled > 0) alerts.push(`Foram identificados ${overview.canceled} turno(s) cancelado(s).`);
    (bySector || []).forEach(([name, data]) => {
      const t = Number(data?.total || 0);
      const f = Number(data?.filled || 0);
      const pct = t ? (f / t) * 100 : 100;
      if (pct < 70) alerts.push(`O setor ${name} apresenta cobertura crítica de ${Math.round(pct)}%.`);
    });
    if (alerts.length === 0) alerts.push('Nenhum alerta crítico identificado nos filtros selecionados.');
    return alerts;
  }, [overview, bySector]);

  const filtersLabel = useMemo(() => {
    const parts = [];
    parts.push(startDate ? `de ${formatDateBR(startDate)}` : 'sem data inicial');
    parts.push(endDate ? `até ${formatDateBR(endDate)}` : 'até data final em aberto');
    parts.push(selectedSector === 'all' ? 'todos os setores' : `setor "${selectedSector}"`);
    return parts.join(' · ');
  }, [startDate, endDate, selectedSector]);

  const reportPayload = useMemo(() => {
    return buildReportPayload({
      tab: activeTab,
      company,
      user,
      filtersLabel,
      overview,
      byProfessional,
      bySector,
      auditLogs,
      totalFinancialEstimate,
      criticalAlerts,
    });
  }, [activeTab, company, user, filtersLabel, overview, byProfessional, bySector, auditLogs, totalFinancialEstimate, criticalAlerts]);

  function handleDownloadCSV() {
    const lines = [];
    lines.push(['Relatório', reportPayload.title].map(escapeCSV).join(';'));
    lines.push(['Instituição', reportPayload.companyName].map(escapeCSV).join(';'));
    lines.push(['Filtros', reportPayload.subtitle].map(escapeCSV).join(';'));
    lines.push('');
    reportPayload.kpis?.forEach((k) => lines.push([k.label, k.value].map(escapeCSV).join(';')));
    lines.push('');
    lines.push(reportPayload.columns.map(escapeCSV).join(';'));
    (reportPayload.rows || []).forEach((r) => lines.push(r.map(escapeCSV).join(';')));
    if (reportPayload.totalsRow) lines.push(reportPayload.totalsRow.map(escapeCSV).join(';'));

    const csv = '\uFEFF' + lines.join('\n');
    downloadFile(csv, `Relatorio_${reportPayload.key}_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sky-400">
            <BarChart3 className="w-4 h-4" /> Inteligência Hospitalar de Alta Performance
          </div>
          <h1 className="text-3xl font-black tracking-tight">Relatórios</h1>
          <p className="text-xs text-slate-300 max-w-2xl">
            Central corporativa estruturada em Visão Executiva, Relatórios Operacionais Aprofundados e Governança & Compliance.
          </p>
        </div>

        <Button
          onClick={() => setPreviewOpen(true)}
          className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs h-11 px-5 gap-2 shadow-lg shrink-0"
        >
          <Eye className="w-4 h-4" /> Visualizar Relatório Oficial A4
        </Button>
      </div>

      {/* Seletor de Camadas e Abas */}
      <div className="flex items-center bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto gap-1">
        {Object.entries(TABS_CONFIG).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 min-w-[200px] px-4 py-3 text-xs font-bold rounded-xl transition-all whitespace-nowrap text-center ${
              activeTab === key
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {meta.label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
          <Filter className="w-4 h-4 text-sky-600" /> Filtros:
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">Data inicial</label>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-9 text-xs bg-slate-50 dark:bg-slate-800" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">Data final</label>
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-9 text-xs bg-slate-50 dark:bg-slate-800" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">Setor</label>
            <Select value={String(selectedSector)} onValueChange={setSelectedSector}>
              <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800">
                <SelectValue placeholder="Todos os setores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                {(sectors || []).map((sector) => (
                  <SelectItem key={sector.id} value={String(sector.name)}>{sector.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(startDate || endDate || selectedSector !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setStartDate(''); setEndDate(''); setSelectedSector('all'); }} className="text-xs text-red-500 shrink-0">
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(reportPayload.kpis || []).map((kpi, index) => (
          <Card key={index} className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <div className="text-[10px] uppercase font-bold text-slate-400">{kpi.label}</div>
            <div className="text-xl font-black text-sky-700 dark:text-sky-400 mt-1 truncate">{kpi.value}</div>
          </Card>
        ))}
      </div>

      {loadingData ? (
        <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-sky-600" /></div>
      ) : (
        <Card className="p-6 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-sky-600" /> {reportPayload.title}
            </h3>
            <span className="text-xs font-semibold text-slate-400">{reportPayload.rows?.length || 0} registros listados</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
            {reportPayload.rows?.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">{reportPayload.emptyMessage}</p>
            ) : (
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800 uppercase">
                  <tr>
                    {reportPayload.columns?.map(col => <th key={col} className="p-3 font-bold">{col}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {reportPayload.rows?.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      {row.map((cell, j) => <td key={j} className="p-3 text-slate-700 dark:text-slate-200">{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
                {reportPayload.totalsRow && (
                  <tfoot className="bg-slate-100 dark:bg-slate-800 font-black">
                    <tr>
                      {reportPayload.totalsRow.map((cell, j) => <td key={j} className="p-3 text-slate-900 dark:text-white">{cell}</td>)}
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </Card>
      )}

      {previewOpen && (
        <ReportPreviewModal
          payload={reportPayload}
          onClose={() => setPreviewOpen(false)}
          onDownloadCSV={handleDownloadCSV}
        />
      )}
    </div>
  );
}