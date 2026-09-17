import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CalendarDays, 
  Users, 
  Clock, 
  Maximize2, 
  Minimize2, 
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
  Activity,
  DollarSign,
  Building2,
  ShieldAlert,
  Radio,
  Plus,
  ArrowUpRight,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

function normalizeStr(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function toTitleCase(str) {
  if (!str) return '';
  const acr = ['UTI', 'UCO', 'PA', 'PS', 'CRM', 'COREN', 'SLA', 'CCO'];
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

function safeNumber(val, fb = 0) {
  if (val === null || val === undefined || val === '') return fb;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : fb;
}

export default function Painel() {
  const { user, company, loading: appLoading, selectedUnitId } = useAppData();
  const navigate = useNavigate();

  const [shifts, setShifts] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tvMode, setTvMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = selectedUnitId || user?.data?.selected_unit_id || company?.selected_unit_id || 'unit_h1';

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

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const todayStr = useMemo(() => getLocalDateString(currentTime), [currentTime]);

  function getProfMeta(prof) {
    if (!prof) return {};
    try {
      const stored = window.localStorage.getItem(`prof_meta_${prof.id}`);
      if (stored) return JSON.parse(stored);
    } catch {}
    if (prof.data && typeof prof.data === 'object') return prof.data;
    return {};
  }

  // Mapeamentos de profissionais com cache financeiro atualizado
  const { profById, profByName } = useMemo(() => {
    const byId = {};
    const byName = {};
    (professionals || []).forEach((p) => {
      const meta = getProfMeta(p);
      const mergedProf = {
        ...p,
        monthly_salary: meta.monthly_salary !== undefined ? meta.monthly_salary : p.monthly_salary,
        hourly_rate: meta.hourly_rate !== undefined ? meta.hourly_rate : p.hourly_rate,
        daily_rate: meta.daily_rate !== undefined ? meta.daily_rate : p.daily_rate,
        remuneration_type: meta.remuneration_type || p.remuneration_type || 'mensal'
      };
      if (p.id) byId[p.id] = mergedProf;
      if (p.name) byName[normalizeStr(p.name)] = mergedProf;
    });
    return { profById: byId, profByName: byName };
  }, [professionals]);

  // Cálculo autônomo do ciclo de vida do plantão (independe de libs externas)
  const todayShifts = useMemo(() => {
    const nowHour = currentTime.getHours();
    const nowMin = currentTime.getMinutes();
    const nowTotalMin = nowHour * 60 + nowMin;

    return (shifts || [])
      .filter((s) => {
        const sDate = (s.date || '').split('T')[0];
        return sDate === todayStr && s.status !== 'cancelado';
      })
      .map((s) => {
        const [startH, startM] = (s.start_time || '07:00').split(':').map(Number);
        const [endH, endM] = (s.end_time || '19:00').split(':').map(Number);
        const startMin = startH * 60 + startM;
        let endMin = endH * 60 + endM;
        if (endMin <= startMin) endMin += 24 * 60; // Vira a noite

        let effNow = nowTotalMin;
        if (endMin > 24 * 60 && nowTotalMin < startMin) effNow += 24 * 60;

        let state = 'upcoming';
        let detail = 'Inicia às ' + s.start_time;

        if (effNow >= startMin && effNow < endMin) {
          state = 'active';
          const left = endMin - effNow;
          detail = `Resta ${Math.floor(left / 60)}h ${left % 60}m`;
        } else if (effNow >= endMin) {
          state = 'concluded';
          detail = 'Concluído às ' + s.end_time;
        }

        return {
          ...s,
          lifecycle: { state, detail }
        };
      })
      .sort((a, b) => {
        const order = { active: 0, upcoming: 1, concluded: 2 };
        return (order[a.lifecycle.state] ?? 99) - (order[b.lifecycle.state] ?? 99);
      });
  }, [shifts, todayStr, currentTime]);

  const activeNowList = useMemo(() => todayShifts.filter((s) => s.lifecycle.state === 'active'), [todayShifts]);
  const upcomingList = useMemo(() => todayShifts.filter((s) => s.lifecycle.state === 'upcoming'), [todayShifts]);
  const concludedList = useMemo(() => todayShifts.filter((s) => s.lifecycle.state === 'concluded'), [todayShifts]);

  const vacantShifts = useMemo(() => {
    return todayShifts.filter((s) => !s.professional_id || s.professional_name?.toLowerCase().includes('vaga') || s.status === 'vago');
  }, [todayShifts]);

  // CUSTO OPERACIONAL EXATO DO DIA (BASE / 20 OU DIÁRIA REAL)
  const todayFinancials = useMemo(() => {
    let executedValue = 0;
    let plannedValue = 0;

    todayShifts.forEach((s) => {
      const prof = profById[s.professional_id] || profByName[normalizeStr(s.professional_name)];
      let shiftCost = 0;

      if (prof) {
        const remType = prof.remuneration_type || 'mensal';
        const salary = safeNumber(prof.monthly_salary, 1672);
        const daily = safeNumber(prof.daily_rate, 0);
        const hourly = safeNumber(prof.hourly_rate, 0);

        if (remType === 'hora') {
          const hours = Number(s.duration_hours) || 12;
          shiftCost = hours * (hourly > 0 ? hourly : (salary / 220));
        } else if (remType === 'diaria') {
          shiftCost = daily > 0 ? daily : (salary / 20);
        } else {
          // Mensalista proporcional à cota de plantões
          shiftCost = salary / 20;
        }
      } else {
        if (s.professional_name && !s.professional_name.toLowerCase().includes('vaga')) {
          shiftCost = 1672 / 20; // Padrão base
        }
      }

      plannedValue += shiftCost;
      if (s.lifecycle.state === 'active' || s.lifecycle.state === 'concluded') {
        executedValue += shiftCost;
      }
    });

    return { executedValue, plannedValue, totalToday: plannedValue };
  }, [todayShifts, profById, profByName]);

  // Capacidade dos Setores
  const sectorsCoverage = useMemo(() => {
    const map = {};
    (sectors || []).forEach((sec) => {
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
      if (!s.professional_id || s.status === 'vago' || s.professional_name?.toLowerCase().includes('vaga')) {
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

    return { targetTime: nextStart, incoming, outgoing };
  }, [upcomingList, activeNowList]);

  const openTvMode = async () => {
    setTvMode(true);
    try { await document.documentElement.requestFullscreen?.(); } catch {}
  };

  const closeTvMode = async () => {
    setTvMode(false);
    if (document.fullscreenElement) await document.exitFullscreen?.();
  };

  // MODO TV CCO
  if (tvMode) {
    const overallFillRate = todayShifts.length > 0 
      ? Math.round(((todayShifts.length - vacantShifts.length) / todayShifts.length) * 100) 
      : 100;

    return (
      <div className="fixed inset-0 z-[99999] bg-slate-950 text-white flex flex-col justify-between p-6 lg:p-8 select-none overflow-hidden font-sans">
        <div className="flex items-center justify-between border-b border-white/10 pb-5 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-xl">
              <Radio className="w-7 h-7 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-sky-400">
                <span>{company?.name || 'Hospital Santa Clara'}</span>
                <span>•</span>
                <span>CCO — Centro de Comando Operacional</span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white mt-0.5">
                Painel Executivo de Situação
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                {fmtDateLong(currentTime)}, {fmtDate(todayStr)} · Visão Geral da Unidade
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2.5 ${
              vacantShifts.length > 0 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' 
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}>
              <div className={`w-3 h-3 rounded-full ${vacantShifts.length > 0 ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
              <div className="text-left">
                <div className="text-xs font-black uppercase tracking-wider">
                  {vacantShifts.length > 0 ? 'Alerta de Cobertura' : 'Operação Estável'}
                </div>
                <div className="text-[10px] opacity-80">
                  {vacantShifts.length > 0 ? `${vacantShifts.length} vaga(s) pendente(s)` : 'Todos os postos cobertos'}
                </div>
              </div>
            </div>

            <div className="bg-white/[0.04] border border-white/10 px-5 py-2.5 rounded-2xl text-right">
              <div className="text-3xl lg:text-4xl font-black font-mono tracking-tight text-sky-300">
                {currentTime.toLocaleTimeString('pt-BR')}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Tempo Real</div>
            </div>

            <button 
              title="Sair da tela cheia" 
              onClick={closeTvMode} 
              className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
            >
              <Minimize2 className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Corpo CCO */}
        <div className="flex-1 my-6 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
          <div className="lg:col-span-2 flex flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-2xl">
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-sky-400">
                  <Building2 className="w-5 h-5" /> Ocupação por Setor Clínico
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/10 text-slate-300">
                  {sectorsCoverage.length} setores monitorados
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[460px] overflow-y-auto pr-1">
                {sectorsCoverage.map((sec) => {
                  const percent = sec.total > 0 ? Math.round((sec.active / sec.total) * 100) : 0;
                  const hasVacant = sec.vacant > 0;

                  return (
                    <div 
                      key={sec.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        hasVacant
                          ? 'border-amber-500/60 bg-amber-950/20 shadow-lg'
                          : sec.active > 0
                          ? 'border-emerald-500/40 bg-emerald-950/10'
                          : 'border-white/10 bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-black text-lg text-white truncate">{sec.name}</h3>
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          hasVacant 
                            ? 'bg-amber-500/20 text-amber-300' 
                            : sec.active > 0 
                            ? 'bg-emerald-500/20 text-emerald-300' 
                            : 'bg-white/10 text-slate-400'
                        }`}>
                          {sec.active} ativo(s)
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400 mt-3 font-medium">
                        <span>Ocupação dos Postos</span>
                        <strong className="text-white font-mono">{sec.active} / {sec.total} turnos</strong>
                      </div>

                      <div className="w-full h-2 bg-white/10 rounded-full mt-2 overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${hasVacant ? 'bg-amber-400' : 'bg-emerald-400'}`}
                          style={{ width: `${Math.min(100, Math.max(10, percent))}%` }}
                        />
                      </div>

                      {hasVacant ? (
                        <div className="text-xs text-amber-400 font-bold mt-2.5 flex items-center gap-1.5 animate-pulse">
                          <AlertTriangle className="w-4 h-4" /> {sec.vacant} posto(s) sem médico
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 mt-2.5 font-medium">
                          {sec.upcoming} plantonista(s) a assumir a seguir
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Taxa de Cobertura Global da Unidade: <b className="text-white text-sm font-mono">{overallFillRate}%</b></span>
              <span className="text-sky-400">Auditoria Contínua CCO</span>
            </div>
          </div>

          {/* Passagem de Turno e Custo Operacional */}
          <div className="flex flex-col justify-between gap-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-sky-400">
                    <ArrowRightLeft className="w-4 h-4" /> Próxima Passagem de Turno
                  </div>
                  {nextHandover && (
                    <span className="text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30">
                      {nextHandover.targetTime}
                    </span>
                  )}
                </div>

                {nextHandover ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                      <span className="text-[10px] uppercase font-bold text-emerald-400 block">
                        Equipe que Assume ({nextHandover.incoming.length})
                      </span>
                      <div className="mt-1.5 space-y-1">
                        {nextHandover.incoming.slice(0, 3).map((s) => (
                          <div key={s.id} className="text-xs flex items-center justify-between">
                            <span className="font-bold text-white truncate max-w-[140px]">{toTitleCase(s.professional_name) || 'Vaga Aberta'}</span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[90px]">{toTitleCase(s.sector_name)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Equipe que Entrega ({nextHandover.outgoing.length})
                      </span>
                      <div className="mt-1.5 space-y-1">
                        {nextHandover.outgoing.length === 0 ? (
                          <span className="text-xs text-slate-500 italic">Nenhum plantão encerrando às {nextHandover.targetTime}.</span>
                        ) : (
                          nextHandover.outgoing.slice(0, 3).map((s) => (
                            <div key={s.id} className="text-xs flex items-center justify-between">
                              <span className="font-medium text-slate-300 truncate max-w-[140px]">{toTitleCase(s.professional_name)}</span>
                              <span className="text-[10px] text-slate-500 truncate max-w-[90px]">{toTitleCase(s.sector_name)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-500">
                    Nenhuma transição de turno pendente para hoje.
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-500 pt-2 border-t border-white/5 flex items-center justify-between">
                <span>Passagem auditada</span>
                <span className="text-sky-400 font-mono">Tempo Real</span>
              </div>
            </div>

            {/* Card Financeiro TV */}
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" /> Custo Operacional do Dia
                </span>
                <span className="text-[10px] font-mono text-slate-400">HOJE</span>
              </div>

              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-2xl font-black font-mono text-white">
                    R$ {todayFinancials.executedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-emerald-400 font-semibold">Executado (Ativos e Concluídos)</span>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold font-mono text-slate-400">
                    R$ {todayFinancials.totalToday.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-slate-500">Previsão 24h</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-3 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 font-bold text-white">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              {activeNowList.length} Médicos Ativos Agora
            </span>
            <span>•</span>
            <span>{todayShifts.length} Plantões no Dia</span>
            <span>•</span>
            <span className={vacantShifts.length > 0 ? 'text-amber-400 font-bold animate-pulse' : 'text-slate-400'}>
              {vacantShifts.length > 0 ? `⚠️ ${vacantShifts.length} Vaga(s) em Aberto` : 'Escala 100% Coberta'}
            </span>
          </div>

          <div className="font-mono text-[11px] text-slate-500">
            ScaleMedic Enterprise CCO · Hospital Santa Clara
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // DASHBOARD EXECUTIVO PRINCIPAL
  // ==========================================
  return (
    <div className="p-4 md:p-8 space-y-6 font-sans">
      {/* BANNER COM COMANDOS RÁPIDOS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 text-white p-6 md:p-8 rounded-3xl border border-slate-800 shadow-2xl">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-sky-400 font-black">
            <Activity className="w-4 h-4" /> Centro de Operações Clínicas & Gestão
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            {company?.name || 'Hospital Santa Clara'}
          </h1>
          <p className="text-xs md:text-sm text-slate-300 font-medium leading-relaxed">
            Monitoramento em tempo real de escalas, cobertura médica hospitalar e custo operacional diário.
          </p>
        </div>

        {/* HUB DE AÇÕES RÁPIDAS */}
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            onClick={() => navigate('/escalas')} 
            className="bg-white text-slate-900 hover:bg-slate-100 font-black text-xs h-10 px-5 rounded-2xl shadow-lg gap-1.5"
          >
            <CalendarDays className="w-4 h-4 text-sky-600" /> Abrir Escalas
          </Button>

          <Button 
            onClick={() => navigate('/faturamento')} 
            variant="outline"
            className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-white font-black text-xs h-10 px-5 rounded-2xl gap-1.5"
          >
            <DollarSign className="w-4 h-4 text-emerald-400" /> Faturamento
          </Button>

          <Button 
            onClick={openTvMode} 
            className="bg-sky-600 hover:bg-sky-500 text-white font-black text-xs h-10 px-5 rounded-2xl shadow-lg gap-2"
          >
            <Radio className="w-4 h-4 animate-pulse" /> Modo TV CCO
          </Button>
        </div>
      </div>

      {/* ALERTA DE COBERTURA */}
      {vacantShifts.length > 0 && (
        <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-600 text-white shrink-0 font-bold shadow-md">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <strong className="text-sm font-black block">Atenção Crítica: {vacantShifts.length} vaga(s) sem plantonista hoje</strong>
              <p className="text-xs opacity-90">
                Setores afetados: {Array.from(new Set(vacantShifts.map((s) => toTitleCase(s.sector_name) || 'Geral'))).join(', ')}.
              </p>
            </div>
          </div>
          <Button 
            onClick={() => navigate('/escalas')}
            size="sm"
            className="bg-rose-600 hover:bg-rose-500 text-white font-black text-xs px-4 h-9 rounded-xl shrink-0"
          >
            Cobrir no Mural
          </Button>
        </div>
      )}

      {/* 4 CARDS EXECUTIVOS DE MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-3xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Ativos no Posto Agora
            </span>
            <span className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm animate-pulse">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-emerald-950 dark:text-emerald-100 mt-3">
            {activeNowList.length} Plantonistas
          </div>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
            Em jornada assistencial ativa na unidade
          </p>
        </Card>

        <Card className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Plantões de Hoje
            </span>
            <span className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <CalendarDays className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
            {todayShifts.length} Turnos
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            {upcomingList.length} a iniciar · {concludedList.length} concluídos
          </p>
        </Card>

        <Card className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Corpo Clínico Ativo
            </span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
            {professionals.length} Credenciados
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Equipe vinculada às escalas
          </p>
        </Card>

        <Card className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Custo Operacional Hoje
            </span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
            R$ {todayFinancials.executedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Previsão do dia: <b>R$ {todayFinancials.totalToday.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
          </p>
        </Card>
      </div>

      {/* PASSAGEM DE TURNO & MONITORAMENTO SETORIAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-sky-600" /> Próxima Passagem de Turno
                </h3>
                <p className="text-xs text-slate-500">Rendimento de postos</p>
              </div>
              {nextHandover && (
                <span className="text-xs font-black px-3 py-1 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-mono">
                  {nextHandover.targetTime}
                </span>
              )}
            </div>

            {nextHandover ? (
              <div className="mt-4 space-y-4">
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 uppercase flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Equipe que Assume ({nextHandover.incoming.length})
                  </div>
                  <div className="mt-2 space-y-2">
                    {nextHandover.incoming.map((s) => (
                      <div key={s.id} className="text-xs flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white truncate">{toTitleCase(s.professional_name) || 'Vaga Aberta'}</span>
                        <span className="text-[10px] text-slate-500 font-semibold">{toTitleCase(s.sector_name) || 'Geral'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-black text-slate-500 uppercase">
                    Equipe que Entrega ({nextHandover.outgoing.length})
                  </div>
                  <div className="mt-2 space-y-2">
                    {nextHandover.outgoing.length === 0 ? (
                      <div className="text-xs text-slate-400 italic">Nenhum plantão encerrando exatamente neste minuto.</div>
                    ) : (
                      nextHandover.outgoing.map((s) => (
                        <div key={s.id} className="text-xs flex items-center justify-between">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{toTitleCase(s.professional_name)}</span>
                          <span className="text-[10px] text-slate-400">{toTitleCase(s.sector_name) || 'Geral'}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                Nenhuma passagem de plantão programada para as próximas 2 horas.
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Passagens auditadas em tempo real</span>
            <span className="font-black text-sky-600">ScaleMedic Cockpit</span>
          </div>
        </Card>

        {/* COBERTURA POR SETOR CLÍNICO */}
        <Card className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" /> Ocupação por Setor Clínico
              </h3>
              <p className="text-xs text-slate-500">Capacidade operacional instalada e status hoje</p>
            </div>
            <span className="text-xs font-black px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {sectorsCoverage.length} setores ativos
            </span>
          </div>

          {sectorsCoverage.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Nenhum setor cadastrado ou com escala vinculada.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {sectorsCoverage.map((sec) => {
                const percent = sec.total > 0 ? Math.round((sec.active / sec.total) * 100) : 0;
                const hasVacant = sec.vacant > 0;

                return (
                  <div 
                    key={sec.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      hasVacant
                        ? 'border-amber-300 bg-amber-50/40 dark:bg-amber-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {sec.name}
                      </strong>
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                        sec.active > 0 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {sec.active} ativo(s)
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 mt-2.5 font-medium">
                      <span>Ocupação do setor</span>
                      <span className="font-bold text-slate-900 dark:text-white">{sec.active} / {sec.total} turnos</span>
                    </div>

                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${hasVacant ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, Math.max(10, percent))}%` }}
                      />
                    </div>

                    {hasVacant && (
                      <div className="text-[10px] text-amber-700 dark:text-amber-400 font-bold mt-2.5 flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5" /> {sec.vacant} vaga(s) sem plantonista
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* PLANTÕES DO DIA COM STATUS CLARO */}
      <Card className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-black text-base text-slate-900 dark:text-white">Plantões em Operação Hoje</h3>
            <p className="text-xs text-slate-500">Escala de {fmtDate(todayStr)} (Ativos agora, programados e concluídos)</p>
          </div>
          <span className="text-xs font-black px-3 py-1 rounded-full bg-sky-50 text-sky-700">
            {todayShifts.length} turno(s)
          </span>
        </div>

        {todayShifts.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            Nenhum plantão ativo ou agendado para a data de hoje.
          </div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {todayShifts.map((shift) => {
              const state = shift.lifecycle.state;
              const isActive = state === 'active';
              const isFinished = state === 'concluded';

              return (
                <div
                  key={shift.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isActive 
                      ? 'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20 shadow-sm ring-1 ring-emerald-400/40' 
                      : isFinished
                      ? 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/40 opacity-70'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold font-mono text-slate-600 dark:text-slate-300">
                      {shift.start_time} às {shift.end_time}
                    </span>
                    <span
                      className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                        isActive
                          ? 'bg-emerald-600 text-white animate-pulse'
                          : isFinished
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                      }`}
                    >
                      {isActive ? '● Ativo no Plantão' : isFinished ? '✓ Concluído' : '⏳ Programado'}
                    </span>
                  </div>

                  <div className="font-black text-sm text-slate-900 dark:text-white truncate">
                    {toTitleCase(shift.professional_name) || 'Vaga em Aberto'}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                    <span className="truncate">{toTitleCase(shift.sector_name) || 'Setor Geral'}</span>
                    <span className="text-[10px] font-semibold text-slate-400">{shift.lifecycle.detail}</span>
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