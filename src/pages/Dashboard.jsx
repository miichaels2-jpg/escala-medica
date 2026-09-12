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
  Stethoscope
} from 'lucide-react';
import { getShiftTvLifecycle } from '@/lib/shiftUtils';

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
        base44.entities.Shift.filter(f, '-date', 500),
        base44.entities.Sector.filter(f, '-created_date', 100),
        base44.entities.Professional.filter(f, '-created_date', 200),
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

  // Aplica o ciclo de vida inteligente no Painel: Ativos, Programados e Concluídos (<2h)
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
      .filter((s) => s.lifecycle.state !== 'expired') // Elimina após 2h do término
      .sort((a, b) => {
        const orderPriority = { active: 0, upcoming: 1, recently_finished: 2 };
        return (orderPriority[a.lifecycle.state] ?? 99) - (orderPriority[b.lifecycle.state] ?? 99);
      });
  }, [shifts, todayStr, currentTime]);

  const activeNowCount = useMemo(() => {
    return todayShifts.filter((s) => s.lifecycle.state === 'active').length;
  }, [todayShifts]);

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
  // MODO TV NO PAINEL
  // ==========================================
  if (tvMode) {
    return (
      <div className="min-h-full bg-slate-950 p-5 text-white md:p-8 select-none">
        <div className="mx-auto max-w-[1800px]">
          <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">
                <CalendarDays className="h-5 w-5" /> Painel Operacional ao Vivo
              </div>
              <h1 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">
                {fmtDateLong(currentTime)}
              </h1>
              <p className="mt-1 text-lg text-slate-400">
                {fmtDate(todayStr)} · {todayShifts.length} plantões na operação de hoje
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="flex items-center justify-end gap-2 text-3xl font-black tabular-nums md:text-5xl text-sky-400">
                  <Clock3 className="h-7 w-7" />
                  {currentTime.toLocaleTimeString('pt-BR')}
                </div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Tempo Real</div>
              </div>
              <button title="Fechar modo TV" onClick={closeTvMode} className="rounded-xl border border-white/15 p-3 text-slate-300 hover:bg-white/10">
                <Minimize2 className="h-5 w-5" />
              </button>
            </div>
          </div>

          {todayShifts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-16 text-center text-xl text-slate-400">
              Nenhum plantão ativo ou agendado para o dia de hoje.
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

                    <div className="mt-5 truncate text-2xl font-black text-white">{shift.professional_name || 'Vaga Aberta'}</div>
                    <div className="mt-2 flex items-center gap-2 text-base text-slate-300">
                      <Stethoscope className={`h-4 w-4 ${isActive ? 'text-emerald-400' : 'text-sky-400'}`} />
                      {shift.sector_name || 'Setor não informado'}
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
  // PAINEL NORMAL FORA DA TV
  // ==========================================
  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Painel Geral</h1>
          <p className="text-sm text-slate-500">
            Visão consolidada da operação, escala do dia e indicadores em tempo real.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openTvMode} className="border-sky-200 text-sky-700 hover:bg-sky-50 gap-2 font-bold">
            <Maximize2 className="w-4 h-4" /> Modo TV
          </Button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Plantões Hoje</div>
            <div className="text-2xl font-black text-slate-900">{todayShifts.length}</div>
          </div>
        </Card>

        <Card className="p-5 border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Ativos Agora</div>
            <div className="text-2xl font-black text-emerald-600">{activeNowCount}</div>
          </div>
        </Card>

        <Card className="p-5 border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Corpo Clínico Ativo</div>
            <div className="text-2xl font-black text-slate-900">{professionals.length}</div>
          </div>
        </Card>

        <Card className="p-5 border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Setores Cadastrados</div>
            <div className="text-2xl font-black text-slate-900">{sectors.length}</div>
          </div>
        </Card>
      </div>

      {/* Lista de Plantões de Hoje no Painel com a Mesma Lógica da TV */}
      <Card className="p-5 border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-base text-slate-800">Plantões em Operação Hoje</h3>
            <p className="text-xs text-slate-500">Escala de {fmtDate(todayStr)} (Ativos no momento, programados e recém-concluídos)</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700">
            {todayShifts.length} turno(s)
          </span>
        </div>

        {todayShifts.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">
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
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-700">
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

                  <div className="font-bold text-sm text-slate-900 truncate">
                    {shift.professional_name || 'Vaga Aberta'}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                    <span className="truncate">{shift.sector_name || 'Geral'}</span>
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