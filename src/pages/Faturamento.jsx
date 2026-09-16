import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DollarSign, 
  Download, 
  Calendar, 
  Building2, 
  Users, 
  Search, 
  CheckCircle2, 
  Clock, 
  CreditCard,
  Percent,
  FileSpreadsheet,
  RotateCcw,
  Loader2
} from 'lucide-react';

function safeArray(val) { return Array.isArray(val) ? val : []; }
function safeNumber(val, fb = 0) { const n = Number(val); return Number.isFinite(n) ? n : fb; }

export default function Faturamento() {
  const { user, company, loading: appLoading } = useAppData();
  const [shifts, setShifts] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [sectorFilter, setSectorFilter] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');

  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id || 'unit_h1';

  const loadData = async () => {
    setLoading(true);
    try {
      const query = companyId ? { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) } : {};
      const [sRes, pRes, secRes] = await Promise.all([
        base44.entities.Shift.filter(query, '-date', 5000).catch(() => []),
        base44.entities.Professional.filter(query, '-created_date', 1000).catch(() => []),
        base44.entities.Sector.filter(query, 'name', 300).catch(() => [])
      ]);

      setShifts(safeArray(sRes));
      setProfessionals(safeArray(pRes));
      setSectors(safeArray(secRes));
    } catch (e) {
      console.error('Erro ao carregar dados de faturamento:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!appLoading) loadData();
  }, [appLoading, companyId, unitId]);

  const professionalMap = useMemo(() => {
    const map = {};
    professionals.forEach(p => { if (p?.id) map[p.id] = p; });
    return map;
  }, [professionals]);

  // Consolidado por profissional para o mês selecionado
  const billingReport = useMemo(() => {
    const reportMap = {};

    const monthShifts = shifts.filter(s => {
      if (!s.date || !String(s.date).startsWith(selectedMonth)) return false;
      if (s.status === 'cancelado' || s.status === 'disponivel' || s.status === 'aberto') return false;
      if (!s.professional_id) return false;
      if (sectorFilter !== 'todos' && String(s.sector_id) !== String(sectorFilter)) return false;
      return true;
    });

    monthShifts.forEach(s => {
      const pId = s.professional_id;
      const prof = professionalMap[pId] || {};
      const pName = s.professional_name || prof.name || 'Médico Não Identificado';

      if (!reportMap[pId]) {
        // Extrai parâmetros do contrato/cooperativa do cadastro
        let coopRate = 0;
        if (prof.notes && prof.notes.includes('Taxa:')) {
          const match = prof.notes.match(/Taxa:\s*(\d+)%/i);
          if (match && match[1]) coopRate = Number(match[1]);
        }

        reportMap[pId] = {
          professionalId: pId,
          name: pName,
          document: prof.document || prof.registration_number || '—',
          registrationCode: prof.registration_code || '—',
          specialty: prof.specialty || 'Clínica Geral',
          pixKey: prof.pix_key || 'Não cadastrada',
          pixType: prof.pix_type || 'CPF',
          bankInfo: prof.bank_info || '—',
          remunerationType: prof.remuneration_type || 'hora',
          coopTaxRate: coopRate,
          totalShifts: 0,
          totalHours: 0,
          grossAmount: 0,
          netAmount: 0
        };
      }

      const item = reportMap[pId];
      const hours = safeNumber(s.duration_hours || s.hours, 12);
      const shiftGross = safeNumber(s.total_amount, (Number(s.hourly_rate) || 120) * hours);

      item.totalShifts += 1;
      item.totalHours += hours;
      item.grossAmount += shiftGross;
    });

    // Calcula líquido considerando retenção da cooperativa
    return Object.values(reportMap).map(item => {
      const discount = (item.grossAmount * item.coopTaxRate) / 100;
      item.netAmount = item.grossAmount - discount;
      return item;
    }).filter(item => {
      if (!searchQuery) return true;
      const term = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(term) ||
        item.document.toLowerCase().includes(term) ||
        item.specialty.toLowerCase().includes(term)
      );
    });
  }, [shifts, selectedMonth, sectorFilter, searchQuery, professionalMap]);

  const summary = useMemo(() => {
    let totalGross = 0;
    let totalNet = 0;
    let totalHours = 0;
    let totalShifts = 0;

    billingReport.forEach(item => {
      totalGross += item.grossAmount;
      totalNet += item.netAmount;
      totalHours += item.totalHours;
      totalShifts += item.totalShifts;
    });

    return { totalGross, totalNet, totalHours, totalShifts, totalProfs: billingReport.length };
  }, [billingReport]);

  const handleExportCSV = () => {
    if (billingReport.length === 0) {
      alert('Nenhum dado disponível para exportação.');
      return;
    }

    const headers = [
      'Matrícula/ID',
      'Nome do Profissional',
      'CRM/COREN',
      'Especialidade',
      'Regime',
      'Qtd Plantões',
      'Total Horas',
      'Valor Bruto (R$)',
      'Taxa Retenção (%)',
      'Valor Líquido (R$)',
      'Chave PIX',
      'Tipo PIX',
      'Dados Bancários'
    ];

    const rows = billingReport.map(i => [
      `"${i.registrationCode}"`,
      `"${i.name}"`,
      `"${i.document}"`,
      `"${i.specialty}"`,
      `"${i.remunerationType.toUpperCase()}"`,
      i.totalShifts,
      i.totalHours,
      i.grossAmount.toFixed(2),
      `${i.coopTaxRate}%`,
      i.netAmount.toFixed(2),
      `"${i.pixKey}"`,
      `"${i.pixType}"`,
      `"${i.bankInfo}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `fechamento_repasses_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* HEADER */}
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
              <DollarSign className="w-4 h-4" /> Gestão Financeira Hospitalar
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-tight">Faturamento & Repasse Médico</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Cálculo automático de honorários, conciliação por horas trabalhadas, retenção cooperativa e lote PIX.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={loadData} variant="outline" className="border-slate-700 bg-slate-900/60 text-white hover:bg-slate-800 text-xs h-10 gap-2">
              <RotateCcw className="w-3.5 h-3.5" /> Atualizar
            </Button>
            <Button onClick={handleExportCSV} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 text-xs h-10 px-5 rounded-xl shadow-lg shadow-emerald-950">
              <Download className="w-4 h-4" /> Exportar Relatório CSV
            </Button>
          </div>
        </div>
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Repasse Total Líquido</span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              R$ {summary.totalNet.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
        </Card>

        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Horas Cumpridas</span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              {summary.totalHours.toLocaleString('pt-BR')} horas
            </h3>
          </div>
        </Card>

        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Plantões Realizados</span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              {summary.totalShifts} plantões
            </h3>
          </div>
        </Card>

        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Médicos a Receber</span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              {summary.totalProfs} profissionais
            </h3>
          </div>
        </Card>
      </div>

      {/* FILTROS */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Competência:</span>
            <Input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)} 
              className="h-9 w-40 text-xs bg-slate-50 dark:bg-slate-950 font-bold" 
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Setor:</span>
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="h-9 w-52 text-xs bg-slate-50 dark:bg-slate-950 font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os setores</SelectItem>
                {sectors.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input 
            placeholder="Buscar por médico, CRM ou especialidade..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="pl-9 h-9 text-xs" 
          />
        </div>
      </div>

      {/* TABELA DE REPASSES */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-100 dark:bg-slate-950 text-slate-500 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider font-bold">
              <tr>
                <th className="p-3.5">Matrícula</th>
                <th className="p-3.5">Plantonista / CRM</th>
                <th className="p-3.5">Especialidade</th>
                <th className="p-3.5 text-center">Plantões</th>
                <th className="p-3.5 text-center">Horas</th>
                <th className="p-3.5 text-right">Valor Bruto</th>
                <th className="p-3.5 text-center">Taxa Cooperativa</th>
                <th className="p-3.5 text-right">Líquido a Pagar</th>
                <th className="p-3.5">Chave PIX Cadastrada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="9" className="p-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    Calculando repasses...
                  </td>
                </tr>
              ) : billingReport.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-12 text-center text-slate-400">
                    Nenhum repasse localizado para o mês e filtros selecionados.
                  </td>
                </tr>
              ) : (
                billingReport.map(item => (
                  <tr key={item.professionalId} className="hover:bg-slate-50/60 dark:hover:bg-slate-950/40 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-sky-600">
                      {item.registrationCode}
                    </td>
                    <td className="p-3.5">
                      <strong className="text-slate-900 dark:text-white block">{item.name}</strong>
                      <span className="text-[10px] text-slate-400">CRM/COREN: {item.document}</span>
                    </td>
                    <td className="p-3.5 font-medium text-slate-600 dark:text-slate-300">
                      {item.specialty}
                    </td>
                    <td className="p-3.5 text-center font-bold text-slate-700 dark:text-slate-200">
                      {item.totalShifts}
                    </td>
                    <td className="p-3.5 text-center font-bold text-slate-700 dark:text-slate-200">
                      {item.totalHours}h
                    </td>
                    <td className="p-3.5 text-right font-semibold text-slate-500">
                      R$ {item.grossAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 text-center">
                      {item.coopTaxRate > 0 ? (
                        <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">
                          {item.coopTaxRate}% Retenção
                        </span>
                      ) : (
                        <span className="text-slate-400">Isento</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                      R$ {item.netAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5">
                      <div className="font-mono text-slate-800 dark:text-slate-200">{item.pixKey}</div>
                      <div className="text-[9px] text-slate-400 uppercase">({item.pixType})</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}