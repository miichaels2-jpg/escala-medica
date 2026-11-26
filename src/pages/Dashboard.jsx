import { useEffect, useState, useMemo } from 'react';
import { useAppData } from '@/lib/useAppData';
import { DEFAULT_REMUNERATION_TYPE, getShiftCostEstimate } from '@/lib/financialCalculations';
import { getShiftDateTimeRange, isShiftVacant } from '@/lib/shiftLiveStatus';
import { Button } from '@/components/ui/button';
import PageHero from '@/components/PageHero';
import OnboardingChecklist from '@/components/OnboardingChecklist';
import MonthTrend from '@/components/MonthTrend';
import TeamCare from '@/components/TeamCare';
import { Minimize2, AlertTriangle, CheckCircle2,
  ArrowRightLeft, DollarSign, Building2,
  Radio, X, Send
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import UnitsOverview, { ALL_UNITS, requestUnitSwitch } from '@/components/UnitsOverview';
import { getProfessionalUnitIds } from '@/lib/sectorAccess';
import { getLocalDateString } from '@/lib/format';


const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

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
  return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function getShiftProfessionalName(shift) {
  return shift?.professional_name || shift?.professional?.name || shift?.professionalName || '';
}

function isVacantShift(shift) {
  return isShiftVacant(shift);
}

function toTitleCase(str) {
  if (!str) return '';
  const acr = ['UTI', 'UCO', 'PA', 'PS', 'CRM', 'COREN', 'SLA', 'CCO'];
  return str.toLowerCase().split(' ').map((word) => {
    const upper = word.toUpperCase();
    if (acr.includes(upper)) return upper;
    if (['de', 'da', 'do', 'das', 'dos', 'e'].includes(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}


function computeShiftLiveStatus(shift, liveNowDate) {
  if (!shift || !shift.date) return { isLive: false, isConcluded: false, isProgrammed: true, detail: '' };

  const range = getShiftDateTimeRange(shift);
  if (!range) return { isLive: false, isConcluded: false, isProgrammed: true, detail: '' };
  const { start: startDate, end: endDate } = range;

  const nowMs = liveNowDate.getTime();
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  if (nowMs >= startMs && nowMs < endMs) {
    const diffMin = Math.round((endMs - nowMs) / 60000);
    return { state: 'active', isLive: true, isConcluded: false, isProgrammed: false, remainingMinutes: diffMin, detail: `Resta ${Math.floor(diffMin / 60)}h ${diffMin % 60}m` };
  }

  if (nowMs >= endMs) return { state: 'concluded', isLive: false, isConcluded: true, isProgrammed: false, detail: `Concluído às ${shift.end_time}` };
  return { state: 'upcoming', isLive: false, isConcluded: false, isProgrammed: true, detail: `Inicia às ${shift.start_time}` };
}

export default function Painel() {
  const { user, company, units = [], selectedUnitId, isManager, shifts: selectedUnitShifts, sectors: selectedUnitSectors, professionals: selectedUnitProfessionals, loading, publishedRanges, getPublishedRanges, allCompanyShifts = [], allCompanySectors = [], allCompanyProfessionals = [], allUnitsView, setUnitScope, syncGlobalData } = useAppData();
  // Unidades que o gestor administra (mesma regra do seletor do cabeçalho).
  const managedUnits = useMemo(() => {
    const allowed = Array.isArray(user?.data?.allowed_unit_ids) ? user.data.allowed_unit_ids.map(String) : [];
    return (units || []).filter(u => user?.role === 'admin' || allowed.length === 0 || allowed.includes(String(u.id)));
  }, [units, user]);

  // Escopo do Painel: "Todas as unidades" (padrão de quem administra mais de uma) ou um hospital.
  // É o único seletor nesta tela: o do cabeçalho fica oculto aqui.
  const multiUnit = isManager && managedUnits.length > 1;
  // Mesma escolha do sistema todo: escolher um hospital aqui vale nas outras telas.
  const effectiveScope = !multiUnit
    ? String(selectedUnitId || '')
    : allUnitsView || !managedUnits.some(u => String(u.id) === String(selectedUnitId)) ? ALL_UNITS : String(selectedUnitId);
  const changeScope = (next) => setUnitScope(next);
  const scopeUnitIds = useMemo(() => (
    effectiveScope === ALL_UNITS ? managedUnits.map(u => String(u.id)) : [String(effectiveScope)]
  ), [effectiveScope, managedUnits]);
  const isAllUnits = multiUnit && effectiveScope === ALL_UNITS;
  const unitNameById = useMemo(() => Object.fromEntries((units || []).map(u => [String(u.id), u.name])), [units]);

  const shifts = useMemo(() => (multiUnit
    ? allCompanyShifts.filter(s => scopeUnitIds.includes(String(s.unit_id)))
    : selectedUnitShifts || []), [multiUnit, allCompanyShifts, scopeUnitIds, selectedUnitShifts]);
  const sectors = useMemo(() => (multiUnit
    ? allCompanySectors.filter(s => scopeUnitIds.includes(String(s.unit_id)))
    : selectedUnitSectors || []), [multiUnit, allCompanySectors, scopeUnitIds, selectedUnitSectors]);
  const professionals = useMemo(() => (multiUnit
    ? allCompanyProfessionals.filter(p => getProfessionalUnitIds(p).some(id => scopeUnitIds.includes(id)))
    : selectedUnitProfessionals || []), [multiUnit, allCompanyProfessionals, scopeUnitIds, selectedUnitProfessionals]);
  const navigate = useNavigate();

  const [tvMode, setTvMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [showAllVacantShifts, setShowAllVacantShifts] = useState(false);

  const unitId = (multiUnit && !isAllUnits ? effectiveScope : null) || selectedUnitId || user?.data?.selected_unit_id || company?.selected_unit_id || 'unit_h1';
  const currentUnit = units.find(u => String(u.id) === String(unitId));
  const dashboardTitle = isAllUnits
    ? `Todas as unidades (${managedUnits.length})`
    : currentUnit ? currentUnit.name : (company?.name || 'Hospital Principal');

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const todayStr = useMemo(() => getLocalDateString(currentTime), [currentTime]);
  const currentMinute = Math.floor(currentTime.getTime() / 60000);
  const currentYear = currentTime.getFullYear();
  const currentMonth = currentTime.getMonth();
  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  const daysToExpiration = useMemo(() => {
    if (!company?.data?.contract_end) return null;
    const endDate = new Date(company.data.contract_end + 'T23:59:59');
    return Math.ceil((endDate - currentTime) / (1000 * 60 * 60 * 24));
  }, [company, currentTime]);

  const unsubmittedSectors = useMemo(() => {
    return (sectors || []).filter(s => getPublishedRanges(s.unit_id || unitId, s.id, currentYear, currentMonth + 1).length === 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a função só lê publishedRanges, que já está na lista
  }, [sectors, unitId, currentYear, currentMonth, publishedRanges]);

  function getProfMeta(prof) {
    if (!prof) return {};
    const serverMeta = [prof.data, prof.metadata]
      .filter(source => source && typeof source === 'object' && !Array.isArray(source));
    return Object.assign({}, ...serverMeta);
  }

  const mergeProfForUnit = (p, targetUnitId) => {
      const meta = getProfMeta(p);
      const monthlyByUnit = meta.unit_monthly_salaries || {};
      const hasUnitSalary = Object.prototype.hasOwnProperty.call(monthlyByUnit, String(targetUnitId)) &&
        monthlyByUnit[String(targetUnitId)] !== '' &&
        monthlyByUnit[String(targetUnitId)] !== null &&
        monthlyByUnit[String(targetUnitId)] !== undefined;
      const primaryUnitId = p.unit_id || meta.allowed_unit_ids?.[0] || p.unit_ids?.[0];
      const legacySalary = meta.monthly_salary !== undefined ? meta.monthly_salary : p.monthly_salary;
      const remunerationType = meta.remuneration_type || p.remuneration_type || DEFAULT_REMUNERATION_TYPE;
      return {
        ...p,
        monthly_salary: remunerationType !== 'mensal'
          ? legacySalary
          : hasUnitSalary
            ? monthlyByUnit[String(targetUnitId)]
            : Object.keys(monthlyByUnit).length > 0
              ? String(primaryUnitId) === String(targetUnitId) ? legacySalary : 0
              : legacySalary,
        hourly_rate: meta.hourly_rate !== undefined ? meta.hourly_rate : p.hourly_rate,
        daily_rate: meta.daily_rate !== undefined ? meta.daily_rate : p.daily_rate,
        remuneration_type: remunerationType
      };
  };

  const rawProfById = useMemo(() => Object.fromEntries((professionals || []).filter(p => p?.id).map(p => [String(p.id), p])), [professionals]);

  const { profById, profByName } = useMemo(() => {
    const byId = {}; const byName = {};
    (professionals || []).forEach((p) => {
      const meta = getProfMeta(p);
      const monthlyByUnit = meta.unit_monthly_salaries || {};
      const hasUnitSalary = Object.prototype.hasOwnProperty.call(monthlyByUnit, String(unitId)) &&
        monthlyByUnit[String(unitId)] !== '' &&
        monthlyByUnit[String(unitId)] !== null &&
        monthlyByUnit[String(unitId)] !== undefined;
      const primaryUnitId = p.unit_id || meta.allowed_unit_ids?.[0] || p.unit_ids?.[0];
      const legacySalary = meta.monthly_salary !== undefined ? meta.monthly_salary : p.monthly_salary;
      const remunerationType = meta.remuneration_type || p.remuneration_type || DEFAULT_REMUNERATION_TYPE;
      const mergedProf = { 
        ...p, 
        monthly_salary: remunerationType !== 'mensal'
          ? legacySalary
          : hasUnitSalary
            ? monthlyByUnit[String(unitId)]
            : Object.keys(monthlyByUnit).length > 0
              ? String(primaryUnitId) === String(unitId) ? legacySalary : 0
              : legacySalary,
        hourly_rate: meta.hourly_rate !== undefined ? meta.hourly_rate : p.hourly_rate, 
        daily_rate: meta.daily_rate !== undefined ? meta.daily_rate : p.daily_rate, 
        remuneration_type: remunerationType
      };
      if (p.id) byId[p.id] = mergedProf;
      if (p.name) byName[normalizeStr(p.name)] = mergedProf;
    });
    return { profById: byId, profByName: byName };
  }, [professionals, unitId]);

  // Em "Todas as unidades", os plantões de todas; senão, os da unidade escolhida.
  const unitShifts = useMemo(() => {
    return (shifts || []).filter(s => (isAllUnits ? scopeUnitIds.includes(String(s.unit_id)) : String(s.unit_id) === String(unitId)) && s.status !== 'cancelado');
  }, [shifts, unitId, isAllUnits, scopeUnitIds]);

  const todayShifts = useMemo(() => {
    return unitShifts
      .filter((s) => {
        const sDate = (s.date || '').split('T')[0];
        const status = computeShiftLiveStatus(s, currentTime);
        return sDate === todayStr || status.isLive;
      })
      .map((s) => {
        const liveStatus = computeShiftLiveStatus(s, currentTime);
        return { ...s, lifecycle: { state: liveStatus.state, detail: liveStatus.detail } };
      })
      .sort((a, b) => {
        const order = { active: 0, upcoming: 1, concluded: 2 };
        return (order[a.lifecycle.state] ?? 99) - (order[b.lifecycle.state] ?? 99);
      });
  }, [unitShifts, todayStr, currentTime]);

  const activeNowList = useMemo(() => todayShifts.filter((s) => s.lifecycle.state === 'active' && !isVacantShift(s)), [todayShifts]);
  const upcomingList = useMemo(() => todayShifts
    .filter((s) => s.lifecycle.state === 'upcoming' && !isVacantShift(s))
    .sort((a, b) =>
      String(a.date || '').split('T')[0].localeCompare(String(b.date || '').split('T')[0]) ||
      String(a.start_time || '').localeCompare(String(b.start_time || ''))
    ), [todayShifts]);
  const concludedList = useMemo(() => todayShifts.filter((s) => s.lifecycle.state === 'concluded' && !isVacantShift(s)), [todayShifts]);

  const monthlyShifts = useMemo(() => unitShifts.filter(shift =>
    String(shift.date || '').split('T')[0].startsWith(monthPrefix)
  ), [unitShifts, monthPrefix]);

  // Inclui vagas futuras e turnos descobertos que já passaram neste mês.
  const vacantShifts = useMemo(() => {
    return monthlyShifts
      .filter(isVacantShift)
      .map(s => ({
        ...s, 
        sectorName: toTitleCase(s.sector_name || sectors.find(sec => String(sec.id) === String(s.sector_id))?.name || 'Setor Geral'), 
        formattedDate: fmtDate(s.date) 
      }))
      // Próximas vagas primeiro (as que ainda dá para preencher); furos já passados ao final.
      .map(s => ({ ...s, isOverdue: (getShiftDateTimeRange(s)?.end?.getTime() || 0) < currentMinute * 60000 }))
      .sort((a, b) => (a.isOverdue - b.isOverdue) ||
        (a.isOverdue
          ? (b.date || '').localeCompare(a.date || '')
          : (a.date || '').localeCompare(b.date || '') || String(a.start_time || '').localeCompare(String(b.start_time || ''))));
  // Reavalia por minuto (não a cada segundo do relógio).
  }, [monthlyShifts, sectors, currentMinute]);
  // Vagas que ainda dá para preencher nos próximos 7 dias, e furos do mês (já passaram sem ninguém).
  const nextWeekLimit = useMemo(() => { const d = new Date(currentTime); d.setDate(d.getDate() + 7); return getLocalDateString(d); }, [todayStr]); // eslint-disable-line react-hooks/exhaustive-deps
  const upcomingVacancies = useMemo(() => vacantShifts.filter(v => !v.isOverdue && String(v.date || '').slice(0, 10) <= nextWeekLimit), [vacantShifts, nextWeekLimit]);
  const overdueVacancies = useMemo(() => vacantShifts.filter(v => v.isOverdue), [vacantShifts]);
  const visibleVacantShifts = showAllVacantShifts ? upcomingVacancies : upcomingVacancies.slice(0, 5);

  const todayFinancials = useMemo(() => {
    let executedValue = 0; let plannedValue = 0; let shiftsMissingRate = 0; let shiftsAwaitingProduction = 0;
    todayShifts.forEach((s) => {
      // O custo do dia considera só plantões com data de hoje (mesma regra de
      // Relatórios/Faturamento). O noturno de ontem que ainda está ativo já foi
      // contabilizado na data dele e não pode ser somado duas vezes.
      if ((s.date || '').split('T')[0] !== todayStr) return;
      const matched = profById[s.professional_id] || profByName[normalizeStr(s.professional_name)];
      const prof = matched ? mergeProfForUnit(rawProfById[String(matched.id)] || matched, s.unit_id || unitId) : null;
      if (isVacantShift(s)) return;
      if (!prof) {
        shiftsMissingRate += 1;
        return;
      }
      const estimate = getShiftCostEstimate(prof, s);
      const shiftCost = estimate.amount;
      if (estimate.missingRate) shiftsMissingRate += 1;
      if (estimate.requiresProduction) shiftsAwaitingProduction += 1;
      plannedValue += shiftCost;
      if (s.lifecycle.state === 'active' || s.lifecycle.state === 'concluded') {
        executedValue += shiftCost;
      }
    });
    return { executedValue, plannedValue, totalToday: plannedValue, shiftsMissingRate, shiftsAwaitingProduction };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayShifts, profById, profByName, rawProfById, todayStr, unitId]);

  const sectorsCoverage = useMemo(() => {
    const map = {};
    (sectors || []).forEach((sec) => { 
      map[sec.id] = { id: sec.id, name: toTitleCase(sec.name), specialty: sec.specialty || 'Geral', total: 0, active: 0, upcoming: 0, concluded: 0, vacant: 0 };
    });
    todayShifts.forEach((s) => {
      const secId = s.sector_id || 'sem_setor';
      if (!map[secId]) map[secId] = { id: secId, name: toTitleCase(s.sector_name || 'Setor não informado'), specialty: 'Geral', total: 0, active: 0, upcoming: 0, concluded: 0, vacant: 0 };
      map[secId].total += 1;
      const isVacant = isVacantShift(s);
      if (!isVacant && s.lifecycle.state === 'active') map[secId].active += 1;
      if (!isVacant && s.lifecycle.state === 'upcoming') map[secId].upcoming += 1;
      if (!isVacant && s.lifecycle.state === 'concluded') map[secId].concluded += 1;
      if (isVacant) map[secId].vacant += 1;
    });
    return Object.values(map);
  }, [sectors, todayShifts]);

  const nextHandover = useMemo(() => {
    if (upcomingList.length === 0) return null;
    const nextStart = upcomingList[0].start_time;
    const incoming = upcomingList.filter((s) => s.start_time === nextStart);
    const outgoing = activeNowList.filter((s) => s.end_time === nextStart);
    return { targetTime: nextStart, incoming, outgoing };
  }, [upcomingList, activeNowList]);

  const globalFillRate = useMemo(() => {
    if (monthlyShifts.length === 0) return null;
    const vacantMonthCount = vacantShifts.length;
    return Math.round(((monthlyShifts.length - vacantMonthCount) / monthlyShifts.length) * 100);
  }, [monthlyShifts, vacantShifts]);


  // Escalas é por hospital: se o item for de outra unidade, troca a unidade e abre Escalas.
  const openEscalasFor = (targetUnitId) => {
    if (targetUnitId && String(targetUnitId) !== String(selectedUnitId)) requestUnitSwitch(targetUnitId, '/escalas');
    else navigate('/escalas');
  };

  const handleResolveAlert = (vs) => {
    if (vs?.sector_id) window.localStorage.setItem('scale_filter_sector_id', String(vs.sector_id));
    if (vs?.id) window.localStorage.setItem('scale_auto_open_shift_id', String(vs.id));
    openEscalasFor(vs?.unit_id);
  };

  const handleNavigateToSectorScale = (secId) => {
    if (secId) window.localStorage.setItem('scale_filter_sector_id', String(secId));
    openEscalasFor(sectors.find(sec => String(sec.id) === String(secId))?.unit_id);
  };

  const openTvMode = async () => { setTvMode(true); try { await document.documentElement.requestFullscreen?.(); } catch {} };
  const closeTvMode = async () => { setTvMode(false); if (document.fullscreenElement) await document.exitFullscreen?.(); };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando painel...</div>;
  }

  if (tvMode) {
    return (
      <div className="fixed inset-0 z-[99999] bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-5 lg:p-7 select-none overflow-hidden font-sans">
        <button onClick={closeTvMode} className="lg:hidden fixed top-4 right-4 z-[99999] p-2.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 shadow-xl cursor-pointer hover:bg-slate-700"><X className="w-5 h-5" /></button>
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0 pr-12 lg:pr-0">
          <div className="flex items-center gap-3 sm:gap-4 max-w-[85%] sm:max-w-none">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-sm shrink-0"><Radio className="w-5 h-5 sm:w-7 sm:h-7 animate-pulse text-white" /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs sm:text-xs font-semibold text-sky-400 truncate"><span className="truncate max-w-[150px] sm:max-w-none">{dashboardTitle}</span><span className="hidden sm:inline">•</span><span className="hidden sm:flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> CCO AO VIVO</span></div>
              <h1 className="text-lg sm:text-2xl lg:text-4xl font-semibold tracking-tight text-white mt-0.5 truncate">Centro de Comando</h1>
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium truncate">{fmtDateLong(currentTime)}, {fmtDate(todayStr)} · Telemetria</p>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-5">
            <div className={`px-4 py-2.5 rounded-2xl border flex items-center gap-3 ${vacantShifts.length > 0 ? 'bg-rose-500/10 border-rose-500/40 text-rose-300' : monthlyShifts.length > 0 ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-amber-500/10 border-amber-500/40 text-amber-300'}`}><div className={`w-3 h-3 rounded-full ${vacantShifts.length > 0 ? 'bg-rose-500 animate-ping' : monthlyShifts.length > 0 ? 'bg-emerald-400' : 'bg-amber-400'}`} /><div><div className="text-xs font-semibold">{vacantShifts.length > 0 ? 'Alerta Assistencial' : monthlyShifts.length > 0 ? 'Sem vagas descobertas' : 'Escala não cadastrada'}</div><div className="text-[10px] font-semibold opacity-80">{vacantShifts.length > 0 ? `${vacantShifts.length} vaga(s) desocupada(s) no mês` : monthlyShifts.length > 0 ? 'Plantões cadastrados sem vagas em aberto' : 'Nenhum plantão cadastrado neste mês'}</div></div></div>
            <div className="bg-slate-900 border border-slate-800 px-5 py-2.5 rounded-2xl text-right"><div className="text-2xl lg:text-4xl font-semibold tabular-nums tracking-tight text-cyan-400">{currentTime.toLocaleTimeString('pt-BR')}</div><div className="text-xs font-medium text-slate-500">Oficial CCO</div></div>
            <button title="Sair da tela cheia" onClick={closeTvMode} className="p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer"><Minimize2 className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="flex-1 my-4 overflow-y-auto lg:overflow-hidden pr-1 pb-16 lg:pb-0">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-5 lg:h-full">
            <div className="lg:col-span-2 rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 shadow-sm flex flex-col h-auto lg:h-full lg:overflow-hidden">
              <div className="flex flex-col flex-1 h-full lg:overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 shrink-0"><div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-sky-400"><Building2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" /> Cobertura Setores</div><span className="text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-1 rounded-xl bg-slate-800 text-slate-300 whitespace-nowrap">{sectorsCoverage.length} auditados</span></div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 lg:overflow-y-auto pr-1 pb-1">
                  {sectorsCoverage.map((sec) => {
                    const hasShifts = sec.total > 0; const percent = hasShifts ? Math.round((sec.active / sec.total) * 100) : 0; const hasVacant = sec.vacant > 0;
                    return (
                      <div key={sec.id} className={`p-3.5 rounded-2xl border flex flex-col justify-between transition-all ${hasVacant ? 'border-rose-500/80 bg-rose-950/30 shadow-sm' : sec.active > 0 ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-slate-800/80 bg-slate-900/40'}`}>
                        <div>
                          <div className="flex items-center justify-between"><h3 className="font-semibold text-xs sm:text-sm text-white truncate max-w-[150px]">{sec.name}</h3><span className={`text-xs sm:text-xs font-semibold px-2 py-0.5 rounded-full  whitespace-nowrap ${hasVacant ? 'bg-rose-500 text-white font-semibold animate-pulse' : sec.active > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>{hasVacant ? `${sec.vacant} descoberto(s)` : sec.active > 0 ? `${sec.active} em andamento` : hasShifts && sec.upcoming > 0 ? `${sec.upcoming} a assumir` : hasShifts ? `${sec.concluded} concluído(s)` : 'Sem plantão'}</span></div>
                          <div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-400 mt-2 font-medium"><span>Em andamento / turnos do dia</span><strong className="text-white tabular-nums">{sec.active} / {sec.total}</strong></div>
                          <div className="w-full h-2 bg-slate-800 rounded-full mt-2 overflow-hidden"><div className={`h-full transition-all duration-500 ${hasVacant ? 'bg-rose-500' : sec.active > 0 ? 'bg-emerald-400' : 'bg-transparent'}`} style={{ width: `${hasShifts ? Math.min(100, Math.max(6, percent)) : 0}%` }} /></div>
                        </div>
                        <div className="pt-2">{hasVacant ? <div className="text-[10px] sm:text-[11px] text-rose-400 font-semibold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {sec.vacant} desfalque(s)</div> : <div className="text-[10px] sm:text-[10px] text-slate-400 font-medium">{hasShifts ? `${sec.active} em andamento · ${sec.upcoming} a assumir · ${sec.concluded} concluído(s)` : 'Nenhum plantão hoje'}</div>}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] sm:text-xs text-slate-400 font-medium shrink-0"><span>Cobertura mensal: <b className="text-white tabular-nums text-xs sm:text-sm">{globalFillRate === null ? '—' : `${globalFillRate}%`}</b></span><span className="text-sky-400 hidden sm:block">Auditoria Contínua</span></div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 shadow-sm flex flex-col h-auto lg:h-full lg:overflow-hidden">
              <div className="flex flex-col flex-1 h-full lg:overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 shrink-0"><span className="text-xs font-semibold text-emerald-400 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" /> Em andamento ({activeNowList.length})</span><span className="text-[10px] tabular-nums text-slate-400 hidden sm:block">PELO HORÁRIO DA ESCALA</span></div>
                <div className="flex-1 space-y-2.5 lg:overflow-y-auto pr-1 pb-1">
                  {activeNowList.length === 0 ? <div className="py-10 text-center text-xs text-slate-500">Nenhum plantão alocado está em andamento agora.</div> : activeNowList.map(s => {
                    const prof = profById[s.professional_id] || profByName[normalizeStr(s.professional_name)]; const profName = toTitleCase(prof?.name || s.professional_name || 'Profissional'); const sectorName = toTitleCase(s.sector_name || sectors.find(sec => String(sec.id) === String(s.sector_id))?.name || 'Setor Geral');
                    return (
                      <div key={s.id} className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/40 flex items-center justify-between shadow-sm">
                        <div className="min-w-0 pr-2"><span className="text-xs sm:text-xs text-emerald-400 tabular-nums font-semibold block truncate">🏥 {sectorName}</span><div className="font-semibold text-xs sm:text-sm text-white truncate mt-0.5">Dr(a). {profName}</div><span className="text-[10px] sm:text-[10px] text-slate-400 tabular-nums block mt-0.5">{s.start_time} às {s.end_time}</span></div>
                        <span className="text-[10px] sm:text-[10px] tabular-nums font-semibold text-emerald-300 bg-emerald-500/20 px-2 sm:px-2.5 py-1.5 rounded-xl shrink-0 border border-emerald-500/30 whitespace-nowrap">{s.lifecycle.detail}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4 h-auto lg:h-full lg:overflow-hidden">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 shadow-sm flex-1 flex flex-col h-auto lg:h-full lg:overflow-hidden">
                <div className="flex flex-col flex-1 h-full lg:overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-2.5 shrink-0"><div className="flex items-center gap-2 text-xs sm:text-xs font-semibold text-sky-400"><ArrowRightLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Próxima Passagem</div>{nextHandover && <span className="text-[10px] sm:text-xs tabular-nums font-semibold px-2 py-0.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30">{nextHandover.targetTime}</span>}</div>
                  <div className="flex-1 lg:overflow-y-auto pr-1">
                    {nextHandover ? (
                      <div className="space-y-2.5">
                        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30"><span className="text-xs sm:text-xs font-semibold text-emerald-400 block mb-1">Equipe que Assume ({nextHandover.incoming.length})</span>{nextHandover.incoming.slice(0, 4).map((s) => (<div key={s.id} className="text-[10px] sm:text-xs flex items-center justify-between py-0.5"><span className="font-semibold text-white truncate pr-2">{toTitleCase(profById[s.professional_id]?.name || getShiftProfessionalName(s))}</span><span className="text-[10px] sm:text-[10px] text-slate-400 shrink-0">{toTitleCase(s.sector_name)}</span></div>))}</div>
                        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800"><span className="text-xs sm:text-xs font-medium text-slate-400 block mb-1">Equipe que Entrega ({nextHandover.outgoing.length})</span>{nextHandover.outgoing.length === 0 ? <span className="text-[10px] sm:text-xs text-slate-500 italic">Nenhum encerrando às {nextHandover.targetTime}.</span> : nextHandover.outgoing.slice(0, 4).map((s) => (<div key={s.id} className="text-[10px] sm:text-xs flex items-center justify-between py-0.5"><span className="font-medium text-slate-300 truncate pr-2">{toTitleCase(profById[s.professional_id]?.name || getShiftProfessionalName(s))}</span><span className="text-[10px] sm:text-[10px] text-slate-500 shrink-0">{toTitleCase(s.sector_name)}</span></div>))}</div>
                      </div>
                    ) : <div className="py-10 text-center text-[10px] sm:text-xs text-slate-500">Nenhuma troca prevista.</div>}
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-4 shadow-sm space-y-1.5 shrink-0">
                <span className="text-xs sm:text-xs font-semibold text-amber-400 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Custo Operacional</span>
                <div className="text-xl sm:text-2xl lg:text-3xl font-semibold tabular-nums text-white">R$ {todayFinancials.executedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 flex justify-between"><span>Previsão 24h:</span><b className="tabular-nums text-white">R$ {todayFinancials.totalToday.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>
                {todayFinancials.shiftsMissingRate > 0 && <div className="text-[10px] font-semibold text-amber-300">{todayFinancials.shiftsMissingRate} plantão(ões) sem tarifa</div>}
                {todayFinancials.shiftsAwaitingProduction > 0 && <div className="text-[10px] font-semibold text-amber-300">{todayFinancials.shiftsAwaitingProduction} aguardando apuração</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6 font-sans bg-slate-100 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      
      {isManager && daysToExpiration !== null && daysToExpiration <= 5 && daysToExpiration >= 0 && (
        <div className="bg-rose-600 border border-rose-500 p-4 rounded-3xl text-white shadow-sm flex items-center gap-3 animate-in fade-in">
          <AlertTriangle className="w-8 h-8 animate-pulse shrink-0" />
          <div>
            <h2 className="text-base font-semibold">Aviso Crítico de Renovação</h2>
            <p className="text-sm font-medium">Seu contrato com a ScaleMedic expira em <b>{daysToExpiration} dia(s)</b>. Entre em contato para renovar, ou todas as suas unidades serão bloqueadas após o vencimento.</p>
          </div>
        </div>
      )}

      <PageHero
        title={dashboardTitle}
        subtitle={`${fmtDate(todayStr)} · o que precisa de atenção e quem está de plantão${isAllUnits ? ' em todas as unidades' : ''}.`}
        actions={t => (
          <Button onClick={openTvMode} className={`hidden sm:inline-flex font-medium text-sm h-11 px-4 rounded-xl gap-2 shrink-0 cursor-pointer shadow-none ${t.outline}`}>
            <Radio className={`w-4 h-4 ${t.outlineIcon}`} /> Modo TV
          </Button>
        )}
      />

      {isManager && (
        <OnboardingChecklist
          companyId={company?.id}
          user={user}
          units={managedUnits}
          sectors={allCompanySectors.length ? allCompanySectors : sectors}
          professionals={allCompanyProfessionals.length ? allCompanyProfessionals : professionals}
          shifts={allCompanyShifts.length ? allCompanyShifts : shifts}
          publishedRanges={publishedRanges}
        />
      )}

      {multiUnit && <UnitsOverview units={managedUnits} shifts={allCompanyShifts} scope={effectiveScope} onScopeChange={changeScope} now={currentTime} />}

      {isManager && (() => {
        const attention = upcomingVacancies.length + overdueVacancies.length + unsubmittedSectors.length + todayFinancials.shiftsMissingRate + todayFinancials.shiftsAwaitingProduction;
        if (!attention) {
          return monthlyShifts.length > 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-sm text-slate-700 dark:text-slate-200"><b className="font-semibold">Tudo em dia.</b> Sem vagas nos próximos 7 dias, sem furos e com a escala do mês publicada.</p>
            </div>
          ) : null;
        }
        return (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Precisa de você</h2>
            <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {upcomingVacancies.length > 0 && (
                <li className="py-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{upcomingVacancies.length} vaga(s) sem profissional nos próximos 7 dias</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {visibleVacantShifts.map(vs => (
                          <button key={vs.id} type="button" onClick={() => handleResolveAlert(vs)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500 cursor-pointer">
                            <b className="font-semibold">{vs.sectorName}</b> · {vs.formattedDate} · {vs.start_time}–{vs.end_time}
                          </button>
                        ))}
                        {upcomingVacancies.length > 5 && (
                          <button type="button" onClick={() => setShowAllVacantShifts(v => !v)} className="px-2 text-xs font-medium text-sky-700 dark:text-sky-300 hover:underline cursor-pointer">
                            {showAllVacantShifts ? 'Mostrar menos' : `Ver mais ${upcomingVacancies.length - 5}`}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              )}
              {overdueVacancies.length > 0 && (
                <li className="py-3 flex items-start gap-3">
                  <span className="mt-1 w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                  <div className="min-w-0 flex-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-900 dark:text-white"><b className="font-medium">{overdueVacancies.length} furo(s) em {MONTH_NAMES[currentMonth].toLowerCase()}</b> <span className="text-slate-500 dark:text-slate-400">— plantões que passaram sem ninguém. Corrija na escala ou registre quem cobriu.</span></p>
                    <Button type="button" variant="outline" onClick={() => handleResolveAlert(overdueVacancies[0])} className="h-8 px-3 rounded-lg text-xs cursor-pointer">Abrir na escala</Button>
                  </div>
                </li>
              )}
              {unsubmittedSectors.length > 0 && (
                <li className="py-3 flex items-start gap-3">
                  <span className="mt-1 w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{unsubmittedSectors.length} setor(es) com a escala de {MONTH_NAMES[currentMonth].toLowerCase()} ainda em rascunho</p>
                      <Button type="button" variant="outline" onClick={() => navigate('/escalas')} className="h-8 px-3 rounded-lg text-xs gap-1.5 cursor-pointer"><Send className="w-3.5 h-3.5" /> Abrir escala</Button>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {unsubmittedSectors.map((sec, idx) => (
                        <span key={sec.id}>{idx > 0 && ' · '}<button type="button" onClick={() => handleNavigateToSectorScale(sec.id)} className="hover:underline cursor-pointer">{sec.name}</button></span>
                      ))}
                    </p>
                  </div>
                </li>
              )}
              {(todayFinancials.shiftsMissingRate > 0 || todayFinancials.shiftsAwaitingProduction > 0) && (
                <li className="py-3 flex items-start gap-3">
                  <span className="mt-1 w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <div className="min-w-0 flex-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-900 dark:text-white">
                      {todayFinancials.shiftsMissingRate > 0 && <span className="font-medium">{todayFinancials.shiftsMissingRate} plantão(ões) de hoje sem valor cadastrado. </span>}
                      {todayFinancials.shiftsAwaitingProduction > 0 && <span className="font-medium">{todayFinancials.shiftsAwaitingProduction} aguardando o lançamento da produção. </span>}
                      <span className="text-slate-500 dark:text-slate-400">O custo do dia fica incompleto até isso ser resolvido.</span>
                    </p>
                    <Button type="button" variant="outline" onClick={() => navigate('/faturamento')} className="h-8 px-3 rounded-lg text-xs cursor-pointer">Abrir faturamento</Button>
                  </div>
                </li>
              )}
            </ul>
          </section>
        );
      })()}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Em andamento agora', String(activeNowList.length), activeNowList.length ? 'plantão(ões) acontecendo' : 'ninguém de plantão agora'],
          ['Plantões hoje', String(todayShifts.length), `${upcomingList.length} a iniciar · ${concludedList.length} concluído(s)`],
          [`Cobertura de ${MONTH_NAMES[currentMonth].toLowerCase()}`, globalFillRate === null ? '—' : `${globalFillRate}%`, globalFillRate === null ? 'sem plantões no mês' : `${vacantShifts.length} vaga(s) sem profissional`],
          ['Custo de hoje', `R$ ${todayFinancials.executedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, `previsto no dia: R$ ${todayFinancials.totalToday.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]
        ].map(([label, value, hint]) => (
          <div key={label} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 min-w-0">
            <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white truncate">{value}</div>
            <div className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">{hint}</div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Hoje por setor</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">{sectorsCoverage.filter(sec => sec.total > 0).length} de {sectorsCoverage.length} setor(es) com plantão hoje</span>
        </div>
        {todayShifts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Nenhum plantão hoje{isAllUnits ? ' nas unidades' : ' nesta unidade'}.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {sectorsCoverage.filter(sec => sec.total > 0).map(sec => {
              const secShifts = todayShifts.filter(sh => String(sh.sector_id || 'sem_setor') === String(sec.id));
              return (
                <div key={sec.id} className="rounded-xl border border-slate-200 dark:border-slate-800">
                  <button type="button" onClick={() => handleNavigateToSectorScale(sec.id)} className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-t-xl">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{sec.name}</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-xs">
                      {sec.active > 0 && <span className="rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{sec.active} em andamento</span>}
                      {sec.upcoming > 0 && <span className="rounded-full px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{sec.upcoming} a iniciar</span>}
                      {sec.vacant > 0 && <span className="rounded-full px-2 py-0.5 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{sec.vacant} vaga(s)</span>}
                      {sec.concluded > 0 && !sec.active && !sec.upcoming && !sec.vacant && <span className="rounded-full px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">concluído</span>}
                    </span>
                  </button>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
                    {secShifts.map(shift => {
                      const vago = isVacantShift(shift);
                      const st = shift.lifecycle.state;
                      return (
                        <li key={shift.id} className={`flex items-center gap-3 px-4 py-2 text-sm ${st === 'concluded' && !vago ? 'opacity-60' : ''}`}>
                          <span className="w-24 shrink-0 tabular-nums text-xs text-slate-500 dark:text-slate-400">{shift.start_time}–{shift.end_time}</span>
                          <span className={`flex-1 min-w-0 truncate ${vago ? 'text-rose-700 dark:text-rose-300' : 'text-slate-900 dark:text-white'}`}>
                            {vago ? 'Sem profissional' : toTitleCase(shift.professional_name)}
                            {isAllUnits && unitNameById[String(shift.unit_id)] ? <span className="text-slate-400"> · {unitNameById[String(shift.unit_id)]}</span> : null}
                          </span>
                          <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 shrink-0">{vago ? 'vaga aberta' : st === 'active' ? 'em andamento' : st === 'concluded' ? 'concluído' : 'a iniciar'}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            {sectorsCoverage.some(sec => sec.total === 0) && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium text-slate-600 dark:text-slate-300">Sem plantão hoje:</span>{' '}
                {sectorsCoverage.filter(sec => sec.total === 0).map(sec => sec.name).join(' · ')}
              </p>
            )}
          </div>
        )}
      </section>

      {isManager && (
        <MonthTrend
          shifts={unitShifts}
          professionals={professionals}
          sectors={sectors}
          now={currentTime}
          onOpenDay={date => {
            const vacancy = vacantShifts.find(v => String(v.date || '').slice(0, 10) === date);
            if (vacancy) handleResolveAlert(vacancy);
          }}
        />
      )}

      {isManager && (
        <TeamCare
          shifts={unitShifts}
          professionals={professionals}
          sectors={sectors}
          company={company}
          user={user}
          now={currentTime}
          onChanged={syncGlobalData}
        />
      )}
    </div>
  );
}