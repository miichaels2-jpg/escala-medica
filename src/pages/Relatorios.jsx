import React, { useState, useMemo } from 'react';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, TrendingUp, Users, DollarSign, Building2, 
  CalendarDays, Download, FileText, ShieldAlert, CheckCircle2, 
  Activity, Clock, Award, Printer
} from 'lucide-react';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function safeNumber(val, fb = 0) {
  if (val === null || val === undefined || val === '') return fb;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : fb;
}

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeNumber(val));
}

function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function Relatorios() {
  const { shifts = [], sectors = [], professionals = [], company, selectedUnitId } = useAppData();

  const [selectedMonth, setSelectedMonth] = useState(() => String(new Date().getMonth() + 1));
  const [selectedSector, setSelectedSector] = useState('todos');

  const filteredShifts = useMemo(() => {
    const mStr = String(selectedMonth).padStart(2, '0');
    return (shifts || []).filter(s => {
      if (!s || s.status === 'cancelado') return false;
      if (selectedSector !== 'todos' && String(s.sector_id) !== String(selectedSector)) return false;
      const sDate = s.date || '';
      if (sDate && !sDate.includes(`-${mStr}-`)) return false;
      return true;
    });
  }, [shifts, selectedMonth, selectedSector]);

  const totalShiftsCount = filteredShifts.length;
  const filledShiftsCount = filteredShifts.filter(s => s.professional_id && s.status !== 'vago').length;
  const vacantShiftsCount = totalShiftsCount - filledShiftsCount;
  const coverageRate = totalShiftsCount > 0 ? Math.round((filledShiftsCount / totalShiftsCount) * 100) : 100;

  const totalCost = useMemo(() => {
    let sum = 0;
    filteredShifts.forEach(s => {
      if (!s.professional_id) return;
      const hours = Number(s.duration_hours) || 12;
      sum += hours * 120; // Custo médio base por hora padrão
    });
    return sum;
  }, [filteredShifts]);

  const sectorMetrics = useMemo(() => {
    const map = {};
    (sectors || []).forEach(sec => {
      map[sec.id] = { name: toTitleCase(sec.name), total: 0, filled: 0 };
    });

    filteredShifts.forEach(s => {
      const secId = s.sector_id;
      if (!map[secId]) {
        map[secId] = { name: toTitleCase(s.sector_name || 'Setor Geral'), total: 0, filled: 0 };
      }
      map[secId].total += 1;
      if (s.professional_id && s.status !== 'vago') map[secId].filled += 1;
    });

    return Object.values(map);
  }, [sectors, filteredShifts]);

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans bg-slate-100 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      
      {/* HEADER EXECUTIVO */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-sky-400">
            <BarChart3 className="w-4 h-4" /> Inteligência Hospitalar & BI
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Relatórios Gerenciais Avançados</h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Consolidação de carga horária, custos assistenciais, taxas de ocupação e auditoria do corpo clínico.
          </p>
        </div>

        <Button 
          onClick={handlePrintReport} 
          className="h-11 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs px-6 rounded-2xl shadow-lg gap-2 cursor-pointer transition-all hover:scale-105 shrink-0"
        >
          <Printer className="w-4 h-4" /> Imprimir / Exportar Relatório
        </Button>
      </div>

      {/* FILTROS DE BI */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500 uppercase">Mês de Referência:</span>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-10 w-44 text-xs font-bold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-900 z-[99999]">
              {MONTH_NAMES.map((name, idx) => (
                <SelectItem key={idx + 1} value={String(idx + 1)}>{name} 2026</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500 uppercase">Setor:</span>
          <Select value={selectedSector} onValueChange={setSelectedSector}>
            <SelectTrigger className="h-10 w-52 text-xs font-bold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-900 z-[99999]">
              <SelectItem value="todos">🏥 Todos os Setores</SelectItem>
              {(sectors || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* CARDS DE KPI EXECUTIVOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total de Plantões no Mês</span>
          <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">{totalShiftsCount}</div>
          <p className="text-[11px] text-emerald-600 font-semibold"><b>{filledShiftsCount}</b> preenchidos · <b>{vacantShiftsCount}</b> vagos</p>
        </Card>

        <Card className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Taxa Média de Cobertura</span>
          <div className="text-3xl font-black text-sky-600 dark:text-sky-400 font-mono">{coverageRate}%</div>
          <p className="text-[11px] text-slate-500 font-medium">Conformidade da escala assistencial</p>
        </Card>

        <Card className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Custo Operacional Previsto</span>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(totalCost)}</div>
          <p className="text-[11px] text-slate-500 font-medium">Honorários e plantões consolidados</p>
        </Card>

        <Card className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Corpo Clínico Vinculado</span>
          <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 font-mono">{professionals.length}</div>
          <p className="text-[11px] text-slate-500 font-medium">Profissionais ativos na unidade</p>
        </Card>
      </div>

      {/* DESEMPENHO POR SETOR */}
      <Card className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-sky-600" /> Cobertura por Setor ({MONTH_NAMES[Number(selectedMonth) - 1]})
          </h3>
          <span className="text-xs font-mono font-bold text-slate-500">{sectorMetrics.length} setores auditados</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sectorMetrics.map((sec, idx) => {
            const pct = sec.total > 0 ? Math.round((sec.filled / sec.total) * 100) : 100;
            return (
              <div key={idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <strong className="text-sm font-black text-slate-900 dark:text-white">{sec.name}</strong>
                  <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">{pct}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-600 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                  <span>Preenchidos: <b>{sec.filled}</b></span>
                  <span>Total Turnos: <b>{sec.total}</b></span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}