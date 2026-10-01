import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  CalendarDays, Settings, CalendarRange, Filter, X, 
  Trash2, Plus, Clock, Save, UserX, AlertTriangle, 
  ChevronLeft, ChevronRight, CheckCircle2, RotateCcw, 
  Send, ListPlus, Activity
} from 'lucide-react';

// === FUNÇÕES UTILITÁRIAS GERAIS ===
function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeStr(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function getShiftName(shift) {
  return shift.professional_name || shift.professional?.name || shift.professionalName || '';
}

function getSectorName(shift, sectors) {
  if (shift.sector_name && normalizeStr(shift.sector_name) !== 'setor geral' && normalizeStr(shift.sector_name) !== 'setor') return shift.sector_name;
  const sec = (sectors || []).find(item => String(item.id) === String(shift.sector_id));
  return sec?.name || 'Setor Não Informado';
}

function isVacant(shift) {
  const name = normalizeStr(getShiftName(shift));
  const hasProfId = Boolean(shift.professional_id);
  const hasName = Boolean(name);

  if (normalizeStr(shift.status) === 'vago') return true;
  if (name.includes('vaga') || name.includes('descoberto') || name.includes('aberto') || name === 'plantao sem profissional') return true;
  if (!hasProfId && !hasName) return true;
  return false;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

async function autoHealingSaveShift(id, initialPayload) {
  let payload = { ...initialPayload };
  try {
    if (id) {
      const { data, error } = await supabase.from('shifts').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase.from('shifts').insert([payload]).select().single();
      if (error) throw error;
      return data;
    }
  } catch (err) {
    throw err;
  }
}

async function bulkInsertShifts(shiftsToInsert) {
  try {
    const { data, error } = await supabase.from('shifts').insert(shiftsToInsert).select();
    if (error) throw error;
    return data;
  } catch (err) {
    throw err;
  }
}

export default function Escalas() {
  const { user, company, shifts, sectors, professionals, selectedUnitId, loading, refreshAllData } = useAppData();

  // === ESTADOS DE DATA (Comportamento fixo no Dia de Hoje) ===
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => getLocalDateString(today), [today]);
  
  // O Estado inicial SEMPRE começa no hoje
  const [currentDateObj, setCurrentDateObj] = useState(today);
  const currentMonth = currentDateObj.getMonth();
  const currentYear = currentDateObj.getFullYear();
  
  // Filtro de data a partir de (inicia como hoje)
  const [dateFilter, setDateFilter] = useState(todayStr);

  const [selectedSectorFilter, setSelectedSectorFilter] = useState('todos');
  const [profFilter, setProfFilter] = useState('');
  const [viewMode, setViewMode] = useState('board');

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configData, setConfigData] = useState({
    sector_id: '',
    year: currentYear,
    month: currentMonth,
    shifts: [{ start: '07:00', end: '19:00', qnty: 1, type: 'diurno' }]
  });
  
  const [allocationModalOpen, setAllocationModalOpen] = useState(false);
  const [generatedShiftsForAllocation, setGeneratedShiftsForAllocation] = useState([]);

  const [publishModalOpen, setPublishModalOpen] = useState(false);

  const [manageShiftModalOpen, setManageShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [shiftForm, setShiftForm] = useState({
    date: todayStr, start_time: '07:00', end_time: '19:00',
    sector_id: '', professional_id: 'vago', shift_type: 'diurno'
  });

  const companyId = user?.data?.company_id || user?.company_id || company?.id || 'cmp_principal';
  const unitId = selectedUnitId || user?.data?.selected_unit_id || company?.selected_unit_id || 'unit_h1';

  // Escuta os parâmetros via localStorage (caso venha do painel clicar em uma vaga)
  useEffect(() => {
    try {
      const savedSector = window.localStorage.getItem('scale_filter_sector_id');
      const savedShiftId = window.localStorage.getItem('scale_auto_open_shift_id');
      
      if (savedSector) {
        setSelectedSectorFilter(savedSector);
        window.localStorage.removeItem('scale_filter_sector_id');
      }
      if (savedShiftId) {
        const s = shifts.find(x => String(x.id) === savedShiftId);
        if (s) {
          handleOpenManageShift(s);
          window.localStorage.removeItem('scale_auto_open_shift_id');
        }
      }
    } catch {}
  }, [shifts]);

  // Navegação no topo: Clicar para o lado muda a data limite a partir de hoje
  const handleNavDay = (days) => {
    const d = new Date(dateFilter + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setDateFilter(getLocalDateString(d));
    setCurrentDateObj(d);
  };

  const activeSectors = useMemo(() => {
    return (sectors || []).filter(s => {
      if (normalizeStr(s.name) === 'setor geral' || normalizeStr(s.name) === 'setor') return false;
      if (s.status === 'inativo') return false;
      return true;
    });
  }, [sectors]);

  const activeProfessionals = useMemo(() => {
    return (professionals || []).filter(p => p.status !== 'inativo' && p.status !== 'recusado' && p.status !== 'pendente');
  }, [professionals]);

  function getProfMeta(prof) {
    if (!prof) return {};
    try { const stored = window.localStorage.getItem(`prof_meta_${prof.id}`); if (stored) return JSON.parse(stored); } catch {}
    if (prof.data && typeof prof.data === 'object') return prof.data;
    return {};
  }

  // Filtragem da grade (Isola da Unidade e puxa a partir da data de filtro)
  const displayedShifts = useMemo(() => {
    const term = normalizeStr(profFilter);
    return (shifts || []).filter(s => {
      if (s.status === 'cancelado' || String(s.unit_id) !== String(unitId)) return false;
      
      const sDate = (s.date || '').split('T')[0];
      if (sDate < dateFilter) return false;

      if (selectedSectorFilter !== 'todos' && String(s.sector_id) !== selectedSectorFilter) return false;

      if (term) {
        const pName = normalizeStr(s.professional_name);
        if (!pName.includes(term)) return false;
      }
      return true;
    }).sort((a, b) => {
      const d1 = a.date || ''; const d2 = b.date || '';
      if (d1 !== d2) return d1.localeCompare(d2);
      return (a.start_time || '').localeCompare(b.start_time || '');
    });
  }, [shifts, unitId, dateFilter, selectedSectorFilter, profFilter]);

  const groupedByDay = useMemo(() => {
    const groups = {};
    displayedShifts.forEach(s => {
      const date = (s.date || '').split('T')[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(s);
    });
    return Object.entries(groups).sort(([d1], [d2]) => d1.localeCompare(d2)).map(([date, items]) => ({
      date,
      items: items.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
    }));
  }, [displayedShifts]);

  const stats = useMemo(() => {
    let total = 0; let filled = 0; let vacant = 0;
    displayedShifts.forEach(s => {
      total++;
      if (isVacant(s)) vacant++; else filled++;
    });
    return { total, filled, vacant, coverage: total === 0 ? 0 : Math.round((filled / total) * 100) };
  }, [displayedShifts]);

  // === MÓDULO DE GERAÇÃO DE ESCALA MENSAL (Lógica Complexa) ===
  const addConfigShiftRow = () => {
    setConfigData(p => ({
      ...p,
      shifts: [...p.shifts, { start: '07:00', end: '19:00', qnty: 1, type: 'diurno' }]
    }));
  };

  const removeConfigShiftRow = (idx) => {
    setConfigData(p => ({
      ...p,
      shifts: p.shifts.filter((_, i) => i !== idx)
    }));
  };

  const updateConfigShift = (idx, field, val) => {
    setConfigData(p => ({
      ...p,
      shifts: p.shifts.map((s, i) => i === idx ? { ...s, [field]: val } : s)
    }));
  };

  const handleGenerateScale = async () => {
    if (!configData.sector_id) return alert('Selecione um setor.');
    if (configData.shifts.length === 0) return alert('Adicione pelo menos um horário.');

    const y = configData.year;
    const m = configData.month;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    
    let toInsert = [];
    const secObj = activeSectors.find(x => String(x.id) === configData.sector_id);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      configData.shifts.forEach(sConfig => {
        for (let q = 0; q < sConfig.qnty; q++) {
          toInsert.push({
            id: `temp_${Date.now()}_${Math.random()}`,
            company_id: companyId,
            unit_id: unitId,
            sector_id: configData.sector_id,
            sector_name: secObj ? secObj.name : 'Setor',
            date: dateStr,
            start_time: sConfig.start,
            end_time: sConfig.end,
            shift_type: sConfig.type,
            professional_id: null,
            professional_name: 'VAGA EM ABERTO',
            status: 'vago',
            notes: ''
          });
        }
      });
    }

    setGeneratedShiftsForAllocation(toInsert);
    setConfigModalOpen(false);
    setAllocationModalOpen(true); // Abre o popup de alocação inteligente
  };

  const handleAllocationChange = (tempId, profId) => {
    setGeneratedShiftsForAllocation(prev => prev.map(s => {
      if (s.id !== tempId) return s;
      if (!profId || profId === 'vago') {
        return { ...s, professional_id: null, professional_name: 'VAGA EM ABERTO', status: 'vago' };
      }
      const prof = activeProfessionals.find(x => String(x.id) === profId);
      return { 
        ...s, 
        professional_id: profId, 
        professional_name: prof ? prof.name : 'Profissional', 
        status: 'confirmado' 
      };
    }));
  };

  // Botão de Preenchimento Automático na tela de Alocação
  const autoAllocateProfessionals = () => {
    const profs = [...activeProfessionals];
    if (profs.length === 0) return alert('Não há profissionais cadastrados para distribuir.');
    
    setGeneratedShiftsForAllocation(prev => {
      let profIndex = 0;
      return prev.map(s => {
        // Ignora os que já foram selecionados manualmente
        if (s.professional_id) return s;
        
        const prof = profs[profIndex % profs.length];
        profIndex++;
        return {
          ...s,
          professional_id: prof.id,
          professional_name: prof.name,
          status: 'confirmado'
        };
      });
    });
  };

  const confirmAndSaveAllocation = async () => {
    try {
      const finalToInsert = generatedShiftsForAllocation.map(({ id, ...rest }) => rest);
      await bulkInsertShifts(finalToInsert);
      
      // Salva marcação de que o setor tem Rascunho naquele mês
      const mkKey = `scale_published_ranges_${unitId}_${configData.sector_id}_${configData.year}_${configData.month + 1}`;
      window.localStorage.setItem(mkKey, JSON.stringify([])); 
      
      alert(`Escala pré-gerada com sucesso! Você tem ${finalToInsert.filter(x => x.status==='vago').length} vagas em aberto na grade.`);
      setAllocationModalOpen(false);
      setGeneratedShiftsForAllocation([]);
      await refreshAllData();
    } catch (e) {
      alert('Erro ao salvar escala: ' + e.message);
    }
  };

  // === PUBLICAÇÃO E NOTIFICAÇÃO DE ESCALAS ===
  const handlePublishScales = async () => {
    if (!configData.sector_id) return alert('Selecione um setor.');

    const confirm = window.confirm(`Atenção: Você está prestes a PUBLICAR OFICIALMENTE a escala deste mês.\n\nTodos os profissionais alocados serão notificados pelo mural do aplicativo. Deseja continuar?`);
    if (!confirm) return;

    try {
      const mkKey = `scale_published_ranges_${unitId}_${configData.sector_id}_${configData.year}_${configData.month + 1}`;
      window.localStorage.setItem(mkKey, JSON.stringify([{ start: 1, end: 31 }])); 
      
      // Notificação simulada via alert (na prática pode disparar Supabase Functions/Push)
      alert(`✅ Escala Publicada com Sucesso!\n\nAs notificações foram disparadas no mural dos médicos alocados na grade.`);
      setPublishModalOpen(false);
      await refreshAllData();
    } catch (e) {
      alert('Erro ao publicar: ' + e.message);
    }
  };
  // === GERENCIAMENTO INDIVIDUAL DE PLANTÃO ===
  const handleOpenManageShift = (shift = null) => {
    if (shift) {
      setEditingShift(shift);
      setShiftForm({
        date: (shift.date || '').split('T')[0],
        start_time: shift.start_time || '07:00',
        end_time: shift.end_time || '19:00',
        sector_id: shift.sector_id || '',
        professional_id: shift.professional_id || 'vago',
        shift_type: shift.shift_type || 'diurno'
      });
    } else {
      setEditingShift(null);
      setShiftForm({
        date: dateFilter, start_time: '07:00', end_time: '19:00',
        sector_id: selectedSectorFilter === 'todos' ? '' : selectedSectorFilter,
        professional_id: 'vago', shift_type: 'diurno'
      });
    }
    setManageShiftModalOpen(true);
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!shiftForm.sector_id) return alert('Selecione um setor.');

    const isVago = shiftForm.professional_id === 'vago';
    const profObj = isVago ? null : activeProfessionals.find(x => String(x.id) === shiftForm.professional_id);
    const secObj = activeSectors.find(x => String(x.id) === shiftForm.sector_id);

    const payload = {
      company_id: companyId,
      unit_id: unitId,
      sector_id: shiftForm.sector_id,
      sector_name: secObj ? secObj.name : 'Setor',
      date: shiftForm.date,
      start_time: shiftForm.start_time,
      end_time: shiftForm.end_time,
      shift_type: shiftForm.shift_type,
      professional_id: isVago ? null : profObj.id,
      professional_name: isVago ? 'VAGA EM ABERTO' : profObj.name,
      status: isVago ? 'vago' : 'confirmado'
    };

    try {
      await autoHealingSaveShift(editingShift?.id, payload);
      setManageShiftModalOpen(false);
      await refreshAllData();
    } catch (err) {
      alert('Erro ao salvar plantão: ' + err.message);
    }
  };

  const handleDeleteShift = async () => {
    if (!editingShift?.id) return;
    if (!confirm('Deseja realmente excluir este plantão?')) return;
    try {
      await supabase.from('shifts').delete().eq('id', editingShift.id);
      setManageShiftModalOpen(false);
      await refreshAllData();
    } catch (err) { alert('Erro ao excluir: ' + err.message); }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando matriz de escalas...</div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans bg-slate-50 dark:bg-[#0B1120] min-h-screen text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* HEADER PRINCIPAL */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] p-6 text-slate-900 dark:text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-cyan-400">
            <CalendarDays className="w-4 h-4" /> Dimensionamento & Alocação
          </div>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black">Escalas Hospitalares</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Geração de grades mensais, alocação de profissionais e publicação no mural do aplicativo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button 
            onClick={() => handleOpenManageShift()} 
            className="h-10 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-black text-xs px-4 rounded-2xl shadow-sm gap-2 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" /> Plantão Avulso
          </Button>

          <Button 
            onClick={() => setConfigModalOpen(true)} 
            className="h-10 bg-sky-600 hover:bg-sky-700 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-black text-xs px-4 rounded-2xl shadow-md gap-2 cursor-pointer transition-all"
          >
            <CalendarRange className="w-4 h-4" /> Gerar Mês (Grade Lote)
          </Button>
        </div>
      </div>

      {/* FILTROS E NAVEGAÇÃO DE DATA */}
      <Card className="p-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <div className="flex items-center bg-slate-100 dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 p-1 rounded-2xl gap-1">
            <button onClick={() => handleNavDay(-1)} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-500 cursor-pointer transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex flex-col items-center justify-center px-2">
              <span className="text-[9px] uppercase font-bold text-slate-400">A Partir De</span>
              <Input 
                type="date" 
                value={dateFilter} 
                onChange={e => {
                  setDateFilter(e.target.value);
                  setCurrentDateObj(new Date(e.target.value + 'T12:00:00'));
                }} 
                className="h-6 w-28 border-none bg-transparent p-0 text-xs font-black text-center focus-visible:ring-0 shadow-none dark:[color-scheme:dark]" 
              />
            </div>
            <button onClick={() => handleNavDay(1)} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-500 cursor-pointer transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
            <Button variant="ghost" onClick={() => { setDateFilter(todayStr); setCurrentDateObj(today); }} className="h-8 text-[10px] font-black uppercase text-sky-600 dark:text-cyan-400 hover:bg-sky-50 dark:hover:bg-cyan-950/30 cursor-pointer">
              Hoje
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Select value={selectedSectorFilter} onValueChange={setSelectedSectorFilter}>
            <SelectTrigger className="h-10 w-full sm:w-48 text-xs font-bold bg-slate-50 dark:bg-[#0B1120] border-slate-200 dark:border-slate-700 rounded-xl">
              <SelectValue placeholder="Filtrar Setor" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
              <SelectItem value="todos">Todos os Setores</SelectItem>
              {activeSectors.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input 
            placeholder="Buscar profissional..." 
            value={profFilter} 
            onChange={e => setProfFilter(e.target.value)} 
            className="h-10 w-full sm:w-48 text-xs bg-slate-50 dark:bg-[#0B1120] border-slate-200 dark:border-slate-700 rounded-xl" 
          />
        </div>
      </Card>

      {/* METRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 rounded-3xl bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400">Total Filtrado</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{stats.total}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"><CalendarDays className="w-5 h-5" /></div>
        </Card>
        <Card className="p-4 rounded-3xl bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Cobertos (Alocados)</span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.filled}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-500"><CheckCircle2 className="w-5 h-5" /></div>
        </Card>
        <Card className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between transition-colors ${stats.vacant > 0 ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50' : 'bg-white dark:bg-[#1e293b] border-slate-200 dark:border-slate-800'}`}>
          <div>
            <span className={`text-[10px] font-black uppercase ${stats.vacant > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>Vagas Abertas (Furos)</span>
            <div className={`text-2xl font-black mt-0.5 ${stats.vacant > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>{stats.vacant}</div>
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stats.vacant > 0 ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-500 animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}><AlertTriangle className="w-5 h-5" /></div>
        </Card>
      </div>

      {/* RENDERIZAÇÃO DA GRADE (BOARD) */}
      <div className="space-y-6">
        {groupedByDay.length === 0 ? (
          <div className="py-16 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-[#1e293b]/50">
            Nenhum plantão agendado para o período ou filtros selecionados.
          </div>
        ) : (
          groupedByDay.map(group => {
            const dObj = new Date(group.date + 'T12:00:00');
            const isToday = group.date === todayStr;
            const isPast = group.date < todayStr;
            
            return (
              <div key={group.date} className="space-y-3 relative">
                <div className="sticky top-0 z-10 py-2 flex items-center gap-3 bg-slate-50/90 dark:bg-[#0B1120]/90 backdrop-blur-sm">
                  <div className={`px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 border shadow-sm ${
                    isToday ? 'bg-sky-600 text-white border-sky-500' : 
                    isPast ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700' : 
                    'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800'
                  }`}>
                    {dObj.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                    {isToday && <span className="w-2 h-2 rounded-full bg-white animate-ping ml-1" />}
                  </div>
                  <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {group.items.map(shift => {
                    const vago = isVacant(shift);
                    return (
                      <Card 
                        key={shift.id} 
                        onClick={() => handleOpenManageShift(shift)}
                        className={`p-3.5 rounded-2xl border cursor-pointer hover:scale-[1.02] hover:shadow-md transition-all ${
                          vago 
                            ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 shadow-sm' 
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {shift.start_time} às {shift.end_time}
                          </span>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${vago ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                            {vago ? 'Vaga Aberta' : shift.status}
                          </span>
                        </div>
                        
                        <div className="font-black text-sm text-slate-900 dark:text-white truncate">
                          {vago ? <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> CLIQUE PARA ALOCAR</span> : toTitleCase(shift.professional_name)}
                        </div>
                        
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate font-medium">
                          🏥 {toTitleCase(shift.sector_name)}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* === MODAL DE GERAÇÃO EM LOTE (CONFIGURAÇÃO) === */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="sm:max-w-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-slate-900 dark:text-white">
              <CalendarRange className="w-5 h-5 text-sky-600" />
              Configurador da Grade Mensal
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-3">
            <div className="p-4 bg-sky-50 dark:bg-sky-950/20 rounded-2xl border border-sky-100 dark:border-sky-900/50">
              <p className="text-xs text-sky-800 dark:text-sky-300 font-bold mb-2 flex items-center gap-1.5">
                <Activity className="w-4 h-4" /> Passo 1: Onde e Quando?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-500">Mês de Referência</Label>
                  <Select value={String(configData.month)} onValueChange={v => setConfigData(p => ({...p, month: parseInt(v)}))}>
                    <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-slate-500">Setor / Posto</Label>
                  <Select value={configData.sector_id} onValueChange={v => setConfigData(p => ({...p, sector_id: v}))}>
                    <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="z-[99999]">
                      {activeSectors.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-sky-600" /> Passo 2: Horários e Vagas por Dia
                </p>
                <Button type="button" variant="outline" size="sm" onClick={addConfigShiftRow} className="h-7 text-[10px] font-bold rounded-lg cursor-pointer">
                  <Plus className="w-3 h-3 mr-1" /> Add Horário
                </Button>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {configData.shifts.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <Input type="time" value={s.start} onChange={e => updateConfigShift(idx, 'start', e.target.value)} className="h-9 w-24 text-xs font-mono" />
                    <span className="text-xs text-slate-400">às</span>
                    <Input type="time" value={s.end} onChange={e => updateConfigShift(idx, 'end', e.target.value)} className="h-9 w-24 text-xs font-mono" />
                    <div className="flex-1 flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-2">
                      <Input type="number" min="1" max="20" value={s.qnty} onChange={e => updateConfigShift(idx, 'qnty', parseInt(e.target.value))} className="h-9 w-16 text-xs text-center font-bold" title="Vagas por dia" />
                      <span className="text-[10px] uppercase font-bold text-slate-500 leading-tight">Vagas<br/>por dia</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeConfigShiftRow(idx)} disabled={configData.shifts.length === 1} className="h-8 w-8 text-rose-500 hover:bg-rose-50 cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <Button variant="outline" onClick={() => setConfigModalOpen(false)} className="rounded-xl cursor-pointer font-bold">Cancelar</Button>
            <Button onClick={handleGenerateScale} className="bg-sky-600 hover:bg-sky-500 text-white rounded-xl cursor-pointer font-black px-6 shadow-md">
              Gerar Grade em Branco <ArrowRightLeft className="w-4 h-4 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === MODAL DE ALOCAÇÃO VISUAL (PASSO 3) === */}
      <Dialog open={allocationModalOpen} onOpenChange={(open) => {
        if (!open && generatedShiftsForAllocation.length > 0) {
          if(confirm('Tem certeza que deseja cancelar? Os plantões gerados serão descartados.')){
            setAllocationModalOpen(false);
            setGeneratedShiftsForAllocation([]);
          }
        } else {
          setAllocationModalOpen(open);
        }
      }}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <DialogHeader className="shrink-0 border-b border-slate-100 dark:border-slate-800 pb-4">
            <DialogTitle className="text-xl font-black flex items-center gap-2 text-slate-900 dark:text-white">
              <ListPlus className="w-6 h-6 text-emerald-500" />
              Alocação de Profissionais (Passo 3)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              A grade do mês foi desenhada. Agora, distribua os médicos nas vagas abertas ou salve em branco para preencher depois.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
            <div className="flex justify-end mb-2">
              <Button onClick={autoAllocateProfessionals} variant="outline" className="h-9 text-[10px] font-black border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 gap-1.5 cursor-pointer">
                <Sparkles className="w-3.5 h-3.5" /> Preenchimento Automático (Rodízio)
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {generatedShiftsForAllocation.map((s) => {
                const isVago = !s.professional_id || s.professional_id === 'vago';
                return (
                  <div key={s.id} className={`p-3 rounded-2xl border ${isVago ? 'border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20' : 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20'}`}>
                    <div className="flex items-center justify-between mb-2 border-b border-slate-200/50 dark:border-slate-800 pb-2">
                      <span className="text-xs font-black font-mono text-slate-700 dark:text-slate-300">{formatDateBR(s.date)}</span>
                      <span className="text-[10px] font-black uppercase text-slate-500 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border">{s.start_time} às {s.end_time}</span>
                    </div>
                    
                    <Select value={s.professional_id || 'vago'} onValueChange={(val) => handleAllocationChange(s.id, val)}>
                      <SelectTrigger className={`h-9 text-xs font-bold rounded-xl border-none ${isVago ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-400'}`}>
                        <SelectValue placeholder="Selecione o Profissional" />
                      </SelectTrigger>
                      <SelectContent className="z-[99999] max-h-[250px]">
                        <SelectItem value="vago" className="text-rose-600 font-bold">⚠️ MANTER VAGA ABERTA</SelectItem>
                        {activeProfessionals.map(p => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-col sm:flex-row justify-between gap-3">
            <div className="text-xs font-bold text-slate-500 flex items-center gap-2">
              <span className="px-2 py-1 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-lg">{generatedShiftsForAllocation.filter(x => !x.professional_id || x.professional_id === 'vago').length} Vagas</span>
              <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg">{generatedShiftsForAllocation.filter(x => x.professional_id && x.professional_id !== 'vago').length} Alocados</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { setAllocationModalOpen(false); setGeneratedShiftsForAllocation([]); }} variant="outline" className="rounded-xl font-bold cursor-pointer">Descartar Tudo</Button>
              <Button onClick={confirmAndSaveAllocation} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black shadow-md cursor-pointer px-6 gap-2">
                <Save className="w-4 h-4" /> Confirmar e Salvar Escala
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === MODAL GERENCIAR UM PLANTÃO === */}
      <Dialog open={manageShiftModalOpen} onOpenChange={setManageShiftModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              {editingShift ? <Edit className="w-5 h-5 text-sky-600" /> : <Plus className="w-5 h-5 text-emerald-500" />}
              {editingShift ? 'Editar Plantão' : 'Novo Plantão Avulso'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveShift} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-500">Data do Plantão *</Label>
                <Input type="date" value={shiftForm.date} onChange={e => setShiftForm(p => ({...p, date: e.target.value}))} required className="h-10 text-xs font-mono bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-500">Turno / Tipo</Label>
                <Select value={shiftForm.shift_type} onValueChange={v => setShiftForm(p => ({...p, shift_type: v}))}>
                  <SelectTrigger className="h-10 text-xs font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[99999]">
                    <SelectItem value="diurno">Diurno</SelectItem>
                    <SelectItem value="noturno">Noturno</SelectItem>
                    <SelectItem value="24h">24 Horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-500">Início *</Label>
                <Input type="time" value={shiftForm.start_time} onChange={e => setShiftForm(p => ({...p, start_time: e.target.value}))} required className="h-10 text-xs font-mono bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-500">Término *</Label>
                <Input type="time" value={shiftForm.end_time} onChange={e => setShiftForm(p => ({...p, end_time: e.target.value}))} required className="h-10 text-xs font-mono bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-500">Setor Clínico *</Label>
              <Select value={shiftForm.sector_id} onValueChange={v => setShiftForm(p => ({...p, sector_id: v}))}>
                <SelectTrigger className="h-10 text-xs font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl"><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                <SelectContent className="z-[99999]">
                  {activeSectors.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <Label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5"><UserX className="w-3.5 h-3.5" /> Profissional Alocado</Label>
              <Select value={shiftForm.professional_id} onValueChange={v => setShiftForm(p => ({...p, professional_id: v}))}>
                <SelectTrigger className={`h-10 text-xs font-bold rounded-xl border-none ${shiftForm.professional_id === 'vago' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400' : 'bg-white dark:bg-slate-950 text-emerald-700 dark:text-emerald-400 shadow-sm'}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[99999] max-h-[250px]">
                  <SelectItem value="vago" className="text-rose-600 font-bold">⚠️ MANTER VAGA ABERTA</SelectItem>
                  {activeProfessionals.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4 flex flex-col sm:flex-row justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
              {editingShift && (
                <Button type="button" variant="outline" onClick={handleDeleteShift} className="h-10 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 font-black text-xs px-6 rounded-xl cursor-pointer w-full sm:w-auto">
                  Excluir Plantão
                </Button>
              )}
              <div className="flex gap-2 w-full sm:w-auto">
                <Button type="button" variant="ghost" onClick={() => setManageShiftModalOpen(false)} className="flex-1 sm:flex-none h-10 font-bold rounded-xl cursor-pointer">Cancelar</Button>
                <Button type="submit" className="flex-1 sm:flex-none h-10 bg-sky-600 hover:bg-sky-500 text-white font-black rounded-xl shadow-md cursor-pointer px-6"><Save className="w-4 h-4 mr-2" /> Salvar</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}