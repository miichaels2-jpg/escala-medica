import React, { useState, useMemo } from 'react';
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
  MousePointerClick, HeartPulse, UserPlus, Layers, SlidersHorizontal, Flame
} from 'lucide-react';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

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
  const [selectedSectorId, setSelectedSectorId] = useState('todos'); // 'todos' ou ID da seção/setor
  const [filterTurno, setFilterTurno] = useState('todos');
  const [tvMode, setTvMode] = useState(false);
  const [scalePublished, setScalePublished] = useState(true);

  // Seleção múltipla com a tecla Ctrl
  const [selectedDays, setSelectedDays] = useState([]);

  // Roll de profissionais
  const [traySearch, setTraySearch] = useState('');
  const [draggingProfId, setDraggingProfId] = useState(null);

  // Modais
  const [modalOpen, setModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [configScaleModalOpen, setConfigScaleModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Formulário do Plantão
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    sector_id: '',
    professional_id: '',
    shift_type: 'diurno',
    start_time: '07:00',
    end_time: '19:00',
    status: 'confirmado',
    notes: ''
  });

  // Formulário de Preenchimento em Lote (Ctrl)
  const [batchData, setBatchData] = useState({
    professional_id: '',
    sector_id: '',
    shift_type: 'diurno'
  });

  // Formulário do Gerador/Configurador de Escala por Setor
  const [scaleConfig, setScaleConfig] = useState({
    sector_id: '',
    day_vacancies: 2,
    night_vacancies: 2,
    create_mode: 'vagas' // 'vagas' para mural ou 'preencher'
  });

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

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

  const monthlyShifts = useMemo(() => {
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const prefix = `${currentYear}-${monthStr}`;

    return shifts.filter(s => {
      if (!s.date || !s.date.startsWith(prefix)) return false;
      if (selectedSectorId !== 'todos' && String(s.sector_id) !== String(selectedSectorId)) return false;
      if (filterTurno !== 'todos' && s.shift_type !== filterTurno) return false;
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

  // Ciclos de vida do plantão calculados no horário local
  const shiftMetrics = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentHour = now.getHours();

    let emAndamento = 0;
    let concluidos = 0;
    let programados = 0;
    let vagos = 0;

    monthlyShifts.forEach(s => {
      const isVago = s.status === 'vago' || !s.professional_id;
      if (isVago) {
        vagos++;
        return;
      }

      if (s.date < todayStr) {
        concluidos++;
      } else if (s.date === todayStr) {
        const isDiurno = s.shift_type === 'diurno';
        const isDayTime = currentHour >= 7 && currentHour < 19;
        
        if ((isDiurno && isDayTime) || (!isDiurno && !isDayTime)) {
          emAndamento++;
        } else if (isDiurno && currentHour >= 19) {
          concluidos++;
        } else {
          programados++;
        }
      } else {
        programados++;
      }
    });

    const total = monthlyShifts.length;
    const taxaCobertura = total > 0 ? Math.round(((total - vagos) / total) * 100) : 100;

    return { total, emAndamento, concluidos, programados, vagos, taxaCobertura };
  }, [monthlyShifts]);

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
    // Garante que o plantão seja lançado na seção/setor correto
    const targetSector = selectedSectorId !== 'todos' ? selectedSectorId : (sectors[0]?.id || 'sec_1');

    const targetDates = selectedDays.includes(dateStr) && selectedDays.length > 1 
      ? selectedDays 
      : [dateStr];

    const sectorName = sectorMap[targetSector]?.name || 'Setor Padrão';
    if (!confirm(`Alocar ${prof?.name} no setor "${sectorName}" para ${targetDates.length} dia(s)?`)) return;

    try {
      for (const d of targetDates) {
        await autoHealingSaveShift(null, {
          company_id: company?.id || 'cmp_principal',
          unit_id: selectedUnitId || 'unit_h1',
          sector_id: targetSector,
          professional_id: profId,
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
      alert('Erro ao alocar plantão: ' + err.message);
    } finally {
      setDraggingProfId(null);
    }
  };

  // GERADOR & CONFIGURADOR DE ESCALA EM MASSA POR SETOR (EXCLUSIVO GESTOR/COORDENADOR)
  const handleGenerateSectorScale = async (e) => {
    e.preventDefault();
    if (!scaleConfig.sector_id) {
      alert('Selecione a seção/setor que deseja configurar.');
      return;
    }

    const secName = sectorMap[scaleConfig.sector_id]?.name || 'Setor Selecionado';
    const totalShiftsToCreate = daysInMonth.length * (parseInt(scaleConfig.day_vacancies) + parseInt(scaleConfig.night_vacancies));

    if (!confirm(`Gerar ${totalShiftsToCreate} plantões para o mês de ${MONTH_NAMES[currentMonth]} no setor "${secName}"?`)) {
      return;
    }

    setSubmitting(true);
    try {
      for (const dateObj of daysInMonth) {
        const d = dateObj.toISOString().split('T')[0];
        
        // Vagas Diurnas
        for (let i = 0; i < parseInt(scaleConfig.day_vacancies); i++) {
          await autoHealingSaveShift(null, {
            company_id: company?.id || 'cmp_principal',
            unit_id: selectedUnitId || 'unit_h1',
            sector_id: scaleConfig.sector_id,
            professional_id: null,
            date: d,
            shift_type: 'diurno',
            start_time: '07:00',
            end_time: '19:00',
            status: 'vago'
          });
        }

        // Vagas Noturnas
        for (let i = 0; i < parseInt(scaleConfig.night_vacancies); i++) {
          await autoHealingSaveShift(null, {
            company_id: company?.id || 'cmp_principal',
            unit_id: selectedUnitId || 'unit_h1',
            sector_id: scaleConfig.sector_id,
            professional_id: null,
            date: d,
            shift_type: 'noturno',
            start_time: '19:00',
            end_time: '07:00',
            status: 'vago'
          });
        }
      }

      setConfigScaleModalOpen(false);
      await syncGlobalData();
      alert(`Escala do setor ${secName} gerada com sucesso! As vagas já constam no calendário e no Mural.`);
    } catch (err) {
      alert('Erro ao gerar escala: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveBatch = async (e) => {
    e.preventDefault();
    if (!batchData.sector_id || !batchData.professional_id) {
      alert('Selecione o profissional e o setor.');
      return;
    }

    setSubmitting(true);
    try {
      for (const d of selectedDays) {
        await autoHealingSaveShift(null, {
          company_id: company?.id || 'cmp_principal',
          unit_id: selectedUnitId || 'unit_h1',
          sector_id: batchData.sector_id,
          professional_id: batchData.professional_id,
          date: d,
          shift_type: batchData.shift_type,
          start_time: batchData.shift_type === 'diurno' ? '07:00' : '19:00',
          end_time: batchData.shift_type === 'diurno' ? '19:00' : '07:00',
          status: 'confirmado'
        });
      }
      setBatchModalOpen(false);
      setSelectedDays([]);
      await syncGlobalData();
      alert(`${selectedDays.length} plantões lançados com sucesso!`);
    } catch (err) {
      alert('Erro no preenchimento em lote: ' + err.message);
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

    setSubmitting(true);
    try {
      const payload = {
        company_id: company?.id || 'cmp_principal',
        unit_id: selectedUnitId || 'unit_h1',
        sector_id: formData.sector_id,
        professional_id: formData.status === 'vago' ? null : (formData.professional_id || null),
        date: formData.date,
        shift_type: formData.shift_type,
        start_time: formData.start_time,
        end_time: formData.end_time,
        status: formData.status,
        notes: formData.notes
      };

      const saved = await autoHealingSaveShift(editingShiftId, payload);
      
      // Sincroniza ID do mural caso esteja marcado como vago
      if (formData.status === 'vago' && saved?.id) {
        try {
          const muralArr = JSON.parse(window.localStorage.getItem('scale_mural_ids') || '[]');
          if (!muralArr.includes(saved.id)) {
            muralArr.push(saved.id);
            window.localStorage.setItem('scale_mural_ids', JSON.stringify(muralArr));
          }
        } catch {}
      }

      setModalOpen(false);
      await syncGlobalData();
    } catch (err) {
      alert('Erro ao salvar plantão: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendToMural = async (shift) => {
    if (!confirm('Disponibilizar este plantão no Mural de Vagas para a equipe se candidatar?')) return;
    try {
      await autoHealingSaveShift(shift.id, {
        professional_id: null,
        status: 'vago'
      });

      try {
        const muralArr = JSON.parse(window.localStorage.getItem('scale_mural_ids') || '[]');
        if (!muralArr.includes(shift.id)) {
          muralArr.push(shift.id);
          window.localStorage.setItem('scale_mural_ids', JSON.stringify(muralArr));
        }
      } catch {}

      await syncGlobalData();
      alert('Plantão enviado para o Mural com sucesso!');
    } catch (err) {
      alert('Erro ao enviar para o mural: ' + err.message);
    }
  };

  const handleDeleteShift = async (shiftId) => {
    if (!confirm('Deseja excluir permanentemente este plantão da escala?')) return;
    try {
      await base44.entities.Shift.delete(shiftId);
      await syncGlobalData();
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  const filteredTrayProfessionals = useMemo(() => {
    const term = traySearch.toLowerCase().trim();
    return professionals.filter(p => {
      if (p.status !== 'ativo') return false;
      if (!term) return true;
      return (p.name || '').toLowerCase().includes(term) || (p.specialty || '').toLowerCase().includes(term);
    });
  }, [professionals, traySearch]);

  // Determina a bolinha e o status limpo de cada plantão
  const getShiftBadge = (shift) => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentHour = now.getHours();

    const isVago = shift.status === 'vago' || !shift.professional_id;

    if (isVago) {
      return {
        dotClass: 'bg-rose-500 animate-pulse',
        label: 'Vaga no Mural',
        textClass: 'text-rose-600 dark:text-rose-400 font-black'
      };
    }

    if (shift.date < todayStr) {
      return {
        dotClass: 'bg-slate-400',
        label: 'Concluído',
        textClass: 'text-slate-500 dark:text-slate-400 font-bold'
      };
    }

    if (shift.date === todayStr) {
      const isDiurno = shift.shift_type === 'diurno';
      const isDayTime = currentHour >= 7 && currentHour < 19;
      if ((isDiurno && isDayTime) || (!isDiurno && !isDayTime)) {
        return {
          dotClass: 'bg-emerald-500 animate-ping',
          label: 'Em Andamento',
          textClass: 'text-emerald-600 dark:text-emerald-400 font-black'
        };
      }
      if (isDiurno && currentHour >= 19) {
        return {
          dotClass: 'bg-slate-400',
          label: 'Concluído',
          textClass: 'text-slate-500 font-bold'
        };
      }
    }

    return {
      dotClass: 'bg-sky-500',
      label: 'Programado',
      textClass: 'text-sky-600 dark:text-sky-400 font-bold'
    };
  };

  return (
    <div className={`p-3 md:p-6 space-y-4 font-sans ${tvMode ? 'fixed inset-0 z-50 bg-slate-950 text-white overflow-y-auto p-6' : ''}`}>
      
      {/* 1. SELETOR DE SEÇÕES / SETORES (EM DESTAQUE PARA NÃO CRIAR NO LUGAR ERRADO) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-sm flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pl-1">
            <Building2 className="w-4 h-4 text-sky-600" /> Seção / Setor:
          </span>

          <button
            onClick={() => setSelectedSectorId('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
              selectedSectorId === 'todos'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            Todos os Setores
          </button>

          {sectors.map(sec => (
            <button
              key={sec.id}
              onClick={() => setSelectedSectorId(String(sec.id))}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 ${
                selectedSectorId === String(sec.id)
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {sec.code && <span className="text-[10px] font-mono opacity-80 uppercase">[{sec.code}]</span>}
              <span>{sec.name}</span>
            </button>
          ))}
        </div>

        {isManager && (
          <Button
            size="sm"
            onClick={() => {
              setScaleConfig({
                sector_id: selectedSectorId !== 'todos' ? selectedSectorId : (sectors[0]?.id || ''),
                day_vacancies: 2,
                night_vacancies: 2,
                create_mode: 'vagas'
              });
              setConfigScaleModalOpen(true);
            }}
            className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-3 rounded-xl shrink-0 gap-1.5 shadow-sm"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Configurar Escala do Mês
          </Button>
        )}
      </div>

      {/* 2. PAINEL DE CONTROLE EXECUTIVO COM CICLOS DE VIDA */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={handleToday} className="px-3 py-1 text-xs font-black">
                Hoje
              </button>
              <button onClick={handleNextMonth} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-sky-600" />
                {MONTH_NAMES[currentMonth]} {currentYear}
              </h2>
              <div className="flex items-center gap-2 text-xs font-bold mt-0.5">
                <span className={scalePublished ? 'text-emerald-600 dark:text-emerald-400 flex items-center gap-1' : 'text-amber-500 flex items-center gap-1'}>
                  <CheckCheck className="w-3.5 h-3.5" />
                  {scalePublished ? 'Escala Publicada & Oficial' : 'Modo Rascunho / Em Montagem'}
                </span>
                {selectedSectorId !== 'todos' && (
                  <span className="text-slate-400 font-normal">
                    • Setor ativo: <b className="text-sky-600">{sectorMap[selectedSectorId]?.name}</b>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isManager && (
              <Button
                variant={scalePublished ? 'outline' : 'default'}
                onClick={() => setScalePublished(!scalePublished)}
                className={`h-9 text-xs font-bold rounded-xl gap-1.5 ${
                  scalePublished ? 'border-emerald-500 text-emerald-600' : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                {scalePublished ? 'Publicada' : 'Publicar Escala'}
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => setTvMode(!tvMode)}
              className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5 border-slate-300 dark:border-slate-700"
            >
              <Tv className="w-4 h-4 text-sky-500" />
              <span>{tvMode ? 'Sair da TV' : 'Modo TV CCO'}</span>
            </Button>

            {isManager && (
              <Button 
                onClick={() => {
                  setEditingShiftId(null);
                  setFormData({
                    date: new Date().toISOString().split('T')[0],
                    sector_id: selectedSectorId !== 'todos' ? selectedSectorId : (sectors[0]?.id || ''),
                    professional_id: '',
                    shift_type: 'diurno',
                    start_time: '07:00',
                    end_time: '19:00',
                    status: 'confirmado',
                    notes: ''
                  });
                  setModalOpen(true);
                }} 
                className="h-9 bg-sky-600 hover:bg-sky-500 text-white text-xs font-black px-4 rounded-xl shadow-md gap-1"
              >
                <Plus className="w-4 h-4" /> Novo Plantão
              </Button>
            )}
          </div>
        </div>

        {/* MÉTRICAS COM BOLINHAS INDICATIVAS */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Em Andamento
            </span>
            <span className="text-xl font-black text-slate-900 dark:text-white block mt-1">
              {shiftMetrics.emAndamento} <span className="text-xs font-semibold text-slate-400">ao vivo</span>
            </span>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
              Programados
            </span>
            <span className="text-xl font-black text-slate-900 dark:text-white block mt-1">
              {shiftMetrics.programados}
            </span>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
              Concluídos
            </span>
            <span className="text-xl font-black text-slate-900 dark:text-white block mt-1">
              {shiftMetrics.concluidos}
            </span>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              Vagas no Mural
            </span>
            <span className={`text-xl font-black block mt-1 ${shiftMetrics.vagos > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
              {shiftMetrics.vagos} abertos
            </span>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-900 text-white dark:bg-slate-800 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">Cobertura Total</span>
            <span className="text-xl font-black text-sky-400 block mt-1">{shiftMetrics.taxaCobertura}%</span>
          </div>
        </div>
      </div>

      {/* 3. BARRA FLUTUANTE DE DIAS SELECIONADOS (CTRL) */}
      {selectedDays.length > 0 && (
        <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl flex items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-black">
            <MousePointerClick className="w-4 h-4" />
            <span>{selectedDays.length} dias selecionados com Ctrl no setor atual</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setBatchData({
                  professional_id: professionals[0]?.id || '',
                  sector_id: selectedSectorId !== 'todos' ? selectedSectorId : (sectors[0]?.id || ''),
                  shift_type: 'diurno'
                });
                setBatchModalOpen(true);
              }}
              className="h-8 bg-white text-indigo-900 hover:bg-slate-100 text-xs font-black"
            >
              <UserPlus className="w-3.5 h-3.5 mr-1" /> Preencher Dias
            </Button>
            <button onClick={() => setSelectedDays([])} className="p-1 hover:bg-indigo-700 rounded-lg text-xs">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 4. ROLL LATERAL + GRADE COM CARDS LIMPOS & BOLINHAS DE STATUS */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        
        {/* ROLL DE PROFISSIONAIS */}
        {!tvMode && isManager && (
          <aside className="w-full lg:w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-sky-600" />
                Roll Profissionais
              </span>
              <span className="text-[10px] font-bold text-slate-400">Arraste p/ o dia</span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Filtrar por nome..."
                value={traySearch}
                onChange={e => setTraySearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div className="space-y-1.5 max-h-[580px] overflow-y-auto pr-1">
              {filteredTrayProfessionals.map(prof => (
                <div
                  key={prof.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, prof.id)}
                  className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 hover:bg-white dark:hover:bg-slate-900 hover:border-sky-400 transition-all cursor-grab active:cursor-grabbing select-none shadow-sm"
                >
                  <div className="font-black text-xs text-slate-900 dark:text-white truncate">
                    {formatFullName(prof.name)}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 font-semibold">
                    <span className="truncate max-w-[120px]">{prof.specialty || 'Geral'}</span>
                    <span className="font-mono text-slate-400">{prof.document || 'CRM'}</span>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* GRADE AMPLIADA DO CALENDÁRIO */}
        <div className="flex-1 w-full min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-center py-3">
            {WEEKDAYS.map(day => (
              <div key={day} className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800/80">
            {Array.from({ length: daysInMonth[0].getDay() }).map((_, idx) => (
              <div key={`empty-${idx}`} className="min-h-[160px] bg-slate-50/40 dark:bg-slate-950/30"></div>
            ))}

            {daysInMonth.map(dateObj => {
              const dateStr = dateObj.toISOString().split('T')[0];
              const isToday = new Date().toISOString().split('T')[0] === dateStr;
              const isSelected = selectedDays.includes(dateStr);
              const dayShifts = shiftsByDate[dateStr] || [];

              return (
                <div
                  key={dateStr}
                  onClick={(e) => handleDayClick(dateStr, e)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnDay(e, dateStr)}
                  className={`min-h-[170px] p-2 transition-all flex flex-col justify-between select-none ${
                    isSelected 
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/40 ring-2 ring-indigo-500 z-10' 
                      : isToday 
                      ? 'bg-sky-50/30 dark:bg-sky-950/20' 
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                      isToday 
                        ? 'bg-sky-600 text-white shadow-sm' 
                        : isSelected 
                        ? 'bg-indigo-600 text-white' 
                        : 'text-slate-800 dark:text-slate-200'
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
                            professional_id: '',
                            shift_type: 'diurno',
                            start_time: '07:00',
                            end_time: '19:00',
                            status: 'confirmado',
                            notes: ''
                          });
                          setModalOpen(true);
                        }}
                        title="Adicionar plantão"
                        className="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-md"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* CARDS COM BOLINHA DE STATUS E NOME LEGÍVEL */}
                  <div className="space-y-2 flex-1 overflow-y-auto max-h-[180px] pr-0.5">
                    {dayShifts.map(shift => {
                      const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
                      const sector = sectorMap[String(shift.sector_id)];
                      const isVago = shift.status === 'vago' || !prof;
                      const isDiurno = shift.shift_type === 'diurno';
                      const badge = getShiftBadge(shift);

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
                                professional_id: shift.professional_id || '',
                                shift_type: shift.shift_type || 'diurno',
                                start_time: shift.start_time || '07:00',
                                end_time: shift.end_time || '19:00',
                                status: shift.status || 'confirmado',
                                notes: shift.notes || ''
                              });
                              setModalOpen(true);
                            }
                          }}
                          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer"
                        >
                          {/* SEÇÃO/SETOR E TURNO */}
                          <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase mb-1">
                            <span className="truncate max-w-[85px]">
                              {sector?.code ? `[${sector.code}] ` : ''}{sector?.name || 'Setor'}
                            </span>
                            <span className="font-mono text-slate-500">
                              {isDiurno ? '07-19h' : '19-07h'}
                            </span>
                          </div>

                          {/* BOLINHA COM O STATUS LOGO ABAIXO */}
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${badge.dotClass}`}></span>
                            <span className={`text-[10px] ${badge.textClass}`}>
                              {badge.label}
                            </span>
                          </div>

                          {/* NOME E SOBRENOME EM DESTAQUE */}
                          <div className="font-black text-xs text-slate-900 dark:text-white truncate">
                            {isVago ? '⚠️ Plantão Descoberto' : formatFullName(prof?.name)}
                          </div>
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

      {/* MODAL DO GESTOR: CONFIGURAR E GERAR ESCALA DO MÊS POR SETOR */}
      <Dialog open={configScaleModalOpen} onOpenChange={setConfigScaleModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
              Configurar Escala do Setor ({MONTH_NAMES[currentMonth]})
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleGenerateSectorScale} className="space-y-4 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Seção / Setor Alvo *</Label>
              <Select value={scaleConfig.sector_id} onValueChange={v => setScaleConfig({ ...scaleConfig, sector_id: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o setor..." /></SelectTrigger>
                <SelectContent>
                  {sectors.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.code ? `[${s.code}] ` : ''}{s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[10px] text-slate-400">
                Garante que os plantões do mês sejam gerados na seção correta.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Vagas Diurnas / Dia</Label>
                <Input 
                  type="number" 
                  min="0" 
                  max="10"
                  value={scaleConfig.day_vacancies} 
                  onChange={e => setScaleConfig({ ...scaleConfig, day_vacancies: e.target.value })} 
                  className="h-9" 
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Vagas Noturnas / Dia</Label>
                <Input 
                  type="number" 
                  min="0" 
                  max="10"
                  value={scaleConfig.night_vacancies} 
                  onChange={e => setScaleConfig({ ...scaleConfig, night_vacancies: e.target.value })} 
                  className="h-9" 
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl">
              💡 As vagas geradas serão abertas no Mural para que os profissionais possam se candidatar e você possa alocar arrastando do roll.
            </p>

            <DialogFooter className="pt-3 gap-2">
              <Button type="button" variant="outline" onClick={() => setConfigScaleModalOpen(false)} className="h-9 text-xs">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-5">
                {submitting ? 'Gerando...' : 'Gerar Vagas do Mês'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL LOTE (CTRL) */}
      <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              Preenchimento em Lote ({selectedDays.length} Dias)
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveBatch} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Profissional a Escalar *</Label>
              <Select value={batchData.professional_id} onValueChange={v => setBatchData({ ...batchData, professional_id: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o profissional..." /></SelectTrigger>
                <SelectContent>
                  {professionals.filter(p => p.status === 'ativo').map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Seção / Setor *</Label>
              <Select value={batchData.sector_id} onValueChange={v => setBatchData({ ...batchData, sector_id: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o setor..." /></SelectTrigger>
                <SelectContent>
                  {sectors.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Turno *</Label>
              <Select value={batchData.shift_type} onValueChange={v => setBatchData({ ...batchData, shift_type: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diurno">Diurno (07:00 às 19:00)</SelectItem>
                  <SelectItem value="noturno">Noturno (19:00 às 07:00)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button type="button" variant="outline" onClick={() => setBatchModalOpen(false)} className="h-9 text-xs">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-5">
                Confirmar p/ {selectedDays.length} Dias
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL INDIVIDUAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-sky-600" />
              {editingShiftId ? 'Editar Plantão' : 'Lançar Plantão'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveShift} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Data *</Label>
                <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="h-9" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Turno *</Label>
                <Select value={formData.shift_type} onValueChange={v => setFormData({ 
                  ...formData, 
                  shift_type: v,
                  start_time: v === 'diurno' ? '07:00' : '19:00',
                  end_time: v === 'diurno' ? '19:00' : '07:00'
                })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diurno">Diurno (07h às 19h)</SelectItem>
                    <SelectItem value="noturno">Noturno (19h às 07h)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Seção / Setor *</Label>
              <Select value={formData.sector_id} onValueChange={v => setFormData({ ...formData, sector_id: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o setor..." /></SelectTrigger>
                <SelectContent>
                  {sectors.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Status do Plantão</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ 
                ...formData, 
                status: v, 
                professional_id: v === 'vago' ? '' : formData.professional_id 
              })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmado">Confirmado (Com Profissional)</SelectItem>
                  <SelectItem value="vago">Vaga Aberta (Disponível no Mural)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.status !== 'vago' && (
              <div className="space-y-1">
                <Label className="text-xs font-bold">Profissional</Label>
                <Select value={formData.professional_id} onValueChange={v => setFormData({ ...formData, professional_id: v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o profissional..." /></SelectTrigger>
                  <SelectContent>
                    {professionals.filter(p => p.status === 'ativo').map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter className="pt-3 flex-col sm:flex-row gap-2">
              {editingShiftId && (
                <div className="flex items-center gap-2 mr-auto">
                  <Button type="button" variant="outline" onClick={() => handleSendToMural({ id: editingShiftId })} className="h-9 text-xs text-rose-600 border-rose-300">
                    Mandar p/ Mural
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => handleDeleteShift(editingShiftId)} className="h-9 text-xs text-slate-400 hover:text-rose-500 px-2">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="h-9 text-xs">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="h-9 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs px-5">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}