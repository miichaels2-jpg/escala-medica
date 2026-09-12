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
  Eye, X, Leaf, Sparkles, AlertTriangle, Users, CheckCircle2, ClipboardList, Printer
} from 'lucide-react';

/* ============================================================
 * Helpers de formatação (pt-BR)
 * ============================================================ */
function formatCurrency(value = 0) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateBR(dateStr) {
  if (!dateStr) return '—';
  const value = String(dateStr).split('T')[0];
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

function escapeCSV(value) {
  return `"${String(value ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
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

const TAB_META = {
  consolidado: { label: '📊 Conselho Consolidado', icon: BarChart3 },
  produtividade: { label: '⏱️ Produtividade', icon: Clock },
  cobertura: { label: '🏥 Cobertura', icon: TrendingUp },
  financeiro: { label: '💰 Financeiro', icon: DollarSign },
  auditoria: { label: '🛡️ Auditoria', icon: ShieldCheck },
};

/* ============================================================
 * BUILD REPORT PAYLOAD (Única fonte de verdade)
 * ============================================================ */
function buildReportPayload({ tab, company, user, filtersLabel, overview, byProfessional, bySector, auditLogs, totalFinancialEstimate, criticalAlerts }) {
  const companyName = company?.name || 'Instituição Hospitalar';
  const generatedBy = user?.data?.full_name || user?.data?.name || user?.email || 'Gestor Operacional';
  const generatedAt = new Date();
  const base = { companyName, generatedBy, generatedAt, subtitle: filtersLabel };

  if (tab === 'produtividade') {
    const totalHours = byProfessional.reduce((total, p) => total + Number(p.hours || 0), 0);
    return {
      ...base,
      key: tab,
      title: 'Relatório de Produtividade do Corpo Clínico',
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
      const percentage = data.total ? Math.round((data.filled / data.total) * 100) : 0;
      return [name, data.total, data.filled, data.open, data.canceled, `${percentage}%`];
    });
    const averageCoverage = bySector.length
      ? Math.round(bySector.reduce((total, [, data]) => total + (data.total ? (data.filled / data.total) * 100 : 0), 0) / bySector.length)
      : 0;

    return {
      ...base,
      key: tab,
      title: 'Relatório de Cobertura Operacional por Setor',
      kpis: [
        { label: 'Setores mapeados', value: bySector.length },
        { label: 'Cobertura média', value: `${averageCoverage}%` },
        { label: 'Vagas abertas', value: overview.open },
        { label: 'Total turnos', value: overview.total },
      ],
      columns: ['Setor', 'Turnos Totais', 'Preenchidos', 'Vagas Abertas', 'Cancelados', '% Cobertura'],
      rows,
      emptyMessage: 'Sem dados de setores para os filtros selecionados.',
    };
  }

  if (tab === 'financeiro') {
    const totalHours = byProfessional.reduce((total, p) => total + Number(p.hours || 0), 0);
    return {
      ...base,
      key: tab,
      title: 'Relatório de Projeção de Repasse Financeiro',
      kpis: [
        { label: 'Total estimado', value: formatCurrency(totalFinancialEstimate) },
        { label: 'Profissionais faturados', value: byProfessional.length },
        { label: 'Horas faturáveis', value: `${totalHours}h` },
      ],
      columns: ['Profissional', 'Modelo', 'Quantidade / Horas', 'Total a Liquidar'],
      rows: byProfessional.map((p) => [
        p.name,
        p.remunerationType === 'diaria' ? 'Por Plantão/Diária' : p.remunerationType === 'mensal' ? 'Fixo Mensal' : 'Horista',
        p.remunerationType === 'hora' ? `${p.hours}h` : `${p.confirmed} plantão(ões)`,
        formatCurrency(p.estimatedPay),
      ]),
      totalsRow: ['TOTAL', '', `${totalHours}h`, formatCurrency(totalFinancialEstimate)],
      emptyMessage: 'Nenhum valor a liquidar para os filtros selecionados.',
    };
  }

  if (tab === 'auditoria') {
    const canceledCount = auditLogs.filter((log) => log.status === 'cancelado').length;
    const withNotes = auditLogs.filter((log) => log.notes).length;

    return {
      ...base,
      key: tab,
      title: 'Relatório de Log de Auditoria e Plantões Cancelados',
      kpis: [
        { label: 'Eventos totais', value: auditLogs.length },
        { label: 'Cancelamentos', value: canceledCount },
        { label: 'Com observação', value: withNotes },
      ],
      columns: ['Data', 'Horário', 'Profissional', 'Setor', 'Status', 'Observação', 'ID'],
      rows: auditLogs.map((log) => [
        formatDateBR(log.date),
        `${log.start_time || '--'} - ${log.end_time || '--'}`,
        log.professional_name || 'Vago',
        log.sector_name || 'Geral',
        log.status || '—',
        log.notes || '—',
        log.id || '—',
      ]),
      emptyMessage: 'Nenhum evento de cancelamento ou alteração registrado no período.',
    };
  }

  return {
    ...base,
    key: 'consolidado',
    title: 'Relatório Consolidado do Conselho',
    kpis: [
      { label: 'Turnos analisados', value: overview.total },
      { label: 'Turnos confirmados', value: overview.confirmed },
      { label: 'Cobertura geral', value: overview.total ? `${Math.round((overview.confirmed / overview.total) * 100)}%` : '0%' },
      { label: 'Custo estimado', value: formatCurrency(totalFinancialEstimate) },
    ],
    criticalAlerts,
    sections: [
      {
        title: 'Resumo Operacional',
        columns: ['Indicador', 'Resultado'],
        rows: [
          ['Total de turnos analisados', overview.total],
          ['Turnos confirmados', overview.confirmed],
          ['Turnos pendentes', overview.pending],
          ['Vagas abertas', overview.open],
          ['Turnos cancelados', overview.canceled],
          ['Profissionais envolvidos', byProfessional.length],
          ['Setores envolvidos', bySector.length],
        ],
      },
      {
        title: 'Produtividade do Corpo Clínico',
        columns: ['Profissional', 'Especialidade', 'Confirmados', 'Pendentes', 'Horas'],
        rows: byProfessional.map((p) => [p.name, p.category, p.confirmed, p.pending, `${p.hours}h`]),
      },
      {
        title: 'Cobertura por Setor',
        columns: ['Setor', 'Total', 'Preenchidos', 'Abertos', 'Cancelados', 'Cobertura'],
        rows: bySector.map(([name, data]) => {
          const percentage = data.total ? Math.round((data.filled / data.total) * 100) : 0;
          return [name, data.total, data.filled, data.open, data.canceled, `${percentage}%`];
        }),
      },
      {
        title: 'Resumo Financeiro',
        columns: ['Profissional', 'Modelo', 'Quantidade / Horas', 'Valor Estimado'],
        rows: byProfessional.map((p) => [
          p.name,
          p.remunerationType === 'diaria' ? 'Diária' : p.remunerationType === 'mensal' ? 'Mensal' : 'Horista',
          p.remunerationType === 'hora' ? `${p.hours}h` : `${p.confirmed} plantão(ões)`,
          formatCurrency(p.estimatedPay),
        ]),
      },
      {
        title: 'Auditoria e Riscos',
        columns: ['Data', 'Profissional', 'Setor', 'Status', 'Observação'],
        rows: auditLogs.map((log) => [
          formatDateBR(log.date),
          log.professional_name || 'Vago',
          log.sector_name || 'Geral',
          log.status || '—',
          log.notes || '—',
        ]),
      },
    ],
    emptyMessage: 'Nenhum dado encontrado para o período selecionado.',
  };
}

/* ============================================================
 * MODAL DE PRÉ-VISUALIZAÇÃO COM ESTILO DE IMPRESSÃO PROFISSIONAL A4
 * ============================================================ */
function ReportPreviewModal({ payload, onClose, onDownloadCSV }) {
  if (!payload) return null;

  const isConsolidated = payload.key === 'consolidado';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-slate-950/80 backdrop-blur-sm print:p-0 print:bg-white print:inset-auto print:relative print:block">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-document, #print-document * {
            visibility: visible;
          }
          #print-document {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 15mm;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }
          .print-hidden {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>

      <div 
        id="print-document"
        className="w-full max-w-4xl max-h-[94vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl print:max-h-none print:border-0 print:shadow-none print:rounded-none"
      >
        {/* Cabeçalho do Documento Impresso / Modal */}
        <div className="sticky top-0 z-20 flex items-start justify-between gap-4 p-5 md:p-6 bg-slate-900 text-white rounded-t-3xl print:static print:bg-white print:text-slate-900 print:border-b-2 print:border-slate-900 print:pb-4 print:rounded-none">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-400 print:text-sky-700">
              <ShieldCheck className="w-4 h-4" /> Documento Oficial Certificado
            </div>
            <h2 className="text-xl md:text-2xl font-black mt-1">{payload.title}</h2>
            <p className="text-xs text-slate-300 print:text-slate-600 mt-1">Instituição: <b>{payload.companyName}</b> · Filtros: {payload.subtitle}</p>
            <p className="text-[10px] text-slate-400 print:text-slate-500 mt-0.5">Emitido em {payload.generatedAt.toLocaleString('pt-BR')} {payload.generatedBy ? `por ${payload.generatedBy}` : ''}</p>
          </div>
          <button onClick={onClose} className="print-hidden p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 md:p-6 space-y-6">
          {/* KPIs */}
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
                <AlertTriangle className="w-4 h-4" /> Pontos de Atenção Críticos
              </div>
              <div className="space-y-1">
                {payload.criticalAlerts.map((alert, index) => (
                  <div key={index} className="text-xs text-red-700 font-medium">• {alert}</div>
                ))}
              </div>
            </div>
          )}

          {isConsolidated ? (
            <div className="space-y-6">
              {payload.sections?.map((section, sIdx) => (
                <section key={sIdx} className="space-y-2">
                  <h3 className="font-black text-sm text-slate-900 dark:text-white border-b border-slate-200 pb-1">{section.title}</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 uppercase text-[10px]">
                        <tr>
                          {section.columns.map(col => <th key={col} className="p-2.5 font-bold">{col}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {section.rows.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {row.map((cell, cIdx) => <td key={cIdx} className="p-2.5 text-slate-800">{cell}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              {payload.rows?.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">{payload.emptyMessage}</p>
              ) : (
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-700 uppercase text-[10px]">
                    <tr>
                      {payload.columns.map(col => <th key={col} className="p-3 font-bold">{col}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {payload.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {row.map((cell, j) => <td key={j} className="p-3 text-slate-800">{cell}</td>)}
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
          )}

          {/* Assinatura institucional para impressão */}
          <div className="hidden print:block pt-12 mt-12 border-t border-slate-300">
            <div className="grid grid-cols-2 gap-12 text-center">
              <div>
                <div className="border-t border-slate-800 w-3/4 mx-auto mb-1"></div>
                <p className="text-xs font-bold text-slate-900">Diretoria Executiva / Conselho</p>
              </div>
              <div>
                <div className="border-t border-slate-800 w-3/4 mx-auto mb-1"></div>
                <p className="text-xs font-bold text-slate-900">Coordenação Médica / Controller</p>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal (oculto na impressão física) */}
        <div className="print-hidden sticky bottom-0 flex items-center justify-between gap-3 p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-b-3xl">
          <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
            <Leaf className="w-3.5 h-3.5" /> Conferido. Pronto para emitir.
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs font-bold">Fechar</Button>
            <Button onClick={onDownloadCSV} variant="outline" className="text-xs font-bold h-9 gap-1.5 border-slate-200">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> CSV
            </Button>
            <Button onClick={handlePrint} className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold h-9 gap-2">
              <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * COMPONENTE PRINCIPAL
 * ============================================================ */
export default function Relatorios() {
  const { user, company, loading } = useAppData();
  const [shifts, setShifts] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [activeTab, setActiveTab] = useState('consolidado');
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
    return shifts.filter((shift) => {
      if (!shift) return false;
      const shiftDate = String(shift.date || '').split('T')[0];
      const matchesStart = !startDate || shiftDate >= startDate;
      const matchesEnd = !endDate || shiftDate <= endDate;
      const matchesSector = selectedSector === 'all' || String(shift.sector_id) === String(selectedSector) || shift.sector_name === selectedSector;
      return matchesStart && matchesEnd && matchesSector;
    });
  }, [shifts, startDate, endDate, selectedSector]);

  // MOTOR DE CÁLCULO FINANCEIRO REAL (Igual ao módulo de faturamento)
  const byProfessional = useMemo(() => {
    const map = {};
    professionals.forEach((professional) => {
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
    return filteredShifts.filter((shift) => shift && (shift.status === 'cancelado' || shift.notes));
  }, [filteredShifts]);

  const overview = useMemo(() => ({
    total: filteredShifts.length,
    confirmed: filteredShifts.filter((s) => s?.status === 'confirmado').length,
    pending: filteredShifts.filter((s) => s?.status === 'pendente').length,
    open: filteredShifts.filter((s) => s?.status === 'vago').length,
    canceled: filteredShifts.filter((s) => s?.status === 'cancelado').length,
  }), [filteredShifts]);

  const totalFinancialEstimate = useMemo(() => {
    return byProfessional.reduce((total, p) => total + Number(p.estimatedPay || 0), 0);
  }, [byProfessional]);

  const criticalAlerts = useMemo(() => {
    const alerts = [];
    if (overview.open > 0) alerts.push(`Existem ${overview.open} vaga(s) aberta(s) no período analisado.`);
    if (overview.canceled > 0) alerts.push(`Foram identificados ${overview.canceled} turno(s) cancelado(s).`);
    if (alerts.length === 0) alerts.push('Nenhum alerta crítico identificado nos filtros selecionados.');
    return alerts;
  }, [overview]);

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

    if (reportPayload.key === 'consolidado') {
      reportPayload.sections?.forEach((sec) => {
        lines.push(escapeCSV(sec.title));
        lines.push(sec.columns.map(escapeCSV).join(';'));
        sec.rows.forEach((r) => lines.push(r.map(escapeCSV).join(';')));
        lines.push('');
      });
    } else {
      lines.push(reportPayload.columns.map(escapeCSV).join(';'));
      reportPayload.rows.forEach((r) => lines.push(r.map(escapeCSV).join(';')));
      if (reportPayload.totalsRow) lines.push(reportPayload.totalsRow.map(escapeCSV).join(';'));
    }

    const csv = '\uFEFF' + lines.join('\n');
    downloadFile(csv, `Relatorio_${reportPayload.key}_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sky-400">
            <BarChart3 className="w-4 h-4" /> Inteligência Executiva & Governança
          </div>
          <h1 className="text-3xl font-black tracking-tight">Relatórios</h1>
          <p className="text-xs text-slate-300 max-w-2xl">
            Relatório consolidado para análise executiva, acompanhamento operacional, produtividade, cobertura, auditoria e projeção financeira.
          </p>
        </div>

        <Button
          onClick={() => setPreviewOpen(true)}
          className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs h-11 px-5 gap-2 shadow-lg shrink-0"
        >
          <Eye className="w-4 h-4" /> Visualizar Relatório Oficial
        </Button>
      </div>

      {/* Abas */}
      <div className="flex items-center bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto gap-1">
        {Object.entries(TAB_META).map(([key, meta]) => {
          const Icon = meta.icon;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 min-w-[170px] px-4 py-3 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center justify-center gap-2 ${
                activeTab === key
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {meta.label.replace(/^\S+\s/, '')}
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
          <Filter className="w-4 h-4 text-sky-600" /> Filtros:
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">Data inicial</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-xs bg-slate-50 dark:bg-slate-800" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">Data final</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 text-xs bg-slate-50 dark:bg-slate-800" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">Setor</label>
            <Select value={String(selectedSector)} onValueChange={setSelectedSector}>
              <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800">
                <SelectValue placeholder="Todos os setores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={String(s.name)}>{s.name}</SelectItem>
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

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {reportPayload.kpis?.map((kpi, idx) => (
          <Card key={idx} className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <div className="text-[10px] uppercase font-bold text-slate-400">{kpi.label}</div>
            <div className="text-xl font-black text-sky-700 dark:text-sky-400 mt-1 truncate">{kpi.value}</div>
          </Card>
        ))}
      </div>

      {/* Conteúdo Dinâmico Tela */}
      {loadingData ? (
        <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-sky-600" /></div>
      ) : (
        <Card className="p-6 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <h3 className="font-black text-base text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-sky-600" /> {reportPayload.title}
          </h3>
          <p className="text-xs text-slate-500 mb-4">Utilize o botão superior <b>"Visualizar Relatório Oficial"</b> para emitir a via em PDF/Impressão formatada sem poluição visual.</p>

          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase">
                <tr>
                  {reportPayload.columns.map((col) => <th key={col} className="p-3 font-bold">{col}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {reportPayload.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
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