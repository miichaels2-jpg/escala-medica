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
  Flame, Radio, ArrowRight, ShieldAlert, MonitorPlay, GripVertical
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

// Cores temáticas por seção
const SECTOR_THEMES = [
  { border: 'border-emerald-500/50', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { border: 'border-cyan-500/50', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
  { border: 'border-indigo-500/50', badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
  { border: 'border-purple-500/50', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { border: 'border-amber-500/50', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30' }
];

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
  if (!name) return 'Vaga Aberta';
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
  const [activeView, setActiveView] = useState('mes'); // 'mes' | 'dia'
  const [selectedSectorId, setSelectedSectorId] = useState('todos');
  const [tvMode, setTvMode] = useState(false);

  // Seleção múltipla com a tecla CTRL
  const [selectedDays, setSelectedDays] = useState([]);

  // Roll de Profissionais (Drag and Drop)
  const [traySearch, setTraySearch] = useState('');
  const [draggingProfId, setDraggingProfId] = useState(null);

  // Modais
  const [modalOpen, setModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Formulário do Plantão
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    sector_id: '',
    target_category: 'medico',
    start_time: '07:00',
    end_time: '19:00',
    action_type: 'alocar',
    professional_id: '',
    notes: ''
  });

  const [batchData, setBatchData] = useState({
    professional_id: '',
    sector_id: '',
    start_time: '07:00',
    end_time: '19:00'
  });

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const handlePrevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  const handleToday = () => setCurrentDate(new Date());

  const sectorMap = useMemo(() => {
    const m = {};
    sectors.forEach((s, idx) => { 
      m[String(s.id)] = { ...s, theme: SECTOR_THEMES[idx % SECTOR_THEMES.length] }; 
    });
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

  // Plantões do mês filtrados
  const monthlyShifts = useMemo(() => {
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const prefix = `${currentYear}-${monthStr}`;

    return shifts.filter(s => {
      if (!s.date || !s.date.startsWith(prefix)) return false;
      if (selectedSectorId !== 'todos' && String(s.sector_id) !== String(selectedSectorId)) return false;
      return true;
    });
  }, [shifts, currentYear, currentMonth, selectedSectorId]);

  const shiftsByDate = useMemo(() => {
    const map = {};
    monthlyShifts.forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [monthlyShifts]);

  // Controle de clique com a tecla Ctrl (Multi-seleção)
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

  // DRAG & DROP: Início do arraste pelo Roll
  const handleDragStart = (e, profId) => {
    setDraggingProfId(profId);
    e.dataTransfer.setData('text/plain', profId);
  };

  // DRAG & DROP: Soltar profissional sobre um dia do calendário
  const handleDropOnDay = async (e, dateStr) => {
    e.preventDefault();
    const profId = e.dataTransfer.getData('text/plain') || draggingProfId;
    if (!profId) return;

    const prof = professionalMap[profId];
    const targetSector = selectedSectorId !== 'todos' ? selectedSectorId : (sectors[0]?.id || '');

    if (!targetSector) {
      alert('Cadastre ou selecione um setor antes de alocar.');
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
        await autoHealingSaveShift(null, {
          company_id: company?.id || 'cmp_principal',
          unit_id: selectedUnitId || 'unit_h1',
          sector_id: targetSector,
          professional_id: profId,
          target_category: prof?.category || 'medico',
          date: d,
          shift_type: 'diurno',
          start_time: '07:00',
          end_time: '19:00',
          status: 'confirmado'
        });
      }
      setSelectedDays([]);
      await syncGlobalData();
    } catch (err) {
      alert('Erro ao alocar: ' + err.message);
    } finally {
      setDraggingProfId(null);
    }
  };

  // Salvar plantão em lote pelos dias selecionados via Ctrl
  const handleSaveBatch = async (e) => {
    e.preventDefault();
    if (!batchData.sector_id || !batchData.professional_id) {
      alert('Selecione o setor e o profissional.');
      return;
    }

    const prof = professionalMap[batchData.professional_id];
    setSubmitting(true);
    try {
      for (const d of selectedDays) {
        await autoHealingSaveShift(null, {
          company_id: company?.id || 'cmp_principal',
          unit_id: selectedUnitId || 'unit_h1',
          sector_id: batchData.sector_id,
          professional_id: batchData.professional_id,
          target_category: prof?.category || 'medico',
          date: d,
          start_time: batchData.start_time,
          end_time: batchData.end_time,
          status: 'confirmado'
        });
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

  // Salvar plantão individual
  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!formData.sector_id || !formData.date) {
      alert('Preencha a data e o setor.');
      return;
    }

    const isMural = formData.action_type === 'mural';
    if (!isMural && !formData.professional_id) {
      alert('Selecione o profissional ou marque a opção "Publicar no Mural".');
      return;
    }

    setSubmitting(true);
    try {
      const prof = formData.professional_id ? professionalMap[formData.professional_id] : null;

      const payload = {
        company_id: company?.id || 'cmp_principal',
        unit_id: selectedUnitId || 'unit_h1',
        sector_id: formData.sector_id,
        target_category: formData.target_category || prof?.category || 'medico',
        professional_id: isMural ? null : formData.professional_id,
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        status: isMural ? 'vago' : 'confirmado',
        notes: formData.notes
      };

      await autoHealingSaveShift(editingShiftId, payload);
      setModalOpen(false);
      await syncGlobalData();
      alert(isMural ? 'Vaga enviada para o Mural de Oportunidades!' : 'Plantão alocado com sucesso!');
    } catch (err) {
      alert('Erro ao salvar plantão: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Botão direto para desocupar e mandar vaga para o Mural
  const handleSendToMural = async (shift) => {
    const secName = sectorMap[shift.sector_id]?.name || 'Setor';
    if (!confirm(`Tirar o profissional deste plantão e transformar em VAGA ABERTA no Mural para o setor "${secName}"?`)) return;

    try {
      await autoHealingSaveShift(shift.id, {
        professional_id: null,
        status: 'vago'
      });
      await syncGlobalData();
      alert('Plantão enviado para o Mural de Oportunidades com sucesso!');
    } catch (err) {
      alert('Erro ao enviar para o mural: ' + err.message);
    }
  };

  const handleDeleteShift = async (shiftId) => {
    if (!confirm('Excluir este plantão permanentemente da escala?')) return;
    try {
      await base44.entities.Shift.delete(shiftId);
      await syncGlobalData();
    } catch (err) {
      alert('Erro ao excluir plantão: ' + err.message);
    }
  };

  // Status Badge com Bolinha e Texto
  const getStatusInfo = (shift) => {
    const today = new Date().toISOString().split('T')[0];
    const isVago = shift.status === 'vago' || !shift.professional_id;

    if (isVago) {
      return { dot: 'bg-rose-500 shadow-lg shadow-rose-500/50 animate-pulse', label: 'Vaga no Mural', text: 'text-rose-400 font-black' };
    }
    if (shift.date < today) {
      return { dot: 'bg-slate-500', label: 'Concluído', text: 'text-slate-400 font-bold' };
    }
    if (shift.date === today) {
      return { dot: 'bg-emerald-400 shadow-lg shadow-emerald-500/50 animate-ping', label: 'Ao Vivo Hoje', text: 'text-emerald-400 font-black' };
    }
    return { dot: 'bg-sky-400', label: 'Programado', text: 'text-sky-400 font-bold' };
  };

  const filteredTrayProfs = useMemo(() => {
    const term = traySearch.toLowerCase().trim();
    return professionals.filter(p => {
      if (p.status !== 'ativo') return false;
      if (!term) return true;
      return (p.name || '').toLowerCase().includes(term) || (p.specialty || '').toLowerCase().includes(term);
    });
  }, [professionals, traySearch]);

  return (
    <div className={`p-3 md:p-6 space-y-4 font-sans ${tvMode ? 'fixed inset-0 z-50 bg-slate-950 text-white overflow-y-auto p-6 md:p-8' : ''}`}>
      
      {/* 1. SELETOR EXECUTIVO DE SEÇÕES (COM NOME COMPLETO E DESTAQUE VISUAL) */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-3xl shadow-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-300">
              Seções & Setores Hospitalares
            </span>
          </div>
          <span className="text-[11px] font-bold text-slate-500">
            {sectors.length} seções cadastradas
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <button
            onClick={() => setSelectedSectorId('todos')}
            className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
              selectedSectorId === 'todos'
                ? 'bg-gradient-to-r from-sky-600 to-blue-600 border-sky-400 text-white shadow-lg shadow-sky-600/30 ring-2 ring-sky-400/50'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <span className="text-[10px] uppercase font-black opacity-75 block">Visão Integrada</span>
            <span className="text-xs font-black truncate block mt-0.5">Todas as Seções</span>
          </button>

          {sectors.map(sec => {
            const isSelected = selectedSectorId === String(sec.id);
            const theme = sectorMap[String(sec.id)]?.theme || SECTOR_THEMES[0];

            return (
              <button
                key={sec.id}
                onClick={() => setSelectedSectorId(String(sec.id))}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? 'bg-slate-800 border-sky-500 text-white shadow-lg ring-2 ring-sky-500/40'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold uppercase text-slate-500">
                    {sec.code || 'SETOR'}
                  </span>
                  {isSelected && <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>}
                </div>
                <span className="text-xs font-black text-slate-200 block truncate mt-0.5">
                  {sec.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. HEADER DE NAVEGAÇÃO & CONTROLES */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-950 rounded-2xl p-1 border border-slate-800">
            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-300">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={handleToday} className="px-3 py-1 text-xs font-black text-white">
              Hoje
            </button>
            <button onClick={handleNextMonth} className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-300">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-sky-400" />
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
            <span className="text-xs text-slate-400 font-semibold">
              {selectedSectorId === 'todos' ? 'Exibindo todas as seções' : `Filtrado por: ${sectorMap[selectedSectorId]?.name}`}
            </span>
          </div>
        </div>

        {/* BOTÕES DE CONTROLE */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setTvMode(!tvMode)}
            className="h-9 px-4 text-xs font-black rounded-2xl gap-2 border-slate-700 bg-slate-950 hover:bg-slate-800 text-amber-400 shadow-md"
          >
            <Tv className="w-4 h-4" />
            <span>{tvMode ? 'Sair da TV' : 'Modo TV CCO'}</span>
          </Button>

          {isManager && (
            <Button 
              onClick={() => {
                setEditingShiftId(null);
                setFormData({
                  date: new Date().toISOString().split('T')[0],
                  sector_id: selectedSectorId !== 'todos' ? selectedSectorId : (sectors[0]?.id || ''),
                  target_category: 'medico',
                  start_time: '07:00',
                  end_time: '19:00',
                  action_type: 'alocar',
                  professional_id: '',
                  notes: ''
                });
                setModalOpen(true);
              }} 
              className="h-9 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-black px-5 rounded-2xl shadow-lg shadow-sky-600/30 gap-1.5"
            >
              <Plus className="w-4 h-4" /> Lançar Plantão
            </Button>
          )}
        </div>
      </div>

      {/* 3. DOCA FLUTUANTE DE DIAS SELECIONADOS VIA CTRL */}
      {selectedDays.length > 0 && (
        <div className="p-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-3xl shadow-2xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 border border-white/20">
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

      {/* 4. CORPO DA ESCALA: ROLL DE PROFISSIONAIS (DRAG & DROP) + GRADE PREMIUM */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        
        {/* BANDEJA / ROLL LATERAL COM DRAG & DROP */}
        {!tvMode && isManager && (
          <aside className="w-full lg:w-72 bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-sky-400" />
                Roll de Profissionais
              </span>
              <span className="text-[10px] font-bold text-slate-400">Arraste p/ o dia</span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Buscar profissional..."
                value={traySearch}
                onChange={e => setTraySearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-slate-950 border-slate-800 text-white rounded-xl"
              />
            </div>

            <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
              {filteredTrayProfs.map(prof => (
                <div
                  key={prof.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, prof.id)}
                  className="p-3 rounded-2xl border border-slate-800 bg-slate-950 hover:border-sky-500/80 hover:bg-slate-850 transition-all cursor-grab active:cursor-grabbing select-none shadow-sm flex items-center gap-3 group"
                >
                  <GripVertical className="w-4 h-4 text-slate-600 group-hover:text-sky-400 shrink-0" />
                  
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-mono font-black text-xs text-sky-400 shrink-0">
                    {getInitials(prof.name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-black text-xs text-white truncate">
                      {formatFullName(prof.name)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-semibold truncate">
                      {prof.specialty || 'Clínica Geral'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* GRADE CALENDÁRIO COM CABEÇALHOS COLORIDOS E CARDS AMPLOS */}
        <div className="flex-1 w-full min-w-0 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          
          {/* CABEÇALHO DOS DIAS DA SEMANA */}
          <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950 text-center py-3">
            {WEEKDAYS.map(day => (
              <div key={day.short} className="text-xs font-black uppercase tracking-wider text-slate-400">
                <span className={day.weekend ? 'text-indigo-400 font-black' : ''}>{day.short}</span>
              </div>
            ))}
          </div>

          {/* CÉLULAS DOS DIAS */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-800">
            
            {Array.from({ length: daysInMonth[0].getDay() }).map((_, idx) => (
              <div key={`empty-${idx}`} className="min-h-[170px] bg-slate-950/40"></div>
            ))}

            {daysInMonth.map(dateObj => {
              const dateStr = dateObj.toISOString().split('T')[0];
              const todayStr = new Date().toISOString().split('T')[0];
              const isToday = todayStr === dateStr;
              const isSelected = selectedDays.includes(dateStr);
              const dayShifts = shiftsByDate[dateStr] || [];

              return (
                <div
                  key={dateStr}
                  onClick={(e) => handleDayClick(dateStr, e)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnDay(e, dateStr)}
                  className={`min-h-[180px] p-2 transition-all flex flex-col justify-between select-none ${
                    isSelected
                      ? 'bg-indigo-950/40 ring-2 ring-indigo-500 z-10'
                      : isToday
                      ? 'bg-sky-950/20'
                      : 'hover:bg-slate-850/50'
                  }`}
                >
                  {/* BARRA SUPERIOR DA DATA */}
                  <div className={`flex items-center justify-between pb-1.5 mb-1.5 border-b ${isToday ? 'border-sky-500/40' : 'border-slate-800'}`}>
                    <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                      isToday 
                        ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/40' 
                        : isSelected 
                        ? 'bg-indigo-600 text-white' 
                        : 'text-slate-400'
                    }`}>
                      {dateObj.getDate()}
                    </span>

                    {isManager && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingShiftId(null);
                          setFormData({
                            date: dateStr,
                            sector_id: selectedSectorId !== 'todos' ? selectedSectorId : (sectors[0]?.id || ''),
                            target_category: 'medico',
                            start_time: '07:00',
                            end_time: '19:00',
                            action_type: 'alocar',
                            professional_id: '',
                            notes: ''
                          });
                          setModalOpen(true);
                        }}
                        title="Adicionar plantão"
                        className="p-1 text-slate-500 hover:text-sky-400 hover:bg-slate-800 rounded-lg"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* LISTAGEM DE PLANTÕES DO DIA */}
                  <div className="space-y-2 flex-1 overflow-y-auto max-h-[190px] pr-0.5">
                    {dayShifts.map(shift => {
                      const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
                      const sector = sectorMap[String(shift.sector_id)];
                      const isVago = shift.status === 'vago' || !prof;
                      const status = getStatusInfo(shift);

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
                                target_category: shift.target_category || prof?.category || 'medico',
                                start_time: shift.start_time || '07:00',
                                end_time: shift.end_time || '19:00',
                                action_type: isVago ? 'mural' : 'alocar',
                                professional_id: shift.professional_id || '',
                                notes: shift.notes || ''
                              });
                              setModalOpen(true);
                            }
                          }}
                          className={`p-2.5 rounded-2xl border transition-all cursor-pointer shadow-md ${
                            isVago 
                              ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400' 
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {/* NOME COMPLETO DA SEÇÃO E HORÁRIO */}
                          <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 mb-1">
                            <span className="truncate max-w-[85px] text-sky-400">
                              {sector?.name || 'Setor'}
                            </span>
                            <span className="font-mono text-slate-400 font-bold">
                              {shift.start_time || '07:00'}-{shift.end_time || '19:00'}
                            </span>
                          </div>

                          {/* BOLINHA COM O STATUS LOGO ABAIXO */}
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${status.dot}`}></span>
                            <span className={`text-[10px] ${status.text}`}>
                              {status.label}
                            </span>
                          </div>

                          {/* PROFISSIONAL COM AVATAR + NOME E SOBRENOME */}
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-black text-[9px] shrink-0 ${
                              isVago ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-sky-400'
                            }`}>
                              {getInitials(prof?.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="font-black text-xs text-white block truncate leading-tight">
                                {isVago ? 'Vaga em Aberto' : formatFullName(prof?.name)}
                              </span>
                            </div>
                          </div>

                          {/* BOTÃO DISPONIBILIZAR NO MURAL (SE ESTIVER ALOCADO) */}
                          {!isVago && isManager && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendToMural(shift);
                              }}
                              className="mt-2 w-full py-1 text-[9px] font-black uppercase rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 transition-all flex items-center justify-center gap-1"
                            >
                              <Flame className="w-3 h-3 text-rose-500" /> Mandar p/ Mural
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MODAL LOTE COM DIAS DO CTRL */}
      <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Preenchimento em Lote ({selectedDays.length} Dias)
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveBatch} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-300">Profissional a Escalar *</Label>
              <Select value={batchData.professional_id} onValueChange={v => setBatchData({ ...batchData, professional_id: v })}>
                <SelectTrigger className="h-9 bg-slate-950 border-slate-800"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  {professionals.filter(p => p.status === 'ativo').map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-300">Seção / Setor *</Label>
              <Select value={batchData.sector_id} onValueChange={v => setBatchData({ ...batchData, sector_id: v })}>
                <SelectTrigger className="h-9 bg-slate-950 border-slate-800"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  {sectors.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Início</Label>
                <Input type="time" value={batchData.start_time} onChange={e => setBatchData({ ...batchData, start_time: e.target.value })} className="h-9 bg-slate-950 border-slate-800" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Término</Label>
                <Input type="time" value={batchData.end_time} onChange={e => setBatchData({ ...batchData, end_time: e.target.value })} className="h-9 bg-slate-950 border-slate-800" />
              </div>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button type="button" variant="outline" onClick={() => setBatchModalOpen(false)} className="h-9 text-xs border-slate-800">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="h-9 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-5 rounded-xl">
                Confirmar p/ {selectedDays.length} Dias
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL INDIVIDUAL DE PLANTÃO */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-sky-400" />
              {editingShiftId ? 'Editar Plantão da Escala' : 'Lançar Novo Plantão'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveShift} className="space-y-3.5 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Data *</Label>
                <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="h-9 bg-slate-950 border-slate-800" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Seção / Setor *</Label>
                <Select value={formData.sector_id} onValueChange={v => setFormData({ ...formData, sector_id: v })}>
                  <SelectTrigger className="h-9 bg-slate-950 border-slate-800"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    {sectors.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Hora Início</Label>
                <Input type="time" value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })} className="h-9 bg-slate-950 border-slate-800" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Hora Término</Label>
                <Input type="time" value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })} className="h-9 bg-slate-950 border-slate-800" />
              </div>
            </div>

            {/* ESCOLHA: ALOCAR OU MANDAR P/ MURAL */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2.5">
              <Label className="text-xs font-black uppercase text-slate-400">Destino do Plantão</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, action_type: 'alocar' })}
                  className={`p-2.5 rounded-xl border text-xs font-black text-center transition-all ${
                    formData.action_type === 'alocar'
                      ? 'bg-sky-600 text-white shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
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
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" /> Mandar p/ Mural
                </button>
              </div>

              {formData.action_type === 'alocar' ? (
                <div className="space-y-1 pt-1">
                  <Label className="text-xs font-bold text-slate-300">Profissional Escalado</Label>
                  <Select value={formData.professional_id} onValueChange={v => setFormData({ ...formData, professional_id: v })}>
                    <SelectTrigger className="h-9 bg-slate-900 border-slate-800"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      {professionals.filter(p => p.status === 'ativo').map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-[11px] text-rose-400 bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">
                  📢 O plantão será publicado no Mural para profissionais da mesma categoria se candidatarem.
                </p>
              )}
            </div>

            <DialogFooter className="pt-2 flex-col sm:flex-row gap-2">
              {editingShiftId && (
                <Button type="button" variant="ghost" onClick={() => handleDeleteShift(editingShiftId)} className="h-9 text-xs text-rose-400 hover:bg-rose-500/20 mr-auto">
                  <Trash2 className="w-4 h-4 mr-1" /> Excluir
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="h-9 text-xs border-slate-800">Cancelar</Button>
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