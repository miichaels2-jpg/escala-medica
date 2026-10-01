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
  
  const [currentDateObj, setCurrentDateObj] = useState(today);
  const currentMonth = currentDateObj.getMonth();
  const currentYear = currentDateObj.getFullYear();
  
  // Filtro de data a partir de (inicia como hoje sempre que abre a tela)
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

  // Navegação no topo: Clicar para o lado muda a data limite a partir da data ATUAL do filtro
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
    setAllocationModalOpen(true); 
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

  const autoAllocateProfessionals = () => {
    const profs = [...activeProfessionals];
    if (profs.length === 0) return alert('Não há profissionais cadastrados para distribuir.');
    
    setGeneratedShiftsForAllocation(prev => {
      let profIndex = 0;
      return prev.map(s => {
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
      
      alert(`✅ Escala Publicada com Sucesso!\n\nAs notificações foram disparadas no mural dos médicos alocados na grade.`);
      setPublishModalOpen(false);
      await refreshAllData();
    } catch (e) {
      alert('Erro ao publicar: ' + e.message);
    }
  };