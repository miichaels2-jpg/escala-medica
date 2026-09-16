import React, { useState, useMemo, useEffect } from 'react';
import { useAppData } from '@/lib/useAppData';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  CalendarDays, Plus, Search, Tv, ChevronLeft, ChevronRight, 
  Clock, Building2, User, AlertTriangle, CheckCircle2, 
  Trash2, Edit3, X, Minimize2, Sparkles, CheckCheck, Send, 
  MousePointerClick, HeartPulse, UserPlus, Layers, SlidersHorizontal,
  Flame, Radio, ArrowRight, ShieldAlert, MonitorPlay, GripVertical, 
  Printer, Sun, Moon, Stethoscope, FileText, CheckSquare
} from 'lucide-react';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS = [
  { short: 'Dom', long: 'Domingo', weekend: true },
  { short: 'Seg', long: 'Segunda-feira', weekend: false },
  { short: 'Ter', long: 'Terça-feira', weekend: false },
  { short: 'Qua', long: 'Quarta-feira', weekend: false },
  { short: 'Qui', long: 'Quinta-feira', weekend: false },
  { short: 'Sex', long: 'Sexta-feira', weekend: false },
  { short: 'Sáb', long: 'Sábado', weekend: true }
];

// Helper para obter a data local em formato YYYY-MM-DD sem bug de fuso UTC
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
      if (match && match[1]) {
        delete payload[match[1]];
        continue;
      }
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
  if (shift?.target_specialty && shift.target_specialty.trim() && shift.target_specialty.toLowerCase() !== 'geral') {
    return shift.target_specialty.trim();
  }
  if (shift?.notes) {
    const match = shift.notes.match(/\[ESP:([^\]]+)\]/i);
    if (match && match[1]) return match[1].trim();
  }
  try {
    const cached = window.localStorage.getItem(`shift_spec_${shift?.id}`);
    if (cached) return cached;
  } catch {}
  return prof?.specialty || shift?.target_specialty || 'Clínica Médica';
}

export default function Escalas() {
  const { 
    shifts, 
    sectors, 
    professionals, 
    selectedUnitId, 
    company, 
    isManager, 
    syncGlobalData 
  } = useAppData();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState('mensal'); // 'mensal' | 'dia' | 'tv'
  const [selectedSectorId, setSelectedSectorId] = useState('todos');
  const [filterTurno, setFilterTurno] = useState('todos'); // 'todos' | 'diurno' | 'noturno'

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const publishStorageKey = `scale_pub_${currentYear}_${currentMonth + 1}_${selectedUnitId}`;
  const [scalePublished, setScalePublished] = useState(() => {
    try {
      return window.localStorage.getItem(publishStorageKey) === 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      const isPub = window.localStorage.getItem(publishStorageKey) === 'true';
      setScalePublished(isPub);
    } catch {}
  }, [publishStorageKey]);

  const [selectedDays, setSelectedDays] = useState([]);
  const [traySearch, setTraySearch] = useState('');
  const [traySpecialtyFilter, setTraySpecialtyFilter] = useState('todas');
  const [draggingProfId, setDraggingProfId] = useState(null);

  // Relógio ao vivo
  const [liveNow, setLiveNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setLiveNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Modais
  const [modalOpen, setModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [generatorModalOpen, setGeneratorModalOpen] = useState(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Especialidades cadastradas no hospital
  const registeredSpecialties = useMemo(() => {
    const set = new Set();
    professionals.forEach(p => {
      if (p.specialty && p.specialty.trim()) set.add(p.specialty.trim());
    });
    return Array.from(set).sort();
  }, [professionals]);

  const [formData, setFormData] = useState({
    date: getLocalDateString(),
    sector_id: '',
    target_specialty: '',
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
      { id: 'slot_2', specialty: 'Enfermagem Geral', start_time: '07:00', end_time: '19:00', quantity: 4, shift_type: 'diurno' },
      { id: 'slot_3', specialty: 'Clínica Médica', start_time: '19:00', end_time: '07:00', quantity: 2, shift_type: 'noturno' }
    ]
  });

  const handleAddSlot = () => {
    const newSlot = {
      id: `slot_${Date.now()}`,
      specialty: registeredSpecialties[0] || 'Clínica Médica',
      start_time: '07:00',
      end_time: '19:00',
      quantity: 1,
      shift_type: 'diurno'
    };
    setGeneratorConfig(prev => ({ ...prev, slots: [...prev.slots, newSlot] }));
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
        if (field === 'start_time') {
          updated.shift_type = value >= '19:00' || value < '07:00' ? 'noturno' : 'diurno';
        }
        return updated;
      })
    }));
  };

  const [batchData, setBatchData] = useState({
    professional_id: '',
    sector_id: '',
    shift_type: 'diurno',
    start_time: '07:00',
    end_time: '19:00'
  });

  const handlePrevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  const handleToday = () => setCurrentDate(new Date());

  const sectorMap = useMemo(() => {
    const m = {};
    sectors.forEach(s => { m[String(s.id)] = s; });
    return m;
  }, [sectors]);

  const professionalMap = useMemo(() => {
    const m = {};
    professionals.forEach(p => { m[String(p.id)] = p; });
    return m;
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
    const sType = shift.shift_type || (shift.start_time >= '19:00' || shift.start_time < '07:00' ? 'noturno' : 'diurno');
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

  // CÁLCULO DA DATA E HORÁRIO LOCAL PRECISO (SEM BUG DE FUSO UTC)
  const todayLocalStr = getLocalDateString(liveNow);
  const yesterdayLocalStr = getLocalDateString(new Date(liveNow.getTime() - 24 * 60 * 60 * 1000));

  const todayShiftsDetailed = useMemo(() => {
    const nowHour = liveNow.getHours();
    const nowMin = liveNow.getMinutes();
    const nowTotalMin = nowHour * 60 + nowMin;

    // Busca plantões de hoje e também plantões noturnos de ontem que viraram para hoje
    const todayRaw = shifts.filter(s => {
      if (selectedSectorId !== 'todos' && String(s.sector_id) !== String(selectedSectorId)) return false;
      if (!isShiftMatchingTurno(s, filterTurno)) return false;
      
      if (s.date === todayLocalStr) return true;
      if (s.date === yesterdayLocalStr && (s.shift_type === 'noturno' || s.start_time >= '19:00')) return true;
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
      const isNightShift = endMin <= startMin; // Vira a noite

      let isRunning = false;
      let minutesLeft = 0;
      let minutesAgo = 999;

      if (shift.date === todayLocalStr) {
        if (!isNightShift) {
          // Plantão Diurno de hoje (ex: 07:00 às 19:00)
          if (nowTotalMin >= startMin && nowTotalMin < endMin) {
            isRunning = true;
            minutesLeft = endMin - nowTotalMin;
          } else if (nowTotalMin >= endMin && (nowTotalMin - endMin) <= 60) {
            minutesAgo = nowTotalMin - endMin;
          } else if (nowTotalMin < startMin && (startMin - nowTotalMin) <= 120) {
            proximoRendimento.push({ shift, startsIn: startMin - nowTotalMin });
          }
        } else {
          // Plantão Noturno que começou hoje (ex: 19:00 às 07:00 de amanhã)
          if (nowTotalMin >= startMin) {
            isRunning = true;
            minutesLeft = (24 * 60 - nowTotalMin) + endMin;
          } else if (startMin > nowTotalMin && (startMin - nowTotalMin) <= 120) {
            proximoRendimento.push({ shift, startsIn: startMin - nowTotalMin });
          }
        }
      } else if (shift.date === yesterdayLocalStr && isNightShift) {
        // Plantão Noturno de ontem que está terminando hoje de manhã (00:00 às 07:00)
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

  const eligibleProfessionalsForModal = useMemo(() => {
    const spec = (formData.target_specialty || '').toLowerCase().trim();
    if (!spec) return professionals.filter(p => p.status === 'ativo');

    const matching = professionals.filter(p => p.status === 'ativo' && (p.specialty || '').toLowerCase().includes(spec));
    return matching.length > 0 ? matching : professionals.filter(p => p.status === 'ativo');
  }, [professionals, formData.target_specialty]);

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

  const handleDayClick = (dateStr, e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setSelectedDays(prev => 
        prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
      );
    } else {
      if (selectedDays.length > 0) setSelectedDays([]);
    }
  };

  const handleDragStart = (e, profId) => {
    setDraggingProfId(profId);
    e.dataTransfer.setData('text/plain', profId);
  };

  const handleDropOnDay = async (e, dateStr) => {
    e.preventDefault();
    const profId = e.dataTransfer.getData('text/plain') || draggingProfId;
    if (!profId) return;

    const prof = professionalMap[profId];
    const targetSector = selectedSectorId !== 'todos' ? selectedSectorId : (sectors[0]?.id || '');

    if (!targetSector) {
      alert('Selecione ou cadastre um setor hospitalar.');
      return;
    }

    const targetDates = selectedDays.includes(dateStr) && selectedDays.length > 1 
      ? selectedDays 
      : [dateStr];

    const secName = sectorMap[targetSector]?.name || 'Setor';
    if (!confirm(`Alocar ${prof?.name} em "${secName}" para ${targetDates.length} dia(s)?`)) {
      setDraggingProfId(null);
      return;
    }

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
        if (saved?.id) {
          try { window.localStorage.setItem(`shift_spec_${saved.id}`, spec); } catch {}
        }
      }
      setSelectedDays([]);
      await syncGlobalData();
    } catch (err) {
      alert('Erro ao alocar: ' + err.message);
    } finally {
      setDraggingProfId(null);
    }
  };

  const handleExecuteGenerator = async (e) => {
    e.preventDefault();
    if (!generatorConfig.sector_id) {
      alert('Selecione o setor para a escala.');
      return;
    }

    if (generatorConfig.slots.length === 0) {
      alert('Adicione pelo menos uma especialidade/horário com o botão "+".');
      return;
    }

    const secName = sectorMap[generatorConfig.sector_id]?.name || 'Setor';
    const totalDays = parseInt(generatorConfig.duration_days) || 30;

    let dailySlotsCount = 0;
    generatorConfig.slots.forEach(s => dailySlotsCount += parseInt(s.quantity || 0));
    const grandTotal = dailySlotsCount * totalDays;

    if (!confirm(`Gerar grade de ${grandTotal} plantões planejados para ${totalDays} dias em "${secName}"?`)) {
      return;
    }

    setSubmitting(true);
    try {
      const startDt = new Date(generatorConfig.start_date + 'T12:00:00');

      for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
        const curDate = new Date(startDt);
        curDate.setDate(curDate.getDate() + dayOffset);
        const dateStr = getLocalDateString(curDate);

        for (const slot of generatorConfig.slots) {
          const qty = parseInt(slot.quantity) || 0;
          for (let q = 0; q < qty; q++) {
            const spec = slot.specialty || 'Clínica Médica';
            const saved = await autoHealingSaveShift(null, {
              company_id: company?.id || 'cmp_principal',
              unit_id: selectedUnitId || 'unit_h1',
              sector_id: generatorConfig.sector_id,
              target_specialty: spec,
              notes: `[ESP:${spec}]`,
              professional_id: null,
              date: dateStr,
              shift_type: slot.shift_type || 'diurno',
              start_time: slot.start_time,
              end_time: slot.end_time,
              status: 'vago'
            });
            if (saved?.id) {
              try { window.localStorage.setItem(`shift_spec_${saved.id}`, spec); } catch {}
            }
          }
        }
      }

      setGeneratorModalOpen(false);
      await syncGlobalData();
      alert(`Grade planejada de ${secName} gerada com sucesso! Você pode alocar os profissionais arrastando pelo roll.`);
    } catch (err) {
      alert('Erro ao gerar escala: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async () => {
    const nextState = !scalePublished;
    setScalePublished(nextState);
    try {
      window.localStorage.setItem(publishStorageKey, String(nextState));
    } catch {}

    if (nextState) {
      alert(`✅ Escala de ${MONTH_NAMES[currentMonth]} HOMOLOGADA e PUBLICADA!\nAgora as notificações oficiais de plantão estão liberadas para a equipe.`);
    } else {
      alert(`⚠️ A escala retornou para MODO RASCUNHO (notificações pausadas).`);
    }
  };

  const handleSaveBatch = async (e) => {
    e.preventDefault();
    if (!batchData.sector_id || !batchData.professional_id) {
      alert('Selecione o setor e o profissional.');
      return;
    }

    const prof = professionalMap[batchData.professional_id];
    const spec = prof?.specialty || 'Clínica Médica';

    setSubmitting(true);
    try {
      for (const d of selectedDays) {
        const saved = await autoHealingSaveShift(null, {
          company_id: company?.id || 'cmp_principal',
          unit_id: selectedUnitId || 'unit_h1',
          sector_id: batchData.sector_id,
          professional_id: batchData.professional_id,
          target_specialty: spec,
          notes: `[ESP:${spec}]`,
          date: d,
          shift_type: batchData.shift_type,
          start_time: batchData.start_time,
          end_time: batchData.end_time,
          status: 'confirmado'
        });
        if (saved?.id) {
          try { window.localStorage.setItem(`shift_spec_${saved.id}`, spec); } catch {}
        }
      }
      setBatchModalOpen(false);
      setSelectedDays([]);
      await syncGlobalData();
      alert(`${selectedDays.length} plantões lançados com sucesso!`);
    } catch (err) {
      alert('Erro no preenchimento: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!formData.sector_id || !formData.date) {
      alert('Preencha a data e o setor.');
      return;
    }

    const isMural = formData.action_type === 'mural';
    if (!isMural && !formData.professional_id) {
      alert('Selecione o profissional ou marque para enviar ao Mural.');
      return;
    }

    setSubmitting(true);
    try {
      const prof = formData.professional_id ? professionalMap[formData.professional_id] : null;
      const finalSpecialty = (formData.target_specialty || prof?.specialty || 'Clínica Médica').trim();
      const combinedNotes = `[ESP:${finalSpecialty}] ${formData.notes || ''}`.trim();

      const payload = {
        company_id: company?.id || 'cmp_principal',
        unit_id: selectedUnitId || 'unit_h1',
        sector_id: formData.sector_id,
        target_specialty: finalSpecialty,
        professional_id: isMural ? null : formData.professional_id,
        date: formData.date,
        shift_type: formData.shift_type,
        start_time: formData.start_time,
        end_time: formData.end_time,
        status: isMural ? 'vago' : 'confirmado',
        notes: combinedNotes
      };

      const saved = await autoHealingSaveShift(editingShiftId, payload);
      const savedId = saved?.id || editingShiftId;
      if (savedId) {
        try { window.localStorage.setItem(`shift_spec_${savedId}`, finalSpecialty); } catch {}
      }

      setModalOpen(false);
      await syncGlobalData();
      alert(isMural ? 'Plantão enviado para o Mural de Oportunidades!' : 'Plantão alocado com sucesso!');
    } catch (err) {
      alert('Erro ao salvar plantão: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendToMuralFromModal = async () => {
    if (!editingShiftId) return;
    if (!confirm('Desocupar este plantão e disponibilizá-lo como VAGA NO MURAL?')) return;
    
    setSubmitting(true);
    try {
      await autoHealingSaveShift(editingShiftId, {
        professional_id: null,
        status: 'vago'
      });
      setModalOpen(false);
      await syncGlobalData();
      alert('Vaga enviada para o Mural de Oportunidades!');
    } catch (err) {
      alert('Erro ao enviar para o mural: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteShift = async (shiftId) => {
    if (!confirm('Excluir este plantão definitivamente da escala?')) return;
    try {
      await base44.entities.Shift.delete(shiftId);
      setModalOpen(false);
      await syncGlobalData();
    } catch (err) {
      alert('Erro ao excluir plantão: ' + err.message);
    }
  };

  const getStatusBadge = (shift) => {
    const isVago = shift.status === 'vago' || !shift.professional_id;
    if (isVago) {
      return { dot: 'bg-rose-500 shadow-md shadow-rose-500/50 animate-pulse', label: 'Vaga Aberta', text: 'text-rose-600 dark:text-rose-400 font-black' };
    }
    if (shift.date < todayLocalStr) {
      return { dot: 'bg-slate-400 dark:bg-slate-500', label: 'Concluído', text: 'text-slate-500 dark:text-slate-400 font-bold' };
    }
    if (shift.date === todayLocalStr) {
      return { dot: 'bg-emerald-500 shadow-md shadow-emerald-500/50 animate-ping', label: 'Ao Vivo Hoje', text: 'text-emerald-600 dark:text-emerald-400 font-black' };
    }
    return { dot: 'bg-sky-500', label: 'Programado', text: 'text-sky-600 dark:text-sky-400 font-bold' };
  };

  return (
    <div className={`p-3 md:p-6 space-y-4 font-sans bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 ${activeTab === 'tv' ? 'fixed inset-0 z-50 bg-slate-950 text-white overflow-y-auto p-6 md:p-8' : ''}`}>
      
      {/* 1. SELETOR DE SEÇÕES COMPACTO */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden transition-colors">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-400 shrink-0">
            <Building2 className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Setor:
          </div>

          <div className="w-full max-w-xs">
            <Select value={selectedSectorId} onValueChange={setSelectedSectorId}>
              <SelectTrigger className="h-9 text-xs font-black bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl">
                <SelectValue placeholder="Selecione o setor..." />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-h-72">
                <SelectItem value="todos" className="font-bold text-sky-600 dark:text-sky-400">
                  🏥 Todos os Setores ({sectors.length})
                </SelectItem>
                {sectors.map(sec => (
                  <SelectItem key={sec.id} value={String(sec.id)} className="font-semibold text-xs">
                    {sec.name} {sec.code ? `[${sec.code}]` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedSectorId !== 'todos' && (
            <span className="hidden lg:inline-block px-3 py-1 rounded-xl text-xs font-black bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 truncate">
              Ativo: {sectorMap[selectedSectorId]?.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isManager && (
            <Button
              onClick={() => {
                setGeneratorConfig(prev => ({
                  ...prev,
                  sector_id: selectedSectorId !== 'todos' ? selectedSectorId : (sectors[0]?.id || '')
                }));
                setGeneratorModalOpen(true);
              }}
              className="h-9 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-4 rounded-2xl shadow-md gap-1.5 shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4" /> Configurar & Gerar Escala
            </Button>
          )}

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setFilterTurno('todos')}
              className={`px-3 py-1 rounded-xl text-xs font-black transition-all ${
                filterTurno === 'todos' 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setFilterTurno('diurno')}
              className={`px-3 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${
                filterTurno === 'diurno' 
                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sun className="w-3 h-3 text-amber-500" /> Diurno
            </button>
            <button
              type="button"
              onClick={() => setFilterTurno('noturno')}
              className={`px-3 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${
                filterTurno === 'noturno' 
                  ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-500/30 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Moon className="w-3 h-3 text-indigo-500" /> Noturno
            </button>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE COMANDO: MÊS, PUBLICAÇÃO E MODO TV */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden transition-colors">
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 rounded-2xl p-1 border border-slate-200 dark:border-slate-800">
            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={handleToday} className="px-3 py-1 text-xs font-black text-slate-900 dark:text-white">
              Hoje
            </button>
            <button onClick={handleNextMonth} className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span className={scalePublished ? 'text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1' : 'text-amber-500 font-bold flex items-center gap-1'}>
                <CheckCheck className="w-3.5 h-3.5" />
                {scalePublished ? 'Escala Publicada (Notificações Ativas)' : 'Modo Rascunho (Notificações Bloqueadas)'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isManager && (
            <Button
              onClick={handleTogglePublish}
              variant={scalePublished ? 'outline' : 'default'}
              className={`h-9 px-4 text-xs font-black rounded-2xl gap-1.5 shadow-sm ${
                scalePublished 
                  ? 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50' 
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              {scalePublished ? 'Publicada (Despublicar)' : 'Publicar Escala'}
            </Button>
          )}

          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('mensal')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                activeTab === 'mensal' ? 'bg-white dark:bg-sky-600 text-sky-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Grade Mensal
            </button>
            <button
              onClick={() => setActiveTab('dia')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'dia' ? 'bg-white dark:bg-sky-600 text-sky-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Plantão do Dia
            </button>
          </div>

          <Button
            variant="outline"
            onClick={() => setActiveTab(activeTab === 'tv' ? 'mensal' : 'tv')}
            className={`h-9 px-4 text-xs font-black rounded-2xl gap-2 shadow-sm ${
              activeTab === 'tv' 
                ? 'bg-rose-600 text-white border-rose-500' 
                : 'bg-slate-50 dark:bg-slate-950 text-amber-600 dark:text-amber-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
            }`}
          >
            {activeTab === 'tv' ? <Minimize2 className="w-4 h-4" /> : <MonitorPlay className="w-4 h-4" />}
            <span>{activeTab === 'tv' ? 'Sair da TV' : 'Modo TV CCO'}</span>
          </Button>

          {isManager && (
            <Button 
              onClick={() => {
                setEditingShiftId(null);
                setFormData({
                  date: getLocalDateString(),
                  sector_id: selectedSectorId !== 'todos' ? selectedSectorId : (sectors[0]?.id || ''),
                  target_specialty: registeredSpecialties[0] || 'Clínica Médica',
                  start_time: '07:00',
                  end_time: '19:00',
                  shift_type: 'diurno',
                  action_type: 'alocar',
                  professional_id: '',
                  notes: ''
                });
                setModalOpen(true);
              }} 
              className="h-9 bg-sky-600 hover:bg-sky-500 text-white text-xs font-black px-5 rounded-2xl shadow-md gap-1.5"
            >
              <Plus className="w-4 h-4" /> Lançar Plantão
            </Button>
          )}
        </div>
      </div>

      {/* 3. DOCA FLUTUANTE DE DIAS SELECIONADOS (CTRL) */}
      {selectedDays.length > 0 && (
        <div className="p-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-3xl shadow-xl flex items-center justify-between gap-4 animate-in fade-in print:hidden">
          <div className="flex items-center gap-2.5 text-xs font-black">
            <MousePointerClick className="w-5 h-5 animate-pulse" />
            <span>{selectedDays.length} dias selecionados com o atalho CTRL</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setBatchData({
                  professional_id: professionals[0]?.id || '',
                  sector_id: selectedSectorId !== 'todos' ? selectedSectorId : (sectors[0]?.id || ''),
                  shift_type: 'diurno',
                  start_time: '07:00',
                  end_time: '19:00'
                });
                setBatchModalOpen(true);
              }}
              className="h-8 bg-white text-indigo-900 hover:bg-slate-100 text-xs font-black rounded-xl"
            >
              <UserPlus className="w-3.5 h-3.5 mr-1" /> Preencher Selecionados
            </Button>
            <button onClick={() => setSelectedDays([])} className="p-1 hover:bg-white/20 rounded-xl text-xs">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. VISÃO A: PLANTÃO DO DIA (COM O ÚNICO BOTÃO "IMPRIMIR PLANTÃO DO DIA")  */}
      {/* ========================================================================= */}
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

              <Button
                onClick={() => setPrintPreviewOpen(true)}
                className="h-10 bg-slate-900 hover:bg-slate-800 text-white dark:bg-sky-600 dark:hover:bg-sky-500 text-xs font-black px-5 rounded-2xl gap-2 shadow-md"
              >
                <Printer className="w-4 h-4" /> Imprimir Plantão do Dia
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-black border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Seção / Setor</th>
                    <th className="py-3 px-4">Turno / Horário</th>
                    <th className="py-3 px-4">Profissional Escalado</th>
                    <th className="py-3 px-4">Especialidade / Atuação</th>
                    <th className="py-3 px-4">Conselho / Registro</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {todayShiftsDetailed.totalHoje === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-400">
                        Nenhum plantão registrado para a data de hoje nesta seção.
                      </td>
                    </tr>
                  ) : (
                    shifts.filter(s => s.date === todayLocalStr && (selectedSectorId === 'todos' || String(s.sector_id) === String(selectedSectorId))).map(shift => {
                      const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
                      const sector = sectorMap[String(shift.sector_id)];
                      const isVago = shift.status === 'vago' || !prof;
                      const status = getStatusBadge(shift);
                      const realSpecialty = extractSpecialty(shift, prof);

                      return (
                        <tr key={shift.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60 transition-colors">
                          <td className="py-3 px-4 font-black text-slate-900 dark:text-white">
                            {sector?.name || 'Setor'}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                            {shift.start_time} às {shift.end_time}
                          </td>
                          <td className="py-3 px-4 font-black text-slate-900 dark:text-slate-100">
                            {isVago ? (
                              <span className="text-rose-600 dark:text-rose-400 font-black">⚠️ Vaga Aberta</span>
                            ) : (
                              formatFullName(prof?.name)
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-semibold">
                            {realSpecialty}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">
                            {prof?.document || '—'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="flex items-center justify-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${status.dot}`}></span>
                              <span className={`text-[10px] ${status.text}`}>{status.label}</span>
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

      {/* ========================================================================= */}
      {/* 5. VISÃO: MODO TV CCO (SEM ERRO DE FUSO E COM CONTRASTE REAL)             */}
      {/* ========================================================================= */}
      {activeTab === 'tv' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping"></span>
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Centro de Comando CCO • Ao Vivo</h2>
            </div>
            <div className="font-mono text-cyan-400 font-black text-lg">
              {liveNow.toLocaleTimeString('pt-BR')}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Plantões em Andamento (No Posto Neste Momento)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {todayShiftsDetailed.emAndamento.length === 0 ? (
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-xs">
                  Nenhum profissional em atendimento registrado neste minuto exato.
                </div>
              ) : (
                todayShiftsDetailed.emAndamento.map(shift => {
                  const prof = professionalMap[String(shift.professional_id)];
                  const sector = sectorMap[String(shift.sector_id)];
                  const realSpecialty = extractSpecialty(shift, prof);

                  return (
                    <div key={shift.id} className="p-4 bg-slate-900 border-2 border-emerald-500/40 rounded-2xl shadow-lg space-y-2">
                      <div className="flex justify-between items-center text-xs font-black text-emerald-400">
                        <span>{sector?.name}</span>
                        <span className="font-mono text-[11px]">{shift.start_time} - {shift.end_time}</span>
                      </div>
                      <div className="text-sm font-black text-white truncate">{formatFullName(prof?.name)}</div>
                      <div className="text-[11px] text-slate-400">{realSpecialty} • {prof?.document || 'CRM'}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase text-sky-400 tracking-wider flex items-center gap-2">
              <ArrowRight className="w-3.5 h-3.5" /> Próxima Rendição (Rendimento a Seguir)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {todayShiftsDetailed.proximoRendimento.length === 0 ? (
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-xs">
                  Nenhuma troca de turno programada para as próximas 2 horas.
                </div>
              ) : (
                todayShiftsDetailed.proximoRendimento.map(({ shift, startsIn, minutesLeft }) => {
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
                })
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-slate-400 text-xs font-black uppercase">
              <span>Plantões Concluídos Recentemente (Histórico dos últimos 60 minutos)</span>
              <span>{todayShiftsDetailed.concluidosRecentes.length} no histórico</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
              {todayShiftsDetailed.concluidosRecentes.length === 0 ? (
                <div className="text-xs text-slate-500 italic">Nenhum plantão finalizado na última hora.</div>
              ) : (
                todayShiftsDetailed.concluidosRecentes.map(({ shift, minutesAgo }) => {
                  const prof = professionalMap[String(shift.professional_id)];
                  const sector = sectorMap[String(shift.sector_id)];

                  return (
                    <div key={shift.id} className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-xs opacity-75">
                      <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                        <span>{sector?.name}</span>
                        <span>Finalizou há {minutesAgo}m</span>
                      </div>
                      <div className="font-black text-slate-200 truncate mt-0.5">{formatFullName(prof?.name)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. VISÃO: GRADE MENSAL (CABEÇALHO LIMPO E CLIQUE NO CARD P/ OPÇÕES)       */}
      {/* ========================================================================= */}
      {activeTab === 'mensal' && (
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          
          {/* ROLL DE PROFISSIONAIS (DRAG & DROP) */}
          {isManager && (
            <aside className="w-full lg:w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm shrink-0 space-y-3 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  Roll de Profissionais
                </span>
                <span className="text-[10px] font-bold text-slate-400">Arraste p/ o dia</span>
              </div>

              {/* FILTRO DE ESPECIALIDADE DO ROLL */}
              <div className="space-y-1">
                <Select value={traySpecialtyFilter} onValueChange={setTraySpecialtyFilter}>
                  <SelectTrigger className="h-8 text-xs font-bold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sky-600 dark:text-sky-400 rounded-xl">
                    <SelectValue placeholder="Filtrar especialidade..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-h-56">
                    <SelectItem value="todas">Todas Especialidades</SelectItem>
                    {registeredSpecialties.map(spec => (
                      <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Buscar profissional..."
                  value={traySearch}
                  onChange={e => setTraySearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl"
                />
              </div>

              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {filteredTrayProfs.map(prof => (
                  <div
                    key={prof.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, prof.id)}
                    className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-sky-500 hover:bg-white dark:hover:bg-slate-900 transition-all cursor-grab active:cursor-grabbing select-none shadow-sm flex items-center gap-2.5"
                  >
                    <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-mono font-black text-[10px] text-sky-600 dark:text-sky-400 shrink-0">
                      {getInitials(prof.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-xs text-slate-900 dark:text-white truncate">{formatFullName(prof.name)}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate">{prof.specialty || 'Clínica Geral'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          )}

          {/* GRADE CALENDÁRIO COM CABEÇALHO LIMPO (SEM SINAL DE +) */}
          <div className="flex-1 w-full min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm transition-colors">
            
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-center py-2.5">
              {WEEKDAYS.map(day => (
                <div key={day.short} className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  <span className={day.weekend ? 'text-indigo-600 dark:text-indigo-400 font-black' : ''}>{day.short}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 dark:divide-slate-800">
              
              {Array.from({ length: daysInMonth[0].getDay() }).map((_, idx) => (
                <div key={`empty-${idx}`} className="min-h-[170px] bg-slate-50/60 dark:bg-slate-950/40"></div>
              ))}

              {daysInMonth.map(dateObj => {
                const dateStr = getLocalDateString(dateObj);
                const isToday = todayLocalStr === dateStr;
                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                const isSelected = selectedDays.includes(dateStr);
                const dayShifts = shiftsByDate[dateStr] || [];

                return (
                  <div
                    key={dateStr}
                    onClick={(e) => handleDayClick(dateStr, e)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropOnDay(e, dateStr)}
                    className={`min-h-[185px] p-2 transition-all flex flex-col justify-between select-none cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 ring-2 ring-indigo-500 z-10'
                        : isToday
                        ? 'bg-sky-50/60 dark:bg-sky-950/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-850/50'
                    }`}
                  >
                    {/* BARRA SUPERIOR LIMPA DA DATA */}
                    <div className={`flex items-center justify-between p-1 px-2.5 rounded-xl mb-1.5 border shadow-sm ${
                      isToday
                        ? 'bg-gradient-to-r from-sky-600 to-cyan-600 border-sky-400 text-white font-black'
                        : isWeekend
                        ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-200 dark:border-indigo-800/60 text-indigo-800 dark:text-indigo-300 font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold'
                    }`}>
                      <span className="text-xs font-black">{dateObj.getDate()}</span>
                      <span className="text-[10px] uppercase font-bold opacity-70">{WEEKDAYS[dateObj.getDay()].short}</span>
                    </div>

                    {/* LISTAGEM DOS PLANTÕES */}
                    <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[190px] pr-0.5">
                      {dayShifts.map(shift => {
                        const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
                        const sector = sectorMap[String(shift.sector_id)];
                        const isVago = shift.status === 'vago' || !prof;
                        const badge = getStatusBadge(shift);
                        const realSpecialty = extractSpecialty(shift, prof);

                        return (
                          <div
                            key={shift.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isManager) {
                                setEditingShiftId(shift.id);
                                setFormData({
                                  date: shift.date || '',
                                  sector_id: shift.sector_id || '',
                                  target_specialty: realSpecialty,
                                  start_time: shift.start_time || '07:00',
                                  end_time: shift.end_time || '19:00',
                                  shift_type: shift.shift_type || 'diurno',
                                  action_type: isVago ? 'mural' : 'alocar',
                                  professional_id: shift.professional_id || '',
                                  notes: shift.notes || ''
                                });
                                setModalOpen(true);
                              }
                            }}
                            className={`p-2 rounded-2xl border transition-all cursor-pointer shadow-sm hover:border-slate-400 dark:hover:border-slate-600 ${
                              isVago 
                                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/50' 
                                : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-500 mb-1">
                              <span className="truncate max-w-[100px] text-sky-600 dark:text-sky-400 font-bold" title={sector?.name}>
                                {sector?.name || 'Setor'}
                              </span>
                              <span className="font-mono text-slate-400">{shift.start_time}-{shift.end_time}</span>
                            </div>

                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${badge.dot}`}></span>
                              <span className={`text-[10px] ${badge.text}`}>{badge.label}</span>
                            </div>

                            <div className="font-black text-xs text-slate-900 dark:text-white truncate">
                              {isVago ? '⚠️ Vaga em Aberto' : formatFullName(prof?.name)}
                            </div>

                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate mt-0.5">
                              {realSpecialty}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {isManager && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingShiftId(null);
                          setFormData({
                            date: dateStr,
                            sector_id: selectedSectorId !== 'todos' ? selectedSectorId : (sectors[0]?.id || ''),
                            target_specialty: registeredSpecialties[0] || 'Clínica Médica',
                            start_time: '07:00',
                            end_time: '19:00',
                            shift_type: 'diurno',
                            action_type: 'alocar',
                            professional_id: '',
                            notes: ''
                          });
                          setModalOpen(true);
                        }}
                        className="mt-1 w-full py-1 text-[10px] font-bold text-slate-400 hover:text-sky-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all text-center border border-dashed border-slate-200 dark:border-slate-800"
                      >
                        + Adicionar Vaga
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. FOLHA DE IMPRESSÃO EXECUTIVA OFICIAL A4 PAISAGEM (100% BRANCO)         */}
      {/* ========================================================================= */}
      <Dialog open={printPreviewOpen} onOpenChange={setPrintPreviewOpen}>
        <DialogContent className="sm:max-w-6xl max-h-[94vh] overflow-y-auto bg-white text-slate-900 border-none p-8 font-sans shadow-2xl">
          
          <style>{`
            @media print {
              @page {
                size: A4 landscape;
                margin: 6mm;
              }
              html, body, #root {
                background: #ffffff !important;
                color: #000000 !important;
                color-scheme: light !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .print-container, .print-container * {
                background: #ffffff !important;
                color: #000000 !important;
                border-color: #333333 !important;
              }
              .print-no-break {
                page-break-inside: avoid;
              }
            }
          `}</style>

          <div className="print-container space-y-6 bg-white text-slate-900">
            
            {/* CABEÇALHO OFICIAL DE ALTO PADRÃO */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-2xl shadow-sm">
                  {company?.name ? company.name[0] : 'H'}
                </div>
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">{company?.name || 'HOSPITAL PRINCIPAL'}</h1>
                  <p className="text-xs font-black text-slate-700 tracking-wider uppercase">
                    ESCALA MÉDICA & ASSISTENCIAL OFICIAL • REGISTRO DIÁRIO DE PLANTÃO
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Data de Vigência: <b className="text-slate-950">{liveNow.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</b>
                  </p>
                </div>
              </div>

              <div className="text-right text-xs space-y-1">
                <span className="font-black text-slate-900 bg-slate-100 border border-slate-300 px-2.5 py-1 rounded block uppercase">
                  DOCUMENTO OFICIAL AUDITÁVEL
                </span>
                <span className="text-[11px] text-slate-600 block">
                  Emissão: {liveNow.toLocaleDateString('pt-BR')} às {liveNow.toLocaleTimeString('pt-BR')}
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  Cód. Autenticidade: SM-ESC-{Date.now().toString(36).toUpperCase()}
                </span>
              </div>
            </div>

            {/* TABELA DE PLANTÕES COM LINHAS ZEBRADAS E CONTRASTE NÍTIDO */}
            <div className="space-y-2">
              <table className="w-full border-collapse border border-slate-400 text-xs">
                <thead className="bg-slate-100 text-slate-900 uppercase text-[10px] font-black">
                  <tr>
                    <th className="border border-slate-400 p-2 text-left w-1/5">Seção / Setor</th>
                    <th className="border border-slate-400 p-2 text-left w-28">Horário</th>
                    <th className="border border-slate-400 p-2 text-left">Profissional Escalado</th>
                    <th className="border border-slate-400 p-2 text-left w-36">Conselho / Registro</th>
                    <th className="border border-slate-400 p-2 text-left w-44">Especialidade / Atuação</th>
                    <th className="border border-slate-400 p-2 text-center w-48">Assinatura / Rubrica</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {shifts.filter(s => s.date === todayLocalStr && (selectedSectorId === 'todos' || String(s.sector_id) === String(selectedSectorId))).map((shift, idx) => {
                    const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
                    const sector = sectorMap[String(shift.sector_id)];
                    const isVago = shift.status === 'vago' || !prof;
                    const realSpecialty = extractSpecialty(shift, prof);

                    return (
                      <tr key={shift.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="border border-slate-400 p-2 font-black text-slate-900 uppercase">{sector?.name || 'Setor'}</td>
                        <td className="border border-slate-400 p-2 font-mono font-bold text-slate-900">{shift.start_time} - {shift.end_time}</td>
                        <td className="border border-slate-400 p-2 font-black text-slate-900">
                          {isVago ? <span className="text-red-700 font-black uppercase">⚠️ VAGA EM ABERTO</span> : `Dr(a). ${prof?.name}`}
                        </td>
                        <td className="border border-slate-400 p-2 font-mono text-slate-800">{prof?.document || '—'}</td>
                        <td className="border border-slate-400 p-2 font-bold text-slate-800">{realSpecialty}</td>
                        <td className="border border-slate-400 p-2 text-center text-slate-400 font-mono">____________________</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ASSINATURAS E RESPONSABILIDADE TÉCNICA */}
            <div className="print-no-break grid grid-cols-2 gap-12 pt-8 border-t-2 border-slate-900 text-center text-xs">
              <div className="space-y-1">
                <div className="w-72 border-b border-slate-900 mx-auto"></div>
                <span className="font-black text-slate-900 block uppercase">Diretoria Clínica / Responsável Técnico</span>
                <span className="text-[10px] text-slate-500">CRM / Carimbo Oficial</span>
              </div>

              <div className="space-y-1">
                <div className="w-72 border-b border-slate-900 mx-auto"></div>
                <span className="font-black text-slate-900 block uppercase">Gerência de Enfermagem / RT Assistencial</span>
                <span className="text-[10px] text-slate-500">COREN / Carimbo Oficial</span>
              </div>
            </div>

            {/* RODAPÉ DO DOCUMENTO */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-300 text-[9px] text-slate-500">
              <span>ScaleMedic Hospital Intelligence • Documento Homologado para Afixação Obrigatória em Mural Físico</span>
              <span>Página 1 de 1 • Sistema Certificado</span>
            </div>

            <div className="flex justify-end gap-3 print:hidden pt-4 border-t border-slate-200">
              <Button variant="outline" onClick={() => setPrintPreviewOpen(false)} className="text-xs h-9 bg-white text-slate-700 border-slate-300">
                Fechar
              </Button>
              <Button onClick={() => window.print()} className="h-9 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs px-6 gap-2 shadow-lg">
                <Printer className="w-4 h-4" /> Imprimir em Folha A4 Branca
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 8. MODAL GERADOR LIVRE: COM BOTÃO "+" E ESPECIALIDADES DO CORPO CLÍNICO   */}
      {/* ========================================================================= */}
      <Dialog open={generatorModalOpen} onOpenChange={setGeneratorModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
              Configurar & Gerar Escala do Setor (Livre Preenchimento)
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleExecuteGenerator} className="space-y-4 py-2 text-xs">
            
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <span className="text-xs font-black uppercase text-slate-500 block">1. Setor & Período</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-1">
                  <Label className="text-xs font-bold">Setor Alvo *</Label>
                  <Select value={generatorConfig.sector_id} onValueChange={v => setGeneratorConfig({ ...generatorConfig, sector_id: v })}>
                    <SelectTrigger className="h-9 bg-white dark:bg-slate-900"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900">
                      {sectors.map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">Data Início *</Label>
                  <Input type="date" value={generatorConfig.start_date} onChange={e => setGeneratorConfig({ ...generatorConfig, start_date: e.target.value })} className="h-9 bg-white dark:bg-slate-900" />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">Quantidade de Dias</Label>
                  <Select value={String(generatorConfig.duration_days)} onValueChange={v => setGeneratorConfig({ ...generatorConfig, duration_days: parseInt(v) })}>
                    <SelectTrigger className="h-9 bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900">
                      <SelectItem value="7">7 Dias (1 Semana)</SelectItem>
                      <SelectItem value="15">15 Dias (Quinzena)</SelectItem>
                      <SelectItem value="30">30 Dias (Mês Completo)</SelectItem>
                      <SelectItem value="60">60 Dias (Bimestre)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 block">
                    2. Especialidades, Horários e Quantidade de Vagas
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Defina livremente quem e quantos profissionais assumirão cada horário por dia.
                  </span>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddSlot}
                  className="h-8 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs px-3 rounded-xl gap-1 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Especialidade
                </Button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {generatorConfig.slots.map(slot => (
                  <div key={slot.id} className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end shadow-sm">
                    
                    <div className="sm:col-span-4 space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500">Especialidade / Atuação</Label>
                      <Input
                        placeholder="Digite ou escolha..."
                        value={slot.specialty}
                        onChange={e => handleUpdateSlot(slot.id, 'specialty', e.target.value)}
                        className="h-8 text-xs font-bold"
                        list="specialties-datalist"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500">Entrada</Label>
                      <Input
                        type="time"
                        value={slot.start_time}
                        onChange={e => handleUpdateSlot(slot.id, 'start_time', e.target.value)}
                        className="h-8 text-xs font-bold"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500">Saída</Label>
                      <Input
                        type="time"
                        value={slot.end_time}
                        onChange={e => handleUpdateSlot(slot.id, 'end_time', e.target.value)}
                        className="h-8 text-xs font-bold"
                      />
                    </div>

                    <div className="sm:col-span-3 space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500">Qtd. Vagas/Dia</Label>
                      <Input
                        type="number"
                        min="1"
                        max="30"
                        value={slot.quantity}
                        onChange={e => handleUpdateSlot(slot.id, 'quantity', parseInt(e.target.value) || 1)}
                        className="h-8 text-xs font-bold"
                      />
                    </div>

                    <div className="sm:col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleRemoveSlot(slot.id)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <datalist id="specialties-datalist">
                {registeredSpecialties.map(spec => (
                  <option key={spec} value={spec} />
                ))}
              </datalist>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setGeneratorModalOpen(false)} className="h-9 text-xs">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="h-9 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-6 rounded-xl shadow-md">
                {submitting ? 'Gerando Escala...' : 'Gerar Vagas Personalizadas'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: PREENCHIMENTO EM LOTE (CTRL) */}
      <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              Preenchimento em Lote ({selectedDays.length} Dias)
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveBatch} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Profissional a Escalar *</Label>
              <Select value={batchData.professional_id} onValueChange={v => setBatchData({ ...batchData, professional_id: v })}>
                <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900">
                  {professionals.filter(p => p.status === 'ativo').map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Seção / Setor *</Label>
              <Select value={batchData.sector_id} onValueChange={v => setBatchData({ ...batchData, sector_id: v })}>
                <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900">
                  {sectors.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Início</Label>
                <Input type="time" value={batchData.start_time} onChange={e => setBatchData({ ...batchData, start_time: e.target.value })} className="h-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Término</Label>
                <Input type="time" value={batchData.end_time} onChange={e => setBatchData({ ...batchData, end_time: e.target.value })} className="h-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
              </div>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button type="button" variant="outline" onClick={() => setBatchModalOpen(false)} className="h-9 text-xs">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="h-9 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-5 rounded-xl">
                Confirmar p/ {selectedDays.length} Dias
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: EDITAR OU LANÇAR PLANTÃO INDIVIDUAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-sky-600" />
              {editingShiftId ? 'Editar Plantão da Escala' : 'Lançar Novo Plantão'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveShift} className="space-y-3.5 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Data *</Label>
                <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="h-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Seção / Setor *</Label>
                <Select value={formData.sector_id} onValueChange={v => setFormData({ ...formData, sector_id: v })}>
                  <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900">
                    {sectors.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Especialidade / Atuação *</Label>
                <span className="text-[10px] text-sky-600 font-bold">Filtra os profissionais abaixo</span>
              </div>
              <Input
                placeholder="Ex: Cardiologia, UTI, Pediatria..."
                value={formData.target_specialty}
                onChange={e => setFormData({ ...formData, target_specialty: e.target.value })}
                className="h-9 bg-slate-50 dark:bg-slate-950"
                list="modal-specialties"
              />
              <datalist id="modal-specialties">
                {registeredSpecialties.map(spec => (
                  <option key={spec} value={spec} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Hora Início</Label>
                <Input type="time" value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })} className="h-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Hora Término</Label>
                <Input type="time" value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })} className="h-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
              <Label className="text-xs font-black uppercase text-slate-500">Destino do Plantão</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, action_type: 'alocar' })}
                  className={`p-2.5 rounded-xl border text-xs font-black text-center transition-all ${
                    formData.action_type === 'alocar'
                      ? 'bg-sky-600 text-white shadow-md'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Alocar Profissional
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, action_type: 'mural', professional_id: '' })}
                  className={`p-2.5 rounded-xl border text-xs font-black text-center transition-all flex items-center justify-center gap-1.5 ${
                    formData.action_type === 'mural'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" /> Mandar p/ Mural
                </button>
              </div>

              {formData.action_type === 'alocar' ? (
                <div className="space-y-1 pt-1">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Profissional Escalado</Label>
                  <Select value={formData.professional_id} onValueChange={v => setFormData({ ...formData, professional_id: v })}>
                    <SelectTrigger className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900 max-h-60">
                      {eligibleProfessionalsForModal.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} ({p.specialty || 'Geral'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 p-2 rounded-xl border border-rose-200 dark:border-rose-500/20">
                  📢 O plantão será publicado no <b>Mural de Oportunidades</b> como vaga aberta.
                </p>
              )}
            </div>

            <DialogFooter className="pt-2 flex-col sm:flex-row gap-2">
              {editingShiftId && (
                <div className="flex items-center gap-2 mr-auto">
                  {formData.action_type === 'alocar' && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendToMuralFromModal}
                      className="h-9 text-xs font-black border-amber-500/50 text-amber-600 hover:bg-amber-50 gap-1"
                    >
                      <Flame className="w-3.5 h-3.5 text-amber-500" /> Mandar p/ Mural
                    </Button>
                  )}
                  <Button type="button" variant="ghost" onClick={() => handleDeleteShift(editingShiftId)} className="h-9 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20">
                    <Trash2 className="w-4 h-4 mr-1" /> Excluir
                  </Button>
                </div>
              )}
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="h-9 text-xs">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="h-9 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs px-6 rounded-xl">
                {submitting ? 'Salvando...' : 'Confirmar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}