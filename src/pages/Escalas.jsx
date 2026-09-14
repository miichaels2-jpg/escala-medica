import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  GripVertical,
  LayoutDashboard,
  LayoutGrid,
  List,
  Loader2,
  Menu,
  Moon,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

/* ============================================================
   CENTRAL DE INTELIGÊNCIA HOSPITALAR / ESCALAS
   Versão defensiva: sem horários pré-preenchidos e sem estados
   obrigatórios que possam derrubar a tela.
============================================================ */

const STORAGE_KEY = 'hospital-escala-base-v4';

const WEEK_DAYS = [
  { index: 1, label: 'Segunda', short: 'SEG' },
  { index: 2, label: 'Terça', short: 'TER' },
  { index: 3, label: 'Quarta', short: 'QUA' },
  { index: 4, label: 'Quinta', short: 'QUI' },
  { index: 5, label: 'Sexta', short: 'SEX' },
  { index: 6, label: 'Sábado', short: 'SAB', weekend: true },
  { index: 0, label: 'Domingo', short: 'DOM', weekend: true },
];

const COLORS = [
  { id: 'sky', label: 'Azul', dot: 'bg-sky-500', cell: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/30 dark:text-sky-200 dark:border-sky-800' },
  { id: 'amber', label: 'Âmbar', dot: 'bg-amber-500', cell: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800' },
  { id: 'indigo', label: 'Índigo', dot: 'bg-indigo-500', cell: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-200 dark:border-indigo-800' },
  { id: 'emerald', label: 'Verde', dot: 'bg-emerald-500', cell: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-800' },
  { id: 'rose', label: 'Rosa', dot: 'bg-rose-500', cell: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/30 dark:text-rose-200 dark:border-rose-800' },
  { id: 'purple', label: 'Roxo', dot: 'bg-purple-500', cell: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/30 dark:text-purple-200 dark:border-purple-800' },
];

const REPORTS = {
  executiva: { label: 'Visão Executiva', icon: LayoutDashboard },
  produtividade: { label: 'Produtividade & Horas', icon: Clock3 },
  cobertura: { label: 'Cobertura Operacional', icon: Building2 },
  risco: { label: 'Risco Assistencial', icon: ShieldCheck },
  financeiro: { label: 'Financeiro & Custos', icon: BarChart3 },
  auditoria: { label: 'Auditoria & LGPD', icon: ClipboardCheck },
};

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDate(value) {
  if (!value) return '';
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [d, m, y] = text.split('/');
    return `${y}-${m}-${d}`;
  }
  return text.slice(0, 10);
}

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function monthString(date = new Date()) {
  return localDateString(date).slice(0, 7);
}

function formatDateBR(value) {
  const date = normalizeDate(value);
  if (!date) return '—';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

function formatCurrency(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Não informado';
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatHours(value) {
  return `${safeNumber(value).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h`;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getShiftHours(shift) {
  if (shift?.duration_hours != null) return safeNumber(shift.duration_hours);
  if (shift?.hours != null) return safeNumber(shift.hours);
  const start = String(shift?.start_time || '');
  const end = String(shift?.end_time || '');
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;
  return minutes / 60;
}

function getProfessionalId(shift) {
  return shift?.professional_id || shift?.professionalId || shift?.professional?.id || null;
}

function getProfessionalName(shift, map = {}) {
  if (shift?.professional_name) return shift.professional_name;
  const id = getProfessionalId(shift);
  const p = id ? map[id] : null;
  return p?.name || p?.full_name || p?.nome || p?.email || 'Vaga';
}

function getSectorName(shift, map = {}) {
  if (shift?.sector_name) return shift.sector_name;
  const s = shift?.sector_id ? map[shift.sector_id] : null;
  return s?.name || s?.nome || s?.title || 'Setor';
}

function getStatus(shift) {
  return String(shift?.status || 'aberto').toLowerCase();
}

function getOperationalStatus(shift) {
  const raw = getStatus(shift);
  if (raw === 'cancelado' || raw === 'canceled') return 'cancelado';
  if (['finalizado', 'finalizada', 'concluido', 'concluida', 'completed', 'realizado', 'realizada'].includes(raw)) return 'realizado';
  const date = normalizeDate(shift?.date);
  const today = localDateString();
  if (date && date < today) return 'realizado';
  if (date === today) return 'em_andamento';
  return 'planejado';
}

function statusLabel(status) {
  return ({
    realizado: 'Realizado',
    em_andamento: 'Em andamento',
    planejado: 'Planejado',
    cancelado: 'Cancelado',
  })[status] || 'Planejado';
}

function statusClass(status) {
  return ({
    realizado: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    em_andamento: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    planejado: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200',
    cancelado: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-200',
  })[status] || 'bg-slate-100 text-slate-700';
}

function isAssignedShift(shift) {
  return Boolean(getProfessionalId(shift)) && !normalizeText(shift?.professional_name).includes('vaga');
}

function colorById(id) {
  return COLORS.find((c) => c.id === id) || COLORS[0];
}

function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyBuilderShift() {
  return {
    id: '',
    name: '',
    start: '',
    end: '',
    defaultQty: 1,
    color: 'sky',
    days: { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false },
    dayQty: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 },
  };
}

function normalizeBuilderShift(raw) {
  const base = emptyBuilderShift();
  const days = { ...base.days, ...(raw?.days || raw?.activeDays || {}) };
  const dayQty = { ...base.dayQty, ...(raw?.dayQty || {}) };
  Object.keys(dayQty).forEach((key) => {
    dayQty[key] = Math.max(1, Math.floor(safeNumber(dayQty[key], safeNumber(raw?.defaultQty, 1))));
  });
  return {
    ...base,
    ...raw,
    id: String(raw?.id || createId('shift')),
    name: String(raw?.name || '').trim(),
    start: String(raw?.start || ''),
    end: String(raw?.end || ''),
    defaultQty: Math.max(1, Math.floor(safeNumber(raw?.defaultQty ?? raw?.qty, 1))),
    color: colorById(raw?.color).id,
    days,
    dayQty,
  };
}

function normalizeBuilderData(raw) {
  if (!raw || typeof raw !== 'object') return { scaleName: '', startDate: '', shifts: [] };
  return {
    scaleName: String(raw.scaleName || ''),
    startDate: normalizeDate(raw.startDate),
    shifts: safeArray(raw.shifts).map(normalizeBuilderShift),
  };
}

function getMonthDates(month) {
  const [year, monthNumber] = String(month || '').split('-').map(Number);
  if (!year || !monthNumber) return [];
  const total = new Date(year, monthNumber, 0).getDate();
  return Array.from({ length: total }, (_, i) => `${year}-${String(monthNumber).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);
}

function getWeekDayIndex(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.getDay();
}

function shiftMatchesBuilder(shift, builderShift, date) {
  if (!shift || !builderShift || normalizeDate(shift.date) !== normalizeDate(date)) return false;
  return String(shift.start_time || '') === String(builderShift.start || '') && String(shift.end_time || '') === String(builderShift.end || '');
}

function downloadCSV(rows, filename) {
  const csv = rows.map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function CentralInteligenciaHospitalar() {
  const { user, company, loading: appLoading } = useAppData() || {};

  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id || 'unit_principal';

  const [shifts, setShifts] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [viewMode, setViewMode] = useState('grade');
  const [activeReport, setActiveReport] = useState('executiva');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState('light');

  const [selectedMonth, setSelectedMonth] = useState(monthString());
  const [sectorId, setSectorId] = useState('todos');
  const [professionalSearch, setProfessionalSearch] = useState('');
  const [selectedCells, setSelectedCells] = useState([]);

  const [builder, setBuilder] = useState({ scaleName: '', startDate: '', shifts: [] });
  const [builderLoaded, setBuilderLoaded] = useState(false);
  const [builderModal, setBuilderModal] = useState(null);
  const [builderForm, setBuilderForm] = useState(emptyBuilderShift());
  const [builderHover, setBuilderHover] = useState(null);
  const [builderSaved, setBuilderSaved] = useState(false);

  const [allocationModal, setAllocationModal] = useState(null);
  const [allocationSearch, setAllocationSearch] = useState('');
  const [isPublished, setIsPublished] = useState(false);

  const [reportStatus, setReportStatus] = useState('Rascunho');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [auditEvents, setAuditEvents] = useState([]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('hospital-intelligence-theme');
      const preferred = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      setTheme(saved === 'dark' || saved === 'light' ? saved : preferred);
    } catch {
      setTheme('light');
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    try { window.localStorage.setItem('hospital-intelligence-theme', theme); } catch {}
  }, [theme]);

  const loadData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const query = { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) };
      const entity = base44?.entities || {};

      const call = async (name, fallback = []) => {
        try {
          const e = entity[name];
          if (!e) return fallback;
          if (typeof e.filter === 'function') {
            const result = await e.filter(query, '-date', 3000);
            return Array.isArray(result) ? result : safeArray(result?.data);
          }
          if (typeof e.list === 'function') {
            const result = await e.list();
            return Array.isArray(result) ? result : safeArray(result?.data);
          }
        } catch (err) {
          console.warn(`Falha ao carregar ${name}`, err);
        }
        return fallback;
      };

      const [loadedShifts, loadedProfessionals, loadedSectors] = await Promise.all([
        call('Shift'),
        call('Professional'),
        call('Sector'),
      ]);

      setShifts(safeArray(loadedShifts));
      setProfessionals(safeArray(loadedProfessionals));
      setSectors(safeArray(loadedSectors));
    } catch (err) {
      console.error(err);
      setError('Não foi possível carregar os dados da operação.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, unitId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    try {
      const key = `${STORAGE_KEY}:${companyId}:${unitId}`;
      const raw = window.localStorage.getItem(key);
      setBuilder(normalizeBuilderData(raw ? JSON.parse(raw) : null));
    } catch (err) {
      console.warn('Não foi possível ler a escala base salva.', err);
      setBuilder({ scaleName: '', startDate: '', shifts: [] });
    } finally {
      setBuilderLoaded(true);
    }
  }, [companyId, unitId]);

  const persistBuilder = useCallback((nextBuilder) => {
    const normalized = normalizeBuilderData(nextBuilder);
    setBuilder(normalized);
    try {
      const key = `${STORAGE_KEY}:${companyId}:${unitId}`;
      window.localStorage.setItem(key, JSON.stringify(normalized));
    } catch (err) {
      console.warn('Não foi possível persistir a escala base.', err);
    }
    return normalized;
  }, [companyId, unitId]);

  const professionalMap = useMemo(() => {
    const map = {};
    safeArray(professionals).forEach((p) => { if (p?.id) map[p.id] = p; });
    return map;
  }, [professionals]);

  const sectorMap = useMemo(() => {
    const map = {};
    safeArray(sectors).forEach((s) => { if (s?.id) map[s.id] = s; });
    return map;
  }, [sectors]);

  const selectedSector = useMemo(() => {
    return safeArray(sectors).find((s) => String(s?.id) === String(sectorId)) || null;
  }, [sectors, sectorId]);

  const filteredShifts = useMemo(() => {
    return safeArray(shifts)
      .filter((shift) => {
        const date = normalizeDate(shift?.date);
        if (!date || !date.startsWith(selectedMonth)) return false;
        if (sectorId !== 'todos' && String(shift?.sector_id) !== String(sectorId)) return false;
        return true;
      })
      .sort((a, b) => {
        const dateCompare = normalizeDate(a?.date).localeCompare(normalizeDate(b?.date));
        if (dateCompare !== 0) return dateCompare;
        return String(a?.start_time || '').localeCompare(String(b?.start_time || ''));
      });
  }, [shifts, selectedMonth, sectorId]);

  const sidebarProfessionals = useMemo(() => {
    const term = normalizeText(professionalSearch);
    return safeArray(professionals).filter((p) => {
      if (!p?.id) return false;
      if (!term) return true;
      return normalizeText(p?.name).includes(term) || normalizeText(p?.specialty).includes(term) || normalizeText(p?.profession).includes(term);
    });
  }, [professionals, professionalSearch]);

  const activeBuilderShifts = useMemo(() => {
    return safeArray(builder.shifts).slice().sort((a, b) => String(a.start).localeCompare(String(b.start)));
  }, [builder.shifts]);

  const monthDates = useMemo(() => getMonthDates(selectedMonth), [selectedMonth]);

  const baseMetrics = useMemo(() => {
    let confirmed = 0;
    let pending = 0;
    let open = 0;
    let hours = 0;
    safeArray(filteredShifts).forEach((s) => {
      const status = getOperationalStatus(s);
      if (isAssignedShift(s) && ['realizado', 'em_andamento', 'planejado'].includes(status)) confirmed += 1;
      else if (status === 'cancelado') pending += 1;
      else open += 1;
      hours += getShiftHours(s);
    });
    const total = filteredShifts.length;
    return { total, confirmed, pending, open, hours, coverage: total ? (confirmed / total) * 100 : 0 };
  }, [filteredShifts]);

  const byProfessional = useMemo(() => {
    const map = {};
    filteredShifts.forEach((s) => {
      const id = getProfessionalId(s) || `vaga-${s?.id}`;
      if (!map[id]) {
        map[id] = { id, name: getProfessionalName(s, professionalMap), hours: 0, total: 0 };
      }
      map[id].total += 1;
      map[id].hours += getShiftHours(s);
    });
    return Object.values(map).sort((a, b) => b.hours - a.hours);
  }, [filteredShifts, professionalMap]);

  const bySector = useMemo(() => {
    const map = {};
    filteredShifts.forEach((s) => {
      const name = getSectorName(s, sectorMap);
      if (!map[name]) map[name] = { name, total: 0, confirmed: 0 };
      map[name].total += 1;
      if (isAssignedShift(s)) map[name].confirmed += 1;
    });
    return Object.values(map).map((row) => ({ ...row, coverage: row.total ? (row.confirmed / row.total) * 100 : 0 })).sort((a, b) => a.coverage - b.coverage);
  }, [filteredShifts, sectorMap]);

  const financialData = useMemo(() => {
    let total = 0;
    let missing = 0;
    filteredShifts.forEach((s) => {
      const p = getProfessionalId(s) ? professionalMap[getProfessionalId(s)] : null;
      const rate = p?.hourly_rate ?? p?.hourlyRate ?? s?.hourly_rate ?? s?.valor_hora;
      const hours = getShiftHours(s);
      if (rate == null || !Number.isFinite(Number(rate))) missing += 1;
      else total += hours * Number(rate);
    });
    return { total, missing };
  }, [filteredShifts, professionalMap]);

  const audit = useCallback((type, description) => {
    setAuditEvents((current) => [
      { id: createId('audit'), type, description, timestamp: new Date().toLocaleString('pt-BR') },
      ...current,
    ]);
  }, []);

  const openNewBuilder = () => {
    setBuilderForm(emptyBuilderShift());
    setBuilderModal({ mode: 'new' });
  };

  const openEditBuilder = (shift) => {
    setBuilderForm(normalizeBuilderShift(shift));
    setBuilderModal({ mode: 'edit' });
  };

  const saveBuilderShift = () => {
    const name = String(builderForm.name || '').trim();
    const start = String(builderForm.start || '');
    const end = String(builderForm.end || '');

    if (!name || !start || !end) {
      alert('Preencha o nome, horário inicial e horário final.');
      return;
    }

    if (start === end) {
      alert('O horário inicial e final não podem ser iguais.');
      return;
    }

    const selectedDays = Object.values(builderForm.days || {}).some(Boolean);
    if (!selectedDays) {
      alert('Selecione pelo menos um dia da semana.');
      return;
    }

    const normalized = normalizeBuilderShift({
      ...builderForm,
      id: builderModal?.mode === 'edit' ? builderForm.id : createId('shift'),
      name,
      start,
      end,
      defaultQty: Math.max(1, Math.floor(safeNumber(builderForm.defaultQty, 1))),
    });

    const next = builderModal?.mode === 'edit'
      ? builder.shifts.map((item) => item.id === normalized.id ? normalized : item)
      : [...builder.shifts, normalized];

    persistBuilder({ ...builder, shifts: next });
    setBuilderModal(null);
    setBuilderSaved(true);
    setTimeout(() => setBuilderSaved(false), 2500);
    audit(builderModal?.mode === 'edit' ? 'ALTERAÇÃO' : 'CRIAÇÃO', `Padrão de horário ${name} salvo na escala base.`);
  };

  const deleteBuilderShift = () => {
    if (!builderForm?.id) return;
    const current = builder.shifts.find((s) => s.id === builderForm.id);
    if (!current) return;
    if (!window.confirm(`Excluir o horário "${current.name}"? Essa ação remove apenas o padrão da escala base.`)) return;
    persistBuilder({ ...builder, shifts: builder.shifts.filter((s) => s.id !== builderForm.id) });
    setBuilderModal(null);
    audit('EXCLUSÃO', `Padrão de horário ${current.name} excluído da escala base.`);
  };

  const toggleBuilderDay = (shiftId, dayIndex) => {
    const next = builder.shifts.map((shift) => {
      if (shift.id !== shiftId) return shift;
      return {
        ...shift,
        days: { ...shift.days, [dayIndex]: !Boolean(shift.days?.[dayIndex]) },
      };
    });
    persistBuilder({ ...builder, shifts: next });
  };

  const changeDayQty = (shiftId, dayIndex, value) => {
    const qty = Math.max(1, Math.floor(safeNumber(value, 1)));
    const next = builder.shifts.map((shift) => {
      if (shift.id !== shiftId) return shift;
      return { ...shift, dayQty: { ...shift.dayQty, [dayIndex]: qty }, defaultQty: qty };
    });
    persistBuilder({ ...builder, shifts: next });
  };

  const backupLocal = () => {
    try {
      const payload = {
        version: 5,
        exportedAt: new Date().toISOString(),
        companyId,
        unitId,
        escala: normalizeBuilderData(builder),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-escala-${builder.startDate || localDateString()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      audit('BACKUP', 'Backup local da escala base exportado.');
      setBuilderSaved(true);
      setTimeout(() => setBuilderSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert('Não foi possível gerar o backup local.');
    }
  };

  const importBackup = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const restored = normalizeBuilderData(parsed?.escala || parsed);
      persistBuilder(restored);
      audit('RESTAURAÇÃO', 'Backup local restaurado na escala base.');
      setBuilderSaved(true);
      setTimeout(() => setBuilderSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert('Arquivo de backup inválido.');
    }
  };

  const saveScaleBase = () => {
    const normalized = persistBuilder(builder);
    setSelectedMonth(normalized.startDate ? normalized.startDate.slice(0, 7) : selectedMonth);
    audit('SALVAMENTO', `Escala base ${normalized.scaleName || 'sem nome'} salva.`);
    setBuilderSaved(true);
    setTimeout(() => setBuilderSaved(false), 3500);
  };

  const openAllocation = (date, builderShift, slotIndex = 0) => {
    if (!builderShift) return;
    setAllocationSearch('');
    setAllocationModal({ date, builderShiftId: builderShift.id, slotIndex });
  };

  const getBuilderShift = (id) => builder.shifts.find((s) => s.id === id) || null;

  const existingAllocations = useMemo(() => {
    if (!allocationModal) return [];
    const bShift = getBuilderShift(allocationModal.builderShiftId);
    if (!bShift) return [];
    return filteredShifts.filter((s) => shiftMatchesBuilder(s, bShift, allocationModal.date));
  }, [allocationModal, filteredShifts, builder.shifts]);

  const allocationCandidates = useMemo(() => {
    const term = normalizeText(allocationSearch);
    return sidebarProfessionals.filter((p) => !term || normalizeText(p?.name).includes(term) || normalizeText(p?.specialty).includes(term));
  }, [sidebarProfessionals, allocationSearch]);

  const assignProfessional = async (professional, target = allocationModal) => {
    if (!target || !professional?.id) return;
    if (!selectedSector?.id) {
      alert('Selecione um setor antes de alocar um profissional.');
      return;
    }

    const bShift = getBuilderShift(target.builderShiftId);
    if (!bShift) return;

    const date = target.date;
    const payload = {
      company_id: companyId,
      unit_id: unitId,
      sector_id: selectedSector.id,
      sector_name: selectedSector.name || selectedSector.nome || 'Setor',
      professional_id: professional.id,
      professional_name: professional.name || professional.full_name || 'Profissional',
      date,
      start_time: bShift.start,
      end_time: bShift.end,
      duration_hours: getShiftHours({ start_time: bShift.start, end_time: bShift.end }),
      status: 'confirmado',
    };

    try {
      const Shift = base44?.entities?.Shift;
      if (!Shift?.create) throw new Error('A entidade Shift não está disponível.');
      await Shift.create(payload);
      audit('ALOCAÇÃO', `${professional.name || 'Profissional'} alocado em ${formatDateBR(date)} ${bShift.start}-${bShift.end}.`);
      setAllocationModal(null);
      await loadData(true);
    } catch (err) {
      console.error(err);
      alert(`Não foi possível alocar o profissional: ${err?.message || 'erro desconhecido'}`);
    }
  };

  const dropProfessional = (professional, date, builderShiftId, slotIndex) => {
    if (!professional?.id) return;
    const bShift = getBuilderShift(builderShiftId);
    if (!bShift) return;
    if (!selectedSector?.id) {
      alert('Selecione um setor para alocar por arrastar e soltar.');
      return;
    }
    assignProfessional(professional, { date, builderShiftId, slotIndex });
  };

  const cancelShift = async (shift) => {
    if (!shift?.id) return;
    if (!window.confirm('Cancelar este plantão? O registro será mantido com status cancelado.')) return;
    try {
      const Shift = base44?.entities?.Shift;
      if (!Shift?.update) throw new Error('A entidade Shift não está disponível.');
      await Shift.update(shift.id, { status: 'cancelado', notes: 'Cancelado pela gestão.' });
      audit('CANCELAMENTO', `Plantão de ${getProfessionalName(shift, professionalMap)} em ${formatDateBR(shift.date)} cancelado.`);
      await loadData(true);
    } catch (err) {
      console.error(err);
      alert('Não foi possível cancelar o plantão.');
    }
  };

  const publishScale = () => {
    if (!builder.shifts.length) {
      alert('Configure pelo menos um horário antes de publicar.');
      return;
    }
    if (!window.confirm('Publicar a escala atual?')) return;
    setIsPublished(true);
    audit('PUBLICAÇÃO', 'Escala publicada pela gestão.');
  };

  const exportReport = () => {
    const rows = [
      ['ESCALA E PLANTÕES'],
      ['Relatório', REPORTS[activeReport]?.label || 'Relatório'],
      ['Mês', selectedMonth],
      ['Setor', selectedSector?.name || 'Todos'],
      [],
      ['Indicador', 'Valor'],
      ['Registros', baseMetrics.total],
      ['Confirmados', baseMetrics.confirmed],
      ['Pendentes', baseMetrics.pending],
      ['Vagas em aberto', baseMetrics.open],
      ['Horas', baseMetrics.hours.toFixed(2)],
      ['Cobertura', `${baseMetrics.coverage.toFixed(2)}%`],
      ['Custo estimado', financialData.total.toFixed(2)],
    ];
    downloadCSV(rows, `relatorio-${activeReport}-${selectedMonth}.csv`);
    audit('EXPORTAÇÃO', `Relatório ${REPORTS[activeReport]?.label || activeReport} exportado.`);
  };

  const printReport = () => {
    const win = window.open('', '_blank', 'width=1200,height=900');
    if (!win) {
      alert('Permita pop-ups no navegador para imprimir o relatório.');
      return;
    }
    const rows = byProfessional.map((r) => `<tr><td>${escapeHtml(r.name)}</td><td>${r.total}</td><td>${r.hours.toFixed(1)}h</td></tr>`).join('');
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório Hospitalar</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#0f172a;font-size:12px}h1{font-size:22px;margin:0 0 4px}h2{font-size:14px;margin:24px 0 8px;border-bottom:1px solid #cbd5e1;padding-bottom:5px}.meta{color:#475569;margin-bottom:20px}.cards{display:flex;gap:10px}.card{border:1px solid #cbd5e1;padding:10px;flex:1}.label{font-size:10px;color:#64748b;text-transform:uppercase}.value{font-size:18px;font-weight:700;margin-top:4px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:left}th{background:#e2e8f0}</style></head><body><h1>ESCALA E PLANTÕES</h1><div class="meta">${escapeHtml(REPORTS[activeReport]?.label || 'Relatório')} • ${escapeHtml(selectedMonth)} • ${escapeHtml(selectedSector?.name || 'Todos os setores')}</div><div class="cards"><div class="card"><div class="label">Registros</div><div class="value">${baseMetrics.total}</div></div><div class="card"><div class="label">Confirmados</div><div class="value">${baseMetrics.confirmed}</div></div><div class="card"><div class="label">Cobertura</div><div class="value">${baseMetrics.coverage.toFixed(1)}%</div></div><div class="card"><div class="label">Horas</div><div class="value">${baseMetrics.hours.toFixed(1)}h</div></div></div><h2>Produtividade por profissional</h2><table><thead><tr><th>Profissional</th><th>Plantões</th><th>Horas</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Nenhum registro.</td></tr>'}</tbody></table><p style="margin-top:30px;border-top:1px solid #cbd5e1;padding-top:10px;color:#64748b">Gerado em ${escapeHtml(new Date().toLocaleString('pt-BR'))}</p></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
    audit('IMPRESSÃO', `Relatório ${REPORTS[activeReport]?.label || activeReport} enviado para impressão.`);
  };

  const resetFilters = () => {
    setSectorId('todos');
    setProfessionalSearch('');
  };

  if (appLoading || loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="lg:hidden sticky top-0 z-50 bg-slate-950 text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <button type="button" onClick={() => setMobileMenuOpen((v) => !v)} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="flex items-center gap-2"><Activity className="w-5 h-5 text-sky-400" /><span className="font-bold text-sm">Escala e Plantões</span></div>
        <button type="button" onClick={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex min-h-screen">
        <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-[280px] bg-slate-950 text-white border-r border-slate-800 flex flex-col shadow-2xl transition-transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="px-6 py-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-sky-600 flex items-center justify-center"><Activity className="w-6 h-6" /></div>
              <div><div className="font-black text-sm">ESCALA E</div><div className="text-xs font-bold text-sky-400">PLANTÕES</div></div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <SidebarGroup title="Planejamento & Escalas" />
            <SidebarItem active={viewMode === 'grade'} icon={LayoutGrid} label="Builder Visual da Escala" onClick={() => { setViewMode('grade'); setMobileMenuOpen(false); }} />
            <SidebarItem active={viewMode === 'list'} icon={List} label="Lista Diária" onClick={() => { setViewMode('list'); setMobileMenuOpen(false); }} />

            <SidebarGroup title="Base Estrutural" />
            <SidebarItem active={viewMode === 'base_builder'} icon={SlidersHorizontal} label="Escala Base" onClick={() => { setViewMode('base_builder'); setMobileMenuOpen(false); }} />

            <SidebarGroup title="Relatórios" />
            <SidebarItem active={viewMode === 'relatorios'} icon={BarChart3} label="Relatórios e Auditoria" onClick={() => { setViewMode('relatorios'); setMobileMenuOpen(false); }} />
          </div>
        </aside>

        {mobileMenuOpen && <button type="button" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-40 bg-black/60 lg:hidden" />}

        <main className="flex-1 min-w-0 h-screen overflow-hidden flex flex-col">
          <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="px-5 sm:px-8 py-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-sky-600 items-center justify-center"><CalendarDays className="w-6 h-6 text-white" /></div>
                <div>
                  <div className="flex items-center gap-2"><span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Módulo Ativo</span><span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">ONLINE</span></div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">{viewMode === 'grade' ? 'Builder Visual da Escala' : viewMode === 'list' ? 'Lista Diária de Plantões' : viewMode === 'base_builder' ? 'Editor de Escala Base' : REPORTS[activeReport]?.label}</h1>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="icon" onClick={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')}><Sun className="w-4 h-4 dark:hidden" /><Moon className="w-4 h-4 hidden dark:block" /></Button>
                <Button variant="outline" onClick={() => loadData(true)} disabled={refreshing} className="gap-2"><RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar</Button>
                {viewMode === 'grade' && <Button onClick={publishScale} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"><Send className="w-4 h-4" /> Publicar Escala</Button>}
                {viewMode === 'relatorios' && <><Button variant="outline" onClick={exportReport} className="gap-2"><FileSpreadsheet className="w-4 h-4" /> CSV</Button><Button onClick={() => { audit('VISUALIZAÇÃO', 'Prévia de relatório aberta.'); setReportModalOpen(true); }} className="gap-2 bg-sky-600 text-white"><Eye className="w-4 h-4" /> Prévia</Button></>}
              </div>
            </div>
          </header>

          {error && <div className="mx-5 sm:mx-8 mt-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 p-3 text-sm flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}

          {viewMode !== 'base_builder' && viewMode !== 'relatorios' && (
            <section className="px-5 sm:px-8 pt-5 shrink-0">
              <Card className="p-4 flex flex-col md:flex-row gap-3 items-center">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500"><Filter className="w-4 h-4 text-sky-600" /> Filtros</div>
                {viewMode === 'grade' && <Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger className="h-9 text-xs w-full md:w-56"><SelectValue /></SelectTrigger><SelectContent>{monthOptions().map((m) => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}</SelectContent></Select>}
                <Select value={String(sectorId)} onValueChange={setSectorId}><SelectTrigger className="h-9 text-xs w-full md:w-64"><SelectValue placeholder="Setor" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os setores</SelectItem>{sectors.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name || s.nome || 'Setor'}</SelectItem>)}</SelectContent></Select>
                <Button variant="ghost" onClick={resetFilters} className="text-xs text-red-500 h-9">Limpar</Button>
              </Card>
            </section>
          )}

          {viewMode === 'grade' && <GradeView {...{ monthDates, activeBuilderShifts, filteredShifts, professionalMap, selectedSector, selectedCells, setSelectedCells, openAllocation, cancelShift, isPublished, onDropProfessional: dropProfessional, scaleStartDate: builder.startDate }} />}
          {viewMode === 'list' && <ListView shifts={filteredShifts} professionalMap={professionalMap} sectorMap={sectorMap} onCancel={cancelShift} />}
          {viewMode === 'base_builder' && <BuilderView {...{ builder, builderLoaded, builderHover, setBuilderHover, openNewBuilder, openEditBuilder, toggleBuilderDay, changeDayQty, saveScaleBase, backupLocal, importBackup, setBuilder, builderSaved }} />}
          {viewMode === 'relatorios' && <ReportsView {...{ activeReport, setActiveReport, baseMetrics, byProfessional, bySector, financialData, auditEvents }} />}
        </main>
      </div>

      {builderModal && <BuilderModal form={builderForm} setForm={setBuilderForm} mode={builderModal.mode} onClose={() => setBuilderModal(null)} onSave={saveBuilderShift} onDelete={deleteBuilderShift} />}
      {allocationModal && <AllocationModal {...{ allocationModal, setAllocationModal, allocationSearch, setAllocationSearch, allocationCandidates, existingAllocations, assignProfessional }} />}
      {reportModalOpen && <ReportModal {...{ activeReport, baseMetrics, byProfessional, onClose: () => setReportModalOpen(false), onPrint: printReport, onExport: exportReport }} />}
    </div>
  );
}

function monthOptions() {
  const now = new Date();
  return Array.from({ length: 13 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 6 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

function monthLabel(value) {
  const [y, m] = value.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function LoadingScreen() {
  return <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center"><div className="text-center"><div className="w-14 h-14 rounded-2xl bg-slate-900 mx-auto flex items-center justify-center"><Loader2 className="w-7 h-7 text-white animate-spin" /></div><h2 className="font-bold mt-4">Carregando Escala e Plantões</h2><p className="text-sm text-slate-500 mt-1">Sincronizando dados...</p></div></div>;
}

function SidebarGroup({ title }) {
  return <div className="mt-6 mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{title}</div>;
}

function SidebarItem({ active, icon: Icon, label, onClick }) {
  return <button type="button" onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-colors ${active ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}><Icon className="w-4 h-4" />{label}</button>;
}

function GradeView({ monthDates, activeBuilderShifts, filteredShifts, professionalMap, selectedSector, selectedCells, setSelectedCells, openAllocation, cancelShift, isPublished, onDropProfessional, scaleStartDate }) {
  const toggleSelection = (date, shiftId) => {
    const key = `${date}:${shiftId}`;
    setSelectedCells((current) => current.includes(key) ? current.filter((x) => x !== key) : [...current, key]);
  };

  return (
    <div className="flex-1 overflow-auto p-5 sm:px-8 pb-8 space-y-4">
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3">
          <div><div className="text-xs font-black uppercase tracking-wider">Profissionais disponíveis</div><div className="text-[10px] text-slate-400">Arraste um profissional para uma vaga ou clique para escolher pela janela de alocação.</div></div>
          <div className="text-[10px] font-bold text-slate-500">{selectedSector ? `Setor: ${selectedSector.name || selectedSector.nome || 'Selecionado'}` : 'Selecione um setor no filtro para alocar'}</div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Object.values(professionalMap).slice(0, 50).map((p) => <div key={p.id} draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('application/json', JSON.stringify({ id: p.id })); }} className="shrink-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-grab active:cursor-grabbing hover:border-sky-400"><div className="text-[9px] font-black">{p.name || p.full_name || 'Profissional'}</div><div className="text-[8px] text-slate-400">{p.specialty || p.profession || ''}</div></div>)}
          {Object.keys(professionalMap).length === 0 && <div className="text-xs text-slate-400 py-2">Nenhum profissional carregado.</div>}
        </div>
      </Card>

      <Card className="min-w-[1050px] overflow-hidden">
        {activeBuilderShifts.length === 0 ? (
          <div className="min-h-[420px] flex flex-col items-center justify-center p-8 text-center"><SlidersHorizontal className="w-12 h-12 text-slate-300 mb-4" /><h3 className="font-bold">A escala base ainda está vazia</h3><p className="text-sm text-slate-500 mt-1">Abra “Escala Base” e adicione os horários que quiser.</p></div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800">
                <tr><th className="w-52 p-3 text-left border-r border-slate-200 dark:border-slate-700 text-[10px] uppercase text-slate-500">Horário</th>{monthDates.map((date) => <th key={date} className="min-w-[145px] p-2 text-center border-r border-slate-200 dark:border-slate-700"><div className="text-[9px] text-slate-400">{weekdayShort(date)}</div><div className="font-black text-sm">{formatDateBR(date)}</div></th>)}</tr>
              </thead>
              <tbody>
                {activeBuilderShifts.map((bShift) => <tr key={bShift.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className={`p-3 border-r border-slate-200 dark:border-slate-700 align-top ${colorById(bShift.color).cell}`}><div className="font-black text-sm">{bShift.name}</div><div className="text-[10px] mt-1 font-semibold">{bShift.start} — {bShift.end}</div><div className="text-[9px] mt-1 opacity-70">Padrão: {bShift.defaultQty} vaga(s)</div></td>
                  {monthDates.map((date) => {
                    const dayIndex = getWeekDayIndex(date);
                    const beforeScale = scaleStartDate && date < scaleStartDate;
                    const active = !beforeScale && Boolean(bShift.days?.[dayIndex]);
                    const qty = Math.max(1, Math.floor(safeNumber(bShift.dayQty?.[dayIndex], bShift.defaultQty)));
                    const dayShifts = filteredShifts.filter((item) => shiftMatchesBuilder(item, bShift, date));
                    const key = `${date}:${bShift.id}`;
                    const selected = selectedCells.includes(key);
                    return <td key={date} className={`p-1 border-r border-slate-200 dark:border-slate-800 align-top ${selected ? 'bg-sky-100/70 dark:bg-sky-900/20' : ''}`}>
                      {beforeScale ? <div className="min-h-[125px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-[9px] text-slate-300"><span>Fora da escala</span><span className="mt-1">{formatDateBR(date)}</span></div> : !active ? <button type="button" onClick={() => toggleSelection(date, bShift.id)} className="w-full min-h-[125px] rounded-xl bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex flex-col items-center justify-center text-xs"><span>Vaga desativada</span><span className="text-[8px] mt-1">{formatDateBR(date)}</span></button> : <div className="min-h-[125px] p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-1"><div><div className="text-[8px] font-black text-slate-400">{formatDateBR(date)}</div><div className="text-[8px] font-black text-slate-400">{qty} vaga(s)</div></div><button type="button" onClick={() => toggleSelection(date, bShift.id)} className={`w-5 h-5 rounded ${selected ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}><Check className="w-3 h-3 mx-auto" /></button></div>
                        {Array.from({ length: qty }).map((_, slot) => { const allocated = dayShifts[slot]; const opStatus = allocated ? getOperationalStatus(allocated) : null; return <div key={slot} className="mb-1 last:mb-0">{allocated ? <div className="group rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1.5 flex items-center gap-1.5"><div className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center text-[8px] font-bold">{String(getProfessionalName(allocated, professionalMap)).charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="text-[9px] font-bold truncate">{getProfessionalName(allocated, professionalMap)}</div><span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[7px] font-black ${statusClass(opStatus)}`}>{statusLabel(opStatus)}</span></div>{opStatus !== 'realizado' && <button type="button" onClick={() => cancelShift(allocated)} className="opacity-0 group-hover:opacity-100 text-red-500"><X className="w-3 h-3" /></button>}</div> : <button type="button" onClick={() => openAllocation(date, bShift, slot)} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }} onDrop={(e) => { e.preventDefault(); const raw = e.dataTransfer.getData('application/json'); if (raw) { try { const p = JSON.parse(raw); onDropProfessional(p, date, bShift.id, slot); } catch (err) { console.warn('Drop inválido', err); } } }} className="w-full h-10 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-[9px] font-bold text-slate-400 hover:border-sky-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/20 transition-colors"><UserPlus className="w-3 h-3 inline mr-1" /> Alocar vaga {slot + 1}<div className="text-[7px] font-normal">clique ou arraste</div></button>}</div>; })}
                        {isPublished && <div className="mt-1 text-[8px] text-emerald-600 font-bold text-center">PUBLICADA</div>}
                      </div>}
                    </td>;
                  })}
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800"><div className="text-xs font-black uppercase tracking-wider">Plantões registrados no período</div><div className="text-[10px] text-slate-400 mt-1">Os mesmos registros da Lista Diária, também exibidos aqui em ordem crescente.</div></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr><th className="p-3 text-left">Data</th><th className="p-3 text-left">Horário</th><th className="p-3 text-left">Profissional</th><th className="p-3 text-left">Setor</th><th className="p-3 text-left">Status</th></tr></thead><tbody>{safeArray(filteredShifts).map((item) => { const st = getOperationalStatus(item); return <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 font-bold">{formatDateBR(item.date)}</td><td className="p-3">{item.start_time || '—'} — {item.end_time || '—'}</td><td className="p-3 font-semibold">{getProfessionalName(item, professionalMap)}</td><td className="p-3">{item.sector_name || 'Setor'}</td><td className="p-3"><span className={`px-2 py-1 rounded-full text-[9px] font-black ${statusClass(st)}`}>{statusLabel(st)}</span></td></tr>; })}{safeArray(filteredShifts).length === 0 && <tr><td colSpan={5} className="p-10 text-center text-slate-400">Nenhum plantão registrado no período.</td></tr>}</tbody></table></div>
      </Card>
    </div>
  );
}

function weekdayShort(date) {
  const d = new Date(`${date}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase();
}

function BuilderView({ builder, builderLoaded, builderHover, setBuilderHover, openNewBuilder, openEditBuilder, toggleBuilderDay, changeDayQty, saveScaleBase, backupLocal, importBackup, setBuilder, builderSaved }) {
  if (!builderLoaded) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  return <div className="flex-1 overflow-auto p-5 sm:p-8 bg-slate-50 dark:bg-slate-950"><div className="max-w-[1250px] mx-auto space-y-5">
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
      <div><h2 className="text-2xl font-black text-sky-700 dark:text-sky-400">Escala Base</h2><p className="text-sm text-slate-500 mt-1">Configure livremente horários, dias e quantidade de vagas.</p></div>
      <div className="flex flex-col items-end gap-2"><div className="flex gap-2"><Input value={builder.scaleName} onChange={(e) => setBuilder((b) => ({ ...b, scaleName: e.target.value }))} placeholder="Nome da escala" className="h-10 w-64" /><Input type="date" value={builder.startDate} onChange={(e) => setBuilder((b) => ({ ...b, startDate: e.target.value }))} className="h-10 w-44" /></div>{builder.startDate && <div className="text-[10px] font-bold text-sky-600">Data de início: {formatDateBR(builder.startDate)} • {monthLabel(builder.startDate.slice(0, 7))}</div>}</div>
    </div>

    <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[950px] border-collapse"><thead className="bg-slate-100 dark:bg-slate-800"><tr><th className="w-56 p-4 text-left border-r border-slate-200 dark:border-slate-700 text-[10px] uppercase text-slate-500">Padrão de horário</th>{WEEK_DAYS.map((day) => <th key={day.index} className={`p-4 text-center border-r border-slate-200 dark:border-slate-700 text-[10px] uppercase ${day.weekend ? 'bg-slate-200/60 dark:bg-slate-700/60' : ''}`}>{day.label}</th>)}</tr></thead>
      <tbody>{builder.shifts.length === 0 ? <tr><td colSpan={8} className="p-16 text-center"><Clock3 className="w-10 h-10 mx-auto text-slate-300 mb-3" /><div className="font-bold text-slate-600 dark:text-slate-300">Nenhum horário configurado</div><div className="text-xs text-slate-400 mt-1">Clique em “Adicionar horário” para começar.</div></td></tr> : builder.shifts.slice().sort((a, b) => a.start.localeCompare(b.start)).map((shift) => <tr key={shift.id}>
        <td className={`p-3 border-r border-slate-200 dark:border-slate-700 relative group ${colorById(shift.color).cell}`}><div className="font-black text-sm">{shift.name}</div><div className="text-[10px] font-semibold mt-1">{shift.start} — {shift.end}</div><div className="text-[9px] mt-1 opacity-70">Padrão: {shift.defaultQty} vaga(s)</div><button type="button" onClick={() => openEditBuilder(shift)} className="absolute right-2 top-2 p-1.5 rounded-lg bg-white/80 text-slate-600 opacity-0 group-hover:opacity-100 shadow-sm" title="Editar horário"><Pencil className="w-3.5 h-3.5" /></button></td>
        {WEEK_DAYS.map((day) => { const active = Boolean(shift.days?.[day.index]); const qty = Math.max(1, Math.floor(safeNumber(shift.dayQty?.[day.index], shift.defaultQty))); const hoverKey = `${shift.id}:${day.index}`; return <td key={day.index} className={`p-1 border-r border-slate-200 dark:border-slate-800 ${day.weekend ? 'bg-slate-50/70 dark:bg-slate-800/30' : ''}`} onMouseEnter={() => setBuilderHover(hoverKey)} onMouseLeave={() => setBuilderHover(null)}>
          <div className={`relative min-h-[100px] rounded-xl border flex flex-col items-center justify-center transition-colors ${active ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700' : 'bg-slate-50 dark:bg-slate-950 border-dashed border-slate-300 dark:border-slate-700'}`}>
            <button type="button" onClick={() => toggleBuilderDay(shift.id, day.index)} className="absolute inset-0 z-10 rounded-xl" aria-label={active ? 'Desativar vaga' : 'Ativar vaga'} />
            {builderHover === hoverKey && <div className="absolute inset-0 z-20 rounded-xl bg-slate-950/85 text-white flex items-center justify-center text-[10px] font-black pointer-events-none">{active ? 'Desativar vaga ?' : 'Ativar vaga ?'}</div>}
            <div className={`relative z-0 w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm ${active ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white' : 'text-slate-300'}`}>{active ? qty : '—'}</div>
            {active && <div className="relative z-30 flex items-center gap-1 mt-1"><span className="text-[8px] text-slate-400">vagas</span><input type="number" min="1" value={qty} onClick={(e) => e.stopPropagation()} onChange={(e) => changeDayQty(shift.id, day.index, e.target.value)} className="w-11 h-6 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[9px] text-center" /></div>}
          </div>
        </td>; })}
      </tr>)}</tbody></table></div>
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 items-center"><Button onClick={openNewBuilder} className="bg-sky-600 hover:bg-sky-700 text-white gap-2"><Plus className="w-4 h-4" /> Adicionar horário</Button><div className="text-[10px] text-slate-400">Passe o mouse sobre um dia para ver a ação. Clique para ativar/desativar.</div></div>
    </Card>

    <Card className="p-4"><div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3"><div><div className="text-xs font-black">Persistência da escala</div><div className="text-[10px] text-slate-400 mt-1">As alterações são gravadas no navegador nesta unidade. O botão salvar confirma e registra a configuração atual.</div>{builderSaved && <div className="text-xs font-black text-emerald-600 mt-2">✓ Escala base salva com sucesso.</div>}</div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={backupLocal} className="gap-2"><Download className="w-4 h-4" /> Backup local</Button><label className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"><Download className="w-4 h-4 rotate-180" /> Restaurar backup<input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { importBackup(e.target.files?.[0]); e.target.value = ''; }} /></label><Button onClick={saveScaleBase} className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-7">Salvar Escala Base</Button></div></div></Card>
  </div></div>;
}

function BuilderModal({ form, setForm, mode, onClose, onSave, onDelete }) {
  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  return <div className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-xl max-h-[95vh] overflow-auto bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800">
    <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between"><div><h2 className="font-black text-lg">{mode === 'edit' ? 'Editar horário' : 'Novo horário'}</h2><p className="text-xs text-slate-400 mt-1">Você escolhe qualquer horário e qualquer quantidade.</p></div><button type="button" onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button></div>
    <div className="p-6 space-y-5">
      <div><label className="label">Nome do horário / equipe</label><Input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Ex.: Plantão manhã" className="h-11" /></div>
      <div className="grid grid-cols-2 gap-4"><div><label className="label">Início</label><Input type="time" value={form.start} onChange={(e) => update('start', e.target.value)} className="h-11" /></div><div><label className="label">Término</label><Input type="time" value={form.end} onChange={(e) => update('end', e.target.value)} className="h-11" /></div></div>
      <div><label className="label">Quantidade padrão de vagas</label><Input type="number" min="1" value={form.defaultQty} onChange={(e) => update('defaultQty', Math.max(1, Math.floor(safeNumber(e.target.value, 1))))} className="h-11" /></div>
      <div><label className="label">Cor</label><div className="flex gap-3">{COLORS.map((c) => <button type="button" key={c.id} onClick={() => update('color', c.id)} className={`w-8 h-8 rounded-lg ${c.dot} ${form.color === c.id ? 'ring-2 ring-offset-2 ring-slate-500' : ''}`} title={c.label} />)}</div></div>
      <div><label className="label">Dias em que o horário ficará ativo</label><div className="grid grid-cols-7 gap-1.5">{WEEK_DAYS.map((day) => { const active = Boolean(form.days?.[day.index]); return <button type="button" key={day.index} onClick={() => setForm((f) => ({ ...f, days: { ...f.days, [day.index]: !active }, dayQty: { ...f.dayQty, [day.index]: f.dayQty?.[day.index] || f.defaultQty } }))} className={`h-16 rounded-xl border text-[10px] font-black ${active ? 'bg-sky-50 border-sky-300 text-sky-700 dark:bg-sky-950/30 dark:border-sky-700 dark:text-sky-300' : 'border-slate-200 text-slate-400 dark:border-slate-700'}`}>{day.short}<div className={`w-4 h-4 rounded mx-auto mt-2 flex items-center justify-center ${active ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>{active && <Check className="w-3 h-3" />}</div></button>; })}</div></div>
      <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-800"><div>{mode === 'edit' && <Button variant="ghost" onClick={onDelete} className="text-red-500 gap-2"><Trash2 className="w-4 h-4" /> Excluir</Button>}</div><div className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={onSave} className="bg-sky-600 hover:bg-sky-700 text-white">Salvar horário</Button></div></div>
    </div>
  </div></div>;
}

function AllocationModal({ allocationModal, setAllocationModal, allocationSearch, setAllocationSearch, allocationCandidates, existingAllocations, assignProfessional }) {
  const builderId = allocationModal?.builderShiftId;
  return <div className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-lg max-h-[90vh] overflow-hidden bg-white dark:bg-slate-900 rounded-3xl shadow-2xl">
    <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between"><div><h2 className="font-black">Alocar profissional</h2><p className="text-xs text-slate-500 mt-1">Escolha quem ocupará esta vaga.</p></div><button type="button" onClick={() => setAllocationModal(null)}><X className="w-5 h-5 text-slate-400" /></button></div>
    <div className="p-5"><div className="text-xs font-bold text-slate-500 mb-3">{formatDateBR(allocationModal.date)} • Horário configurado</div><div className="relative mb-4"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><Input autoFocus value={allocationSearch} onChange={(e) => setAllocationSearch(e.target.value)} placeholder="Buscar profissional..." className="pl-9 h-10" /></div><div className="max-h-[45vh] overflow-auto space-y-1">{allocationCandidates.slice(0, 30).map((p) => <button type="button" key={p.id} onClick={() => assignProfessional(p)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/20 text-left flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-black"><Users className="w-4 h-4" /></div><div><div className="font-bold text-sm">{p.name || p.full_name || 'Profissional'}</div><div className="text-[10px] text-slate-400">{p.specialty || p.profession || 'Profissional'}</div></div></button>)}{allocationCandidates.length === 0 && <div className="py-10 text-center text-sm text-slate-400">Nenhum profissional encontrado.</div>}</div>{existingAllocations.length > 0 && <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-500">Esta data/horário já possui {existingAllocations.length} alocação(ões).</div>}</div>
  </div></div>;
}

function ListView({ shifts, professionalMap, sectorMap, onCancel }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [sectorFilter, setSectorFilter] = useState('todos');

  const sectors = useMemo(() => {
    const map = {};
    safeArray(shifts).forEach((s) => {
      const id = s?.sector_id || getSectorName(s, sectorMap);
      if (id) map[id] = getSectorName(s, sectorMap);
    });
    return Object.entries(map).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [shifts, sectorMap]);

  const filtered = useMemo(() => {
    const term = normalizeText(searchTerm);
    return safeArray(shifts).filter((s) => {
      const status = getOperationalStatus(s);
      const hay = normalizeText(`${getProfessionalName(s, professionalMap)} ${getSectorName(s, sectorMap)} ${s?.start_time || ''} ${s?.end_time || ''}`);
      if (term && !hay.includes(term)) return false;
      if (statusFilter !== 'todos' && status !== statusFilter) return false;
      if (sectorFilter !== 'todos' && String(s?.sector_id || getSectorName(s, sectorMap)) !== String(sectorFilter)) return false;
      return true;
    }).sort((a, b) => normalizeDate(a?.date).localeCompare(normalizeDate(b?.date)) || String(a?.start_time || '').localeCompare(String(b?.start_time || '')));
  }, [shifts, professionalMap, sectorMap, searchTerm, statusFilter, sectorFilter]);

  return <div className="flex-1 overflow-auto p-5 sm:p-8">
    <Card className="overflow-hidden">
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 space-y-4">
        <div><h2 className="font-black">Lista Diária de Plantões</h2><p className="text-xs text-slate-500 mt-1">Registros em ordem cronológica. O status é calculado pela data do plantão.</p></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" /><Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar profissional, setor ou horário..." className="pl-9 h-9 text-xs" /></div>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os status</SelectItem><SelectItem value="realizado">Realizado</SelectItem><SelectItem value="em_andamento">Em andamento</SelectItem><SelectItem value="planejado">Planejado</SelectItem><SelectItem value="cancelado">Cancelado</SelectItem></SelectContent></Select>
          <Select value={sectorFilter} onValueChange={setSectorFilter}><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Setor" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os setores</SelectItem>{sectors.map(([id, name]) => <SelectItem key={id} value={String(id)}>{name}</SelectItem>)}</SelectContent></Select>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr><th className="p-3 text-left">Data</th><th className="p-3 text-left">Horário</th><th className="p-3 text-left">Profissional</th><th className="p-3 text-left">Setor</th><th className="p-3 text-left">Status</th><th className="p-3 text-right">Ação</th></tr></thead><tbody>{filtered.map((s) => { const status = getOperationalStatus(s); return <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/70 dark:hover:bg-slate-800/50"><td className="p-3 font-bold whitespace-nowrap">{formatDateBR(s.date)}<div className="text-[9px] text-slate-400">{weekdayShort(normalizeDate(s.date))}</div></td><td className="p-3 whitespace-nowrap">{s.start_time || '—'} — {s.end_time || '—'}</td><td className="p-3 font-semibold">{getProfessionalName(s, professionalMap)}</td><td className="p-3">{getSectorName(s, sectorMap)}</td><td className="p-3"><span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${statusClass(status)}`}>{statusLabel(status)}</span></td><td className="p-3 text-right">{status !== 'cancelado' && <button type="button" onClick={() => onCancel(s)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg" title="Cancelar plantão"><Trash2 className="w-4 h-4" /></button>}</td></tr>; })}{filtered.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-slate-400">Nenhum plantão encontrado com esses filtros.</td></tr>}</tbody></table></div>
    </Card>
  </div>;
}

function ReportsView({ activeReport, setActiveReport, baseMetrics, byProfessional, bySector, financialData, auditEvents }) {
  return <div className="flex-1 overflow-auto p-5 sm:p-8 space-y-5">
    <Card className="p-4"><div className="flex flex-col md:flex-row md:items-center justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-wider">Central de Relatórios</div><div className="text-[10px] text-slate-400 mt-1">Escolha o relatório que deseja consultar. O log de auditoria fica somente aqui.</div></div><Select value={activeReport} onValueChange={setActiveReport}><SelectTrigger className="h-10 w-full md:w-72"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(REPORTS).map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}</SelectContent></Select></div></Card>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><Metric label="Registros" value={baseMetrics.total} /><Metric label="Confirmados" value={baseMetrics.confirmed} /><Metric label="Cobertura" value={`${baseMetrics.coverage.toFixed(1)}%`} /><Metric label="Horas" value={formatHours(baseMetrics.hours)} /></div>
    {activeReport === 'executiva' && <div className="grid grid-cols-1 xl:grid-cols-2 gap-5"><ReportCard title="Resumo executivo"><div className="space-y-3"><Row label="Plantões em andamento ou realizados" value={baseMetrics.confirmed} /><Row label="Cancelados" value={baseMetrics.pending} /><Row label="Vagas em aberto" value={baseMetrics.open} /><Row label="Custo informado" value={formatCurrency(financialData.total)} /></div></ReportCard><ReportCard title="Cobertura por setor"><div className="space-y-4">{bySector.map((r) => <div key={r.name}><div className="flex justify-between text-xs mb-1"><span>{r.name}</span><strong>{r.coverage.toFixed(1)}%</strong></div><div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-sky-600" style={{ width: `${Math.max(0, Math.min(100, r.coverage))}%` }} /></div></div>)}{bySector.length === 0 && <Empty text="Sem dados de cobertura." />}</div></ReportCard></div>}
    {activeReport === 'produtividade' && <ReportCard title="Produtividade por profissional"><SimpleTable headers={['Profissional', 'Plantões', 'Horas']} rows={byProfessional.map((r) => [r.name, r.total, formatHours(r.hours)])} /></ReportCard>}
    {(activeReport === 'cobertura' || activeReport === 'risco') && <ReportCard title={activeReport === 'risco' ? 'Risco operacional' : 'Cobertura por setor'}><SimpleTable headers={['Setor', 'Registros', 'Alocados', 'Cobertura']} rows={bySector.map((r) => [r.name, r.total, r.confirmed, `${r.coverage.toFixed(1)}%`])} /></ReportCard>}
    {activeReport === 'financeiro' && <ReportCard title="Financeiro & Custos"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Metric label="Custo com valor informado" value={formatCurrency(financialData.total)} /><Metric label="Sem remuneração informada" value={financialData.missing} /></div></ReportCard>}
    {activeReport === 'auditoria' && <ReportCard title="Log de Auditoria"><SimpleTable headers={['Tipo', 'Descrição', 'Data/Hora']} rows={auditEvents.map((e) => [e.type, e.description, e.timestamp])} /></ReportCard>}
  </div>;
}

function Metric({ label, value }) { return <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"><div className="text-xs text-slate-500">{label}</div><div className="text-2xl font-black mt-1">{value}</div></div>; }
function Row({ label, value }) { return <div className="flex justify-between gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800"><span className="text-sm text-slate-500">{label}</span><strong className="text-sm">{value}</strong></div>; }
function ReportCard({ title, children }) { return <Card className="p-5 bg-white dark:bg-slate-900"><h2 className="font-black mb-4">{title}</h2>{children}</Card>; }
function Empty({ text }) { return <div className="text-sm text-slate-400 text-center py-8">{text}</div>; }
function SimpleTable({ headers, rows }) { return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-200 dark:border-slate-700">{headers.map((h) => <th key={h} className="p-3 text-left text-xs text-slate-500">{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i} className="border-b border-slate-100 dark:border-slate-800">{row.map((cell, j) => <td key={j} className="p-3">{cell}</td>)}</tr>)}{rows.length === 0 && <tr><td colSpan={headers.length} className="p-10 text-center text-slate-400">Nenhum registro.</td></tr>}</tbody></table></div>; }

function ReportModal({ activeReport, baseMetrics, byProfessional, onClose, onPrint, onExport }) {
  return <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-5xl max-h-[90vh] overflow-auto bg-white dark:bg-slate-900 rounded-3xl shadow-2xl"><div className="sticky top-0 z-10 p-4 bg-slate-950 text-white flex items-center justify-between"><div><div className="font-bold">Prévia do relatório</div><div className="text-xs text-slate-400">{REPORTS[activeReport]?.label}</div></div><div className="flex gap-2"><Button variant="outline" onClick={onExport} className="text-white bg-transparent border-white/20 gap-2"><FileSpreadsheet className="w-4 h-4" /> CSV</Button><Button onClick={onPrint} className="bg-sky-600 gap-2"><Printer className="w-4 h-4" /> Imprimir</Button><Button variant="ghost" onClick={onClose} className="text-white"><X className="w-5 h-5" /></Button></div></div><div className="p-6"><div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Metric label="Registros" value={baseMetrics.total} /><Metric label="Confirmados" value={baseMetrics.confirmed} /><Metric label="Cobertura" value={`${baseMetrics.coverage.toFixed(1)}%`} /><Metric label="Horas" value={formatHours(baseMetrics.hours)} /></div><div className="mt-6"><SimpleTable headers={['Profissional', 'Plantões', 'Horas']} rows={byProfessional.map((r) => [r.name, r.total, formatHours(r.hours)])} /></div></div></div></div>;
}

