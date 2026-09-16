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
  Flame, Radio, ArrowRight, ShieldAlert, MonitorPlay, Eye
} from 'lucide-react';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const CATEGORIES = [
  { id: 'medico', label: 'Médico(a)', color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' },
  { id: 'enfermeiro', label: 'Enfermeiro(a)', color: 'text-teal-500 bg-teal-500/10 border-teal-500/30' },
  { id: 'tecnico_enfermagem', label: 'Téc. Enfermagem', color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30' },
  { id: 'fisioterapeuta', label: 'Fisioterapeuta', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
  { id: 'farmaceutico', label: 'Farmacêutico(a)', color: 'text-rose-500 bg-rose-500/10 border-rose-500/30' },
  { id: 'outro', label: 'Outro Profissional', color: 'text-slate-500 bg-slate-500/10 border-slate-500/30' }
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
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('todas');
  const [tvMode, setTvMode] = useState(false);
  const [scalePublished, setScalePublished] = useState(true);

  // Relógio vivo
  const [liveNow, setLiveNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setLiveNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Modais
  const [modalOpen, setModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Formulário do Plantão com Horários Flexíveis e Categoria Alvo
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    sector_id: '',
    target_category: 'medico',
    target_specialty: '',
    shift_preset: '12h_diurno',
    start_time: '07:00',
    end_time: '19:00',
    action_type: 'alocar', // 'alocar' | 'mural'
    professional_id: '',
    notes: ''
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

  // Cálculos do Mês
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
      
      if (selectedCategoryFilter !== 'todas') {
        const prof = s.professional_id ? professionalMap[String(s.professional_id)] : null;
        const cat = s.target_category || prof?.category || 'medico';
        if (cat !== selectedCategoryFilter) return false;
      }
      return true;
    });
  }, [shifts, currentYear, currentMonth, selectedSectorId, selectedCategoryFilter, professionalMap]);

  const shiftsByDate = useMemo(() => {
    const map = {};
    monthlyShifts.forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [monthlyShifts]);

  // Lógica da Escala do Dia (Ao Vivo, Próxima Rendição, Concluídos nos últimos 60 min)
  const todayStr = `${liveNow.getFullYear()}-${String(liveNow.getMonth() + 1).padStart(2, '0')}-${String(liveNow.getDate()).padStart(2, '0')}`;
  
  const todayShiftsDetailed = useMemo(() => {
    const nowHour = liveNow.getHours();
    const nowMin = liveNow.getMinutes();
    const nowTotalMin = nowHour * 60 + nowMin;

    const todayRaw = shifts.filter(s => {
      if (s.date !== todayStr) return false;
      if (selectedSectorId !== 'todos' && String(s.sector_id) !== String(selectedSectorId)) return false;
      return true;
    });

    const emAndamento = [];
    const proximoRendimento = [];
    const concluidosRecentes = [];
    const concluidosAntigos = [];
    const vagasAbertasHoje = [];

    todayRaw.forEach(shift => {
      const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
      const isVago = shift.status === 'vago' || !prof;

      const [startH, startM] = (shift.start_time || '07:00').split(':').map(Number);
      const [endH, endM] = (shift.end_time || '19:00').split(':').map(Number);
      
      const startTotalMin = startH * 60 + startM;
      let endTotalMin = endH * 60 + endM;
      if (endTotalMin <= startTotalMin) endTotalMin += 24 * 60; // plantão noturno que vira a noite

      let effectiveNowMin = nowTotalMin;
      if (endTotalMin > 24 * 60 && nowTotalMin < startTotalMin) {
        effectiveNowMin += 24 * 60;
      }

      if (isVago) {
        vagasAbertasHoje.push(shift);
        return;
      }

      // 1. Está correndo agora
      if (effectiveNowMin >= startTotalMin && effectiveNowMin < endTotalMin) {
        emAndamento.push(shift);
        // Se faltam menos de 120 minutos para acabar, também alerta rendição
        if ((endTotalMin - effectiveNowMin) <= 120) {
          proximoRendimento.push({ shift, minutesLeft: endTotalMin - effectiveNowMin });
        }
      }
      // 2. Terminou há menos de 60 minutos (Regra de retenção de 60 min na tela)
      else if (effectiveNowMin >= endTotalMin && (effectiveNowMin - endTotalMin) <= 60) {
        concluidosRecentes.push({ shift, minutesAgo: effectiveNowMin - endTotalMin });
      }
      // 3. Concluído anteriormente
      else if (effectiveNowMin >= endTotalMin) {
        concluidosAntigos.push(shift);
      }
      // 4. Próximo a iniciar (nas próximas 2 horas)
      else if (startTotalMin > effectiveNowMin && (startTotalMin - effectiveNowMin) <= 120) {
        proximoRendimento.push({ shift, startsIn: startTotalMin - effectiveNowMin });
      }
    });

    return { emAndamento, proximoRendimento, concluidosRecentes, concluidosAntigos, vagasAbertasHoje, totalHoje: todayRaw.length };
  }, [shifts, todayStr, selectedSectorId, liveNow, professionalMap]);

  // Aplicar preset de horário no formulário
  const handlePresetChange = (preset) => {
    let start = '07:00';
    let end = '19:00';
    if (preset === '12h_noturno') { start = '19:00'; end = '07:00'; }
    if (preset === '24h') { start = '07:00'; end = '07:00'; }
    if (preset === '6h_manha') { start = '07:00'; end = '13:00'; }
    if (preset === '6h_tarde') { start = '13:00'; end = '19:00'; }

    setFormData(prev => ({
      ...prev,
      shift_preset: preset,
      start_time: start,
      end_time: end
    }));
  };

  // Salvar plantão com workflow claro (alocar ou enviar p/ mural)
  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!formData.sector_id || !formData.date) {
      alert('Preencha a data e o setor do plantão.');
      return;
    }

    if (formData.action_type === 'alocar' && !formData.professional_id) {
      alert('Selecione o profissional a ser alocado ou marque a opção "Publicar vaga no Mural".');
      return;
    }

    setSubmitting(true);
    try {
      const isMural = formData.action_type === 'mural';
      const payload = {
        company_id: company?.id || 'cmp_principal',
        unit_id: selectedUnitId || 'unit_h1',
        sector_id: formData.sector_id,
        target_category: formData.target_category,
        target_specialty: formData.target_specialty,
        professional_id: isMural ? null : formData.professional_id,
        date: formData.date,
        shift_type: formData.start_time >= '19:00' || formData.start_time < '07:00' ? 'noturno' : 'diurno',
        start_time: formData.start_time,
        end_time: formData.end_time,
        status: isMural ? 'vago' : 'confirmado',
        notes: formData.notes
      };

      const saved = await autoHealingSaveShift(editingShiftId, payload);

      if (isMural && saved?.id) {
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
      alert(isMural ? 'Plantão publicado com sucesso no Mural de Oportunidades!' : 'Plantão alocado com sucesso!');
    } catch (err) {
      alert('Erro ao salvar plantão: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteShift = async (shiftId) => {
    if (!confirm('Excluir este plantão da escala?')) return;
    try {
      await base44.entities.Shift.delete(shiftId);
      await syncGlobalData();
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  // Status Badge Helper
  const getShiftBadge = (shift) => {
    const isVago = shift.status === 'vago' || !shift.professional_id;
    if (isVago) {
      return { dot: 'bg-rose-500 animate-pulse', label: 'Vaga no Mural', text: 'text-rose-600 dark:text-rose-400 font-black' };
    }
    if (shift.date < todayStr) {
      return { dot: 'bg-slate-400', label: 'Concluído', text: 'text-slate-500 font-bold' };
    }
    if (shift.date === todayStr) {
      return { dot: 'bg-emerald-500 animate-ping', label: 'Plantão de Hoje', text: 'text-emerald-600 dark:text-emerald-400 font-black' };
    }
    return { dot: 'bg-sky-500', label: 'Programado', text: 'text-sky-600 dark:text-sky-400 font-bold' };
  };

  return (
    <div className={`p-3 md:p-6 space-y-4 font-sans ${tvMode ? 'fixed inset-0 z-50 bg-slate-950 text-white overflow-y-auto p-6 md:p-8' : ''}`}>
      
      {/* 1. HEADER EXECUTIVO & MODO TV CCO */}
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
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-sky-600" />
                  {MONTH_NAMES[currentMonth]} {currentYear}
                </h2>
                {tvMode && (
                  <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1">
                    <Radio className="w-3 h-3" /> CCO Ao Vivo
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {liveNow.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} • <span className="font-mono font-bold text-sky-500">{liveNow.toLocaleTimeString('pt-BR')}</span>
              </p>
            </div>
          </div>

          {/* ALTERNADOR DE VISÃO: GRADE MENSAL VS ESCALA DO DIA VS TV */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => { setActiveView('mes'); setTvMode(false); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  activeView === 'mes' && !tvMode
                    ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Visão Mensal
              </button>
              <button
                onClick={() => { setActiveView('dia'); setTvMode(false); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  activeView === 'dia' && !tvMode
                    ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> Escala do Dia
              </button>
            </div>

            {/* BOTÃO MODO TV CCO */}
            <Button
              variant="default"
              onClick={() => {
                setTvMode(!tvMode);
                setActiveView('dia');
              }}
              className={`h-9 px-4 text-xs font-black rounded-xl gap-2 shadow-md ${
                tvMode ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-sky-600'
              }`}
            >
              {tvMode ? <Minimize2 className="w-4 h-4" /> : <MonitorPlay className="w-4 h-4 text-amber-400" />}
              <span>{tvMode ? 'Sair do Modo TV' : 'Painel TV CCO'}</span>
            </Button>

            {isManager && (
              <Button 
                onClick={() => {
                  setEditingShiftId(null);
                  setFormData({
                    date: new Date().toISOString().split('T')[0],
                    sector_id: selectedSectorId !== 'todos' ? selectedSectorId : (sectors[0]?.id || ''),
                    target_category: 'medico',
                    target_specialty: '',
                    shift_preset: '12h_diurno',
                    start_time: '07:00',
                    end_time: '19:00',
                    action_type: 'alocar',
                    professional_id: '',
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

        {/* BARRA DE FILTROS: SEÇÃO/SETOR E CATEGORIA PROFISSIONAL */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Seletor de Setor */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1 shrink-0">
              <Building2 className="w-3.5 h-3.5 text-sky-600" /> Setor:
            </span>
            <button
              onClick={() => setSelectedSectorId('todos')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 ${
                selectedSectorId === 'todos'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              Todos os Setores
            </button>
            {sectors.map(sec => (
              <button
                key={sec.id}
                onClick={() => setSelectedSectorId(String(sec.id))}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  selectedSectorId === String(sec.id)
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {sec.name}
              </button>
            ))}
          </div>

          {/* Filtro por Categoria */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-black uppercase text-slate-400">Categoria:</span>
            <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
              <SelectTrigger className="h-8 w-44 text-xs font-bold bg-slate-50 dark:bg-slate-950">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas Categorias</SelectItem>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. VISÃO: ESCALA DO DIA & CENTRO DE COMANDO (CCO / MODO TV)               */}
      {/* ========================================================================= */}
      {activeView === 'dia' ? (
        <div className="space-y-6">
          
          {/* PAINEL DE PLANTÕES EM ANDAMENTO (AO VIVO AGORA) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
                <h3 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Plantões em Andamento (No Posto Agora)
                </h3>
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                {todayShiftsDetailed.emAndamento.length} Profissionais Ativos
              </span>
            </div>

            {todayShiftsDetailed.emAndamento.length === 0 ? (
              <Card className="p-8 text-center border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900">
                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500">Nenhum profissional em atendimento no horário atual.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {todayShiftsDetailed.emAndamento.map(shift => {
                  const prof = professionalMap[String(shift.professional_id)];
                  const sector = sectorMap[String(shift.sector_id)];
                  const cat = CATEGORIES.find(c => c.id === (prof?.category || shift.target_category || 'medico'));

                  return (
                    <Card key={shift.id} className="p-4 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm space-y-3">
                      <div className="flex items-start justify-between gap-2 border-b border-emerald-500/20 pb-2">
                        <div>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${cat?.color}`}>
                            {cat?.label}
                          </span>
                          <h4 className="font-black text-sm text-slate-900 dark:text-white mt-1">
                            {formatFullName(prof?.name)}
                          </h4>
                          <span className="text-xs font-semibold text-slate-500">{prof?.specialty || shift.target_specialty || 'Geral'}</span>
                        </div>
                        <span className="font-mono text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-lg">
                          {shift.start_time} - {shift.end_time}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-sky-600" /> {sector?.name || 'Setor'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Doc: {prof?.document || '—'}
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* PAINEL DE PRÓXIMA RENDIÇÃO (A SEGUIR / TROCA DE TURNO) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-sky-500" /> Próxima Rendição & Troca de Turno (A Seguir)
              </h3>
              <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                {todayShiftsDetailed.proximoRendimento.length} Trocas Previstas
              </span>
            </div>

            {todayShiftsDetailed.proximoRendimento.length === 0 ? (
              <Card className="p-6 text-center border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <p className="text-xs text-slate-500 font-medium">Nenhuma rendição de turno agendada para as próximas 2 horas.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {todayShiftsDetailed.proximoRendimento.map(({ shift, startsIn, minutesLeft }) => {
                  const prof = professionalMap[String(shift.professional_id)];
                  const sector = sectorMap[String(shift.sector_id)];

                  return (
                    <div key={shift.id} className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shadow-sm">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{sector?.name}</span>
                        <h5 className="font-black text-xs text-slate-900 dark:text-white">{formatFullName(prof?.name)}</h5>
                        <span className="text-[11px] text-sky-600 font-bold">{shift.start_time} às {shift.end_time}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black uppercase bg-sky-500/10 text-sky-600 px-2 py-1 rounded-lg">
                          {startsIn !== undefined ? `Inicia em ${startsIn}m` : `Rende em ${minutesLeft}m`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* VAGAS ABERTAS / DESCOBERTAS NO DIA */}
          {todayShiftsDetailed.vagasAbertasHoje.length > 0 && (
            <div className="p-4 rounded-3xl bg-rose-500/10 border-2 border-rose-500/40 space-y-2">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-black text-sm uppercase">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
                Atenção CCO: {todayShiftsDetailed.vagasAbertasHoje.length} Plantão(ões) Descoberto(s) Hoje!
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                {todayShiftsDetailed.vagasAbertasHoje.map(vaga => {
                  const sector = sectorMap[String(vaga.sector_id)];
                  const cat = CATEGORIES.find(c => c.id === (vaga.target_category || 'medico'));

                  return (
                    <div key={vaga.id} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-rose-300 dark:border-rose-900 flex items-center justify-between">
                      <div>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${cat?.color}`}>
                          Exige: {cat?.label}
                        </span>
                        <h5 className="font-black text-xs text-slate-900 dark:text-white mt-1">{sector?.name}</h5>
                        <span className="text-[11px] text-slate-500">{vaga.start_time} - {vaga.end_time}</span>
                      </div>
                      <span className="text-[10px] bg-rose-600 text-white font-black px-2 py-1 rounded uppercase animate-pulse">
                        No Mural
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LACUNA INFERIOR: PLANTÕES CONCLUÍDOS RECENTEMENTE (REGRA DOS 60 MINUTOS) */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-slate-400 text-xs font-black uppercase tracking-wider">
              <span>Plantões Concluídos Recentemente (Histórico dos últimos 60 minutos)</span>
              <span>{todayShiftsDetailed.concluidosRecentes.length} no posto</span>
            </div>

            {todayShiftsDetailed.concluidosRecentes.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Nenhum plantão finalizado na última hora.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {todayShiftsDetailed.concluidosRecentes.map(({ shift, minutesAgo }) => {
                  const prof = professionalMap[String(shift.professional_id)];
                  const sector = sectorMap[String(shift.sector_id)];

                  return (
                    <div key={shift.id} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs opacity-75">
                      <div className="flex justify-between text-[10px] font-bold text-slate-500">
                        <span>{sector?.name}</span>
                        <span>Finalizado há {minutesAgo}m</span>
                      </div>
                      <div className="font-black text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                        {formatFullName(prof?.name)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (

        /* ========================================================================= */
        /* 3. VISÃO: GRADE MENSAL COM IDENTIFICAÇÃO NÍTIDA & BOLINHAS DE STATUS      */
        /* ========================================================================= */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-center py-2.5">
            {WEEKDAYS.map(day => (
              <div key={day} className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800/80">
            {Array.from({ length: daysInMonth[0].getDay() }).map((_, idx) => (
              <div key={`empty-${idx}`} className="min-h-[140px] bg-slate-50/40 dark:bg-slate-950/30"></div>
            ))}

            {daysInMonth.map(dateObj => {
              const dateStr = dateObj.toISOString().split('T')[0];
              const isToday = todayStr === dateStr;
              const dayShifts = shiftsByDate[dateStr] || [];

              return (
                <div
                  key={dateStr}
                  className={`min-h-[160px] p-2 transition-all flex flex-col justify-between ${
                    isToday ? 'bg-sky-50/40 dark:bg-sky-950/20' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                      isToday ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-800 dark:text-slate-200'
                    }`}>
                      {dateObj.getDate()}
                    </span>

                    {isManager && (
                      <button
                        onClick={() => {
                          setEditingShiftId(null);
                          setFormData({
                            date: dateStr,
                            sector_id: selectedSectorId !== 'todos' ? selectedSectorId : (sectors[0]?.id || ''),
                            target_category: 'medico',
                            target_specialty: '',
                            shift_preset: '12h_diurno',
                            start_time: '07:00',
                            end_time: '19:00',
                            action_type: 'alocar',
                            professional_id: '',
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

                  {/* CARDS COM BOLINHAS DE STATUS */}
                  <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[180px] pr-0.5">
                    {dayShifts.map(shift => {
                      const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
                      const sector = sectorMap[String(shift.sector_id)];
                      const isVago = shift.status === 'vago' || !prof;
                      const badge = getShiftBadge(shift);
                      const cat = CATEGORIES.find(c => c.id === (prof?.category || shift.target_category || 'medico'));

                      return (
                        <div
                          key={shift.id}
                          onClick={() => {
                            if (isManager) {
                              setEditingShiftId(shift.id);
                              setFormData({
                                date: shift.date || '',
                                sector_id: shift.sector_id || '',
                                target_category: shift.target_category || prof?.category || 'medico',
                                target_specialty: shift.target_specialty || prof?.specialty || '',
                                shift_preset: 'custom',
                                start_time: shift.start_time || '07:00',
                                end_time: shift.end_time || '19:00',
                                action_type: isVago ? 'mural' : 'alocar',
                                professional_id: shift.professional_id || '',
                                notes: shift.notes || ''
                              });
                              setModalOpen(true);
                            }
                          }}
                          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer"
                        >
                          <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase mb-1">
                            <span className="truncate max-w-[85px]">{sector?.name || 'Setor'}</span>
                            <span className="font-mono text-slate-500">{shift.start_time}-{shift.end_time}</span>
                          </div>

                          {/* BOLINHA COM O STATUS LOGO ABAIXO */}
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${badge.dot}`}></span>
                            <span className={`text-[10px] ${badge.text}`}>
                              {badge.label}
                            </span>
                          </div>

                          {/* NOME E SOBRENOME EM DESTAQUE */}
                          <div className="font-black text-xs text-slate-900 dark:text-white truncate">
                            {isVago ? '⚠️ VAGA NO MURAL' : formatFullName(prof?.name)}
                          </div>

                          <div className="text-[10px] text-slate-500 font-semibold truncate mt-0.5">
                            {cat?.label}: {prof?.specialty || shift.target_specialty || 'Geral'}
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
      )}

      {/* MODAL: CRIAR OU EDITAR PLANTÃO (COM WORKFLOW INTUITIVO) */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-sky-600" />
              {editingShiftId ? 'Editar Plantão da Escala' : 'Lançar Novo Plantão'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveShift} className="space-y-4 py-2 text-xs">
            
            {/* 1. SEÇÃO E DATA */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Data do Plantão *</Label>
                <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="h-9" />
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
            </div>

            {/* 2. CATEGORIA PROFISSIONAL E ESPECIALIDADE ALVO */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Exigência Profissional do Posto</span>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Categoria Obrigatória *</Label>
                  <Select value={formData.target_category} onValueChange={v => setFormData({ ...formData, target_category: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">Especialidade Alvo</Label>
                  <Input 
                    placeholder="Ex: UTI Adulto, Pediatria..." 
                    value={formData.target_specialty} 
                    onChange={e => setFormData({ ...formData, target_specialty: e.target.value })}
                    className="h-9" 
                  />
                </div>
              </div>
            </div>

            {/* 3. HORÁRIO E PRESETS */}
            <div className="space-y-2">
              <Label className="text-xs font-bold">Duração e Horários do Turno *</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: '12h_diurno', label: '12h Diurno (07-19h)' },
                  { id: '12h_noturno', label: '12h Noturno (19-07h)' },
                  { id: '24h', label: '24 Horas (07-07h)' },
                  { id: '6h_manha', label: '6h Manhã (07-13h)' },
                  { id: '6h_tarde', label: '6h Tarde (13-19h)' },
                  { id: 'custom', label: 'Personalizado' }
                ].map(pre => (
                  <button
                    key={pre.id}
                    type="button"
                    onClick={() => handlePresetChange(pre.id)}
                    className={`p-2 rounded-xl border text-[11px] font-bold text-center transition-all ${
                      formData.shift_preset === pre.id 
                        ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/40 text-sky-600 font-black' 
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {pre.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Hora Início</Label>
                  <Input type="time" value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value, shift_preset: 'custom' })} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Hora Término</Label>
                  <Input type="time" value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value, shift_preset: 'custom' })} className="h-9" />
                </div>
              </div>
            </div>

            {/* 4. AÇÃO: ALOCAR IMEDIATO OU LANÇAR NO MURAL */}
            <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 space-y-3">
              <Label className="text-xs font-black uppercase text-indigo-900 dark:text-indigo-200 block">
                Destino do Plantão
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, action_type: 'alocar' })}
                  className={`p-2.5 rounded-xl border text-xs font-black text-center transition-all ${
                    formData.action_type === 'alocar'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Alocar Profissional Já
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, action_type: 'mural', professional_id: '' })}
                  className={`p-2.5 rounded-xl border text-xs font-black text-center transition-all flex items-center justify-center gap-1.5 ${
                    formData.action_type === 'mural'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" /> Publicar no Mural
                </button>
              </div>

              {formData.action_type === 'alocar' ? (
                <div className="space-y-1 pt-1">
                  <Label className="text-xs font-bold">Escolha o Profissional Disponível</Label>
                  <Select value={formData.professional_id} onValueChange={v => setFormData({ ...formData, professional_id: v })}>
                    <SelectTrigger className="h-9 bg-white dark:bg-slate-900"><SelectValue placeholder="Selecione o profissional..." /></SelectTrigger>
                    <SelectContent>
                      {professionals.filter(p => p.status === 'ativo').map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} ({p.specialty || 'Geral'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-xl border border-rose-200 dark:border-rose-900/60">
                  📢 O plantão será publicado no Mural como <b>Vaga Aberta</b>. Apenas profissionais da categoria <b>{CATEGORIES.find(c => c.id === formData.target_category)?.label}</b> poderão assumi-lo.
                </p>
              )}
            </div>

            <DialogFooter className="pt-2 flex-col sm:flex-row gap-2">
              {editingShiftId && (
                <Button type="button" variant="ghost" onClick={() => handleDeleteShift(editingShiftId)} className="h-9 text-xs text-rose-500 hover:bg-rose-50 mr-auto">
                  <Trash2 className="w-4 h-4 mr-1" /> Excluir
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="h-9 text-xs">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="h-9 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs px-6">
                {submitting ? 'Salvando...' : 'Confirmar Plantão'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}