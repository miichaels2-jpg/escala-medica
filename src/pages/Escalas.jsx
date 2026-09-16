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
  Clock, Building2, UserPlus, SlidersHorizontal,
  Flame, ArrowRight, MonitorPlay, GripVertical, 
  Printer, Sun, Moon, X, MousePointerClick, HeartPulse, Trash2,
  CheckCircle2, Calendar as CalendarIcon, Radio
} from 'lucide-react';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS = [
  { short: 'Dom', weekend: true }, { short: 'Seg', weekend: false },
  { short: 'Ter', weekend: false }, { short: 'Qua', weekend: false },
  { short: 'Qui', weekend: false }, { short: 'Sex', weekend: false },
  { short: 'Sáb', weekend: true }
];

function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function autoHealingSaveShift(id, initialPayload) {
  let payload = { ...initialPayload };
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      if (id) {
        return await base44.entities.Shift.update(id, payload);
      } else {
        return await base44.entities.Shift.create(payload);
      }
    } catch (err) {
      const msg = err.message || '';
      const match = msg.match(/Could not find the '([^']+)' column of 'shifts'/i);
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
  const { shifts, sectors, professionals, selectedUnitId, company, isManager, syncGlobalData } = useAppData();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState('mensal'); // 'mensal' | 'dia' | 'tv'
  const [selectedSectorId, setSelectedSectorId] = useState('todos');
  const [filterTurno, setFilterTurno] = useState('todos'); 

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

  // Relógio robusto
  const [liveNow, setLiveNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setLiveNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [generatorModalOpen, setGeneratorModalOpen] = useState(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const registeredSpecialties = useMemo(() => {
    const set = new Set();
    professionals.forEach(p => { if (p.specialty && p.specialty.trim()) set.add(p.specialty.trim()); });
    return Array.from(set).sort();
  }, [professionals]);

  const [formData, setFormData] = useState({
    date: getLocalDateString(),
    sector_id: '',
    target_specialty: 'Clínica Médica',
    start_time: '07:00',
    end_time: '19:00',
    shift_type: 'diurno',
    action_type: 'alocar',
    professional_id: '',
    notes: ''
  });

  const [generatorConfig, setGeneratorConfig] = useState({
    sector_id: '',
    start_date: getLocalDateString(),
    duration_days: 30,
    slots: [
      { id: 'slot_1', specialty: 'Clínica Médica', start_time: '07:00', end_time: '19:00', quantity: 2, shift_type: 'diurno' },
      { id: 'slot_2', specialty: 'Clínica Médica', start_time: '19:00', end_time: '07:00', quantity: 2, shift_type: 'noturno' }
    ]
  });

  const handleAddSlot = () => {
    setGeneratorConfig(prev => ({
      ...prev,
      slots: [...prev.slots, { id: `slot_${Date.now()}`, specialty: registeredSpecialties[0] || 'Clínica Médica', start_time: '07:00', end_time: '19:00', quantity: 1, shift_type: 'diurno' }]
    }));
  };

  const handleRemoveSlot = (slotId) => {
    setGeneratorConfig(prev => ({ ...prev, slots: prev.slots.filter(s => s.id !== slotId) }));
  };

  const handleUpdateSlot = (slotId, field, value) => {
    setGeneratorConfig(prev => ({
      ...prev,
      slots: prev.slots.map(s => {
        if (s.id !== slotId) return s;
        const updated = { ...s, [field]: value };
        if (field === 'start_time') updated.shift_type = value >= '18:00' || value < '06:00' ? 'noturno' : 'diurno';
        return updated;
      })
    }));
  };

  const [batchData, setBatchData] = useState({ professional_id: '', sector_id: '', shift_type: 'diurno', start_time: '07:00', end_time: '19:00' });

  const handlePrevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  const handleToday = () => setCurrentDate(new Date());

  const sectorMap = useMemo(() => {
    const m = {}; sectors.forEach(s => { m[String(s.id)] = s; }); return m;
  }, [sectors]);

  const professionalMap = useMemo(() => {
    const m = {}; professionals.forEach(p => { m[String(p.id)] = p; }); return m;
  }, [professionals]);

  const daysInMonth = useMemo(() => {
    const date = new Date(currentYear, currentMonth, 1);
    const days = [];
    while (date.getMonth() === currentMonth) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [currentYear, currentMonth]);

  const isShiftMatchingTurno = (shift, filter) => {
    if (filter === 'todos') return true;
    const sType = shift.shift_type || (shift.start_time >= '18:00' || shift.start_time < '06:00' ? 'noturno' : 'diurno');
    return sType === filter;
  };

  const monthlyShifts = useMemo(() => {
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const prefix = `${currentYear}-${monthStr}`;

    return shifts.filter(s => {
      if (!s.date || !s.date.startsWith(prefix)) return false;
      if (selectedSectorId !== 'todos' && String(s.sector_id) !== String(selectedSectorId)) return false;
      if (!isShiftMatchingTurno(s, filterTurno)) return false;
      return true;
    });
  }, [shifts, currentYear, currentMonth, selectedSectorId, filterTurno]);

  const shiftsByDate = useMemo(() => {
    const map = {};
    monthlyShifts.forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [monthlyShifts]);

  // CÁLCULO PRECISO PARA O MODO TV E CORES DA GRADE
  const todayLocalStr = getLocalDateString(liveNow);
  const yesterdayLocalStr = getLocalDateString(new Date(liveNow.getTime() - 24 * 60 * 60 * 1000));

  const todayShiftsDetailed = useMemo(() => {
    const nowHour = liveNow.getHours();
    const nowMin = liveNow.getMinutes();
    const nowTotalMin = nowHour * 60 + nowMin;

    const todayRaw = shifts.filter(s => {
      if (selectedSectorId !== 'todos' && String(s.sector_id) !== String(selectedSectorId)) return false;
      if (!isShiftMatchingTurno(s, filterTurno)) return false;
      
      if (s.date === todayLocalStr) return true;
      if (s.date === yesterdayLocalStr && (s.shift_type === 'noturno' || (s.start_time && s.start_time >= '18:00'))) return true;
      return false;
    });

    const emAndamento = [];
    const proximoRendimento = [];
    const concluidosRecentes = [];

    todayRaw.forEach(shift => {
      const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
      if (shift.status === 'vago' || !prof) return;

      const [startH, startM] = (shift.start_time || '07:00').split(':').map(Number);
      const [endH, endM] = (shift.end_time || '19:00').split(':').map(Number);
      
      const startMin = startH * 60 + startM;
      let endMin = endH * 60 + endM;
      const isNightShift = endMin <= startMin;

      let isRunning = false;
      let minutesLeft = 0;
      let minutesAgo = 999;

      if (shift.date === todayLocalStr) {
        if (!isNightShift) {
          if (nowTotalMin >= startMin && nowTotalMin < endMin) {
            isRunning = true;
            minutesLeft = endMin - nowTotalMin;
          } else if (nowTotalMin >= endMin && (nowTotalMin - endMin) <= 60) {
            minutesAgo = nowTotalMin - endMin;
          } else if (nowTotalMin < startMin && (startMin - nowTotalMin) <= 120) {
            proximoRendimento.push({ shift, startsIn: startMin - nowTotalMin });
          }
        } else {
          if (nowTotalMin >= startMin) {
            isRunning = true;
            minutesLeft = (24 * 60 - nowTotalMin) + endMin;
          } else if (startMin > nowTotalMin && (startMin - nowTotalMin) <= 120) {
            proximoRendimento.push({ shift, startsIn: startMin - nowTotalMin });
          }
        }
      } else if (shift.date === yesterdayLocalStr && isNightShift) {
        if (nowTotalMin < endMin) {
          isRunning = true;
          minutesLeft = endMin - nowTotalMin;
        } else if (nowTotalMin >= endMin && (nowTotalMin - endMin) <= 60) {
          minutesAgo = nowTotalMin - endMin;
        }
      }

      if (isRunning) {
        emAndamento.push(shift);
        if (minutesLeft <= 120 && minutesLeft > 0) {
          proximoRendimento.push({ shift, minutesLeft });
        }
      } else if (minutesAgo <= 60) {
        concluidosRecentes.push({ shift, minutesAgo });
      }
    });

    return { emAndamento, proximoRendimento, concluidosRecentes, totalHoje: todayRaw.length };
  }, [shifts, todayLocalStr, yesterdayLocalStr, selectedSectorId, filterTurno, liveNow, professionalMap]);

  // Filtro de profissionais sem quebrar se apagar algo
  const filteredTrayProfs = useMemo(() => {
    const term = traySearch.toLowerCase().trim();
    return professionals.filter(p => {
      if (p.status !== 'ativo') return false;
      if (traySpecialtyFilter !== 'todas' && (p.specialty || '').toLowerCase() !== traySpecialtyFilter.toLowerCase()) {
        return false;
      }
      if (!term) return true;
      return (p.name || '').toLowerCase().includes(term) || (p.specialty || '').toLowerCase().includes(term);
    });
  }, [professionals, traySearch, traySpecialtyFilter]);

  // Status visual "Premium" para os Cards da Escala
  const getStatusUI = (shift) => {
    const isVago = shift.status === 'vago' || !shift.professional_id;
    const isPast = shift.date < todayLocalStr;

    if (isVago) {
      if (isPast) {
        return { wrapper: 'border-l-slate-400 bg-slate-50 dark:bg-slate-900/50 opacity-60 grayscale', icon: <AlertTriangle className="w-3 h-3 text-slate-500" />, label: 'PERDIDA', text: 'text-slate-500' };
      }
      return { wrapper: 'border-l-rose-500 bg-rose-50 dark:bg-rose-950/30', icon: <Flame className="w-3 h-3 text-rose-500 animate-pulse" />, label: 'VAGA ABERTA', text: 'text-rose-600 dark:text-rose-400' };
    }

    if (isPast) {
      return { wrapper: 'border-l-slate-300 bg-slate-100 dark:bg-slate-800/40 opacity-70', icon: <CheckCircle2 className="w-3 h-3 text-slate-400" />, label: 'CONCLUÍDO', text: 'text-slate-500 dark:text-slate-400' };
    }

    if (shift.date === todayLocalStr) {
      return { wrapper: 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-md', icon: <Radio className="w-3 h-3 text-emerald-500 animate-ping" />, label: 'AO VIVO', text: 'text-emerald-600 dark:text-emerald-400' };
    }

    return { wrapper: 'border-l-sky-400 bg-sky-50 dark:bg-sky-900/10', icon: <CalendarIcon className="w-3 h-3 text-sky-500" />, label: 'PROGRAMADO', text: 'text-sky-600 dark:text-sky-400' };
  };

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
    const targetSector = selectedSectorId !== 'todos' ? selectedSectorId : (sectors[0]?.id || '');
    if (!targetSector) { alert('Selecione um setor hospitalar.'); return; }

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
    } catch (err) { alert(err.message); } finally { setDraggingProfId(null); }
  };

  const handleExecuteGenerator = async (e) => {
    e.preventDefault();
    if (!generatorConfig.sector_id) { alert('Selecione o setor para a escala.'); return; }

    setSubmitting(true);
    try {
      const startDt = new Date(generatorConfig.start_date + 'T12:00:00');
      const totalDays = parseInt(generatorConfig.duration_days) || 30;

      for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
        const curDate = new Date(startDt);
        curDate.setDate(curDate.getDate() + dayOffset);
        const dateStr = getLocalDateString(curDate);

        for (const slot of generatorConfig.slots) {
          const qty = parseInt(slot.quantity) || 0;
          for (let q = 0; q < qty; q++) {
            const spec = slot.specialty || 'Clínica Médica';
            const sType = slot.shift_type || (slot.start_time >= '18:00' || slot.start_time < '06:00' ? 'noturno' : 'diurno');
            const saved = await autoHealingSaveShift(null, {
              company_id: company?.id || 'cmp_principal',
              unit_id: selectedUnitId || 'unit_h1',
              sector_id: generatorConfig.sector_id,
              target_specialty: spec,
              notes: `[ESP:${spec}]`,
              professional_id: null,
              date: dateStr,
              shift_type: sType,
              start_time: slot.start_time,
              end_time: slot.end_time,
              status: 'vago'
            });
            if (saved?.id) try { window.localStorage.setItem(`shift_spec_${saved.id}`, spec); } catch {}
          }
        }
      }

      setGeneratorModalOpen(false); await syncGlobalData(); alert('Escala gerada com sucesso!');
    } catch (err) { alert(err.message); } finally { setSubmitting(false); }
  };

  const handleTogglePublish = async () => {
    const nextState = !scalePublished;
    setScalePublished(nextState);
    try { window.localStorage.setItem(publishStorageKey, String(nextState)); } catch {}
    alert(nextState ? '✅ Escala Publicada!' : '⚠️ Escala em modo Rascunho.');
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
    <div className={`p-3 md:p-6 space-y-4 font-sans bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 ${activeTab === 'tv' ? 'fixed inset-0 z-50 bg-slate-950 text-white overflow-y-auto p-6 md:p-8' : ''}`}>
      
      {/* SELETOR DE SEÇÕES & CONFIGURADOR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-400 shrink-0">
            <Building2 className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Setor:
          </div>
          <div className="w-full max-w-xs">
            <Select value={selectedSectorId} onValueChange={setSelectedSectorId}>
              <SelectTrigger className="h-9 text-xs font-black bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900">
                <SelectItem value="todos" className="font-bold text-sky-600">🏥 Todos os Setores</SelectItem>
                {sectors.map(s => <SelectItem key={s.id} value={String(s.id)} className="text-xs">{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isManager && (
            <Button onClick={() => { setGeneratorConfig(prev => ({ ...prev, sector_id: selectedSectorId !== 'todos' ? selectedSectorId : (sectors[0]?.id || '') })); setGeneratorModalOpen(true); }} className="h-9 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-4 rounded-2xl shadow-md gap-1.5 shrink-0">
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

      {/* BARRA DE COMANDO */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 rounded-2xl p-1 border border-slate-200 dark:border-slate-800">
            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={handleToday} className="px-3 py-1 text-xs font-black">Hoje</button>
            <button onClick={handleNextMonth} className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-sky-600" /> {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
            <span className={`text-xs font-bold ${scalePublished ? 'text-emerald-600' : 'text-amber-500'}`}>
              {scalePublished ? '✓ Escala Publicada (Notificações Ativas)' : '⚠️ Modo Rascunho (Notificações Pausadas)'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isManager && (
            <Button onClick={handleTogglePublish} variant={scalePublished ? 'outline' : 'default'} className={`h-9 px-4 text-xs font-black rounded-2xl gap-1.5 ${scalePublished ? 'border-emerald-500 text-emerald-600' : 'bg-emerald-600 text-white'}`}>
              <Send className="w-3.5 h-3.5" /> {scalePublished ? 'Publicada' : 'Publicar Escala'}
            </Button>
          )}

          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
            <button onClick={() => setActiveTab('mensal')} className={`px-3 py-1.5 rounded-xl text-xs font-black ${activeTab === 'mensal' ? 'bg-white dark:bg-sky-600 shadow-sm' : 'text-slate-500'}`}>Grade Mensal</button>
            <button onClick={() => setActiveTab('dia')} className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 ${activeTab === 'dia' ? 'bg-white dark:bg-sky-600 shadow-sm' : 'text-slate-500'}`}><Clock className="w-3.5 h-3.5" /> Plantão do Dia</button>
          </div>

          <Button variant="outline" onClick={() => setActiveTab(activeTab === 'tv' ? 'mensal' : 'tv')} className={`h-9 px-4 text-xs font-black rounded-2xl gap-2 ${activeTab === 'tv' ? 'bg-rose-600 text-white' : 'text-amber-600'}`}>
            <MonitorPlay className="w-4 h-4" /> <span>{activeTab === 'tv' ? 'Sair da TV' : 'Modo TV CCO'}</span>
          </Button>

          {isManager && (
            <Button onClick={() => { setEditingShiftId(null); setFormData({ date: getLocalDateString(), sector_id: selectedSectorId !== 'todos' ? selectedSectorId : (sectors[0]?.id || ''), target_specialty: registeredSpecialties[0] || 'Clínica Médica', start_time: '07:00', end_time: '19:00', shift_type: 'diurno', action_type: 'alocar', professional_id: '', notes: '' }); setModalOpen(true); }} className="h-9 bg-sky-600 hover:bg-sky-500 text-white text-xs font-black px-5 rounded-2xl gap-1.5">
              <Plus className="w-4 h-4" /> Lançar Plantão
            </Button>
          )}
        </div>
      </div>

      {/* GRADE MENSAL (CORES HUMANIZADAS E STATUS EXPLÍCITOS) */}
      {activeTab === 'mensal' && (
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          {isManager && (
            <aside className="w-full lg:w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm shrink-0 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5"><HeartPulse className="w-4 h-4 text-sky-600" /> Roll Profissionais</span>
              </div>
              <Select value={traySpecialtyFilter} onValueChange={setTraySpecialtyFilter}>
                <SelectTrigger className="h-8 text-xs font-bold bg-slate-50 dark:bg-slate-950"><SelectValue placeholder="Especialidade..." /></SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 max-h-56">
                  <SelectItem value="todas">Todas Especialidades</SelectItem>
                  {registeredSpecialties.map(spec => <SelectItem key={spec} value={spec}>{spec}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input placeholder="Buscar profissional..." value={traySearch} onChange={e => setTraySearch(e.target.value)} className="pl-8 h-8 text-xs bg-slate-50 dark:bg-slate-950 rounded-xl" />
              </div>
              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {filteredTrayProfs.map(prof => (
                  <div key={prof.id} draggable onDragStart={(e) => handleDragStart(e, prof.id)} className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-sky-500 transition-all cursor-grab active:cursor-grabbing select-none shadow-sm flex items-center gap-2.5">
                    <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-mono font-black text-[10px] text-sky-600 shrink-0">{getInitials(prof.name)}</div>
                    <div className="min-w-0 flex-1"><div className="font-black text-xs text-slate-900 dark:text-white truncate">{formatFullName(prof.name)}</div><div className="text-[10px] text-slate-500 truncate">{prof.specialty || 'Clínica Geral'}</div></div>
                  </div>
                ))}
              </div>
            </aside>
          )}

          <div className="flex-1 w-full min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-center py-2.5">
              {WEEKDAYS.map(day => (<div key={day.short} className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400"><span className={day.weekend ? 'text-indigo-600 font-black' : ''}>{day.short}</span></div>))}
            </div>
            
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 dark:divide-slate-800">
              {Array.from({ length: daysInMonth[0].getDay() }).map((_, idx) => (<div key={`empty-${idx}`} className="min-h-[170px] bg-slate-50/60 dark:bg-slate-950/40"></div>))}
              
              {daysInMonth.map(dateObj => {
                const dateStr = getLocalDateString(dateObj);
                const isToday = todayLocalStr === dateStr;
                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                const dayShifts = shiftsByDate[dateStr] || [];

                const manhaTarde = dayShifts.filter(s => parseInt((s.start_time || '07:00').split(':')[0]) >= 6 && parseInt((s.start_time || '07:00').split(':')[0]) < 18);
                const noite = dayShifts.filter(s => parseInt((s.start_time || '07:00').split(':')[0]) >= 18 || parseInt((s.start_time || '07:00').split(':')[0]) < 6);

                return (
                  <div key={dateStr} onClick={(e) => handleDayClick(dateStr, e)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDropOnDay(e, dateStr)} className={`min-h-[190px] p-2 transition-all flex flex-col justify-between select-none cursor-pointer ${isToday ? 'bg-sky-50/60 dark:bg-sky-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-850/50'}`}>
                    <div className={`flex items-center justify-between p-1 px-2 rounded-xl mb-1.5 border shadow-sm ${isToday ? 'bg-gradient-to-r from-sky-600 to-cyan-600 border-sky-400 text-white font-black' : isWeekend ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-200 text-indigo-800 dark:text-indigo-300 font-bold' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 text-slate-800 dark:text-slate-200 font-bold'}`}>
                      <span className="text-xs font-black">{dateObj.getDate()}</span>
                      <span className="text-[10px] uppercase font-bold opacity-70">{WEEKDAYS[dateObj.getDay()].short}</span>
                    </div>

                    <div className="space-y-2 flex-1 overflow-y-auto max-h-[220px] pr-0.5">
                      
                      {/* TURNO DIURNO */}
                      {manhaTarde.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-400 block px-1">☀️ Diurno</span>
                          {manhaTarde.map(shift => {
                            const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
                            const status = getStatusUI(shift);
                            const realSpec = extractSpecialty(shift, prof);

                            return (
                              <div key={shift.id} onClick={(e) => { e.stopPropagation(); if (isManager) { setEditingShiftId(shift.id); setFormData({ date: shift.date, sector_id: shift.sector_id, target_specialty: realSpec, start_time: shift.start_time, end_time: shift.end_time, shift_type: 'diurno', action_type: (!prof) ? 'mural' : 'alocar', professional_id: shift.professional_id || '', notes: shift.notes || '' }); setModalOpen(true); } }} className={`p-2 rounded-xl border border-l-4 shadow-sm transition-all ${status.wrapper}`}>
                                <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase mb-0.5">
                                  <span className="truncate">{sectorMap[shift.sector_id]?.name}</span>
                                  <span className="font-mono">{shift.start_time}-{shift.end_time}</span>
                                </div>
                                <div className="flex items-center gap-1 mb-1">
                                  {status.icon}
                                  <span className={`text-[9px] font-black tracking-wider ${status.text}`}>[ {status.label} ]</span>
                                </div>
                                <div className="font-black text-xs truncate text-slate-900 dark:text-white">
                                  {!prof ? 'VAGA ABERTA' : formatFullName(prof?.name)}
                                </div>
                                <div className="text-[10px] font-semibold text-slate-500 truncate">{realSpec}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* TURNO NOTURNO */}
                      {noite.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 block px-1">🌙 Noturno</span>
                          {noite.map(shift => {
                            const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
                            const status = getStatusUI(shift);
                            const realSpec = extractSpecialty(shift, prof);

                            return (
                              <div key={shift.id} onClick={(e) => { e.stopPropagation(); if (isManager) { setEditingShiftId(shift.id); setFormData({ date: shift.date, sector_id: shift.sector_id, target_specialty: realSpec, start_time: shift.start_time, end_time: shift.end_time, shift_type: 'noturno', action_type: (!prof) ? 'mural' : 'alocar', professional_id: shift.professional_id || '', notes: shift.notes || '' }); setModalOpen(true); } }} className={`p-2 rounded-xl border border-l-4 shadow-sm transition-all ${status.wrapper}`}>
                                <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase mb-0.5">
                                  <span className="truncate">{sectorMap[shift.sector_id]?.name}</span>
                                  <span className="font-mono">{shift.start_time}-{shift.end_time}</span>
                                </div>
                                <div className="flex items-center gap-1 mb-1">
                                  {status.icon}
                                  <span className={`text-[9px] font-black tracking-wider ${status.text}`}>[ {status.label} ]</span>
                                </div>
                                <div className="font-black text-xs truncate text-slate-900 dark:text-white">
                                  {!prof ? 'VAGA ABERTA' : formatFullName(prof?.name)}
                                </div>
                                <div className="text-[10px] font-semibold text-slate-500 truncate">{realSpec}</div>
                              </div>
                            );
                          })}
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

      {/* VISÃO: PLANTÃO DO DIA (CABEÇALHO OFICIAL) */}
      {activeTab === 'dia' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase text-sky-600 dark:text-sky-400 tracking-wider block">Escala Oficial Diária</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  Plantões de Hoje ({liveNow.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })})
                </h3>
              </div>
              <Button onClick={() => setPrintPreviewOpen(true)} className="h-10 bg-slate-900 hover:bg-slate-800 text-white dark:bg-sky-600 dark:hover:bg-sky-500 text-xs font-black px-5 rounded-2xl gap-2 shadow-md">
                <Printer className="w-4 h-4" /> Imprimir Plantão do Dia (A4)
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 uppercase text-[10px] font-black border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Seção / Setor</th>
                    <th className="py-3 px-4">Horário</th>
                    <th className="py-3 px-4">Profissional Escalado</th>
                    <th className="py-3 px-4">Especialidade / Atuação</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {todayShiftsDetailed.totalHoje === 0 ? (
                    <tr><td colSpan="5" className="py-8 text-center text-slate-400">Nenhum plantão registrado para hoje.</td></tr>
                  ) : (
                    shifts.filter(s => s.date === todayLocalStr && (selectedSectorId === 'todos' || String(s.sector_id) === String(selectedSectorId))).map(shift => {
                      const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
                      const sector = sectorMap[String(shift.sector_id)];
                      const isVago = shift.status === 'vago' || !prof;
                      const status = getStatusUI(shift);
                      const realSpecialty = extractSpecialty(shift, prof);

                      return (
                        <tr key={shift.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60 transition-colors">
                          <td className="py-3 px-4 font-black text-slate-900 dark:text-white">{sector?.name || 'Setor'}</td>
                          <td className="py-3 px-4 font-mono font-bold text-sky-600">{shift.start_time} - {shift.end_time}</td>
                          <td className="py-3 px-4 font-black text-slate-900 dark:text-slate-100">{isVago ? <span className="text-rose-600 font-black">⚠️ Vaga Aberta</span> : formatFullName(prof?.name)}</td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-semibold">{realSpecialty}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black tracking-wider ${status.wrapper} ${status.text} border-none`}>
                              {status.icon} {status.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODO TV CCO AO VIVO (BLINDADO E PERFEITO) */}
      {activeTab === 'tv' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3"><span className="w-3 h-3 rounded-full bg-rose-500 animate-ping"></span><h2 className="text-xl font-black text-white uppercase tracking-wider">Centro de Comando CCO • Ao Vivo</h2></div>
            <div className="font-mono text-cyan-400 font-black text-lg">{liveNow.toLocaleTimeString('pt-BR')}</div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> Plantões em Andamento (No Posto Neste Momento)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {todayShiftsDetailed.emAndamento.length === 0 ? <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-xs">Nenhum profissional em atendimento neste minuto.</div> : todayShiftsDetailed.emAndamento.map(shift => {
                const prof = professionalMap[String(shift.professional_id)];
                const sector = sectorMap[String(shift.sector_id)];
                const realSpecialty = extractSpecialty(shift, prof);
                return (
                  <div key={shift.id} className="p-4 bg-slate-900 border-2 border-emerald-500/40 rounded-2xl shadow-lg space-y-2">
                    <div className="flex justify-between items-center text-xs font-black text-emerald-400"><span>{sector?.name}</span><span className="font-mono text-[11px]">{shift.start_time} - {shift.end_time}</span></div>
                    <div className="text-sm font-black text-white truncate">{formatFullName(prof?.name)}</div>
                    <div className="text-[11px] text-slate-400">{realSpecialty}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase text-sky-400 tracking-wider flex items-center gap-2">
              <ArrowRight className="w-3.5 h-3.5" /> Próxima Rendição (Rendimento a Seguir nas próximas 2h)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {todayShiftsDetailed.proximoRendimento.length === 0 ? <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-xs">Nenhuma troca de turno programada para as próximas 2 horas.</div> : todayShiftsDetailed.proximoRendimento.map(({ shift, startsIn, minutesLeft }) => {
                const prof = professionalMap[String(shift.professional_id)];
                const sector = sectorMap[String(shift.sector_id)];
                return (
                  <div key={shift.id} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">{sector?.name}</span>
                      <div className="font-black text-xs text-white">{formatFullName(prof?.name)}</div>
                      <span className="text-[10px] text-sky-400 font-mono">{shift.start_time} às {shift.end_time}</span>
                    </div>
                    <span className="text-[10px] font-black uppercase bg-sky-500/20 text-sky-300 px-2 py-1 rounded-lg">
                      {startsIn !== undefined ? `Inicia em ${startsIn}m` : `Rende em ${minutesLeft}m`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* IMPRESSO EXECUTIVO A4 PAISAGEM (GARANTIA DE 100% BRANCO) */}
      <Dialog open={printPreviewOpen} onOpenChange={setPrintPreviewOpen}>
        <DialogContent className="sm:max-w-6xl max-h-[92vh] overflow-y-auto bg-white text-black border-none p-8 font-sans shadow-2xl">
          <style>{`
            @media print {
              @page { size: A4 landscape; margin: 8mm; }
              html, body, #root, .print-paper { background: #ffffff !important; color: #000000 !important; color-scheme: light !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .print-paper * { background: transparent !important; color: #000000 !important; border-color: #000000 !important; }
              .print-header { background: #f3f4f6 !important; -webkit-print-color-adjust: exact !important; }
              .print-no-break { page-break-inside: avoid; }
            }
          `}</style>
          
          <div className="print-paper space-y-6 bg-white text-black">
            <div className="flex items-center justify-between border-b-2 border-black pb-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl border-2 border-black flex items-center justify-center font-black text-3xl">{company?.name ? company.name[0] : 'H'}</div>
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-tight text-black">{company?.name || 'HOSPITAL PRINCIPAL'}</h1>
                  <p className="text-sm font-bold text-black uppercase tracking-wider">ESCALA OFICIAL DE PLANTÃO • MURAL HOSPITALAR</p>
                  <p className="text-xs text-black mt-1">Data de Vigência: <b>{liveNow.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</b></p>
                </div>
              </div>
              <div className="text-right text-xs text-black">
                <span className="font-black text-black border border-black px-2 py-1 uppercase block mb-1">DOCUMENTO OFICIAL AUDITÁVEL</span>
                <span className="text-[11px] text-black block">Emissão: {liveNow.toLocaleDateString('pt-BR')} às {liveNow.toLocaleTimeString('pt-BR')}</span>
              </div>
            </div>

            <div className="space-y-3">
              <table className="w-full border-collapse border-2 border-black text-xs">
                <thead className="print-header bg-slate-100 text-black uppercase text-[10px] font-black">
                  <tr>
                    <th className="border border-black p-2 text-left w-1/5">Seção / Setor</th>
                    <th className="border border-black p-2 text-left w-32">Horário</th>
                    <th className="border border-black p-2 text-left">Profissional Escalado</th>
                    <th className="border border-black p-2 text-left w-48">Especialidade / Atuação</th>
                    <th className="border border-black p-2 text-left w-32">Conselho</th>
                    <th className="border border-black p-2 text-center w-48">Assinatura / Presença</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black">
                  {shifts.filter(s => s.date === todayLocalStr && (selectedSectorId === 'todos' || String(s.sector_id) === String(selectedSectorId))).map((shift, idx) => {
                    const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
                    const sector = sectorMap[String(shift.sector_id)];
                    const isVago = shift.status === 'vago' || !prof;
                    const realSpecialty = extractSpecialty(shift, prof);

                    return (
                      <tr key={shift.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="border border-black p-2 font-black text-black uppercase">{sector?.name || 'Setor'}</td>
                        <td className="border border-black p-2 font-mono font-bold text-black">{shift.start_time} - {shift.end_time}</td>
                        <td className="border border-black p-2 font-black text-black">{isVago ? <span className="font-black">VAGA EM ABERTO</span> : `Dr(a). ${prof?.name}`}</td>
                        <td className="border border-black p-2 text-black font-semibold">{realSpecialty}</td>
                        <td className="border border-black p-2 font-mono text-black">{prof?.document || '—'}</td>
                        <td className="border border-black p-2 text-center text-black font-mono">____________________</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="print-no-break grid grid-cols-2 gap-12 pt-10 text-center text-xs">
              <div className="space-y-1"><div className="w-72 border-b border-black mx-auto"></div><span className="font-black text-black block uppercase">Diretoria Clínica / RT</span><span className="text-[10px] text-black">CRM / Carimbo Oficial</span></div>
              <div className="space-y-1"><div className="w-72 border-b border-black mx-auto"></div><span className="font-black text-black block uppercase">Gerência de Enfermagem / RT Assistencial</span><span className="text-[10px] text-black">COREN / Carimbo Oficial</span></div>
            </div>

            <div className="flex justify-end gap-3 print:hidden pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => setPrintPreviewOpen(false)} className="text-xs h-9 bg-white text-black border-slate-300">Fechar Janela</Button>
              <Button onClick={() => window.print()} className="h-9 bg-black text-white font-black text-xs px-6 gap-2 shadow-lg"><Printer className="w-4 h-4" /> Imprimir A4 Branco</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* GERADOR DE ESCALA (INCLUINDO SELETOR DE TURNO) */}
      <Dialog open={generatorModalOpen} onOpenChange={setGeneratorModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
          <DialogHeader><DialogTitle className="text-base font-black flex items-center gap-2"><SlidersHorizontal className="w-5 h-5 text-indigo-600" /> Gerador de Escala do Setor</DialogTitle></DialogHeader>
          <form onSubmit={handleExecuteGenerator} className="space-y-4 py-2 text-xs">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border space-y-3">
              <span className="text-xs font-black uppercase text-slate-500 block">1. Setor & Período</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1"><Label className="text-xs font-bold">Setor *</Label><Select value={generatorConfig.sector_id} onValueChange={v => setGeneratorConfig({ ...generatorConfig, sector_id: v })}><SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent className="bg-white dark:bg-slate-900">{sectors.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label className="text-xs font-bold">Início *</Label><Input type="date" value={generatorConfig.start_date} onChange={e => setGeneratorConfig({ ...generatorConfig, start_date: e.target.value })} className="h-9" /></div>
                <div className="space-y-1"><Label className="text-xs font-bold">Dias</Label><Select value={String(generatorConfig.duration_days)} onValueChange={v => setGeneratorConfig({ ...generatorConfig, duration_days: parseInt(v) })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent className="bg-white dark:bg-slate-900"><SelectItem value="7">7 Dias</SelectItem><SelectItem value="15">15 Dias</SelectItem><SelectItem value="30">30 Dias</SelectItem></SelectContent></Select></div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">2. Especialidades & Vagas</span>
                <Button type="button" size="sm" onClick={handleAddSlot} className="h-8 bg-sky-600 text-white font-black text-xs px-3 rounded-xl gap-1"><Plus className="w-3.5 h-3.5" /> Adicionar</Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {generatorConfig.slots.map(slot => (
                  <div key={slot.id} className="p-3 rounded-2xl bg-white dark:bg-slate-900 border grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-3 space-y-1"><Label className="text-[10px]">Especialidade</Label><Input value={slot.specialty} onChange={e => handleUpdateSlot(slot.id, 'specialty', e.target.value)} className="h-8 text-xs font-bold" list="specialties-datalist" /></div>
                    <div className="sm:col-span-2 space-y-1"><Label className="text-[10px]">Turno</Label><Select value={slot.shift_type} onValueChange={v => handleUpdateSlot(slot.id, 'shift_type', v)}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent className="bg-white dark:bg-slate-900"><SelectItem value="diurno">Diurno</SelectItem><SelectItem value="noturno">Noturno</SelectItem></SelectContent></Select></div>
                    <div className="sm:col-span-2 space-y-1"><Label className="text-[10px]">Entrada</Label><Input type="time" value={slot.start_time} onChange={e => handleUpdateSlot(slot.id, 'start_time', e.target.value)} className="h-8 text-xs" /></div>
                    <div className="sm:col-span-2 space-y-1"><Label className="text-[10px]">Saída</Label><Input type="time" value={slot.end_time} onChange={e => handleUpdateSlot(slot.id, 'end_time', e.target.value)} className="h-8 text-xs" /></div>
                    <div className="sm:col-span-2 space-y-1"><Label className="text-[10px]">Qtd. Vagas</Label><Input type="number" min="1" value={slot.quantity} onChange={e => handleUpdateSlot(slot.id, 'quantity', parseInt(e.target.value) || 1)} className="h-8 text-xs" /></div>
                    <div className="sm:col-span-1 flex justify-end"><Button type="button" variant="ghost" onClick={() => handleRemoveSlot(slot.id)} className="h-8 w-8 p-0 text-rose-500"><Trash2 className="w-4 h-4" /></Button></div>
                  </div>
                ))}
              </div>
              <datalist id="specialties-datalist">{registeredSpecialties.map(spec => <option key={spec} value={spec} />)}</datalist>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setGeneratorModalOpen(false)} className="h-9 text-xs">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="h-9 bg-indigo-600 text-white font-black text-xs px-6 rounded-xl">Gerar Vagas</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL INDIVIDUAL LIMPO */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border text-slate-900 dark:text-white">
          <DialogHeader><DialogTitle className="text-base font-black">{editingShiftId ? 'Editar Plantão' : 'Lançar Plantão'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveShift} className="space-y-3.5 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs font-bold">Data *</Label><Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="h-9" /></div>
              <div className="space-y-1"><Label className="text-xs font-bold">Setor *</Label><Select value={formData.sector_id} onValueChange={v => setFormData({ ...formData, sector_id: v })}><SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent className="bg-white dark:bg-slate-900">{sectors.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs font-bold">Especialidade / Atuação *</Label>
              <Input placeholder="Ex: Cirurgião Geral, UTI..." value={formData.target_specialty} onChange={e => setFormData({ ...formData, target_specialty: e.target.value })} className="h-9" list="modal-specs" />
              <datalist id="modal-specs">{registeredSpecialties.map(spec => <option key={spec} value={spec} />)}</datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs font-bold">Horário de Início</Label><Input type="time" value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })} className="h-9" /></div>
              <div className="space-y-1"><Label className="text-xs font-bold">Horário de Término</Label><Input type="time" value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })} className="h-9" /></div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border space-y-2.5">
              <Label className="text-xs font-black uppercase text-slate-500">Destino do Plantão</Label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setFormData({ ...formData, action_type: 'alocar' })} className={`p-2 rounded-xl border text-xs font-black ${formData.action_type === 'alocar' ? 'bg-sky-600 text-white' : 'bg-white dark:bg-slate-900'}`}>Alocar Pessoal</button>
                <button type="button" onClick={() => setFormData({ ...formData, action_type: 'mural', professional_id: '' })} className={`p-2 rounded-xl border text-xs font-black ${formData.action_type === 'mural' ? 'bg-rose-600 text-white' : 'bg-white dark:bg-slate-900'}`}><Flame className="w-3 h-3 inline mr-1" /> Vaga no Mural</button>
              </div>
              {formData.action_type === 'alocar' ? (
                <div className="space-y-1 pt-1"><Label className="text-xs font-bold">Profissional Disponível</Label><Select value={formData.professional_id} onValueChange={v => setFormData({ ...formData, professional_id: v })}><SelectTrigger className="h-9"><SelectValue placeholder="Selecione o profissional..." /></SelectTrigger><SelectContent className="bg-white dark:bg-slate-900 max-h-60">{eligibleProfessionalsForModal.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.specialty || 'Geral'})</SelectItem>)}</SelectContent></Select></div>
              ) : (
                <p className="text-[11px] text-rose-500 bg-rose-50 dark:bg-rose-500/10 p-2 rounded-xl">O plantão será disponibilizado imediatamente no <b>Mural de Oportunidades</b>.</p>
              )}
            </div>
            <DialogFooter className="pt-2 gap-2">
              {editingShiftId && (
                <div className="flex items-center gap-2 mr-auto">
                  {formData.action_type === 'alocar' && <Button type="button" variant="outline" onClick={handleSendToMuralFromModal} className="h-9 text-xs border-amber-500 text-amber-600">Mandar p/ Mural</Button>}
                  <Button type="button" variant="ghost" onClick={() => handleDeleteShift(editingShiftId)} className="h-9 text-xs text-rose-500"><Trash2 className="w-4 h-4 mr-1" /> Excluir</Button>
                </div>
              )}
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="h-9 text-xs">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="h-9 bg-sky-600 text-white font-black text-xs px-6 rounded-xl">Confirmar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}