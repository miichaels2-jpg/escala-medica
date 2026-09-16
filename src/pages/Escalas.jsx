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
  CalendarDays, Plus, Search, Filter, Tv, ChevronLeft, 
  ChevronRight, Clock, Building2, User, AlertTriangle, 
  CheckCircle2, Flame, Trash2, Edit3, X, UserX, UserCheck,
  Maximize2, Minimize2, Sparkles, Layers
} from 'lucide-react';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Salva shifts de forma auto-regenerativa, removendo colunas ausentes no schema
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

export default function Escalas() {
  const { 
    shifts, 
    sectors, 
    professionals, 
    units, 
    selectedUnitId, 
    company, 
    isManager, 
    syncGlobalData 
  } = useAppData();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedSectorId, setSelectedSectorId] = useState('todos');
  const [filterTurno, setFilterTurno] = useState('todos'); // 'todos', 'diurno', 'noturno'
  const [tvMode, setTvMode] = useState(false);

  // Modais de Criação / Edição
  const [modalOpen, setModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Formulário do Plantão
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    sector_id: '',
    professional_id: '',
    shift_type: 'diurno', // 'diurno' | 'noturno'
    start_time: '07:00',
    end_time: '19:00',
    status: 'confirmado', // 'confirmado' | 'vago' (mural)
    notes: ''
  });

  // Navegação no Calendário
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const handlePrevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  const handleToday = () => setCurrentDate(new Date());

  // Mapeamentos rápidos por ID
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

  // Dias do mês atual para preenchimento da grade
  const daysInMonth = useMemo(() => {
    const date = new Date(currentYear, currentMonth, 1);
    const days = [];
    while (date.getMonth() === currentMonth) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [currentYear, currentMonth]);

  // Filtra os plantões da unidade, mês e filtros ativos
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

  // Agrupa os plantões por dia (formato YYYY-MM-DD)
  const shiftsByDate = useMemo(() => {
    const map = {};
    monthlyShifts.forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [monthlyShifts]);

  // Indicadores de Cobertura
  const stats = useMemo(() => {
    let total = monthlyShifts.length;
    let preenchidos = 0;
    let vagos = 0;

    monthlyShifts.forEach(s => {
      if (s.professional_id && s.status !== 'vago') preenchidos++;
      else vagos++;
    });

    const percent = total > 0 ? Math.round((preenchidos / total) * 100) : 100;
    return { total, preenchidos, vagos, percent };
  }, [monthlyShifts]);

  // Abrir Modal para Novo Plantão
  const handleOpenNew = (defaultDate = null) => {
    setEditingShiftId(null);
    setFormData({
      date: defaultDate || new Date().toISOString().split('T')[0],
      sector_id: sectors[0]?.id || '',
      professional_id: '',
      shift_type: 'diurno',
      start_time: '07:00',
      end_time: '19:00',
      status: 'confirmado',
      notes: ''
    });
    setModalOpen(true);
  };

  // Abrir Modal para Edição
  const handleOpenEdit = (shift) => {
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
  };

  // Validação de Conflito de Horário (evita médico em dois plantões no mesmo turno)
  const checkTimeConflict = (profId, shiftDate, shiftType, excludeId = null) => {
    if (!profId) return false;
    return shifts.some(s => 
      s.id !== excludeId &&
      String(s.professional_id) === String(profId) &&
      s.date === shiftDate &&
      s.shift_type === shiftType &&
      s.status !== 'cancelado'
    );
  };

  // Salvar Plantão
  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!formData.sector_id || !formData.date) {
      alert('Selecione ao menos a data e o setor.');
      return;
    }

    // Se houver profissional definido, confere conflito de horário
    if (formData.professional_id && formData.status !== 'vago') {
      const hasConflict = checkTimeConflict(formData.professional_id, formData.date, formData.shift_type, editingShiftId);
      if (hasConflict) {
        if (!confirm('ATENÇÃO: Este profissional já possui outro plantão cadastrado neste mesmo turno e data. Deseja prosseguir mesmo assim?')) {
          return;
        }
      }
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

      await autoHealingSaveShift(editingShiftId, payload);
      setModalOpen(false);
      await syncGlobalData();
    } catch (err) {
      alert('Erro ao salvar plantão: ' + (err.message || 'Falha de rede.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Publicar Plantão Descoberto diretamente no Mural de Vagas
  const handleSendToMural = async (shift) => {
    if (!confirm('Deseja transformar este plantão em uma Vaga Aberta no Mural para os profissionais se candidatarem?')) return;
    try {
      await autoHealingSaveShift(shift.id, {
        professional_id: null,
        status: 'vago'
      });
      await syncGlobalData();
    } catch (err) {
      alert('Erro ao publicar no mural: ' + err.message);
    }
  };

  // Excluir Plantão
  const handleDeleteShift = async (shiftId) => {
    if (!confirm('Deseja excluir este plantão da escala?')) return;
    try {
      await base44.entities.Shift.delete(shiftId);
      await syncGlobalData();
    } catch (err) {
      alert('Erro ao remover plantão: ' + err.message);
    }
  };

  return (
    <div className={`p-3 md:p-6 space-y-5 font-sans ${tvMode ? 'fixed inset-0 z-50 bg-slate-950 text-white overflow-y-auto p-6' : ''}`}>
      
      {/* HEADER DE CONTROLE & CCO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        
        {/* NAVEGAÇÃO DE MÊS */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={handleToday} className="px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-200">
              Hoje
            </button>
            <button onClick={handleNextMonth} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div>
            <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-sky-600" />
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
            <span className="text-[11px] text-slate-400 font-semibold block">
              Grade Geral de Cobertura Assistencial
            </span>
          </div>
        </div>

        {/* INDICADORES EM TEMPO REAL */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Cobertura</span>
            <span className={`font-black text-sm ${stats.percent === 100 ? 'text-emerald-600' : 'text-amber-500'}`}>
              {stats.percent}% Coberto
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Vagas no Mural</span>
            <span className={`font-black text-sm ${stats.vagos > 0 ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`}>
              {stats.vagos} Descobertas
            </span>
          </div>

          {/* BOTÃO MODO TV / CCO */}
          <Button
            variant="outline"
            onClick={() => setTvMode(!tvMode)}
            className="h-9 px-3 text-xs font-bold gap-1.5 border-slate-300 dark:border-slate-700"
            title="Alternar Modo TV / Centro de Comando"
          >
            {tvMode ? <Minimize2 className="w-4 h-4 text-sky-500" /> : <Tv className="w-4 h-4 text-sky-500" />}
            <span>{tvMode ? 'Sair da TV' : 'Modo TV'}</span>
          </Button>

          {isManager && (
            <Button onClick={() => handleOpenNew()} className="h-9 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-4 rounded-xl shadow-md gap-1">
              <Plus className="w-4 h-4" /> Novo Plantão
            </Button>
          )}
        </div>
      </div>

      {/* FILTROS DE SETOR E TURNO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedSectorId} onValueChange={setSelectedSectorId}>
            <SelectTrigger className="h-8 w-48 text-xs font-bold bg-white dark:bg-slate-900">
              <SelectValue placeholder="Filtrar Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Setores</SelectItem>
              {sectors.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterTurno} onValueChange={setFilterTurno}>
            <SelectTrigger className="h-8 w-36 text-xs font-bold bg-white dark:bg-slate-900">
              <SelectValue placeholder="Turno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Turnos</SelectItem>
              <SelectItem value="diurno">Diurno (07h - 19h)</SelectItem>
              <SelectItem value="noturno">Noturno (19h - 07h)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Diurno (07h-19h)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Noturno (19h-07h)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Descoberto / Mural
          </span>
        </div>
      </div>

      {/* GRADE MENSAL DE PLANTÕES */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        
        {/* CABEÇALHO DOS DIAS DA SEMANA */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-center text-[11px] font-black text-slate-500 uppercase py-2">
          {WEEKDAYS.map(day => (
            <div key={day}>{day}</div>
          ))}
        </div>

        {/* CÉLULAS DOS DIAS */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800/80">
          
          {/* Espaçamento inicial para o primeiro dia da semana */}
          {Array.from({ length: daysInMonth[0].getDay() }).map((_, idx) => (
            <div key={`empty-${idx}`} className="min-h-[110px] bg-slate-50/40 dark:bg-slate-950/30"></div>
          ))}

          {daysInMonth.map(dateObj => {
            const dateStr = dateObj.toISOString().split('T')[0];
            const isToday = new Date().toISOString().split('T')[0] === dateStr;
            const dayShifts = shiftsByDate[dateStr] || [];

            return (
              <div 
                key={dateStr} 
                className={`min-h-[120px] p-1.5 transition-colors flex flex-col justify-between ${
                  isToday 
                    ? 'bg-sky-50/40 dark:bg-sky-950/20' 
                    : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                }`}
              >
                {/* TOPO DO DIA */}
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-black px-1.5 py-0.5 rounded-md ${
                    isToday ? 'bg-sky-600 text-white' : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {dateObj.getDate()}
                  </span>

                  {isManager && (
                    <button
                      onClick={() => handleOpenNew(dateStr)}
                      title="Adicionar plantão neste dia"
                      className="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* LISTA DE PLANTÕES DO DIA */}
                <div className="space-y-1 flex-1 overflow-y-auto max-h-[140px] pr-0.5">
                  {dayShifts.map(shift => {
                    const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
                    const sector = sectorMap[String(shift.sector_id)];
                    const isVago = shift.status === 'vago' || !prof;
                    const isDiurno = shift.shift_type === 'diurno';

                    return (
                      <div
                        key={shift.id}
                        onClick={() => isManager && handleOpenEdit(shift)}
                        className={`p-1.5 rounded-lg border text-[10px] transition-all cursor-pointer select-none ${
                          isVago
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/20'
                            : isDiurno
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200'
                            : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-900 dark:text-indigo-200'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="truncate max-w-[85px]">
                            {sector?.name || 'Setor'}
                          </span>
                          <span className="text-[9px] opacity-75 font-mono">
                            {isDiurno ? '07-19h' : '19-07h'}
                          </span>
                        </div>

                        <div className="mt-0.5 flex items-center justify-between">
                          <span className="truncate font-black">
                            {isVago ? '⚠️ VAGA ABERTA' : prof?.name?.split(' ')[0] || 'Profissional'}
                          </span>

                          {isVago && isManager && (
                            <span className="text-[8px] bg-rose-500 text-white font-black px-1 rounded uppercase animate-pulse">
                              Mural
                            </span>
                          )}
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

      {/* MODAL: NOVO OU EDITAR PLANTÃO */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-sky-600" />
              {editingShiftId ? 'Editar Plantão da Escala' : 'Lançar Novo Plantão'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveShift} className="space-y-3 py-2 text-xs">
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Data do Plantão *</Label>
                <Input 
                  type="date" 
                  value={formData.date} 
                  onChange={e => setFormData({ ...formData, date: e.target.value })} 
                  className="h-9" 
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Turno *</Label>
                <Select 
                  value={formData.shift_type} 
                  onValueChange={v => setFormData({ 
                    ...formData, 
                    shift_type: v,
                    start_time: v === 'diurno' ? '07:00' : '19:00',
                    end_time: v === 'diurno' ? '19:00' : '07:00'
                  })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diurno">Diurno (07h às 19h)</SelectItem>
                    <SelectItem value="noturno">Noturno (19h às 07h)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Setor Hospitalar *</Label>
              <Select 
                value={formData.sector_id} 
                onValueChange={v => setFormData({ ...formData, sector_id: v })}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o setor..." /></SelectTrigger>
                <SelectContent>
                  {sectors.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold">Status da Escala</Label>
                <span className="text-[10px] text-slate-400">Marque vago para ir ao Mural</span>
              </div>
              <Select 
                value={formData.status} 
                onValueChange={v => setFormData({ 
                  ...formData, 
                  status: v, 
                  professional_id: v === 'vago' ? '' : formData.professional_id 
                })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmado">Confirmado (Com Profissional)</SelectItem>
                  <SelectItem value="vago">Vago / Aberto para o Mural</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.status !== 'vago' && (
              <div className="space-y-1">
                <Label className="text-xs font-bold">Profissional Escalado</Label>
                <Select 
                  value={formData.professional_id} 
                  onValueChange={v => setFormData({ ...formData, professional_id: v })}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o profissional..." /></SelectTrigger>
                  <SelectContent>
                    {professionals.filter(p => p.status === 'ativo').map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} ({p.specialty || 'Geral'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-bold">Observações do Plantão</Label>
              <Input 
                value={formData.notes} 
                onChange={e => setFormData({ ...formData, notes: e.target.value })} 
                placeholder="Ex: Cobertura de férias, plantão extra..." 
                className="h-9" 
              />
            </div>

            <DialogFooter className="pt-3 flex-col sm:flex-row gap-2">
              {editingShiftId && (
                <div className="flex items-center gap-2 mr-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSendToMural({ id: editingShiftId })}
                    className="h-9 text-xs text-amber-600 border-amber-300 hover:bg-amber-50"
                  >
                    Mandar p/ Mural
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleDeleteShift(editingShiftId)}
                    className="h-9 text-xs text-rose-500 hover:bg-rose-50 px-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}

              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="h-9 text-xs">
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting} className="h-9 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-5">
                {submitting ? 'Salvando...' : 'Salvar Plantão'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}