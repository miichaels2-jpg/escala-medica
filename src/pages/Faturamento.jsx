import React, { useState, useMemo } from 'react';
import { useCentralData } from '@/lib/AppDataProvider';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DollarSign, Download, Calendar, Building2, Users, Search, 
  Clock, CreditCard, RotateCcw, Loader2
} from 'lucide-react';
import { calculateShiftRemuneration, formatCurrencyBRL, roundToCents } from '@/lib/financeUtils';

export default function Faturamento() {
  const { 
    shifts, 
    professionals, 
    professionalMap, 
    sectors, 
    selectedUnitId, 
    setSelectedUnitId, 
    units, 
    refreshAllData, 
    loadingData 
  } = useCentralData();

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [sectorFilter, setSectorFilter] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // CÁLCULO EXATO DE FATURAMENTO E REPASSES CRUZADOS
  const billingReport = useMemo(() => {
    const reportMap = {};

    const monthShifts = shifts.filter(s => {
      if (!s.date || !String(s.date).startsWith(selectedMonth)) return false;
      const statusKey = String(s.status || '').toLowerCase().trim();
      if (statusKey === 'cancelado' || statusKey === 'disponivel' || statusKey === 'aberto') return false;
      if (!s.professional_id) return false;
      if (selectedUnitId && s.unit_id && String(s.unit_id) !== String(selectedUnitId)) return false;
      if (sectorFilter !== 'todos' && String(s.sector_id) !== String(sectorFilter)) return false;
      return true;
    });

    monthShifts.forEach(shift => {
      const prof = professionalMap[shift.professional_id];
      const pId = shift.professional_id;
      const pName = shift.professional_name || prof?.name || 'Profissional';

      if (!reportMap[pId]) {
        reportMap[pId] = {
          professionalId: pId,
          name: pName,
          document: prof?.document || prof?.registration_number || '—',
          registrationCode: prof?.registration_code || '—',
          specialty: prof?.specialty || 'Clínica Médica',
          pixKey: prof?.pix_key || 'Não cadastrada',
          pixType: (prof?.pix_type || 'CPF').toUpperCase(),
          remType: String(prof?.remuneration_type || 'hora').toLowerCase(),
          coopTaxRate: Number(prof?.coop_tax_rate) || 0,
          totalShifts: 0,
          totalHours: 0,
          grossAmount: 0,
          discountAmount: 0,
          netAmount: 0
        };
      }

      const item = reportMap[pId];
      const calc = calculateShiftRemuneration(shift, prof);

      item.totalShifts += 1;
      item.totalHours = roundToCents(item.totalHours + calc.hours);
      item.grossAmount = roundToCents(item.grossAmount + calc.gross);
      item.discountAmount = roundToCents(item.discountAmount + calc.discount);
      item.netAmount = roundToCents(item.netAmount + calc.net);
    });

    return Object.values(reportMap).filter(item => {
      if (!searchQuery) return true;
      const term = searchQuery.toLowerCase().trim();
      return (
        item.name.toLowerCase().includes(term) ||
        item.document.toLowerCase().includes(term) ||
        item.specialty.toLowerCase().includes(term) ||
        item.registrationCode.toLowerCase().includes(term)
      );
    });
  }, [shifts, selectedMonth, selectedUnitId, sectorFilter, searchQuery, professionalMap]);

  // TOTAIS CONSOLIDADOS
  const summary = useMemo(() => {
    let gross = 0, net = 0, hours = 0, count = 0;
    billingReport.forEach(i => {
      gross = roundToCents(gross + i.grossAmount);
      net = roundToCents(net + i.netAmount);
      hours = roundToCents(hours + i.totalHours);
      count += i.totalShifts;
    });
    return { gross, net, hours, count, totalDoctors: billingReport.length };
  }, [billingReport]);

  const handleExportCSV = () => {
    if (billingReport.length === 0) {
      alert('Nenhum dado financeiro para exportar.');
      return;
    }

    const headers = ['Matrícula', 'Profissional', 'CRM', 'Especialidade', 'Contrato', 'Plantões', 'Horas', 'Bruto (R$)', 'Retenção (%)', 'Líquido (R$)', 'Chave PIX', 'Tipo PIX'];
    const rows = billingReport.map(i => [
      `"${i.registrationCode}"`,
      `"${i.name}"`,
      `"${i.document}"`,
      `"${i.specialty}"`,
      `"${i.remType.toUpperCase()}"`,
      i.totalShifts,
      i.totalHours,
      i.grossAmount.toFixed(2),
      `${i.coopTaxRate}%`,
      i.netAmount.toFixed(2),
      `"${i.pixKey}"`,
      `"${i.pixType}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `fechamento_faturamento_${selectedMonth}.csv`;
    link.click();
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* HEADER */}
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <DollarSign className="w-4 h-4" /> Gestão Financeira Hospitalar
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-black">Faturamento & Repasse Médico</h2>
            <p className="text-xs text-slate-300">Valores calculados estritamente pelo contrato dos profissionais.</p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={refreshAllData} variant="outline" className="border-slate-700 bg-slate-900/60 text-white text-xs h-10 gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> Atualizar
            </Button>
            <Button onClick={handleExportCSV} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-lg gap-1.5">
              <Download className="w-4 h-4" /> Exportar CSV
            </Button>
          </div>
        </div>
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Repasse Total Líquido</span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">{formatCurrencyBRL(summary.net)}</h3>
          </div>
        </Card>

        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Horas Cumpridas</span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">{summary.hours}h</h3>
          </div>
        </Card>

        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Plantões Cumpridos</span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">{summary.count} plantões</h3>
          </div>
        </Card>

        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Médicos a Receber</span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">{summary.totalDoctors}</h3>
          </div>
        </Card>
      </div>

      {/* FILTROS */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Mês:</span>
            <Input 
              type="month" 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(e.target.value)} 
              className="h-9 w-40 text-xs font-bold" 
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Unidade:</span>
            <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
              <SelectTrigger className="h-9 w-48 text-xs font-semibold"><SelectValue /></SelectTrigger>
              <SelectContent>
                {units.map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Setor:</span>
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="h-9 w-48 text-xs font-semibold"><SelectValue /></SelectTrigger>
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
            placeholder="Buscar por médico ou CRM..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
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
                <th className="p-3.5">Médico / CRM</th>
                <th className="p-3.5">Especialidade</th>
                <th className="p-3.5">Contrato</th>
                <th className="p-3.5 text-center">Plantões</th>
                <th className="p-3.5 text-center">Horas</th>
                <th className="p-3.5 text-right">Valor Bruto</th>
                <th className="p-3.5 text-center">Taxa Coop</th>
                <th className="p-3.5 text-right">Líquido a Pagar</th>
                <th className="p-3.5">Chave PIX</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loadingData ? (
                <tr>
                  <td colSpan="10" className="p-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    Consolidando dados financeiros...
                  </td>
                </tr>
              ) : billingReport.length === 0 ? (
                <tr>
                  <td colSpan="10" className="p-12 text-center text-slate-400">
                    Nenhum repasse registrado para o mês e filtros selecionados.
                  </td>
                </tr>
              ) : (
                billingReport.map(item => (
                  <tr key={item.professionalId} className="hover:bg-slate-50/60 dark:hover:bg-slate-950/40">
                    <td className="p-3.5 font-mono font-bold text-sky-600">{item.registrationCode}</td>
                    <td className="p-3.5">
                      <strong className="text-slate-900 dark:text-white block">{item.name}</strong>
                      <span className="text-[10px] text-slate-400">CRM: {item.document}</span>
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">{item.specialty}</td>
                    <td className="p-3.5">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                        {item.remType}
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-bold">{item.totalShifts}</td>
                    <td className="p-3.5 text-center font-bold">{item.totalHours}h</td>
                    <td className="p-3.5 text-right font-medium text-slate-500">{formatCurrencyBRL(item.grossAmount)}</td>
                    <td className="p-3.5 text-center">
                      {item.coopTaxRate > 0 ? (
                        <span className="bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">
                          {item.coopTaxRate}%
                        </span>
                      ) : (
                        <span className="text-slate-400">Isento</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatCurrencyBRL(item.netAmount)}
                    </td>
                    <td className="p-3.5">
                      <span className="font-mono text-slate-800 dark:text-slate-200 block">{item.pixKey}</span>
                      <span className="text-[9px] text-slate-400">({item.pixType})</span>
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