import { useEffect, useState, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CalendarDays, 
  Users, 
  Clock, 
  Layers, 
  Maximize2, 
  Minimize2, 
  Clock3, 
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
  Activity,
  DollarSign,
  Building2,
  ShieldAlert
} from 'lucide-react';
import { getShiftTvLifecycle, getShiftInterval } from '@/lib/shiftUtils';

const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const cleanDate = dateStr.split('T')[0];
  const [year, month, day] = cleanDate.split('-');
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  const weekday = WEEKDAYS_SHORT[d.getDay()] || '';
  return `${day}/${month} (${weekday})`;
}

function fmtDateLong(d = new Date()) {
  return WEEKDAYS_LONG[d.getDay()] || '';
}

// Formata texto para Title Case elegante (Ex: "UTI ADULTO" -> "UTI Adulto")
function toTitleCase(str) {
  if (!str) return '';
  // Preserva siglas médicas comuns em maiúsculo
  const acr = ['UTI', 'UCO', 'PA', 'PS', 'CRM', 'COREN', 'SLA'];
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => {
      const upper = word.toUpperCase();
      if (acr.includes(upper)) return upper;
      if (['de', 'da', 'do', 'das', 'dos', 'e'].includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export default function Painel() {
  const { user, company, loading: appLoading } = useAppData();
  const [shifts, setShifts] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tvMode, setTvMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id || 'unit_h1';

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const f = { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) };
      const [s, sec, p] = await Promise.all([
        base44.entities.Shift.filter(f, '-date', 1000),
        base44.entities.Sector.filter(f, '-created_date', 100),
        base44.entities.Professional.filter(f, '-created_date', 400),
      ]);
      setShifts(s || []);
      setSectors(sec || []);
      setProfessionals(p || []);
    } catch (e) {
      console.error('Erro ao carregar dados do painel:', e);
    } finally {
      setLoading(false);
    }
  }, [companyId, unitId]);

  useEffect(() => {
    if (appLoading) return;
    loadData();
  }, [appLoading, loadData]);

  // Atualizador em tempo real para TV e status de plantões
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const todayStr = useMemo(() => getLocalDateString(currentTime), [currentTime]);
  const currentMonthKey = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  // Mapa de profissionais
  const profMap = useMemo(() => {
    return Object.fromEntries((professionals || []).map((p) => [p.id, p]));
  }, [professionals]);

  // Contagem de plantões de cada profissional no mês para cálculo seguro de mensalistas
  const monthlyShiftsCountByProf = useMemo(() => {
    const counts = {};
    shifts.forEach((s) => {
      const sDate = (s.date || '').slice(0, 7);
      if (sDate === currentMonthKey && s.status !== 'cancelado' && s.professional_id) {
        counts[s.professional_id] = (counts[s.professional_id] || 0) + 1;
      }
    });
    return counts;
  }, [shifts, currentMonthKey]);

  // Plantões do dia com inteligência de status
  const todayShifts = useMemo(() => {
    return shifts
      .filter((s) => {
        const sDate = (s.date || '').split('T')[0];
        return sDate === todayStr && s.status !== 'cancelado';
      })
      .map((s) => ({
        ...s,
        lifecycle: getShiftTvLifecycle(s, currentTime)
      }))
      .filter((s) => s.lifecycle.state !== 'expired')
      .sort((a, b) => {
        const order = { active: 0, upcoming: 1, recently_finished: 2 };
        return (order[a.lifecycle.state] ?? 99) - (order[b.lifecycle.state] ?? 99);
      });
  }, [shifts, todayStr, currentTime]);

  // Categorização de status
  const activeNowList = useMemo(() => todayShifts.filter((s) => s.lifecycle.state === 'active'), [todayShifts]);
  const upcomingList = useMemo(() => todayShifts.filter((s) => s.lifecycle.state === 'upcoming'), [todayShifts]);
  const recentlyFinishedList = useMemo(() => todayShifts.filter((s) => s.lifecycle.state === 'recently_finished'), [todayShifts]);

  // Vagas Descobertas
  const vacantShifts = useMemo(() => {
    return todayShifts.filter((s) => !s.professional_id || s.professional_name?.toLowerCase().includes('vaga') || s.status === 'pendente');
  }, [todayShifts]);

  // CÁLCULO FINANCEIRO REAL E CONFIÁVEL DO DIA
  const todayFinancials = useMemo(() => {
    let executedValue = 0;
    let plannedValue = 0;

    todayShifts.forEach((s) => {
      const p = profMap[s.professional_id];
      const hours = Number(s.duration_hours) || 12;
      let shiftCost = 0;

      if (p) {
        const remType = p.remuneration_type || 'hora';
        if (remType === 'hora') {
          shiftCost = hours * (Number(p.hourly_rate) || 0);
        } else if (remType === 'diaria') {
          shiftCost = Number(p.daily_rate) || 0;
        } else if (remType === 'mensal') {
          const totalMonthPlanned = monthlyShiftsCountByProf[p.id] || 1;
          shiftCost = (Number(p.monthly_salary) || 0) / (totalMonthPlanned > 0 ? totalMonthPlanned : 1);
        }
      }

      // Soma na previsão geral do dia
      plannedValue += shiftCost;

      // Soma no valor já realizado/em execução
      if (s.lifecycle.state === 'active' || s.lifecycle.state === 'recently_finished') {
        executedValue += shiftCost;
      }
    });

    return { executedValue, plannedValue, totalToday: plannedValue };
  }, [todayShifts, profMap, monthlyShiftsCountByProf]);

  // Cobertura de Setores
  const sectorsCoverage = useMemo(() => {
    const map = {};
    sectors.forEach((sec) => {
      map[sec.id] = {
        id: sec.id,
        name: toTitleCase(sec.name),
        specialty: sec.specialty || 'Geral',
        total: 0,
        active: 0,
        upcoming: 0,
        vacant: 0
      };
    });

    todayShifts.forEach((s) => {
      const secId = s.sector_id || 'sem_setor';
      if (!map[secId]) {
        map[secId] = {
          id: secId,
          name: toTitleCase(s.sector_name || 'Setor Geral'),
          specialty: 'Geral',
          total: 0,
          active: 0,
          upcoming: 0,
          vacant: 0
        };
      }
      map[secId].total += 1;
      if (s.lifecycle.state === 'active') map[secId].active += 1;
      if (s.lifecycle.state === 'upcoming') map[secId].upcoming += 1;
      if (!s.professional_id || s.professional_name?.toLowerCase().includes('vaga')) {
        map[secId].vacant += 1;
      }
    });

    return Object.values(map).filter((sec) => sec.total > 0 || sectors.some((s) => s.id === sec.id));
  }, [sectors, todayShifts]);

  // Próxima Passagem de Turno
  const nextHandover = useMemo(() => {
    if (upcomingList.length === 0) return null;
    const nextStart = upcomingList[0].start_time;
    const incoming = upcomingList.filter((s) => s.start_time === nextStart);
    const outgoing = activeNowList.filter((s) => s.end_time === nextStart);

    return {
      targetTime: nextStart,
      incoming,
      outgoing
    };
  }, [upcomingList, activeNowList]);

  const openTvMode = async () => {
    setTvMode(true);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {}
  };

  const closeTvMode = async () => {
    setTvMode(false);
    if (document.fullscreenElement) await document.exitFullscreen?.();
  };

  // ==========================================
  // MODO TV (RELOGIO EXCLUSIVO DE TELA CHEIA)
  // ==========================================
  if (tvMode) {
    return (
      <div className="min-h-full bg-slate-950 p-5 text-white md:p-8 select-none">
        <div className="mx-auto max-w-[1800px]">
          <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">
                <CalendarDays className="h-5 w-5" /> Painel Operacional Hospitalar
              </div>
              <h1 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">
                {fmtDateLong(currentTime)}
              </h1>
              <p className="mt-1 text-lg text-slate-400">
                {fmtDate(todayStr)} · {todayShifts.length} plantões na operação · {activeNowList.length} ativos neste instante
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="flex items-center justify-end gap-2 text-3xl font-black tabular-nums md:text-5xl text-sky-400">
                  <Clock3 className="h-7 w-7" />
                  {currentTime.toLocaleTimeString('pt-BR')}
                </div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Horário Oficial Local</div>
              </div>
              <button title="Fechar modo TV" onClick={closeTvMode} className="rounded-xl border border-white/15 p-3 text-slate-300 hover:bg-white/10 transition-colors">
                <Minimize2 className="h-5 w-5" />
              </button>
            </div>
          </div>

          {todayShifts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-16 text-center text-xl text-slate-400">
              Nenhum plantão agendado para as próximas horas.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {todayShifts.map((shift) => {
                const state = shift.lifecycle.state;
                const isActive = state === 'active';
                const isFinished = state === 'recently_finished';

                return (
                  <div
                    key={shift.id}
                    className={`rounded-2xl border p-5 shadow-xl transition-all duration-500 ${
                      isActive
                        ? 'border-emerald-500/60 bg-emerald-950/30 shadow-emerald-950/40 scale-[1.01]'
                        : isFinished
                        ? 'border-slate-800 bg-white/[0.03] opacity-60'
                        : 'border-white/10 bg-white/[0.07]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className={`rounded-xl px-3 py-2 text-center text-base font-black ${
                        isActive 
                          ? 'bg-emerald-500 text-slate-950' 
                          : isFinished
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      }`}>
                        <div>{shift.start_time || '--:--'}</div>
                        <div className="text-[11px] font-normal opacity-80">até {shift.end_time || '--:--'}</div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                              : isFinished
                              ? 'bg-slate-800 text-slate-400 border border-slate-700'
                              : 'bg-white/10 text-slate-300'
                          }`}
                        >
                          {isActive && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
                          {isActive ? '● Ativo no Plantão' : isFinished ? '✓ Plantão Concluído' : '⏳ Programado'}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1">{shift.lifecycle.detail}</div>
                      </div>
                    </div>

                    <div className="mt-5 truncate text-2xl font-black text-white">{toTitleCase(shift.professional_name) || 'Vaga Aberta'}</div>
                    <div className="mt-2 flex items-center gap-2 text-base text-slate-300">
                      <Stethoscope className={`h-4 w-4 ${isActive ? 'text-emerald-400' : 'text-sky-400'}`} />
                      {toTitleCase(shift.sector_name) || 'Setor Geral'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // PAINEL DE CONTROLE EXECUTIVO
  // ==========================================
  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header Cockpit (Sem relógio duplicado) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 text-white p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-sky-400 font-bold">
            <Activity className="w-4 h-4" /> Centro de Operações Clínicas
          </div>
          <h1 className="text-2xl md:text-3xl font-black mt-2 tracking-tight">Painel Operacional Hospitalar</h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl">
            Acompanhamento contínuo de presença médica, transições de turno e alocação setorial.
          </p>
        </div>

        <div>
          <Button onClick={openTvMode} className="bg-sky-600 hover:bg-sky-500 text-white font-bold gap-2 text-xs h-10 px-5 rounded-xl shadow-lg shadow-sky-950">
            <Maximize2 className="w-4 h-4" /> Modo TV
          </Button>
        </div>
      </div>

      {/* Alerta de Desfalques / Risco de Vagas */}
      {vacantShifts.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 shrink-0 font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <strong className="text-sm font-black block">Atenção: {vacantShifts.length} vaga(s) com risco de cobertura hoje</strong>
              <p className="text-xs opacity-90">
                Setores afetados: {Array.from(new Set(vacantShifts.map((s) => toTitleCase(s.sector_name) || 'Geral'))).join(', ')}.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold uppercase px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-lg shrink-0">
            Ação Recomendada: Alocar Retaguarda
          </span>
        </div>
      )}

      {/* 4 Cards de Métricas com Custo Operacional Real */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Ativos no Plantão Agora
            </span>
            <span className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm animate-pulse">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-black text-emerald-950 dark:text-emerald-100 mt-3">
            {activeNowList.length} profissionais
          </div>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
            Em jornada presencial ativa na unidade
          </p>
        </Card>

        <Card className="p-5 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Plantões de Hoje
            </span>
            <span className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <CalendarDays className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-3">
            {todayShifts.length} turnos
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {upcomingList.length} programados · {recentlyFinishedList.length} recém-concluídos
          </p>
        </Card>

        <Card className="p-5 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Corpo Clínico Ativo
            </span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-3">
            {professionals.length} cadastrados
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Profissionais vinculados a escalas
          </p>
        </Card>

        {/* Card de Custo Real: Executado vs Previsão Total */}
        <Card className="p-5 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Custo Operacional Hoje
            </span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-3">
            R$ {todayFinancials.executedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Previsão total do dia: <b>R$ {todayFinancials.totalToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b>
          </p>
        </Card>
      </div>

      {/* Passagem de Turno + Termômetro de Cobertura */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Passagem de Turno */}
        <Card className="p-5 border-slate-200 dark:border-slate-800 lg:col-span-1 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4 text-sky-600" /> Passagem de Plantão
                </h3>
                <p className="text-xs text-slate-500">Próxima transição de escala</p>
              </div>
              {nextHandover && (
                <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-sky-100 text-sky-800 font-mono">
                  {nextHandover.targetTime}
                </span>
              )}
            </div>

            {nextHandover ? (
              <div className="mt-4 space-y-4">
                <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Equipe que Assume ({nextHandover.incoming.length})
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {nextHandover.incoming.map((s) => (
                      <div key={s.id} className="text-xs flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white truncate">{toTitleCase(s.professional_name) || 'Vaga Aberta'}</span>
                        <span className="text-[10px] text-slate-500 shrink-0 font-medium">{toTitleCase(s.sector_name) || 'Geral'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">
                    Equipe que Entrega ({nextHandover.outgoing.length})
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {nextHandover.outgoing.length === 0 ? (
                      <div className="text-xs text-slate-400 italic">Nenhum plantão encerrando exatamente neste minuto.</div>
                    ) : (
                      nextHandover.outgoing.map((s) => (
                        <div key={s.id} className="text-xs flex items-center justify-between">
                          <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{toTitleCase(s.professional_name)}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">{toTitleCase(s.sector_name) || 'Geral'}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-slate-400">
                Nenhuma passagem de turno pendente para hoje.
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Passagens auditadas em tempo real</span>
            <span className="font-bold text-sky-600">ScaleMedic Cockpit</span>
          </div>
        </Card>

        {/* Termômetro por Setor */}
        <Card className="p-5 border-slate-200 dark:border-slate-800 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-600" /> Cobertura por Setor Clínico
              </h3>
              <p className="text-xs text-slate-500">Capacidade operacional instalada e ocupação hoje</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {sectorsCoverage.length} setores ativos
            </span>
          </div>

          {sectorsCoverage.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Nenhum setor cadastrado ou com escala vinculada.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sectorsCoverage.map((sec) => {
                const percent = sec.total > 0 ? Math.round((sec.active / sec.total) * 100) : 0;
                const hasVacant = sec.vacant > 0;

                return (
                  <div 
                    key={sec.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      hasVacant
                        ? 'border-amber-300 bg-amber-50/40 dark:bg-amber-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {sec.name}
                      </strong>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        sec.active > 0 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {sec.active} ativo(s)
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                      <span>Ocupação do setor</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{sec.active} / {sec.total} turnos</span>
                    </div>

                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${hasVacant ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, Math.max(10, percent))}%` }}
                      />
                    </div>

                    {hasVacant && (
                      <div className="text-[10px] text-amber-700 dark:text-amber-400 font-bold mt-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {sec.vacant} vaga(s) com desfalque
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Lista de Plantões do Dia */}
      <Card className="p-5 border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Plantões em Operação Hoje</h3>
            <p className="text-xs text-slate-500">Escala de {fmtDate(todayStr)} (Ativos no momento, programados e recém-concluídos)</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700">
            {todayShifts.length} turno(s) no total
          </span>
        </div>

        {todayShifts.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            Nenhum plantão ativo ou agendado para a data de hoje.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {todayShifts.map((shift) => {
              const state = shift.lifecycle.state;
              const isActive = state === 'active';
              const isFinished = state === 'recently_finished';

              return (
                <div
                  key={shift.id}
                  className={`p-4 rounded-xl border transition-all duration-300 ${
                    isActive 
                      ? 'border-emerald-300 bg-emerald-50/70 shadow-sm' 
                      : isFinished
                      ? 'border-slate-200 bg-slate-100/60 opacity-75'
                      : 'border-slate-200 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {shift.start_time} às {shift.end_time}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                        isActive
                          ? 'bg-emerald-600 text-white animate-pulse'
                          : isFinished
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {isActive ? '● Ativo no Plantão' : isFinished ? '✓ Concluído' : '⏳ Programado'}
                    </span>
                  </div>

                  <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {toTitleCase(shift.professional_name) || 'Vaga Aberta'}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                    <span className="truncate">{toTitleCase(shift.sector_name) || 'Setor Geral'}</span>
                    <span className="text-[10px] text-slate-400">{shift.lifecycle.detail}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}