import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity, AlertTriangle, BarChart3, Building2, Check, CheckCircle2,
  ChevronRight, ClipboardCheck, Clock3, Database, Download, Eye, FileCheck2,
  FileSpreadsheet, Filter, GripVertical, Hash, History, LayoutDashboard,
  LayoutGrid, List, Loader2, Lock, MapPin, Maximize2, Menu, MessageCircle,
  Minimize2, Moon, Pencil, Plus, Printer, RefreshCw, Search, Send, ShieldCheck,
  SlidersHorizontal, Sun, Trash2, TrendingDown, UserPlus, Users, UsersRound, X
} from 'lucide-react';
import ShiftFormDialog from '@/components/shifts/ShiftFormDialog';
import { getShiftTvLifecycle } from '@/lib/shiftUtils';

/* ============================================================
   CONSTANTES GLOBAIS
   ============================================================ */

const STORAGE_KEY = 'hospital-escala-base-final';

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
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
  { id: 'sky', value: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200', bg: 'bg-sky-400' },
  { id: 'amber', value: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200', bg: 'bg-amber-400' },
  { id: 'indigo', value: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200', bg: 'bg-indigo-400' },
  { id: 'emerald', value: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200', bg: 'bg-emerald-400' },
  { id: 'rose', value: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200', bg: 'bg-rose-400' },
  { id: 'purple', value: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200', bg: 'bg-purple-400' }
];

const REPORT_CONFIG = {
  executiva: { label: 'Visão Executiva', icon: LayoutDashboard },
  produtividade: { label: 'Produtividade & Horas', icon: Clock3 },
  cobertura: { label: 'Cobertura Operacional', icon: Building2 },
  risco: { label: 'Risco Assistencial', icon: ShieldCheck },
  financeiro: { label: 'Financeiro & Custos', icon: BarChart3 },
  turnover: { label: 'Cancelamentos', icon: Users },
  auditoria: { label: 'Log de Auditoria', icon: ClipboardCheck },
};

/* ============================================================
   FUNÇÕES DE APOIO BLINDADAS
   ============================================================ */

function safeArray(val) { return Array.isArray(val) ? val : []; }
function safeNumber(val, fb = 0) { const n = Number(val); return Number.isFinite(n) ? n : fb; }
function normalizeDate(val) { if (!val) return ''; const t = String(val).trim(); return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.substring(0, 10) : t; }
function getLocalDateString(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function normalizeStr(str) { return typeof str === 'string' ? str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : ''; }
function getStatusKey(status) { return String(status || '').trim().toLowerCase(); }
function formatNumber(val, dec = 0) { return safeNumber(val).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
function formatCurrency(val) { if (val == null || val === '') return 'Não informado'; const n = Number(val); return Number.isFinite(n) ? `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Não informado'; }
function formatDateBR(dateStr) { if (!dateStr) return '—'; const parts = normalizeDate(dateStr).split('-'); return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(dateStr); }
function escapeCSV(val) { return `"${String(val ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`; }
function downloadFile(content, filename, type = 'text/csv;charset=utf-8;') { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); document.body.removeChild(link); setTimeout(() => URL.revokeObjectURL(url), 1000); }

function getShiftHours(s) {
  if (s?.duration_hours != null) return safeNumber(s.duration_hours);
  if (s?.hours != null) return safeNumber(s.hours);
  if (s?.start_time && s?.end_time) {
    const st = new Date(`1970-01-01T${s.start_time}`);
    const et = new Date(`1970-01-01T${s.end_time}`);
    if (!Number.isNaN(st.getTime()) && !Number.isNaN(et.getTime())) {
      let diff = (et - st) / 3600000;
      if (diff < 0) diff += 24;
      return Math.max(0, diff);
    }
  }
  return 0;
}

function getProfessionalId(s) { return s?.professional_id || s?.professionalId || s?.professional?.id || null; }
function getProfessionalName(s, m = {}) { if (s?.professional_name) return s.professional_name; const id = getProfessionalId(s); return id && m[id] ? m[id].name || m[id].full_name || 'Profissional' : 'Vaga Aberta'; }
function getSectorName(s, m = {}) { if (s?.sector_name) return s.sector_name; return s?.sector_id && m[s.sector_id] ? m[s.sector_id].name : 'Sem Setor'; }
function isAssignedShift(s) { return Boolean(getProfessionalId(s)) && !normalizeStr(s?.professional_name).includes('vaga'); }

function getMonthWeeks(monthStr) {
  if (!monthStr || typeof monthStr !== 'string') return [];
  const parts = monthStr.split('-');
  if (parts.length < 2) return [];
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const weeks = [];
  let currentWeek = [];
  
  let startDay = firstDay.getDay(); 
  let emptyDays = startDay === 0 ? 6 : startDay - 1; 
  for (let i = 0; i < emptyDays; i++) currentWeek.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    currentWeek.push(getLocalDateString(new Date(year, month - 1, d)));
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }
  return weeks;
}

/* ============================================================
   COMPONENTE PRINCIPAL: ESCALAS
   ============================================================ */

export default function Escalas() {
  const { user, company, loading: appLoading } = useAppData() || {};
  
  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id || 'unit_1';
  const isManager = user?.role === 'admin' || user?.data?.app_role === 'manager' || user?.data?.app_role === 'gestor';

  const [shifts, setShifts] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [viewMode, setViewMode] = useState('grade'); // grade, list, base_builder, relatorios
  const [activeTab, setActiveTab] = useState('executiva');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState('light');

  const [selectedMonth, setSelectedMonth] = useState(() => getLocalDateString().slice(0, 7));
  const [sectorFilter, setSectorFilter] = useState('todos');
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Interações da Grade / Drag and Drop
  const [profSearchQuery, setProfSearchQuery] = useState('');
  const [selectedCells, setSelectedCells] = useState([]);
  const [inlineEditingCell, setInlineEditingCell] = useState(null);
  const [inlineSearchText, setInlineSearchText] = useState('');
  const [newShiftModal, setNewShiftModal] = useState(null);
  const [selectedProfIdForModal, setSelectedProfIdForModal] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isPublished, setIsPublished] = useState(false);
  const [tvMode, setTvMode] = useState(false);

  // Estados do Builder de Escala Base
  const [createScaleState, setCreateScaleState] = useState(0); 
  const [builderModal, setBuilderModal] = useState(null);
  const [builderShifts, setBuilderShifts] = useState([]);
  const [builderForm, setBuilderForm] = useState({ id: '', name: '', start: '', end: '', qty: 1, color: BUILDER_COLORS[0], cellStates: {} });

  // Temas
  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem('hospital-intelligence-theme');
      const preferredTheme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      setTheme(savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : preferredTheme);
    } catch { setTheme('light'); }
  }, []);

  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    try { window.localStorage.setItem('hospital-intelligence-theme', theme); } catch {}
  }, [theme]);

  // Loader de API Seguro
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const queryFilter = companyId ? { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) } : {};
      
      const sRaw = base44.entities.Shift?.filter ? await base44.entities.Shift.filter(queryFilter, '-date', 2000).catch(() => []) : [];
      const secRaw = base44.entities.Sector?.filter ? await base44.entities.Sector.filter(queryFilter, '-created_date', 200).catch(() => []) : [];
      const pRaw = base44.entities.Professional?.filter ? await base44.entities.Professional.filter(queryFilter, '-created_date', 1000).catch(() => []) : [];

      const safeShifts = safeArray(sRaw?.data || sRaw);
      const safeSectors = safeArray(secRaw?.data || secRaw);
      const safeProfessionals = safeArray(pRaw?.data || pRaw);

      setShifts(safeShifts);
      setSectors(safeSectors);
      setProfessionals(safeProfessionals);
      
      if (sectorFilter === 'todos' && safeSectors.length > 0) {
        setSectorFilter(String(safeSectors[0].id));
      }
    } catch (e) {
      console.warn("Falha na sincronização", e);
    } finally {
      setLoading(false);
    }
  }, [companyId, unitId, sectorFilter]);

  useEffect(() => { if (!appLoading) loadData(); }, [appLoading, loadData]);
  useEffect(() => { const id = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(id); }, []);

  // Recupera Escala Base do LocalStorage
  useEffect(() => {
    try {
      const key = `${STORAGE_KEY}:${companyId}:${unitId}`;
      const raw = window.localStorage.getItem(key);
      if (raw) setBuilderShifts(JSON.parse(raw));
    } catch (e) {}
  }, [companyId, unitId]);

  const persistBuilder = (newShifts) => {
    setBuilderShifts(newShifts);
    try { window.localStorage.setItem(`${STORAGE_KEY}:${companyId}:${unitId}`, JSON.stringify(newShifts)); } catch (e) {}
  };

  // Maps
  const professionalMap = useMemo(() => { const m = {}; safeArray(professionals).forEach(p => { if (p?.id) m[p.id] = p; }); return m; }, [professionals]);
  const sectorMap = useMemo(() => { const m = {}; safeArray(sectors).forEach(s => { if (s?.id) m[s.id] = s; }); return m; }, [sectors]);

  const monthOptions = useMemo(() => {
    const opts = new Set(safeArray(shifts).map(s => s?.date ? String(s.date).slice(0, 7) : ''));
    if (selectedMonth) opts.add(selectedMonth);
    return [...opts].filter(Boolean).sort().reverse();
  }, [shifts, selectedMonth]);

  const filteredShifts = useMemo(() => {
    return safeArray(shifts).filter(s => {
      if (!s || getStatusKey(s.status) === 'cancelado') return false;
      const sDate = normalizeDate(s.date);
      if (!sDate || !sDate.startsWith(selectedMonth)) return false;
      if (sectorFilter !== 'todos' && String(s.sector_id) !== String(sectorFilter)) return false;
      return true;
    }).map(s => {
      const sTime = s.start_time || '00:00';
      let builderId = s.builder_id || null;
      if (!builderId) {
        if (sTime >= '13:00' && sTime < '19:00') builderId = 'tarde';
        else if (sTime >= '19:00' || sTime < '06:00') builderId = 'noite';
        else builderId = 'manha';
      }
      return { ...s, builderId, isVacant: !isAssignedShift(s) };
    });
  }, [shifts, selectedMonth, sectorFilter]);

  const weeksDataGrid = useMemo(() => getMonthWeeks(selectedMonth), [selectedMonth]);

  const sidebarProfessionals = useMemo(() => {
    const term = normalizeStr(profSearchQuery);
    return safeArray(professionals).filter(p => p?.id && (!term || normalizeStr(p.name || p.full_name).includes(term) || normalizeStr(p.specialty).includes(term)));
  }, [professionals, profSearchQuery]);

  /* ============================================================
     AÇÕES DA GRADE (DRAG & DROP, CLIQUES)
     ============================================================ */

  const handleCellClick = (e, date, builderId) => {
    if (e.ctrlKey || e.metaKey) {
      const exists = selectedCells.find(c => c.date === date && c.builderId === builderId);
      if (exists) setSelectedCells(selectedCells.filter(c => !(c.date === date && c.builderId === builderId)));
      else setSelectedCells([...selectedCells, { date, builderId }]);
    } else {
      setSelectedCells([]);
      setSelectedProfIdForModal('');
      setNewShiftModal({ date, builderId });
    }
  };

  const handleDragStart = (e, prof) => { if (prof?.id) e.dataTransfer.setData('profId', prof.id); };
  const handleDragOver = (e) => { e.preventDefault(); };

  const assignShift = async (date, builderId, profId) => {
    if (sectorFilter === 'todos') { alert("Selecione um setor na barra superior."); return; }
    
    // Busca do padrão de turno criado no Builder (ou fallback para o estático)
    let periodDef = builderShifts.find(p => p.id === builderId);
    if (!periodDef) {
      const fallback = [
        { id: 'manha', name: 'Manhã', start: '07:00', end: '13:00' },
        { id: 'tarde', name: 'Tarde', start: '13:00', end: '19:00' },
        { id: 'noite', name: 'Noite', start: '19:00', end: '07:00' }
      ].find(p => p.id === builderId);
      periodDef = fallback || { name: 'Turno', start: '08:00', end: '14:00' };
    }

    const prof = professionalMap[profId];
    const sectorObj = safeArray(sectors).find(s => String(s.id) === String(sectorFilter));
    if (!prof || !sectorObj) return;

    try {
      const existingShift = filteredShifts.find(s => s.date === date && s.builderId === builderId && s.isVacant);
      const payload = { 
        company_id: companyId, unit_id: unitId, 
        professional_id: prof.id, professional_name: prof.name || prof.full_name || 'Profissional', 
        sector_id: sectorObj.id, sector_name: sectorObj.name, 
        date: date, start_time: periodDef.start, end_time: periodDef.end, 
        builder_id: builderId, status: 'confirmado' 
      };
      
      if (existingShift) await base44.entities.Shift.update(existingShift.id, payload);
      else await base44.entities.Shift.create(payload);
      
      loadData();
    } catch (e) { alert("Erro ao salvar plantão: " + e.message); }
  };

  const handleDrop = (e, date, builderId) => {
    e.preventDefault();
    const profId = e.dataTransfer.getData('profId');
    if (!profId) return;
    const isSelected = selectedCells.some(c => c.date === date && c.builderId === builderId);
    if (isSelected && selectedCells.length > 0) {
      selectedCells.forEach(cell => assignShift(cell.date, cell.builderId, profId));
      setSelectedCells([]);
    } else {
      assignShift(date, builderId, profId);
      setSelectedCells([]);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja cancelar este plantão? Ele ficará salvo para auditoria.')) return;
    try { await base44.entities.Shift.update(id, { status: 'cancelado' }); loadData(); } catch (e) { alert('Erro ao cancelar.'); }
  };

  const handlePublish = () => {
    if (confirm('Publicar escala? Isso fixará a visão para os profissionais e ativará os alertas.')) {
      setIsPublished(true);
      setTimeout(() => alert('Escala publicada com sucesso! Notificações enviadas.'), 500);
    }
  };

  /* ============================================================
     BUILDER DA ESCALA BASE (COMPORTAMENTO AUTÔNOMO)
     ============================================================ */

  const openNewBuilderModal = () => { 
    setBuilderForm({ id: '', name: '', start: '', end: '', qty: 1, color: BUILDER_COLORS[0], cellStates: {} }); 
    setBuilderModal({ isNew: true }); 
  };

  const openEditBuilderModal = (shiftObj) => {
    const selectedColor = BUILDER_COLORS.find(c => c.value === shiftObj.color) || BUILDER_COLORS[0];
    setBuilderForm({ ...shiftObj, color: selectedColor });
    setBuilderModal({ isNew: false });
  };

  const toggleBuilderDay = (dayIndex) => {
    setBuilderForm(prev => {
      const newCellStates = { ...prev.cellStates, [dayIndex]: !prev.cellStates[dayIndex] };
      return { ...prev, cellStates: newCellStates };
    });
  };

  const saveBuilderShift = () => {
    if (!builderForm.name || !builderForm.start || !builderForm.end) { alert('Preencha os campos obrigatórios.'); return; }
    
    const newObj = { 
      id: builderModal.isNew ? `bld_${Date.now()}` : builderForm.id, 
      name: builderForm.name, start: builderForm.start, end: builderForm.end, 
      color: builderForm.color.value, qty: Math.max(1, Number(builderForm.qty) || 1), 
      cellStates: builderForm.cellStates 
    };

    let updatedList = [];
    if (builderModal.isNew) updatedList = [...builderShifts, newObj];
    else updatedList = builderShifts.map(s => s.id === newObj.id ? newObj : s);
    
    persistBuilder(updatedList);
    setBuilderModal(null);
  };

  const toggleBuilderCell = (shiftId, dayIndex) => {
    const updatedList = builderShifts.map(s => {
      if (s.id === shiftId) {
        return { ...s, cellStates: { ...s.cellStates, [dayIndex]: !s.cellStates[dayIndex] } };
      }
      return s;
    });
    persistBuilder(updatedList);
  };

  const downloadBackupBase = () => {
    const dataStr = JSON.stringify(builderShifts, null, 2);
    downloadFile(dataStr, 'backup_escala_base.json', 'application/json');
  };

  /* ============================================================
     TELA PRINCIPAL E RENDERIZAÇÃO
     ============================================================ */

  if (loading && !shifts.length) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-sky-600 animate-spin" />
          <div className="text-slate-500 font-semibold">Sincronizando Sistema...</div>
        </div>
      </div>
    );
  }

  // Gera os turnos a serem exibidos na grade (mescla a base salva com fallbacks se vazio)
  const displayShiftsGrid = builderShifts.length > 0 ? builderShifts : [
    { id: 'manha', name: 'Manhã', start: '07:00', end: '13:00', color: BUILDER_COLORS[0].value, qty: 1, cellStates: {1:true,2:true,3:true,4:true,5:true,6:true,0:true} },
    { id: 'tarde', name: 'Tarde', start: '13:00', end: '19:00', color: BUILDER_COLORS[1].value, qty: 1, cellStates: {1:true,2:true,3:true,4:true,5:true,6:true,0:true} },
    { id: 'noite', name: 'Noite', start: '19:00', end: '07:00', color: BUILDER_COLORS[2].value, qty: 1, cellStates: {1:true,2:true,3:true,4:true,5:true,6:true,0:true} },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      {/* SIDEBAR */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-[260px] bg-slate-950 text-slate-400 flex flex-col transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center"><Activity className="w-5 h-5 text-white" /></div>
          <div><div className="font-black text-sm text-white tracking-widest">ESCALA E</div><div className="text-[10px] font-bold text-sky-400">PLANTÕES</div></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2 opacity-50">Gestão Visual</div>
            <SidebarItem active={viewMode === 'grade'} icon={LayoutGrid} label="Builder Visual da Escala" onClick={() => { setViewMode('grade'); setMobileMenuOpen(false); }} />
            <SidebarItem active={viewMode === 'list'} icon={List} label="Lista Diária" onClick={() => { setViewMode('list'); setMobileMenuOpen(false); }} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2 opacity-50">Planejamento</div>
            <SidebarItem active={viewMode === 'base_builder'} icon={SlidersHorizontal} label="Configurar Escala Base" onClick={() => { setViewMode('base_builder'); setMobileMenuOpen(false); }} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2 opacity-50">Painel Executivo</div>
            <SidebarItem active={activeTab === 'executiva' && viewMode === 'relatorios'} icon={LayoutDashboard} label="Visão Executiva" onClick={() => { setViewMode('relatorios'); setActiveTab('executiva'); setMobileMenuOpen(false); }} />
          </div>
        </div>
      </aside>

      {mobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />}

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-5 lg:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 bg-slate-100 dark:bg-slate-800 rounded-lg" onClick={() => setMobileMenuOpen(true)}><Menu className="w-5 h-5" /></button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">Gerenciador de Escalas</h1>
              <p className="text-xs text-slate-500">Alocação e publicação de plantões médicos.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={toggleTheme} className="dark:border-slate-700"><Sun className="w-4 h-4 hidden dark:block" /><Moon className="w-4 h-4 block dark:hidden" /></Button>
            {viewMode === 'grade' && (
              <Button onClick={handlePublish} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md gap-2">
                <Send className="w-4 h-4" /> Publicar Escala
              </Button>
            )}
            <Button variant="outline" onClick={() => window.print()} className="gap-2 font-bold dark:border-slate-700 hidden sm:flex"><Printer className="w-4 h-4" /> Imprimir</Button>
          </div>
        </header>

        {viewMode !== 'base_builder' && viewMode !== 'relatorios' && (
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 px-8 flex flex-wrap lg:flex-nowrap items-end gap-4 shrink-0">
            <div className="flex flex-col gap-1.5 min-w-[150px]">
              <label className="text-[10px] font-bold uppercase text-slate-400">Mês da Escala</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-9 text-xs dark:bg-slate-800 dark:border-slate-700"><SelectValue placeholder="Mês Corrente" /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map(m => {
                    const d = new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1);
                    return <SelectItem key={m} value={m}>{d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-[10px] font-bold uppercase text-slate-400">Setor Ativo</label>
              <Select value={sectorFilter} onValueChange={setSectorFilter}>
                <SelectTrigger className="h-9 text-xs dark:bg-slate-800 dark:border-slate-700"><SelectValue placeholder="Selecione o Setor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Selecione o Setor</SelectItem>
                  {(sectors || []).filter(s => s && s.id).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name || 'Sem nome'}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedCells.length > 0 && (
              <div className="bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 px-4 py-2 rounded-xl text-xs font-bold border border-sky-200 dark:border-sky-800 animate-pulse">
                {selectedCells.length} dias selecionados (Arraste o profissional)
              </div>
            )}
          </div>
        )}

        {/* ===================== MODO GRADE VISUAL (BUILDER) ===================== */}
        {viewMode === 'grade' && (
          <div className="flex-1 flex overflow-hidden p-5 sm:px-8 pb-8">
            <Card className="flex-1 border-slate-200 dark:border-slate-800 shadow-sm flex overflow-hidden bg-white dark:bg-slate-900">
              
              {/* Lateral de Profissionais */}
              <div className="w-64 bg-slate-50/50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-black text-sm text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2"><UsersRound className="w-4 h-4 text-sky-600" /> Corpo Clínico</h3>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <Input placeholder="Buscar profissional..." value={profSearchQuery} onChange={e => setProfSearchQuery(e.target.value)} className="pl-9 h-9 text-xs bg-white dark:bg-slate-800" />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 text-center font-medium">Arraste o nome para a escala ➔</p>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                  {sidebarProfessionals.map(prof => (
                    <div key={prof.id} draggable onDragStart={(e) => handleDragStart(e, prof)} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-sky-400 active:cursor-grabbing flex items-center gap-2 group transition-all">
                      <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-sky-500" />
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">{prof.name || prof.full_name || 'Profissional'}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{prof.specialty || 'Geral'}</div>
                      </div>
                    </div>
                  ))}
                  {sidebarProfessionals.length === 0 && <div className="p-4 text-center text-xs text-slate-400">Nenhum profissional.</div>}
                </div>
              </div>

              {/* Área do Calendário em Grade */}
              <div className="flex-1 overflow-auto bg-slate-100/30 dark:bg-slate-950 relative custom-scrollbar">
                {sectorFilter === 'todos' ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                    <Building2 className="w-12 h-12 mb-4 opacity-50 text-slate-300" />
                    <p className="font-bold text-slate-600 dark:text-slate-300">Selecione um Setor Específico</p>
                    <p className="text-sm mt-1">O modo Grade exige um setor selecionado para permitir a alocação de nomes.</p>
                  </div>
                ) : (
                  <div className="min-w-[900px] pb-10">
                    <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 sticky top-0 z-20 shadow-sm">
                      <div className="p-3 border-r border-slate-200 dark:border-slate-800 flex items-center justify-center font-black text-xs text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-800/80">Turno</div>
                      {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map(day => (
                        <div key={day} className="p-3 border-r border-slate-200 dark:border-slate-800 text-center font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider">{day}</div>
                      ))}
                    </div>

                    {weeksDataGrid.map((week, wIndex) => (
                      <div key={wIndex} className="border-b-[6px] border-slate-200 dark:border-slate-800/50">
                        <div className="grid grid-cols-8 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                          <div className="p-2 border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80"></div>
                          {week.map((date, dIndex) => (
                            <div key={dIndex} className={`p-1 border-r border-slate-200 dark:border-slate-800 text-right pr-2 text-[10px] font-black ${date ? 'text-slate-500 dark:text-slate-400' : 'text-transparent'}`}>
                              {date ? `${date.split('-')[2]}/${date.split('-')[1]}` : '-'}
                            </div>
                          ))}
                        </div>

                        {displayShiftsGrid.map((period) => (
                          <div key={period.id} className="grid grid-cols-8 border-b border-slate-100 dark:border-slate-800/50 last:border-b-0 group">
                            
                            {/* Nome da Linha do Turno */}
                            <div className="p-3 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex flex-col items-center justify-center">
                              <span className="font-black text-[11px] uppercase text-slate-700 dark:text-slate-300 text-center">{period.name}</span>
                              <span className="text-[9px] font-bold text-slate-400">{period.start} - {period.end}</span>
                            </div>

                            {/* Dias (Colunas) */}
                            {week.map((date, dIndex) => {
                              if (!date) return <div key={dIndex} className="bg-slate-50 dark:bg-slate-900/20 border-r border-slate-200 dark:border-slate-800 p-2"></div>;

                              const shiftDateStr = String(date || '');
                              const slotShifts = filteredShifts.filter(s => String(s.date || '').startsWith(shiftDateStr) && s.builderId === period.id);
                              const isSelected = selectedCells.some(c => c.date === date && c.builderId === period.id);
                              
                              // Verifica a escala base para gerar as vagas vazias necessárias para este dia
                              const dIndexBase = new Date(`${date}T12:00:00`).getDay();
                              const isActiveInBase = period.cellStates && period.cellStates[dIndexBase];
                              const requiredQty = isActiveInBase ? (period.qty || 1) : 0;
                              
                              // Criando o array de renders preenchendo as vagas faltantes
                              const renders = [...slotShifts];
                              for(let q = slotShifts.length; q < requiredQty; q++){
                                renders.push({ isVirtualVacant: true, isVacant: true });
                              }

                              return (
                                <div 
                                  key={dIndex} 
                                  className={`border-r border-slate-200 dark:border-slate-800/50 p-1.5 min-h-[70px] relative transition-colors cursor-pointer flex flex-col gap-1 ${isSelected ? 'bg-sky-50 dark:bg-sky-900/20 ring-inset ring-2 ring-sky-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                                  onDragOver={handleDragOver}
                                  onDrop={(e) => handleDrop(e, date, period.id)}
                                  onClick={(e) => handleCellClick(e, date, period.id)}
                                  title="Ctrl+Click para selecionar múltiplos. Clique simples para Novo Plantão."
                                >
                                  {renders.length === 0 && !isActiveInBase && (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-30 text-xs font-black text-slate-400">-</div>
                                  )}

                                  {renders.map((s, idx) => (
                                    <div key={s.id || `vaga_${idx}`} className={`relative p-2 rounded-lg text-[10px] border flex items-center justify-between group/item transition-all hover:scale-[1.02] shadow-sm ${s.isVacant ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 text-amber-800 dark:text-amber-200 border-dashed' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100'}`}>
                                      <span className="font-bold truncate pr-4">{s.isVacant ? 'Vaga Aberta' : toTitleCase(s.professional_name)}</span>
                                      
                                      {!s.isVacant && isPublished && (
                                        <div className="absolute -top-2 left-2 opacity-0 group-hover/item:opacity-100 transition-opacity bg-emerald-500 text-white text-[8px] font-black px-1.5 rounded uppercase shadow-sm z-10 pointer-events-none">Publicado</div>
                                      )}

                                      {!s.isVacant && s.id && (
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} className="opacity-0 group-hover/item:opacity-100 p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded transition-opacity absolute right-1">
                                          <X className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}

                                  {/* Busca Inline (Duplo Clique) */}
                                  {inlineEditingCell?.date === date && inlineEditingCell?.periodId === period.id && (
                                    <div className="absolute inset-0 z-30 bg-white dark:bg-slate-900 border-2 border-sky-500 rounded-lg p-1 shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
                                      <div className="flex items-center gap-1 border-b dark:border-slate-700 pb-1 mb-1">
                                        <Search className="w-3 h-3 text-slate-400" />
                                        <input autoFocus type="text" placeholder="Buscar..." className="w-full text-[10px] outline-none bg-transparent font-medium dark:text-white" value={inlineSearchText} onChange={e => setInlineSearchText(e.target.value)} onKeyDown={(e) => { if(e.key === 'Escape') setInlineEditingCell(null); }} />
                                        <button onClick={() => setInlineEditingCell(null)}><X className="w-3 h-3 text-slate-400 hover:text-red-500"/></button>
                                      </div>
                                      <div className="flex-1 overflow-y-auto space-y-0.5 custom-scrollbar">
                                        {(professionals || []).filter(p => !inlineSearchText || normalizeStr(p.name || p.full_name).includes(normalizeStr(inlineSearchText))).slice(0, 5).map(p => (
                                          <button key={p.id} className="w-full text-left px-2 py-1 text-[10px] hover:bg-sky-50 dark:hover:bg-slate-800 rounded truncate text-slate-700 dark:text-slate-300 font-medium" onClick={() => { assignShift(date, period.id, p.id); setInlineEditingCell(null); setInlineSearchText(''); }}>
                                            {p.name || p.full_name || 'Sem nome'}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ===================== MODO LISTA DIÁRIA ===================== */}
        {viewMode === 'list' && (
          <div className="overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950 flex-1">
             {filteredShifts.length === 0 ? (
                <div className="py-12 text-center text-slate-400">Nenhum plantão localizado neste filtro.</div>
              ) : (
                filteredShifts.sort((a,b) => String(a.date).localeCompare(String(b.date))).map(s => {
                  const sTime = typeof s.start_time === 'string' ? s.start_time : '00:00';
                  const isDone = ['concluded', 'recently_finished'].includes(s.lifecycle?.state);

                  return (
                    <div key={s.id} className={`flex items-center gap-3 rounded-2xl border p-3 bg-white dark:bg-slate-900 transition-colors shadow-sm ${s.isVacant ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
                      <div className={`min-w-[85px] rounded-xl py-2 text-center text-xs font-black border shrink-0 ${isDone ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}>
                        {fmtDate(s.date)} <br/>
                        <span className={isDone ? "text-slate-400" : "text-sky-600 dark:text-sky-400"}>{s.start_time || '--'} - {s.end_time || '--'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <strong className={`block text-sm truncate ${s.isVacant ? 'text-amber-800 dark:text-amber-400' : (isDone ? 'text-slate-500' : 'text-slate-800 dark:text-white')}`}>
                          {toTitleCase(s.professional_name) || 'Vaga Aberta'}
                        </strong>
                        <span className="text-xs text-slate-400">{toTitleCase(s.sector_name)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isDone ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-400">
                            <Lock className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Concluído</span>
                          </div>
                        ) : (
                          <>
                            {s.isVacant ? (
                              <Button size="sm" onClick={() => { setEditing(s); setDialogOpen(true); }} className="h-8 bg-amber-500 hover:bg-amber-600 text-white"><UserPlus className="w-3.5 h-3.5 mr-1" /> Alocar</Button>
                            ) : (
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50"><MessageCircle className="w-4 h-4"/></Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setDialogOpen(true); }} className="h-8 w-8 text-slate-500"><Pencil className="w-4 h-4"/></Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(s.id)} className="h-8 w-8 text-red-500"><Trash2 className="w-4 h-4"/></Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
          </div>
        )}

        {/* ===================== MODO BASE BUILDER (CRIAÇÃO DE ESCALA BASE) ===================== */}
        {viewMode === 'base_builder' && (
          <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-6 flex justify-center">
            <div className="w-full max-w-5xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-sky-700 dark:text-sky-400">Escala Base (Modo Edição)</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Configure os padrões de horário e a quantidade de vagas ativas na semana.</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Data de Início da Aplicação</label>
                  <Input type="date" className="h-10 w-40 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                  <Button variant="outline" onClick={downloadBackupBase} className="h-10 gap-2"><Download className="w-4 h-4" /> Backup Local</Button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[10px] font-bold">
                      <tr>
                        <th className="p-4 w-48 text-center border-r border-slate-200 dark:border-slate-700">Padrão Operacional</th>
                        {WEEK_DAYS_ORDER.map(day => (
                          <th key={day.index} className={`p-4 text-center border-r border-slate-200 dark:border-slate-700 ${day.weekend ? 'bg-slate-200/50 dark:bg-slate-700/50' : ''}`}>
                            {day.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {builderShifts.length === 0 ? (
                        <tr><td colSpan="8" className="p-12 text-center text-slate-400 text-sm">Nenhum horário configurado. Adicione um novo abaixo para moldar a grade.</td></tr>
                      ) : (
                        builderShifts.map(shift => {
                          const shiftColorClass = shift.color || BUILDER_COLORS[0].value;
                          return (
                            <tr key={shift.id}>
                              <td className={`p-4 font-bold border-r border-slate-200 dark:border-slate-800 ${shiftColorClass} relative group/header`}>
                                <div className="flex flex-col items-center justify-center text-center">
                                  <span className="text-sm">{shift.name}</span>
                                  <span className="text-[10px] opacity-70 mt-0.5">{shift.start} às {shift.end}</span>
                                </div>
                                <button onClick={() => openEditBuilderModal(shift)} className="absolute top-2 right-2 p-1.5 bg-white/50 hover:bg-white rounded-lg text-slate-700 opacity-0 group-hover/header:opacity-100 transition-all shadow-sm">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </td>
                              {WEEK_DAYS_ORDER.map(day => {
                                const isActive = (shift.cellStates || {})[day.index];
                                return (
                                  <td key={day.index} className={`p-0 border-r border-slate-100 dark:border-slate-800 text-center relative ${day.weekend ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''}`}>
                                    <div className="relative w-full h-full min-h-[70px] flex items-center justify-center group/cell cursor-pointer" onClick={() => toggleBuilderCell(shift.id, day.index)}>
                                      <div className={`w-8 h-8 mx-auto rounded-lg font-black text-sm flex items-center justify-center transition-colors ${isActive ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'bg-transparent text-slate-300 dark:text-slate-600'}`}>
                                        {isActive ? shift.qty : '-'}
                                      </div>
                                      <div className="absolute inset-0 bg-slate-900/80 text-white text-[10px] font-bold flex flex-col items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                        {isActive ? 'Desativar Vaga?' : 'Ativar Vaga?'}
                                      </div>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center bg-slate-50 dark:bg-slate-900/50">
                  <Button variant="ghost" onClick={openNewBuilderModal} className="text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-900/30 font-bold text-xs gap-1.5 h-9">
                    <Plus className="w-4 h-4" /> Adicionar Horário / Turno na Grade
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-800">
                <Button variant="outline" onClick={() => setViewMode('grade')} className="font-bold border-slate-300 dark:border-slate-700 h-11 px-8">Cancelar</Button>
                <Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold h-11 px-8 shadow-md" onClick={() => { alert('Escala Base salva com sucesso no sistema!'); setViewMode('grade'); }}>Salvar Escala Base</Button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ========================================================
          MODAIS E DIALOGS DE SOBREPOSIÇÃO
          ======================================================== */}

      {/* Modal: Configurar Horário Específico no Builder (Passo 3) */}
      {builderModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-black text-sky-600 dark:text-sky-400">
                {builderModal.isNew ? 'Novo Horário na Escala' : 'Editar Horário'}
              </h2>
              <button onClick={() => setBuilderModal(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Nome do Turno</label>
                <Input value={builderForm.name} onChange={e => setBuilderForm({...builderForm, name: e.target.value})} placeholder="Ex: Plantão Diurno, UTI Noturna" className="h-11 font-medium bg-white dark:bg-slate-950" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Início</label>
                  <Input type="time" value={builderForm.start} onChange={e => setBuilderForm({...builderForm, start: e.target.value})} className="h-11 font-medium bg-white dark:bg-slate-950" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Término</label>
                  <Input type="time" value={builderForm.end} onChange={e => setBuilderForm({...builderForm, end: e.target.value})} className="h-11 font-medium bg-white dark:bg-slate-950" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 items-center">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Nº de Vagas por Dia</label>
                  <Input type="number" min="1" value={builderForm.qty} onChange={e => setBuilderForm({...builderForm, qty: Number(e.target.value)})} className="h-11 font-bold text-lg bg-white dark:bg-slate-950 text-center" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Cor de Fundo</label>
                  <div className="flex gap-2 p-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/50">
                    {BUILDER_COLORS.map(c => (
                      <button key={c.id} onClick={() => setBuilderForm({...builderForm, color: c})} className={`w-6 h-6 rounded-md ${c.bg} shadow-sm transition-transform ${builderForm.color?.id === c.id ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 block">Dias Ativos Iniciais</label>
                <div className="flex justify-between gap-1">
                  {WEEK_DAYS_ORDER.map(day => {
                    const isSelected = (builderForm.days || []).includes(day.index);
                    return (
                      <button key={day.index} onClick={() => toggleBuilderDay(day.index)} className={`flex-1 flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${isSelected ? 'bg-sky-50 border-sky-300 text-sky-700 dark:bg-sky-900/40 dark:border-sky-700 dark:text-sky-300 shadow-sm' : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                        <span className="text-[9px] font-black uppercase mb-1">{day.short}</span>
                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${isSelected ? 'bg-sky-500 border-sky-600 text-white' : 'bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-700'}`}>
                          {isSelected && <CheckCircle2 className="w-2.5 h-2.5" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex justify-between items-center pt-5 mt-2">
                {!builderModal.isNew ? (
                  <Button variant="ghost" className="text-red-500 hover:bg-red-50 font-bold text-xs" onClick={() => { setBuilderShifts(prev => prev.filter(s => s.id !== builderForm.id)); setBuilderModal(null); }}>
                    <Trash2 className="w-4 h-4 mr-1.5" /> Excluir Turno
                  </Button>
                ) : <div/>}
                <Button className="bg-sky-600 hover:bg-sky-700 text-white font-bold h-11 px-8 shadow-md" onClick={saveBuilderShift}>Aplicar na Grade</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Plantão Individual (Clique Simples na Célula na Grade) */}
      {newShiftModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-black text-sky-600 dark:text-sky-400">Novo Plantão</h2>
              <button onClick={() => { setNewShiftModal(null); setSelectedProfIdForModal(''); }}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="p-6 space-y-4 text-sm font-medium text-slate-700 dark:text-slate-300">
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-right text-xs font-bold text-slate-500">Plantonista:</label>
                <Select value={selectedProfIdForModal || undefined} onValueChange={setSelectedProfIdForModal}>
                  <SelectTrigger className="col-span-2 h-10 text-xs bg-white dark:bg-slate-950"><SelectValue placeholder="Busque um profissional..." /></SelectTrigger>
                  <SelectContent>
                    {(professionals || []).filter(p => p && p.id).map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name || p.full_name || 'Sem nome'}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-right text-xs font-bold text-slate-500">Equipe / Turno:</label>
                <div className="col-span-2 font-bold text-slate-900 dark:text-white capitalize px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                  {builderShifts.find(p => p.id === newShiftModal.builderId)?.name || newShiftModal.builderId}
                </div>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-right text-xs font-bold text-slate-500">Dia / Data:</label>
                <div className="col-span-2 font-bold text-slate-900 dark:text-white">{fmtDateLong(newShiftModal.date)} - {formatDateBR(newShiftModal.date)}</div>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800 my-5" />
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-right text-xs font-bold text-slate-500">Repetir a cada:</label>
                <Select defaultValue="0">
                  <SelectTrigger className="col-span-2 h-10 text-xs bg-white dark:bg-slate-950"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="0">Não Repetir</SelectItem><SelectItem value="1">1 Semana</SelectItem><SelectItem value="2">2 Semanas</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex justify-end pt-5">
                <Button onClick={() => { if (!selectedProfIdForModal) { alert('Selecione um profissional da lista.'); return; } assignShift(newShiftModal.date, newShiftModal.builderId, selectedProfIdForModal); setNewShiftModal(null); setSelectedProfIdForModal(''); alert('Plantão alocado e salvo com sucesso!'); }} className="bg-sky-600 hover:bg-sky-700 text-white font-bold h-11 px-8 shadow-md">
                  Alocar Profissional
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Padrão e Relatórios */}
      <ShiftFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={loadData} shift={editing} sectors={sectors} professionals={professionals} companyId={companyId} unitId={unitId} />
      {reportModalOpen && <ReportPreviewModal reportPayload={reportPayload} reportHash={reportHash} hashLoading={hashLoading} reportStatus={reportStatus} reportVersion={reportVersion} onClose={() => setReportModalOpen(false)} onPrint={printReport} onExport={exportCSV} onStatusChange={setReportStatus} onNewVersion={() => setReportVersion(v => v + 1)} />}
    </div>
  );
}

/* ============================================================
   SUB-COMPONENTES DA TELA E RELATÓRIOS
   ============================================================ */

function SidebarItem({ active, icon: Icon, label, onClick }) {
  const IconComp = Icon || Activity;
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl mb-1 transition-all ${active ? 'bg-white/10 text-white font-bold' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
      <IconComp className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-sky-400' : ''}`} />
      <span className="text-sm flex-1 text-left">{label}</span>
      {active && <ChevronRight className="w-4 h-4 opacity-50" />}
    </button>
  );
}

function KpiCard({ title, value, highlight }) {
  return (
    <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{title}</div>
      <div className={`text-2xl font-black ${highlight || 'text-slate-900 dark:text-white'}`}>{value}</div>
    </Card>
  );
}

function ExecutiveView({ baseMetrics, riskRows, byProfessional, criticalAlerts, financialData }) {
  const topProfessionals = (byProfessional || []).slice(0, 8);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="xl:col-span-2 p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 transition-colors">
          <div className="flex items-center justify-between mb-6"><div><h2 className="text-lg font-bold text-slate-900 dark:text-white">Resumo executivo</h2><p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Indicadores consolidados</p></div><Activity className="w-5 h-5 text-slate-400" /></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ExecutiveMetric label="Cobertura" value={`${formatNumber(baseMetrics.coverage, 1)}%`} />
            <ExecutiveMetric label="Horas" value={formatNumber(baseMetrics.confirmedHours, 1)} />
            <ExecutiveMetric label="Custo Estimado" value={formatCurrency(financialData.estimatedCost)} />
            <ExecutiveMetric label="Cancelamentos" value={formatNumber(baseMetrics.canceled)} />
          </div>
        </Card>
        <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 transition-colors">
          <div className="flex items-center gap-2 mb-5"><ShieldCheck className="w-5 h-5 text-slate-700 dark:text-slate-300" /><h2 className="font-bold text-slate-900 dark:text-white">Situação operacional</h2></div>
          <div className="space-y-4">
            <StatusLine label="Regular" value={(riskRows || []).filter((r) => r.level === 'regular').length} type="success" />
            <StatusLine label="Atenção" value={(riskRows || []).filter((r) => r.level === 'atencao').length} type="warning" />
            <StatusLine label="Crítico" value={(riskRows || []).filter((r) => r.level === 'critico').length} type="danger" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function ExecutiveMetric({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-xl font-bold mt-1 text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

function StatusLine({ label, value, type }) {
  const styles = { success: 'bg-emerald-50 text-emerald-700', warning: 'bg-amber-50 text-amber-700', danger: 'bg-red-50 text-red-700' };
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${styles[type]}`}>{formatNumber(value)}</span>
    </div>
  );
}

function CoverageBar({ label, value }) {
  const numeric = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 text-xs"><span className="font-medium text-slate-700 dark:text-slate-300 truncate pr-3">{label}</span><span className="font-bold text-slate-600 dark:text-slate-300">{formatNumber(numeric, 1)}%</span></div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${numeric}%` }} /></div>
    </div>
  );
}

function ProductivityView({ rows, baseMetrics }) {
  return (
    <ReportCard title="Produtividade por profissional">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
              <th className="py-3 pr-4">Profissional</th><th className="py-3 px-4">Categoria</th><th className="py-3 px-4 text-right">Total</th><th className="py-3 px-4 text-right">Confirmados</th><th className="py-3 px-4 text-right">Pendentes</th><th className="py-3 px-4 text-right">Cancelados</th><th className="py-3 pl-4 text-right">Horas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-800 dark:text-slate-200">
            {(rows || []).map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">{row.name}</td>
                <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{row.category}</td>
                <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">{formatNumber(row.total)}</td>
                <td className="py-3 px-4 text-right text-emerald-700 dark:text-emerald-400 font-semibold">{formatNumber(row.confirmed)}</td>
                <td className="py-3 px-4 text-right text-amber-700 dark:text-amber-400">{formatNumber(row.pending)}</td>
                <td className="py-3 px-4 text-right text-red-700 dark:text-red-400">{formatNumber(row.canceled)}</td>
                <td className="py-3 pl-4 text-right font-bold text-slate-900 dark:text-slate-100">{formatNumber(row.hours, 1)}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportCard>
  );
}

function CoverageView({ rows }) {
  return (
    <div className="space-y-5">
      <ReportCard title="Cobertura operacional por setor">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
          {(rows || []).map((row) => <CoverageBar key={row.name} label={row.name} value={row.coverage} />)}
        </div>
      </ReportCard>
    </div>
  );
}

function RiskView({ rows }) {
  return (
    <ReportCard title="Painel de risco operacional">
      <div className="space-y-3 mt-4">
        {(rows || []).map((row) => {
          const levelConfig = { regular: { label: 'Regular', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }, atencao: { label: 'Atenção', className: 'bg-amber-50 text-amber-700 border-amber-200' }, critico: { label: 'Crítico', className: 'bg-red-50 text-red-700 border-red-200' } }[row.level];
          return (
            <div key={row.name} className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
              <div className="flex-1">
                <div className="font-semibold text-slate-900 dark:text-white">{row.name}</div>
                <div className="text-xs text-slate-500 mt-1">{row.confirmed} confirmados de {row.total} registros</div>
              </div>
              <div className="w-full md:w-64"><CoverageBar label="" value={row.coverage} /></div>
              <div className={`px-3 py-2 rounded-lg border text-xs font-bold text-center ${levelConfig.className}`}>{levelConfig.label}</div>
            </div>
          );
        })}
      </div>
    </ReportCard>
  );
}

function FinancialView({ data }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Custo Estimado</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(data.estimatedCost)}</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Com Valor Base</div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatNumber(data.knownRates)}</div>
        </Card>
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Sem Valor Informado</div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{formatNumber(data.missingRates)}</div>
        </Card>
      </div>

      <ReportCard title="Detalhamento financeiro">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <th className="py-3 pr-4">Profissional</th><th className="py-3 px-4">Setor</th><th className="py-3 px-4 text-right">Horas</th><th className="py-3 px-4 text-right">Valor/Hora</th><th className="py-3 pl-4 text-right">Custo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-800 dark:text-slate-200">
              {(data.rows || []).map((row, index) => {
                const isCanceled = row.status === 'cancelado' || row.status === 'canceled';
                return (
                  <tr key={`${row.professional}-${index}`} className={`transition-colors ${isCanceled ? 'bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-slate-50/50'}`}>
                    <td className={`py-3 pr-4 font-medium ${isCanceled ? 'text-red-700 line-through opacity-70' : 'text-slate-900 dark:text-slate-100'}`}>{row.professional}</td>
                    <td className={`py-3 px-4 ${isCanceled ? 'text-red-400 line-through opacity-70' : 'text-slate-500'}`}>{row.sector}</td>
                    <td className={`py-3 px-4 text-right ${isCanceled ? 'text-red-400 line-through opacity-70' : ''}`}>{formatNumber(row.hours, 1)}h</td>
                    <td className={`py-3 px-4 text-right ${isCanceled ? 'text-red-400 line-through opacity-70' : ''}`}>{row.rate === null ? '—' : formatCurrency(row.rate)}</td>
                    <td className={`py-3 pl-4 text-right font-semibold ${isCanceled ? 'text-red-600' : 'text-emerald-600'}`}>{isCanceled ? 'Cancelado' : (row.cost === null ? '—' : formatCurrency(row.cost))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ReportCard>
    </div>
  );
}

function CancellationView({ rows }) {
  return (
    <ReportCard title="Cancelamentos registrados">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
              <th className="py-3 pr-4">Data</th><th className="py-3 px-4">Profissional</th><th className="py-3 px-4">Setor</th><th className="py-3 pl-4">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-800 dark:text-slate-200">
            {(rows || []).map((row, index) => (
              <tr key={`${row.date}-${index}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="py-3 pr-4">{formatDateBR(row.date)}</td><td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{row.professional}</td><td className="py-3 px-4 text-slate-500 dark:text-slate-400">{row.sector}</td><td className="py-3 pl-4 text-red-600 dark:text-red-400 font-medium">{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportCard>
  );
}

function GovernanceView({ reportId, version, status, hash, hashLoading, auditEvents, onGenerateHash, onStatusChange, onNewVersion }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <h2 className="font-bold dark:text-white mb-5">Governança do documento</h2>
          <div className="space-y-3">
            {['Rascunho', 'Em revisão', 'Aprovado'].map((option) => (
              <button key={option} type="button" onClick={() => onStatusChange(option)} className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all ${status === option ? 'border-sky-600 bg-sky-600 text-white font-bold' : 'border-slate-200 hover:bg-slate-50 dark:text-white'}`}>
                <span className="font-medium text-sm">{option}</span>
                {status === option && <CheckCircle2 className="w-5 h-5" />}
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" className="w-full mt-4 gap-2 dark:text-white" onClick={onNewVersion}><History className="w-4 h-4" /> Nova versão</Button>
        </Card>
      </div>
    </div>
  );
}

function ReportCard({ title, description, children }) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
        <h2 className="font-bold text-lg dark:text-white">{title}</h2>
        {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </Card>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="py-12 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <Search className="w-5 h-5 text-slate-400" />
      </div>
      <h3 className="font-semibold text-slate-800 dark:text-white mt-4">{title}</h3>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>
    </div>
  );
}

function ReportPreviewModal({ reportPayload, reportHash, hashLoading, reportStatus, reportVersion, onClose, onPrint, onExport, onStatusChange }) {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-5">
      <div className="w-full h-full max-w-[1500px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="h-auto min-h-[68px] bg-slate-950 text-white px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center"><FileCheck2 className="w-5 h-5" /></div>
            <div>
              <div className="font-semibold text-sm">Pré-visualização oficial</div>
              <div className="text-[11px] text-slate-400">{reportPayload.reportId} • v{reportVersion}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={onExport} className="gap-2 bg-transparent text-white border-white/20 hover:bg-white/10"><Download className="w-4 h-4" /> CSV</Button>
            <Button type="button" onClick={onPrint} className="gap-2 bg-sky-600 hover:bg-sky-500 border-0"><Printer className="w-4 h-4" /> Imprimir A4 / PDF</Button>
            <Button type="button" variant="ghost" onClick={onClose} className="text-white hover:bg-white/10"><X className="w-5 h-5" /></Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-100 p-8 flex justify-center">
          <div className="w-[210mm] bg-white p-12 shadow-lg text-slate-900 text-xs">
            <h1 className="text-2xl font-black mb-2">{reportPayload.title}</h1>
            <p><strong>Filtros:</strong> {reportPayload.filtersLabel}</p>
            <p><strong>Emissão:</strong> {new Date().toLocaleString('pt-BR')}</p>
            <hr className="my-6 border-slate-300" />
            <table className="w-full text-left border-collapse border border-slate-300">
              <thead className="bg-slate-200">
                <tr>{(reportPayload.columns || []).map(c => <th key={c} className="border border-slate-300 p-2">{c}</th>)}</tr>
              </thead>
              <tbody>
                {(reportPayload.rows || []).map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j} className="border border-slate-300 p-2">{c}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}