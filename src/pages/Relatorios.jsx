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
  FileText,
  FileSpreadsheet,
  ShieldCheck,
  Building2,
  Filter,
  Loader2,
  DollarSign,
  BarChart3,
  Eye,
  X,
  Printer,
  Download,
  Users,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  ClipboardList,
  PieChart,
} from 'lucide-react';

/* ============================================================
 * FORMATAÇÃO
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
  const [year, month, day] = value.split('-');

  if (!year || !month || !day) return dateStr;

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
 * ABAS
 * ============================================================ */

const TAB_META = {
  consolidado: {
    label: '📊 Conselho Consolidado',
    icon: BarChart3,
  },
  produtividade: {
    label: '⏱️ Produtividade',
    icon: Clock,
  },
  cobertura: {
    label: '🏥 Cobertura',
    icon: TrendingUp,
  },
  financeiro: {
    label: '💰 Financeiro',
    icon: DollarSign,
  },
  auditoria: {
    label: '🛡️ Auditoria',
    icon: ShieldCheck,
  },
};

/* ============================================================
 * PAYLOADS DOS RELATÓRIOS
 * ============================================================ */

function buildReportPayload({
  tab,
  company,
  user,
  filtersLabel,
  overview,
  byProfessional,
  bySector,
  auditLogs,
  totalFinancialEstimate,
  criticalAlerts,
}) {
  const companyName = company?.name || 'Instituição Hospitalar';
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

  if (tab === 'produtividade') {
    const totalHours = byProfessional.reduce(
      (total, professional) => total + Number(professional.hours || 0),
      0
    );

    return {
      ...base,
      key: tab,
      title: 'Produtividade do Corpo Clínico',
      kpis: [
        {
          label: 'Profissionais ativos',
          value: byProfessional.length,
        },
        {
          label: 'Horas totais',
          value: `${totalHours}h`,
        },
        {
          label: 'Confirmados',
          value: overview.confirmed,
        },
        {
          label: 'Pendentes',
          value: overview.pending,
        },
      ],
      columns: [
        'Profissional',
        'Especialidade',
        'Confirmados',
        'Pendentes',
        'Cancelados',
        'Horas Totais',
      ],
      rows: byProfessional.map((professional) => [
        professional.name,
        professional.category,
        professional.confirmed,
        professional.pending,
        professional.canceled,
        `${professional.hours}h`,
      ]),
      totalsRow: [
        'TOTAL',
        '',
        overview.confirmed,
        overview.pending,
        overview.canceled,
        `${totalHours}h`,
      ],
      emptyMessage:
        'Nenhum profissional com plantões no período selecionado.',
    };
  }

  if (tab === 'cobertura') {
    const rows = bySector.map(([name, data]) => {
      const percentage = data.total
        ? Math.round((data.filled / data.total) * 100)
        : 0;

      return [
        name,
        data.total,
        data.filled,
        data.open,
        data.canceled,
        `${percentage}%`,
      ];
    });

    const averageCoverage = bySector.length
      ? Math.round(
          bySector.reduce((total, [, data]) => {
            return (
              total +
              (data.total ? (data.filled / data.total) * 100 : 0)
            );
          }, 0) / bySector.length
        )
      : 0;

    const worstSector = bySector.length
      ? bySector.reduce(
          (worst, [name, data]) => {
            const percentage = data.total
              ? (data.filled / data.total) * 100
              : 100;

            return percentage < worst.percentage
              ? { name, percentage }
              : worst;
          },
          {
            name: bySector[0][0],
            percentage: Infinity,
          }
        )
      : null;

    return {
      ...base,
      key: tab,
      title: 'Cobertura Operacional por Setor',
      kpis: [
        {
          label: 'Setores mapeados',
          value: bySector.length,
        },
        {
          label: 'Cobertura média',
          value: `${averageCoverage}%`,
        },
        {
          label: 'Setor mais crítico',
          value: worstSector?.name || '—',
        },
        {
          label: 'Vagas abertas',
          value: overview.open,
        },
      ],
      columns: [
        'Setor',
        'Turnos Totais',
        'Preenchidos',
        'Vagas Abertas',
        'Cancelados',
        '% Cobertura',
      ],
      rows,
      emptyMessage:
        'Sem dados de setores para os filtros selecionados.',
    };
  }

  if (tab === 'financeiro') {
    const totalHours = byProfessional.reduce(
      (total, professional) => total + Number(professional.hours || 0),
      0
    );

    const highestPayment = byProfessional.reduce(
      (highest, professional) => {
        return professional.estimatedPay >
          Number(highest?.estimatedPay || 0)
          ? professional
          : highest;
      },
      null
    );

    return {
      ...base,
      key: tab,
      title: 'Projeção de Repasse Financeiro',
      kpis: [
        {
          label: 'Total estimado',
          value: formatCurrency(totalFinancialEstimate),
        },
        {
          label: 'Profissionais faturados',
          value: byProfessional.length,
        },
        {
          label: 'Maior repasse',
          value: highestPayment
            ? `${highestPayment.name} (${formatCurrency(
                highestPayment.estimatedPay
              )})`
            : '—',
        },
        {
          label: 'Horas faturáveis',
          value: `${totalHours}h`,
        },
      ],
      columns: [
        'Profissional',
        'Modelo',
        'Quantidade / Horas',
        'Total a Liquidar',
      ],
      rows: byProfessional.map((professional) => [
        professional.name,
        professional.remunerationType === 'diaria'
          ? 'Por Plantão / Diária'
          : professional.remunerationType === 'mensal'
          ? 'Fixo Mensal'
          : 'Horista',
        professional.remunerationType === 'hora'
          ? `${professional.hours}h`
          : `${professional.confirmed} plantão(ões)`,
        formatCurrency(professional.estimatedPay),
      ]),
      totalsRow: [
        'TOTAL',
        '',
        `${totalHours}h`,
        formatCurrency(totalFinancialEstimate),
      ],
      emptyMessage:
        'Nenhum valor a liquidar para os filtros selecionados.',
    };
  }

  if (tab === 'auditoria') {
    const canceledCount = auditLogs.filter(
      (log) => log.status === 'cancelado'
    ).length;

    const withNotes = auditLogs.filter((log) => log.notes).length;

    const sectorCounts = auditLogs.reduce((accumulator, log) => {
      const sector = log.sector_name || 'Geral';
      accumulator[sector] = (accumulator[sector] || 0) + 1;
      return accumulator;
    }, {});

    const topSector = Object.entries(sectorCounts).sort(
      (a, b) => b[1] - a[1]
    )[0];

    return {
      ...base,
      key: tab,
      title: 'Log de Auditoria e Plantões Cancelados',
      kpis: [
        {
          label: 'Eventos totais',
          value: auditLogs.length,
        },
        {
          label: 'Cancelamentos',
          value: canceledCount,
        },
        {
          label: 'Com observação',
          value: withNotes,
        },
        {
          label: 'Setor mais afetado',
          value: topSector ? `${topSector[0]} (${topSector[1]})` : '—',
        },
      ],
      columns: [
        'Data',
        'Horário',
        'Profissional',
        'Setor',
        'Status',
        'Observação',
        'ID',
      ],
      rows: auditLogs.map((log) => [
        formatDateBR(log.date),
        `${log.start_time || '--'} - ${log.end_time || '--'}`,
        log.professional_name || 'Vago',
        log.sector_name || 'Geral',
        log.status || '—',
        log.notes || '—',
        log.id || '—',
      ]),
      emptyMessage:
        'Nenhum evento de cancelamento ou alteração registrado no período.',
    };
  }

  return {
    ...base,
    key: 'consolidado',
    title: 'Relatório Consolidado do Conselho',
    kpis: [
      {
        label: 'Turnos analisados',
        value: overview.total,
      },
      {
        label: 'Turnos confirmados',
        value: overview.confirmed,
      },
      {
        label: 'Cobertura geral',
        value: overview.total
          ? `${Math.round(
              (overview.confirmed / overview.total) * 100
            )}%`
          : '0%',
      },
      {
        label: 'Custo estimado',
        value: formatCurrency(totalFinancialEstimate),
      },
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
        columns: [
          'Profissional',
          'Especialidade',
          'Confirmados',
          'Pendentes',
          'Horas',
        ],
        rows: byProfessional.map((professional) => [
          professional.name,
          professional.category,
          professional.confirmed,
          professional.pending,
          `${professional.hours}h`,
        ]),
      },
      {
        title: 'Cobertura por Setor',
        columns: [
          'Setor',
          'Total',
          'Preenchidos',
          'Abertos',
          'Cancelados',
          'Cobertura',
        ],
        rows: bySector.map(([name, data]) => {
          const percentage = data.total
            ? Math.round((data.filled / data.total) * 100)
            : 0;

          return [
            name,
            data.total,
            data.filled,
            data.open,
            data.canceled,
            `${percentage}%`,
          ];
        }),
      },
      {
        title: 'Resumo Financeiro',
        columns: [
          'Profissional',
          'Modelo',
          'Quantidade / Horas',
          'Valor Estimado',
        ],
        rows: byProfessional.map((professional) => [
          professional.name,
          professional.remunerationType === 'diaria'
            ? 'Diária'
            : professional.remunerationType === 'mensal'
            ? 'Mensal'
            : 'Horista',
          professional.remunerationType === 'hora'
            ? `${professional.hours}h`
            : `${professional.confirmed} plantão(ões)`,
          formatCurrency(professional.estimatedPay),
        ]),
      },
      {
        title: 'Auditoria e Riscos',
        columns: [
          'Data',
          'Profissional',
          'Setor',
          'Status',
          'Observação',
        ],
        rows: auditLogs.map((log) => [
          formatDateBR(log.date),
          log.professional_name || 'Vago',
          log.sector_name || 'Geral',
          log.status || '—',
          log.notes || '—',
        ]),
      },
    ],
    columns: ['Indicador', 'Resultado'],
    rows: [
      ['Total de turnos', overview.total],
      ['Turnos confirmados', overview.confirmed],
      ['Turnos pendentes', overview.pending],
      ['Vagas abertas', overview.open],
      ['Turnos cancelados', overview.canceled],
      ['Total estimado', formatCurrency(totalFinancialEstimate)],
    ],
    emptyMessage: 'Nenhum dado encontrado para o período selecionado.',
  };
}

/* ============================================================
 * MODAL DE PRÉ-VISUALIZAÇÃO
 * ============================================================ */

function ReportPreviewModal({
  payload,
  onClose,
  onDownloadPDF,
  onDownloadCSV,
}) {
  if (!payload) return null;

  const isConsolidated = payload.key === 'consolidado';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-6xl max-h-[94vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="sticky top-0 z-20 flex items-start justify-between gap-4 p-5 md:p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 text-white rounded-t-3xl">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">
              <ShieldCheck className="w-4 h-4" />
              Documento Oficial
            </div>

            <h2 className="text-xl md:text-2xl font-black mt-1">
              {payload.title}
            </h2>

            <p className="text-xs text-slate-300 mt-1">
              {payload.subtitle}
            </p>

            <p className="text-[10px] text-slate-400 mt-1">
              Instituição: {payload.companyName}
              {payload.generatedBy
                ? ` · Emitido por ${payload.generatedBy}`
                : ''}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 md:p-6 space-y-6">
          {isConsolidated && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 dark:bg-sky-950/30 dark:border-sky-900 p-4">
              <div className="flex items-center gap-2 text-sky-800 dark:text-sky-300 font-black text-sm">
                <BarChart3 className="w-5 h-5" />
                Síntese Executiva para o Conselho
              </div>

              <p className="text-xs text-sky-700 dark:text-sky-400 mt-1">
                Documento consolidado com visão operacional, produtividade,
                cobertura, projeção financeira e pontos de atenção.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {payload.kpis?.map((kpi, index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4"
              >
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  {kpi.label}
                </div>

                <div className="text-lg md:text-xl font-black text-sky-700 dark:text-sky-400 mt-1 break-words">
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>

          {payload.criticalAlerts?.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4">
              <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-black text-sm mb-3">
                <AlertTriangle className="w-5 h-5" />
                Pontos de Atenção
              </div>

              <div className="space-y-2">
                {payload.criticalAlerts.map((alert, index) => (
                  <div
                    key={index}
                    className="text-xs text-red-700 dark:text-red-300 flex items-start gap-2"
                  >
                    <span className="font-black">•</span>
                    <span>{alert}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isConsolidated ? (
            <div className="space-y-7">
              {payload.sections?.map((section, sectionIndex) => (
                <section key={sectionIndex} className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <ClipboardList className="w-4 h-4 text-sky-600" />
                    <h3 className="font-black text-base text-slate-900 dark:text-white">
                      {section.title}
                    </h3>
                  </div>

                  {section.rows?.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4">
                      Nenhum registro encontrado.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-xs text-left whitespace-nowrap">
                        <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 uppercase">
                          <tr>
                            {section.columns.map((column) => (
                              <th key={column} className="p-3 font-black">
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {section.rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={cellIndex}
                                  className="p-3 text-slate-700 dark:text-slate-200"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              {payload.rows?.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-16">
                  {payload.emptyMessage}
                </p>
              ) : (
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 uppercase">
                    <tr>
                      {payload.columns.map((column) => (
                        <th key={column} className="p-3 font-black">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {payload.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="p-3 text-slate-700 dark:text-slate-200"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>

                  {payload.totalsRow && (
                    <tfoot className="bg-slate-100 dark:bg-slate-900 font-black">
                      <tr>
                        {payload.totalsRow.map((cell, cellIndex) => (
                          <td key={cellIndex} className="p-3">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-col md:flex-row items-center justify-between gap-3 p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-b-3xl">
          <div className="text-[10px] text-slate-400">
            Conferência visual antes da emissão do documento.
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-xs font-bold"
            >
              Fechar
            </Button>

            <Button
              variant="outline"
              onClick={onDownloadCSV}
              className="text-xs font-bold gap-2"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Exportar CSV
            </Button>

            <Button
              onClick={onDownloadPDF}
              className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold gap-2"
            >
              <Printer className="w-4 h-4" />
              Imprimir / Salvar PDF
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

  const companyId =
    user?.data?.company_id ||
    company?.id ||
    'cmp_principal';

  const unitId =
    user?.data?.selected_unit_id ||
    company?.selected_unit_id ||
    company?.units?.[0]?.id ||
    null;

  async function loadData() {
    if (!companyId) return;

    setLoadingData(true);

    try {
      const filters = {
        company_id: companyId,
        ...(unitId ? { unit_id: unitId } : {}),
      };

      const [shiftData, professionalData, sectorData] =
        await Promise.all([
          base44.entities.Shift.filter(filters, '-date', 2000).catch(
            () => []
          ),
          base44.entities.Professional.filter(
            filters,
            '-created_date',
            1000
          ).catch(() => []),
          base44.entities.Sector.filter(
            filters,
            '-created_date',
            200
          ).catch(() => []),
        ]);

      setShifts(Array.isArray(shiftData) ? shiftData : []);
      setProfessionals(
        Array.isArray(professionalData) ? professionalData : []
      );
      setSectors(Array.isArray(sectorData) ? sectorData : []);
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
      setShifts([]);
      setProfessionals([]);
      setSectors([]);
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (!loading) {
      loadData();
    }
  }, [loading, companyId, unitId]);

  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      if (!shift) return false;

      const shiftDate = String(shift.date || '').split('T')[0];

      const matchesStart =
        !startDate || shiftDate >= startDate;

      const matchesEnd =
        !endDate || shiftDate <= endDate;

      const matchesSector =
        selectedSector === 'all' ||
        String(shift.sector_id) === String(selectedSector) ||
        shift.sector_name === selectedSector;

      return matchesStart && matchesEnd && matchesSector;
    });
  }, [shifts, startDate, endDate, selectedSector]);

  const byProfessional = useMemo(() => {
    const map = {};

    professionals.forEach((professional) => {
      if (!professional?.id) return;

      const remunerationType =
        professional.remuneration_type || 'hora';

      let baseRate = 120;

      if (remunerationType === 'hora') {
        baseRate = Number(professional.hourly_rate) || 120;
      }

      if (remunerationType === 'diaria') {
        baseRate = Number(professional.daily_rate) || 1500;
      }

      if (remunerationType === 'mensal') {
        baseRate =
          Number(professional.monthly_salary) || 18000;
      }

      map[professional.id] = {
        id: professional.id,
        name: professional.name || 'Sem nome',
        category:
          professional.specialty ||
          professional.category ||
          'Geral',
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
        } else if (
          professional.remunerationType === 'mensal'
        ) {
          professional.estimatedPay = professional.hourlyRate;
        } else {
          professional.estimatedPay +=
            duration * professional.hourlyRate;
        }
      }

      if (shift.status === 'pendente') {
        professional.pending += 1;
      }

      if (shift.status === 'cancelado') {
        professional.canceled += 1;
      }
    });

    return Object.values(map)
      .filter(
        (professional) =>
          professional.confirmed > 0 ||
          professional.pending > 0 ||
          professional.canceled > 0
      )
      .sort((a, b) => b.hours - a.hours);
  }, [filteredShifts, professionals]);

  const bySector = useMemo(() => {
    const map = {};

    filteredShifts.forEach((shift) => {
      if (!shift) return;

      const sectorName = shift.sector_name || 'Geral';

      if (!map[sectorName]) {
        map[sectorName] = {
          total: 0,
          filled: 0,
          open: 0,
          canceled: 0,
        };
      }

      map[sectorName].total += 1;

      if (
        shift.status === 'confirmado' ||
        shift.status === 'pendente'
      ) {
        map[sectorName].filled += 1;
      }

      if (shift.status === 'vago') {
        map[sectorName].open += 1;
      }

      if (shift.status === 'cancelado') {
        map[sectorName].canceled += 1;
      }
    });

    return Object.entries(map).sort(
      (a, b) => b[1].total - a[1].total
    );
  }, [filteredShifts]);

  const auditLogs = useMemo(() => {
    return filteredShifts.filter(
      (shift) =>
        shift &&
        (shift.status === 'cancelado' || shift.notes)
    );
  }, [filteredShifts]);

  const overview = useMemo(
    () => ({
      total: filteredShifts.length,
      confirmed: filteredShifts.filter(
        (shift) => shift?.status === 'confirmado'
      ).length,
      pending: filteredShifts.filter(
        (shift) => shift?.status === 'pendente'
      ).length,
      open: filteredShifts.filter(
        (shift) => shift?.status === 'vago'
      ).length,
      canceled: filteredShifts.filter(
        (shift) => shift?.status === 'cancelado'
      ).length,
    }),
    [filteredShifts]
  );

  const totalFinancialEstimate = useMemo(() => {
    return byProfessional.reduce(
      (total, professional) =>
        total + Number(professional.estimatedPay || 0),
      0
    );
  }, [byProfessional]);

  const criticalAlerts = useMemo(() => {
    const alerts = [];

    if (overview.open > 0) {
      alerts.push(
        `Existem ${overview.open} vaga(s) aberta(s) no período analisado.`
      );
    }

    if (overview.canceled > 0) {
      alerts.push(
        `Foram identificados ${overview.canceled} turno(s) cancelado(s).`
      );
    }

    if (overview.total > 0) {
      const coverage =
        (overview.confirmed / overview.total) * 100;

      if (coverage < 70) {
        alerts.push(
          `A cobertura geral está abaixo de 70% (${Math.round(
            coverage
          )}%).`
        );
      }
    }

    bySector.forEach(([sectorName, data]) => {
      const coverage = data.total
        ? (data.filled / data.total) * 100
        : 100;

      if (coverage < 70) {
        alerts.push(
          `O setor ${sectorName} apresenta cobertura crítica de ${Math.round(
            coverage
          )}%.`
        );
      }
    });

    if (alerts.length === 0) {
      alerts.push(
        'Nenhum alerta crítico identificado nos filtros selecionados.'
      );
    }

    return alerts;
  }, [overview, bySector]);

  const filtersLabel = useMemo(() => {
    const parts = [];

    parts.push(
      startDate
        ? `de ${formatDateBR(startDate)}`
        : 'sem data inicial'
    );

    parts.push(
      endDate
        ? `até ${formatDateBR(endDate)}`
        : 'até data final em aberto'
    );

    parts.push(
      selectedSector === 'all'
        ? 'todos os setores'
        : `setor "${selectedSector}"`
    );

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
  }, [
    activeTab,
    company,
    user,
    filtersLabel,
    overview,
    byProfessional,
    bySector,
    auditLogs,
    totalFinancialEstimate,
    criticalAlerts,
  ]);

  function handleDownloadCSV() {
    const lines = [];

    lines.push(
      [
        'Relatório',
        reportPayload.title,
      ]
        .map(escapeCSV)
        .join(';')
    );

    lines.push(
      [
        'Instituição',
        reportPayload.companyName,
      ]
        .map(escapeCSV)
        .join(';')
    );

    lines.push(
      [
        'Filtros',
        reportPayload.subtitle,
      ]
        .map(escapeCSV)
        .join(';')
    );

    lines.push('');

    reportPayload.kpis?.forEach((kpi) => {
      lines.push(
        [kpi.label, kpi.value].map(escapeCSV).join(';')
      );
    });

    lines.push('');

    if (reportPayload.key === 'consolidado') {
      reportPayload.sections?.forEach((section) => {
        lines.push(escapeCSV(section.title));
        lines.push(
          section.columns.map(escapeCSV).join(';')
        );

        section.rows.forEach((row) => {
          lines.push(row.map(escapeCSV).join(';'));
        });

        lines.push('');
      });
    } else {
      lines.push(
        reportPayload.columns.map(escapeCSV).join(';')
      );

      reportPayload.rows.forEach((row) => {
        lines.push(row.map(escapeCSV).join(';'));
      });

      if (reportPayload.totalsRow) {
        lines.push(
          reportPayload.totalsRow
            .map(escapeCSV)
            .join(';')
        );
      }
    }

    const csv = '\uFEFF' + lines.join('\n');

    downloadFile(
      csv,
      `Relatorio_${reportPayload.key}_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`
    );
  }

  function handlePrintPDF() {
    window.print();
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans print:p-0 print:max-w-none">
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .print-hidden {
            display: none !important;
          }

          .print-area {
            display: block !important;
          }

          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>

      <div className="print-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sky-400">
            <BarChart3 className="w-4 h-4" />
            Inteligência Executiva & Governança
          </div>

          <h1 className="text-3xl font-black tracking-tight">
            Relatórios
          </h1>

          <p className="text-xs text-slate-300 max-w-2xl">
            Relatório consolidado para análise do Conselho,
            acompanhamento operacional, produtividade, cobertura,
            auditoria e projeção financeira.
          </p>
        </div>

        <Button
          onClick={() => setPreviewOpen(true)}
          className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs h-11 px-5 gap-2"
        >
          <Eye className="w-4 h-4" />
          Visualizar Relatório Oficial
        </Button>
      </div>

      <div className="print-hidden flex items-center bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto gap-1">
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
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="print-hidden bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <Filter className="w-4 h-4 text-sky-600" />
          Filtros:
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">
              Data inicial
            </label>

            <Input
              type="date"
              value={startDate}
              onChange={(event) =>
                setStartDate(event.target.value)
              }
              className="h-9 text-xs bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">
              Data final
            </label>

            <Input
              type="date"
              value={endDate}
              onChange={(event) =>
                setEndDate(event.target.value)
              }
              className="h-9 text-xs bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">
              Setor
            </label>

            <Select
              value={String(selectedSector)}
              onValueChange={setSelectedSector}
            >
              <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800">
                <SelectValue placeholder="Todos os setores" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  Todos os setores
                </SelectItem>

                {sectors.map((sector) => (
                  <SelectItem
                    key={sector.id}
                    value={String(sector.name)}
                  >
                    {sector.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(startDate ||
          endDate ||
          selectedSector !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setSelectedSector('all');
            }}
            className="text-xs text-red-500 shrink-0"
          >
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider print-hidden">
        <BarChart3 className="w-4 h-4 text-sky-500" />
        {TAB_META[activeTab].label}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {reportPayload.kpis?.map((kpi, index) => (
          <Card
            key={index}
            className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
          >
            <div className="text-[10px] uppercase font-bold text-slate-400">
              {kpi.label}
            </div>

            <div className="text-xl font-black text-sky-700 dark:text-sky-400 mt-1 break-words">
              {kpi.value}
            </div>
          </Card>
        ))}
      </div>

      {loadingData ? (
        <div className="flex justify-center p-20">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === 'consolidado' && (
            <>
              <Card className="p-6 rounded-2xl border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-sky-600" />
                  <h2 className="font-black text-lg">
                    Visão Geral para o Conselho
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900">
                    <Users className="w-5 h-5 text-sky-600 mb-2" />
                    <div className="text-xs text-slate-500">
                      Profissionais envolvidos
                    </div>
                    <div className="text-2xl font-black">
                      {byProfessional.length}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mb-2" />
                    <div className="text-xs text-slate-500">
                      Turnos confirmados
                    </div>
                    <div className="text-2xl font-black">
                      {overview.confirmed}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mb-2" />
                    <div className="text-xs text-slate-500">
                      Pontos de atenção
                    </div>
                    <div className="text-2xl font-black">
                      {criticalAlerts.length}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6 rounded-2xl border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20">
                <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-black">
                  <AlertTriangle className="w-5 h-5" />
                  Pontos de Atenção
                </div>

                <div className="mt-4 space-y-2">
                  {criticalAlerts.map((alert, index) => (
                    <div
                      key={index}
                      className="text-sm text-red-700 dark:text-red-300"
                    >
                      • {alert}
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6 rounded-2xl border-slate-200 dark:border-slate-800">
                <h3 className="font-black text-lg flex items-center gap-2 mb-4">
                  <ClipboardList className="w-5 h-5 text-sky-600" />
                  Resumo Consolidado
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {reportPayload.rows.map((row, index) => (
                        <tr key={index}>
                          <td className="py-3 font-semibold">
                            {row[0]}
                          </td>
                          <td className="py-3 text-right font-black">
                            {row[1]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {activeTab === 'produtividade' && (
            <Card className="p-6 rounded-2xl border-slate-200 dark:border-slate-800">
              <h3 className="font-black text-lg flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-sky-600" />
                Produtividade e Carga Horária
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead className="bg-slate-100 dark:bg-slate-900">
                    <tr>
                      {reportPayload.columns.map((column) => (
                        <th key={column} className="p-3 text-left">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {reportPayload.rows.map((row, index) => (
                      <tr key={index}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="p-3">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'cobertura' && (
            <Card className="p-6 rounded-2xl border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="font-black text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-sky-600" />
                Cobertura Operacional por Setor
              </h3>

              {bySector.map(([name, data]) => {
                const percentage = data.total
                  ? Math.round(
                      (data.filled / data.total) * 100
                    )
                  : 0;

                return (
                  <div
                    key={name}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="font-bold flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-sky-600" />
                        {name}
                      </div>

                      <div className="text-xs font-bold">
                        {percentage}% preenchido ·{' '}
                        <span className="text-red-600">
                          {data.open} vagas abertas
                        </span>
                      </div>
                    </div>

                    <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          percentage < 70
                            ? 'bg-red-500'
                            : percentage < 90
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </Card>
          )}

          {activeTab === 'financeiro' && (
            <Card className="p-6 rounded-2xl border-slate-200 dark:border-slate-800">
              <h3 className="font-black text-lg flex items-center gap-2 mb-4">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Projeção Financeira
              </h3>

              <div className="mb-4 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                <div className="text-xs text-emerald-700">
                  Total Global Estimado
                </div>

                <div className="text-3xl font-black text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(totalFinancialEstimate)}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead className="bg-slate-100 dark:bg-slate-900">
                    <tr>
                      {reportPayload.columns.map((column) => (
                        <th key={column} className="p-3 text-left">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {reportPayload.rows.map((row, index) => (
                      <tr key={index}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="p-3">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'auditoria' && (
            <Card className="p-6 rounded-2xl border-slate-200 dark:border-slate-800">
              <h3 className="font-black text-lg flex items-center gap-2 mb-4">
                <ShieldCheck className="w-5 h-5 text-sky-600" />
                Log de Auditoria
              </h3>

              {auditLogs.length === 0 ? (
                <div className="text-sm text-slate-400 text-center py-12">
                  Nenhum evento registrado no período.
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-4 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20"
                    >
                      <div className="font-bold text-sm text-red-800 dark:text-red-300">
                        {formatDateBR(log.date)} ·{' '}
                        {log.start_time || '--'} -{' '}
                        {log.end_time || '--'}
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        Profissional:{' '}
                        <strong>
                          {log.professional_name || 'Vago'}
                        </strong>{' '}
                        · Setor:{' '}
                        <strong>
                          {log.sector_name || 'Geral'}
                        </strong>
                      </div>

                      <div className="text-xs text-red-700 dark:text-red-300 mt-1">
                        Status: {log.status || '—'}
                      </div>

                      {log.notes && (
                        <div className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                          Observação: {log.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {previewOpen && (
        <ReportPreviewModal
          payload={reportPayload}
          onClose={() => setPreviewOpen(false)}
          onDownloadPDF={handlePrintPDF}
          onDownloadCSV={handleDownloadCSV}
        />
      )}
    </div>
  );
}