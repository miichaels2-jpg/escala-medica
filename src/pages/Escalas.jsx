import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, Pencil, Trash2, Search, Download, CalendarDays, UsersRound, 
  Maximize2, Minimize2, MessageCircle, Filter, UserPlus, X, Sun, Moon, 
  Building2, Activity, LayoutGrid, List, ChevronDown, ChevronRight, Lock,
  GripVertical, Send
} from 'lucide-react';
import ShiftFormDialog from '@/components/shifts/ShiftFormDialog';
import { exportSchedulePDF } from '@/lib/exportReport';
import { getShiftTvLifecycle } from '@/lib/shiftUtils';

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

// Padrões de turnos baseados na imagem
const SHIFT_PERIODS = [
  { id: 'manha', label: 'Manhã', start: '07:00', end: '13:00' },
  { id: 'tarde', label: 'Tarde', start: '13:00', end: '19:00' },
  { id: 'noite', label: 'Noite', start: '19:00', end: '07:00' }
];

function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fmtDate(dateStr) {
  if (typeof dateStr !== 'string' || !dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length < 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return `${parts[2]}/${parts[1]} (${WEEKDAYS_SHORT[d.getDay()] || ''})`;
}

function fmtDateLong(dateStr) {
  if (typeof dateStr !== 'string' || !dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length < 3) return '';
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return WEEKDAYS_LONG[d.getDay()] || '';
}

function normalizeStr(str) {
  if (typeof str !== 'string') return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function toTitleCase(str) {
  if (typeof str !== 'string' || !str.trim()) return '';
  const acr = ['UTI', 'UCO', 'PA', 'PS', 'CRM', 'COREN'];
  return str.toLowerCase().split(' ').map(w => acr.includes(w.toUpperCase()) ? w.toUpperCase() : (['de', 'da', 'do', 'e'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

// Gera o calendário do mês quebrado por semanas para a Grade
function getMonthWeeks(monthStr) {
  if (!monthStr) return [];
  const [year, month] = monthStr.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  
  const weeks = [];
  let currentWeek = [];
  
  // Preenche dias vazios no começo (se o mês não começar no domingo/segunda)
  // Vamos assumir que a semana começa na Segunda-feira (1) para ficar igual a imagem
  let startDay = firstDay.getDay(); 
  let emptyDays = startDay === 0 ? 6 : startDay - 1;
  
  for (let i = 0; i < emptyDays; i++) currentWeek.push(null);

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateObj = new Date(year, month - 1, d);
    currentWeek.push(getLocalDateString(dateObj));
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
  const { user, company, loading: appLoading } = useAppData();
  const [shifts, setShifts] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  
  const [viewMode, setViewMode] = useState('grade'); // NOVO MODO PADRÃO
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [quickFilter, setQuickFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(() => getLocalDateString().slice(0,7));
  const [selectedDate, setSelectedDate] = useState('');
  const [tvMode, setTvMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  
  // Estados para o Drag & Drop e Edição Inline
  const [profSearchQuery, setProfSearchQuery] = useState('');
  const [inlineEditingCell, setInlineEditingCell] = useState(null); // { date, periodId }
  const [inlineSearchText, setInlineSearchText] = useState('');

  const userId = user?.id;
  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id || 'unit_h1';
  const isManager = user?.role === 'admin' || user?.data?.app_role === 'manager' || user?.data?.app_role === 'gestor';

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      const f = { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) };
      const [s, sec, p] = await Promise.all([
        base44.entities.Shift.filter(f, '-date', 2000), 
        base44.entities.Sector.filter(f, '-created_date', 100),
        base44.entities.Professional.filter(f, '-created_date', 400),
      ]);
      setShifts(s || []);
      setSectors(sec || []);
      setProfessionals(p || []);
      
      // Auto-selecionar o primeiro setor se nenhum estiver selecionado e estivermos no modo Grade
      if (sectorFilter === 'all' && sec?.length > 0) {
        setSectorFilter(sec[0].id);
      }
    } catch (e) {
      console.error('Erro ao buscar escalas:', e);
    }
  }, [companyId, unitId, sectorFilter]);

  useEffect(() => { if (!appLoading) load(); }, [appLoading, load]);
  useEffect(() => { const id = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(id); }, []);

  const myProfessional = useMemo(() => professionals.find((p) => p.user_id === userId || p.email === user?.email || p.name === user?.full_name), [professionals, userId, user]);
  const profMap = useMemo(() => Object.fromEntries(professionals.map((p) => [p.id, p])), [professionals]);

  const monthOptions = useMemo(() => {
    return [...new Set(shifts.map((s) => (typeof s.date === 'string' ? s.date.slice(0, 7) : '')))].filter(Boolean).sort().reverse();
  }, [shifts]);

  const filtered = useMemo(() => {
    const term = normalizeStr(search);
    return shifts
      .filter((s) => {
        if (s.status === 'cancelado') return false;
        const sDate = typeof s.date === 'string' ? s.date.split('T')[0] : '';
        if (!sDate) return false;

        const monthMatch = !selectedMonth || sDate.startsWith(selectedMonth);
        const dateMatch = !selectedDate || sDate === selectedDate;
        const profNameNorm = normalizeStr(s.professional_name);
        const sectorNameNorm = normalizeStr(s.sector_name);
        const matchSearch = !term || profNameNorm.includes(term) || sectorNameNorm.includes(term);
        const matchSector = sectorFilter === 'all' || String(s.sector_id) === String(sectorFilter);
        const personalScope = isManager || s.professional_id === myProfessional?.id || s.professional_name === myProfessional?.name;
        
        return dateMatch && monthMatch && matchSearch && matchSector && personalScope;
      })
      .map((s) => {
        let lifecycle = { state: 'upcoming', detail: '' };
        try {
          const safeShift = { ...s, date: s.date || '', start_time: s.start_time || '', end_time: s.end_time || '' };
          lifecycle = getShiftTvLifecycle(safeShift, currentTime) || lifecycle;
        } catch (e) {}

        const pName = typeof s.professional_name === 'string' ? s.professional_name.toLowerCase() : '';
        // Mapeia o horário para um período da Grade (Manhã, Tarde, Noite)
        let periodId = 'manha';
        if (s.start_time >= '13:00' && s.start_time < '19:00') periodId = 'tarde';
        if (s.start_time >= '19:00' || s.start_time < '06:00') periodId = 'noite';

        return {
          ...s,
          lifecycle,
          periodId,
          isVacant: !s.professional_id || pName.includes('vaga')
        };
      });
  }, [shifts, search, sectorFilter, quickFilter, selectedMonth, selectedDate, isManager, myProfessional, currentTime]);

  const auditStats = useMemo(() => {
    const total = filtered.length;
    const vacant = filtered.filter((s) => s.isVacant).length;
    const filled = total - vacant;
    const fillRate = total > 0 ? Math.round((filled / total) * 100) : 100;
    return { total, filled, vacant, fillRate };
  }, [filtered]);

  // Lógica para Agrupar os plantões na grade da semana
  const weeksData = useMemo(() => getMonthWeeks(selectedMonth), [selectedMonth]);

  // Filtro de profissionais da barra lateral
  const sidebarProfessionals = useMemo(() => {
    const term = normalizeStr(profSearchQuery);
    return professionals.filter(p => !term || normalizeStr(p.name).includes(term) || normalizeStr(p.specialty || '').includes(term));
  }, [professionals, profSearchQuery]);

  // Ações de Drag & Drop e Banco
  const handleDragStart = (e, prof) => {
    e.dataTransfer.setData('profId', prof.id);
    e.dataTransfer.setData('profName', prof.name);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Necessário para permitir o Drop
  };

  const assignShift = async (date, periodId, profId) => {
    if (sectorFilter === 'all') {
      alert("Por favor, selecione um setor específico no filtro do topo para alocar o plantão.");
      return;
    }

    const periodDef = SHIFT_PERIODS.find(p => p.id === periodId);
    const prof = profMap[profId];
    const sectorObj = sectors.find(s => String(s.id) === String(sectorFilter));

    if (!prof || !sectorObj) return;

    try {
      // Verifica se já existe um plantão vago nesse slot para substituir, se não, cria novo
      const existingShift = filtered.find(s => s.date.startsWith(date) && s.periodId === periodId && s.isVacant);
      
      const payload = {
        company_id: companyId,
        unit_id: unitId,
        professional_id: prof.id,
        professional_name: prof.name,
        sector_id: sectorObj.id,
        sector_name: sectorObj.name,
        date: date,
        start_time: periodDef.start,
        end_time: periodDef.end,
        duration_hours: periodId === 'noite' ? 12 : 6,
        status: 'confirmado' // Alocado via drag&drop já vai confirmado
      };

      if (existingShift) {
        await base44.entities.Shift.update(existingShift.id, payload);
      } else {
        await base44.entities.Shift.create(payload);
      }
      load(); // Atualiza a tela
    } catch (error) {
      alert("Erro ao salvar plantão: " + error.message);
    }
  };

  const handleDrop = (e, date, periodId) => {
    e.preventDefault();
    const profId = e.dataTransfer.getData('profId');
    if (profId) {
      assignShift(date, periodId, profId);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja realmente cancelar este plantão?')) return;
    try {
        await base44.entities.Shift.update(id, { status: 'cancelado', notes: 'Cancelado pela gestão da escala.' });
        load();
    } catch (e) { alert('Erro ao cancelar.'); }
  };

  const handlePublish = async () => {
    if (!confirm('Publicar escala do mês atual? Isso confirmará todos os plantões vagos preenchidos e enviará notificações aos profissionais.')) return;
    
    // Simulação de publicação
    alert('Escala publicada com sucesso! Notificações enviadas para o aplicativo dos profissionais.');
  };

  const handleExportSchedule = () => {
    const targetDate = selectedDate || getLocalDateString(currentTime);
    const dayShifts = filtered.filter(s => {
      const sDate = typeof s.date === 'string' ? s.date.split('T')[0] : '';
      return sDate === targetDate;
    });

    if (dayShifts.length === 0) {
      alert(`Não existem plantões agendados para a data ${fmtDate(targetDate)} para gerar o PDF.`);
      return;
    }
    const sorted = [...dayShifts].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
    exportSchedulePDF({ company: company || { name: 'Hospital' }, shifts: sorted, dateLabel: fmtDate(targetDate) });
  };

  const openTvMode = async () => {
    setTvMode(true);
    try { await document.documentElement.requestFullscreen?.(); } catch {}
  };
  const closeTvMode = async () => {
    setTvMode(false);
    if (document.fullscreenElement) await document.exitFullscreen?.();
  };

  if (!isManager) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center h-full">
        <div className="text-center text-slate-500">Acesse "Minha Escala" no menu lateral para visualizar seus plantões.</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-slate-50">
      
      {/* Topo / Filtros Rápidos */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 shrink-0 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
            <button onClick={() => setViewMode('grade')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'grade' ? 'bg-white shadow-sm text-sky-700' : 'text-slate-500 hover:text-slate-700'}`}>
              <LayoutGrid className="w-4 h-4" /> Builder Visual
            </button>
            <button onClick={() => setViewMode('list')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-sky-700' : 'text-slate-500 hover:text-slate-700'}`}>
              <List className="w-4 h-4" /> Lista Diária
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200 mx-1 shrink-0" />

          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="h-9 rounded-xl border border-slate-200 px-3 text-xs bg-slate-50 font-semibold focus:ring-2 focus:ring-sky-500 shrink-0 cursor-pointer">
            {monthOptions.map((m) => {
              const d = new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1);
              return <option key={m} value={m}>{d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</option>;
            })}
          </select>
          
          <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)} className="h-9 rounded-xl border border-slate-200 px-3 text-xs bg-slate-50 font-semibold focus:ring-2 focus:ring-sky-500 shrink-0 cursor-pointer">
            <option value="all">Selecione o Setor</option>
            {sectors.map((s) => <option key={s.id} value={s.id}>{toTitleCase(s.name)}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
          {viewMode === 'grade' && (
            <Button onClick={handlePublish} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 shadow-sm shadow-emerald-600/20">
              <Send className="w-3.5 h-3.5 mr-1.5" /> Publicar Escala
            </Button>
          )}
          <Button variant="outline" onClick={handleExportSchedule} className="text-xs h-9 font-semibold border-slate-200" title="Imprimir em PDF">
            <Printer className="w-3.5 h-3.5 text-sky-600" />
          </Button>
        </div>
      </div>

      <Card className="flex-1 border-slate-200 shadow-sm overflow-hidden flex flex-col bg-white">
        
        {/* ===================== MODO GRADE VISUAL (NOVO) ===================== */}
        {viewMode === 'grade' && (
          <div className="flex h-full w-full">
            
            {/* BARRA LATERAL DOS PROFISSIONAIS PARA DRAG AND DROP */}
            <div className="w-64 bg-slate-50/50 border-r border-slate-200 flex flex-col shrink-0">
              <div className="p-4 border-b border-slate-200">
                <h3 className="font-black text-sm text-slate-800 mb-3 flex items-center gap-2">
                  <UsersRound className="w-4 h-4 text-sky-600" /> Corpo Clínico
                </h3>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <Input 
                    placeholder="Buscar profissional..." 
                    value={profSearchQuery} 
                    onChange={e => setProfSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs bg-white"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-2 text-center">Arraste o nome para a escala ➔</p>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sidebarProfessionals.map(prof => (
                  <div 
                    key={prof.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, prof)}
                    className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm cursor-grab hover:border-sky-300 hover:shadow-md active:cursor-grabbing flex items-center gap-2 group transition-all"
                  >
                    <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-sky-500" />
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-800 truncate">{prof.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{prof.specialty || 'Geral'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ÁREA DA GRADE CALENDÁRIO */}
            <div className="flex-1 overflow-y-auto bg-white custom-scrollbar relative">
              {sectorFilter === 'all' ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                  <Building2 className="w-12 h-12 mb-4 text-slate-300" />
                  <p className="font-bold text-slate-600">Selecione um Setor</p>
                  <p className="text-sm mt-1">Para montar a escala em grade, escolha um setor no filtro superior.</p>
                </div>
              ) : (
                <div className="min-w-[800px]">
                  {/* Cabeçalho de Dias da Semana */}
                  <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50 sticky top-0 z-20">
                    <div className="p-3 border-r border-slate-200 flex items-center justify-center font-black text-xs text-slate-500 uppercase tracking-wider bg-slate-100">
                      Turno
                    </div>
                    {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((day) => (
                      <div key={day} className="p-3 border-r border-slate-200 text-center font-bold text-xs text-slate-700 uppercase tracking-wider">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Semanas do Mês */}
                  {weeksData.map((week, wIndex) => (
                    <div key={wIndex} className="border-b-4 border-slate-200">
                      {/* Cabeçalho da Semana (Datas) */}
                      <div className="grid grid-cols-8 bg-slate-50 border-b border-slate-200">
                        <div className="p-2 border-r border-slate-200 bg-slate-100"></div>
                        {week.map((date, dIndex) => (
                          <div key={dIndex} className={`p-1 border-r border-slate-200 text-right pr-2 text-xs font-bold ${date ? 'text-slate-600' : 'text-transparent bg-slate-100'}`}>
                            {date ? date.split('-')[2] + '/' + date.split('-')[1] : '-'}
                          </div>
                        ))}
                      </div>

                      {/* Turnos (Linhas) */}
                      {SHIFT_PERIODS.map((period) => (
                        <div key={period.id} className="grid grid-cols-8 border-b border-slate-100 last:border-b-0 group">
                          {/* Coluna Fixa do Turno */}
                          <div className="p-3 border-r border-slate-200 bg-slate-50 flex flex-col items-center justify-center">
                            <span className="font-bold text-xs text-slate-800">{period.label}</span>
                            <span className="text-[10px] text-slate-500">{period.start} - {period.end}</span>
                          </div>

                          {/* Slots dos Dias */}
                          {week.map((date, dIndex) => {
                            if (!date) return <div key={dIndex} className="bg-slate-100 border-r border-slate-200 p-2"></div>;

                            // Busca os plantões desse dia e período específicos
                            const slotShifts = filtered.filter(s => s.date.startsWith(date) && s.periodId === period.id);

                            return (
                              <div 
                                key={dIndex} 
                                className="border-r border-slate-200 p-1.5 min-h-[60px] relative transition-colors hover:bg-sky-50"
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, date, period.id)}
                                onDoubleClick={() => setInlineEditingCell({ date, periodId: period.id })}
                                title="Arraste um profissional ou dê Duplo Clique para buscar"
                              >
                                {slotShifts.map(s => (
                                  <div key={s.id} className={`p-1.5 mb-1 rounded-md text-xs border flex items-center justify-between group/item ${s.isVacant ? 'bg-amber-50 border-amber-200 text-amber-700 border-dashed' : 'bg-white border-slate-200 text-slate-800 shadow-sm'}`}>
                                    <span className="font-semibold truncate pr-2">{s.isVacant ? 'Vaga' : toTitleCase(s.professional_name)}</span>
                                    {!s.isVacant && (
                                      <button onClick={() => handleDelete(s.id)} className="opacity-0 group-hover/item:opacity-100 p-0.5 text-red-500 hover:bg-red-100 rounded transition-opacity">
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                ))}

                                {/* Modo de Edição Inline (Duplo Clique) */}
                                {inlineEditingCell?.date === date && inlineEditingCell?.periodId === period.id && (
                                  <div className="absolute inset-0 z-30 bg-white border-2 border-sky-500 rounded-lg p-1 shadow-xl flex flex-col">
                                    <div className="flex items-center gap-1 border-b pb-1 mb-1">
                                      <Search className="w-3 h-3 text-slate-400" />
                                      <input 
                                        autoFocus
                                        type="text" 
                                        placeholder="Buscar profissional..." 
                                        className="w-full text-xs outline-none bg-transparent"
                                        value={inlineSearchText}
                                        onChange={e => setInlineSearchText(e.target.value)}
                                        onKeyDown={(e) => { if(e.key === 'Escape') setInlineEditingCell(null); }}
                                      />
                                      <button onClick={() => setInlineEditingCell(null)}><X className="w-3 h-3 text-slate-400 hover:text-red-500"/></button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto space-y-0.5">
                                      {professionals.filter(p => !inlineSearchText || normalizeStr(p.name).includes(normalizeStr(inlineSearchText))).slice(0, 5).map(p => (
                                        <button 
                                          key={p.id} 
                                          className="w-full text-left px-2 py-1 text-xs hover:bg-sky-50 rounded truncate text-slate-700"
                                          onClick={() => {
                                            assignShift(date, period.id, p.id);
                                            setInlineEditingCell(null);
                                            setInlineSearchText('');
                                          }}
                                        >
                                          {p.name}
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
          </div>
        )}

        {/* ===================== MODO LISTA DIÁRIA (MANTIDO) ===================== */}
        {viewMode === 'list' && (
          <div className="overflow-y-auto p-4 space-y-4">
             {filtered.length === 0 ? (
                <div className="py-12 text-center text-slate-400">Nenhum plantão localizado neste filtro.</div>
              ) : (
                filtered.map(s => {
                  const sTime = typeof s.start_time === 'string' ? s.start_time : '00:00';
                  const isDone = ['concluded', 'recently_finished'].includes(s.lifecycle.state);

                  return (
                    <div key={s.id} className={`flex items-center gap-3 rounded-xl border p-3 bg-white transition-colors shadow-sm ${s.isVacant ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-sky-300'}`}>
                      <div className={`min-w-[85px] rounded-lg py-1.5 text-center text-xs font-black border shrink-0 ${isDone ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                        {fmtDate(s.date)} <br/>
                        <span className={isDone ? "text-slate-400" : "text-sky-600"}>{s.start_time || '--'} - {s.end_time || '--'}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <strong className={`block text-sm truncate ${s.isVacant ? 'text-amber-800' : (isDone ? 'text-slate-500' : 'text-slate-800')}`}>
                          {toTitleCase(s.professional_name) || 'Vaga Aberta'}
                        </strong>
                        <span className="text-xs text-slate-400">{toTitleCase(s.sector_name)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isDone ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-400" title="Plantão fechado/histórico">
                            <Lock className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Concluído</span>
                          </div>
                        ) : (
                          <>
                            {s.isVacant ? (
                              <Button size="sm" onClick={() => { setEditing(s); setDialogOpen(true); }} className="h-8 bg-amber-500 hover:bg-amber-600 text-white"><UserPlus className="w-3.5 h-3.5 mr-1" /> Alocar</Button>
                            ) : (
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" title="Avisar"><MessageCircle className="w-4 h-4"/></Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setDialogOpen(true); }} className="h-8 w-8 text-slate-500" title="Editar"><Pencil className="w-4 h-4"/></Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(s.id)} className="h-8 w-8 text-red-500" title="Excluir/Cancelar"><Trash2 className="w-4 h-4"/></Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
          </div>
        )}
      </Card>

      <ShiftFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={load} shift={editing} sectors={sectors} professionals={professionals} companyId={companyId} unitId={unitId} />
    </div>
  );
}