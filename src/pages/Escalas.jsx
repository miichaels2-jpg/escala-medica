import { useEffect, useState, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Search, 
  Download, 
  CalendarDays, 
  UsersRound, 
  Maximize2, 
  Minimize2, 
  Clock3, 
  Printer,
  Stethoscope
} from 'lucide-react';
import ShiftFormDialog from '@/components/shifts/ShiftFormDialog';
import { exportSchedulePDF } from '@/lib/exportReport';
import { getShiftTvLifecycle } from '@/lib/shiftUtils';

const shiftTypeStyle = {
  diurno: 'bg-sky-50 text-sky-700',
  noturno: 'bg-purple-50 text-purple-700',
  intermediario: 'bg-amber-50 text-amber-700',
};

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

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

function fmtDateLong(dateStr) {
  if (!dateStr) return '';
  const cleanDate = dateStr.split('T')[0];
  const [year, month, day] = cleanDate.split('-');
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return WEEKDAYS_LONG[d.getDay()] || '';
}

function getMonthKey(dateStr) {
  if (!dateStr) return '';
  const cleanDate = dateStr.split('T')[0];
  const [year, month] = cleanDate.split('-');
  return `${year}-${month}`;
}

export default function Escalas() {
  const { user, company, loading: appLoading } = useAppData();
  const [shifts, setShifts] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());
  const [tvMode, setTvMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [duplicating, setDuplicating] = useState(false);

  const userId = user?.id;
  const userEmail = user?.email;
  const userFullName = user?.full_name;
  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id || 'unit_h1';
  const isManager = user?.role === 'admin' || user?.data?.app_role === 'manager' || user?.data?.app_role === 'gestor';

  const load = useCallback(async () => {
    if (!companyId) return;
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
      console.error('Erro ao buscar escalas:', e);
    }
  }, [companyId, unitId]);

  useEffect(() => {
    if (appLoading) return;
    load();
  }, [appLoading, load]);

  // Atualiza o relógio em tempo real tanto no modo TV quanto na visualização padrão
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const myProfessional = useMemo(() => {
    return professionals.find((p) => p.user_id === userId || (p.email && p.email === userEmail) || p.name === userFullName);
  }, [professionals, userId, userEmail, userFullName]);

  const monthOptions = useMemo(() => {
    const values = [...new Set(shifts.map((s) => (s.date ? s.date.slice(0, 7) : '')))].filter(Boolean).sort().reverse();
    return values;
  }, [shifts]);

  const categoryPriority = { medico: 0, enfermeiro: 1, tecnico: 2, outro: 3 };
  const todayStr = useMemo(() => getLocalDateString(currentTime), [currentTime]);

  // FILTRO INTELIGENTE UNIFICADO:
  // Se for o dia de hoje, remove plantões expirados há mais de 2h
  const filtered = useMemo(() => {
    const professionalMap = Object.fromEntries((professionals || []).map((p) => [p.id, p]));

    return shifts
      .filter((s) => {
        const sDate = (s.date || '').split('T')[0];
        const monthMatch = !selectedMonth || sDate.startsWith(selectedMonth);
        const dateMatch = !selectedDate || sDate === selectedDate;
        const matchSearch =
          !search ||
          (s.professional_name || '').toLowerCase().includes(search.toLowerCase()) ||
          (s.sector_name || '').toLowerCase().includes(search.toLowerCase());
        const matchSector = sectorFilter === 'all' || s.sector_id === sectorFilter;
        const personalScope = !isManager
          ? s.professional_id === myProfessional?.id || s.professional_name === myProfessional?.name || s.professional_name === userFullName
          : true;
        const statusScope = isManager ? true : ['pendente', 'confirmado'].includes(s.status);

        if (!dateMatch || !monthMatch || !matchSearch || !matchSector || !personalScope || !statusScope) {
          return false;
        }

        // Se estiver filtrando pelo dia de hoje, aplica a regra de remoção de +2h encerrado
        if (selectedDate === todayStr || (!selectedDate && sDate === todayStr)) {
          const lifecycle = getShiftTvLifecycle(s, currentTime);
          if (lifecycle.state === 'expired') {
            return false;
          }
        }

        return true;
      })
      .map((s) => ({
        ...s,
        lifecycle: getShiftTvLifecycle(s, currentTime)
      }))
      .sort((a, b) => {
        // Ordenação inteligente: Ativos primeiro, depois Programados, depois Concluídos recentes
        const orderPriority = { active: 0, upcoming: 1, recently_finished: 2, expired: 3 };
        const prioA = orderPriority[a.lifecycle.state] ?? 99;
        const prioB = orderPriority[b.lifecycle.state] ?? 99;
        if (prioA !== prioB) return prioA - prioB;

        const aCategory = categoryPriority[professionalMap[a.professional_id]?.category || 'outro'] ?? 99;
        const bCategory = categoryPriority[professionalMap[b.professional_id]?.category || 'outro'] ?? 99;
        const aDate = new Date(`${a.date}T00:00:00`).getTime();
        const bDate = new Date(`${b.date}T00:00:00`).getTime();

        if (aDate !== bDate) return aDate - bDate;
        if (aCategory !== bCategory) return aCategory - bCategory;
        return (a.professional_name || '').localeCompare(b.professional_name || '') || (a.sector_name || '').localeCompare(b.sector_name || '');
      });
  }, [shifts, search, sectorFilter, selectedMonth, selectedDate, professionals, isManager, myProfessional, userFullName, currentTime, todayStr]);

  const days = useMemo(() => {
    const grouped = filtered.reduce((result, shift) => {
      const key = (shift.date || '').split('T')[0] || 'sem-data';
      result[key] = [...(result[key] || []), shift];
      return result;
    }, {});
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const handleDelete = async (id) => {
    if (!confirm('Excluir este plantão?')) return;
    await base44.entities.Shift.delete(id);
    load();
  };

  const handleExportSchedule = () => {
    const sorted = [...filtered].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const dateLabel = selectedDate ? `${fmtDate(selectedDate)}` : 'Dia selecionado';
    exportSchedulePDF({ company: company || { name: 'ScaleMedic CGT', app_name: 'ScaleMedic CGT' }, shifts: sorted, dateLabel });
  };

  const handlePrintSchedule = () => {
    document.body.classList.add('printing-schedule');
    window.print();
    window.setTimeout(() => document.body.classList.remove('printing-schedule'), 1000);
  };

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

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (s) => {
    setEditing(s);
    setDialogOpen(true);
  };

  const handleDuplicatePreviousMonth = async () => {
    if (!companyId) return;

    setDuplicating(true);
    try {
      const allShifts = await base44.entities.Shift.filter({ company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) }, '-date', 500);
      const monthKeys = [...new Set(allShifts.map((shift) => getMonthKey(shift.date)))].sort();
      const sourceMonthKey = monthKeys.length > 1 ? monthKeys[monthKeys.length - 2] : monthKeys[0];
      const sourceDate = new Date(`${sourceMonthKey}-01T00:00`);
      const targetDate = new Date(sourceDate.getFullYear(), sourceDate.getMonth() + 1, 1);
      const targetMonthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;

      const sourceShifts = allShifts.filter((shift) => getMonthKey(shift.date) === sourceMonthKey);
      const existingTargetKeys = new Set(
        allShifts
          .filter((shift) => getMonthKey(shift.date) === targetMonthKey)
          .map((shift) => `${shift.date}|${shift.professional_id || 'vaga'}|${shift.sector_id || 'setor'}`)
      );

      let createdCount = 0;

      for (const shift of sourceShifts) {
        const sourceDay = new Date(shift.date + 'T00:00');
        const nextDay = new Date(sourceDay.getFullYear(), sourceDay.getMonth() + 1, sourceDay.getDate());
        const nextDateString = getLocalDateString(nextDay);
        const duplicateKey = `${nextDateString}|${shift.professional_id || 'vaga'}|${shift.sector_id || 'setor'}`;

        if (existingTargetKeys.has(duplicateKey)) continue;

        const clone = {
          ...shift,
          id: undefined,
          date: nextDateString,
          status: shift.status === 'cancelado' ? 'pendente' : shift.status,
          unit_id: unitId,
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
        };

        await base44.entities.Shift.create(clone);
        createdCount += 1;
        existingTargetKeys.add(duplicateKey);
      }

      await load();
      window.alert(
        createdCount > 0
          ? `Escala duplicada com sucesso para ${createdCount} plantão(s) do mês seguinte.`
          : 'Já existe uma cópia do mês anterior para o próximo mês.'
      );
    } catch (error) {
      window.alert(error?.message || 'Não foi possível duplicar a escala.');
    } finally {
      setDuplicating(false);
    }
  };

  const personalHeadline = myProfessional?.name || userFullName || 'Seu calendário';

  // ==========================================
  // MODO TV (TELA CHEIA HOSPITALAR)
  // ==========================================
  if (tvMode && isManager) {
    return (
      <div className="min-h-full bg-slate-950 p-5 text-white md:p-8 select-none">
        <div className="mx-auto max-w-[1800px]">
          <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">
                <CalendarDays className="h-5 w-5" /> Escala Hospitalar ao Vivo
              </div>
              <h1 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">
                {fmtDateLong(selectedDate)}
              </h1>
              <p className="mt-1 text-lg text-slate-400">
                {fmtDate(selectedDate)} · {filtered.length} profissionais na operação do dia
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
              <button 
                title="Fechar modo TV" 
                onClick={closeTvMode} 
                className="rounded-xl border border-white/15 p-3 text-slate-300 hover:bg-white/10 transition-colors"
              >
                <Minimize2 className="h-5 w-5" />
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-16 text-center text-xl text-slate-400">
              Nenhum plantão ativo ou programado para esta data.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((shift) => {
                const state = shift.lifecycle.state;
                const isActive = state === 'active';
                const isFinished = state === 'recently_finished';

                return (
                  <div
                    key={shift.id}
                    className={`rounded-2xl border p-5 shadow-2xl transition-all duration-500 ${
                      isActive
                        ? 'border-emerald-500/60 bg-emerald-950/30 shadow-emerald-950/50 scale-[1.01]'
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

                    <div className="mt-5 truncate text-2xl font-black text-white">
                      {shift.professional_name || 'Vaga Aberta'}
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-base text-slate-300">
                      <Stethoscope className={`h-4 w-4 ${isActive ? 'text-emerald-400' : 'text-sky-400'}`} />
                      <span>{shift.sector_name || 'Setor Geral'}</span>
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
  // MODO PADRÃO FORA DA TV (ESCALAS & PLANTÕES)
  // ==========================================
  return (
    <div className="p-4 md:p-8 space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">
              <CalendarDays className="h-4 w-4" /> Quadro operacional
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight">Escala hospitalar</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Visualização por dia, turno, setor e status de jornada (Ativo no Plantão, Programado e Recém-Concluído).
            </p>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div>
              <div className="text-3xl font-black">{filtered.length}</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">plantões exibidos</div>
            </div>
            <div className="h-10 w-px bg-white/15" />
            <div>
              <div className="text-3xl font-black">{new Set(filtered.map((shift) => (shift.date || '').split('T')[0])).size}</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">dias cobertos</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Gestão de escala</p>
          <p className="mt-1 text-sm text-slate-500">Acompanhe a presença dos profissionais em tempo real</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleDuplicatePreviousMonth} disabled={duplicating} className="border-sky-200 text-sky-700 hover:bg-sky-50">
            {duplicating ? 'Duplicando...' : 'Duplicar mês anterior'}
          </Button>
          <Button onClick={openNew} className="bg-sky-600 hover:bg-sky-700 text-white">
            <Plus className="w-4 h-4 mr-1.5" /> Publicar / Alocar Plantão
          </Button>
        </div>
      </div>

      <Card className="p-4 border-slate-200">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Buscar por profissional ou setor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-10 rounded-md border border-slate-200 px-3 text-sm bg-white"
          >
            <option value="">Todos os meses</option>
            {monthOptions.map((month) => {
              const [y, m] = month.split('-');
              const dateObj = new Date(Number(y), Number(m) - 1, 1);
              return (
                <option key={month} value={month}>
                  {dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </option>
              );
            })}
          </select>
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="h-10 w-auto" />
          <Button variant="outline" onClick={() => setSelectedDate('')} className="border-slate-200">
            Todos os dias
          </Button>
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="h-10 rounded-md border border-slate-200 px-3 text-sm bg-white"
          >
            <option value="all">Todos os setores</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={openTvMode} className="border-sky-200 text-sky-700 hover:bg-sky-50 font-bold">
            <Maximize2 className="w-4 h-4 mr-1.5" /> Modo TV
          </Button>
          <Button variant="outline" onClick={handlePrintSchedule} className="border-sky-200 text-sky-700 hover:bg-sky-50">
            <Printer className="w-4 h-4 mr-1.5" /> Imprimir
          </Button>
          <Button variant="outline" onClick={handleExportSchedule} className="border-sky-200 text-sky-700 hover:bg-sky-50">
            <Download className="w-4 h-4 mr-1.5" /> PDF da escala
          </Button>
        </div>

        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Nenhum plantão ativo ou programado para este filtro ou data selecionada.
          </div>
        ) : (
          <div className="space-y-5">
            {days.map(([date, dateShifts]) => (
              <section key={date} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70">
                <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800">{fmtDate(date)}</div>
                      <div className="text-xs text-slate-500">{dateShifts.length} plantão(ões) na escala</div>
                    </div>
                  </div>
                  <UsersRound className="h-5 w-5 text-slate-300" />
                </div>

                <div className="grid gap-3 p-3 lg:grid-cols-2">
                  {dateShifts.map((s) => {
                    const state = s.lifecycle.state;
                    const isActive = state === 'active';
                    const isFinished = state === 'recently_finished';

                    return (
                      <div 
                        key={s.id} 
                        className={`flex items-center gap-3 rounded-xl border p-3 shadow-sm transition-all duration-300 ${
                          isActive 
                            ? 'border-emerald-300 bg-emerald-50/70' 
                            : isFinished 
                            ? 'border-slate-200 bg-slate-100/60 opacity-75' 
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        {/* Bloco de Horário */}
                        <div className={`min-w-[92px] rounded-lg px-2.5 py-2 text-center text-xs font-bold ${
                          isActive 
                            ? 'bg-emerald-600 text-white' 
                            : isFinished 
                            ? 'bg-slate-200 text-slate-600' 
                            : shiftTypeStyle[s.shift_type] || 'bg-slate-100 text-slate-600'
                        }`}>
                          <div>{s.start_time || '--:--'}</div>
                          <div className="text-[10px] font-normal opacity-80">até {s.end_time || '--:--'}</div>
                        </div>

                        {/* Dados do Médico & Setor */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-bold text-slate-800">
                              {s.professional_name || 'Vaga disponível'}
                            </span>
                            
                            {/* Badge Idêntica à TV */}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                              isActive 
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse' 
                                : isFinished 
                                ? 'bg-slate-200 text-slate-700' 
                                : 'bg-sky-50 text-sky-700 border border-sky-200'
                            }`}>
                              {isActive ? '● Ativo no Plantão' : isFinished ? '✓ Concluído' : '⏳ Programado'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                            <span className="truncate">{s.sector_name || 'Setor não informado'}</span>
                            <span className="text-[10px] text-slate-400">{s.lifecycle.detail}</span>
                          </div>
                        </div>

                        {/* Ações */}
                        <div className="flex gap-1">
                          <button title="Editar plantão" onClick={() => openEdit(s)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button title="Excluir plantão" onClick={() => handleDelete(s.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </Card>

      <ShiftFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={load}
        shift={editing}
        sectors={sectors}
        professionals={professionals}
        companyId={companyId}
        unitId={unitId}
      />
    </div>
  );
}