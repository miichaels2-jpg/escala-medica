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
  Leaf,
  Sparkles,
  Users,
  ClipboardList,
} from 'lucide-react';

/* ============================================================
 * FORMATADORES
 * ============================================================ */

function formatCurrency(value = 0) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateBR(dateStr) {
  if (!dateStr) return '—';

  const date = String(dateStr).split('T')[0];
  const [year, month, day] = date.split('-');

  if (!year || !month || !day) return dateStr;

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
 * EXPORTAÇÃO CSV
 * ============================================================ */

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

      if (section.totalsRow) {
        rows.push(section.totalsRow);
      }

      rows.push([]);
    });
  } else {
    rows.push(payload.columns);
    rows.push(...payload.rows);

    if (payload.totalsRow) {
      rows.push(payload.totalsRow);
    }
  }

  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`)
        .join(';')
    )
    .join('\n');

  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `${payload.title
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gi, '-')
    .replaceAll(/^-|-$/g, '')}.csv`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/* ============================================================
 * EXPORTAÇÃO PARA PDF / IMPRESSÃO
 * ============================================================ */

function downloadPDF(payload) {
  const printWindow = window.open('', '_blank', 'width=1200,height=900');

  if (!printWindow) {
    alert('Permita pop-ups no navegador para gerar o relatório.');
    return;
  }

  const renderTable = (columns, rows, totalsRow) => {
    return `
      <table>
        <thead>
          <tr>
            ${columns
              .map((column) => `<th>${escapeHtml(column)}</th>`)
              .join('')}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  ${row
                    .map((cell) => `<td>${escapeHtml(cell)}</td>`)
                    .join('')}
                </tr>
              `
            )
            .join('')}
        </tbody>
        ${
          totalsRow
            ? `
              <tfoot>
                <tr>
                  ${totalsRow
                    .map((cell) => `<td>${escapeHtml(cell)}</td>`)
                    .join('')}
                </tr>
              </tfoot>
            `
            : ''
        }
      </table>
    `;
  };

  const sectionsHtml = payload.sections?.length
    ? payload.sections
        .map(
          (section) => `
            <section>
              <h2>${escapeHtml(section.title)}</h2>
              ${
                section.rows.length
                  ? renderTable(
                      section.columns,
                      section.rows,
                      section.totalsRow
                    )
                  : '<p>Nenhum dado encontrado para esta seção.</p>'
              }
            </section>
          `
        )
        .join('')
    : renderTable(payload.columns, payload.rows, payload.totalsRow);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(payload.title)}</title>

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #172033;
            margin: 32px;
            font-size: 11px;
          }

          header {
            border-bottom: 3px solid #0284c7;
            padding-bottom: 18px;
            margin-bottom: 20px;
          }

          h1 {
            font-size: 23px;
            margin: 0 0 8px;
            color: #0f172a;
          }

          h2 {
            font-size: 15px;
            margin: 26px 0 10px;
            color: #075985;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 6px;
          }

          p {
            margin: 4px 0;
            color: #475569;
          }

          .kpis {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin: 20px 0;
          }

          .kpi {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 10px;
          }

          .kpi-label {
            font-size: 9px;
            text-transform: uppercase;
            color: #64748b;
            font-weight: bold;
          }

          .kpi-value {
            margin-top: 5px;
            font-size: 15px;
            font-weight: bold;
            color: #0369a1;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }

          th {
            background: #e0f2fe;
            color: #075985;
            font-weight: bold;
            text-align: left;
            padding: 8px;
            border: 1px solid #bae6fd;
          }

          td {
            padding: 7px;
            border: 1px solid #e2e8f0;
            vertical-align: top;
          }

          tbody tr:nth-child(even) {
            background: #f8fafc;
          }

          tfoot td {
            background: #e2e8f0;
            font-weight: bold;
          }

          footer {
            margin-top: 35px;
            padding-top: 10px;
            border-top: 1px solid #cbd5e1;
            font-size: 9px;
            color: #64748b;
          }

          @media print {
            body {
              margin: 15mm;
            }

            button {
              display: none;
            }

            section {
              break-inside: avoid;
            }
          }
        </style>
      </head>

      <body>
        <header>
          <h1>${escapeHtml(payload.title)}</h1>
          <p><strong>Instituição:</strong> ${escapeHtml(
            payload.companyName
          )}</p>
          <p><strong>Filtros:</strong> ${escapeHtml(payload.subtitle)}</p>
          ${
            payload.generatedBy
              ? `<p><strong>Emitido por:</strong> ${escapeHtml(
                  payload.generatedBy
                )}</p>`
              : ''
          }
          <p><strong>Gerado em:</strong> ${new Date().toLocaleString(
            'pt-BR'
          )}</p>
        </header>

        <div class="kpis">
          ${payload.kpis
            .map(
              (kpi) => `
                <div class="kpi">
                  <div class="kpi-label">${escapeHtml(kpi.label)}</div>
                  <div class="kpi-value">${escapeHtml(kpi.value)}</div>
                </div>
              `
            )
            .join('')}
        </div>

        ${
          payload.sections?.length
            ? sectionsHtml
            : `<section>${sectionsHtml}</section>`
        }

        <footer>
          Relatório gerado pelo módulo de Inteligência Executiva e Governança.
        </footer>

        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}

/* ============================================================
 * PAYLOAD DOS RELATÓRIOS
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
}) {
  const companyName = company?.name || 'Hospital';
  const generatedBy =
    user?.data?.full_name || user?.data?.name || undefined;

  const base = {
    companyName,
    generatedBy,
    subtitle: filtersLabel,
  };

  if (tab === 'conselho') {
    const totalHours = byProfessional.reduce(
      (total, professional) => total + professional.hours,
      0
    );

    const averageCoverage = bySector.length
      ? Math.round(
          bySector.reduce((total, [, data]) => {
            return (
              total +
              (data.total
                ? (data.filled / data.total) * 100
                : 0)
            );
          }, 0) / bySector.length
        )
      : 0;

    return {
      ...base,
      key: tab,
      title: 'Relatório Consolidado do Conselho',
      kpis: [
        {
          label: 'Plantões totais',
          value: overview.total,
        },
        {
          label: 'Plantões confirmados',
          value: overview.confirmed,
        },
        {
          label: 'Cobertura média',
          value: `${averageCoverage}%`,
        },
        {
          label: 'Repasse estimado',
          value: formatCurrency(totalFinancialEstimate),
        },
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
          columns: [
            'Profissional',
            'Especialidade',
            'Confirmados',
            'Pendentes',
            'Cancelados',
            'Horas',
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
        },
        {
          title: 'Cobertura por Setor',
          columns: [
            'Setor',
            'Total',
            'Preenchidos',
            'Vagas Abertas',
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
          title: 'Repasse Financeiro Estimado',
          columns: [
            'Profissional',
            'Modelo',
            'Quantidade / Horas',
            'Total Estimado',
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
        },
        {
          title: 'Auditoria e Ocorrências',
          columns: [
            'Data',
            'Horário',
            'Profissional',
            'Setor',
            'Status',
            'Observação',
          ],
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
    const totalHours = byProfessional.reduce(
      (total, professional) => total + professional.hours,
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
              (data.total
                ? (data.filled / data.total) * 100
                : 0)
            );
          }, 0) / bySector.length
        )
      : 0;

    const criticalSector = bySector.length
      ? bySector.reduce((worst, [name, data]) => {
          const percentage = data.total
            ? (data.filled / data.total) * 100
            : 100;

          return percentage < worst.percentage
            ? { name, percentage }
            : worst;
        }, { name: bySector[0][0], percentage: Infinity })
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
          value: criticalSector?.name || '—',
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
      (total, professional) => total + professional.hours,
      0
    );

    const highestPayment = byProfessional.reduce(
      (highest, professional) =>
        professional.estimatedPay > (highest?.estimatedPay || 0)
          ? professional
          : highest,
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
          label: 'Profissionais',
          value: byProfessional.length,
        },
        {
          label: 'Maior repasse',
          value: highestPayment
            ? `${highestPayment.name} - ${formatCurrency(
                highestPayment.estimatedPay
              )}`
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

  const canceledCount = auditLogs.filter(
    (log) => log.status === 'cancelado'
  ).length;

  const logsWithNotes = auditLogs.filter(
    (log) => log.notes
  ).length;

  const sectorCounts = auditLogs.reduce((accumulator, log) => {
    const sector = log.sector_name || 'Geral';

    accumulator[sector] = (accumulator[sector] || 0) + 1;

    return accumulator;
  }, {});

  const mostAffectedSector = Object.entries(sectorCounts).sort(
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
        value: logsWithNotes,
      },
      {
        label: 'Setor mais afetado',
        value: mostAffectedSector
          ? `${mostAffectedSector[0]} (${mostAffectedSector[1]})`
          : '—',
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

/* ============================================================
 * ABAS
 * ============================================================ */

const TAB_META = {
  conselho: {
    label: '📊 Conselho Consolidado',
    icon: ClipboardList,
  },
  produtividade: {
    label: '⏱️ Produtividade & Horas',
    icon: Clock,
  },
  cobertura: {
    label: '🏥 Cobertura por Setor',
    icon: TrendingUp,
  },
  financeiro: {
    label: '💰 Repasse Financeiro',
    icon: DollarSign,
  },
  auditoria: {
    label: '🛡️ Log de Auditoria',
    icon: ShieldCheck,
  },
};

/* ============================================================
 * TABELA REUTILIZÁVEL
 * ============================================================ */

function ReportTable({ columns, rows, totalsRow }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider">
          <tr>
            {columns.map((column) => (
              <th key={column} className="p-3 font-bold whitespace-nowrap">
                {column}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="p-3 text-slate-700 dark:text-slate-200 whitespace-nowrap"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>

        {totalsRow && (
          <tfoot className="bg-slate-100 dark:bg-slate-800 font-black">
            <tr>
              {totalsRow.map((cell, index) => (
                <td
                  key={index}
                  className="p-3 text-slate-800 dark:text-white whitespace-nowrap"
                >
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-slate-950 to-sky-950 text-white rounded-t-3xl">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-sky-400">
              <Eye className="w-3.5 h-3.5" />
              Pré-visualização Oficial
            </div>

            <h2 className="text-xl font-black tracking-tight mt-1">
              {payload.title}
            </h2>

            <p className="text-xs text-slate-300 mt-1">
              Filtros aplicados: {payload.subtitle}
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
            className="rounded-full p-2 bg-white/10 hover:bg-white/20 text-white"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-6 pb-0">
          {payload.kpis.map((kpi, index) => (
            <div
              key={index}
              className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
            >
              <div className="text-[9px] uppercase font-bold text-slate-400">
                {kpi.label}
              </div>

              <div className="text-sm font-black text-sky-700 dark:text-sky-400 mt-1 break-words">
                {kpi.value}
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 space-y-6">
          {payload.sections?.length ? (
            payload.sections.map((section, index) => (
              <section key={index} className="space-y-3">
                <h3 className="text-lg font-black text-slate-800 dark:text-white">
                  {section.title}
                </h3>

                {section.rows.length ? (
                  <ReportTable
                    columns={section.columns}
                    rows={section.rows}
                    totalsRow={section.totalsRow}
                  />
                ) : (
                  <p className="text-sm text-slate-400 py-8 text-center">
                    Nenhum dado encontrado para esta seção.
                  </p>
                )}
              </section>
            ))
          ) : payload.rows.length ? (
            <ReportTable
              columns={payload.columns}
              rows={payload.rows}
              totalsRow={payload.totalsRow}
            />
          ) : (
            <p className="text-sm text-slate-400 text-center py-16">
              {payload.emptyMessage}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-col md:flex-row items-center justify-between gap-3 p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-3xl">
          <div className="flex items-center gap-2 text-[11px] text-emerald-600 font-semibold">
            <Leaf className="w-3.5 h-3.5" />
            Relatório validado na tela.
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs font-bold"
            >
              Fechar
            </Button>

            <Button
              onClick={onDownloadCSV}
              variant="outline"
              className="text-xs font-bold h-9 gap-2"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              Exportar CSV
            </Button>

            <Button
              onClick={onDownloadPDF}
              className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold h-9 gap-2"
            >
              <FileText className="w-4 h-4" />
              Gerar PDF
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

  const [activeTab, setActiveTab] = useState('conselho');
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
    company?.units?.[0]?.id;

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
          base44.entities.Shift.filter(
            filters,
            '-date',
            1000
          ).catch(() => []),

          base44.entities.Professional.filter(
            filters,
            '-created_date',
            500
          ).catch(() => []),

          base44.entities.Sector.filter(
            filters,
            '-created_date',
            100
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

      const shiftDate =
        typeof shift.date === 'string'
          ? shift.date.split('T')[0]
          : '';

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
        baseRate =
          Number(professional.hourly_rate) || 120;
      }

      if (remunerationType === 'diaria') {
        baseRate =
          Number(professional.daily_rate) || 1500;
      }

      if (remunerationType === 'mensal') {
        baseRate =
          Number(professional.monthly_salary) || 18000;
      }

      map[professional.id] = {
        name: professional.name || 'Sem Nome',
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
          name: shift.professional_name || '—',
          category: 'Profissional',
          confirmed: 0,
          pending: 0,
          canceled: 0,
          hours: 0,
          estimatedPay: 0,
          remunerationType: 'hora',
          hourlyRate: 120,
        };
      }

      const professional =
        map[shift.professional_id];

      if (shift.status === 'confirmado') {
        professional.confirmed += 1;

        const duration =
          Number(shift.duration_hours) || 12;

        professional.hours += duration;

        if (
          professional.remunerationType === 'diaria'
        ) {
          professional.estimatedPay +=
            professional.hourlyRate;
        } else if (
          professional.remunerationType === 'mensal'
        ) {
          professional.estimatedPay =
            professional.hourlyRate;
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

      const sectorName =
        shift.sector_name || 'Geral';

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
        total + (professional.estimatedPay || 0),
      0
    );
  }, [byProfessional]);

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
  ]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-950 to-sky-950 p-6 rounded-3xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sky-400">
            <BarChart3 className="w-4 h-4" />
            Inteligência Executiva & Governança
          </div>

          <h1 className="text-3xl font-black tracking-tight mt-1">
            Relatórios
          </h1>

          <p className="text-xs text-slate-300 max-w-xl mt-1">
            Painel unificado de auditoria, dimensionamento de
            equipes, cobertura operacional e controle financeiro.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Button
            onClick={() => setPreviewOpen(true)}
            className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs h-10 px-5 gap-2"
          >
            <Eye className="w-4 h-4" />
            Visualizar Relatório Oficial
          </Button>

          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
            <Leaf className="w-3 h-3" />
            Valide antes de imprimir
          </span>
        </div>
      </div>

      <div className="flex items-center bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto gap-1">
        {Object.entries(TAB_META).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 min-w-[180px] px-4 py-2.5 text-xs font-bold rounded-xl transition-all text-center whitespace-nowrap ${
              activeTab === key
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {meta.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <Filter className="w-4 h-4 text-sky-600" />
          Filtros:
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">
              De
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
              Até
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
            className="text-xs text-red-500 shrink-0 h-9"
          >
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
        <Sparkles className="w-3.5 h-3.5 text-sky-500" />
        Resumo executivo ·{' '}
        {TAB_META[activeTab].label.replace(/^\S+\s/, '')}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 -mt-3">
        {reportPayload.kpis.map((kpi, index) => (
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
        <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl space-y-5">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              {activeTab === 'conselho' && (
                <ClipboardList className="w-5 h-5 text-sky-600" />
              )}

              {activeTab === 'produtividade' && (
                <Clock className="w-5 h-5 text-sky-600" />
              )}

              {activeTab === 'cobertura' && (
                <TrendingUp className="w-5 h-5 text-sky-600" />
              )}

              {activeTab === 'financeiro' && (
                <DollarSign className="w-5 h-5 text-emerald-600" />
              )}

              {activeTab === 'auditoria' && (
                <ShieldCheck className="w-5 h-5 text-sky-600" />
              )}

              <h2 className="text-lg font-black text-slate-800 dark:text-white">
                {reportPayload.title}
              </h2>
            </div>

            <Button
              onClick={() => setPreviewOpen(true)}
              variant="outline"
              size="sm"
              className="text-xs gap-2"
            >
              <Eye className="w-4 h-4" />
              Visualizar
            </Button>
          </div>

          {activeTab === 'conselho' &&
            reportPayload.sections?.map((section, index) => (
              <section key={index} className="space-y-3">
                <h3 className="font-black text-base text-slate-800 dark:text-white">
                  {section.title}
                </h3>

                {section.rows.length ? (
                  <ReportTable
                    columns={section.columns}
                    rows={section.rows}
                    totalsRow={section.totalsRow}
                  />
                ) : (
                  <p className="text-sm text-slate-400 text-center py-8">
                    Nenhum dado encontrado.
                  </p>
                )}
              </section>
            ))}

          {activeTab !== 'conselho' && (
            <>
              {reportPayload.rows.length ? (
                <ReportTable
                  columns={reportPayload.columns}
                  rows={reportPayload.rows}
                  totalsRow={reportPayload.totalsRow}
                />
              ) : (
                <p className="text-sm text-slate-400 text-center py-12">
                  {reportPayload.emptyMessage}
                </p>
              )}
            </>
          )}
        </Card>
      )}

      {previewOpen && (
        <ReportPreviewModal
          payload={reportPayload}
          onClose={() => setPreviewOpen(false)}
          onDownloadPDF={() => downloadPDF(reportPayload)}
          onDownloadCSV={() => downloadCSV(reportPayload)}
        />
      )}
    </div>
  );
}