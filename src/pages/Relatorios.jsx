import React, { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Clock, TrendingUp, FileText, FileSpreadsheet,
  ShieldCheck, Building2, Filter, Loader2, DollarSign, BarChart3,
  Eye, X, Leaf, Sparkles,
} from 'lucide-react';
import { exportReportPDF, exportReportCSV } from '@/lib/exportReport';

/* ============================================================
 * Helpers de formatação (pt-BR)
 * ============================================================ */
function formatCurrency(value = 0) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return d && m && y ? `${d}/${m}/${y}` : dateStr;
}

/* ============================================================
 * buildReportPayload (Corrigido para alinhar com o faturamento real)
 * ============================================================ */
function buildReportPayload({ tab, company, user, filtersLabel, overview, byProfessional, bySector, auditLogs, totalFinancialEstimate }) {
  const companyName = company?.name || 'Hospital';
  const generatedBy = user?.data?.full_name || user?.data?.name || undefined;
  const generatedAt = new Date();
  const base = { companyName, generatedBy, generatedAt, subtitle: filtersLabel };

  if (tab === 'produtividade') {
    const totalHours = byProfessional.reduce((acc, p) => acc + (p.hours || 0), 0);
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
      columns: ['Profissional', 'Especialidade', 'Confirmados', 'Pendentes', 'Horas Totais'],
      rows: byProfessional.map((p) => [p.name, p.category, p.confirmed, p.pending, `${p.hours}h`]),
      totalsRow: ['TOTAL', '', overview.confirmed, overview.pending, `${totalHours}h`],
      emptyMessage: 'Nenhum profissional com plantões no período selecionado.',
    };
  }

  if (tab === 'cobertura') {
    const rows = bySector.map(([name, data]) => {
      const pct = data.total ? Math.round((data.filled / data.total) * 100) : 0;
      return [name, data.total, data.filled, data.open, data.canceled, `${pct}%`];
    });
    const avgPct = bySector.length
      ? Math.round(
          bySector.reduce((acc, [, d]) => acc + (d.total ? (d.filled / d.total) * 100 : 0), 0) / bySector.length
        )
      : 0;
    const worst = bySector.length
      ? bySector.reduce(
          (min, [name, d]) => {
            const pct = d.total ? (d.filled / d.total) * 100 : 100;
            return pct < min.pct ? { name, pct } : min;
          },
          { name: bySector[0][0], pct: Infinity }
        )
      : null;

    return {
      ...base,
      key: tab,
      title: 'Cobertura Operacional por Setor',
      kpis: [
        { label: 'Setores mapeados', value: bySector.length },
        { label: 'Cobertura média', value: `${avgPct}%` },
        { label: 'Setor mais crítico', value: worst ? worst.name : '—' },
        { label: 'Vagas abertas', value: overview.open },
      ],
      columns: ['Setor', 'Turnos Totais', 'Preenchidos', 'Vagas Abertas', 'Cancelados', '% Cobertura'],
      rows,
      emptyMessage: 'Sem dados de setores para os filtros selecionados.',
    };
  }

  if (tab === 'financeiro') {
    const totalHours = byProfessional.reduce((acc, p) => acc + (p.hours || 0), 0);
    const top = byProfessional.reduce((max, p) => (p.estimatedPay > (max?.estimatedPay || 0) ? p : max), null);

    return {
      ...base,
      key: tab,
      title: 'Projeção de Repasse Financeiro',
      kpis: [
        { label: 'Total estimado', value: formatCurrency(totalFinancialEstimate) },
        { label: 'Profissionais faturados', value: byProfessional.length },
        { label: 'Maior repasse', value: top ? `${top.name} (${formatCurrency(top.estimatedPay)})` : '—' },
        { label: 'Horas faturáveis', value: `${totalHours}h` },
      ],
      columns: ['Profissional', 'Modelo', 'Qtd / Horas', 'Total a Liquidar'],
      rows: byProfessional.map((p) => [
        p.name, 
        p.remunerationType === 'diaria' ? 'Por Plantão/Diária' : p.remunerationType === 'mensal' ? 'Fixo Mensal' : 'Horista', 
        p.remunerationType === 'hora' ? `${p.hours}h` : `${p.confirmed} plantão(ões)`, 
        formatCurrency(p.estimatedPay)
      ]),
      totalsRow: ['TOTAL', '', `${totalHours}h`, formatCurrency(totalFinancialEstimate)],
      emptyMessage: 'Nenhum valor a liquidar para os filtros selecionados.',
    };
  }

  // auditoria
  const canceledCount = auditLogs.filter((l) => l.status === 'cancelado').length;
  const withNotes = auditLogs.filter((l) => l.notes).length;
  const sectorCounts = auditLogs.reduce((acc, l) => {
    const key = l.sector_name || 'Geral';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const topSectorEntry = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0];

  return {
    ...base,
    key: tab,
    title: 'Log de Auditoria e Plantões Cancelados',
    kpis: [
      { label: 'Eventos totais', value: auditLogs.length },
      { label: 'Cancelamentos', value: canceledCount },
      { label: 'Com observação', value: withNotes },
      { label: 'Setor mais afetado', value: topSectorEntry ? `${topSectorEntry[0]} (${topSectorEntry[1]})` : '—' },
    ],
    columns: ['Data', 'Horário', 'Profissional', 'Setor', 'Observação', 'ID'],
    rows: auditLogs.map((l) => [
      formatDateBR(l.date) || '—',
      `${l.start_time || '--'} - ${l.end_time || '--'}`,
      l.professional_name || 'Vago',
      l.sector_name || 'Geral',
      l.notes || (l.status === 'cancelado' ? 'Cancelado sem observação registrada' : '—'),
      l.id,
    ],
    emptyMessage: 'Nenhum evento de cancelamento ou alteração registrado no período.'),
  };
}

const TAB_META = {
  produtividade: { label: '⏱️ Produtividade & Horas', icon: Clock },
  cobertura: { label: '🏥 Cobertura por Setor', icon: TrendingUp },
  financeiro: { label: '💰 Repasse Financeiro', icon: DollarSign },
  auditoria: { label: '🛡️ Log de Auditoria', icon: ShieldCheck },
};

/* ============================================================
 * Modal de Pré-Visualização Executiva
 * ============================================================ */
function ReportPreviewModal({ payload, onClose, onDownloadPDF, onDownloadCSV }) {
  if (!payload) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-slate-950 to-sky-950 text-white rounded-t-3xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-sky-400">
              <Eye className="w-3.5 h-3.5" /> Pré-visualização Oficial · Pronto para impressão
            </div>
            <h2 className="text-xl font-black tracking-tight">{payload.title}</h2>
            <p className="text-xs text-slate-300">Filtros aplicados: {payload.subtitle}</p>
            <p className="text-[10px] text-slate-400">
              Instituição: {payload.companyName} {payload.generatedBy ? `· Emitido por ${payload.generatedBy}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-2 bg-white/10 hover:bg-white/20 transition-colors text-white"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 pb-0">
          {payload.kpis.map((kpi, i) => (
            <div key={i} className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <div className="text-[9px] uppercase font-bold text-slate-400">{kpi.label}</div>
              <div className="text-sm font-black text-sky-700 dark:text-sky-400 mt-0.5 truncate">{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Tabela de dados */}
        <div className="p-6">
          {payload.rows.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-16">{payload.emptyMessage}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider">
                  <tr>
                    {payload.columns.map((col) => (
                      <th key={col} className="p-3 font-bold">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {payload.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      {row.map((cell, j) => (
                        <td key={j} className="p-3 text-slate-700 dark:text-slate-200">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {payload.totalsRow && (
                  <tfoot className="bg-slate-100 dark:bg-slate-800 font-black">
                    <tr>
                      {payload.totalsRow.map((cell, j) => (
                        <td key={j} className="p-3 text-slate-800 dark:text-white">{cell}</td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* Ações do Rodapé do Modal */}
        <div className="sticky bottom-0 flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-3xl">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
            <Leaf className="w-3.5 h-3.5" /> Validado na tela — clique abaixo apenas se precisar gerar o arquivo físico.
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs font-bold">
              Fechar
            </Button>
            <Button onClick={onDownloadCSV} variant="outline" className="text-xs font-bold h-9 gap-2 border-slate-200 dark:border-slate-700">
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Exportar CSV
            </Button>
            <Button onClick={onDownloadPDF} className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold h-9 gap-2">
              <FileText className="w-4 h-4" /> Baixar PDF Oficial
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Componente Principal
 * ============================================================ */
export default function Relatorios() {
  const { user, company, loading } = useAppData();
  const [shifts, setShifts] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [activeTab, setActiveTab] = useState('produtividade');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSector, setSelectedSector] = useState('all');
  const [previewOpen, setPreviewOpen] = useState(false);

  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id;

  const loadData = async () => {
    if (!companyId) return;
    setLoadingData(true);
    try {
      const f = { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) };
      const [s, p, sec] = await Promise.all([
        base44.entities.Shift.filter(f, '-date', 1000).catch(() => []),
        base44.entities.Professional.filter(f, '-created_date', 500).catch(() => []),
        base44.entities.Sector.filter(f, '-created_date', 100).catch(() => []),
      ]);
      setShifts(Array.isArray(s) ? s : []);
      setProfessionals(Array.isArray(p) ? p : []);
      setSectors(Array.isArray(sec) ? sec : []);
    } catch (e) {
      console.error('Erro ao carregar dados de relatório:', e);
      setShifts([]);
      setProfessionals([]);
      setSectors([]);
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

  // Motor corrigido de faturamento real baseado na remuneração de cada profissional
  const byProfessional = useMemo(() => {
    const map = {};
    if (Array.isArray(professionals)) {
      professionals.forEach((p) => {
        if (!p || !p.id) return;
        const remType = p.remuneration_type || 'hora';
        let baseRate = 120;
        if (remType === 'hora') baseRate = Number(p.hourly_rate) || 120;
        else if (remType === 'diaria') baseRate = Number(p.daily_rate) || 1500;
        else if (remType === 'mensal') baseRate = Number(p.monthly_salary) || 18000;

        map[p.id] = {
          name: p.name || 'Sem Nome',
          category: p.specialty || p.category || 'Geral',
          confirmed: 0,
          pending: 0,
          canceled: 0,
          hours: 0,
          estimatedPay: 0,
          remunerationType: remType,
          hourlyRate: baseRate,
        };
      });
    }

    filteredShifts.forEach((s) => {
      if (!s || !s.professional_id) return;
      if (!map[s.professional_id]) {
        map[s.professional_id] = {
          name: s.professional_name || '—',
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
      
      const profEntry = map[s.professional_id];

      if (s.status === 'confirmado') {
        profEntry.confirmed += 1;
        const dur = Number(s.duration_hours) || 12;
        profEntry.hours += dur;

        // Cálculo correspondente ao modelo financeiro correto do profissional
        if (profEntry.remunerationType === 'diaria') {
          profEntry.estimatedPay += profEntry.hourlyRate; // Diária fixa por plantão
        } else if (profEntry.remunerationType === 'mensal') {
          // Salário mensal distribuído proporcionalmente ou exibido por total consolidado
          profEntry.estimatedPay = profEntry.hourlyRate; 
        } else {
          profEntry.estimatedPay += dur * profEntry.hourlyRate; // Horista
        }
      }
      if (s.status === 'pendente') profEntry.pending += 1;
      if (s.status === 'cancelado') profEntry.canceled += 1;
    });

    return Object.values(map)
      .filter((m) => m.confirmed > 0 || m.pending > 0 || m.canceled > 0)
      .sort((a, b) => b.hours - a.hours);
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

  const overview = useMemo(
    () => ({
      total: filteredShifts.length,
      confirmed: filteredShifts.filter((s) => s?.status === 'confirmado').length,
      pending: filteredShifts.filter((s) => s?.status === 'pendente').length,
      open: filteredShifts.filter((s) => s?.status === 'vago').length,
      canceled: filteredShifts.filter((s) => s?.status === 'cancelado').length,
    }),
    [filteredShifts]
  );

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

  const reportPayload = useMemo(
    () =>
      buildReportPayload({
        tab: activeTab,
        company,
        user,
        filtersLabel,
        overview,
        byProfessional,
        bySector,
        auditLogs,
        totalFinancialEstimate,
      }),
    [activeTab, company, user, filtersLabel, overview, byProfessional, bySector, auditLogs, totalFinancialEstimate]
  );

  const handleDownloadPDF = () => exportReportPDF(reportPayload);
  const handleDownloadCSV = () => exportReportCSV(reportPayload);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* HEADER EXECUTIVO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-950 to-sky-950 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sky-400">
            <BarChart3 className="w-4 h-4" /> Inteligência Executiva & Governança
          </div>
          <h1 className="text-3xl font-black tracking-tight">Relatórios</h1>
          <p className="text-xs text-slate-300 max-w-xl">
            Painel unificado de auditoria, dimensionamento de equipes e controle de repasses da instituição.
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Button
            onClick={() => setPreviewOpen(true)}
            className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs h-10 px-5 gap-2 shadow-lg"
          >
            <Eye className="w-4 h-4" /> Visualizar Relatório Oficial
          </Button>
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
            <Leaf className="w-3 h-3" /> valide na tela antes de imprimir
          </span>
        </div>
      </div>

      {/* ABAS DE NAVEGAÇÃO DOS RELATÓRIOS */}
      <div className="flex items-center bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto gap-1">
        {Object.entries(TAB_META).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 min-w-[160px] px-4 py-2.5 text-xs font-bold rounded-xl transition-all text-center whitespace-nowrap ${
              activeTab === key
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {meta.label}
          </button>
        ))}
      </div>

      {/* BARRA DE FILTROS INTELIGENTES */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
          <Filter className="w-4 h-4 text-sky-600" /> Filtros Rápidos:
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full flex-1">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">De (Opcional)</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-xs bg-slate-50 dark:bg-slate-800" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">Até (Opcional)</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 text-xs bg-slate-50 dark:bg-slate-800" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">Setor Específico</label>
            <Select value={String(selectedSector)} onValueChange={setSelectedSector}>
              <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800"><SelectValue placeholder="Todos os setores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores (Geral)</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={String(s.name)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(startDate || endDate || selectedSector !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setStartDate(''); setEndDate(''); setSelectedSector('all'); }} className="text-xs text-red-500 shrink-0 h-9">
            Redefinir Filtros
          </Button>
        )}
      </div>

      {/* RESUMO EXECUTIVO CONTEXTUAL */}
      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
        <Sparkles className="w-3.5 h-3.5 text-sky-500" /> Resumo executivo · {TAB_META[activeTab].label.replace(/^\S+\s/, '')}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 -mt-3">
        {reportPayload.kpis.map((kpi, i) => (
          <Card key={i} className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <div className="text-[10px] uppercase font-bold text-slate-400">{kpi.label}</div>
            <div className="text-xl font-black text-sky-700 dark:text-sky-400 mt-1 truncate">{kpi.value}</div>
          </Card>
        ))}
      </div>

      {/* CORPO PRINCIPAL INTERATIVO */}
      {loadingData ? (
        <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-sky-600" /></div>
      ) : (
        <div className="space-y-6">
          {activeTab === 'produtividade' && (
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 rounded-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-sky-600" /> Produtividade & Carga Horária
                </h3>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                  {byProfessional.length} profissionais
                </span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider">
                    <tr>
                      {reportPayload.columns.map(col => <th key={col} className="p-3 font-bold">{col}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {reportPayload.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        {row.map((cell, j) => <td key={j} className="p-3 text-slate-700 dark:text-slate-200">{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'cobertura' && (
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 rounded-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-sky-600" /> Cobertura Operacional por Setor
                </h3>
              </div>
              <div className="space-y-4">
                {bySector.map(([name, data]) => {
                  const pct = data.total ? Math.round((data.filled / data.total) * 100) : 0;
                  return (
                    <div key={name} className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 dark:bg-slate-800/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-sky-600" /> {name}
                        </span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          {pct}% preenchido · <span className="text-red-600 font-black">{data.open} vagas abertas</span>
                        </span>
                      </div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden p-0.5">
                        <div className={`h-full rounded-full ${pct < 70 ? 'bg-red-500' : pct < 90 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {activeTab === 'financeiro' && (
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 rounded-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" /> Projeção de Repasse & Honorários
                </h3>
                <div className="text-right bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-200">
                  <div className="text-xl font-black text-emerald-600">{formatCurrency(totalFinancialEstimate)}</div>
                  <div className="text-[10px] uppercase font-bold text-emerald-700">Total Global Estimado</div>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 border-b uppercase">
                    <tr>
                      {reportPayload.columns.map(col => <th key={col} className="p-3.5 font-bold">{col}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y font-medium">
                    {reportPayload.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        {row.map((cell, j) => <td key={j} className="p-3.5 text-slate-700 dark:text-slate-200">{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'auditoria' && (
            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 rounded-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-sky-600" /> Log de Auditoria & Modificações
                </h3>
              </div>
              <div className="space-y-3">
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-12">Nenhum evento registrado no período.</p>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="p-4 rounded-2xl border border-red-200 bg-red-50/30 flex justify-between items-center gap-3">
                      <div>
                        <div className="text-xs font-bold text-red-800">Cancelado em {formatDateBR(log.date)} ({log.start_time} - {log.end_time})</div>
                        <div className="text-xs text-slate-600">Profissional: <b>{log.professional_name || 'Vago'}</b> · Setor: <b>{log.sector_name}</b></div>
                        {log.notes && <div className="text-xs text-red-700 font-mono mt-1">📝 {log.notes}</div>}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">ID: {log.id}</div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {previewOpen && (
        <ReportPreviewModal
          payload={reportPayload}
          onClose={() => setPreviewOpen(false)}
          onDownloadPDF={handleDownloadPDF}
          onDownloadCSV={handleDownloadCSV}
        />
      )}
    </div>
  );
}