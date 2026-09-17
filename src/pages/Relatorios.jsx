import React, { useState, useMemo } from 'react';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, TrendingUp, Users, DollarSign, Building2, 
  CalendarDays, Download, FileText, ShieldAlert, CheckCircle2, 
  Activity, Clock, Award, Printer, PieChart, Layers, ArrowUpRight
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

  function getProfMeta(prof) {
    if (!prof) return {};
    try {
      const stored = window.localStorage.getItem(`prof_meta_${prof.id}`);
      if (stored) return JSON.parse(stored);
    } catch {}
    if (prof.data && typeof prof.data === 'object') return prof.data;
    return {};
  }

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

  // Contagem estrita considerando apenas plantões explicitamente vagos ou sem médico
  const totalShiftsCount = filteredShifts.length;
  const filledShiftsCount = filteredShifts.filter(s => {
    const hasProfId = Boolean(s.professional_id);
    const isVagoStatus = s.status === 'vago';
    const isVagoName = (s.professional_name || '').toLowerCase().includes('vaga') || (s.professional_name || '').toLowerCase().includes('descoberto');
    return hasProfId && !isVagoStatus && !isVagoName;
  }).length;

  const vacantShiftsCount = totalShiftsCount - filledShiftsCount;
  const coverageRate = totalShiftsCount > 0 ? Math.round((filledShiftsCount / totalShiftsCount) * 100) : 100;

  const financialSummary = useMemo(() => {
    let executedCost = 0;
    let totalCost = 0;
    const profMap = {};
    (professionals || []).forEach(p => {
      const meta = getProfMeta(p);
      profMap[p.id] = { ...p, ...meta };
      if (p.name) profMap[p.name.toLowerCase().trim()] = { ...p, ...meta };
    });

    filteredShifts.forEach(s => {
      const prof = profMap[s.professional_id] || profMap[(s.professional_name || '').toLowerCase().trim()];
      let cost = 0;
      if (prof) {
        const type = prof.remuneration_type || 'mensal';
        if (type === 'hora') {
          const hours = Number(s.duration_hours) || 12;
          cost = hours * safeNumber(prof.hourly_rate, 120);
        } else if (type === 'diaria') {
          cost = safeNumber(prof.daily_rate, 1500);
        } else {
          cost = safeNumber(prof.monthly_salary, 1672) / 20;
        }
      } else if (s.professional_id && s.status !== 'vago') {
        cost = 1672 / 20;
      }

      totalCost += cost;
      if (s.status === 'concluida' || s.status === 'realizado' || new Date(s.date) <= new Date()) {
        executedCost += cost;
      }
    });

    return { executedCost, totalCost };
  }, [filteredShifts, professionals]);

  const sectorMetrics = useMemo(() => {
    const map = {};
    (sectors || []).forEach(sec => {
      map[sec.id] = { name: toTitleCase(sec.name), total: 0, filled: 0, vacant: 0 };
    });

    filteredShifts.forEach(s => {
      const secId = s.sector_id || 'geral';
      if (!map[secId]) {
        map[secId] = { name: toTitleCase(s.sector_name || 'Setor Geral'), total: 0, filled: 0, vacant: 0 };
      }
      map[secId].total += 1;
      const isFilled = s.professional_id && s.status !== 'vago' && !(s.professional_name || '').toLowerCase().includes('vaga');
      if (isFilled) map[secId].filled += 1;
      else map[secId].vacant += 1;
    });

    return Object.values(map);
  }, [sectors, filteredShifts]);

  const credentialAudit = useMemo(() => {
    let valid = 0;
    let expired = 0;
    let nearExpiry = 0;
    const todayMs = new Date().setHours(0,0,0,0);

    (professionals || []).forEach(p => {
      const meta = getProfMeta(p);
      const expiry = p.document_expiry || meta.document_expiry || '';
      if (!expiry) {
        valid++;
        return;
      }
      const [exY, exM, exD] = expiry.split('-').map(Number);
      const expiryMs = new Date(exY, exM - 1, exD).getTime();
      const diffDays = Math.round((expiryMs - todayMs) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) expired++;
      else if (diffDays <= 30) nearExpiry++;
      else valid++;
    });

    return { valid, expired, nearExpiry, total: (professionals || []).length };
  }, [professionals]);

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans bg-slate-100 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 md:p-8 text-white shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-sky-400">
            <BarChart3 className="w-4 h-4" /> Inteligência Corporativa & BI Hospitalar
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Painel Executivo de Relatórios</h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Indicadores de desempenho assistencial, controle financeiro de honorários, auditoria de credenciais e conformidade de plantões.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button 
            onClick={handlePrintReport} 
            className="h-11 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs px-6 rounded-2xl shadow-lg gap-2 cursor-pointer transition-all hover:scale-105"
          >
            <Printer className="w-4 h-4" /> Exportar / Imprimir Dossiê
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Período de Análise:</span>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-10 w-48 text-xs font-bold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl">
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
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtro por Setor:</span>
          <Select value={selectedSector} onValueChange={setSelectedSector}>
            <SelectTrigger className="h-10 w-56 text-xs font-bold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-900 z-[99999]">
              <SelectItem value="todos">🏥 Todos os Setores (Consolidado)</SelectItem>
              {(sectors || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Volume de Plantões</span>
            <CalendarDays className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">{totalShiftsCount}</div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            <b>{filledShiftsCount}</b> preenchidos · <span className="text-rose-500"><b>{vacantShiftsCount}</b> vagos</span>
          </p>
        </Card>

        <Card className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Taxa de Cobertura Global</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{coverageRate}%</div>
          <p className="text-[11px] text-slate-500 font-medium">Meta hospitalar: &gt; 98%</p>
        </Card>

        <Card className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Custo Orçamentário Total</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">{formatCurrency(financialSummary.totalCost)}</div>
          <p className="text-[11px] text-slate-500 font-medium">Honorários estimados do mês</p>
        </Card>

        <Card className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Compliance de Credenciais</span>
            <ShieldAlert className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {Math.round(((credentialAudit.valid + credentialAudit.nearExpiry) / Math.max(1, credentialAudit.total)) * 100)}%
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            <b>{credentialAudit.expired}</b> vencido(s) · <b>{credentialAudit.nearExpiry}</b> prestes a vencer
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-sky-600" /> Desempenho Operacional por Setor
              </h3>
              <p className="text-xs text-slate-500">Volume de turnos e alocação médica em {MONTH_NAMES[Number(selectedMonth) - 1]}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sectorMetrics.map((sec, idx) => {
              const pct = sec.total > 0 ? Math.round((sec.filled / sec.total) * 100) : 100;
              return (
                <div key={idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <strong className="text-sm font-black text-slate-900 dark:text-white truncate">{sec.name}</strong>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                      pct >= 90 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {pct}% Cobertura
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-600 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                    <span>Alocados: <b>{sec.filled}</b></span>
                    <span>Vagos: <b className={sec.vacant > 0 ? 'text-rose-500' : ''}>{sec.vacant}</b></span>
                    <span>Total: <b>{sec.total}</b></span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-600" /> Governança de Credenciais
              </h3>
            </div>

            <div className="py-4 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Documentos Válidos</span>
                </div>
                <strong className="font-mono text-emerald-700 dark:text-emerald-300">{credentialAudit.valid}</strong>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200">Vencem em até 30 dias</span>
                </div>
                <strong className="font-mono text-amber-700 dark:text-amber-300">{credentialAudit.nearExpiry}</strong>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-xs font-bold text-rose-900 dark:text-rose-200">Credenciais Vencidas</span>
                </div>
                <strong className="font-mono text-rose-600 dark:text-rose-400 font-black">{credentialAudit.expired}</strong>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 space-y-1">
            <strong className="text-slate-900 dark:text-white block font-black">Auditoria Automática CCO - Miguel Deivid</strong>
            <p>Profissionais com credenciais vencidas recebem restrição automática de alocação nas escalas ativas.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}