import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Repeat, TrendingUp, AlertTriangle, Plus, Maximize2, Minimize2, Clock3 } from 'lucide-react';
import { isShiftActiveOnDate, isShiftCurrentlyActive } from '@/lib/shiftUtils';

function StatCard({ icon: Icon, label, value, color, sub, accent }) {
  return (
    <Card className="p-5 border-slate-200 bg-white/80 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-[18px] h-[18px]" />
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-2xl font-bold text-slate-800">{value}</div>
          {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
        </div>
        {accent && <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">{accent}</span>}
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { user, company, loading } = useAppData();
  const [shifts, setShifts] = useState([]);
  const [swaps, setSwaps] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [tvMode, setTvMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const companyId = user?.data?.company_id;
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id;

  useEffect(() => {
    if (loading) return;
    (async () => {
      const f = companyId ? { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) } : {};
      try {
        const [s, sw, p] = await Promise.all([
          base44.entities.Shift.filter(f, '-date', 200),
          base44.entities.ShiftSwap.filter({ ...f, status: 'pendente' }, '-created_date', 50),
          base44.entities.Professional.filter(f, '-created_date', 200),
        ]);
        setShifts(s); setSwaps(sw); setProfessionals(p);
      } catch (e) {}
    })();
  }, [loading, companyId, unitId]);

  useEffect(() => {
    if (loading) return;
    const refreshTimer = setInterval(() => {
      const f = companyId ? { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) } : {};
      Promise.all([
        base44.entities.Shift.filter(f, '-date', 200),
        base44.entities.ShiftSwap.filter({ ...f, status: 'pendente' }, '-created_date', 50),
        base44.entities.Professional.filter(f, '-created_date', 200),
      ]).then(([nextShifts, nextSwaps, nextProfessionals]) => {
        setShifts(nextShifts); setSwaps(nextSwaps); setProfessionals(nextProfessionals);
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(refreshTimer);
  }, [loading, companyId, unitId]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const filled = shifts.filter((s) => s.status === 'confirmado' || s.status === 'pendente').length;
  const total = shifts.length || 1;
  const open = shifts.filter((s) => s.status === 'vago').length;
  const today = new Date();

  const dailyLoad = useMemo(() => {
    const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    return days.map((day, index) => {
      const count = shifts.filter((s) => {
        const date = s.date ? new Date(`${s.date}T00:00:00`) : null;
        if (!date) return false;
        return date.getDay() === ((index + 1) % 7);
      }).length;
      return { day, count };
    });
  }, [shifts]);
  const maxDailyLoad = Math.max(...dailyLoad.map((item) => item.count), 1);
  const todayIndex = (today.getDay() + 6) % 7;

  const openTvMode = async () => {
    setTvMode(true);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch (error) {
      void error;
    }
  };

  const closeTvMode = async () => {
    setTvMode(false);
    if (document.fullscreenElement) await document.exitFullscreen?.();
  };

  if (loading) return <div className="p-8 text-slate-400">Carregando...</div>;

  if (tvMode) {
    const todayShifts = shifts.filter((shift) => isShiftCurrentlyActive(shift, currentTime)).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    return (
      <div className="min-h-full bg-slate-950 p-6 text-white md:p-10">
        <div className="mx-auto max-w-[1800px]">
          <div className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
            <div><div className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-300">Central operacional ao vivo</div><h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">Painel do hospital</h1><p className="mt-2 text-lg capitalize text-slate-400">{today.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p></div>
            <div className="flex items-center gap-4"><div className="text-right"><div className="flex items-center gap-2 text-3xl font-black tabular-nums md:text-5xl"><Clock3 className="h-7 w-7 text-sky-400" />{currentTime.toLocaleTimeString('pt-BR')}</div><div className="text-xs uppercase tracking-[0.18em] text-slate-500">Atualização automática</div></div><button title="Fechar visão TV" onClick={closeTvMode} className="rounded-xl border border-white/15 p-3 text-slate-300 hover:bg-white/10"><Minimize2 className="h-5 w-5" /></button></div>
          </div>
          <div className="mb-8 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/[0.07] p-5"><div className="text-4xl font-black">{todayShifts.length}</div><div className="mt-1 text-sm uppercase tracking-wider text-slate-400">Plantões hoje</div></div><div className="rounded-2xl border border-white/10 bg-white/[0.07] p-5"><div className="text-4xl font-black">{professionals.length}</div><div className="mt-1 text-sm uppercase tracking-wider text-slate-400">Profissionais</div></div><div className="rounded-2xl border border-white/10 bg-white/[0.07] p-5"><div className="text-4xl font-black text-emerald-300">{filled}</div><div className="mt-1 text-sm uppercase tracking-wider text-slate-400">Escalas cobertas</div></div></div>
          {todayShifts.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-14 text-center text-xl text-slate-400">Nenhum plantão em andamento ou programado para hoje.</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{todayShifts.map((shift) => <div key={shift.id} className="rounded-2xl border border-white/10 bg-white/[0.07] p-5"><div className="flex items-start justify-between"><div className="rounded-xl bg-sky-400/15 px-4 py-3 text-center text-xl font-black text-sky-200"><div>{shift.start_time || '--:--'}</div><div className="text-xs font-normal text-sky-300/70">até {shift.end_time || '--:--'}</div></div><div className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${isShiftCurrentlyActive(shift, currentTime) ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-slate-300'}`}>{isShiftCurrentlyActive(shift, currentTime) ? 'Em andamento' : 'Próximo'}</div></div><div className="mt-7 text-2xl font-black">{shift.professional_name || 'Vaga disponível'}</div><div className="mt-2 text-lg text-slate-300">{shift.sector_name || 'Setor não informado'}</div></div>)}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {!company && (
        <Card className="p-5 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">Configure sua empresa para começar</p>
              <p className="text-sm text-amber-700 mt-1">
                Você ainda não está vinculado a uma empresa. Acesse as{' '}
                <Link to="/configuracoes" className="underline font-medium">Configurações</Link> para criar ou selecionar sua empresa.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_80%_15%,rgba(56,189,248,0.28),transparent_28%),linear-gradient(125deg,#07111f,#0f2e46_58%,#126782)] p-6 text-white shadow-[0_20px_60px_rgba(8,47,73,0.25)] md:p-8">
        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" /> Central operacional ao vivo
            </div>
            <h2 className="mt-4 max-w-2xl text-4xl font-black tracking-tight md:text-5xl">O hospital em um só olhar.</h2>
            <p className="mt-3 max-w-xl text-base leading-7 text-slate-300">Decisões rápidas, equipe coberta e operação acompanhada em tempo real.</p>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/15 p-2 backdrop-blur-sm sm:min-w-[390px]">
            <div className="rounded-xl bg-white/10 p-3"><div className="text-2xl font-black">{shifts.filter((shift) => isShiftActiveOnDate(shift, today)).length}</div><div className="mt-1 text-[10px] uppercase tracking-wider text-sky-100/70">Hoje</div></div>
            <div className="rounded-xl bg-white/10 p-3"><div className="text-2xl font-black">{professionals.length}</div><div className="mt-1 text-[10px] uppercase tracking-wider text-sky-100/70">Equipe</div></div>
            <div className="rounded-xl bg-white/10 p-3"><div className="text-2xl font-black">{Math.max(0, 100 - open * 5)}%</div><div className="mt-1 text-[10px] uppercase tracking-wider text-sky-100/70">Cobertura</div></div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/escalas">
              <Button className="bg-white text-slate-900 hover:bg-slate-100">
                <Plus className="w-4 h-4 mr-2" /> Abrir escala
              </Button>
            </Link>
            <Link to="/corpo-clinico">
              <Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                <Users className="w-4 h-4 mr-2" /> Cadastro
              </Button>
            </Link>
            <Button variant="outline" onClick={openTvMode} className="border-white/20 bg-white/5 text-white hover:bg-white/10"><Maximize2 className="w-4 h-4 mr-2" /> Visão TV</Button>
          </div>
        </div>
      </div>

      <Card className="border-slate-200 bg-white/85 p-4 shadow-sm md:p-5">
        <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-700">Indicadores da operação</p><h3 className="mt-1 text-lg font-black text-slate-800">Panorama do hospital</h3></div><span className="text-xs text-slate-400">Atualizado em tempo real</span></div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatCard icon={TrendingUp} label="Cobertura" value={`${Math.round((filled / total) * 100)}%`} color="bg-sky-100 text-sky-700" sub={`${filled} de ${shifts.length} plantões`} accent="Hoje" />
          <StatCard icon={AlertTriangle} label="Vagas abertas" value={`${open}`} color="bg-red-100 text-red-600" sub="Necessitam alocação" accent="Urgência" />
          <StatCard icon={Repeat} label="Trocas" value={`${swaps.length}`} color="bg-amber-100 text-amber-600" sub="Pendentes de aprovação" accent="Ativo" />
        </div>
      </Card>

      <Card className="border-slate-200 bg-white/80 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-800">Carga por dia da semana</h3>
            <p className="text-sm text-slate-500">Volume de escalas previsto</p>
          </div>
        </div>

        <div className="grid h-48 grid-cols-7 items-end gap-2 md:gap-4">
          {dailyLoad.map((item, index) => (
            <div key={item.day} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
              <span className={`text-xs font-bold ${index === todayIndex ? 'text-sky-700' : 'text-slate-500'}`}>{item.count}</span>
              <div className={`w-full max-w-16 rounded-t-xl transition-all ${index === todayIndex ? 'bg-sky-600 shadow-lg shadow-sky-200' : index > 4 ? 'bg-slate-300' : 'bg-sky-200'}`} style={{ height: `${Math.max(12, (item.count / maxDailyLoad) * 120)}px` }} />
              <span className={`text-[11px] font-medium ${index === todayIndex ? 'text-sky-700' : 'text-slate-500'}`}>{item.day}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}