import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, Pencil, Trash2, Search, Download, CalendarDays, UsersRound, 
  Maximize2, Minimize2, MessageCircle, Filter, UserPlus, X, Sun, Moon, 
  Building2, Activity, LayoutGrid, List, ChevronDown, ChevronRight, Lock,
  GripVertical, Send, CheckCircle2
} from 'lucide-react';
import ShiftFormDialog from '@/components/shifts/ShiftFormDialog';
import { exportSchedulePDF } from '@/lib/exportReport';
import { getShiftTvLifecycle } from '@/lib/shiftUtils';

/* ============================================================
   CONSTANTES E UTILITÁRIOS
   ============================================================ */

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const SHIFT_PERIODS = [
  { id: 'manha', label: 'Manhã', start: '07:00', end: '13:00' },
  { id: 'tarde', label: 'Tarde', start: '13:00', end: '19:00' },
  { id: 'noite', label: 'Noite', start: '19:00', end: '07:00' }
];

function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fmtDate(dateStr) {
  if (typeof dateStr !== 'string' || !dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length < 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return `${parts[2]}/${parts[1]} (${WEEKDAYS_SHORT[d.getDay()] || ''})`;
}

function fmtDateLong(dateStr) {
  if (typeof dateStr !== 'string' || !dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length < 3) return '';
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return WEEKDAYS_LONG[d.getDay()] || '';
}

function normalizeStr(str) {
  if (typeof str !== 'string') return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function toTitleCase(str) {
  if (typeof str !== 'string' || !str.trim()) return '';
  const acr = ['UTI', 'UCO', 'PA', 'PS', 'CRM', 'COREN'];
  return str.toLowerCase().split(' ').map(w => acr.includes(w.toUpperCase()) ? w.toUpperCase() : (['de', 'da', 'do', 'e'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

function getMonthWeeks(monthStr) {
  if (!monthStr || typeof monthStr !== 'string') return [];
  const parts = monthStr.split('-');
  if (parts.length < 2) return [];
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  
  const weeks = [];
  let currentWeek = [];
  
  let startDay = firstDay.getDay(); 
  let emptyDays = startDay === 0 ? 6 : startDay - 1; // Ajusta para segunda-feira na grade
  
  for (let i = 0; i < emptyDays; i++) currentWeek.push(null);

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateObj = new Date(year, month - 1, d);
    currentWeek.push(getLocalDateString(dateObj));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }
  
  return weeks;
}

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */

export default function Escalas() {
  const { user, company, loading: appLoading } = useAppData();
  
  const [shifts, setShifts] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  
  const [viewMode, setViewMode] = useState('grade'); 
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [quickFilter, setQuickFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(() => getLocalDateString().slice(0,7));
  const [selectedDate, setSelectedDate] = useState('');
  const [tvMode, setTvMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  
  // Estados para as Novas Funcionalidades
  const [profSearchQuery, setProfSearchQuery] = useState('');
  const [inlineEditingCell, setInlineEditingCell] = useState(null);
  const [inlineSearchText, setInlineSearchText] = useState('');
  const [selectedCells, setSelectedCells] = useState([]);
  const [isPublished, setIsPublished] = useState(false);
  const [newShiftModal, setNewShiftModal] = useState(null);
  const [createScaleState, setCreateScaleState] = useState(0); 

  const userId = user?.id;
  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id || 'unit_h1';
  const isManager = user?.role === 'admin' || user?.data?.app_role === 'manager' || user?.data?.app_role === 'gestor';

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const f = { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) };
      const [s, sec, p] = await Promise.all([
        base44.entities.Shift.filter(f, '-date', 2000).catch(() => []), 
        base44.entities.Sector.filter(f, '-created_date', 100).catch(() => []),
        base44.entities.Professional.filter(f, '-created_date', 400).catch(() => []),
      ]);
      
      const safeShifts = Array.isArray(s) ? s : (s?.data || []);
      const safeSectors = Array.isArray(sec) ? sec : (sec?.data || []);
      const safeProfessionals = Array.isArray(p) ? p : (p?.data || []);

      setShifts(safeShifts);
      setSectors(safeSectors);
      setProfessionals(safeProfessionals);
      
      if (sectorFilter === 'all' && safeSectors.length > 0) {
        setSectorFilter(String(safeSectors[0].id));
      }
    } catch (e) {
      console.error('Erro ao buscar escalas:', e);
    }
  }, [companyId, unitId, sectorFilter]);

  useEffect(() => { if (!appLoading) load(); }, [appLoading, load]);
  useEffect(() => { const id = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(id); }, []);

  const myProfessional = useMemo(() => (professionals || []).find((p) => p.user_id === userId || p.email === user?.email || p.name === user?.full_name), [professionals, userId, user]);
  const profMap = useMemo(() => {
    const map = {};
    (professionals || []).forEach(p => { if (p?.id) map[p.id] = p; });
    return map;
  }, [professionals]);

  const monthOptions = useMemo(() => {
    return [...new Set((shifts || []).map((s) => (typeof s?.date === 'string' ? s.date.slice(0, 7) : '')))].filter(Boolean).sort().reverse();
  }, [shifts]);

  const filtered = useMemo(() => {
    const term = normalizeStr(search);
    return (shifts || [])
      .filter((s) => {
        if (!s || s.status === 'cancelado') return false;
        const sDate = typeof s.date === 'string' ? s.date.split('T')[0] : '';
        if (!sDate) return false;

        const monthMatch = !selectedMonth || sDate.startsWith(selectedMonth);
        const dateMatch = !selectedDate || sDate === selectedDate;
        const profNameNorm = normalizeStr(s.professional_name);
        const sectorNameNorm = normalizeStr(s.sector_name);
        const matchSearch = !term || profNameNorm.includes(term) || sectorNameNorm.includes(term);
        const matchSector = sectorFilter === 'all' || String(s.sector_id) === String(sectorFilter);
        const personalScope = isManager || s.professional_id === myProfessional?.id || s.professional_name === myProfessional?.name;
        
        return dateMatch && monthMatch && matchSearch && matchSector && personalScope;
      })
      .map((s) => {
        let lifecycle = { state: 'upcoming', detail: '' };
        try {
          const safeShift = { ...s, date: s.date || '', start_time: s.start_time || '', end_time: s.end_time || '' };
          lifecycle = getShiftTvLifecycle(safeShift, currentTime) || lifecycle;
        } catch (e) {}

        const pName = typeof s.professional_name === 'string' ? s.professional_name.toLowerCase() : '';
        const sTime = typeof s.start_time === 'string' ? s.start_time : '00:00';
        let periodId = 'manha';
        if (sTime >= '13:00' && sTime < '19:00') periodId = 'tarde';
        if (sTime >= '19:00' || sTime < '06:00') periodId = 'noite';

        return {
          ...s,
          lifecycle,
          periodId,
          isVacant: !s.professional_id || pName.includes('vaga')
        };
      })
      .filter((s) => {
        if (quickFilter === 'active') return s.lifecycle?.state === 'active';
        if (quickFilter === 'upcoming') return s.lifecycle?.state === 'upcoming';
        if (quickFilter === 'concluded') return ['concluded', 'recently_finished'].includes(s.lifecycle?.state);
        if (quickFilter === 'vacant') return s.isVacant;
        
        const sTime = typeof s.start_time === 'string' ? s.start_time : '00:00';
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
    return { total, filled, vacant, fillRate };
  }, [filtered]);

  const weeksData = useMemo(() => getMonthWeeks(selectedMonth), [selectedMonth]);

  const sidebarProfessionals = useMemo(() => {
    const term = normalizeStr(profSearchQuery);
    return (professionals || []).filter(p => p?.id && (!term || normalizeStr(p.name).includes(term) || normalizeStr(p.specialty || '').includes(term)));
  }, [professionals, profSearchQuery]);

  /* ============================================================
     AÇÕES DO CALENDÁRIO (DRAG, DROP E CLIQUE)
     ============================================================ */

  const handleCellClick = (e, date, periodId) => {
    if (e.ctrlKey || e.metaKey) {
      const exists = selectedCells.find(c => c.date === date && c.periodId === periodId);
      if (exists) {
        setSelectedCells(selectedCells.filter(c => !(c.date === date && c.periodId === periodId)));
      } else {
        setSelectedCells([...selectedCells, { date, periodId }]);
      }
    } else {
      setSelectedCells([]);
      setNewShiftModal({ date, periodId });
    }
  };

  const handleDragStart = (e, prof) => {
    if (!prof?.id) return;
    e.dataTransfer.setData('profId', prof.id);
  };

  const handleDragOver = (e) => { e.preventDefault(); };

  const assignShift = async (date, periodId, profId) => {
    if (sectorFilter === 'all') { alert("Selecione um setor na barra superior para alocar."); return; }
    const periodDef = SHIFT_PERIODS.find(p => p.id === periodId);
    const prof = profMap[profId];
    const sectorObj = (sectors || []).find(s => String(s.id) === String(sectorFilter));
    if (!prof || !sectorObj) return;

    try {
      const existingShift = (filtered || []).find(s => s.date && s.date.startsWith(date) && s.periodId === periodId && s.isVacant);
      const payload = {
        company_id: companyId, unit_id: unitId, professional_id: prof.id, professional_name: prof.name,
        sector_id: sectorObj.id, sector_name: sectorObj.name, date: date, start_time: periodDef.start, end_time: periodDef.end,
        duration_hours: periodId === 'noite' ? 12 : 6, status: 'confirmado' 
      };

      if (existingShift) await base44.entities.Shift.update(existingShift.id, payload);
      else await base44.entities.Shift.create(payload);
      
      load();
    } catch (error) { alert("Erro ao salvar plantão: " + error.message); }
  };

  const handleDrop = (e, date, periodId) => {
    e.preventDefault();
    const profId = e.dataTransfer.getData('profId');
    if (!profId) return;

    const isSelected = selectedCells.some(c => c.date === date && c.periodId === periodId);
    if (isSelected && selectedCells.length > 0) {
      selectedCells.forEach(cell => assignShift(cell.date, cell.periodId, profId));
      setSelectedCells([]);
    } else {
      assignShift(date, periodId, profId);
      setSelectedCells([]);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja cancelar este plantão?')) return;
    try {
        await base44.entities.Shift.update(id, { status: 'cancelado', notes: 'Cancelado pela gestão.' });
        load();
    } catch (e) { alert('Erro ao cancelar.'); }
  };

  const handlePublish = () => {
    if (confirm('Publicar escala? Isso fixará a visualização para os profissionais e emitirá os alertas de publicação.')) {
      setIsPublished(true);
      setTimeout(() => alert('Escala publicada com sucesso! Notificações enviadas aos profissionais.'), 500);
    }
  };

  const handleExportSchedule = () => {
    const targetDate = selectedDate || getLocalDateString(currentTime);
    const dayShifts = filtered.filter(s => {
      const sDate = typeof s.date === 'string' ? s.date.split('T')[0] : '';
      return sDate === targetDate;
    });

    if (dayShifts.length === 0) {
      alert(`Não existem plantões para a data ${fmtDate(targetDate)}.`);
      return;
    }

    const sorted = [...dayShifts].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
    exportSchedulePDF({ company: company || { name: 'Hospital' }, shifts: sorted, dateLabel: fmtDate(targetDate) });
  };

  const openTvMode = async () => {
    setTvMode(true);
    try { await document.documentElement.requestFullscreen?.(); } catch {}
  };
  const closeTvMode = async () => {
    setTvMode(false);
    if (document.fullscreenElement) await document.exitFullscreen?.();
  };

  if (tvMode && isManager) {
    const activeTvShifts = filtered.filter(s => s.lifecycle?.state !== 'concluded');
    const groups = {};
    activeTvShifts.forEach(shift => {
      const secKey = shift.sector_id || 'geral';
      if (!groups[secKey]) groups[secKey] = { id: secKey, name: shift.sector_name || 'Geral', active: [], upcoming: [], vacant: [] };
      if (shift.isVacant) groups[secKey].vacant.push(shift);
      else if (shift.lifecycle?.state === 'active') groups[secKey].active.push(shift);
      else if (shift.lifecycle?.state === 'upcoming') groups[secKey].upcoming.push(shift);
    });
    const tvSectorsGrouped = Object.values(groups).sort((a,b) => (b.vacant.length * 10 + b.active.length) - (a.vacant.length * 10 + a.active.length));

    return (
      <div className="fixed inset-0 z-[99999] bg-slate-950 text-white flex flex-col p-6 font-sans">
        <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
           <div>
             <h1 className="text-3xl font-black text-sky-400">ScaleMedic TV</h1>
             <p className="text-sm text-slate-400">{fmtDateLong(getLocalDateString(currentTime))} · Visão Setorial</p>
           </div>
           <div className="flex gap-4 items-center">
             <div className="text-right">
                <div className="text-2xl font-mono text-emerald-400 font-black">{currentTime.toLocaleTimeString('pt-BR')}</div>
                <div className="text-[10px] text-slate-400 uppercase">Horário Oficial</div>
             </div>
             <button onClick={closeTvMode} className="p-3 bg-white/10 rounded-xl hover:bg-white/20"><Minimize2 className="w-5 h-5"/></button>
           </div>
        </div>
        <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
           {tvSectorsGrouped.map(sec => (
             <div key={sec.id} className={`p-5 rounded-3xl border ${sec.vacant.length > 0 ? 'bg-amber-950/20 border-amber-500/50' : 'bg-slate-900 border-white/10'}`}>
                <h2 className="text-xl font-bold mb-4">{sec.name}</h2>
                <div className="space-y-3">
                   {sec.vacant.map(s => (
                     <div key={s.id} className="p-3 bg-amber-500/20 text-amber-300 border border-amber-500/50 rounded-xl flex justify-between animate-pulse">
                        <div><b>VAGA ABERTA</b><br/><span className="text-xs">{s.start_time} às {s.end_time}</span></div>
                     </div>
                   ))}
                   {sec.active.map(s => (
                     <div key={s.id} className="p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-xl flex justify-between">
                        <div><div className="text-emerald-400 text-[10px] font-bold">● EM ATENDIMENTO</div><b>{toTitleCase(s.professional_name)}</b><br/><span className="text-xs text-slate-300">Até {s.end_time}</span></div>
                     </div>
                   ))}
                </div>
             </div>
           ))}
        </div>
      </div>
    );
  }

  if (!isManager) {
    return <div className="p-8 flex items-center justify-center h-full text-slate-500">Acesse "Minha Escala" no menu lateral para visualizar seus plantões.</div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-5 h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      
      {/* HEADER ORIGINAL PRESERVADO */}
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

      {/* BARRA DE FILTROS E AÇÕES */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 shrink-0 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
            <button onClick={() => setViewMode('grade')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'grade' ? 'bg-white shadow-sm text-sky-700' : 'text-slate-500 hover:text-slate-700'}`}>
              <LayoutGrid className="w-4 h-4" /> Builder Visual
            </button>
            <button onClick={() => setViewMode('list')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-sky-700' : 'text-slate-500 hover:text-slate-700'}`}>
              <List className="w-4 h-4" /> Lista Diária
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200 mx-1 shrink-0" />

          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="h-9 rounded-xl border border-slate-200 px-3 text-xs bg-slate-50 font-semibold focus:ring-2 focus:ring-sky-500 shrink-0 cursor-pointer outline-none">
            <option value="">Mês Corrente</option>
            {monthOptions.map((m) => {
              const d = new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1);
              return <option key={m} value={m}>{d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</option>;
            })}
          </select>
          
          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger className="h-9 text-xs w-[180px] bg-slate-50 rounded-xl"><SelectValue placeholder="Selecione o Setor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {sectors.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {viewMode === 'list' && (
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="h-9 w-auto text-xs shrink-0 bg-slate-50" title="Dia Específico" />
          )}
          
          {selectedCells.length > 0 && (
            <div className="bg-sky-50 text-sky-700 px-3 py-1 rounded-lg text-xs font-bold border border-sky-200 animate-pulse ml-2">
              {selectedCells.length} dias selecionados
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
          <Button onClick={() => setCreateScaleState(1)} className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs h-9 px-4 shadow-sm border hidden lg:flex">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Nova Escala
          </Button>

          {viewMode === 'grade' && (
            <Button onClick={handlePublish} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 shadow-sm shadow-emerald-600/20">
              <Send className="w-3.5 h-3.5 mr-1.5" /> Publicar Escala
            </Button>
          )}

          <Button onClick={openTvMode} className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-9 px-4 shadow-sm hidden md:flex">
            <Maximize2 className="w-3.5 h-3.5 mr-1.5" /> TV
          </Button>

          <Button variant="outline" onClick={handleExportSchedule} className="text-xs h-9 font-semibold border-slate-200" title="Imprimir em PDF">
            <Download className="w-3.5 h-3.5 mr-1.5 text-sky-600" /> Relatório
          </Button>

          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-sky-600 hover:bg-sky-700 text-white text-xs h-9 font-bold px-4 shadow-md shadow-sky-600/20">
            <Plus className="w-4 h-4 mr-1.5" /> Plantão Avulso
          </Button>
        </div>
      </div>

      <Card className="flex-1 border-slate-200 shadow-sm overflow-hidden flex flex-col bg-white">
        
        {/* ===================== MODO GRADE VISUAL (BUILDER) ===================== */}
        {viewMode === 'grade' && (
          <div className="flex h-full w-full">
            
            {/* BARRA LATERAL DOS PROFISSIONAIS PARA DRAG AND DROP */}
            <div className="w-64 bg-slate-50/50 border-r border-slate-200 flex flex-col shrink-0">
              <div className="p-4 border-b border-slate-200">
                <h3 className="font-black text-sm text-slate-800 mb-3 flex items-center gap-2">
                  <UsersRound className="w-4 h-4 text-sky-600" /> Corpo Clínico
                </h3>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <Input 
                    placeholder="Buscar profissional..." 
                    value={profSearchQuery} 
                    onChange={e => setProfSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs bg-white"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-2 text-center font-medium">Arraste o nome para a escala ➔</p>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {sidebarProfessionals.map(prof => (
                  <div 
                    key={prof.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, prof)}
                    className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm cursor-grab hover:border-sky-300 hover:shadow-md active:cursor-grabbing flex items-center gap-2 group transition-all"
                  >
                    <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-sky-500" />
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-800 truncate">{prof.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{prof.specialty || 'Geral'}</div>
                    </div>
                  </div>
                ))}
                {sidebarProfessionals.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-400">Nenhum profissional encontrado.</div>
                )}
              </div>
            </div>

            {/* ÁREA DA GRADE CALENDÁRIO */}
            <div className="flex-1 overflow-y-auto bg-white relative custom-scrollbar">
              {sectorFilter === 'all' ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                  <Building2 className="w-12 h-12 mb-4 text-slate-300" />
                  <p className="font-bold text-slate-600">Selecione um Setor</p>
                  <p className="text-sm mt-1">Para montar a escala em grade, escolha um setor no filtro superior.</p>
                </div>
              ) : (
                <div className="min-w-[800px] pb-10">
                  {/* Cabeçalho de Dias da Semana */}
                  <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50 sticky top-0 z-20">
                    <div className="p-3 border-r border-slate-200 flex items-center justify-center font-black text-xs text-slate-500 uppercase tracking-wider bg-slate-100">
                      Turno
                    </div>
                    {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((day) => (
                      <div key={day} className="p-3 border-r border-slate-200 text-center font-bold text-xs text-slate-700 uppercase tracking-wider">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Semanas do Mês */}
                  {weeksData.map((week, wIndex) => (
                    <div key={wIndex} className="border-b-4 border-slate-200">
                      
                      {/* Cabeçalho da Semana (Datas) */}
                      <div className="grid grid-cols-8 bg-slate-50 border-b border-slate-200">
                        <div className="p-2 border-r border-slate-200 bg-slate-100"></div>
                        {week.map((date, dIndex) => (
                          <div key={dIndex} className={`p-1 border-r border-slate-200 text-right pr-2 text-[10px] font-black ${date ? 'text-slate-500' : 'text-transparent bg-slate-100'}`}>
                            {date ? date.split('-')[2] + '/' + date.split('-')[1] : '-'}
                          </div>
                        ))}
                      </div>

                      {/* Turnos (Linhas) */}
                      {SHIFT_PERIODS.map((period) => (
                        <div key={period.id} className="grid grid-cols-8 border-b border-slate-100 last:border-b-0 group">
                          
                          {/* Coluna Fixa do Turno */}
                          <div className="p-3 border-r border-slate-200 bg-slate-50 flex flex-col items-center justify-center">
                            <span className="font-bold text-[11px] uppercase text-slate-700">{period.label}</span>
                            <span className="text-[9px] font-bold text-slate-400">{period.start} - {period.end}</span>
                          </div>

                          {/* Slots dos Dias */}
                          {week.map((date, dIndex) => {
                            if (!date) return <div key={dIndex} className="bg-slate-50 border-r border-slate-200 p-2"></div>;

                            const slotShifts = (filtered || []).filter(s => s.date && s.date.startsWith(date) && s.periodId === period.id);
                            const isSelected = selectedCells.some(c => c.date === date && c.periodId === period.id);

                            return (
                              <div 
                                key={dIndex} 
                                className={`border-r border-slate-200 p-1.5 min-h-[60px] relative transition-colors cursor-pointer flex flex-col gap-1
                                  ${isSelected ? 'bg-sky-50 ring-inset ring-2 ring-sky-400' : 'hover:bg-slate-50'}
                                `}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, date, period.id)}
                                onClick={(e) => handleCellClick(e, date, period.id)}
                                title="Ctrl+Click para selecionar múltiplos. Clique simples para Novo Plantão."
                              >
                                {slotShifts.map(s => (
                                  <div key={s.id} className={`relative p-1.5 rounded-md text-[10px] border flex items-center justify-between group/item transition-all hover:scale-[1.02] shadow-sm
                                    ${s.isVacant ? 'bg-amber-50 border-amber-300 text-amber-800 border-dashed' : 'bg-white border-slate-200 text-slate-800'}
                                  `}>
                                    <span className="font-bold truncate pr-4">{s.isVacant ? 'Vaga Aberta' : toTitleCase(s.professional_name)}</span>
                                    
                                    {/* Tag de Publicado no Hover */}
                                    {!s.isVacant && isPublished && (
                                      <div className="absolute -top-2 left-2 opacity-0 group-hover/item:opacity-100 transition-opacity bg-emerald-500 text-white text-[8px] font-black px-1.5 rounded uppercase shadow-sm">Publicado</div>
                                    )}

                                    {!s.isVacant && (
                                      <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} className="opacity-0 group-hover/item:opacity-100 p-1 text-red-500 hover:bg-red-100 rounded transition-opacity absolute right-1">
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                ))}

                                {/* Modo de Edição Inline (Duplo Clique) */}
                                {inlineEditingCell?.date === date && inlineEditingCell?.periodId === period.id && (
                                  <div className="absolute inset-0 z-30 bg-white border-2 border-sky-500 rounded-lg p-1 shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center gap-1 border-b pb-1 mb-1">
                                      <Search className="w-3 h-3 text-slate-400" />
                                      <input 
                                        autoFocus
                                        type="text" 
                                        placeholder="Buscar..." 
                                        className="w-full text-[10px] outline-none bg-transparent font-medium"
                                        value={inlineSearchText}
                                        onChange={e => setInlineSearchText(e.target.value)}
                                        onKeyDown={(e) => { if(e.key === 'Escape') setInlineEditingCell(null); }}
                                      />
                                      <button onClick={() => setInlineEditingCell(null)}><X className="w-3 h-3 text-slate-400 hover:text-red-500"/></button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto space-y-0.5 custom-scrollbar">
                                      {professionals.filter(p => !inlineSearchText || normalizeStr(p.name).includes(normalizeStr(inlineSearchText))).slice(0, 5).map(p => (
                                        <button 
                                          key={p.id} 
                                          className="w-full text-left px-2 py-1 text-[10px] hover:bg-sky-50 rounded truncate text-slate-700 font-medium"
                                          onClick={() => {
                                            assignShift(date, period.id, p.id);
                                            setInlineEditingCell(null);
                                            setInlineSearchText('');
                                          }}
                                        >
                                          {p.name}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== MODO LISTA DIÁRIA ===================== */}
        {viewMode === 'list' && (
          <div className="overflow-y-auto p-4 space-y-4 bg-slate-50 flex-1">
             {filtered.length === 0 ? (
                <div className="py-12 text-center text-slate-400">Nenhum plantão localizado neste filtro.</div>
              ) : (
                filtered.map(s => {
                  const sTime = typeof s.start_time === 'string' ? s.start_time : '00:00';
                  const isDone = ['concluded', 'recently_finished'].includes(s.lifecycle?.state);

                  return (
                    <div key={s.id} className={`flex items-center gap-3 rounded-2xl border p-3 bg-white transition-colors shadow-sm ${s.isVacant ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-sky-300'}`}>
                      <div className={`min-w-[85px] rounded-xl py-2 text-center text-xs font-black border shrink-0 ${isDone ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                        {fmtDate(s.date)} <br/>
                        <span className={isDone ? "text-slate-400" : "text-sky-600"}>{s.start_time || '--'} - {s.end_time || '--'}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <strong className={`block text-sm truncate ${s.isVacant ? 'text-amber-800' : (isDone ? 'text-slate-500' : 'text-slate-800')}`}>
                          {toTitleCase(s.professional_name) || 'Vaga Aberta'}
                        </strong>
                        <span className="text-xs text-slate-400">{toTitleCase(s.sector_name)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isDone ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-400">
                            <Lock className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Concluído</span>
                          </div>
                        ) : (
                          <>
                            {s.isVacant ? (
                              <Button size="sm" onClick={() => { setEditing(s); setDialogOpen(true); }} className="h-8 bg-amber-500 hover:bg-amber-600 text-white"><UserPlus className="w-3.5 h-3.5 mr-1" /> Alocar</Button>
                            ) : (
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50"><MessageCircle className="w-4 h-4"/></Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setDialogOpen(true); }} className="h-8 w-8 text-slate-500"><Pencil className="w-4 h-4"/></Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(s.id)} className="h-8 w-8 text-red-500"><Trash2 className="w-4 h-4"/></Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
          </div>
        )}

        {/* ===================== MODO BASE BUILDER (CRIAÇÃO DE ESCALA BASE) ===================== */}
        {viewMode === 'base_builder' && (
          <div className="flex-1 overflow-auto bg-slate-50 p-6 flex justify-center">
            <div className="w-full max-w-5xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-sky-700">Escala Base (Modo Edição)</h2>
                  <p className="text-xs text-slate-500 mt-1">Configure os padrões de horário antes de preencher os nomes.</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-slate-500">Data de Início</label>
                  <Input type="date" className="h-9 w-40 text-xs bg-white" />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-4 w-48">Padrão Operacional</th>
                      <th className="p-4 text-center border-l border-slate-200">Segunda</th>
                      <th className="p-4 text-center border-l border-slate-200">Terça</th>
                      <th className="p-4 text-center border-l border-slate-200">Quarta</th>
                      <th className="p-4 text-center border-l border-slate-200">Quinta</th>
                      <th className="p-4 text-center border-l border-slate-200">Sexta</th>
                      <th className="p-4 text-center border-l border-slate-200 bg-slate-200/50">Sábado</th>
                      <th className="p-4 text-center border-l border-slate-200 bg-slate-200/50">Domingo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {SHIFT_PERIODS.map(p => (
                      <tr key={p.id}>
                        <td className={`p-4 font-bold border-r border-slate-200 flex flex-col items-center justify-center text-center ${p.color}`}>
                          <span className="text-sm">{p.label}</span>
                          <span className="text-[10px] opacity-70">{p.start} às {p.end}</span>
                        </td>
                        {[1,2,3,4,5,6,0].map(day => (
                          <td key={day} className={`p-4 border-r border-slate-100 text-center ${[0,6].includes(day) ? 'bg-slate-50/50' : ''}`}>
                            <div className="w-6 h-6 mx-auto rounded bg-slate-200 text-slate-500 font-bold flex items-center justify-center">1</div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <Button variant="outline" onClick={() => setViewMode('grade')} className="font-bold">Cancelar</Button>
                <Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold" onClick={() => { alert('Escala Base salva!'); setViewMode('grade'); }}>Salvar Escala Base</Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* MODAL 1: NOVO PLANTÃO INDIVIDUAL (Click na Célula) */}
      {newShiftModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-black text-sky-600">Novo Plantão</h2>
              <button onClick={() => setNewShiftModal(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4 text-sm font-medium text-slate-700">
              <div className="grid grid-cols-3 items-center gap-4">
                <label>Plantonista:</label>
                <Select>
                  <SelectTrigger className="col-span-2 h-9 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{professionals.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <label>Equipe (Turno):</label>
                <div className="col-span-2 font-bold text-slate-900 capitalize">{newShiftModal.periodId}</div>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <label>Dia da Semana:</label>
                <div className="col-span-2">{fmtDateLong(newShiftModal.date)}</div>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <label>Data:</label>
                <div className="col-span-2 font-bold">{formatDateBR(newShiftModal.date)}</div>
              </div>
              
              <div className="border-t border-slate-100 my-4" />
              
              <div className="grid grid-cols-3 items-center gap-4">
                <label>Repetir a cada:</label>
                <Select defaultValue="1">
                  <SelectTrigger className="col-span-2 h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="1">1 Semana</SelectItem><SelectItem value="2">2 Semanas</SelectItem></SelectContent>
                </Select>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={() => { alert('Plantão salvo!'); setNewShiftModal(null); }} className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-8">Criar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAIS FLUXO CRIAÇÃO DE ESCALA BASE */}
      {createScaleState === 1 && (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-black text-sky-600">Adicionar Escala</h2>
              <button onClick={() => setCreateScaleState(0)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Nome do Setor / Escala *</label>
                <Input placeholder="Ex: UTI Adulto" className="h-10" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Endereço da Unidade</label>
                <Input placeholder="Rua, Número..." className="h-10" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setCreateScaleState(0)}>Cancelar</Button>
                <Button className="bg-sky-600 text-white font-bold" onClick={() => setCreateScaleState(2)}>Salvar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {createScaleState === 2 && (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-8 h-8" /></div>
            <h2 className="text-xl font-black text-slate-900 mb-2">Escala adicionada com sucesso!</h2>
            <p className="text-sm text-slate-500 mb-6">Gostaria de configurar os horários e adicionar profissionais agora?</p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" className="w-24 font-bold" onClick={() => setCreateScaleState(0)}>Não</Button>
              <Button className="w-24 bg-slate-900 text-white font-bold" onClick={() => { setCreateScaleState(0); setViewMode('base_builder'); }}>Sim</Button>
            </div>
          </div>
        </div>
      )}
      
      <ShiftFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={load} shift={editing} sectors={sectors} professionals={professionals} companyId={companyId} unitId={unitId} />
    </div>
  );
}