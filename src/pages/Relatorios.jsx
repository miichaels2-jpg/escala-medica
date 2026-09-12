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
  BarChart3,
  ClipboardList,
  DollarSign,
  Eye,
  FileSpreadsheet,
  Filter,
  Loader2,
  Printer,
  ShieldCheck,
  AlertTriangle,
  X,
  Leaf,
  Activity,
  Users,
  CheckCircle2,
  Clock,
  Building2,
  Map,
  ChevronRight,
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

/* ============================================================
   FUNÇÕES UTILITÁRIAS
============================================================ */

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart;
  }
  return '';
}

function formatDateBR(dateValue) {
  const value = normalizeDate(dateValue);
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function escapeCSV(value) {
  return `"${String(value ?? '')
    .replace(/"/g, '""')
    .replace(/\r?\n/g, ' ')}"`;
}

function downloadFile(
  content,
  filename,
  type = 'text/csv;charset=utf-8;'
) {
  try {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (error) {
    console.error('Erro ao baixar arquivo:', error);
  }
}

function calculatePercentage(value, total) {
  const safeTotal = safeNumber(total);
  if (safeTotal <= 0) return 0;
  return Math.round((safeNumber(value) / safeTotal) * 100);
}

function getRemunerationType(professional) {
  const value = String(
    professional?.remuneration_type ||
      professional?.remunerationType ||
      REMUNERATION_TYPE.HOUR
  ).toLowerCase();

  if (value === REMUNERATION_TYPE.DAILY) {
    return REMUNERATION_TYPE.DAILY;
  }
  if (value === REMUNERATION_TYPE.MONTHLY) {
    return REMUNERATION_TYPE.MONTHLY;
  }
  return REMUNERATION_TYPE.HOUR;
}

function getProfessionalName(professional) {
  return (
    professional?.name ||
    professional?.full_name ||
    professional?.fullName ||
    'Sem nome'
  );
}

function getSectorName(shift) {
  return (
    shift?.sector_name ||
    shift?.sectorName ||
    shift?.sector?.name ||
    'Geral'
  );
}

function getProfessionalId(shift) {
  return shift?.professional_id || shift?.professionalId || null;
}

function getSectorId(shift) {
  return shift?.sector_id || shift?.sectorId || null;
}

function getShiftStatus(shift) {
  return String(shift?.status || '').toLowerCase().trim();
}

function getShiftDuration(shift) {
  return safeNumber(
    shift?.duration_hours ?? shift?.durationHours ?? shift?.hours,
    0
  );
}

function getCoverageLevel(percentage) {
  const value = safeNumber(percentage);
  if (value < 70) {
    return {
      key: 'critical',
      label: 'CRÍTICO',
      description: 'Cobertura operacional baixa',
    };
  }
  if (value < 90) {
    return {
      key: 'attention',
      label: 'ATENÇÃO',
      description: 'Cobertura operacional requer acompanhamento',
    };
  }
  return {
    key: 'adequate',
    label: 'ADEQUADO',
    description: 'Cobertura operacional satisfatória',
  };
}

/* ============================================================
   CONFIGURAÇÃO DOS RELATÓRIOS
============================================================ */

const TABS_CONFIG = {
  executiva: {
    label: 'Visão Executiva',
    group: 'camada1',
    icon: BarChart3,
  },
  produtividade: {
    label: 'Produtividade & Horas',
    group: 'camada2',
    icon: ClipboardList,
  },
  cobertura: {
    label: 'Cobertura & Mapa de Calor',
    group: 'camada2',
    icon: Activity,
  },
  risco: {
    label: 'Risco Assistencial',
    group: 'camada2',
    icon: AlertTriangle,
  },
  financeiro: {
    label: 'Financeiro Avançado',
    group: 'camada2',
    icon: DollarSign,
  },
  turnover: {
    label: 'Turnover & Absenteísmo',
    group: 'camada2',
    icon: Users,
  },
  auditoria: {
    label: 'Governança & Auditoria',
    group: 'camada3',
    icon: ShieldCheck,
  },
};

/* ============================================================
   GERADOR DE PAYLOAD
============================================================ */

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
  const companyName =
    company?.name || company?.company_name || 'Instituição Hospitalar';

  const generatedBy =
    user?.data?.full_name ||
    user?.data?.name ||
    user?.email ||
    'Usuário do sistema';

  const base = {
    companyName,
    generatedBy,
    generatedAt: new Date(),
    subtitle: filtersLabel,
  };

  if (tab === 'executiva') {
    const totalHours = byProfessional.reduce(
      (total, professional) => total + safeNumber(professional?.hours),
      0
    );
    const coverage = calculatePercentage(overview.confirmed, overview.total);

    return {
      ...base,
      key: tab,
      title: 'Sumário Executivo para Diretoria & Conselho',
      kpis: [
        { label: 'Custo Total Estimado', value: formatCurrency(totalFinancialEstimate) },
        { label: 'Cobertura Global', value: `${coverage}%` },
        { label: 'Profissionais Ativos', value: byProfessional.length },
        { label: 'Vagas Abertas', value: overview.open || 0 },
      ],
      criticalAlerts,
      columns: ['Indicador Executivo', 'Resultado Consolidado'],
      rows: [
        ['Total de turnos no período', overview.total || 0],
        ['Turnos confirmados', overview.confirmed || 0],
        ['Turnos pendentes', overview.pending || 0],
        ['Vagas abertas', overview.open || 0],
        ['Turnos cancelados', overview.canceled || 0],
        ['Cobertura global', `${coverage}%`],
        ['Custo financeiro estimado', formatCurrency(totalFinancialEstimate)],
        ['Carga horária total', `${totalHours}h`],
      ],
      emptyMessage: 'Sem dados suficientes para consolidação executiva.',
    };
  }

  if (tab === 'produtividade') {
    const totalHours = byProfessional.reduce(
      (total, professional) => total + safeNumber(professional?.hours),
      0
    );

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
      columns: [
        'Profissional',
        'Categoria / Especialidade',
        'Confirmados',
        'Pendentes',
        'Cancelados',
        'Horas Totais',
      ],
      rows: byProfessional.map((professional) => [
        professional?.name || '—',
        professional?.category || '—',
        professional?.confirmed || 0,
        professional?.pending || 0,
        professional?.canceled || 0,
        `${safeNumber(professional?.hours)}h`,
      ]),
      totalsRow: [
        'TOTAL',
        '',
        overview.confirmed || 0,
        overview.pending || 0,
        overview.canceled || 0,
        `${totalHours}h`,
      ],
      emptyMessage: 'Nenhum profissional com plantões no período selecionado.',
    };
  }

  if (tab === 'cobertura') {
    const rows = bySector.map(([name, data]) => {
      const total = safeNumber(data?.total);
      const filled = safeNumber(data?.filled);
      const open = safeNumber(data?.open);
      const canceled = safeNumber(data?.canceled);
      const percentage = calculatePercentage(filled, total);

      return [name || 'Geral', total, filled, open, canceled, `${percentage}%`];
    });

    return {
      ...base,
      key: tab,
      title: 'Cobertura Operacional por Setor',
      kpis: [
        { label: 'Setores mapeados', value: bySector.length },
        { label: 'Vagas abertas', value: overview.open || 0 },
        { label: 'Turnos totais', value: overview.total || 0 },
        {
          label: 'Cobertura global',
          value: `${calculatePercentage(overview.confirmed, overview.total)}%`,
        },
      ],
      columns: [
        'Setor',
        'Turnos Totais',
        'Confirmados',
        'Vagas Abertas',
        'Cancelados',
        '% Cobertura',
      ],
      rows,
      emptyMessage: 'Sem dados de setores para os filtros selecionados.',
    };
  }

  if (tab === 'risco') {
    return {
      ...base,
      key: tab,
      title: 'Painel de Risco Assistencial e Cobertura Operacional',
      kpis: [
        { label: 'Setores monitorados', value: bySector.length },
        { label: 'Alertas identificados', value: criticalAlerts.length },
        { label: 'Vagas abertas', value: overview.open || 0 },
        { label: 'Cancelamentos', value: overview.canceled || 0 },
      ],
      columns: ['Setor / Ala', 'Cobertura', 'Vagas', 'Classificação Operacional'],
      rows: bySector.map(([name, data]) => {
        const total = safeNumber(data?.total);
        const filled = safeNumber(data?.filled);
        const open = safeNumber(data?.open);
        const percentage = calculatePercentage(filled, total);
        const level = getCoverageLevel(percentage);

        return [name || 'Geral', `${percentage}%`, `${open} vaga(s)`, level.label];
      }),
      emptyMessage: 'Nenhum setor encontrado no período selecionado.',
    };
  }

  if (tab === 'financeiro') {
    const totalHours = byProfessional.reduce(
      (total, professional) => total + safeNumber(professional?.hours),
      0
    );

    return {
      ...base,
      key: tab,
      title: 'Financeiro — Projeção de Custos e Repasse',
      kpis: [
        { label: 'Total estimado', value: formatCurrency(totalFinancialEstimate) },
        { label: 'Profissionais', value: byProfessional.length },
        { label: 'Horas faturáveis', value: `${totalHours}h` },
        {
          label: 'Registros financeiros',
          value: byProfessional.filter((p) => safeNumber(p?.estimatedPay) > 0).length,
        },
      ],
      columns: ['Profissional', 'Modelo de Remuneração', 'Quantidade / Horas', 'Total Estimado'],
      rows: byProfessional.map((professional) => {
        let remunerationLabel = 'Horista';
        if (professional?.remunerationType === REMUNERATION_TYPE.DAILY) {
          remunerationLabel = 'Por Plantão / Diária';
        } else if (professional?.remunerationType === REMUNERATION_TYPE.MONTHLY) {
          remunerationLabel = 'Fixo Mensal';
        }

        const quantity =
          professional?.remunerationType === REMUNERATION_TYPE.HOUR
            ? `${safeNumber(professional?.hours)}h`
            : professional?.remunerationType === REMUNERATION_TYPE.DAILY
            ? `${safeNumber(professional?.confirmed)} plantão(ões)`
            : 'Mensal';

        return [
          professional?.name || '—',
          remunerationLabel,
          quantity,
          professional?.financialDataAvailable
            ? formatCurrency(professional?.estimatedPay)
            : 'Não informado',
        ];
      }),
      totalsRow: ['TOTAL', '', `${totalHours}h`, formatCurrency(totalFinancialEstimate)],
      emptyMessage: 'Nenhum dado financeiro disponível para os filtros selecionados.',
    };
  }

  if (tab === 'turnover') {
    const totalCanceled = safeNumber(overview.canceled);
    const absenteeismRate =
      overview.total > 0 ? ((totalCanceled / overview.total) * 100).toFixed(1) : '0.0';

    return {
      ...base,
      key: tab,
      title: 'Turnover, Cancelamentos e Absenteísmo',
      kpis: [
        { label: 'Cancelamentos', value: totalCanceled },
        { label: 'Taxa de cancelamento', value: `${absenteeismRate}%` },
        { label: 'Eventos auditados', value: auditLogs.length },
      ],
      columns: ['Profissional / Evento', 'Setor', 'Data', 'Status', 'Observação'],
      rows: auditLogs
        .filter((log) => getShiftStatus(log) === SHIFT_STATUS.CANCELLED)
        .map((log) => [
          log?.professional_name || log?.professionalName || 'Profissional',
          getSectorName(log),
          formatDateBR(log?.date),
          'Cancelado',
          log?.notes || 'Cancelado sem justificativa informada',
        ]),
      emptyMessage: 'Nenhum cancelamento registrado no período selecionado.',
    };
  }

  return {
    ...base,
    key: tab,
    title: 'Governança, Compliance e Trilha de Auditoria',
    kpis: [
      { label: 'Eventos auditados', value: auditLogs.length },
      { label: 'Identificação documental', value: 'Gerada no relatório' },
    ],
    columns: ['Data', 'Horário', 'Profissional', 'Setor', 'Status', 'Observação', 'ID de Transação'],
    rows: auditLogs.map((log) => [
      formatDateBR(log?.date),
      `${log?.start_time || '--'} - ${log?.end_time || '--'}`,
      log?.professional_name || log?.professionalName || 'Vago',
      getSectorName(log),
      log?.status || '—',
      log?.notes || '—',
      log?.id || '—',
    ]),
    emptyMessage: 'Nenhum evento de auditoria registrado no período.',
  };
}

/* ============================================================
   MODAL DE DETALHAMENTO DO SETOR
============================================================ */
function SectorDetailModal({ sectorName, shifts, onClose }) {
  if (!sectorName) return null;

  const sectorShifts = (shifts || [])
    .filter((shift) => getSectorName(shift) === sectorName)
    .sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')));

  return (
    <div
      className="fixed inset-0 z-[10000] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden bg-white dark:bg-slate-950 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
        <header className="flex items-center justify-between gap-4 p-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-sky-600">Detalhamento operacional</div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">{sectorName}</h3>
            <p className="text-xs text-slate-400 mt-1">{sectorShifts.length} plantão(ões) nos filtros atuais.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
            <X className="w-5 h-5" />
          </Button>
        </header>

        <div className="overflow-auto p-0">
          {sectorShifts.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">Nenhum plantão encontrado.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200">
                <tr>
                  <th className="p-3 text-left font-bold">Data</th>
                  <th className="p-3 text-left font-bold">Horário</th>
                  <th className="p-3 text-left font-bold">Profissional</th>
                  <th className="p-3 text-left font-bold">Status</th>
                  <th className="p-3 text-left font-bold">Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sectorShifts.map((shift, index) => {
                  const status = getShiftStatus(shift);
                  return (
                    <tr key={shift?.id || index} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                      <td className="p-3 font-semibold">{formatDateBR(shift?.date)}</td>
                      <td className="p-3">{shift?.start_time || '--'} - {shift?.end_time || '--'}</td>
                      <td className="p-3 font-semibold">{shift?.professional_name || shift?.professionalName || 'Vago'}</td>
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-1 rounded-lg text-[9px] font-black uppercase ${
                          status === SHIFT_STATUS.CONFIRMED ? 'bg-emerald-100 text-emerald-700' :
                          status === SHIFT_STATUS.PENDING ? 'bg-amber-100 text-amber-700' :
                          status === SHIFT_STATUS.CANCELLED ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">{shift?.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <footer className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </footer>
      </div>
    </div>
  );
}

/* ============================================================
   MODAL DE PRÉ-VISUALIZAÇÃO A4
============================================================ */
function ReportPreviewModal({ payload, onClose, onDownloadCSV }) {
  if (!payload) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6 bg-slate-950/80 backdrop-blur-sm" role="dialog" aria-modal="true">
      <style>{`
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          body * { visibility: hidden !important; }
          #print-document, #print-document * { visibility: visible !important; }
          #print-document {
            position: absolute !important; left: 0 !important; top: 0 !important;
            width: 210mm !important; min-height: 297mm !important;
            margin: 0 !important; padding: 12mm !important;
            background: white !important; color: #0f172a !important;
            border: none !important; border-radius: 0 !important; box-shadow: none !important;
          }
          .print-hidden { display: none !important; }
          .print-only { display: block !important; }
          @page { size: A4 portrait; margin: 0; }
        }
        .print-only { display: none; }
      `}</style>

      <div id="print-document" className="w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl print:max-h-none print:border-0 print:shadow-none print:rounded-none">
        <header className="sticky top-0 z-20 flex items-start justify-between gap-4 p-5 md:p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 text-white rounded-t-3xl print:static print:bg-white print:text-slate-900 print:border-b-2 print:border-slate-900 print:rounded-none">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-400 print:text-sky-700">
              <ShieldCheck className="w-4 h-4" /> Governança Hospitalar
            </div>
            <h2 className="text-xl md:text-2xl font-black mt-2">{payload.title}</h2>
            <p className="text-xs text-slate-300 print:text-slate-600 mt-2">Instituição: <b>{payload.companyName}</b></p>
            <p className="text-xs text-slate-300 print:text-slate-600 mt-1">Escopo: {payload.subtitle}</p>
            <p className="text-[10px] text-slate-400 print:text-slate-500 mt-1">Emitido em {payload.generatedAt.toLocaleString('pt-BR')} por {payload.generatedBy}</p>
          </div>
          <button type="button" onClick={onClose} className="print-hidden p-2 rounded-full bg-white/10 hover:bg-white/20 transition text-white" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </header>

        <main className="p-5 md:p-6 space-y-6">
          {payload.kpis?.length > 0 && (
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:grid-cols-4">
              {payload.kpis.map((kpi, index) => (
                <div key={`${kpi.label}-${index}`} className="rounded-2xl border border-slate-200 dark:border-slate-800 print:border-slate-300 bg-slate-50 dark:bg-slate-900 print:bg-slate-50 p-3.5 break-inside-avoid">
                  <div className="text-[9px] uppercase font-bold text-slate-400 print:text-slate-600">{kpi.label}</div>
                  <div className="text-base font-black text-sky-700 dark:text-sky-400 print:text-slate-900 mt-1">{kpi.value}</div>
                </div>
              ))}
            </section>
          )}

          {payload.criticalAlerts?.length > 0 && (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-4 print:border-red-300 print:bg-red-50 break-inside-avoid">
              <div className="flex items-center gap-2 text-red-800 font-black text-xs mb-3">
                <AlertTriangle className="w-4 h-4" /> Alertas Operacionais
              </div>
              <div className="space-y-1">
                {payload.criticalAlerts.map((alert, index) => (
                  <div key={index} className="text-xs text-red-700 font-medium">• {alert}</div>
                ))}
              </div>
            </section>
          )}

          <section className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            {payload.rows?.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-12">{payload.emptyMessage}</div>
            ) : (
              <table className="w-full text-xs text-left whitespace-nowrap border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 uppercase text-[10px] print:bg-slate-100 print:text-slate-900">
                  <tr>
                    {payload.columns?.map((column) => (
                      <th key={column} className="p-3 font-bold border-b border-slate-200 print:border-slate-300">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                  {payload.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 break-inside-avoid page-break-inside-avoid">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="p-3 text-slate-800 dark:text-slate-200 print:text-slate-900 align-top">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {payload.totalsRow && (
                  <tfoot className="bg-slate-900 text-white font-black print:bg-slate-100 print:text-slate-900">
                    <tr>
                      {payload.totalsRow.map((cell, index) => (
                        <td key={index} className="p-3 border-t border-slate-700 print:border-slate-300">{cell}</td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </section>

          <section className="print-only pt-10 mt-10 border-t border-slate-300">
            <div className="grid grid-cols-2 gap-12 text-center text-xs">
              <div>
                <div className="border-t border-slate-800 w-3/4 mx-auto mb-2"></div>
                <p className="font-bold text-slate-900">Revisado por</p>
                <p className="text-slate-500">Compliance / RH</p>
              </div>
              <div>
                <div className="border-t border-slate-800 w-3/4 mx-auto mb-2"></div>
                <p className="font-bold text-slate-900">Aprovado por</p>
                <p className="text-slate-500">Diretoria / Conselho</p>
              </div>
            </div>
            <div className="mt-8 text-[9px] text-slate-500 text-center font-mono">
              Identificação documental: {payload.documentId}
            </div>
          </section>
        </main>

        <footer className="print-hidden sticky bottom-0 flex items-center justify-between gap-3 p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-b-3xl">
          <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
            <Leaf className="w-3.5 h-3.5" /> Documento pronto para conferência.
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
        </footer>
      </div>
    </div>
  );
}

/* ============================================================
   PAINEL ESPECÍFICO DE COBERTURA & MAPA DE CALOR
============================================================ */
function CoverageDashboard({ coverageSummary, coverageMap, onSelectSector }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase"><Activity className="w-4 h-4 text-sky-600" /> Cobertura global</div>
          <div className="text-2xl font-black mt-2 text-slate-900 dark:text-white">{coverageSummary.coverage}%</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Confirmados</div>
          <div className="text-2xl font-black mt-2 text-slate-900 dark:text-white">{coverageSummary.confirmed}</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase"><Clock className="w-4 h-4 text-amber-500" /> Pendentes</div>
          <div className="text-2xl font-black mt-2 text-slate-900 dark:text-white">{coverageSummary.pending}</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase"><AlertTriangle className="w-4 h-4 text-red-600" /> Vagas</div>
          <div className="text-2xl font-black mt-2 text-slate-900 dark:text-white">{coverageSummary.open}</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase"><Building2 className="w-4 h-4 text-slate-500" /> Setores</div>
          <div className="text-2xl font-black mt-2 text-slate-900 dark:text-white">{coverageMap.length}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="font-black text-sm text-emerald-800 dark:text-emerald-300">{coverageSummary.adequate}</span>
            <span className="text-xs text-emerald-700 dark:text-emerald-400">setores adequados (≥ 90%)</span>
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <span className="font-black text-sm text-amber-800 dark:text-amber-300">{coverageSummary.attention}</span>
            <span className="text-xs text-amber-700 dark:text-amber-400">setores em atenção (70–89%)</span>
          </div>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="font-black text-sm text-red-800 dark:text-red-300">{coverageSummary.critical}</span>
            <span className="text-xs text-red-700 dark:text-red-400">setores críticos (&lt; 70%)</span>
          </div>
        </div>
      </div>

      <Card className="p-6 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <Map className="w-5 h-5 text-sky-600" />
              <h3 className="font-black text-base text-slate-900 dark:text-white">Mapa de Cobertura por Setor</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">Clique em qualquer setor para inspecionar os plantões detalhadamente.</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-bold">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> ≥ 90%</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 70–89%</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> &lt; 70%</span>
          </div>
        </div>

        <div className="space-y-3">
          {coverageMap.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">Nenhum setor encontrado para os filtros selecionados.</div>
          ) : (
            coverageMap.map((sector) => {
              const level = sector.level.key;
              const containerClass = level === 'critical' ? 'border-red-200 bg-red-50/50 dark:bg-red-950/20' : level === 'attention' ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20' : 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20';
              const barClass = level === 'critical' ? 'bg-red-500' : level === 'attention' ? 'bg-amber-500' : 'bg-emerald-500';

              return (
                <button
                  key={sector.sectorName}
                  type="button"
                  onClick={() => onSelectSector(sector.sectorName)}
                  className={`w-full text-left rounded-2xl border p-4 transition hover:shadow-md ${containerClass}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900 dark:text-white truncate">{sector.sectorName}</span>
                        <span className="text-[9px] font-black text-slate-400">({sector.total} turnos)</span>
                      </div>
                      <div className="mt-3 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barClass}`} style={{ width: `${Math.min(sector.coverage, 100)}%` }} />
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                        <span><strong>{sector.confirmed}</strong> confirmados</span>
                        <span><strong>{sector.pending}</strong> pendentes</span>
                        <span><strong>{sector.open}</strong> vagos</span>
                        <span><strong>{sector.canceled}</strong> cancelados</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-xl font-black text-slate-900 dark:text-white">{sector.coverage}%</div>
                        <div className="text-[9px] font-black uppercase text-slate-500">{sector.level.label}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   COMPONENTE PRINCIPAL (Central de Inteligência Hospitalar)
============================================================ */
export default function Relatorios() {
  const { user, company, loading } = useAppData();

  const [shifts, setShifts] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [sectors, setSectors] = useState([]);

  const [loadingData, setLoadingData] = useState(true);
  const [errorData, setErrorData] = useState('');

  const [activeTab, setActiveTab] = useState('executiva');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSector, setSelectedSector] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedProfessional, setSelectedProfessional] = useState('all');

  const [previewOpen, setPreviewOpen] = useState(false);
  const [sectorDetail, setSectorDetail] = useState(null);

  const companyId = user?.data?.company_id || company?.id || null;
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id || null;

  async function loadData() {
    if (!companyId) {
      setLoadingData(false);
      setErrorData('Não foi possível identificar a instituição.');
      return;
    }

    setLoadingData(true);
    setErrorData('');

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
      console.error('Erro geral ao carregar relatórios:', error);
      setShifts([]); setProfessionals([]); setSectors([]);
      setErrorData('Não foi possível carregar os dados dos relatórios.');
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (!loading) loadData();
  }, [loading, companyId, unitId]);

  const dateRangeError = useMemo(() => {
    if (!startDate || !endDate) return '';
    if (startDate > endDate) return 'A data inicial não pode ser maior que a data final.';
    return '';
  }, [startDate, endDate]);

  const filteredShifts = useMemo(() => {
    if (dateRangeError) return [];
    return (shifts || []).filter((shift) => {
      if (!shift) return false;
      const shiftDate = normalizeDate(shift.date);
      if (!shiftDate) return false;

      const matchesStart = !startDate || shiftDate >= startDate;
      const matchesEnd = !endDate || shiftDate <= endDate;
      if (!matchesStart || !matchesEnd) return false;

      const shiftSectorId = getSectorId(shift);
      const shiftSectorName = getSectorName(shift);
      const matchesSector =
        selectedSector === 'all' ||
        String(shiftSectorId) === String(selectedSector) ||
        String(shiftSectorName) === String(selectedSector);
      if (!matchesSector) return false;

      const status = getShiftStatus(shift);
      const matchesStatus = selectedStatus === 'all' || status === selectedStatus;
      if (!matchesStatus) return false;

      const professionalId = getProfessionalId(shift);
      const matchesProfessional =
        selectedProfessional === 'all' || String(professionalId) === String(selectedProfessional);
      if (!matchesProfessional) return false;

      return true;
    });
  }, [shifts, startDate, endDate, selectedSector, selectedStatus, selectedProfessional, dateRangeError]);

  const byProfessional = useMemo(() => {
    const map = {};
    (professionals || []).forEach((professional) => {
      if (!professional?.id) return;
      const remunerationType = getRemunerationType(professional);
      let rate = null;
      if (remunerationType === REMUNERATION_TYPE.HOUR) rate = professional?.hourly_rate ?? professional?.hourlyRate ?? null;
      if (remunerationType === REMUNERATION_TYPE.DAILY) rate = professional?.daily_rate ?? professional?.dailyRate ?? null;
      if (remunerationType === REMUNERATION_TYPE.MONTHLY) rate = professional?.monthly_salary ?? professional?.monthlySalary ?? null;

      const numericRate = rate === null || rate === undefined || rate === '' ? null : safeNumber(rate, null);

      map[professional.id] = {
        id: professional.id,
        name: getProfessionalName(professional),
        category: professional?.specialty || professional?.category || 'Geral',
        confirmed: 0,
        pending: 0,
        canceled: 0,
        hours: 0,
        estimatedPay: 0,
        remunerationType,
        hourlyRate: numericRate,
        financialDataAvailable: numericRate !== null,
      };
    });

    filteredShifts.forEach((shift) => {
      const professionalId = getProfessionalId(shift);
      if (!professionalId) return;

      if (!map[professionalId]) {
        map[professionalId] = {
          id: professionalId,
          name: shift?.professional_name || shift?.professionalName || 'Profissional',
          category: getSectorName(shift),
          confirmed: 0,
          pending: 0,
          canceled: 0,
          hours: 0,
          estimatedPay: 0,
          remunerationType: REMUNERATION_TYPE.HOUR,
          hourlyRate: null,
          financialDataAvailable: false,
        };
      }

      const professional = map[professionalId];
      const status = getShiftStatus(shift);
      const duration = getShiftDuration(shift);

      if (status === SHIFT_STATUS.CONFIRMED) {
        professional.confirmed += 1;
        professional.hours += duration;

        if (professional.financialDataAvailable) {
          if (professional.remunerationType === REMUNERATION_TYPE.HOUR) {
            professional.estimatedPay += duration * professional.hourlyRate;
          }
          if (professional.remunerationType === REMUNERATION_TYPE.DAILY) {
            professional.estimatedPay += professional.hourlyRate;
          }
          if (professional.remunerationType === REMUNERATION_TYPE.MONTHLY) {
            professional.estimatedPay = professional.hourlyRate;
          }
        }
      }
      if (status === SHIFT_STATUS.PENDING) professional.pending += 1;
      if (status === SHIFT_STATUS.CANCELLED) professional.canceled += 1;
    });

    return Object.values(map)
      .filter((p) => p.confirmed > 0 || p.pending > 0 || p.canceled > 0)
      .sort((a, b) => safeNumber(b.hours) - safeNumber(a.hours));
  }, [filteredShifts, professionals]);

  const bySector = useMemo(() => {
    const map = {};
    filteredShifts.forEach((shift) => {
      if (!shift) return;
      const sectorName = getSectorName(shift);
      if (!map[sectorName]) {
        map[sectorName] = { total: 0, filled: 0, confirmed: 0, pending: 0, open: 0, canceled: 0 };
      }
      const sector = map[sectorName];
      sector.total += 1;
      const status = getShiftStatus(shift);

      if (status === SHIFT_STATUS.CONFIRMED) {
        sector.confirmed += 1;
        sector.filled += 1;
      }
      if (status === SHIFT_STATUS.PENDING) sector.pending += 1;
      if (status === SHIFT_STATUS.OPEN) sector.open += 1;
      if (status === SHIFT_STATUS.CANCELLED) sector.canceled += 1;
    });

    return Object.entries(map).sort((a, b) => safeNumber(b[1]?.total) - safeNumber(a[1]?.total));
  }, [filteredShifts]);

  const coverageMap = useMemo(() => {
    return bySector.map(([sectorName, data]) => {
      const total = safeNumber(data?.total);
      const confirmed = safeNumber(data?.confirmed);
      const pending = safeNumber(data?.pending);
      const open = safeNumber(data?.open);
      const canceled = safeNumber(data?.canceled);
      const coverage = calculatePercentage(confirmed, total);
      const level = getCoverageLevel(coverage);

      return { sectorName, total, confirmed, pending, open, canceled, coverage, level };
    });
  }, [bySector]);

  const coverageSummary = useMemo(() => {
    const total = filteredShifts.length;
    const confirmed = filteredShifts.filter((s) => getShiftStatus(s) === SHIFT_STATUS.CONFIRMED).length;
    const pending = filteredShifts.filter((s) => getShiftStatus(s) === SHIFT_STATUS.PENDING).length;
    const open = filteredShifts.filter((s) => getShiftStatus(s) === SHIFT_STATUS.OPEN).length;
    const canceled = filteredShifts.filter((s) => getShiftStatus(s) === SHIFT_STATUS.CANCELLED).length;
    const coverage = calculatePercentage(confirmed, total);

    const critical = coverageMap.filter((s) => s.level.key === 'critical').length;
    const attention = coverageMap.filter((s) => s.level.key === 'attention').length;
    const adequate = coverageMap.filter((s) => s.level.key === 'adequate').length;

    return { total, confirmed, pending, open, canceled, coverage, critical, attention, adequate };
  }, [filteredShifts, coverageMap]);

  const auditLogs = useMemo(() => {
    return (filteredShifts || []).filter((shift) => shift && (getShiftStatus(shift) === SHIFT_STATUS.CANCELLED || Boolean(shift.notes)));
  }, [filteredShifts]);

  const overview = useMemo(() => ({
    total: filteredShifts.length,
    confirmed: filteredShifts.filter((s) => getShiftStatus(s) === SHIFT_STATUS.CONFIRMED).length,
    pending: filteredShifts.filter((s) => getShiftStatus(s) === SHIFT_STATUS.PENDING).length,
    open: filteredShifts.filter((s) => getShiftStatus(s) === SHIFT_STATUS.OPEN).length,
    canceled: filteredShifts.filter((s) => getShiftStatus(s) === SHIFT_STATUS.CANCELLED).length,
  }), [filteredShifts]);

  const totalFinancialEstimate = useMemo(() => {
    return (byProfessional || []).reduce((total, p) => total + safeNumber(p?.estimatedPay), 0);
  }, [byProfessional]);

  const criticalAlerts = useMemo(() => {
    const alerts = [];
    if (overview.open > 0) alerts.push(`Existem ${overview.open} vaga(s) aberta(s) no período analisado.`);
    if (overview.canceled > 0) alerts.push(`Foram identificados ${overview.canceled} turno(s) cancelado(s).`);
    coverageMap.forEach((sector) => {
      if (sector.level.key === 'critical') {
        alerts.push(`O setor ${sector.sectorName} apresenta cobertura operacional crítica de ${sector.coverage}%.`);
      }
    });
    if (alerts.length === 0) alerts.push('Nenhum alerta crítico identificado nos filtros selecionados.');
    return alerts.slice(0, 10);
  }, [overview, coverageMap]);

  const filtersLabel = useMemo(() => {
    const parts = [];
    parts.push(startDate ? `De ${formatDateBR(startDate)}` : 'Sem data inicial');
    parts.push(endDate ? `Até ${formatDateBR(endDate)}` : 'Sem data final');
    parts.push(selectedSector === 'all' ? 'Todos os setores' : `Setor: ${selectedSector}`);
    parts.push(selectedStatus === 'all' ? 'Todos os status' : `Status: ${selectedStatus}`);
    parts.push(selectedProfessional === 'all' ? 'Todos os profissionais' : 'Profissional filtrado');
    return parts.join(' · ');
  }, [startDate, endDate, selectedSector, selectedStatus, selectedProfessional]);

  const reportPayload = useMemo(() => {
    const payload = buildReportPayload({
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
    payload.documentId = `RPT-${activeTab.toUpperCase()}-${Date.now()}`;
    return payload;
  }, [activeTab, company, user, filtersLabel, overview, byProfessional, bySector, auditLogs, totalFinancialEstimate, criticalAlerts]);

  function handleDownloadCSV() {
    try {
      if (!reportPayload) return;
      const lines = [];
      lines.push(['Relatório', reportPayload.title].map(escapeCSV).join(';'));
      lines.push(['Instituição', reportPayload.companyName].map(escapeCSV).join(';'));
      lines.push(['Filtros', reportPayload.subtitle].map(escapeCSV).join(';'));
      lines.push(['Gerado por', reportPayload.generatedBy].map(escapeCSV).join(';'));
      lines.push(['Identificação', reportPayload.documentId].map(escapeCSV).join(';'));
      lines.push('');
      reportPayload.kpis?.forEach((k) => lines.push([k.label, k.value].map(escapeCSV).join(';')));
      lines.push('');
      lines.push(reportPayload.columns.map(escapeCSV).join(';'));
      (reportPayload.rows || []).forEach((r) => lines.push(r.map(escapeCSV).join(';')));
      if (reportPayload.totalsRow) lines.push(reportPayload.totalsRow.map(escapeCSV).join(';'));

      const csv = '\uFEFF' + lines.join('\n');
      downloadFile(csv, `Relatorio_${reportPayload.key}_${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (error) {
      console.error('Erro ao gerar CSV:', error);
    }
  }

  function clearFilters() {
    setStartDate('');
    setEndDate('');
    setSelectedSector('all');
    setSelectedStatus('all');
    setSelectedProfessional('all');
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sky-400">
            <BarChart3 className="w-4 h-4" /> Inteligência Hospitalar
          </div>
          <h1 className="text-3xl font-black tracking-tight">Relatórios</h1>
          <p className="text-xs text-slate-300 max-w-2xl">
            Central corporativa de relatórios, indicadores operacionais, mapa de calor e governança hospitalar.
          </p>
        </div>

        <Button
          onClick={() => setPreviewOpen(true)}
          disabled={loadingData || Boolean(dateRangeError)}
          className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs h-11 px-5 gap-2 shadow-lg shrink-0"
        >
          <Eye className="w-4 h-4" /> Visualizar Relatório Oficial
        </Button>
      </header>

      {dateRangeError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {dateRangeError}
        </div>
      )}

      {errorData && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorData}
          <Button variant="outline" size="sm" onClick={loadData} className="ml-3">Tentar novamente</Button>
        </div>
      )}

      {/* Abas */}
      <div className="flex items-center bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto gap-1">
        {Object.entries(TABS_CONFIG).map(([key, meta]) => {
          const Icon = meta.icon;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex-1 min-w-[180px] px-4 py-3 text-xs font-bold rounded-xl transition-all whitespace-nowrap text-center flex items-center justify-center gap-2 ${
                activeTab === key ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Filtros Avançados */}
      <section className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
            <Filter className="w-4 h-4 text-sky-600" /> Filtros
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 w-full">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Data inicial</label>
              <Input type="date" value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-xs bg-slate-50 dark:bg-slate-800" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Data final</label>
              <Input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className="h-9 text-xs bg-slate-50 dark:bg-slate-800" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Setor</label>
              <Select value={String(selectedSector)} onValueChange={setSelectedSector}>
                <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800"><SelectValue placeholder="Todos os setores" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {(sectors || []).filter(s => s?.id && s?.name).map((s) => (
                    <SelectItem key={s.id} value={String(s.name)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value={SHIFT_STATUS.CONFIRMED}>Confirmados</SelectItem>
                  <SelectItem value={SHIFT_STATUS.PENDING}>Pendentes</SelectItem>
                  <SelectItem value={SHIFT_STATUS.OPEN}>Vagos</SelectItem>
                  <SelectItem value={SHIFT_STATUS.CANCELLED}>Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Profissional</label>
              <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os profissionais</SelectItem>
                  {(professionals || []).filter(p => p?.id).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{getProfessionalName(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(startDate || endDate || selectedSector !== 'all' || selectedStatus !== 'all' || selectedProfessional !== 'all') && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-red-500 shrink-0">
              Limpar filtros
            </Button>
          )}
        </div>

        <div className="mt-3 text-[10px] text-slate-400">
          <strong>Filtros aplicados:</strong> {filtersLabel}
        </div>
      </section>

      {loadingData ? (
        <div className="flex flex-col items-center justify-center p-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
          <span className="text-xs font-semibold text-slate-400">Carregando dados dos relatórios...</span>
        </div>
      ) : (
        <>
          {activeTab === 'cobertura' ? (
            <CoverageDashboard
              coverageSummary={coverageSummary}
              coverageMap={coverageMap}
              onSelectSector={setSectorDetail}
            />
          ) : (
            <Card className="p-6 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
                <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-sky-600" /> {reportPayload.title}
                </h3>
                <span className="text-xs font-semibold text-slate-400">{reportPayload.rows?.length || 0} registros listados</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                {reportPayload.rows?.length === 0 ? (
                  <div className="text-sm text-slate-400 text-center py-12">{reportPayload.emptyMessage}</div>
                ) : (
                  <table className="w-full text-xs text-left whitespace-nowrap border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800 uppercase text-[10px]">
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
        </>
      )}

      {sectorDetail && (
        <SectorDetailModal
          sectorName={sectorDetail}
          shifts={filteredShifts}
          onClose={() => setSectorDetail(null)}
        />
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