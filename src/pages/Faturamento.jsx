import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DollarSign, 
  Users, 
  Calendar, 
  Clock, 
  Download, 
  Loader2, 
  TrendingUp, 
  Search, 
  CheckCircle2, 
  FileSpreadsheet 
} from 'lucide-react';

export default function Faturamento() {
  const { user, company, loading: appLoading } = useAppData();
  const [professionals, setProfessionals] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [billingRecords, setBillingRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [search, setSearch] = useState('');

  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id || 'unit_h1';

  const loadData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const f = { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) };
      const [profs, shs, bills] = await Promise.all([
        base44.entities.Professional.filter(f, 'name', 300),
        base44.entities.Shift.filter(f, '-date', 1000),
        base44.entities.BillingRecord.filter(f, '-date', 1000)
      ]);
      setProfessionals(profs || []);
      setShifts(shs || []);
      setBillingRecords(bills || []);
    } catch (e) {
      console.error('Erro ao carregar faturamento:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (appLoading) return;
    loadData();
  }, [appLoading, companyId, unitId]);

  // Consolidação de repasses por profissional no mês selecionado
  const reportByProfessional = useMemo(() => {
    const profMap = {};

    professionals.forEach((p) => {
      profMap[p.id] = {
        id: p.id,
        name: p.name,
        specialty: p.specialty || p.category || 'Clínica Geral',
        remunerationType: p.remuneration_type || 'hora',
        hourlyRate: Number(p.hourly_rate) || 0,
        dailyRate: Number(p.daily_rate) || 0,
        monthlySalary: Number(p.monthly_salary) || 0,
        totalShifts: 0,
        totalHours: 0,
        totalRepasse: 0
      };
    });

    // Filtra plantões do mês
    const monthShifts = shifts.filter((s) => {
      const sDate = (s.date || '').slice(0, 7);
      return sDate === selectedMonth && s.status !== 'cancelado';
    });

    monthShifts.forEach((s) => {
      if (!s.professional_id) return;

      if (!profMap[s.professional_id]) {
        profMap[s.professional_id] = {
          id: s.professional_id,
          name: s.professional_name || 'Profissional',
          specialty: s.sector_name || 'Geral',
          remunerationType: 'hora',
          hourlyRate: 120,
          dailyRate: 1500,
          monthlySalary: 0,
          totalShifts: 0,
          totalHours: 0,
          totalRepasse: 0
        };
      }

      const p = profMap[s.professional_id];
      const hours = Number(s.duration_hours) || 12;
      p.totalShifts += 1;
      p.totalHours += hours;

      // Cálculo do repasse do plantão
      if (p.remunerationType === 'hora') {
        p.totalRepasse += hours * p.hourlyRate;
      } else if (p.remunerationType === 'diaria') {
        p.totalRepasse += p.dailyRate;
      }
    });

    // Para quem tem salário fixo mensal, adiciona o valor integral se teve plantão ou vínculo no mês
    Object.values(profMap).forEach((p) => {
      if (p.remunerationType === 'mensal') {
        p.totalRepasse = p.monthlySalary;
      }
    });

    return Object.values(profMap).filter((item) => {
      const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.specialty.toLowerCase().includes(search.toLowerCase());
      // Mostra quem teve plantão ou tem contrato mensal
      const hasActivity = item.totalShifts > 0 || item.remunerationType === 'mensal';
      return matchesSearch && hasActivity;
    });
  }, [professionals, shifts, selectedMonth, search]);

  // Totais Consolidados
  const totals = useMemo(() => {
    return reportByProfessional.reduce(
      (acc, item) => {
        acc.shifts += item.totalShifts;
        acc.hours += item.totalHours;
        acc.value += item.totalRepasse;
        return acc;
      },
      { shifts: 0, hours: 0, value: 0 }
    );
  }, [reportByProfessional]);

  // Exportar Relatório em CSV/Excel
  const handleExportCSV = () => {
    const headers = ['Profissional;Especialidade;Tipo de Remuneracao;Qtd Plantoes;Total Horas;Valor Repasse (R$)'];
    const rows = reportByProfessional.map((p) => {
      const typeLabel = p.remunerationType === 'hora' ? 'Horista' : p.remunerationType === 'diaria' ? 'Diarista' : 'Fixo Mensal';
      return `"${p.name}";"${p.specialty}";"${typeLabel}";${p.totalShifts};${p.totalHours};${p.totalRepasse.toFixed(2)}`;
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Repasses_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-600" /> Faturamento e Repasses Médicos
          </h1>
          <p className="text-sm text-slate-500">
            Valores computados automaticamente a partir das horas e plantões de cada profissional.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-40 bg-white"
          />
          <Button onClick={handleExportCSV} variant="outline" className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
            <FileSpreadsheet className="w-4 h-4" /> Exportar Planilha
          </Button>
        </div>
      </div>

      {/* Cards de Métricas Consolidadas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 border-slate-200 flex items-center gap-4 bg-emerald-50/40 border-emerald-200">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-emerald-700 font-semibold uppercase">Total a Repassar no Mês</div>
            <div className="text-2xl font-black text-emerald-950">
              R$ {totals.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </Card>

        <Card className="p-5 border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Total de Plantões</div>
            <div className="text-2xl font-black text-slate-900">{totals.shifts} turnos</div>
          </div>
        </Card>

        <Card className="p-5 border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Horas Totais Cobertas</div>
            <div className="text-2xl font-black text-slate-900">{totals.hours} horas</div>
          </div>
        </Card>
      </div>

      {/* Tabela Detalhada de Repasses */}
      <Card className="p-5 border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-slate-800">Demonstrativo Individual de Repasses</h3>
            <p className="text-xs text-slate-500">Mês de referência: {selectedMonth}</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Filtrar médico ou setor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
          </div>
        ) : reportByProfessional.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            Nenhum plantão ou repasse registrado para o mês selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">Profissional</th>
                  <th className="py-3 px-4">Especialidade</th>
                  <th className="py-3 px-4">Modelo Remuneração</th>
                  <th className="py-3 px-4 text-center">Plantões</th>
                  <th className="py-3 px-4 text-center">Horas</th>
                  <th className="py-3 px-4 text-right">Repasse Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportByProfessional.map((p) => {
                  const typeBadge =
                    p.remunerationType === 'hora'
                      ? `Horista (R$ ${p.hourlyRate}/h)`
                      : p.remunerationType === 'diaria'
                      ? `Diarista (R$ ${p.dailyRate}/plantão)`
                      : `Fixo (R$ ${p.monthlySalary}/mês)`;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{p.name}</td>
                      <td className="py-3.5 px-4 text-slate-600">{p.specialty}</td>
                      <td className="py-3.5 px-4">
                        <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-semibold">
                          {typeBadge}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800">{p.totalShifts}</td>
                      <td className="py-3.5 px-4 text-center text-slate-600">{p.totalHours}h</td>
                      <td className="py-3.5 px-4 text-right font-black text-emerald-700 text-base">
                        R$ {p.totalRepasse.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}