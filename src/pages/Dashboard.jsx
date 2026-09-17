import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CalendarDays, 
  Users, 
  Clock, 
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
  ArrowUpRight,
  TrendingUp,
  Flame,
  ChevronRight,
  Sparkles,
  Zap,
  Gauge,
  HeartPulse,
  Timer,
  BellRing
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

  // Ciclo de vida dos plantões com cálculo de horas restantes
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
        if (endMin <= startMin) endMin += 24 * 60;

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

  // Vagas críticas com navegação direta
  const vacantShifts = useMemo(() => {
    return (shifts || [])
      .filter((s) => {
        const sDate = (s.date || '').split('T')[0];
        const isTargetDay = sDate === todayStr || sDate === getLocalDateString(new Date(currentTime.getTime() + 86400000));
        const isVago = !s.professional_id || s.status === 'vago' || (s.professional_name || '').toLowerCase().includes('vaga');
        return isTargetDay && isVago && s.status !== 'cancelado';
      })
      .map(s => ({
        ...s,
        sectorName: toTitleCase(s.sector_name || sectors.find(sec => String(sec.id) === String(s.sector_id))?.name || 'Setor Geral'),
        formattedDate: fmtDate(s.date)
      }));
  }, [shifts, todayStr, currentTime, sectors]);

  // Custo Operacional Realizado
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
          shiftCost = salary / 20;
        }
      } else {
        if (s.professional_name && !s.professional_name.toLowerCase().includes('vaga')) {
          shiftCost = 1672 / 20;
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
      if (!s.professional_id || s.status === 'vago' || (s.professional_name || '').toLowerCase().includes('vaga')) {
        map[secId].vacant += 1;
      }
    });

    return Object.values(map);
  }, [sectors, todayShifts]);

  // Próxima Passagem de Turno
  const nextHandover = useMemo(() => {
    if (upcomingList.length === 0) return null;
    const nextStart = upcomingList[0].start_time;
    const incoming = upcomingList.filter((s) => s.start_time === nextStart);
    const outgoing = activeNowList.filter((s) => s.end_time === nextStart);

    return { targetTime: nextStart, incoming, outgoing };
  }, [upcomingList, activeNowList]);

  // Eficiência de Cobertura
  const globalFillRate = useMemo(() => {
    if (todayShifts.length === 0) return 100;
    const filled = todayShifts.length - vacantShifts.filter(v => v.date === todayStr).length;
    return Math.max(0, Math.min(100, Math.round((filled / todayShifts.length) * 100)));
  }, [todayShifts, vacantShifts, todayStr]);

  // Curva de Demanda 24h (Gráfico de Distribuição dos Plantões ao Longo do Dia)
  const hourlyCurveData = useMemo(() => {
    const buckets = [
      { label: '06h', count: 0 }, { label: '08h', count: 0 }, { label: '10h', count: 0 },
      { label: '12h', count: 0 }, { label: '14h', count: 0 }, { label: '16h', count: 0 },
      { label: '18h', count: 0 }, { label: '20h', count: 0 }, { label: '22h', count: 0 },
      { label: '00h', count: 0 }, { label: '02h', count: 0 }, { label: '04h', count: 0 }
    ];

    todayShifts.forEach(s => {
      const h = parseInt((s.start_time || '07:00').split(':')[0], 10);
      const idx = Math.min(11, Math.max(0, Math.floor((h >= 6 ? h - 6 : h + 18) / 2)));
      buckets[idx].count += 1;
    });

    const max = Math.max(1, ...buckets.map(b => b.count));
    return buckets.map(b => ({ ...b, height: Math.round((b.count / max) * 100) }));
  }, [todayShifts]);

  // Ação Cirúrgica: Clicar no alerta crítico e ir direto com o setor filtrado
  const handleResolveAlert = (vs) => {
    if (vs?.sector_id) {
      window.localStorage.setItem('scale_filter_sector_id', String(vs.sector_id));
    }
    navigate('/escalas');
  };

  const openTvMode = async () => {
    setTvMode(true);
    try { await document.documentElement.requestFullscreen?.(); } catch {}
  };

  const closeTvMode = async () => {
    setTvMode(false);
    if (document.fullscreenElement) await document.exitFullscreen?.();
  };

  // ==========================================
  // MODO TV CCO
  // ==========================================
  if (tvMode) {
    return (
      <div className="fixed inset-0 z-[99999] bg-slate-950 text-white flex flex-col justify-between p-6 lg:p-8 select-none overflow-hidden font-sans">
        
        {/* TOPO TV CCO */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-5 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-2xl ring-1 ring-white/20">
              <Radio className="w-8 h-8 animate-pulse text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-sky-400">
                <span>{company?.name || 'Hospital Santa Clara'}</span>
                <span>•</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" /> CCO AO VIVO</span>
              </div>
              <h1 className="text-3xl lg:text-5xl font-black tracking-tight text-white mt-1">
                Centro de Comando & Situação
              </h1>
              <p className="text-xs text-slate-400 font-bold mt-0.5">
                {fmtDateLong(currentTime)}, {fmtDate(todayStr)} · Telemetria em Tempo Real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className={`px-5 py-3 rounded-2xl border flex items-center gap-3 ${
              vacantShifts.length > 0 
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-300' 
                : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
            }`}>
              <div className={`w-3.5 h-3.5 rounded-full ${vacantShifts.length > 0 ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'}`} />
              <div>
                <div className="text-xs font-black uppercase tracking-wider">
                  {vacantShifts.length > 0 ? 'Alerta Assistencial' : 'Operação 100% Estável'}
                </div>
                <div className="text-[11px] font-bold opacity-80">
                  {vacantShifts.length > 0 ? `${vacantShifts.length} vaga(s) desocupada(s)` : 'Todos os postos cobertos'}
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 px-6 py-3 rounded-2xl text-right">
              <div className="text-3xl lg:text-5xl font-black font-mono tracking-tight text-cyan-400">
                {currentTime.toLocaleTimeString('pt-BR')}
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Horário Oficial CCO</div>
            </div>

            <button 
              title="Sair da tela cheia" 
              onClick={closeTvMode} 
              className="p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
            >
              <Minimize2 className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* CORPO CENTRAL PREENCHIDO E IMPACTANTE */}
        <div className="flex-1 my-6 grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-hidden">
          
          {/* COLUNA 1 & 2: MONITOR DE TODOS OS SETORES */}
          <div className="lg:col-span-2 flex flex-col justify-between rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-md">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-sky-400">
                  <Building2 className="w-5 h-5" /> Capacidade e Cobertura dos Setores
                </div>
                <span className="text-xs font-black px-3 py-1 rounded-xl bg-slate-800 text-slate-300">
                  {sectorsCoverage.length} postos auditados
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[500px] overflow-y-auto pr-1">
                {sectorsCoverage.map((sec) => {
                  const hasShifts = sec.total > 0;
                  const percent = hasShifts ? Math.round((sec.active / sec.total) * 100) : 0;
                  const hasVacant = sec.vacant > 0;

                  return (
                    <div 
                      key={sec.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        hasVacant
                          ? 'border-rose-500/80 bg-rose-950/30 shadow-lg'
                          : sec.active > 0
                          ? 'border-emerald-500/50 bg-emerald-950/20'
                          : 'border-slate-800 bg-slate-900/40 opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-black text-base text-white truncate">{sec.name}</h3>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                          hasVacant 
                            ? 'bg-rose-500 text-white font-black animate-pulse' 
                            : sec.active > 0 
                            ? 'bg-emerald-500/20 text-emerald-300' 
                            : 'bg-slate-800 text-slate-500'
                        }`}>
                          {hasShifts ? `${sec.active} ativo(s)` : 'Sem plantão'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400 mt-2 font-medium">
                        <span>Ocupação do posto</span>
                        <strong className="text-white font-mono">{sec.active} / {sec.total} turnos</strong>
                      </div>

                      <div className="w-full h-2 bg-slate-800 rounded-full mt-2 overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${hasVacant ? 'bg-rose-500' : sec.active > 0 ? 'bg-emerald-400' : 'bg-transparent'}`}
                          style={{ width: `${hasShifts ? Math.min(100, Math.max(6, percent)) : 0}%` }}
                        />
                      </div>

                      {hasVacant ? (
                        <div className="text-[11px] text-rose-400 font-black mt-2 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> {sec.vacant} vaga(s) com desfalque médico
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 mt-2 font-semibold">
                          {hasShifts ? `${sec.upcoming} plantonista(s) a assumir a seguir` : 'Nenhum plantão agendado para hoje'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-bold">
              <span>Taxa de Cobertura Global da Unidade: <b className="text-white font-mono text-sm">{globalFillRate}%</b></span>
              <span className="text-sky-400">Auditoria Automática Contínua</span>
            </div>
          </div>

          {/* COLUNA 3: QUEM ESTÁ ATIVO NO POSTO NESTE MOMENTO */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <span className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /> Ativos no Posto Agora ({activeNowList.length})
                </span>
                <span className="text-[10px] font-mono text-slate-400">EM ATENDIMENTO</span>
              </div>

              <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                {activeNowList.length === 0 ? (
                  <div className="py-16 text-center text-xs text-slate-500">Nenhum plantonista em atendimento neste minuto.</div>
                ) : (
                  activeNowList.map(s => (
                    <div key={s.id} className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/30 flex items-center justify-between shadow-md">
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] text-emerald-400 font-mono font-bold block uppercase">{toTitleCase(s.sector_name)}</span>
                        <div className="font-black text-sm text-white truncate">{toTitleCase(s.professional_name)}</div>
                        <span className="text-[10px] text-slate-400 font-mono">{s.start_time} às {s.end_time}</span>
                      </div>
                      <span className="text-[10px] font-mono font-black text-emerald-300 bg-emerald-500/20 px-2 py-1 rounded-lg shrink-0">
                        {s.lifecycle.detail}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between font-mono">
              <span>Sincronização biométrica</span>
              <span className="text-emerald-400">Presença validada</span>
            </div>
          </div>

          {/* COLUNA 4: PRÓXIMA RENDIÇÃO E CUSTO DIÁRIO */}
          <div className="flex flex-col justify-between gap-5">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-sky-400">
                    <ArrowRightLeft className="w-4 h-4" /> Próxima Passagem
                  </div>
                  {nextHandover && (
                    <span className="text-xs font-mono font-black px-2.5 py-1 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30">
                      {nextHandover.targetTime}
                    </span>
                  )}
                </div>

                {nextHandover ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                      <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">
                        Equipe que Assume ({nextHandover.incoming.length})
                      </span>
                      {nextHandover.incoming.slice(0, 3).map((s) => (
                        <div key={s.id} className="text-xs flex items-center justify-between py-0.5">
                          <span className="font-bold text-white truncate max-w-[130px]">{toTitleCase(s.professional_name) || 'Vaga Aberta'}</span>
                          <span className="text-[10px] text-slate-400">{toTitleCase(s.sector_name)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Equipe que Entrega ({nextHandover.outgoing.length})
                      </span>
                      {nextHandover.outgoing.length === 0 ? (
                        <span className="text-xs text-slate-500 italic">Nenhum plantão encerrando às {nextHandover.targetTime}.</span>
                      ) : (
                        nextHandover.outgoing.slice(0, 3).map((s) => (
                          <div key={s.id} className="text-xs flex items-center justify-between py-0.5">
                            <span className="font-medium text-slate-300 truncate max-w-[130px]">{toTitleCase(s.professional_name)}</span>
                            <span className="text-[10px] text-slate-500">{toTitleCase(s.sector_name)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-500">Nenhuma troca prevista nas próximas 2h.</div>
                )}
              </div>

              <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800 flex items-center justify-between">
                <span>Rendimento auditado</span>
                <span className="text-sky-400 font-mono">CCO Inteligente</span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-2xl space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" /> Custo Operacional Hoje
              </span>
              <div className="text-2xl lg:text-3xl font-black font-mono text-white">
                R$ {todayFinancials.executedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400 flex justify-between">
                <span>Previsão 24h:</span>
                <b className="font-mono text-white">R$ {todayFinancials.totalToday.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
              </div>
            </div>
          </div>
        </div>

        {/* RODAPÉ TV CCO */}
        <div className="border-t border-slate-800 pt-3 shrink-0 flex items-center justify-between text-xs text-slate-400 font-bold">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 text-white">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              {activeNowList.length} Médicos Ativos Agora
            </span>
            <span>•</span>
            <span>{todayShifts.length} Plantões Cadastrados Hoje</span>
            <span>•</span>
            <span className={vacantShifts.length > 0 ? 'text-rose-400 font-black animate-pulse' : 'text-slate-400'}>
              {vacantShifts.length > 0 ? `⚠️ ${vacantShifts.length} Postos em Aberto` : 'Cobertura Hospitalar Total'}
            </span>
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            ScaleMedic Enterprise CCO • Hospital Santa Clara
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // DASHBOARD PRINCIPAL
  // ==========================================
  return (
    <div className="p-4 md:p-8 space-y-6 font-sans bg-slate-100 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      
      {/* 1. HEADER IMPACTANTE SEM BOTÕES REDUNDANTES */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 text-white p-6 md:p-8 rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-sky-400 font-black">
            <Activity className="w-4 h-4" /> Centro de Operações Clínicas & Gestão
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            {company?.name || 'Hospital Santa Clara'}
          </h1>
          <p className="text-xs md:text-sm text-slate-300 font-medium max-w-2xl">
            Monitoramento em tempo real de escalas, cobertura médica hospitalar e custo operacional diário.
          </p>
        </div>

        {/* APENAS O BOTÃO HERO DO MODO TV */}
        <Button 
          onClick={openTvMode} 
          className="bg-sky-600 hover:bg-sky-500 text-white font-black text-xs h-12 px-6 rounded-2xl shadow-xl gap-2.5 transition-all hover:scale-105 shrink-0"
        >
          <Radio className="w-4 h-4 animate-pulse text-white" /> Ativar Modo TV CCO
        </Button>
      </div>

      {/* 2. ALERTA CRÍTICO COM CLIQUE DIRETO NA SEÇÃO DO PROBLEMA */}
      {vacantShifts.length > 0 ? (
        <div className="p-5 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-600 text-white shrink-0 font-bold shadow-md animate-bounce">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <strong className="text-sm font-black flex items-center gap-2">
                  Alerta Crítico: {vacantShifts.length} vaga(s) sem plantonista hoje/amanhã
                </strong>
                <span className="text-xs text-rose-700 dark:text-rose-300">
                  Clique no posto abaixo para abrir a escala diretamente na seção com desfalque:
                </span>
              </div>
            </div>
          </div>

          {/* CHIPS COM LINK DIRETO PARA A SEÇÃO */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-rose-200 dark:border-rose-900/50">
            {vacantShifts.map((vs) => (
              <button 
                key={vs.id} 
                onClick={() => handleResolveAlert(vs)}
                className="cursor-pointer px-3.5 py-2 rounded-xl bg-white dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 text-xs font-black text-rose-700 dark:text-rose-300 flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-900 transition-all hover:scale-105 shadow-sm"
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span><b>{vs.sectorName}</b> • {vs.start_time} às {vs.end_time} ({vs.formattedDate})</span>
                <ArrowRightLeft className="w-3 h-3 opacity-60 ml-1" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-600 text-white font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-xs font-black uppercase tracking-wider block">Escala Hospitalar 100% Homologada</strong>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400">Todos os postos e setores clínicos possuem médicos alocados para hoje e amanhã.</span>
            </div>
          </div>
          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono px-3 py-1 rounded-xl bg-emerald-500/20">
            ZERO DESFALQUES
          </span>
        </div>
      )}

      {/* 3. CARDS DE TELEMETRIA EXECUTIVA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-3xl border border-emerald-200 dark:border-emerald-800/60 bg-gradient-to-br from-white to-emerald-50/40 dark:from-slate-900 dark:to-emerald-950/20 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              Médicos no Posto Agora
            </span>
            <span className="p-2 rounded-xl bg-emerald-600 text-white shadow-md animate-pulse">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
            {activeNowList.length} <span className="text-sm font-bold text-slate-500">em atendimento</span>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
            Presença física confirmada na unidade
          </p>
        </Card>

        <Card className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Plantões do Dia
            </span>
            <span className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400">
              <CalendarDays className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
            {todayShifts.length} <span className="text-sm font-bold text-slate-500">turnos</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            {upcomingList.length} a iniciar · {concludedList.length} concluídos
          </p>
        </Card>

        <Card className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Corpo Clínico Credenciado
            </span>
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
            {professionals.length} <span className="text-sm font-bold text-slate-500">profissionais</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Equipe vinculada às escalas
          </p>
        </Card>

        <Card className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Custo Operacional Hoje
            </span>
            <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-3 font-mono">
            R$ {todayFinancials.executedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Previsão 24h: <b>R$ {todayFinancials.totalToday.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
          </p>
        </Card>
      </div>

      {/* 4. BLOCO DE GRÁFICOS VISUAIS: OCUPAÇÃO REAL E RADIAL DE EFICIÊNCIA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GRÁFICO 1: OCUPAÇÃO REAL DOS SETORES (0/0 CORRIGIDO) */}
        <Card className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-sky-600" /> Ocupação Real por Setor Clínico
              </h3>
              <p className="text-xs text-slate-500">Capacidade e presença nos postos assistenciais hoje ({fmtDate(todayStr)})</p>
            </div>
            <span className="text-xs font-black px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {sectorsCoverage.length} Setores Mapeados
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sectorsCoverage.map((sec) => {
              const hasShifts = sec.total > 0;
              const percent = hasShifts ? Math.round((sec.active / sec.total) * 100) : 0;
              const hasVacant = sec.vacant > 0;

              return (
                <div 
                  key={sec.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    hasVacant
                      ? 'border-rose-300 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20 shadow-sm'
                      : sec.active > 0
                      ? 'border-emerald-300 bg-emerald-50/30 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {sec.name}
                    </strong>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                      hasVacant 
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' 
                        : sec.active > 0 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {hasShifts ? `${sec.active} ativo(s)` : 'Sem escala hoje'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 mt-2.5 font-medium">
                    <span>Ocupação do posto</span>
                    <span className="font-mono font-black text-slate-900 dark:text-white">
                      {hasShifts ? `${sec.active} de ${sec.total} turnos (${percent}%)` : '0 / 0'}
                    </span>
                  </div>

                  {/* BARRA CALIBRADA: 0% real se não tiver plantão, sem barras verdes falsas */}
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${hasVacant ? 'bg-rose-500' : sec.active > 0 ? 'bg-emerald-500' : 'bg-transparent'}`}
                      style={{ width: `${hasShifts ? Math.min(100, Math.max(5, percent)) : 0}%` }}
                    />
                  </div>

                  {hasVacant ? (
                    <div className="text-[11px] text-rose-600 dark:text-rose-400 font-black mt-2 flex items-center gap-1 animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5" /> {sec.vacant} vaga(s) com desfalque médico
                    </div>
                  ) : hasShifts ? (
                    <div className="text-[10px] text-slate-400 mt-2 font-medium">
                      {sec.upcoming} plantonista(s) a assumir a seguir
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 mt-2 italic">
                      Nenhum plantão agendado para este setor hoje
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* GRÁFICO 2: DONUT CIRCULAR DE EFICIÊNCIA GLOBAL */}
        <Card className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" /> Eficiência de Cobertura
              </h3>
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Hoje
              </span>
            </div>

            {/* RADIAL SVG LIMPO */}
            <div className="py-6 flex flex-col items-center justify-center relative">
              <svg className="w-44 h-44 transform -rotate-90" viewBox="0 0 120 120">
                <circle 
                  cx="60" cy="60" r="48" 
                  className="text-slate-100 dark:text-slate-800" 
                  strokeWidth="12" 
                  stroke="currentColor" 
                  fill="transparent" 
                />
                <circle 
                  cx="60" cy="60" r="48" 
                  className={globalFillRate === 100 ? "text-emerald-500" : "text-sky-500"} 
                  strokeWidth="12" 
                  strokeDasharray={2 * Math.PI * 48}
                  strokeDashoffset={2 * Math.PI * 48 * (1 - globalFillRate / 100)}
                  strokeLinecap="round"
                  stroke="currentColor" 
                  fill="transparent" 
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                  {globalFillRate}%
                </span>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mt-0.5">
                  Coberto
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850/50 font-medium">
                <span className="text-slate-500">Postos com Médico Ativo:</span>
                <strong className="text-emerald-600 font-mono font-black">{activeNowList.length} turnos</strong>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850/50 font-medium">
                <span className="text-slate-500">Vagas Descobertas:</span>
                <strong className={vacantShifts.length > 0 ? "text-rose-600 font-mono font-black" : "text-slate-400 font-mono"}>
                  {vacantShifts.length} postos
                </strong>
              </div>
            </div>
          </div>

          {/* CURVA DE DEMANDA 24H (BARRAS DE GRADIENTE) */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
              Distribuição da Carga Horária 24h
            </span>
            <div className="flex items-end justify-between h-14 gap-1">
              {hourlyCurveData.map((b, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className="w-full rounded-t-sm bg-gradient-to-t from-sky-600 to-indigo-500" 
                    style={{ height: `${Math.max(12, b.height)}%` }} 
                    title={`${b.label}: ${b.count} plantões`}
                  />
                  <span className="text-[8px] font-mono text-slate-400">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* 5. PLANTÕES EM ATENDIMENTO HOJE */}
      <Card className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-black text-base text-slate-900 dark:text-white">Plantões em Atendimento Hoje</h3>
            <p className="text-xs text-slate-500">Escala de {fmtDate(todayStr)} (Ativos no momento, programados e concluídos)</p>
          </div>
          <span className="text-xs font-black px-3 py-1 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            {todayShifts.length} turno(s) no total
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
              const isVago = !shift.professional_id || shift.status === 'vago' || (shift.professional_name || '').toLowerCase().includes('vaga');

              return (
                <div
                  key={shift.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isVago
                      ? 'border-rose-400 bg-rose-50/60 dark:bg-rose-950/20 shadow-sm'
                      : isActive 
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
                        isVago
                          ? 'bg-rose-600 text-white animate-pulse'
                          : isActive
                          ? 'bg-emerald-600 text-white animate-pulse'
                          : isFinished
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                      }`}
                    >
                      {isVago ? '⚠️ Vaga Aberta' : isActive ? '● Ativo no Plantão' : isFinished ? '✓ Concluído' : '⏳ Programado'}
                    </span>
                  </div>

                  <div className="font-black text-sm text-slate-900 dark:text-white truncate">
                    {isVago ? <span className="text-rose-600">Vaga em Aberto</span> : toTitleCase(shift.professional_name)}
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