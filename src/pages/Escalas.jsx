import { useEffect, useState, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, Pencil, Trash2, Search, Download, CalendarDays, UsersRound, 
  Maximize2, Minimize2, MessageCircle, Filter, UserPlus, X, Sun, Moon, 
  Building2, Activity, LayoutGrid, List, ChevronDown, ChevronRight
} from 'lucide-react';
import ShiftFormDialog from '@/components/shifts/ShiftFormDialog';
import { exportSchedulePDF } from '@/lib/exportReport';
import { getShiftTvLifecycle } from '@/lib/shiftUtils';

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
  const [year, month, day] = dateStr.split('T')[0].split('-');
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return `${day}/${month} (${WEEKDAYS_SHORT[d.getDay()] || ''})`;
}

function getMonthDays(monthStr) {
  if (!monthStr) monthStr = getLocalDateString().slice(0,7);
  const [y, m] = monthStr.split('-');
  const daysInMonth = new Date(y, m, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => i + 1);
}

function normalizeStr(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function toTitleCase(str) {
  if (!str) return '';
  const acr = ['UTI', 'UCO', 'PA', 'PS', 'CRM', 'COREN'];
  return str.toLowerCase().split(' ').map(w => acr.includes(w.toUpperCase()) ? w.toUpperCase() : (['de', 'da', 'do', 'e'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

export default function Escalas() {
  const { user, company, loading: appLoading } = useAppData();
  const [shifts, setShifts] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  
  // Controles de Visão e Filtros
  const [viewMode, setViewMode] = useState('matrix'); // 'list' ou 'matrix'
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [quickFilter, setQuickFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(() => getLocalDateString().slice(0,7));
  const [selectedDate, setSelectedDate] = useState('');
  const [tvMode, setTvMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [duplicating, setDuplicating] = useState(false);
  
  // Controle do Acordeão na Matriz
  const [collapsedSectors, setCollapsedSectors] = useState({});

  const userId = user?.id;
  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id || 'unit_h1';
  const isManager = user?.role === 'admin' || user?.data?.app_role === 'manager' || user?.data?.app_role === 'gestor';

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const f = { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) };
      const [s, sec, p] = await Promise.all([
        base44.entities.Shift.filter(f, '-date', 2000), 
        base44.entities.Sector.filter(f, '-created_date', 100),
        base44.entities.Professional.filter(f, '-created_date', 400),
      ]);
      setShifts(s || []);
      setSectors(sec || []);
      setProfessionals(p || []);
    } catch (e) {
      console.error('Erro ao buscar escalas:', e);
    }
  }, [companyId, unitId]);

  useEffect(() => { if (!appLoading) load(); }, [appLoading, load]);
  useEffect(() => { const id = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(id); }, []);

  const myProfessional = useMemo(() => professionals.find((p) => p.user_id === userId || p.email === user?.email || p.name === user?.full_name), [professionals, userId, user]);
  const profMap = useMemo(() => Object.fromEntries(professionals.map((p) => [p.id, p])), [professionals]);

  const monthOptions = useMemo(() => {
    return [...new Set(shifts.map((s) => (s.date ? s.date.slice(0, 7) : '')))].filter(Boolean).sort().reverse();
  }, [shifts]);

  // Aplicação dos Filtros
  const filtered = useMemo(() => {
    const term = normalizeStr(search);
    return shifts
      .filter((s) => {
        if (s.status === 'cancelado') return false;
        // TRAVA DE SEGURANÇA 1: Garante que tem data
        const sDate = s.date ? s.date.split('T')[0] : '';
        if (!sDate) return false;

        const monthMatch = !selectedMonth || sDate.startsWith(selectedMonth);
        const dateMatch = !selectedDate || sDate === selectedDate;
        const profNameNorm = normalizeStr(s.professional_name);
        const sectorNameNorm = normalizeStr(s.sector_name);
        const matchSearch = !term || profNameNorm.includes(term) || sectorNameNorm.includes(term);
        const matchSector = sectorFilter === 'all' || s.sector_id === sectorFilter;
        const personalScope = isManager || s.professional_id === myProfessional?.id || s.professional_name === myProfessional?.name;
        
        return dateMatch && monthMatch && matchSearch && matchSector && personalScope;
      })
      .map((s) => ({
        ...s,
        lifecycle: getShiftTvLifecycle(s, currentTime),
        isVacant: !s.professional_id || (s.professional_name || '').toLowerCase().includes('vaga')
      }))
      .filter((s) => {
        if (quickFilter === 'active') return s.lifecycle.state === 'active';
        if (quickFilter === 'upcoming') return s.lifecycle.state === 'upcoming';
        if (quickFilter === 'concluded') return ['concluded', 'recently_finished'].includes(s.lifecycle.state);
        if (quickFilter === 'vacant') return s.isVacant;
        
        const sTime = s.start_time || '00:00';
        if (quickFilter === 'diurno') return s.shift_type === 'diurno' || (sTime >= '06:00' && sTime < '18:00');
        if (quickFilter === 'noturno') return s.shift_type === 'noturno' || (sTime >= '18:00' || sTime < '06:00');
        return true;
      });
  }, [shifts, search, sectorFilter, quickFilter, selectedMonth, selectedDate, isManager, myProfessional, currentTime]);

  const auditStats = useMemo(() => {
    const total = filtered.length;
    const vacant = filtered.filter((s) => s.isVacant).length;
    const filled = total - vacant;
    const fillRate = total > 0 ? Math.round((filled / total) * 100) : 100;
    const totalHours = filtered.reduce((acc, s) => acc + (Number(s.duration_hours) || 12), 0);
    return { total, filled, vacant, fillRate, totalHours };
  }, [filtered]);

  // =========================================================================
  // MOTOR DA MATRIZ ENTERPRISE (GANTT MENSAL)
  // =========================================================================
  const matrixDaysArray = useMemo(() => getMonthDays(selectedMonth), [selectedMonth]);
  
  const matrixData = useMemo(() => {
    const groups = {};
    filtered.forEach(shift => {
      // TRAVA DE SEGURANÇA 2: Nunca tenta dar split em nulo na Matriz
      const sDate = shift.date ? shift.date.split('T')[0] : '';
      if (!sDate) return; 

      const dayPart = sDate.split('-')[2];
      const day = dayPart ? parseInt(dayPart, 10) : 0;
      if (!day) return;

      const secId = shift.sector_id || 'geral';
      const secName = shift.sector_name || 'Geral';
      
      const profId = shift.isVacant ? `vaga_${secId}` : (shift.professional_id || 'vaga_geral');
      const profName = shift.isVacant ? '⚠️ VAGAS DESCOBERTAS' : (toTitleCase(shift.professional_name) || 'Não Informado');
      const cat = profMap[shift.professional_id]?.category || 'outro';

      if (!groups[secId]) groups[secId] = { id: secId, name: secName, profs: {} };
      if (!groups[secId].profs[profId]) groups[secId].profs[profId] = { id: profId, name: profName, isVacant: shift.isVacant, category: cat, shiftsByDay: {} };
      
      if (!groups[secId].profs[profId].shiftsByDay[day]) groups[secId].profs[profId].shiftsByDay[day] = [];
      groups[secId].profs[profId].shiftsByDay[day].push(shift);
    });

    return Object.values(groups).map(sec => ({
      ...sec,
      profsList: Object.values(sec.profs).sort((a, b) => {
        if (a.isVacant && !b.isVacant) return -1;
        if (!a.isVacant && b.isVacant) return 1;
        return (a.name || '').localeCompare(b.name || '');
      })
    })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [filtered, profMap]);

  const toggleSectorCollapse = (secId) => {
    setCollapsedSectors(prev => ({ ...prev, [secId]: !prev[secId] }));
  };

  const expandAllSectors = () => setCollapsedSectors({});
  const collapseAllSectors = () => {
    const all = {};
    matrixData.forEach(s => all[s.id] = true);
    setCollapsedSectors(all);
  };

  // AÇÕES DO SISTEMA
  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja cancelar este plantão?\nEle não aparecerá na escala, mas ficará salvo para auditoria.')) return;
    try {
        const cancelNote = `Cancelado por ${user?.full_name || 'Gestor'} em ${new Date().toLocaleString('pt-BR')} para ajustes de escala.`;
        await base44.entities.Shift.update(id, { status: 'cancelado', notes: cancelNote });
        load();
    } catch (e) { alert(e.message || 'Erro ao cancelar o plantão.'); }
  };

  const handleExportSchedule = () => {
    const sorted = [...filtered].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const dateLabel = selectedDate ? `${fmtDate(selectedDate)}` : (selectedMonth || 'Período Atual');
    exportSchedulePDF({ company: company || { name: 'ScaleMedic CGT', app_name: 'ScaleMedic' }, shifts: sorted, dateLabel });
  };

  const handleNotifyWhatsApp = (shift, e) => {
    if (e) e.stopPropagation();
    const prof = profMap[shift.professional_id];
    let phone = prof?.phone?.replace(/\D/g, '');
    if (!phone) { alert('Profissional sem telefone cadastrado.'); return; }
    if (phone.length === 10 || phone.length === 11) phone = `55${phone}`;
    
    const shiftDateFmt = shift.date ? shift.date.split('-').reverse().join('/') : '';
    const text = encodeURIComponent(`Olá, Dr(a). ${shift.professional_name}!\nConfirmando seu plantão no *${company?.name || 'Hospital'}*:\n📅 Data: *${shiftDateFmt}*\n⏰ Horário: *${shift.start_time} às ${shift.end_time}*\n🏥 Setor: *${shift.sector_name || 'Geral'}*\nBom plantão!`);
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const handleDuplicatePreviousMonth = async () => {
    if (!companyId) return;
    setDuplicating(true);
    try {
      const allShifts = await base44.entities.Shift.filter({ company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) }, '-date', 500);
      const monthKeys = [...new Set(allShifts.map((s) => getMonthKey(s.date)))].sort();
      const sourceMonthKey = monthKeys.length > 1 ? monthKeys[monthKeys.length - 2] : monthKeys[0];
      const sourceDate = new Date(`${sourceMonthKey}-01T00:00`);
      const targetDate = new Date(sourceDate.getFullYear(), sourceDate.getMonth() + 1, 1);
      const targetMonthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
      const sourceShifts = allShifts.filter((s) => getMonthKey(s.date) === sourceMonthKey && s.status !== 'cancelado');
      const existingTargetKeys = new Set(allShifts.filter((s) => getMonthKey(s.date) === targetMonthKey && s.status !== 'cancelado').map((s) => `${s.date}|${s.professional_id || 'vaga'}|${s.sector_id || 'setor'}`));

      let createdCount = 0;
      for (const shift of sourceShifts) {
        const sourceDay = new Date(shift.date + 'T00:00');
        const nextDay = new Date(sourceDay.getFullYear(), sourceDay.getMonth() + 1, sourceDay.getDate());
        const duplicateKey = `${getLocalDateString(nextDay)}|${shift.professional_id || 'vaga'}|${shift.sector_id || 'setor'}`;
        if (existingTargetKeys.has(duplicateKey)) continue;

        await base44.entities.Shift.create({
          ...shift, id: undefined, date: getLocalDateString(nextDay),
          unit_id: unitId, created_date: new Date().toISOString(), updated_date: new Date().toISOString()
        });
        createdCount++;
        existingTargetKeys.add(duplicateKey);
      }
      await load();
      window.alert(createdCount > 0 ? `Escala duplicada! ${createdCount} plantões criados no mês seguinte.` : 'Já existe uma cópia para o próximo mês.');
    } catch (e) { window.alert(e?.message || 'Erro ao duplicar.'); } finally { setDuplicating(false); }
  };

  // =========================================================================
  // RENDERIZAÇÃO DA INTERFACE MODO GESTOR
  // =========================================================================
  if (!isManager) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center h-full">
        <div className="text-center text-slate-500">
          Acesse "Minha Escala" no menu lateral para visualizar seus plantões.
        </div>
      </div>
    );
  }

  const getMatrixBlockColor = (shift) => {
    if (shift.isVacant) return 'bg-red-500 border-red-700 shadow-red-500/50 animate-pulse text-white';
    const sTime = shift.start_time || '00:00';
    const isNight = shift.shift_type === 'noturno' || (sTime >= '18:00' || sTime < '06:00');
    if (shift.lifecycle.state === 'active') return 'bg-emerald-500 border-emerald-600 shadow-emerald-500/40 text-white font-bold ring-2 ring-emerald-300';
    if (shift.lifecycle.state === 'concluded' || shift.lifecycle.state === 'recently_finished') return 'bg-slate-300 border-slate-400 text-slate-600 opacity-60';
    return isNight ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-sky-500 border-sky-600 text-white';
  };

  return (
    <div className="p-4 md:p-8 space-y-5 h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      {/* HEADER ENTERPRISE */}
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-6 text-white shadow-xl shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-400">
              <Activity className="h-4 w-4" /> Gestão Integrada de Plantões
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-tight">Painel de Escala Hospitalar</h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-3xl font-black text-white">{auditStats.total}</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Plantões</div>
            </div>
            <div className="h-10 w-px bg-white/15" />
            <div className="text-right">
              <div className={`text-3xl font-black ${auditStats.fillRate < 100 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {auditStats.fillRate}%
              </div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Cobertura</div>
            </div>
          </div>
        </div>
      </div>

      {/* BARRA DE CONTROLE */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 shrink-0 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'matrix' ? 'bg-white shadow-sm text-sky-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <LayoutGrid className="w-4 h-4" /> Matriz Mensal
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-sky-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <List className="w-4 h-4" /> Lista Diária
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200 mx-1 shrink-0" />

          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="h-9 rounded-xl border border-slate-200 px-3 text-xs bg-slate-50 font-semibold focus:ring-2 focus:ring-sky-500 shrink-0 cursor-pointer">
            <option value="">Todos os Meses</option>
            {monthOptions.map((m) => {
              const d = new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1);
              return <option key={m} value={m}>{d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</option>;
            })}
          </select>
          
          {viewMode === 'list' && (
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="h-9 w-auto text-xs shrink-0" />
          )}

          <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)} className="h-9 rounded-xl border border-slate-200 px-3 text-xs bg-slate-50 font-semibold shrink-0 cursor-pointer">
            <option value="all">Todos os Setores</option>
            {sectors.map((s) => <option key={s.id} value={s.id}>{toTitleCase(s.name)}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
          <Button variant="outline" onClick={handleExportSchedule} className="text-xs h-9 font-semibold border-slate-200">
            <Download className="w-3.5 h-3.5 mr-1.5" /> PDF
          </Button>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-sky-600 hover:bg-sky-700 text-white text-xs h-9 font-bold px-4 shadow-md shadow-sky-600/20">
            <Plus className="w-4 h-4 mr-1.5" /> Novo Plantão
          </Button>
        </div>
      </div>

      <Card className="flex-1 border-slate-200 shadow-sm overflow-hidden flex flex-col bg-white">
        
        {/* ===================== MODO MATRIZ ===================== */}
        {viewMode === 'matrix' && (
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-sky-500" /> Diurno</span>
                <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-indigo-600" /> Noturno</span>
                <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-500 ring-2 ring-emerald-300" /> Em Andamento</span>
                <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-500 animate-pulse" /> Vaga Descoberta</span>
              </div>
              <div className="flex gap-2">
                <button onClick={expandAllSectors} className="text-[10px] uppercase font-bold text-sky-600 hover:text-sky-800">Expandir Tudo</button>
                <span className="text-slate-300">|</span>
                <button onClick={collapseAllSectors} className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-800">Recolher Tudo</button>
              </div>
            </div>

            <div className="flex-1 overflow-auto relative custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse min-w-max">
                <thead className="sticky top-0 bg-white shadow-sm z-20">
                  <tr>
                    <th className="sticky left-0 bg-white z-30 w-64 p-3 border-b border-r border-slate-200 font-bold text-slate-800 uppercase tracking-wider">
                      Profissional / Setor
                    </th>
                    {matrixDaysArray.map(day => {
                      const refMonth = selectedMonth || getLocalDateString().slice(0, 7);
                      const isWeekend = [0, 6].includes(new Date(refMonth.split('-')[0], refMonth.split('-')[1] - 1, day).getDay());
                      return (
                        <th key={day} className={`p-2 min-w-[36px] border-b border-slate-200 text-center font-black ${isWeekend ? 'bg-slate-50 text-slate-400' : 'text-slate-700'}`}>
                          {day}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrixData.length === 0 ? (
                    <tr><td colSpan={matrixDaysArray.length + 1} className="p-10 text-center text-slate-400">Nenhum plantão neste mês.</td></tr>
                  ) : (
                    matrixData.map(sector => {
                      const isCollapsed = collapsedSectors[sector.id];
                      return (
                        <React.Fragment key={sector.id}>
                          <tr className="bg-slate-50 hover:bg-slate-100 transition-colors group cursor-pointer" onClick={() => toggleSectorCollapse(sector.id)}>
                            <td className="sticky left-0 bg-slate-50 group-hover:bg-slate-100 z-10 p-2 border-r border-slate-200">
                              <div className="flex items-center gap-2 font-black text-slate-800 uppercase tracking-wider text-[11px]">
                                {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-sky-600" />}
                                <Building2 className="w-3.5 h-3.5 text-slate-400" /> {sector.name}
                              </div>
                            </td>
                            {matrixDaysArray.map(day => <td key={day} className="bg-slate-50" />)}
                          </tr>

                          {!isCollapsed && sector.profsList.map(prof => (
                            <tr key={prof.id} className="hover:bg-sky-50/30 transition-colors group">
                              <td className="sticky left-0 bg-white group-hover:bg-sky-50/50 z-10 p-2 pl-6 border-r border-slate-100">
                                <div className="flex items-center gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full ${prof.isVacant ? 'bg-red-500 animate-ping' : 'bg-emerald-400'}`} />
                                  <span className={`font-semibold truncate max-w-[200px] ${prof.isVacant ? 'text-red-600 font-black' : 'text-slate-700'}`}>
                                    {prof.name}
                                  </span>
                                </div>
                              </td>
                              {matrixDaysArray.map(day => {
                                const dayShifts = prof.shiftsByDay[day];
                                const refMonth = selectedMonth || getLocalDateString().slice(0, 7);
                                const isWeekend = [0, 6].includes(new Date(refMonth.split('-')[0], refMonth.split('-')[1] - 1, day).getDay());
                                
                                return (
                                  <td key={day} className={`p-1 border-r border-slate-100/50 text-center ${isWeekend ? 'bg-slate-50/50' : ''}`}>
                                    {dayShifts && dayShifts.length > 0 ? (
                                      <div className="flex flex-col gap-0.5 items-center justify-center">
                                        {dayShifts.map(s => {
                                          // TRAVA DE SEGURANÇA 3: Nunca tenta dar split no tempo se ele for vazio
                                          const startHour = (s.start_time || '00:00').split(':')[0];
                                          return (
                                            <button 
                                              key={s.id}
                                              onClick={() => { setEditing(s); setDialogOpen(true); }}
                                              title={`${s.start_time || '--'} às ${s.end_time || '--'} - Clique para detalhes`}
                                              className={`w-[26px] h-[22px] rounded-md border text-[9px] flex items-center justify-center transition-transform hover:scale-110 hover:z-10 shadow-sm ${getMatrixBlockColor(s)}`}
                                            >
                                              {startHour}h
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ) : null}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================== MODO LISTA DIÁRIA ===================== */}
        {viewMode === 'list' && (
          <div className="overflow-y-auto p-4 space-y-4">
             {filtered.length === 0 ? (
                <div className="py-12 text-center text-slate-400">Nenhum plantão localizado neste filtro.</div>
              ) : (
                filtered.map(s => {
                  const sTime = s.start_time || '00:00';
                  const isNight = s.shift_type === 'noturno' || (sTime >= '18:00' || sTime < '06:00');
                  return (
                    <div key={s.id} className={`flex items-center gap-3 rounded-xl border p-3 bg-white hover:border-sky-300 transition-colors shadow-sm ${s.isVacant ? 'border-amber-400 bg-amber-50' : 'border-slate-200'}`}>
                      <div className="min-w-[85px] rounded-lg bg-slate-50 py-1.5 text-center text-xs font-black text-slate-700 border border-slate-100 shrink-0">
                        {fmtDate(s.date)} <br/>
                        <span className="text-sky-600">{s.start_time || '--'} - {s.end_time || '--'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <strong className={`block text-sm truncate ${s.isVacant ? 'text-amber-800' : 'text-slate-800'}`}>{toTitleCase(s.professional_name) || 'Vaga Aberta'}</strong>
                        <span className="text-xs text-slate-500">{toTitleCase(s.sector_name)}</span>
                      </div>
                      <div className="flex gap-1">
                        {s.isVacant ? (
                          <Button size="sm" onClick={() => { setEditing(s); setDialogOpen(true); }} className="h-8 bg-amber-500 hover:bg-amber-600 text-white"><UserPlus className="w-3.5 h-3.5 mr-1" /> Alocar</Button>
                        ) : (
                          <Button size="icon" variant="ghost" onClick={(e) => handleNotifyWhatsApp(s, e)} className="h-8 w-8 text-emerald-600 hover:bg-emerald-50"><MessageCircle className="w-4 h-4"/></Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setDialogOpen(true); }} className="h-8 w-8 text-slate-500"><Pencil className="w-4 h-4"/></Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(s.id)} className="h-8 w-8 text-red-500"><Trash2 className="w-4 h-4"/></Button>
                      </div>
                    </div>
                  );
                })
              )}
          </div>
        )}
      </Card>

      <ShiftFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={load} shift={editing} sectors={sectors} professionals={professionals} companyId={companyId} unitId={unitId} />
    </div>
  );
}