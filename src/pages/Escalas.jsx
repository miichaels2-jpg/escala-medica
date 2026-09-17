import React, { useState, useMemo, useEffect } from 'react';
import { useAppData } from '@/lib/useAppData';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  CalendarDays, Plus, Search, ChevronLeft, ChevronRight, 
  Clock, Building2, Trash2, X, Sparkles, CheckCheck, Send, 
  MousePointerClick, HeartPulse, UserPlus, SlidersHorizontal,
  Flame, ArrowRight, MonitorPlay, GripVertical, 
  Printer, Sun, Moon, AlertTriangle, CheckCircle2, Radio, Calendar as CalendarIcon,
  PanelLeftClose, PanelLeftOpen, Filter, ArrowLeftRight
} from 'lucide-react';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS = [{ short: 'Dom', weekend: true }, { short: 'Seg', weekend: false }, { short: 'Ter', weekend: false }, { short: 'Qua', weekend: false }, { short: 'Qui', weekend: false }, { short: 'Sex', weekend: false }, { short: 'Sáb', weekend: true }];

function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function autoHealingSaveShift(id, initialPayload) {
  let payload = { ...initialPayload };
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      if (id) return await base44.entities.Shift.update(id, payload);
      else return await base44.entities.Shift.create(payload);
    } catch (err) {
      const msg = err.message || '';
      const match = msg.match(/Could not find the '([^']+)' column/i);
      if (match && match[1]) { delete payload[match[1]]; continue; }
      throw err;
    }
  }
}

function formatFullName(name) {
  if (!name) return 'Vaga em Aberto';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function getInitials(name) {
  if (!name) return 'VA';
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return p[0].substring(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function extractSpecialty(shift, prof) {
  if (shift?.target_specialty && shift.target_specialty.trim() && shift.target_specialty.toLowerCase() !== 'geral') return shift.target_specialty.trim();
  if (shift?.notes) {
    const match = shift.notes.match(/\[ESP:([^\]]+)\]/i);
    if (match && match[1]) return match[1].trim();
  }
  try { const cached = window.localStorage.getItem(`shift_spec_${shift?.id}`); if (cached) return cached; } catch {}
  return prof?.specialty || shift?.target_specialty || 'Clínica Médica';
}

export default function Escalas() {
  const { shifts = [], sectors = [], professionals = [], selectedUnitId, company, isManager, syncGlobalData } = useAppData();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState('mensal'); 
  const [filterTurno, setFilterTurno] = useState('todos'); 
  const [startDateFilter, setStartDateFilter] = useState('');

  // Persistência do Setor Selecionado
  const [selectedSectorId, setSelectedSectorId] = useState(() => {
    try {
      return window.localStorage.getItem('scale_filter_sector_id') || 'todos';
    } catch {
      return 'todos';
    }
  });

  const handleSelectSector = (secId) => {
    setSelectedSectorId(secId);
    try {
      window.localStorage.setItem('scale_filter_sector_id', secId);
    } catch {}
  };

  // Roll de Profissionais Recolhível
  const [trayCollapsed, setTrayCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem('scale_tray_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleTray = () => {
    setTrayCollapsed(prev => {
      const next = !prev;
      try { window.localStorage.setItem('scale_tray_collapsed', String(next)); } catch {}
      return next;
    });
  };

  // BOTÃO LATERAL FIXADO NA BORDA ESQUERDA PARA RECOLHER O MENU
  const [sidebarHidden, setSidebarHidden] = useState(() => {
    try {
      return window.localStorage.getItem('scale_main_sidebar_hidden') === 'true';
    } catch {
      return false;
    }
  });

  const toggleMainSidebar = () => {
    const next = !sidebarHidden;
    setSidebarHidden(next);
    try {
      window.localStorage.setItem('scale_main_sidebar_hidden', String(next));
      const sidebarEl = document.querySelector('aside:not(.roll-professionals)') || document.querySelector('nav') || document.querySelector('[data-sidebar="true"]');
      if (sidebarEl) {
        sidebarEl.style.display = next ? 'none' : '';
      }
    } catch {}
  };

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const publishStorageKey = `scale_pub_${currentYear}_${currentMonth + 1}_${selectedUnitId}`;

  const [scalePublished, setScalePublished] = useState(() => {
    try { return window.localStorage.getItem(publishStorageKey) === 'true'; } catch { return true; }
  });

  const [selectedDays, setSelectedDays] = useState([]);
  const [traySearch, setTraySearch] = useState('');
  const [traySpecialtyFilter, setTraySpecialtyFilter] = useState('todas');
  const [draggingProfId, setDraggingProfId] = useState(null);

  const [liveNow, setLiveNow] = useState(() => new Date());
  useEffect(() => { 
    if (activeTab === 'tv' || activeTab === 'dia') {
      const t = setInterval(() => setLiveNow(new Date()), 1000); 
      return () => clearInterval(t); 
    }
  }, [activeTab]);

  const [modalOpen, setModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [generatorModalOpen, setGeneratorModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const registeredSpecialties = useMemo(() => {
    const set = new Set();
    (professionals || []).forEach(p => { if (p?.specialty && p.specialty.trim()) set.add(p.specialty.trim()); });
    return Array.from(set).sort();
  }, [professionals]);

  const [formData, setFormData] = useState({
    date: getLocalDateString(), sector_id: '', target_specialty: 'Clínica Médica',
    start_time: '07:00', end_time: '19:00', shift_type: 'diurno', action_type: 'alocar',
    professional_id: '', notes: ''
  });

  const sectorMap = useMemo(() => { const m = {}; (sectors || []).forEach(s => { if(s) m[String(s.id)] = s; }); return m; }, [sectors]);
  const professionalMap = useMemo(() => { const m = {}; (professionals || []).forEach(p => { if(p) m[String(p.id)] = p; }); return m; }, [professionals]);

  useEffect(() => {
    const autoOpenId = window.localStorage.getItem('scale_auto_open_shift_id');
    if (autoOpenId && shifts.length > 0) {
      const targetShift = shifts.find(s => String(s.id) === String(autoOpenId));
      if (targetShift) {
        setEditingShiftId(targetShift.id);
        const prof = targetShift.professional_id ? professionalMap[String(targetShift.professional_id)] : null;
        const realSpec = extractSpecialty(targetShift, prof);
        setFormData({
          date: targetShift.date,
          sector_id: targetShift.sector_id,
          target_specialty: realSpec,
          start_time: targetShift.start_time,
          end_time: targetShift.end_time,
          shift_type: targetShift.shift_type || 'diurno',
          action_type: 'alocar',
          professional_id: targetShift.professional_id || '',
          notes: targetShift.notes || ''
        });
        setModalOpen(true);
        const [sYear, sMonth] = targetShift.date.split('-').map(Number);
        if (sYear && sMonth) {
          setCurrentDate(new Date(sYear, sMonth - 1, 1));
        }
      }
      window.localStorage.removeItem('scale_auto_open_shift_id');
    }
  }, [shifts, professionalMap]);

  const [generatorConfig, setGeneratorConfig] = useState({
    sector_id: '', start_date: getLocalDateString(), duration_days: 30,
    slots: [
      { id: 'slot_1', specialty: 'Clínica Médica', start_time: '07:00', end_time: '19:00', quantity: 2, shift_type: 'diurno' },
      { id: 'slot_2', specialty: 'Clínica Médica', start_time: '19:00', end_time: '07:00', quantity: 2, shift_type: 'noturno' }
    ]
  });

  const [batchData, setBatchData] = useState({ professional_id: '', sector_id: '', shift_type: 'diurno', start_time: '07:00', end_time: '19:00' });

  const handlePrevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  const handleToday = () => {
    setCurrentDate(new Date());
    setStartDateFilter('');
  };

  const handleStartDateChange = (e) => {
    const val = e.target.value;
    setStartDateFilter(val);
    if (val) {
      const [y, m, d] = val.split('-').map(Number);
      setCurrentDate(new Date(y, m - 1, d || 1));
    }
  };

  const daysInMonth = useMemo(() => {
    const date = new Date(currentYear, currentMonth, 1);
    const days = [];
    while (date.getMonth() === currentMonth) { 
      const curStr = getLocalDateString(date);
      if (!startDateFilter || curStr >= startDateFilter) {
        days.push(new Date(date)); 
      }
      date.setDate(date.getDate() + 1); 
    }
    return days;
  }, [currentYear, currentMonth, startDateFilter]);

  const todayLocalStr = getLocalDateString(new Date());

  const getStatusBadge = (shift) => {
    const isVago = shift.status === 'vago' || !shift.professional_id;
    const [startH, startM] = (shift.start_time || '07:00').split(':').map(Number);
    const [endH, endM] = (shift.end_time || '19:00').split(':').map(Number);
    const startMin = startH * 60 + startM;
    let endMin = endH * 60 + endM;
    if (endMin <= startMin) endMin += 24 * 60;
    
    const now = new Date();
    let nowTotalMin = now.getHours() * 60 + now.getMinutes();
    if (endMin > 24 * 60 && nowTotalMin < startMin) nowTotalMin += 24 * 60;

    if (isVago) {
      if (shift.date < todayLocalStr || (shift.date === todayLocalStr && nowTotalMin >= endMin)) {
        return { dot: 'bg-slate-400', label: 'VAGA PERDIDA', text: 'text-slate-500', wrapper: 'border-l-slate-400 bg-slate-100 dark:bg-slate-900/50 opacity-60 grayscale hover:grayscale-0', icon: <AlertTriangle className="w-3 h-3 text-slate-500" /> };
      }
      return { dot: 'bg-rose-500 animate-pulse', label: 'VAGA ABERTA', text: 'text-rose-600 dark:text-rose-400', wrapper: 'border-l-rose-500 bg-rose-50 dark:bg-rose-950/30', icon: <Flame className="w-3 h-3 text-rose-500 animate-pulse" /> };
    }
    
    if (shift.date < todayLocalStr || (shift.date === todayLocalStr && nowTotalMin >= endMin)) {
      return { dot: 'bg-slate-400', label: 'CONCLUÍDO', text: 'text-slate-500 dark:text-slate-400', wrapper: 'border-l-slate-300 bg-slate-100 dark:bg-slate-800/40 opacity-70 grayscale hover:grayscale-0', icon: <CheckCircle2 className="w-3 h-3 text-slate-400" /> };
    }
    if (shift.date === todayLocalStr && nowTotalMin >= startMin && nowTotalMin < endMin) {
      return { dot: 'bg-emerald-500 animate-ping', label: 'AO VIVO', text: 'text-emerald-600 dark:text-emerald-400', wrapper: 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500/50', icon: <Radio className="w-3 h-3 text-emerald-500 animate-ping" /> };
    }
    return { dot: 'bg-sky-500', label: 'PROGRAMADO', text: 'text-sky-600 dark:text-sky-400', wrapper: 'border-l-sky-400 bg-sky-50 dark:bg-sky-900/10', icon: <CalendarIcon className="w-3 h-3 text-sky-500" /> };
  };

  const isShiftMatchingTurno = (shift, filter) => {
    if (filter === 'todos') return true;
    const sType = shift.shift_type || (shift.start_time >= '18:00' || shift.start_time < '06:00' ? 'noturno' : 'diurno');
    return sType === filter;
  };

  const monthlyShifts = useMemo(() => {
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const prefix = `${currentYear}-${monthStr}`;
    return (shifts || []).filter(s => {
      if (!s?.date || !s.date.startsWith(prefix)) return false;
      if (startDateFilter && s.date < startDateFilter) return false;
      if (selectedSectorId !== 'todos' && String(s.sector_id) !== String(selectedSectorId)) return false;
      if (!isShiftMatchingTurno(s, filterTurno)) return false;
      return true;
    });
  }, [shifts, currentYear, currentMonth, selectedSectorId, filterTurno, startDateFilter]);

  const shiftsByDate = useMemo(() => {
    const map = {};
    monthlyShifts.forEach(s => { if (!map[s.date]) map[s.date] = []; map[s.date].push(s); });
    return map;
  }, [monthlyShifts]);

  const tvData = useMemo(() => {
    const nowHour = liveNow.getHours();
    const nowMin = liveNow.getMinutes();
    const nowTotalMin = nowHour * 60 + nowMin;

    const emAndamento = [];
    const proximoRendimento = [];
    const tableDayShifts = [];

    (shifts || []).forEach(shift => {
      if (!shift) return;
      if (selectedSectorId !== 'todos' && String(shift.sector_id) !== String(selectedSectorId)) return;

      const sDate = (shift.date || '').split('T')[0];
      if (sDate === todayLocalStr) {
        tableDayShifts.push(shift);
      }

      const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
      if (shift.status === 'vago' || !prof) return;

      const [startH, startM] = (shift.start_time || '07:00').split(':').map(Number);
      const [endH, endM] = (shift.end_time || '19:00').split(':').map(Number);
      const startMin = startH * 60 + startM;
      let endMin = endH * 60 + endM;
      if (endMin <= startMin) endMin += 24 * 60;

      let effNow = nowTotalMin;
      if (endMin > 24 * 60 && nowTotalMin < startMin) effNow += 24 * 60;

      if (sDate === todayLocalStr) {
        if (effNow >= startMin && effNow < endMin) {
          const left = endMin - effNow;
          emAndamento.push({
            ...shift,
            detail: `Resta ${Math.floor(left / 60)}h ${left % 60}m`
          });
        } else if (startMin > effNow && (startMin - effNow) <= 120) {
          proximoRendimento.push({
            shift,
            startsIn: startMin - effNow
          });
        }
      } else {
        if (endMin > 24 * 60) {
          const yesterdayStr = getLocalDateString(new Date(liveNow.getTime() - 86400000));
          if (sDate === yesterdayStr && nowTotalMin < (endMin - 24 * 60)) {
            const left = (endMin - 24 * 60) - nowTotalMin;
            emAndamento.push({
              ...shift,
              detail: `Resta ${Math.floor(left / 60)}h ${left % 60}m`
            });
          }
        }
      }
    });

    tableDayShifts.sort((a, b) => (a.start_time || '07:00').localeCompare(b.start_time || '07:00'));
    return { emAndamento, proximoRendimento, tableDayShifts };
  }, [shifts, selectedSectorId, liveNow, todayLocalStr, professionalMap]);

  const allActiveProfessionals = useMemo(() => {
    return (professionals || []).filter(p => p?.status === 'ativo');
  }, [professionals]);

  const filteredTrayProfs = useMemo(() => {
    const term = traySearch.toLowerCase().trim();
    return (professionals || []).filter(p => {
      if (p?.status !== 'ativo') return false;
      if (traySpecialtyFilter !== 'todas' && (p.specialty || '').toLowerCase() !== traySpecialtyFilter.toLowerCase()) return false;
      if (!term) return true;
      return (p.name || '').toLowerCase().includes(term) || (p.specialty || '').toLowerCase().includes(term);
    });
  }, [professionals, traySearch, traySpecialtyFilter]);

  const handleDayClick = (dateStr, e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setSelectedDays(prev => prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]);
    } else {
      if (selectedDays.length > 0) setSelectedDays([]);
    }
  };

  const handleDragStart = (e, profId) => { setDraggingProfId(profId); e.dataTransfer.setData('text/plain', profId); };

  const handleDropOnDay = async (e, dateStr) => {
    e.preventDefault();
    const profId = e.dataTransfer.getData('text/plain') || draggingProfId;
    if (!profId) return;

    const prof = professionalMap[profId];
    const targetSector = selectedSectorId !== 'todos' ? selectedSectorId : ((sectors || [])[0]?.id || '');
    if (!targetSector) { alert('Selecione ou cadastre um setor hospitalar.'); return; }

    const targetDates = selectedDays.includes(dateStr) && selectedDays.length > 1 ? selectedDays : [dateStr];
    if (!confirm(`Alocar ${prof?.name} para ${targetDates.length} dia(s)?`)) { setDraggingProfId(null); return; }

    try {
      for (const d of targetDates) {
        const spec = prof?.specialty || 'Clínica Médica';
        const saved = await autoHealingSaveShift(null, {
          company_id: company?.id || 'cmp_principal',
          unit_id: selectedUnitId || 'unit_h1',
          sector_id: targetSector,
          professional_id: profId,
          target_specialty: spec,
          notes: `[ESP:${spec}]`,
          date: d,
          shift_type: 'diurno',
          start_time: '07:00',
          end_time: '19:00',
          status: 'confirmado'
        });
        if (saved?.id) try { window.localStorage.setItem(`shift_spec_${saved.id}`, spec); } catch {}
      }
      setSelectedDays([]); await syncGlobalData();
    } catch (err) { alert('Erro ao alocar: ' + err.message); } finally { setDraggingProfId(null); }
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!formData.sector_id || !formData.date) return;

    const isMural = formData.action_type === 'mural';
    setSubmitting(true);
    try {
      const prof = formData.professional_id ? professionalMap[formData.professional_id] : null;
      const finalSpecialty = (formData.target_specialty || prof?.specialty || 'Clínica Médica').trim();
      const sType = formData.start_time >= '18:00' || formData.start_time < '06:00' ? 'noturno' : 'diurno';

      const payload = {
        company_id: company?.id || 'cmp_principal',
        unit_id: selectedUnitId || 'unit_h1',
        sector_id: formData.sector_id,
        target_specialty: finalSpecialty,
        professional_id: isMural ? null : formData.professional_id,
        date: formData.date,
        shift_type: sType,
        start_time: formData.start_time,
        end_time: formData.end_time,
        status: isMural ? 'vago' : 'confirmado',
        notes: `[ESP:${finalSpecialty}]`
      };

      const saved = await autoHealingSaveShift(editingShiftId, payload);
      if (saved?.id || editingShiftId) try { window.localStorage.setItem(`shift_spec_${saved?.id || editingShiftId}`, finalSpecialty); } catch {}

      setModalOpen(false); await syncGlobalData();
    } finally { setSubmitting(false); }
  };

  const handleSendToMuralFromModal = async () => {
    if (!editingShiftId) return;
    if (!confirm('Disponibilizar no Mural?')) return;
    try {
      await autoHealingSaveShift(editingShiftId, { professional_id: null, status: 'vago' });
      setModalOpen(false); await syncGlobalData();
    } catch (err) { alert(err.message); }
  };

  const handleDeleteShift = async (shiftId) => {
    if (!confirm('Excluir plantão?')) return;
    try { await base44.entities.Shift.delete(shiftId); setModalOpen(false); await syncGlobalData(); } catch (err) { alert(err.message); }
  };

  return (
    <div className={`relative p-3 md:p-6 space-y-4 font-sans bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 ${activeTab === 'tv' ? 'fixed inset-0 z-50 bg-slate-950 text-white overflow-y-auto p-6 md:p-8' : ''}`}>
      
      {/* BOTÃO LATERAL FIXADO NA BORDA ESQUERDA (EXATAMENTE ONDE INDICOU A SETA) */}
      <button
        onClick={toggleMainSidebar}
        title={sidebarHidden ? "Expandir Menu Lateral Principal" : "Recolher Menu Lateral"}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-[40] bg-slate-900 border border-slate-700 text-sky-400 hover:text-white hover:bg-sky-600 shadow-2xl px-1.5 py-3 rounded-r-xl transition-all duration-200 flex items-center justify-center group"
      >
        {sidebarHidden ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* SELETOR DE SEÇÕES COM PERSISTÊNCIA & CONFIGURADOR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-400 shrink-0">
            <Building2 className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Setor:
          </div>
          <div className="w-full max-w-xs">
            <Select value={selectedSectorId} onValueChange={handleSelectSector}>
              <SelectTrigger className="h-9 text-xs font-black bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900">
                <SelectItem value="todos" className="font-bold text-sky-600">🏥 Todos os Setores</SelectItem>
                {(sectors || []).map(s => <SelectItem key={s.id} value={String(s.id)} className="text-xs">{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isManager && (
            <Button onClick={() => { setGeneratorConfig(prev => ({ ...prev, sector_id: selectedSectorId !== 'todos' ? selectedSectorId : ((sectors || [])[0]?.id || '') })); setGeneratorModalOpen(true); }} className="h-9 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-4 rounded-2xl shadow-md gap-1.5 shrink-0">
              <SlidersHorizontal className="w-4 h-4" /> Configurar & Gerar Escala
            </Button>
          )}

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0">
            <button onClick={() => setFilterTurno('todos')} className={`px-3 py-1 rounded-xl text-xs font-black ${filterTurno === 'todos' ? 'bg-white dark:bg-slate-800 shadow-sm' : 'text-slate-500'}`}>Todos</button>
            <button onClick={() => setFilterTurno('diurno')} className={`px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1 ${filterTurno === 'diurno' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300' : 'text-slate-500'}`}><Sun className="w-3 h-3 text-amber-500" /> Diurno</button>
            <button onClick={() => setFilterTurno('noturno')} className={`px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1 ${filterTurno === 'noturno' ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300' : 'text-slate-500'}`}><Moon className="w-3 h-3 text-indigo-500" /> Noturno</button>
          </div>
        </div>
      </div>

      {/* BARRA DE COMANDO COM O FILTRO "A PARTIR DE..." */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 rounded-2xl p-1 border border-slate-200 dark:border-slate-800">
            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={handleToday} className="px-3 py-1 text-xs font-black">Hoje</button>
            <button onClick={handleNextMonth} className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl"><ChevronRight className="w-4 h-4" /></button>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 px-3.5 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
            <Filter className="w-3.5 h-3.5 text-sky-600" />
            <span className="text-[11px] text-slate-500">A partir de:</span>
            <input 
              type="date" 
              value={startDateFilter}
              onChange={handleStartDateChange} 
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            />
            {startDateFilter && (
              <button onClick={() => setStartDateFilter('')} className="p-0.5 hover:text-rose-500">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-sky-600" /> {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
            <span className={`text-xs font-bold ${scalePublished ? 'text-emerald-600' : 'text-amber-500'}`}>
              {scalePublished ? '✓ Escala Publicada' : '⚠️ Modo Rascunho'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isManager && (
            <Button onClick={() => setScalePublished(!scalePublished)} variant={scalePublished ? 'outline' : 'default'} className={`h-9 px-4 text-xs font-black rounded-2xl gap-1.5 shadow-sm ${scalePublished ? 'border-emerald-500 text-emerald-600' : 'bg-emerald-600 text-white'}`}>
              <Send className="w-3.5 h-3.5" /> {scalePublished ? 'Publicada' : 'Publicar Escala'}
            </Button>
          )}

          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
            <button onClick={() => setActiveTab('mensal')} className={`px-3 py-1.5 rounded-xl text-xs font-black ${activeTab === 'mensal' ? 'bg-white dark:bg-sky-600 shadow-sm text-sky-600 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Grade Mensal</button>
            <button onClick={() => setActiveTab('dia')} className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 ${activeTab === 'dia' ? 'bg-white dark:bg-sky-600 shadow-sm text-sky-600 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}><Clock className="w-3.5 h-3.5" /> Plantão do Dia</button>
          </div>

          <Button variant="outline" onClick={() => setActiveTab(activeTab === 'tv' ? 'mensal' : 'tv')} className={`h-9 px-4 text-xs font-black rounded-2xl gap-2 ${activeTab === 'tv' ? 'bg-rose-600 text-white border-rose-500' : 'bg-slate-50 dark:bg-slate-950 text-amber-600 border-slate-200 hover:bg-slate-100'}`}>
            <MonitorPlay className="w-4 h-4" /> <span>{activeTab === 'tv' ? 'Sair da TV' : 'Modo TV CCO'}</span>
          </Button>

          {isManager && (
            <Button onClick={() => { setEditingShiftId(null); setFormData({ date: getLocalDateString(), sector_id: selectedSectorId !== 'todos' ? selectedSectorId : ((sectors || [])[0]?.id || ''), target_specialty: registeredSpecialties[0] || 'Clínica Médica', start_time: '07:00', end_time: '19:00', shift_type: 'diurno', action_type: 'alocar', professional_id: '', notes: '' }); setModalOpen(true); }} className="h-9 bg-sky-600 hover:bg-sky-500 text-white text-xs font-black px-5 rounded-2xl gap-1.5">
              <Plus className="w-4 h-4" /> Lançar Plantão
            </Button>
          )}
        </div>
      </div>

      {/* GRADE MENSAL COM ROLL RECOLHÍVEL */}
      {activeTab === 'mensal' && (
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          {isManager && (
            <aside className={`transition-all duration-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm shrink-0 space-y-3 roll-professionals ${trayCollapsed ? 'w-full lg:w-14 p-2.5 items-center' : 'w-full lg:w-72'}`}>
              <div className="flex items-center justify-between">
                {!trayCollapsed && (
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
                    <HeartPulse className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Roll Profissionais
                  </span>
                )}
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={toggleTray} 
                  title={trayCollapsed ? "Expandir Roll" : "Recolher Roll para aumentar grade"}
                  className="h-8 w-8 p-0 rounded-xl text-slate-500 hover:text-sky-600"
                >
                  {trayCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
                </Button>
              </div>

              {!trayCollapsed && (
                <>
                  <Select value={traySpecialtyFilter} onValueChange={setTraySpecialtyFilter}>
                    <SelectTrigger className="h-8 text-xs font-bold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"><SelectValue placeholder="Especialidade..." /></SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900">
                      <SelectItem value="todas">Todas Especialidades</SelectItem>
                      {registeredSpecialties.map(spec => <SelectItem key={spec} value={spec}>{spec}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input placeholder="Buscar profissional..." value={traySearch} onChange={e => setTraySearch(e.target.value)} className="pl-8 h-8 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl" />
                  </div>

                  <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                    {filteredTrayProfs.map(prof => (
                      <div key={prof.id} draggable onDragStart={(e) => handleDragStart(e, prof.id)} className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-sky-500 transition-all cursor-grab active:cursor-grabbing select-none shadow-sm flex items-center gap-2.5">
                        <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-mono font-black text-[10px] text-sky-600 dark:text-sky-400 shrink-0">{getInitials(prof.name)}</div>
                        <div className="min-w-0 flex-1"><div className="font-black text-xs text-slate-900 dark:text-white truncate">{formatFullName(prof.name)}</div><div className="text-[10px] text-slate-500 truncate">{prof.specialty || 'Clínica Geral'}</div></div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </aside>
          )}

          <div className="flex-1 w-full min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-center py-2.5">
              {WEEKDAYS.map(day => (<div key={day.short} className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400"><span className={day.weekend ? 'text-indigo-600 font-black' : ''}>{day.short}</span></div>))}
            </div>
            
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 dark:divide-slate-800">
              {Array.from({ length: (daysInMonth[0]?.getDay() || 0) }).map((_, idx) => (<div key={`empty-${idx}`} className="min-h-[190px] bg-slate-50/60 dark:bg-slate-950/40"></div>))}
              
              {daysInMonth.map(dateObj => {
                const dateStr = getLocalDateString(dateObj);
                const isToday = todayLocalStr === dateStr;
                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                const isSelected = selectedDays.includes(dateStr);
                const dayShifts = shiftsByDate[dateStr] || [];

                const manha = dayShifts.filter(s => { const h = parseInt((s.start_time || '07:00').split(':')[0]); return h >= 6 && h < 13; });
                const tarde = dayShifts.filter(s => { const h = parseInt((s.start_time || '07:00').split(':')[0]); return h >= 13 && h < 18; });
                const noite = dayShifts.filter(s => { const h = parseInt((s.start_time || '07:00').split(':')[0]); return h >= 18 || h < 6; });

                const renderCard = (shift) => {
                  const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
                  const status = getStatusBadge(shift);
                  const realSpec = extractSpecialty(shift, prof);

                  return (
                    <div key={shift.id} onClick={(e) => { e.stopPropagation(); if (isManager) { setEditingShiftId(shift.id); setFormData({ date: shift.date, sector_id: shift.sector_id, target_specialty: realSpec, start_time: shift.start_time, end_time: shift.end_time, shift_type: shift.shift_type || 'diurno', action_type: (shift.status === 'vago' || !prof) ? 'mural' : 'alocar', professional_id: shift.professional_id || '', notes: shift.notes || '' }); setModalOpen(true); } }} className={`p-1.5 rounded-xl border border-l-4 shadow-sm cursor-pointer transition-all hover:brightness-95 ${status.wrapper}`}>
                      <div className="flex justify-between font-mono text-[9px] mb-0.5 opacity-80">
                        <span>{shift.start_time}-{shift.end_time}</span>
                        <span className={`font-black uppercase tracking-tight flex items-center gap-1 ${status.text}`}>{status.icon} {status.label}</span>
                      </div>
                      <div className="font-black truncate leading-tight text-slate-900 dark:text-white">
                        {status.code === 'vaga' || status.code === 'perdida' ? `⚠️ ${status.label}` : formatFullName(prof?.name)}
                      </div>
                      <div className="text-[9px] font-semibold opacity-70 truncate">{realSpec}</div>
                    </div>
                  );
                };

                return (
                  <div key={dateStr} onClick={(e) => handleDayClick(dateStr, e)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDropOnDay(e, dateStr)} className={`min-h-[220px] p-2 transition-all flex flex-col justify-between select-none cursor-pointer ${isSelected ? 'bg-indigo-50 dark:bg-indigo-950/50 ring-2 ring-indigo-500 z-10' : isToday ? 'bg-sky-50/60 dark:bg-sky-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-850/50'}`}>
                    <div className={`flex items-center justify-between p-1 px-2.5 rounded-xl mb-1.5 border shadow-sm ${isToday ? 'bg-gradient-to-r from-sky-600 to-cyan-600 border-sky-400 text-white font-black' : isWeekend ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-200 text-indigo-800 dark:text-indigo-300 font-bold' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 text-slate-800 dark:text-slate-200 font-bold'}`}>
                      <span className="text-xs font-black">{dateObj.getDate()}</span>
                      <span className="text-[10px] uppercase font-bold opacity-70">{WEEKDAYS[dateObj.getDay()].short}</span>
                    </div>

                    <div className="space-y-2 flex-1 overflow-y-auto max-h-[240px] pr-0.5 text-[11px]">
                      {manha.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-200 block">☀️ Manhã</span>
                          {manha.map(renderCard)}
                        </div>
                      )}
                      {tarde.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-200 block">🌇 Tarde</span>
                          {tarde.map(renderCard)}
                        </div>
                      )}
                      {noite.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-200 block">🌙 Noite</span>
                          {noite.map(renderCard)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE EDIÇÃO COM LAYOUT DE ENCAIXE EXATO (IDÊNTICO AO PRINT 3)         */}
      {/* ========================================================================= */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md w-full max-w-[95vw] bg-slate-950 border border-slate-800 text-white shadow-2xl z-[9999] p-6 rounded-3xl overflow-hidden">
          <DialogHeader className="flex flex-row items-center justify-between pb-2">
            <DialogTitle className="text-base font-black text-sky-400">
              {editingShiftId ? 'Editar Plantão da Escala' : 'Lançar Novo Plantão'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveShift} className="space-y-4 py-1 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Data *</Label>
                <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Setor / Seção *</Label>
                <Select value={formData.sector_id} onValueChange={v => setFormData({ ...formData, sector_id: v })}>
                  <SelectTrigger className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white z-[99999]">
                    {(sectors || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-300">Especialidade Exigida *</Label>
              <Input placeholder="Ex: Ginecologista, Cirurgião Geral..." value={formData.target_specialty} onChange={e => setFormData({ ...formData, target_specialty: e.target.value })} className="h-10 bg-slate-900 border-slate-700 font-bold text-sky-400 rounded-xl" list="modal-specs" />
              <datalist id="modal-specs">{registeredSpecialties.map(spec => <option key={spec} value={spec} />)}</datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Horário de Início</Label>
                <Input type="time" value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })} className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Horário de Término</Label>
                <Input type="time" value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })} className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl" />
              </div>
            </div>

            {/* CONTAINER DESTINO DO PLANTÃO (ESTILIZADO IGUAL AO PRINT 3) */}
            <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-3">
              <Label className="text-xs font-black uppercase text-slate-400">Destino do Plantão</Label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  type="button" 
                  onClick={() => setFormData({ ...formData, action_type: 'alocar' })} 
                  className={`p-2.5 rounded-xl border text-xs font-black transition-all ${formData.action_type === 'alocar' ? 'bg-sky-600 border-sky-600 text-white shadow-md' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                >
                  Alocar Pessoal
                </button>
                <button 
                  type="button" 
                  onClick={() => setFormData({ ...formData, action_type: 'mural', professional_id: '' })} 
                  className={`p-2.5 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 ${formData.action_type === 'mural' ? 'bg-rose-600 border-rose-600 text-white shadow-md' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                >
                  <Flame className="w-3.5 h-3.5" /> Vaga no Mural
                </button>
              </div>
              
              {formData.action_type === 'alocar' ? (
                <div className="space-y-1 pt-1">
                  <Label className="text-xs font-bold text-slate-300">Profissional Disponível *</Label>
                  <div className="relative w-full">
                    <select
                      value={formData.professional_id || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const p = professionalMap[v];
                        setFormData({
                          ...formData,
                          professional_id: v,
                          target_specialty: p?.specialty || formData.target_specialty
                        });
                      }}
                      className="w-full h-11 px-3 py-2 bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none appearance-none truncate pr-8 cursor-pointer"
                    >
                      <option value="">Selecione o profissional da lista...</option>
                      {allActiveProfessionals.map(p => (
                        <option key={p.id} value={String(p.id)} className="bg-slate-900 text-white py-1">
                          {p.name} • {p.specialty || 'Geral'} ({p.document || 'CRM'})
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                      ▼
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-rose-400 bg-rose-950/40 p-2.5 rounded-xl border border-rose-900/60 leading-tight">
                  O plantão será disponibilizado no <b>Mural de Oportunidades</b> para que os profissionais assumam.
                </p>
              )}
            </div>
            
            {/* RODAPÉ SIMÉTRICO E ALINHADO: MESMO ENCAIXE DO PRINT 3 */}
            <DialogFooter className="pt-2 flex flex-row items-center justify-between border-t border-slate-800 mt-2 gap-2">
              <div className="flex items-center gap-2">
                {editingShiftId && (
                  <Button type="button" variant="ghost" onClick={() => handleDeleteShift(editingShiftId)} className="h-10 text-xs font-bold text-rose-400 hover:bg-rose-950/30 rounded-xl px-3">
                    <Trash2 className="w-4 h-4 mr-1" /> Excluir
                  </Button>
                )}
                {editingShiftId && formData.action_type === 'alocar' && (
                  <Button type="button" variant="outline" onClick={handleSendToMuralFromModal} className="h-10 text-xs font-bold border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xl px-3" title="Liberar vaga no Mural">
                    <ArrowLeftRight className="w-3.5 h-3.5 mr-1 text-amber-400" /> Mural
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="h-10 text-xs font-bold border-slate-700 text-slate-300 rounded-xl px-4">
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting} className="h-10 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs px-6 rounded-xl shadow-md">
                  Confirmar Plantão
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}