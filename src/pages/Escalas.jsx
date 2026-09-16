import React, { Component, useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity, AlertTriangle, Building2, CalendarDays, CheckCircle2,
  Clock3, GripVertical, LayoutGrid, List, Loader2, Lock,
  Maximize2, Moon, Pencil, Plus, Printer, RefreshCw, Search,
  Send, SlidersHorizontal, Sun, Trash2, UserPlus, UsersRound,
  X, FileText, ShieldAlert, ArrowRightLeft, Megaphone, Ban,
  Check, Copy, ChevronLeft, ChevronRight, UserCheck
} from 'lucide-react';
import ShiftFormDialog from '@/components/shifts/ShiftFormDialog';

/* ============================================================
   ERROR BOUNDARY
   ============================================================ */
class SafeErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorMsg: error?.message || 'Instabilidade na interface de escalas.' };
  }
  componentDidCatch(err, info) {
    console.error('Crash em Escalas:', err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-2xl">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h2 className="text-lg font-black text-white">Recuperação de Interface</h2>
            <p className="text-xs text-slate-400 mt-2 mb-6">{this.state.errorMsg}</p>
            <Button onClick={() => window.location.reload()} className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold h-11">
              Recarregar Escala
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const STORAGE_BASE_PREFIX = 'hospital_escala_base_prod';
const STORAGE_SECTOR_KEY = 'escala_setor_fixado_prod';
const STORAGE_PUBLISHED_MAP_KEY = 'hospital_escalas_publicadas_map_prod';
const STORAGE_DISABLED_DAYS_KEY = 'hospital_vagas_inativadas_map_prod';

const PREVIOUS_SHIFT_DISPLAY_MINUTES = 60;
const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const WEEK_DAYS_ORDER = [
  { label: 'Segunda', index: 1, short: 'SEG' },
  { label: 'Terça', index: 2, short: 'TER' },
  { label: 'Quarta', index: 3, short: 'QUA' },
  { label: 'Quinta', index: 4, short: 'QUI' },
  { label: 'Sexta', index: 5, short: 'SEX' },
  { label: 'Sábado', index: 6, short: 'SAB', weekend: true },
  { label: 'Domingo', index: 0, short: 'DOM', weekend: true },
];

const BUILDER_COLORS = [
  { id: 'sky', value: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200' },
  { id: 'amber', value: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200' },
  { id: 'emerald', value: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200' }
];

function safeArray(val) { return Array.isArray(val) ? val : []; }
function safeNumber(val, fb = 0) {
  if (val === null || val === undefined || val === '') return fb;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : fb;
}

function normalizeDate(val) {
  if (!val) return '';
  const t = String(val).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.substring(0, 10) : t;
}

function getLocalDateString(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDayOfWeekIndex(dateStr) {
  if (!dateStr || dateStr === 'disabled') return -1;
  const parts = dateStr.split('-');
  if (parts.length < 3) return -1;
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0).getDay();
}

function toTitleCase(str) {
  return typeof str === 'string' ? str.toLowerCase().split(' ').map(w => ['de','da','do','e'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';
}

function formatDateBR(dateStr) {
  if (!dateStr) return '—';
  const parts = normalizeDate(dateStr).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(dateStr);
}

function fmtDateLong(dateStr) {
  if (!dateStr) return '';
  const parts = normalizeDate(dateStr).split('-');
  if (parts.length < 3) return '';
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
  return WEEKDAYS_LONG[d.getDay()] || '';
}

function formatCurrencyBRL(amount) {
  const safe = Math.round((safeNumber(amount) + Number.EPSILON) * 100) / 100;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safe);
}

function getShiftHours(s) {
  if (s?.duration_hours != null && Number.isFinite(Number(s.duration_hours))) return Number(s.duration_hours);
  if (s?.hours != null && Number.isFinite(Number(s.hours))) return Number(s.hours);
  if (s?.start_time && s?.end_time) {
    const [sh, sm] = String(s.start_time).split(':').map(Number);
    const [eh, em] = String(s.end_time).split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) diff += 24 * 60;
    return Math.max(0, diff / 60);
  }
  return 12;
}

function getDetailedShiftStatus(dateStr, startStr, endStr, now, explicitStatus) {
  const currentKey = String(explicitStatus || '').toLowerCase().trim();
  if (currentKey === 'cancelado' || currentKey === 'falta') return { code: 'cancelado', isFinishedRecent: false };
  if (currentKey === 'concluido' || currentKey === 'realizado') return { code: 'encerrado', isFinishedRecent: false };

  const normDate = normalizeDate(dateStr);
  if (!normDate || !startStr || !endStr) return { code: 'programado', isFinishedRecent: false };

  const [y, m, d] = normDate.split('-').map(Number);
  const [sh, sm] = String(startStr).split(':').map(Number);
  const [eh, em] = String(endStr).split(':').map(Number);

  const shiftStart = new Date(y, m - 1, d, sh, sm, 0);
  const shiftEnd = new Date(y, m - 1, d, eh, em, 0);
  if (shiftEnd <= shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1);

  const nowMs = now.getTime();
  const startMs = shiftStart.getTime();
  const endMs = shiftEnd.getTime();

  if (nowMs >= startMs && nowMs <= endMs) return { code: 'andamento', isFinishedRecent: false };
  if (nowMs < startMs) return { code: 'programado', isFinishedRecent: false };

  const minutesSinceEnd = (nowMs - endMs) / (1000 * 60);
  return { code: 'encerrado', isFinishedRecent: minutesSinceEnd >= 0 && minutesSinceEnd <= PREVIOUS_SHIFT_DISPLAY_MINUTES };
}

function getMonthWeeks(monthStr) {
  if (!monthStr || typeof monthStr !== 'string') return [];
  const parts = monthStr.split('-');
  if (parts.length < 2) return [];
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  
  const firstDay = new Date(year, month - 1, 1, 12, 0, 0);
  const lastDay = new Date(year, month, 0, 12, 0, 0);
  
  const weeks = [];
  let currentWeek = [];
  let startDay = firstDay.getDay(); 
  let emptyDays = startDay === 0 ? 6 : startDay - 1; 
  
  for (let i = 0; i < emptyDays; i++) currentWeek.push(null);
  
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = getLocalDateString(new Date(year, month - 1, d, 12, 0, 0));
    currentWeek.push(dateStr);
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

export default function Escalas() {
  return (
    <SafeErrorBoundary>
      <EscalasMain />
    </SafeErrorBoundary>
  );
}

function EscalasMain() {
  const { user, company, loading: appLoading } = useAppData() || {};
  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id || 'unit_h1';

  const [shifts, setShifts] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [viewMode, setViewMode] = useState('grade'); // 'grade', 'list', 'base_builder'
  const [selectedMonth, setSelectedMonth] = useState(() => getLocalDateString().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState('');
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const [sectorFilter, setSectorFilter] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_SECTOR_KEY) || 'todos';
    } catch { return 'todos'; }
  });

  const [profSearchQuery, setProfSearchQuery] = useState('');
  const [vacancyMenuModal, setVacancyMenuModal] = useState(null);
  const [newShiftModal, setNewShiftModal] = useState(null);
  const [dayScheduleModal, setDayScheduleModal] = useState(false);
  const [tvMode, setTvMode] = useState(false);

  // Escala Base por setor
  const [builderShifts, setBuilderShifts] = useState([]);
  const [builderModal, setBuilderModal] = useState(null);
  const [builderForm, setBuilderForm] = useState({ id: '', name: '', start: '', end: '', qty: 1, days: [1,2,3,4,5] });

  // Inativações manuais por dia e slot
  const [disabledDaysMap, setDisabledDaysMap] = useState(() => {
    try {
      const raw = window.localStorage.getItem(`${STORAGE_DISABLED_DAYS_KEY}:${companyId}`);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  const loadData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const query = companyId ? { company_id: companyId } : {};
      const [sRes, pRes, secRes] = await Promise.all([
        base44.entities.Shift.filter(query, '-date', 5000).catch(() => []),
        base44.entities.Professional.filter(query, '-created_date', 1000).catch(() => []),
        base44.entities.Sector.filter(query, 'name', 300).catch(() => [])
      ]);

      setShifts(safeArray(sRes));
      setProfessionals(safeArray(pRes));
      setSectors(safeArray(secRes));
    } catch (e) {
      console.error('Erro ao carregar escalas:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!appLoading) loadData();
  }, [appLoading, loadData]);

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const professionalMap = useMemo(() => {
    const m = {};
    professionals.forEach(p => { if (p?.id) m[p.id] = p; });
    return m;
  }, [professionals]);

  const sectorMap = useMemo(() => {
    const m = {};
    sectors.forEach(s => { if (s?.id) m[String(s.id)] = s; });
    return m;
  }, [sectors]);

  const activeSectorName = useMemo(() => {
    if (sectorFilter === 'todos') return 'Todos os Setores';
    return sectorMap[sectorFilter]?.name || 'Setor Selecionado';
  }, [sectorFilter, sectorMap]);

  // RECONSTITUIÇÃO DO MODELO BASE DO SETOR
  useEffect(() => {
    if (sectorFilter === 'todos') {
      setBuilderShifts([]);
      return;
    }

    try {
      const key = `${STORAGE_BASE_PREFIX}:${companyId}:${sectorFilter}`;
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBuilderShifts(parsed);
          return;
        }
      }
    } catch (e) {}

    // Auto-discovery de turnos existentes no banco do setor
    const sectorShifts = shifts.filter(s => String(s.sector_id) === String(sectorFilter) && s.status !== 'cancelado');
    if (sectorShifts.length > 0) {
      const slotMap = new Map();
      sectorShifts.forEach(s => {
        if (!s.start_time || !s.end_time) return;
        const slotKey = `${s.start_time}-${s.end_time}`;
        const dayIdx = getDayOfWeekIndex(s.date);

        if (!slotMap.has(slotKey)) {
          let name = 'Turno';
          if (s.start_time >= '06:00' && s.start_time < '13:00') name = 'Diurno';
          else if (s.start_time >= '13:00' && s.start_time < '19:00') name = 'Tarde';
          else name = 'Noturno';

          slotMap.set(slotKey, {
            id: `bld_${slotKey.replace(':', '')}`,
            name,
            start: s.start_time,
            end: s.end_time,
            qty: 1,
            cellStates: { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false }
          });
        }

        if (dayIdx >= 0 && dayIdx <= 6) {
          slotMap.get(slotKey).cellStates[dayIdx] = true;
        }
      });

      const discovered = Array.from(slotMap.values());
      setBuilderShifts(discovered);
      return;
    }

    setBuilderShifts([]);
  }, [sectorFilter, companyId, shifts]);

  const persistBuilder = (newShifts) => {
    setBuilderShifts(newShifts);
    if (sectorFilter !== 'todos') {
      try {
        window.localStorage.setItem(`${STORAGE_BASE_PREFIX}:${companyId}:${sectorFilter}`, JSON.stringify(newShifts));
      } catch (e) {}
    }
  };

  // FILTRAGEM ROBUSTA DE PLANTÕES
  const filteredShifts = useMemo(() => {
    return shifts.filter(s => {
      if (!s || s.status === 'cancelado') return false;
      const sDate = normalizeDate(s.date);
      if (!sDate) return false;

      if (viewMode === 'list' && selectedDate) {
        if (sDate !== selectedDate) return false;
      } else {
        if (selectedMonth && !sDate.startsWith(selectedMonth)) return false;
      }

      if (sectorFilter !== 'todos' && String(s.sector_id) !== String(sectorFilter)) return false;
      return true;
    }).map(s => {
      const pName = String(s.professional_name || '').toLowerCase();
      const isVacant = !s.professional_id || pName.includes('vaga') || s.status === 'disponivel' || s.status === 'aberto';
      const timeInfo = getDetailedShiftStatus(s.date, s.start_time, s.end_time, currentTime, s.status);
      return {
        ...s,
        rTimeStatus: timeInfo.code,
        isFinishedRecent: timeInfo.isFinishedRecent,
        isVacant
      };
    }).sort((a, b) => {
      if (a.date !== b.date) return String(a.date).localeCompare(String(b.date));
      return String(a.start_time || '').localeCompare(String(b.start_time || ''));
    });
  }, [shifts, viewMode, selectedDate, selectedMonth, sectorFilter, currentTime]);

  // TURNOS DA GRADE (CONSOLIDA TODOS OS SETORES OU O SETOR ATIVO)
  const displayShiftSlots = useMemo(() => {
    if (sectorFilter === 'todos') {
      const uniqueSlots = new Map();
      filteredShifts.forEach(s => {
        if (!s.start_time || !s.end_time) return;
        const key = `${s.start_time}-${s.end_time}`;
        if (!uniqueSlots.has(key)) {
          uniqueSlots.set(key, {
            id: `slot_${key}`,
            name: `${s.start_time} às ${s.end_time}`,
            start: s.start_time,
            end: s.end_time,
            qty: 1,
            cellStates: { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true }
          });
        }
      });
      return Array.from(uniqueSlots.values()).sort((a, b) => a.start.localeCompare(b.start));
    }

    if (builderShifts.length > 0) return builderShifts;

    // Fallback se o setor ainda não tiver turnos definidos
    return [
      { id: 'def_diurno', name: 'Diurno (07:00 às 19:00)', start: '07:00', end: '19:00', qty: 1, cellStates: { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true } },
      { id: 'def_noturno', name: 'Noturno (19:00 às 07:00)', start: '19:00', end: '07:00', qty: 1, cellStates: { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true } }
    ];
  }, [sectorFilter, builderShifts, filteredShifts]);

  const weeksDataGrid = useMemo(() => getMonthWeeks(selectedMonth), [selectedMonth]);

  const sidebarProfessionals = useMemo(() => {
    const term = profSearchQuery.toLowerCase().trim();
    return professionals.filter(p => {
      if (!p?.id || p.status === 'inativo') return false;
      return !term || p.name?.toLowerCase().includes(term) || p.specialty?.toLowerCase().includes(term);
    });
  }, [professionals, profSearchQuery]);

  // CÁLCULO FINANCEIRO EXATO E PERSISTÊNCIA DA ALOCAÇÃO
  const handleAssignDoctor = async (date, slot, profId, reason = '') => {
    try {
      const prof = professionalMap[profId];
      if (!prof) throw new Error('Profissional não localizado.');

      const targetSecId = sectorFilter !== 'todos' ? sectorFilter : (sectors[0]?.id || 'sec_geral');
      const secObj = sectors.find(s => String(s.id) === String(targetSecId)) || { id: targetSecId, name: 'Geral' };

      // Calcula a remuneração exata segundo o contrato do médico
      const hours = getShiftHours({ start_time: slot.start, end_time: slot.end });
      const remType = String(prof.remuneration_type || 'hora').toLowerCase().trim();

      let rate = safeNumber(prof.hourly_rate, 120);
      let calculatedTotal = 0;

      if (remType === 'diaria') {
        rate = safeNumber(prof.daily_rate, 1500);
        calculatedTotal = rate;
      } else if (remType === 'mensal') {
        const monthly = safeNumber(prof.monthly_salary, 18000);
        const workHours = safeNumber(prof.monthly_work_hours, 220);
        rate = workHours > 0 ? monthly / workHours : 80;
        calculatedTotal = Math.round((rate * hours) * 100) / 100;
      } else {
        calculatedTotal = Math.round((rate * hours) * 100) / 100;
      }

      // Procura se já existe um shift vago nessa célula
      let existingShift = filteredShifts.find(s => 
        normalizeDate(s.date) === date && 
        s.start_time === slot.start && 
        s.end_time === slot.end && 
        String(s.sector_id) === String(secObj.id) &&
        s.isVacant
      );

      const shiftPayload = {
        company_id: companyId,
        unit_id: unitId,
        sector_id: secObj.id,
        sector_name: secObj.name,
        date: date,
        start_time: slot.start,
        end_time: slot.end,
        duration_hours: hours,
        hours: hours,
        hourly_rate: rate,
        rate: rate,
        total_amount: calculatedTotal,
        professional_id: prof.id,
        professional_name: prof.name,
        status: 'confirmado',
        notes: [
          `Turno: ${slot.name || 'Plantão'}`,
          prof.registration_code ? `Matrícula: ${prof.registration_code}` : null,
          reason ? `Obs: ${reason}` : null
        ].filter(Boolean).join(' | ')
      };

      let savedShiftId = existingShift?.id;

      if (existingShift?.id) {
        await base44.entities.Shift.update(existingShift.id, shiftPayload);
      } else {
        const created = await base44.entities.Shift.create(shiftPayload);
        savedShiftId = created?.id;
      }

      // Cria solicitação correspondente em ShiftSwap para rastreabilidade
      if (base44.entities.ShiftSwap?.create) {
        await base44.entities.ShiftSwap.create({
          company_id: companyId,
          unit_id: unitId,
          shift_id: savedShiftId,
          shift_date: date,
          shift_time: `${slot.start} - ${slot.end}`,
          sector_name: secObj.name,
          requester_name: 'Coordenação Médica',
          target_professional_id: prof.id,
          target_name: prof.name,
          target_specialty: prof.specialty || 'Clínica Médica',
          swap_type: 'alocacao_manual',
          source_type: 'alocacao_manual',
          request_type: 'convite_alocacao',
          status: 'aprovada',
          confirmation_status: 'confirmada',
          approval_status: 'homologada'
        }).catch(() => {});
      }

      setNewShiftModal(null);
      setVacancyMenuModal(null);
      await loadData(true);
      alert(`Dr(a). ${prof.name} alocado(a) com sucesso!`);
    } catch (e) {
      alert('Erro ao alocar médico: ' + e.message);
    }
  };

  // ENVIA AO MURAL DE OPORTUNIDADES E REFLETE EM TROCAS
  const handleSendToMural = async (date, slot) => {
    try {
      const targetSecId = sectorFilter !== 'todos' ? sectorFilter : (sectors[0]?.id || 'sec_geral');
      const secObj = sectors.find(s => String(s.id) === String(targetSecId)) || { id: targetSecId, name: 'Geral' };

      const hours = getShiftHours({ start_time: slot.start, end_time: slot.end });
      const defaultRate = 120;
      const estimatedTotal = Math.round((defaultRate * hours) * 100) / 100;

      let existingShift = filteredShifts.find(s => 
        normalizeDate(s.date) === date && 
        s.start_time === slot.start && 
        s.end_time === slot.end && 
        String(s.sector_id) === String(secObj.id)
      );

      const shiftPayload = {
        company_id: companyId,
        unit_id: unitId,
        sector_id: secObj.id,
        sector_name: secObj.name,
        date: date,
        start_time: slot.start,
        end_time: slot.end,
        duration_hours: hours,
        hours: hours,
        hourly_rate: defaultRate,
        rate: defaultRate,
        total_amount: estimatedTotal,
        professional_id: null,
        professional_name: 'Vaga Aberta',
        status: 'disponivel',
        notes: `Disponível no Mural de Oportunidades • Turno: ${slot.name || 'Geral'}`
      };

      let savedShiftId = existingShift?.id;

      if (existingShift?.id) {
        await base44.entities.Shift.update(existingShift.id, shiftPayload);
      } else {
        const created = await base44.entities.Shift.create(shiftPayload);
        savedShiftId = created?.id;
      }

      // Grava no ShiftSwap para aparecer no Mural em Trocas.jsx
      if (base44.entities.ShiftSwap?.create) {
        await base44.entities.ShiftSwap.create({
          company_id: companyId,
          unit_id: unitId,
          shift_id: savedShiftId,
          shift_date: date,
          shift_time: `${slot.start} - ${slot.end}`,
          sector_name: secObj.name,
          requester_name: 'Coordenação Hospitalar',
          target_name: 'Mural de Oportunidades',
          swap_type: 'mural',
          source_type: 'mural',
          request_type: 'mural',
          status: 'pendente',
          confirmation_status: 'aberto'
        });
      }

      setVacancyMenuModal(null);
      await loadData(true);
      alert('Vaga disponibilizada no Mural de Oportunidades com sucesso!');
    } catch (e) {
      alert('Erro ao enviar vaga ao mural: ' + e.message);
    }
  };

  const handleToggleDayInactive = (date, slotId) => {
    const key = `${date}:${slotId}`;
    const nextMap = { ...disabledDaysMap, [key]: !disabledDaysMap[key] };
    setDisabledDaysMap(nextMap);
    try {
      window.localStorage.setItem(`${STORAGE_DISABLED_DAYS_KEY}:${companyId}`, JSON.stringify(nextMap));
    } catch (e) {}
    setVacancyMenuModal(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja cancelar este plantão?')) return;
    try {
      await base44.entities.Shift.update(id, { status: 'cancelado' });
      await loadData(true);
    } catch (e) {
      alert('Erro ao cancelar.');
    }
  };

  // PREVIEW DA ESCALA DO DIA
  const todayTarget = selectedDate || getLocalDateString(currentTime);
  const shiftsForDayModal = useMemo(() => {
    return shifts.filter(s => normalizeDate(s.date) === todayTarget && s.status !== 'cancelado');
  }, [shifts, todayTarget]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      
      {/* CABEÇALHO */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3 px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-md shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">Escala Hospitalar</h1>
              <span className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-[11px] font-black px-2.5 py-0.5 rounded-full">
                {activeSectorName}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
              <span>{fmtDateLong(getLocalDateString(currentTime))} • {formatDateBR(getLocalDateString(currentTime))}</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{currentTime.toLocaleTimeString('pt-BR')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Abas */}
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setViewMode('grade')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'grade' ? 'bg-white dark:bg-slate-800 text-sky-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              Grade Mensal
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'list' ? 'bg-white dark:bg-slate-800 text-sky-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              Lista Diária
            </button>
            <button
              onClick={() => setViewMode('base_builder')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'base_builder' ? 'bg-white dark:bg-slate-800 text-sky-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              Modelo Base
            </button>
          </div>

          <Button variant="outline" onClick={() => loadData(true)} className="h-9 text-xs gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
          </Button>

          <Button onClick={() => setDayScheduleModal(true)} variant="outline" className="h-9 text-xs font-bold border-sky-300 text-sky-600">
            <FileText className="w-3.5 h-3.5 mr-1" /> Escala do Dia
          </Button>
        </div>
      </header>

      {/* SUB-HEADER: FILTRO DE MÊS E SETOR */}
      {viewMode !== 'base_builder' && (
        <div className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 p-2.5 px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-300 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 px-1">MÊS:</span>
              <Input 
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="h-7 w-36 text-xs font-bold border-0 bg-transparent shadow-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-slate-400">Setor:</span>
              <Select value={sectorFilter} onValueChange={setSectorFilter}>
                <SelectTrigger className="h-8 w-52 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 font-bold text-sky-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os setores</SelectItem>
                  {sectors.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-bold">
            Total no mês: {filteredShifts.length} plantões
          </div>
        </div>
      )}

      {/* GRADE MENSAL */}
      {viewMode === 'grade' && (
        <div className="flex-1 flex overflow-hidden p-2 sm:p-4 pb-4">
          <Card className="flex-1 border-slate-200 dark:border-slate-800 shadow-sm flex overflow-hidden bg-white dark:bg-slate-900">
            
            {/* CORPO CLÍNICO LATERAL */}
            <div className="w-64 sm:w-72 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-xs flex items-center gap-1.5">
                    <UsersRound className="w-3.5 h-3.5 text-sky-600" /> Médicos Disponíveis
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">{sidebarProfessionals.length}</span>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                  <Input 
                    placeholder="Buscar médico..." 
                    value={profSearchQuery} 
                    onChange={e => setProfSearchQuery(e.target.value)} 
                    className="pl-8 h-7 text-xs bg-white dark:bg-slate-900" 
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {sidebarProfessionals.map(prof => (
                  <div 
                    key={prof.id} 
                    draggable 
                    onDragStart={(e) => e.dataTransfer.setData('profId', prof.id)} 
                    className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500 rounded-xl shadow-sm cursor-grab active:cursor-grabbing flex items-center gap-2"
                  >
                    <GripVertical className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <strong className="font-bold text-xs text-slate-900 dark:text-slate-100 block truncate">{prof.name}</strong>
                      <span className="text-[10px] text-slate-500 block truncate">{prof.specialty || 'Clínico Geral'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TABELA DE CALENDÁRIO */}
            <div className="flex-1 overflow-auto bg-slate-50/30 dark:bg-slate-950">
              <div className="min-w-[900px]">
                <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
                  <div className="p-3 border-r border-slate-200 dark:border-slate-800 text-center font-black text-xs text-slate-500 uppercase">Turno</div>
                  {WEEK_DAYS_ORDER.map(day => (
                    <div key={day.index} className={`p-3 border-r border-slate-200 dark:border-slate-800 text-center font-bold text-xs uppercase ${day.weekend ? 'text-amber-500' : 'text-slate-700 dark:text-slate-300'}`}>
                      {day.label}
                    </div>
                  ))}
                </div>

                {weeksDataGrid.map((week, wIndex) => (
                  <div key={wIndex} className="border-b-[4px] border-slate-200 dark:border-slate-900">
                    <div className="grid grid-cols-8 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
                      <div className="p-1 border-r border-slate-200 dark:border-slate-800"></div>
                      {week.map((date, dIndex) => (
                        <div key={dIndex} className={`p-1 border-r border-slate-200 dark:border-slate-800 text-right pr-2 text-[10px] font-black ${date ? 'text-slate-500' : 'text-transparent'}`}>
                          {date ? `${date.split('-')[2]}/${date.split('-')[1]}` : '-'}
                        </div>
                      ))}
                    </div>

                    {displayShiftSlots.map((slot) => (
                      <div key={slot.id} className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-800/80">
                        <div className="p-3 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col items-center justify-center text-center">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{slot.name}</span>
                          <span className="text-[10px] text-sky-600 font-mono">{slot.start} - {slot.end}</span>
                        </div>

                        {week.map((date, dIndex) => {
                          if (!date) return <div key={dIndex} className="bg-slate-100/40 dark:bg-slate-950/40 border-r border-slate-200 dark:border-slate-800" />;

                          const slotShifts = filteredShifts.filter(s => 
                            normalizeDate(s.date) === date && 
                            s.start_time === slot.start && 
                            s.end_time === slot.end
                          );

                          const isInactiveDay = Boolean(disabledDaysMap[`${date}:${slot.id}`]);

                          return (
                            <div
                              key={dIndex}
                              className={`border-r border-slate-200 dark:border-slate-800 p-1.5 min-h-[85px] relative transition-colors cursor-pointer flex flex-col gap-1.5 ${
                                isInactiveDay ? 'bg-slate-100/80 dark:bg-slate-900/80' : 'hover:bg-slate-100/60 dark:hover:bg-slate-900/50'
                              }`}
                              onDragOver={e => e.preventDefault()}
                              onDrop={e => {
                                e.preventDefault();
                                const profId = e.dataTransfer.getData('profId');
                                if (profId) handleAssignDoctor(date, slot, profId);
                              }}
                              onClick={() => setVacancyMenuModal({ date, slot, existingShifts: slotShifts })}
                            >
                              {slotShifts.length === 0 && (
                                <div className="absolute inset-0 flex items-center justify-center opacity-30 text-xs font-black text-slate-400">
                                  {isInactiveDay ? 'INATIVO' : '+ Vaga'}
                                </div>
                              )}

                              {slotShifts.map(s => (
                                <div key={s.id} className="p-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
                                  <div>
                                    <strong className={`block truncate ${s.isVacant ? 'text-amber-500' : 'text-slate-900 dark:text-white'}`}>
                                      {s.isVacant ? 'Vaga Aberta' : toTitleCase(s.professional_name)}
                                    </strong>
                                    {sectorFilter === 'todos' && s.sector_name && (
                                      <span className="text-[9px] text-sky-600 font-bold block truncate">{s.sector_name}</span>
                                    )}
                                  </div>
                                  <div className="text-[9px] font-bold text-slate-400 mt-1 flex items-center justify-between">
                                    <span>{s.start_time} - {s.end_time}</span>
                                    <span className={s.isVacant ? 'text-amber-500' : 'text-emerald-500'}>
                                      {s.isVacant ? 'Aberta' : 'Confirmado'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* LISTA DIÁRIA */}
      {viewMode === 'list' && (
        <div className="overflow-y-auto p-4 sm:px-8 space-y-3 flex-1">
          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Plantões de {selectedMonth} {selectedDate && `(Dia: ${formatDateBR(selectedDate)})`}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Filtrar por data:</span>
              <Input 
                type="date" 
                value={selectedDate} 
                onChange={e => setSelectedDate(e.target.value)} 
                className="h-8 w-36 text-xs bg-slate-50 dark:bg-slate-950" 
              />
              {selectedDate && (
                <Button size="sm" variant="ghost" onClick={() => setSelectedDate('')} className="h-8 text-xs text-sky-600">
                  Ver mês todo
                </Button>
              )}
            </div>
          </div>

          {filteredShifts.length === 0 ? (
            <div className="py-16 text-center text-slate-400">Nenhum plantão localizado para o filtro.</div>
          ) : (
            filteredShifts.map(s => {
              const hasDoctor = Boolean(s.professional_id) && !s.isVacant;
              const profName = hasDoctor ? toTitleCase(s.professional_name) : 'Vaga Aberta';

              return (
                <div key={s.id} className={`flex items-center gap-4 rounded-2xl border p-4 bg-white dark:bg-slate-900 transition-colors shadow-sm ${
                  !hasDoctor ? 'border-amber-300 bg-amber-50/20 dark:bg-amber-950/10' : 'border-slate-200 dark:border-slate-800'
                }`}>
                  <div className="min-w-[110px] rounded-xl py-2 text-center text-xs font-black border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0">
                    {formatDateBR(s.date)} <br/>
                    <span className="font-mono text-xs text-slate-400">{s.start_time} às {s.end_time}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <strong className={`block text-base truncate ${!hasDoctor ? 'text-amber-500' : 'text-slate-900 dark:text-white'}`}>
                      {profName}
                    </strong>
                    <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3" /> {s.sector_name || 'Geral'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrencyBRL(s.total_amount)}
                    </span>
                    {s.isVacant && (
                      <Button size="sm" onClick={() => setNewShiftModal({ date: s.date, slot: { start: s.start_time, end: s.end_time } })} className="bg-sky-600 text-white text-xs h-8">
                        Alocar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODELO BASE */}
      {viewMode === 'base_builder' && (
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-6 flex justify-center">
          <div className="w-full max-w-5xl space-y-6">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Selecione o Setor do Modelo Base:</h3>
                <p className="text-xs text-slate-400">Ajuste os horários e quantidade de vagas padrão por dia da semana.</p>
              </div>
              <Select value={sectorFilter} onValueChange={setSectorFilter}>
                <SelectTrigger className="h-10 w-72 text-xs font-bold bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-sky-600">
                  <SelectValue placeholder="Selecione um setor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" disabled>Selecione um setor específico...</SelectItem>
                  {sectors.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {sectorFilter === 'todos' ? (
              <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
                <Building2 className="w-12 h-12 text-sky-500 mx-auto mb-3 opacity-60" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">Nenhum setor selecionado</h3>
                <p className="text-xs text-slate-400 mt-1">Selecione um setor no menu acima para configurar o Modelo Base.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-4 space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="font-bold text-sm">Turnos Cadastrados em {activeSectorName}</h3>
                  <Button 
                    onClick={() => {
                      setBuilderForm({ id: '', name: '', start: '07:00', end: '19:00', qty: 1, days: [1,2,3,4,5] });
                      setBuilderModal({ isNew: true });
                    }} 
                    className="bg-sky-600 text-white text-xs h-8"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Turno
                  </Button>
                </div>

                <div className="space-y-2">
                  {builderShifts.map(b => (
                    <div key={b.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <strong>{b.name}</strong> ({b.start} às {b.end})
                        <div className="text-[10px] text-slate-400 mt-0.5">Vagas padrão: {b.qty}</div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => {
                          persistBuilder(builderShifts.filter(x => x.id !== b.id));
                        }} 
                        className="text-rose-500 text-xs h-8"
                      >
                        Excluir
                      </Button>
                    </div>
                  ))}
                  {builderShifts.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-6">Nenhum turno configurado neste setor.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: MENU DE AÇÃO DA VAGA */}
      {vacancyMenuModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Opções da Vaga</h3>
                <p className="text-xs text-slate-400">{formatDateBR(vacancyMenuModal.date)} • {vacancyMenuModal.slot.start} às {vacancyMenuModal.slot.end}</p>
              </div>
              <button onClick={() => setVacancyMenuModal(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => {
                  setNewShiftModal({ date: vacancyMenuModal.date, slot: vacancyMenuModal.slot });
                  setVacancyMenuModal(null);
                }}
                className="w-full p-3.5 rounded-2xl border border-sky-500/30 bg-sky-50 dark:bg-sky-950/30 text-left flex items-center gap-3"
              >
                <UserPlus className="w-5 h-5 text-sky-600" />
                <div>
                  <div className="font-bold text-xs text-sky-900 dark:text-sky-200">Alocar Plantonista</div>
                  <div className="text-[11px] text-sky-700 dark:text-sky-400">Escala o médico diretamente na vaga</div>
                </div>
              </button>

              <button
                onClick={() => handleSendToMural(vacancyMenuModal.date, vacancyMenuModal.slot)}
                className="w-full p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 text-left flex items-center gap-3"
              >
                <Megaphone className="w-5 h-5 text-emerald-600" />
                <div>
                  <div className="font-bold text-xs text-emerald-900 dark:text-emerald-200">Mural de Oportunidades</div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400">Disponibiliza no mural para os médicos</div>
                </div>
              </button>

              <button
                onClick={() => handleToggleDayInactive(vacancyMenuModal.date, vacancyMenuModal.slot.id)}
                className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-left flex items-center gap-3"
              >
                <Ban className="w-5 h-5 text-slate-500" />
                <div>
                  <div className="font-bold text-xs text-slate-800 dark:text-slate-200">Inativar / Ativar Vaga</div>
                  <div className="text-[11px] text-slate-400">Desliga ou restabelece o turno nesta data</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ALOCAÇÃO DE MÉDICO */}
      {newShiftModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-black text-slate-900 dark:text-white">Alocar Plantonista</h3>
              <button onClick={() => setNewShiftModal(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Profissional:</label>
                <Select onValueChange={(profId) => handleAssignDoctor(newShiftModal.date, newShiftModal.slot, profId)}>
                  <SelectTrigger className="h-10 text-xs font-semibold">
                    <SelectValue placeholder="Selecione o médico ativo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sidebarProfessionals.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.specialty || 'Geral'})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <div><span className="text-slate-500">Data:</span> <strong>{formatDateBR(newShiftModal.date)}</strong></div>
                <div><span className="text-slate-500">Horário:</span> <strong>{newShiftModal.slot.start} às {newShiftModal.slot.end}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW DA ESCALA DO DIA (BLINDADO CONTRA CRASH) */}
      {dayScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-sky-600" /> Escala do Dia ({formatDateBR(todayTarget)})
                </h2>
                <p className="text-xs text-slate-500">{shiftsForDayModal.length} plantões cadastrados para esta data</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => window.print()} className="bg-sky-600 text-white text-xs h-9 gap-1.5">
                  <Printer className="w-4 h-4" /> Imprimir A4
                </Button>
                <button onClick={() => setDayScheduleModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {shiftsForDayModal.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">Nenhum plantão ativo para esta data.</div>
              ) : (
                shiftsForDayModal.map(s => (
                  <div key={s.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs">
                    <div>
                      <strong className="block text-slate-900 dark:text-white">{s.professional_name || 'Vaga Aberta'}</strong>
                      <span className="text-[10px] text-slate-500">{s.sector_name} • {s.start_time} às {s.end_time}</span>
                    </div>
                    <span className="font-bold text-emerald-600">{formatCurrencyBRL(s.total_amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}