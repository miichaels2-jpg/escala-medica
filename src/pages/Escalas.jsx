import { useState, useMemo, useEffect } from 'react';
import { useAppData } from '@/lib/useAppData';
import { getProfessionalUnitIds, isProfessionalAuthorizedForSector as isAuthorizedInSectorList } from '@/lib/sectorAccess';
import { useUnitScope } from '@/lib/unitScope';
import { describeUnavailability, findUnavailability } from '@/lib/availability';
import { mapDateToMonth } from '@/lib/scheduleCopy';
import { checkWorkload, getWorkloadRules } from '@/lib/workload';
import { EXTRA_VACANCY_TAG, getSectorTemplates, isExtraVacancy, templatesToSlots, withSectorTemplates } from '@/lib/sectorTemplates';
import { getShiftDateTimeRange } from '@/lib/shiftLiveStatus';
import { recipientFor, sendNotifications } from '@/lib/notifications';
import { offerUndo } from '@/lib/undo';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import PageHero from '@/components/PageHero';
import EmptyState from '@/components/EmptyState';
import ScheduleGrid from '@/components/escala/ScheduleGrid';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { listHorarios } from '@/lib/allocationBoard';
import { CalendarDays, Plus, Search, ChevronLeft, ChevronRight, Clock, X, CheckCheck, Send, HeartPulse, SlidersHorizontal, MonitorPlay, GripVertical, Printer, Sun, Moon, AlertTriangle, PanelLeftClose, PanelLeftOpen, ShieldAlert, History, Copy, MoreHorizontal, LayoutGrid, List as ListIcon, Trash2 } from 'lucide-react';
import { MONTH_NAMES, WEEKDAYS, getLocalDateString, formatDateBR, getShiftRangeFor, shiftRangesOverlap, isShiftPast, stripPublicationTags, normalize, getShiftName, isVacant, buildShortLabels, shiftHours, computeShiftHospitalLifecycle, getInitials, formatFullName, extractSpecialty, extractRetroactiveJustification, splitRangeByMonth, autoHealingSaveShift } from '@/lib/escalaUtils';
import { printDayShifts, printMonthSchedule } from '@/lib/escalaPrints';
import TvMode from '@/components/escala/TvMode';
import DayShiftsTab from '@/components/escala/DayShiftsTab';
import ShiftEditorDialog from '@/components/escala/ShiftEditorDialog';
import GeneratorDialog from '@/components/escala/GeneratorDialog';
import LegacyUnitDialog from '@/components/escala/LegacyUnitDialog';
import BulkAllocationDialog from '@/components/escala/BulkAllocationDialog';
import PublishDialog from '@/components/escala/PublishDialog';
import CopyMonthDialog from '@/components/escala/CopyMonthDialog';

export default function Escalas() {
  const { shifts: unitShiftsRaw = [], allCompanyShifts = [], allCompanySectors = [], allCompanyProfessionals = [], sectors: unitSectorsRaw = [], professionals: unitProfessionalsRaw = [], selectedUnitId, units = [], company, user, isManager, syncGlobalData, unassignedShifts = [], publishedRanges, getPublishedRanges, savePublishedRanges } = useAppData();
  // "Todas as unidades" (V0.9.7): monta e publica a escala de todas as unidades administradas sem trocar
  // de unidade. Cada setor e plantão leva a sua unidade; quem pode ir é quem atende na unidade do setor.
  const { isAllUnits, inScope, unitName } = useUnitScope();
  const sectors = useMemo(() => (isAllUnits ? allCompanySectors.filter(s => !s.unit_id || inScope(s.unit_id)) : unitSectorsRaw), [isAllUnits, allCompanySectors, unitSectorsRaw, inScope]);
  const shifts = useMemo(() => (isAllUnits ? allCompanyShifts.filter(s => inScope(s.unit_id)) : unitShiftsRaw), [isAllUnits, allCompanyShifts, unitShiftsRaw, inScope]);
  const professionals = useMemo(() => (isAllUnits ? allCompanyProfessionals.filter(p => getProfessionalUnitIds(p).some(inScope)) : unitProfessionalsRaw), [isAllUnits, allCompanyProfessionals, unitProfessionalsRaw, inScope]);
  // Unidade do setor (em "Todas" cada setor é de uma unidade; numa unidade só, é a escolhida).
  function unitOfSector(sectorId) {
    const sector = (allCompanySectors || []).find(s => String(s.id) === String(sectorId)) || (sectors || []).find(s => String(s.id) === String(sectorId));
    return String(sector?.unit_id || selectedUnitId || '');
  }
  // Especialidade diferente da vaga (vaga geral ou sem especialidade aceita qualquer um).
  function isOtherSpecialty(prof, required) {
    const need = normalize(required || '');
    if (!prof || !need || need === 'geral') return false;
    const mine = normalize(prof.specialty || '');
    return !mine || !(mine === need || mine.includes(need) || need.includes(mine));
  }
  function isProfessionalAuthorizedForSector(prof, sectorId) {
    if (!isAuthorizedInSectorList(prof, sectorId)) return false;
    if (!isAllUnits || !sectorId) return true;
    return getProfessionalUnitIds(prof).includes(unitOfSector(sectorId));
  }

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState('mensal'); 
  const [monthlyView, setMonthlyViewState] = useState(() => {
    // Calendário é a visão padrão: é nele que se arrasta a equipe para os dias. A escolha fica lembrada.
    try { const saved = window.localStorage.getItem('scale_escala_view'); if (['grade', 'calendario', 'lista'].includes(saved)) return saved; } catch { /* sem armazenamento */ }
    return 'calendario';
  });
  const setMonthlyView = view => { setMonthlyViewState(view); try { window.localStorage.setItem('scale_escala_view', view); } catch { /* sem armazenamento */ } };
  // Calendário: dia aberto no painel de detalhes (abre como gaveta em telas menores).
  const [calendarDay, setCalendarDay] = useState(null);
  const [dayPanelOpen, setDayPanelOpen] = useState(false);
  const [filterTurno, setFilterTurno] = useState('todos'); 
  // A lista abre a partir de hoje: dias que já passaram ficam a um clique (setas do mês / filtro).
  // Antes havia um filtro "a partir de" que escondia os dias anteriores sem avisar; o mês aparece inteiro.
  const [startDateFilter, setStartDateFilter] = useState('');
const [legacyAssignmentOpen, setLegacyAssignmentOpen] = useState(false);
const [legacyUnitDrafts, setLegacyUnitDrafts] = useState({});
const [legacyAssignmentSaving, setLegacyAssignmentSaving] = useState(false);

const openTvMode = async () => {
  setActiveTab('tv');
  if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  try {
    await document.documentElement.requestFullscreen();
  } catch (error) {
    console.warn('Não foi possível ativar a tela cheia do navegador para o modo TV:', error);
  }
};

const closeTvMode = async () => {
  setActiveTab('mensal');
  if (!document.fullscreenElement || !document.exitFullscreen) return;
  try {
    await document.exitFullscreen();
  } catch (error) {
    console.warn('Não foi possível sair da tela cheia do navegador:', error);
  }
};

  const [selectedSectorId, setSelectedSectorId] = useState(() => {
    try { return window.localStorage.getItem('scale_filter_sector_id') || 'todos'; } catch { return 'todos'; }
  });

  const handleSelectSector = (secId) => {
    setSelectedSectorId(secId);
    try { window.localStorage.setItem('scale_filter_sector_id', secId); } catch {}
  };

  const selectedSectorObj = useMemo(() => {
    if (selectedSectorId === 'todos') return null;
    return (sectors || []).find(s => String(s.id) === String(selectedSectorId));
  }, [sectors, selectedSectorId]);

  const [trayCollapsed, setTrayCollapsed] = useState(() => {
    try { return window.localStorage.getItem('scale_tray_collapsed') === 'true'; } catch { return false; }
  });

  const toggleTray = () => {
    setTrayCollapsed(prev => {
      const next = !prev;
      try { window.localStorage.setItem('scale_tray_collapsed', String(next)); } catch {}
      return next;
    });
  };

  // Versões antigas tinham um botão que escondia o menu lateral direto no layout; garante que ele volte.
  useEffect(() => {
    try {
      window.localStorage.removeItem('scale_main_sidebar_hidden');
      document.querySelectorAll('aside').forEach(el => { if (el.style.display === 'none') el.style.display = ''; });
    } catch { /* sem armazenamento: nada a restaurar */ }
  }, []);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Publicações ficam no banco (published_schedules): todos os gestores veem o mesmo estado.
  const getSectorPublishedRanges = (secId, year = currentYear, month = currentMonth + 1) =>
    getPublishedRanges(unitOfSector(secId), secId, year, month);

  const isCurrentSectorPublished = useMemo(() => {
    if (selectedSectorId === 'todos') {
      return (sectors || []).length > 0 && (sectors || []).every(s => getSectorPublishedRanges(s.id).length > 0);
    }
    return getSectorPublishedRanges(selectedSectorId).length > 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a função só lê publishedRanges, que já está na lista
  }, [selectedSectorId, sectors, currentYear, currentMonth, selectedUnitId, publishedRanges]);

  const unsubmittedSectors = useMemo(() => {
    return (sectors || []).filter(s => getSectorPublishedRanges(s.id).length === 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a função só lê publishedRanges, que já está na lista
  }, [sectors, currentYear, currentMonth, selectedUnitId, publishedRanges]);

  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishConfig, setPublishConfig] = useState({
    sector_id: '',
    start_date: getLocalDateString(),
    end_date: getLocalDateString(new Date(Date.now() + 14 * 86400000))
  });

  const openPublishModal = () => {
    const defaultSec = selectedSectorId !== 'todos' ? selectedSectorId : ((sectors || [])[0]?.id || '');
    const firstDayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const lastDayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    setPublishConfig({
      sector_id: defaultSec,
      start_date: firstDayStr,
      end_date: lastDayStr
    });
    setPublishModalOpen(true);
  };

  const handleApplyQuickRange = (type) => {
    const start = new Date(publishConfig.start_date + 'T12:00:00');
    let end = new Date(start);

    if (type === '7days') end.setDate(start.getDate() + 6);
    else if (type === '15days') end.setDate(start.getDate() + 14);
    else if (type === 'month') {
      const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
      end = new Date(start.getFullYear(), start.getMonth(), lastDay);
    }

    setPublishConfig(prev => ({ ...prev, end_date: getLocalDateString(end) }));
  };

  const existingPublishedOverlaps = useMemo(() => {
    if (!publishConfig.sector_id || !publishConfig.start_date || !publishConfig.end_date) return [];
    const ranges = splitRangeByMonth(publishConfig.start_date, publishConfig.end_date)
      .flatMap(part => getSectorPublishedRanges(publishConfig.sector_id, part.year, part.month));

    return ranges.filter(r => r.start_date <= publishConfig.end_date && r.end_date >= publishConfig.start_date);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a função só lê publishedRanges, que já está na lista
  }, [publishConfig, publishedRanges, selectedUnitId]);

  const publishTargetShifts = useMemo(() => {
    if (!publishConfig.sector_id || !publishConfig.start_date || !publishConfig.end_date) return [];
    return (shifts || []).filter(s => {
      if (!s || s.status === 'cancelado') return false;
      if (String(s.sector_id) !== String(publishConfig.sector_id)) return false;
      return s.date >= publishConfig.start_date && s.date <= publishConfig.end_date;
    });
  }, [shifts, publishConfig]);

  const handleExecutePublishSector = async () => {
    if (!publishConfig.sector_id) { alert('Selecione o setor a ser publicado.'); return; }
    if (publishConfig.start_date > publishConfig.end_date) { alert('Data de término inválida.'); return; }

    const secName = sectorMap[String(publishConfig.sector_id)]?.name || 'Setor Hospitalar';

    setSubmitting(true);
    try {
      const publishedAt = new Date().toISOString();
      // Um período pode atravessar meses: cada mês guarda só o trecho que lhe pertence.
      for (const part of splitRangeByMonth(publishConfig.start_date, publishConfig.end_date)) {
        const newRange = { start_date: part.start_date, end_date: part.end_date, published_at: publishedAt };
        const currentRanges = getSectorPublishedRanges(publishConfig.sector_id, part.year, part.month);
        await savePublishedRanges({
          unitId: unitOfSector(publishConfig.sector_id),
          sectorId: publishConfig.sector_id,
          year: part.year,
          month: part.month,
          ranges: [
            ...currentRanges.filter(r => !(r.start_date >= newRange.start_date && r.end_date <= newRange.end_date)),
            newRange
          ],
          updatedBy: user?.full_name || user?.email || null
        });
      }

      const newlyPublishedByProfessional = new Map();
      for (const shift of publishTargetShifts) {
        const currNotes = String(shift.notes || '');
        const wasAlreadyPublished = currNotes.includes('[ESCALA_PUBLICADA]');
        // Republicar substitui os marcadores anteriores em vez de acumulá-los.
        const publishedNotes = `${stripPublicationTags(currNotes)} [ESCALA_PUBLICADA] [NOTIFICACAO_ESCALA_PUBLICADA] [VIGENCIA:${publishConfig.start_date}_A_${publishConfig.end_date}]`.trim();

        await autoHealingSaveShift(shift.id, {
          notes: publishedNotes
        });

        if (!wasAlreadyPublished && shift.professional_id && !isVacant(shift)) {
          const list = newlyPublishedByProfessional.get(String(shift.professional_id)) || [];
          list.push(shift);
          newlyPublishedByProfessional.set(String(shift.professional_id), list);
        }
      }

      // Um aviso por profissional, com a lista dos seus plantões publicados.
      const notificationsSent = await sendNotifications([...newlyPublishedByProfessional.entries()].map(([professionalId, profShifts]) => {
        const sorted = profShifts.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.start_time).localeCompare(String(b.start_time)));
        const lines = sorted.slice(0, 6).map(s => `${formatDateBR(s.date)} ${s.start_time}–${s.end_time}`).join(' • ');
        return {
          ...recipientFor(professionalMap[professionalId] || { id: professionalId }),
          company_id: company?.id,
          unit_id: unitOfSector(publishConfig.sector_id),
          type: 'escala_publicada',
          category: 'escala',
          title: `Escala publicada: ${secName}`,
          message: `${sorted.length} plantão(ões) confirmado(s): ${lines}${sorted.length > 6 ? ' …' : ''}`,
          data: { sector_id: publishConfig.sector_id, start_date: publishConfig.start_date, end_date: publishConfig.end_date, shift_ids: sorted.map(s => s.id) }
        };
      }));

      setPublishModalOpen(false);
      await syncGlobalData();

      alert(`✓ Escala de "${secName}" oficializada!\n\nVigência: ${formatDateBR(publishConfig.start_date)} até ${formatDateBR(publishConfig.end_date)}\n${newlyPublishedByProfessional.size} profissional(is) ${notificationsSent ? 'notificado(s)' : 'a notificar (falha no envio do aviso)'}.`);
      } catch (err) { alert('Erro ao publicar escala: ' + err.message); } finally { setSubmitting(false); }
  };

  const handleUnpublishSector = async () => {
    const secId = selectedSectorId !== 'todos' ? selectedSectorId : ((sectors || [])[0]?.id || '');
    const secName = sectorMap[String(secId)]?.name || 'Setor';

    if (!confirm(`Reverter escala de "${secName}" em ${MONTH_NAMES[currentMonth]} para Modo Rascunho?`)) return;

    try {
      await savePublishedRanges({ unitId: unitOfSector(secId), sectorId: secId, year: currentYear, month: currentMonth + 1, ranges: [] });
      alert(`A escala de "${secName}" voltou para Modo Rascunho.`);
    } catch (err) {
      alert('Erro ao reverter a publicação: ' + err.message);
    }
  };

  // MODAL DE DUPLICAR ESCALA 
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateConfig, setDuplicateConfig] = useState({
    source_date: getLocalDateString(new Date(currentYear, currentMonth, 1)).slice(0, 7),     // Mês em tela (YYYY-MM)
    target_date: getLocalDateString(new Date(currentYear, currentMonth + 1, 1)).slice(0, 7), // Mês seguinte
    sector_id: 'todos',
    mode: 'semana'
  });
  const [generatorSourceInfo, setGeneratorSourceInfo] = useState('');

  const handleExecuteDuplicate = (e) => {
    e.preventDefault();
    const [sY, sM] = duplicateConfig.source_date.split('-').map(Number);
    const [tY, tM] = duplicateConfig.target_date.split('-').map(Number);
    if (!sY || !tY) { alert('Escolha o mês de referência e o mês a montar.'); return; }
    if (sY === tY && sM === tM) { alert('O mês de referência e o mês a montar precisam ser diferentes.'); return; }
    const prefixSource = `${sY}-${String(sM).padStart(2, '0')}-`;
    const prefixTarget = `${tY}-${String(tM).padStart(2, '0')}-`;

    const sourceShifts = (shifts || [])
      .filter(s => s?.date && String(s.date).startsWith(prefixSource) && s.status !== 'cancelado')
      .filter(s => duplicateConfig.sector_id === 'todos' || String(s.sector_id) === String(duplicateConfig.sector_id))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.start_time).localeCompare(String(b.start_time)));
    if (sourceShifts.length === 0) { alert('Nenhum plantão encontrado no mês de referência.'); return; }

    // Não duplica o que já existe no mês a montar (mesmo dia, setor, horário e especialidade).
    const slotKey = (date, s) => [date, s.sector_id, s.start_time, s.end_time, normalize(extractSpecialty(s, professionalMap[String(s.professional_id)]))].map(String).join('|');
    const existing = new Map();
    (shifts || []).forEach(s => {
      if (!s?.date || s.status === 'cancelado' || !String(s.date).startsWith(prefixTarget)) return;
      const key = slotKey(String(s.date).slice(0, 10), s);
      existing.set(key, (existing.get(key) || 0) + 1);
    });

    const rows = [];
    const draft = {};
    const assignedRanges = {};
    let skippedExisting = 0;
    let notMapped = 0;
    let kept = 0;
    const freed = { inativo: 0, setor: 0, indisponivel: 0, choque: 0 };

    sourceShifts.forEach((shift, index) => {
      const date = mapDateToMonth(shift.date, tY, tM, duplicateConfig.mode);
      if (!date) { notMapped += 1; return; }
      const key = slotKey(date, shift);
      if ((existing.get(key) || 0) > 0) { existing.set(key, existing.get(key) - 1); skippedExisting += 1; return; }

      const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
      const spec = extractSpecialty(shift, prof);
      const row = {
        id: `draft_copy_${index}_${date}`,
        isDraft: true,
        company_id: shift.company_id || company?.id || 'cmp_principal',
        unit_id: shift.unit_id || selectedUnitId,
        sector_id: shift.sector_id,
        target_specialty: spec,
        notes: `[ESP:${spec}] [GERADO_ESCALA_MASSA]`,
        professional_id: null,
        professional_name: null,
        date,
        shift_type: shift.shift_type || (shift.start_time >= '18:00' || shift.start_time < '06:00' ? 'noturno' : 'diurno'),
        start_time: shift.start_time,
        end_time: shift.end_time,
        status: 'vago'
      };
      rows.push(row);

      // Mantém o mesmo profissional só se ele ainda puder assumir.
      if (!shift.professional_id) return;
      if (!prof || prof.status !== 'ativo') { freed.inativo += 1; return; }
      if (!isProfessionalAuthorizedForSector(prof, row.sector_id)) { freed.setor += 1; return; }
      if (findUnavailability(prof, date)) { freed.indisponivel += 1; return; }
      const range = getShiftRangeFor(date, row.start_time, row.end_time);
      const clashesDraft = (assignedRanges[prof.id] || []).some(other => shiftRangesOverlap(range, other));
      if (clashesDraft || checkProfessionalConflict(prof.id, date, row.start_time, row.end_time).hasConflict) { freed.choque += 1; return; }
      draft[row.id] = String(prof.id);
      assignedRanges[prof.id] = [...(assignedRanges[prof.id] || []), range];
      kept += 1;
    });

    if (rows.length === 0) {
      alert(skippedExisting > 0 ? 'O mês a montar já tem todos esses plantões. Nada foi duplicado.' : 'Nenhum plantão pôde ser montado para o mês escolhido.');
      return;
    }

    const freedTotal = freed.inativo + freed.setor + freed.indisponivel + freed.choque;
    const freedParts = [
      freed.indisponivel && `${freed.indisponivel} por férias/indisponibilidade`,
      freed.choque && `${freed.choque} por choque de horário`,
      freed.inativo && `${freed.inativo} por profissional inativo`,
      freed.setor && `${freed.setor} por setor não autorizado`
    ].filter(Boolean).join(', ');
    setGeneratorSourceInfo(
      `Baseado em ${MONTH_NAMES[sM - 1]}/${sY}: ${kept} plantão(ões) com o mesmo profissional` +
      (freedTotal ? `; ${freedTotal} voltaram a ser vaga (${freedParts})` : '') +
      (notMapped ? `; ${notMapped} não existem neste mês (${duplicateConfig.mode === 'semana' ? '5ª semana' : 'dia 31'})` : '') + '.'
    );
    setGeneratorSkippedCount(skippedExisting);
    setGeneratedAllocationRows(rows);
    setBulkAllocationDraft(draft);
    setDuplicateModalOpen(false);
    setBulkAllocationOpen(true);
  };

  const [selectedDays, setSelectedDays] = useState([]);
  const [traySearch, setTraySearch] = useState('');
  const [traySpecialtyFilter, setTraySpecialtyFilter] = useState('todas');
  const [scheduleProfessionalSearch, setScheduleProfessionalSearch] = useState('');
  const [scheduleSpecialtyFilter] = useState('todas');
  const [draggingProfId, setDraggingProfId] = useState(null);
  // Arrastar para o calendário (V0.8.2): dias marcados com clique simples, turno escolhido pelo gestor.
  const [selectDaysMode, setSelectDaysMode] = useState(false);
  const [trayHorario, setTrayHorario] = useState('');
  const [dayDropChoice, setDayDropChoice] = useState(null);

  const [liveNow, setLiveNow] = useState(() => new Date());
  useEffect(() => { 
    const t = setInterval(() => setLiveNow(new Date()), 1000); 
    return () => clearInterval(t); 
  }, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [generatorModalOpen, setGeneratorModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState(null);
  
  // ---> A VARIÁVEL QUE FALTAVA FOI INSERIDA AQUI <---
  const [submitting, setSubmitting] = useState(false);

  // Fluxo pós-geração: a grade é criada primeiro e, em seguida,
  // o gestor decide se deseja iniciar a alocação dos profissionais.
  const [bulkAllocationOpen, setBulkAllocationOpen] = useState(false);
  const [generatedAllocationRows, setGeneratedAllocationRows] = useState([]);
  const [generatorSkippedCount, setGeneratorSkippedCount] = useState(0);
  const [bulkAllocationDraft, setBulkAllocationDraft] = useState({});

  const registeredSpecialties = useMemo(() => {
    const set = new Set();
    (professionals || []).forEach(p => { if (p?.specialty && p.specialty.trim()) set.add(p.specialty.trim()); });
    return Array.from(set).sort();
  }, [professionals]);

  const [formData, setFormData] = useState({
    date: getLocalDateString(), sector_id: '', target_specialty: 'Clínica Médica',
    start_time: '07:00', end_time: '19:00', shift_type: 'diurno', action_type: 'alocar',
    professional_id: '', notes: '', retroactive_justification: ''
  });

  // O Painel Geral grava o plantão clicado em um alerta de vaga; ao chegar
  // aqui, o modal de alocação abre direto nesse plantão.
  useEffect(() => {
    if (!isManager || !(shifts || []).length) return;
    let pendingShiftId = null;
    try { pendingShiftId = window.localStorage.getItem('scale_auto_open_shift_id'); } catch { return; }
    if (!pendingShiftId) return;
    const target = shifts.find(s => String(s.id) === String(pendingShiftId));
    try { window.localStorage.removeItem('scale_auto_open_shift_id'); } catch {}
    if (!target) return;

    const [year, month] = String(target.date || '').split('-').map(Number);
    if (year && month) {
      setCurrentDate(new Date(year, month - 1, 1));
      setStartDateFilter('');
    }
    setEditingShiftId(target.id);
    setFormData({
      date: target.date,
      sector_id: target.sector_id,
      target_specialty: extractSpecialty(target),
      start_time: target.start_time,
      end_time: target.end_time,
      shift_type: target.shift_type || 'diurno',
      action_type: 'alocar',
      professional_id: target.professional_id || '',
      notes: target.notes || '',
      retroactive_justification: extractRetroactiveJustification(target.notes)
    });
    setModalOpen(true);
  }, [isManager, shifts]);

  const isEditingPastShift = useMemo(() => {
    return isShiftPast({ date: formData.date, start_time: formData.start_time, end_time: formData.end_time }, liveNow);
  }, [formData.date, formData.start_time, formData.end_time, liveNow]);

  const sectorMap = useMemo(() => { const m = {}; (sectors || []).forEach(s => { if(s) m[String(s.id)] = s; }); return m; }, [sectors]);
  const companyShifts = useMemo(() => (allCompanyShifts.length ? allCompanyShifts : shifts) || [], [allCompanyShifts, shifts]);
  const workloadRules = useMemo(() => getWorkloadRules(company), [company]);
  // Avisos de carga (semana acima do limite, plantões emendados) para alocar profId em candidate.
  // extraShifts: plantões ainda em rascunho (gerador) atribuídos ao mesmo profissional.
  const workloadWarningsFor = (profId, candidate, extraShifts = []) => {
    if (!profId || !candidate) return [];
    const mine = companyShifts.filter(s => s && String(s.professional_id) === String(profId) && !isVacant(s));
    return checkWorkload(candidate, [...mine, ...extraShifts], workloadRules);
  };
  const allSectorsMap = useMemo(() => { const m = {}; (allCompanySectors || []).forEach(s => { if (s) m[String(s.id)] = s; }); return m; }, [allCompanySectors]);
  // "Setor" ou "Setor — Outro Hospital" quando o plantão é de outra unidade.
  const describeShiftPlace = (shift) => {
    const sectorName = (sectorMap[String(shift?.sector_id)] || allSectorsMap[String(shift?.sector_id)])?.name || shift?.sector_name || 'outro setor';
    if (!shift || (!isAllUnits && String(shift.unit_id) === String(selectedUnitId))) return sectorName;
    const unitName = (units || []).find(u => String(u.id) === String(shift.unit_id))?.name || 'outra unidade';
    return `${sectorName} — ${unitName}`;
  };
  const professionalMap = useMemo(() => { const m = {}; (professionals || []).forEach(p => { if(p) m[String(p.id)] = p; }); return m; }, [professionals]);

  const todayLocalStr = useMemo(() => getLocalDateString(liveNow), [liveNow]);



  // =========================================================================
  // TV CCO & IMPRESSÃO 
  // =========================================================================
  const tvData = useMemo(() => {
    const emAndamento = [];
    const programadosHoje = [];
    const tableDayShifts = [];

    (shifts || []).forEach(shift => {
      if (!shift || shift.status === 'cancelado') return;
      if (selectedSectorId !== 'todos' && String(shift.sector_id) !== String(selectedSectorId)) return;

      const lifecycle = computeShiftHospitalLifecycle(shift, liveNow);
      const sDate = String(shift.date || '').slice(0, 10);

      if (sDate === todayLocalStr || lifecycle.isLive) {
        tableDayShifts.push(shift);
      }

      if (isVacant(shift)) return;

      if (lifecycle.isLive) {
        emAndamento.push({ ...shift, lifecycle, detail: lifecycle.detail });
      }

      if (lifecycle.isProgrammed && sDate === todayLocalStr) {
        programadosHoje.push({ shift, lifecycle, startsIn: lifecycle.startsInMinutes });
      }
    });

    tableDayShifts.sort((a, b) => {
      const aLife = computeShiftHospitalLifecycle(a, liveNow);
      const bLife = computeShiftHospitalLifecycle(b, liveNow);
      if (aLife.isLive && !bLife.isLive) return -1;
      if (!aLife.isLive && bLife.isLive) return 1;
      return (a.start_time || '07:00').localeCompare(b.start_time || '07:00');
    });

    programadosHoje.sort((a, b) => (a.shift.start_time || '07:00').localeCompare(b.shift.start_time || '07:00'));

    return { emAndamento, programadosHoje, tableDayShifts };
  }, [shifts, selectedSectorId, liveNow, todayLocalStr]);

  // Plantão do dia (A4 deitado): quem está em cada setor hoje, com vagas e linhas de assinatura.
  const handlePrintA4Landscape = () => printDayShifts({ company, getPublishedRanges, liveNow, professionalMap, sectorMap, selectedUnitId, tvData, units, user });

  // Escala do mês para o mural: uma página por setor, dias nas linhas e turnos nas colunas.
  const handlePrintMonthlySchedule = () => printMonthSchedule({ company, currentMonth, currentYear, daysInMonth, getSectorPublishedRanges, liveNow, professionalMap, scheduleVisibleShifts, sectorMap, sectors, selectedUnitId, units, user });

  // Alocação feita numa data já publicada avisa o profissional na hora.
  // (Em rascunho o aviso sai junto com a publicação da escala.)
  const isShiftDatePublished = (shift) => {
    const date = String(shift?.date || '').slice(0, 10);
    const [year, month] = date.split('-').map(Number);
    if (!year || !month) return false;
    return getPublishedRanges(shift.unit_id || selectedUnitId, shift.sector_id, year, month)
      .some(range => date >= range.start_date && date <= range.end_date);
  };

  const notifyAllocations = async (allocations) => {
    const items = allocations
      .filter(({ shift, prof }) => prof?.id && isShiftDatePublished(shift))
      .map(({ shift, prof }) => ({
        ...recipientFor(prof),
        company_id: company?.id,
        unit_id: shift.unit_id || selectedUnitId,
        type: 'plantao_alocado',
        category: 'escala',
        title: 'Novo plantão na sua escala',
        message: `${formatDateBR(shift.date)} das ${shift.start_time} às ${shift.end_time}${sectorMap[String(shift.sector_id)]?.name ? ` · ${sectorMap[String(shift.sector_id)].name}` : ''}`,
        data: { shift_id: shift.id, date: shift.date }
      }));
    if (items.length) await sendNotifications(items);
  };

  const isDatePublishedForCurrentSector = (dateStr) => {
    if (selectedSectorId === 'todos') {
      return (sectors || []).length > 0 && (sectors || []).every(sec => {
        const ranges = getSectorPublishedRanges(sec.id);
        return ranges.some(r => dateStr >= r.start_date && dateStr <= r.end_date);
      });
    }
    const ranges = getSectorPublishedRanges(selectedSectorId);
    return ranges.some(r => dateStr >= r.start_date && dateStr <= r.end_date);
  };

  const checkProfessionalConflict = (profId, targetDate, startTime, endTime, excludeShiftId = null) => {
    if (!profId || !targetDate) return { hasConflict: false };

    const candidateRange = getShiftRangeFor(targetDate, startTime, endTime);
    if (!candidateRange) return { hasConflict: false };

    // Considera os plantões de TODOS os hospitais: o profissional não pode estar
    // em duas unidades ao mesmo tempo.
    for (const s of companyShifts) {
      if (!s || s.status === 'cancelado' || s.status === 'vago') continue;
      if (excludeShiftId && String(s.id) === String(excludeShiftId)) continue;
      if (String(s.professional_id) !== String(profId)) continue;

      // Compara data + hora reais para pegar também plantões noturnos
      // que avançam sobre o dia seguinte.
      if (shiftRangesOverlap(candidateRange, getShiftDateTimeRange(s))) {
        const secName = describeShiftPlace(s);
        const profName = professionalMap[String(profId)]?.name || 'O profissional';
        const sameDate = String(s.date || '').slice(0, 10) === String(targetDate).slice(0, 10);
        return {
          hasConflict: true,
          conflictShift: s,
          message: `${profName} já está escalado(a) em "${secName}" das ${s.start_time} às ${s.end_time} ${sameDate ? 'nesta mesma data' : `em ${formatDateBR(s.date)}`}!`
        };
      }
    }

    return { hasConflict: false };
  };

  const categorizedProfessionalsForModal = useMemo(() => {
    if (!formData.date) return { available: [], unavailable: [] };

    const available = [];
    const unavailable = [];

    (professionals || []).filter(p => p?.status === 'ativo').forEach(prof => {
if (!isProfessionalAuthorizedForSector(prof, formData.sector_id)) {
  const sectorName = sectorMap[String(formData.sector_id)]?.name || 'este setor';
  unavailable.push({
    ...prof,
    conflictReason: `Não autorizado para ${sectorName}`
  });
  return;
}
const away = findUnavailability(prof, formData.date);
if (away) {
  unavailable.push({ ...prof, conflictReason: `Indisponível: ${describeUnavailability(away)}` });
  return;
}

const conflict = checkProfessionalConflict(
        prof.id, 
        formData.date, 
        formData.start_time, 
        formData.end_time, 
        editingShiftId
      );

      if (conflict.hasConflict) {
        const conflictSec = describeShiftPlace(conflict.conflictShift);
        unavailable.push({
          ...prof,
          conflictReason: `Alocado em ${conflictSec} (${conflict.conflictShift?.start_time} - ${conflict.conflictShift?.end_time})`
        });
      } else {
        const warnings = workloadWarningsFor(prof.id, { id: editingShiftId || 'novo', date: formData.date, start_time: formData.start_time, end_time: formData.end_time }).map(w => w.message);
        // Outra especialidade: o gestor pode escalar, mas confirma ao salvar (V0.9.8).
        if (isOtherSpecialty(prof, formData.target_specialty)) warnings.unshift(`outra especialidade (${prof.specialty || 'sem especialidade'}): pede confirmação`);
        available.push(warnings.length ? { ...prof, workloadWarning: warnings.join('; ') } : prof);
      }
    });

    return { available, unavailable };
// eslint-disable-next-line react-hooks/exhaustive-deps -- as funções de conflito e carga leem os mesmos dados (plantões, setores, profissionais) já listados
}, [professionals, formData.date, formData.sector_id, formData.start_time, formData.end_time, editingShiftId, companyShifts, sectorMap]);

  const allScaleConflicts = useMemo(() => {
    const byProfessional = new Map();
    companyShifts.forEach(s => {
      if (!s || s.status === 'cancelado' || s.status === 'vago' || !s.professional_id) return;
      const range = getShiftDateTimeRange(s);
      if (!range) return;
      const key = String(s.professional_id);
      if (!byProfessional.has(key)) byProfessional.set(key, []);
      byProfessional.get(key).push({ shift: s, range });
    });

    const conflicts = [];
    byProfessional.forEach(list => {
      list.sort((x, y) => x.range.start - y.range.start);
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          if (list[j].range.start >= list[i].range.end) break;
          const a = list[i].shift;
          const b = list[j].shift;
          // O alerta desta tela mostra só choques que envolvem a unidade aberta;
          // a vaga liberada pelo botão de resolver é sempre a desta unidade.
          const aHere = isAllUnits ? inScope(a.unit_id) : String(a.unit_id) === String(selectedUnitId);
          const bHere = isAllUnits ? inScope(b.unit_id) : String(b.unit_id) === String(selectedUnitId);
          if (!aHere && !bHere) continue;
          conflicts.push(bHere ? { a, b } : { a: b, b: a });
        }
      }
    });
    return conflicts;
  }, [companyShifts, selectedUnitId, isAllUnits, inScope]);

  const [generatorConfig, setGeneratorConfig] = useState({
    sector_id: '', start_date: getLocalDateString(), duration_days: 30, interval_days: 1,
    slots: [
      { id: 'slot_1', specialty: 'Clínica Médica', start_time: '07:00', end_time: '19:00', quantity: 2, shift_type: 'diurno' },
      { id: 'slot_2', specialty: 'Clínica Médica', start_time: '19:00', end_time: '07:00', quantity: 2, shift_type: 'noturno' }
    ]
  });

  // "Guardar como turnos padrão do setor": vem marcado quando o setor ainda não tem turnos salvos.
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [generatorFromTemplate, setGeneratorFromTemplate] = useState(false);

  const loadSectorIntoGenerator = (sectorId) => {
    const templates = getSectorTemplates(company, sectorId);
    setGeneratorFromTemplate(templates.length > 0);
    setSaveAsTemplate(templates.length === 0);
    setGeneratorConfig(prev => ({
      ...prev,
      sector_id: sectorId ? String(sectorId) : '',
      slots: templates.length ? templatesToSlots(templates) : prev.slots
    }));
  };

  const saveGeneratorAsTemplate = async (sectorId, slots) => {
    try {
      const { data: row, error: readError } = await supabase.from('companies').select('data').eq('id', company.id).single();
      if (readError) throw readError;
      const data = withSectorTemplates(row?.data, sectorId, slots);
      const { error } = await supabase.from('companies').update({ data }).eq('id', company.id);
      if (error) throw error;
      syncGlobalData();
    } catch (err) {
      alert('A escala segue normalmente, mas os turnos padrão não foram salvos: ' + (err?.message || ''));
    }
  };

  const handleAddSlot = () => {
    setGeneratorConfig(prev => ({
      ...prev,
      slots: [
        ...prev.slots,
        { id: `slot_${Date.now()}`, specialty: registeredSpecialties[0] || 'Clínica Médica', start_time: '07:00', end_time: '19:00', quantity: 1, shift_type: 'diurno' }
      ]
    }));
  };

  const handleRemoveSlot = (slotId) => {
    setGeneratorConfig(prev => ({
      ...prev,
      slots: prev.slots.filter(s => s.id !== slotId)
    }));
  };

  const handleUpdateSlot = (slotId, field, value) => {
    setGeneratorConfig(prev => ({
      ...prev,
      slots: prev.slots.map(s => {
        if (s.id !== slotId) return s;
        const updated = { ...s, [field]: value };
        if (field === 'start_time') updated.shift_type = value >= '18:00' || value < '06:00' ? 'noturno' : 'diurno';
        return updated;
      })
    }));
  };

  // Passo 1 → 2: a grade é montada só na tela. Nada é gravado até o gestor
  // escolher os profissionais e salvar (rascunho) ou salvar e publicar.
  const handleExecuteGenerator = (e) => {
    e.preventDefault();
    if (!generatorConfig.sector_id) { alert('Selecione o setor para a escala.'); return; }

    const totalDays = parseInt(generatorConfig.duration_days) || 30;
    const interval = parseInt(generatorConfig.interval_days) || 1;
    const validSlots = (generatorConfig.slots || []).filter(slot => (parseInt(slot.quantity) || 0) > 0);

    if (validSlots.length === 0) {
      alert('Configure pelo menos um turno com quantidade de vagas maior que zero.');
      return;
    }
    if (validSlots.some(slot => !String(slot.specialty || '').trim())) {
      alert('Escolha a especialidade de cada turno.');
      return;
    }

    const startDt = new Date(generatorConfig.start_date + 'T12:00:00');
    const rows = [];
    let skippedExisting = 0;
    // Rodar o gerador de novo não duplica: cada horário é completado só até a quantidade configurada.
    // Vagas extras contam à parte: completar as normais não mexe nas extras, e vice-versa.
    const existingSlotCount = (dateStr, slot, spec, extra = false) => (shifts || []).filter(s =>
      s && s.status !== 'cancelado' &&
      isExtraVacancy(s) === extra &&
      String(s.date).slice(0, 10) === dateStr &&
      String(s.sector_id) === String(generatorConfig.sector_id) &&
      String(s.start_time) === String(slot.start_time) &&
      String(s.end_time) === String(slot.end_time) &&
      normalize(extractSpecialty(s, professionalMap[String(s.professional_id)])) === normalize(spec)
    ).length;

    for (let dayOffset = 0; dayOffset < totalDays; dayOffset += interval) {
      const curDate = new Date(startDt);
      curDate.setDate(curDate.getDate() + dayOffset);
      const dateStr = getLocalDateString(curDate);

      for (const slot of validSlots) {
        const spec = slot.specialty.trim();
        const configuredQty = parseInt(slot.quantity) || 0;
        const alreadyThere = existingSlotCount(dateStr, slot, spec);
        skippedExisting += Math.min(configuredQty, alreadyThere);
        const sType = slot.shift_type || (slot.start_time >= '18:00' || slot.start_time < '06:00' ? 'noturno' : 'diurno');
        for (let q = alreadyThere; q < configuredQty; q++) {
          rows.push({
            // ID estável: voltar para a grade e avançar de novo mantém as escolhas já feitas.
            id: `draft_${dateStr}_${slot.id}_${q}`,
            isDraft: true,
            company_id: company?.id || 'cmp_principal',
            unit_id: unitOfSector(generatorConfig.sector_id) || 'unit_h1',
            sector_id: generatorConfig.sector_id,
            target_specialty: spec,
            notes: `[ESP:${spec}] [GERADO_ESCALA_MASSA]`,
            professional_id: null,
            professional_name: null,
            date: dateStr,
            shift_type: sType,
            start_time: slot.start_time,
            end_time: slot.end_time,
            status: 'vago'
          });
        }
        const extraQty = (slot.extra_weekdays || []).map(Number).includes(curDate.getDay()) ? (parseInt(slot.extra_quantity) || 0) : 0;
        const extrasThere = extraQty ? existingSlotCount(dateStr, slot, spec, true) : 0;
        skippedExisting += Math.min(extraQty, extrasThere);
        for (let q = extrasThere; q < extraQty; q++) {
          rows.push({
            id: `draft_${dateStr}_${slot.id}_x${q}`,
            isDraft: true,
            isExtra: true,
            company_id: company?.id || 'cmp_principal',
            unit_id: unitOfSector(generatorConfig.sector_id) || 'unit_h1',
            sector_id: generatorConfig.sector_id,
            target_specialty: spec,
            notes: `[ESP:${spec}] [GERADO_ESCALA_MASSA] ${EXTRA_VACANCY_TAG}`,
            professional_id: null,
            professional_name: null,
            date: dateStr,
            shift_type: sType,
            start_time: slot.start_time,
            end_time: slot.end_time,
            status: 'vago'
          });
        }
      }
    }

    if (rows.length === 0) {
      alert(skippedExisting > 0
        ? `A grade já existe para esse período: ${skippedExisting} vaga(s) configurada(s) já estavam criadas. Nada foi duplicado.`
        : 'Nenhuma vaga foi gerada. Verifique a quantidade configurada.');
      return;
    }

    if (saveAsTemplate && isManager) {
      saveGeneratorAsTemplate(generatorConfig.sector_id, validSlots);
      setSaveAsTemplate(false);
      setGeneratorFromTemplate(true);
    }

    setGeneratorSourceInfo('');
    setGeneratorSkippedCount(skippedExisting);
    setGeneratedAllocationRows(rows);
    setBulkAllocationDraft(prev => {
      const next = {};
      rows.forEach(row => { next[row.id] = prev[row.id] || ''; });
      return next;
    });
    setGeneratorModalOpen(false);
    setBulkAllocationOpen(true);
  };

  const generatedRowsById = useMemo(() => {
    const map = {};
    (generatedAllocationRows || []).forEach(row => { map[String(row.id)] = row; });
    return map;
  }, [generatedAllocationRows]);

  const getBulkDraftConflict = (shift, profId, draft) => {
    if (!shift || !profId) return false;

    const candidate = getShiftDateTimeRange(shift);
    if (!candidate) return false;

    // Conflitos já existentes na base.
    const existingConflict = companyShifts.some(existing => {
      if (!existing || existing.status === 'cancelado' || existing.status === 'vago') return false;
      if (String(existing.id) === String(shift.id)) return false;
      if (String(existing.professional_id) !== String(profId)) return false;
      return shiftRangesOverlap(candidate, getShiftDateTimeRange(existing));
    });

    if (existingConflict) return true;

    // Conflitos entre as próprias vagas que estão sendo preenchidas neste lote.
    return Object.entries(draft || {}).some(([shiftId, assignedProfId]) => {
      if (!assignedProfId || String(shiftId) === String(shift.id)) return false;
      if (String(assignedProfId) !== String(profId)) return false;

      const other = generatedRowsById[String(shiftId)];
      if (!other) return false;
      return shiftRangesOverlap(candidate, getShiftDateTimeRange(other));
    });
  };

  // Por que o profissional não pode ficar na vaga ('' = pode). Mesmas regras da lista de candidatos.
  const getBulkBlockReason = (shift, profId, draft = bulkAllocationDraft) => {
    const prof = (professionals || []).find(p => String(p.id) === String(profId));
    if (!shift || !prof) return 'profissional não encontrado';
    const first = String(prof.name || 'O profissional').trim().split(/\s+/)[0];
    if (prof.status !== 'ativo') return `${first} está inativo`;
    if (!isProfessionalAuthorizedForSector(prof, shift.sector_id)) return `${first} não está liberado para o setor ${sectorMap[String(shift.sector_id)]?.name || ''}`.trim();
    if (findUnavailability(prof, shift.date)) return `${first} marcou indisponibilidade em ${formatDateBR(shift.date)}`;
    const requiredSpecialty = normalize(extractSpecialty(shift));
    if (requiredSpecialty && prof.specialty && normalize(prof.specialty) !== requiredSpecialty && requiredSpecialty !== 'geral') {
      return `a vaga é de ${extractSpecialty(shift)} e ${first} é de ${prof.specialty}`;
    }
    if (getBulkDraftConflict(shift, prof.id, draft)) return `${first} já tem plantão nesse horário em ${formatDateBR(shift.date)}`;
    return '';
  };

  // Quem aparece no quadro: ativos, liberados para algum setor do lote e da especialidade de alguma vaga.
  const bulkPool = useMemo(() => {
    const rows = generatedAllocationRows || [];
    if (rows.length === 0) return [];
    const sectorIds = [...new Set(rows.map(r => String(r.sector_id)))];
    const specialties = new Set(rows.map(r => normalize(extractSpecialty(r))));
    return (professionals || [])
      .filter(prof => prof?.status === 'ativo')
      .filter(prof => sectorIds.some(id => isProfessionalAuthorizedForSector(prof, id)))
      .filter(prof => !prof.specialty || specialties.has('') || specialties.has('geral') || specialties.has(normalize(prof.specialty)))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  }, [generatedAllocationRows, professionals]);

  const getBulkCandidates = (shift, draft = bulkAllocationDraft) => {
    if (!shift) return [];

    return (professionals || [])
      .filter(prof => !getBulkBlockReason(shift, prof.id, draft))
      .map(prof => {
        const draftShifts = Object.entries(draft || {})
          .filter(([rowId, profId]) => profId && String(profId) === String(prof.id) && String(rowId) !== String(shift.id))
          .map(([rowId]) => generatedRowsById[String(rowId)])
          .filter(Boolean);
        const warnings = workloadWarningsFor(prof.id, shift, draftShifts);
        return warnings.length ? { ...prof, workloadWarning: warnings.map(w => w.message).join('; ') } : prof;
      })
      .sort((a, b) => Boolean(a.workloadWarning) - Boolean(b.workloadWarning) || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  };

  const autoFillBulkAllocation = () => {
    const draft = { ...bulkAllocationDraft };
    const load = {};
    Object.values(draft).forEach(profId => { if (profId) load[profId] = (load[profId] || 0) + 1; });

    // Preenche só as vagas vazias, respeitando setor, especialidade e conflitos de horário,
    // sempre com quem tem menos plantões neste lote.
    (generatedAllocationRows || [])
      .slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.start_time).localeCompare(String(b.start_time)))
      .forEach(row => {
        if (draft[String(row.id)]) return;
        const candidate = getBulkCandidates(row, draft)
          .filter(prof => !prof.workloadWarning)
          .sort((a, b) => (load[String(a.id)] || 0) - (load[String(b.id)] || 0))[0];
        if (!candidate) return;
        draft[String(row.id)] = String(candidate.id);
        load[String(candidate.id)] = (load[String(candidate.id)] || 0) + 1;
      });

    setBulkAllocationDraft(draft);
  };

  const backToGenerator = () => {
    setBulkAllocationOpen(false);
    setGeneratorModalOpen(true);
  };

  const discardGeneratedSchedule = () => {
    const assigned = Object.values(bulkAllocationDraft || {}).filter(Boolean).length;
    if (assigned > 0 && !confirm('Descartar esta grade? Nada foi salvo ainda e as escolhas serão perdidas.')) return;
    setBulkAllocationOpen(false);
    setGeneratedAllocationRows([]);
    setBulkAllocationDraft({});
  };

  // Passo 3: grava a grade de uma vez, já com os profissionais escolhidos.
  // "Salvar e publicar" abre a publicação já preenchida com o setor e o período.
  const handleSaveGeneratedSchedule = async (publishAfter = false) => {
    const rows = generatedAllocationRows || [];
    if (rows.length === 0) return;

    // Última validação antes de gravar: autorização no setor e nenhum horário sobreposto.
    const validationDraft = {};
    for (const row of rows) {
      const profId = bulkAllocationDraft[String(row.id)];
      if (!profId) continue;
      const prof = professionalMap[String(profId)];
      if (prof && !isProfessionalAuthorizedForSector(prof, row.sector_id)) {
        const sectorName = sectorMap[String(row.sector_id)]?.name || 'este setor';
        alert(`⛔ ${prof.name || 'Profissional'} não está autorizado(a) para o setor ${sectorName}.`);
        return;
      }
      if (getBulkDraftConflict(row, profId, validationDraft)) {
        alert(`⛔ Conflito de escala: ${prof?.name || 'Profissional'} não pode ficar em ${formatDateBR(row.date)} das ${row.start_time} às ${row.end_time} porque já tem outro plantão nesse horário.`);
        return;
      }
      validationDraft[String(row.id)] = String(profId);
    }

    setSubmitting(true);
    let saved = 0;
    const savedAllocations = [];
    try {
      for (const row of rows) {
        const profId = bulkAllocationDraft[String(row.id)];
        const prof = profId ? professionalMap[String(profId)] : null;
         
        const { id: _draftId, isDraft: _isDraft, isExtra: _isExtra, ...payload } = row;
        const result = await autoHealingSaveShift(null, {
          ...payload,
          professional_id: prof?.id || null,
          professional_name: prof?.name || null,
          status: prof ? 'confirmado' : 'vago',
          notes: prof ? `[ESP:${row.target_specialty}] [ALOCADO_APOS_GERACAO]` : payload.notes
        });
        if (!result?.id) continue;
        saved += 1;
        if (prof) savedAllocations.push({ shift: { ...payload, id: result.id }, prof });
      }

      // Só avisa agora quem caiu em datas já publicadas; o resto é avisado na publicação.
      await notifyAllocations(savedAllocations);

      const dates = rows.map(row => row.date).sort();
      const sectorId = String(rows[0].sector_id);
      setBulkAllocationOpen(false);
      setGeneratedAllocationRows([]);
      setBulkAllocationDraft({});
      await syncGlobalData();

      if (publishAfter) {
        setPublishConfig({ sector_id: sectorId, start_date: dates[0], end_date: dates[dates.length - 1] });
        setPublishModalOpen(true);
      } else {
        alert(`✓ Escala salva como rascunho: ${saved} plantão(ões), ${savedAllocations.length} com profissional e ${saved - savedAllocations.length} vaga(s) aberta(s).\n\nOs profissionais só são avisados quando a escala for publicada.`);
      }
    } catch (err) {
      alert(`Erro ao salvar a escala (${saved} de ${rows.length} plantões gravados): ${err?.message || 'Tente novamente.'}`);
      await syncGlobalData();
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    setStartDateFilter('');
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
    setStartDateFilter('');
  };

  const handleToday = () => {
    const today = new Date(liveNow);
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setStartDateFilter('');
    setSelectedDays([]);
  };

  const daysInMonth = useMemo(() => {
    const date = new Date(currentYear, currentMonth, 1);
    const days = [];
    while (date.getMonth() === currentMonth) { 
      const curStr = getLocalDateString(date);
      // O calendário mostra o mês inteiro (dias passados esmaecidos); o filtro "a partir de" vale na lista.
      if (monthlyView !== 'lista' || !startDateFilter || curStr >= startDateFilter) {
        days.push(new Date(date)); 
      }
      date.setDate(date.getDate() + 1); 
    }
    return days;
  }, [currentYear, currentMonth, startDateFilter, monthlyView]);

  const isShiftMatchingTurno = (shift, filter) => {
    if (filter === 'todos') return true;
    const sType = shift.shift_type || (shift.start_time >= '18:00' || shift.start_time < '06:00' ? 'noturno' : 'diurno');
    return sType === filter;
  };

  const monthlyShifts = useMemo(() => {
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const prefix = `${currentYear}-${monthStr}`;
    return (shifts || []).filter(s => {
      if (!s?.date || !s.date.startsWith(prefix) || s.status === 'cancelado') return false;
      if (monthlyView === 'lista' && startDateFilter && s.date < startDateFilter) return false;
      if (selectedSectorId !== 'todos' && String(s.sector_id) !== String(selectedSectorId)) return false;
      if (!isShiftMatchingTurno(s, filterTurno)) return false;
      // Plantonista vê só a escala publicada; rascunho fica com a gestão.
      if (!isManager && !getPublishedRanges(s.unit_id || selectedUnitId, s.sector_id, currentYear, currentMonth + 1).some(r => s.date >= r.start_date && s.date <= r.end_date)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shifts, currentYear, currentMonth, selectedSectorId, filterTurno, startDateFilter, monthlyView, isManager, publishedRanges, selectedUnitId]);


  const scheduleFilteredShifts = useMemo(() => {
    if (scheduleSpecialtyFilter === 'todas') return monthlyShifts;
    const selectedSpecialty = normalize(scheduleSpecialtyFilter);
    return monthlyShifts.filter(shift =>
      normalize(extractSpecialty(shift, professionalMap[String(shift.professional_id)])) === selectedSpecialty
    );
  }, [monthlyShifts, scheduleSpecialtyFilter, professionalMap]);

  const scheduleVisibleShifts = useMemo(() => {
    const searchTerm = normalize(scheduleProfessionalSearch);
    if (!searchTerm) return scheduleFilteredShifts;
    return scheduleFilteredShifts.filter(shift => {
      if (isVacant(shift)) return true;
      const professionalName = professionalMap[String(shift.professional_id)]?.name || getShiftName(shift);
      return normalize(professionalName).includes(searchTerm);
    });
  }, [scheduleFilteredShifts, scheduleProfessionalSearch, professionalMap]);

  const shiftsByDate = useMemo(() => {
    const map = {};
    scheduleVisibleShifts.forEach(shift => {
      if (!map[shift.date]) map[shift.date] = [];
      map[shift.date].push(shift);
    });
    return map;
  }, [scheduleVisibleShifts]);

  const monthStats = useMemo(() => {
    let filled = 0, open = 0, furos = 0, hours = 0;
    // Vaga extra vazia não é furo nem vaga em aberto.
    const counted = scheduleVisibleShifts.filter(sh => !(isExtraVacancy(sh) && isVacant(sh)));
    counted.forEach(sh => {
      if (isVacant(sh)) { if (isShiftPast(sh, liveNow)) furos++; else open++; }
      else { filled++; hours += shiftHours(sh); }
    });
    const total = counted.length;
    return { total, filled, open, furos, hours: Math.round(hours), coverage: total ? Math.round((filled / total) * 100) : null };
  }, [scheduleVisibleShifts, liveNow]);
  // Abas de setor: as 5 primeiras (mais a escolhida, se estiver depois) e o resto no "+N".
  const { visibleSectorTabs, hiddenSectorTabs } = useMemo(() => {
    const list = sectors || [];
    const LIMIT = 5;
    if (list.length <= LIMIT + 1) return { visibleSectorTabs: list, hiddenSectorTabs: [] };
    const visible = list.slice(0, LIMIT);
    const chosen = list.find(sec => String(sec.id) === String(selectedSectorId));
    if (chosen && !visible.includes(chosen)) visible.push(chosen);
    return { visibleSectorTabs: visible, hiddenSectorTabs: list.filter(sec => !visible.includes(sec)) };
  }, [sectors, selectedSectorId]);
  const draftSectorIds = useMemo(() => new Set((unsubmittedSectors || []).map(sec => String(sec.id))), [unsubmittedSectors]);
  const gridSectors = useMemo(() => (selectedSectorId === 'todos' ? (sectors || []) : (sectors || []).filter(sec => String(sec.id) === String(selectedSectorId))), [sectors, selectedSectorId]);

  const filteredTrayProfs = useMemo(() => {
    const term = traySearch.toLowerCase().trim();
    return (professionals || []).filter(p => {
      if (p?.status !== 'ativo') return false;
      if (traySpecialtyFilter !== 'todas' && (p.specialty || '').toLowerCase() !== traySpecialtyFilter.toLowerCase()) return false;
if (selectedSectorId !== 'todos' && !isProfessionalAuthorizedForSector(p, selectedSectorId)) return false;
if (!term) return true;
return (p.name || '').toLowerCase().includes(term) || (p.specialty || '').toLowerCase().includes(term);
});
}, [professionals, traySearch, traySpecialtyFilter, selectedSectorId]);

  const handleDayClick = (dateStr, e) => {
    if (selectDaysMode || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setSelectedDays(prev => prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]);
    } else {
      if (selectedDays.length > 0) setSelectedDays([]);
    }
  };

  const handleDragStart = (e, profId) => { setDraggingProfId(profId); e.dataTransfer.setData('text/plain', profId); };

  // Com dias marcados, soltar em qualquer dia vale para todos os marcados (e para o dia em que soltou).
  const dropTargetDates = dateStr => (selectedDays.length ? [...new Set([...selectedDays, dateStr])].sort() : [dateStr]);

  const handleDropOnSlot = async (e, dateStr, startTime, endTime, specialty, sectorId) => {
    e.preventDefault();
    e.stopPropagation();

    const profId = e.dataTransfer.getData('text/plain') || draggingProfId;
    if (!profId) return;
    await allocateToSlot(profId, dropTargetDates(dateStr), startTime, endTime, specialty, sectorId);
  };

  const allocateToSlot = async (profId, targetDates, startTime, endTime, specialty, sectorId) => {
    const prof = professionalMap[String(profId)];
    if (!prof) return;

    const normalizedSpec = normalize(specialty || prof.specialty || 'Clínica Médica');

    // Localiza uma vaga física já criada pelo gerador. Não cria um novo plantão
    // por fora da grade; preenche exatamente o slot configurado. Dia sem vaga nesse horário,
    // ou em que a pessoa já trabalha, fica de fora e aparece na confirmação.
    const targets = [];
    const skipped = [];
    for (const d of targetDates) {
      const candidate = (shifts || []).find(shift => {
        if (!shift || shift.status === 'cancelado') return false;
        if (!isVacant(shift)) return false;
        if (shift.date !== d) return false;
        if (String(shift.sector_id) !== String(sectorId)) return false;
        if (String(shift.start_time || '') !== String(startTime || '')) return false;
        if (String(shift.end_time || '') !== String(endTime || '')) return false;
        return normalize(extractSpecialty(shift)) === normalizedSpec;
      });

      if (!candidate) {
        skipped.push(`${formatDateBR(d)} (sem vaga aberta ${startTime}–${endTime})`);
        continue;
      }

      if (!isProfessionalAuthorizedForSector(prof, candidate.sector_id)) {
        const sectorName = sectorMap[String(candidate.sector_id)]?.name || 'este setor';
        alert(`⛔ ${prof.name || 'O profissional'} não está autorizado(a) para o setor ${sectorName}.`);
        setDraggingProfId(null);
        return;
      }

      const loadWarnings = workloadWarningsFor(prof.id, { id: candidate.id, date: d, start_time: startTime, end_time: endTime });
      const conflict = checkProfessionalConflict(profId, d, startTime, endTime, candidate.id);
      if (conflict.hasConflict) {
        if (targetDates.length === 1) {
          alert(`⛔ BLOQUEIO DE ESCALA:\n\n${conflict.message}\n\nO profissional não pode assumir dois plantões no mesmo horário.`);
          setDraggingProfId(null);
          return;
        }
        skipped.push(`${formatDateBR(d)} (já tem plantão nesse horário)`);
        continue;
      }

      if (loadWarnings.length && !confirm(`Atenção à carga de ${prof.name || 'profissional'}: ${loadWarnings.map(w => w.message).join('; ')}.\n\nEscalar mesmo assim em ${formatDateBR(d)}?`)) {
        skipped.push(`${formatDateBR(d)} (carga de trabalho)`);
        continue;
      }

      const away = findUnavailability(prof, d);
      if (away && !confirm(`${prof.name || 'O profissional'} informou indisponibilidade: ${describeUnavailability(away)}.\n\nEscalar mesmo assim em ${formatDateBR(d)}?`)) {
        skipped.push(`${formatDateBR(d)} (indisponível)`);
        continue;
      }

      targets.push(candidate);
    }

    if (targets.length === 0) {
      alert(`Nenhuma vaga preenchida para ${prof.name || 'o profissional'} em ${startTime}–${endTime}:\n\n${skipped.join('\n')}`);
      setDraggingProfId(null);
      return;
    }

    const targetSummary = targets.map(target => {
      const targetSpecialty = extractSpecialty(target);
      const targetSector = sectorMap[String(target.sector_id)]?.name || 'Setor';
      return `• ${formatDateBR(target.date)} | ${target.start_time}-${target.end_time} | ${targetSpecialty} | ${targetSector}`;
    }).join('\n');

    const vacancyCountText = targets.length === 1 ? '1 vaga' : `${targets.length} vagas`;
    const skippedText = skipped.length ? `\n\nFicam de fora:\n${skipped.join('\n')}` : '';
    if (!confirm(`Confirme a alocação de ${prof.name}:\n\n${targetSummary}${skippedText}\n\nIsso preencherá ${vacancyCountText}. Deseja continuar?`)) {
      setDraggingProfId(null);
      return;
    }

    try {
      for (const target of targets) {
        const spec = target.target_specialty || prof.specialty || specialty || 'Clínica Médica';
        await autoHealingSaveShift(target.id, {
          professional_id: prof.id,
          professional_name: prof.name,
          target_specialty: spec,
          status: 'confirmado',
          notes: `${String(target.notes || '').replace(/\[ALOCADO_APOS_GERACAO\]/gi, '').trim()} [ALOCADO_APOS_GERACAO]`.trim()
        });
      }

      await notifyAllocations(targets.map(target => ({ shift: target, prof })));
      setSelectedDays([]);
      setSelectDaysMode(false);
      await syncGlobalData();
    } catch (err) {
      alert('Erro ao alocar: ' + err.message);
    } finally {
      setDraggingProfId(null);
    }
  };

  // Soltar no corpo do dia: nunca escolhe o horário sozinho. Com um turno escolhido na lista de
  // profissionais, usa esse; com um só horário aberto, usa ele; senão pergunta (manhã, tarde, noite…).
  const handleDropOnDay = async (e, dateStr) => {
    e.preventDefault();
    e.stopPropagation();

    const profId = e.dataTransfer.getData('text/plain') || draggingProfId;
    if (!profId) return;
    const targetDates = dropTargetDates(dateStr);
    const vacancies = (shifts || [])
      .filter(s => s && targetDates.includes(s.date) && s.status !== 'cancelado' && isVacant(s))
      .filter(s => selectedSectorId === 'todos' || String(s.sector_id) === String(selectedSectorId))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.start_time).localeCompare(String(b.start_time)));

    if (vacancies.length === 0) {
      alert(targetDates.length > 1 ? 'Os dias marcados não têm vaga aberta.' : 'Este dia não possui vaga aberta.');
      setDraggingProfId(null);
      return;
    }
    // Cada opção leva um plantão de exemplo (especialidade e setor) do horário.
    const options = listHorarios(vacancies).map(h => ({ ...h, sample: vacancies.find(v => `${String(v.start_time).slice(0, 5)}-${String(v.end_time).slice(0, 5)}` === h.key) }));
    if (trayHorario) {
      const chosen = options.find(o => o.key === trayHorario);
      if (!chosen) {
        alert(`Nenhuma vaga aberta de ${trayHorario.replace('-', '–')} ${targetDates.length > 1 ? 'nos dias marcados' : 'neste dia'}. Troque o turno na lista de profissionais ou solte sobre o horário certo.`);
        setDraggingProfId(null);
        return;
      }
      await allocateToSlot(profId, targetDates, chosen.sample.start_time, chosen.sample.end_time, extractSpecialty(chosen.sample), chosen.sample.sector_id);
      return;
    }
    if (options.length === 1) {
      const only = options[0].sample;
      await allocateToSlot(profId, targetDates, only.start_time, only.end_time, extractSpecialty(only), only.sector_id);
      return;
    }
    setDayDropChoice({ profId, targetDates, options });
  };

  const chooseDayDropHorario = async option => {
    const choice = dayDropChoice;
    setDayDropChoice(null);
    if (!choice) return;
    await allocateToSlot(choice.profId, choice.targetDates, option.sample.start_time, option.sample.end_time, extractSpecialty(option.sample), option.sample.sector_id);
  };

  // Horários com vaga aberta no mês, para o gestor fixar o turno antes de arrastar.
  const trayHorarios = useMemo(() => listHorarios(Object.values(shiftsByDate).flat().filter(s => s && s.status !== 'cancelado' && isVacant(s))), [shiftsByDate]);

  // ---------- Grade: quem pode assumir, escalar, liberar, criar ----------
  const monthHoursByProfessional = useMemo(() => {
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const map = {};
    companyShifts.forEach(s => {
      if (!s?.professional_id || !String(s.date || '').startsWith(prefix) || s.status === 'cancelado' || isVacant(s)) return;
      map[String(s.professional_id)] = (map[String(s.professional_id)] || 0) + shiftHours(s);
    });
    return map;
  }, [companyShifts, currentYear, currentMonth]);

  const getGridCandidates = (shift) => {
    const wanted = normalize(extractSpecialty(shift));
    const available = [];
    const unavailable = [];
    (professionals || []).filter(p => p?.status === 'ativo' && String(p.id) !== String(shift.professional_id || '')).forEach(prof => {
      if (!isProfessionalAuthorizedForSector(prof, shift.sector_id)) return; // nem aparece: não trabalha neste setor
      const away = findUnavailability(prof, shift.date);
      if (away) { unavailable.push({ prof, reason: describeUnavailability(away) }); return; }
      const conflict = checkProfessionalConflict(prof.id, shift.date, shift.start_time, shift.end_time, shift.id);
      if (conflict.hasConflict) { unavailable.push({ prof, reason: `já tem plantão ${conflict.conflictShift?.start_time || ''}`.trim() }); return; }
      const warnings = workloadWarningsFor(prof.id, { id: shift.id, date: shift.date, start_time: shift.start_time, end_time: shift.end_time });
      available.push({
        prof,
        hours: Math.round(monthHoursByProfessional[String(prof.id)] || 0),
        warning: warnings.length ? warnings.map(w => w.message).join('; ') : '',
        sameSpecialty: !wanted || normalize(prof.specialty) === wanted
      });
    });
    available.sort((a, b) => Number(b.sameSpecialty) - Number(a.sameSpecialty) || Number(!!a.warning) - Number(!!b.warning) || a.hours - b.hours || String(a.prof.name).localeCompare(String(b.prof.name), 'pt-BR'));
    return { available, unavailable };
  };

  const handleGridAssign = async (shift, prof) => {
    if (isShiftPast(shift, liveNow)) { openShiftEditor(shift); return false; }
    const conflict = checkProfessionalConflict(prof.id, shift.date, shift.start_time, shift.end_time, shift.id);
    if (conflict.hasConflict) { alert(conflict.message); return false; }
    const warnings = workloadWarningsFor(prof.id, { id: shift.id, date: shift.date, start_time: shift.start_time, end_time: shift.end_time });
    if (warnings.length && !confirm(`Atenção à carga de ${prof.name || 'profissional'}: ${warnings.map(w => w.message).join('; ')}.\n\nEscalar mesmo assim?`)) return false;
    try {
      await autoHealingSaveShift(shift.id, {
        professional_id: prof.id,
        professional_name: prof.name,
        target_specialty: shift.target_specialty || extractSpecialty(shift, prof),
        status: 'confirmado'
      });
      await notifyAllocations([{ shift, prof }]);
      await syncGlobalData();
      return true;
    } catch (err) {
      alert('Não foi possível escalar: ' + (err?.message || 'tente novamente.'));
      return false;
    }
  };

  // Tira o profissional e oferece "Desfazer" por 10 s (no lugar da confirmação).
  // Se alguém assumir a vaga pelo Mural nesse meio-tempo, o desfazer não passa por cima.
  const releaseShift = async (shift) => {
    const name = professionalMap[String(shift.professional_id)]?.name || shift.professional_name || 'O profissional';
    const before = { professional_id: shift.professional_id ?? null, professional_name: shift.professional_name ?? null, status: shift.status && shift.status !== 'vago' ? shift.status : 'confirmado' };
    await autoHealingSaveShift(shift.id, { professional_id: null, professional_name: null, status: 'vago' });
    await syncGlobalData();
    offerUndo({
      title: `${name} saiu do plantão de ${formatDateBR(shift.date)}`,
      description: 'A vaga ficou aberta no Mural. Você tem 10 segundos para desfazer.',
      onUndo: async () => {
        const { data: current, error } = await supabase.from('shifts').select('professional_id,professional_name').eq('id', shift.id).maybeSingle();
        if (error) throw error;
        if (!current) throw new Error('O plantão não existe mais.');
        if (current.professional_id && String(current.professional_id) !== String(before.professional_id)) {
          throw new Error(`A vaga já foi assumida por ${current.professional_name || 'outro profissional'}.`);
        }
        await autoHealingSaveShift(shift.id, before);
        await syncGlobalData();
      }
    });
  };

  const handleGridUnassign = async (shift) => {
    try {
      await releaseShift(shift);
      return true;
    } catch (err) {
      alert('Não foi possível liberar a vaga: ' + (err?.message || 'tente novamente.'));
      return false;
    }
  };

  const openNewShift = (preset = {}) => {
    setEditingShiftId(null);
    setFormData({
      date: preset.date || getLocalDateString(),
      sector_id: preset.sector_id || (selectedSectorId !== 'todos' ? selectedSectorId : ((sectors || [])[0]?.id || '')),
      target_specialty: preset.specialty || registeredSpecialties[0] || 'Clínica Médica',
      start_time: preset.start_time || '07:00',
      end_time: preset.end_time || '19:00',
      shift_type: (preset.start_time || '07:00') >= '18:00' ? 'noturno' : 'diurno',
      action_type: 'alocar', professional_id: '', notes: '', retroactive_justification: '', is_extra: Boolean(preset.is_extra)
    });
    setModalOpen(true);
  };

  const openGenerator = (sectorId, monthDate = currentDate) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const target = sectorId || (selectedSectorId !== 'todos' ? selectedSectorId : ((sectors || [])[0]?.id || ''));
    setGeneratorConfig(prev => ({ ...prev, start_date: `${year}-${String(month + 1).padStart(2, '0')}-01`, duration_days: new Date(year, month + 1, 0).getDate(), interval_days: 1 }));
    loadSectorIntoGenerator(target);
    setGeneratorModalOpen(true);
  };

  // Setores › "Montar mês": chega aqui com o setor escolhido e abre o gerador.
  useEffect(() => {
    if (!isManager || !(sectors || []).length) return;
    let pending = null;
    try { pending = window.sessionStorage.getItem('scale_open_generator_sector'); window.sessionStorage.removeItem('scale_open_generator_sector'); } catch { return; }
    if (!pending || !(sectors || []).some(sec => String(sec.id) === String(pending))) return;
    setSelectedSectorId(String(pending));
    openGenerator(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager, sectors]);

  const shortLabels = useMemo(() => buildShortLabels(professionals || []), [professionals]);

  // Nas janelas (montar mês, publicar, plantão, copiar), em 'Todas as unidades' o setor leva o nome da unidade.
  const labeledSectors = useMemo(() => (isAllUnits ? (sectors || []).map(s => ({ ...s, name: `${s.name} · ${unitName(s.unit_id)}` })) : sectors), [isAllUnits, sectors, unitName]);
  const gridHelpers = {
    unitLabel: (unitId) => (isAllUnits ? unitName(unitId) : ''),
    shortLabel: (s) => shortLabels[String(s.professional_id)] || getInitials(professionalMap[String(s.professional_id)]?.name || getShiftName(s)),
    isVacant,
    isShiftPast: (s) => isShiftPast(s, liveNow),
    extractSpecialty: (s) => extractSpecialty(s, professionalMap[String(s.professional_id)]),
    getInitials,
    formatFullName,
    professionalName: (s) => professionalMap[String(s.professional_id)]?.name || getShiftName(s),
    sectorName: (id) => sectorMap[String(id)]?.name || 'Setor',
    formatDay: (d) => { const t = new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }); return t.charAt(0).toUpperCase() + t.slice(1).replace('.', ''); }
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!formData.sector_id || !formData.date) return;

    const isPast = isShiftPast({ date: formData.date, start_time: formData.start_time, end_time: formData.end_time }, liveNow);
    // Sem profissional escolhido o plantão continua sendo uma vaga, nunca "confirmado" vazio.
    const isMural = formData.action_type === 'mural' || !formData.professional_id;

    if (isPast && !isMural && (!formData.retroactive_justification || !formData.retroactive_justification.trim())) {
      alert("Atenção: O plantão já foi encerrado. Você deve preencher a justificativa para o ajuste retroativo.");
      return;
    }

const selectedProfessional = professionalMap[String(formData.professional_id)];
if (!isMural && formData.professional_id && !selectedProfessional) {
  alert('O profissional selecionado não está mais disponível nesta unidade. Atualize a tela e selecione novamente.');
  return;
}
if (!isMural && formData.professional_id &&
    !isProfessionalAuthorizedForSector(selectedProfessional, formData.sector_id)) {
  const sectorName = sectorMap[String(formData.sector_id)]?.name || 'este setor';
  alert(`⛔ ${selectedProfessional?.name || 'O profissional selecionado'} não está autorizado(a) para o setor ${sectorName}.`);
  return;
}

if (!isMural && formData.professional_id && isOtherSpecialty(selectedProfessional, formData.target_specialty) &&
    !confirm(`A vaga é de ${formData.target_specialty} e ${selectedProfessional?.name || 'o profissional'} é de ${selectedProfessional?.specialty || 'nenhuma especialidade cadastrada'}.\n\nSó a coordenação pode escalar alguém fora da especialidade. Escalar mesmo assim?`)) return;

if (!isMural && formData.professional_id) {
      const loadWarnings = workloadWarningsFor(formData.professional_id, { id: editingShiftId || 'novo', date: formData.date, start_time: formData.start_time, end_time: formData.end_time });
      if (loadWarnings.length && !confirm(`Atenção à carga de ${selectedProfessional?.name || 'profissional'}: ${loadWarnings.map(w => w.message).join('; ')}.\n\nEscalar mesmo assim?`)) return;

      const away = findUnavailability(selectedProfessional, formData.date);
      if (away && !confirm(`${selectedProfessional?.name || 'O profissional'} informou indisponibilidade: ${describeUnavailability(away)}.\n\nEscalar mesmo assim?`)) return;

      const conflict = checkProfessionalConflict(
        formData.professional_id, 
        formData.date, 
        formData.start_time, 
        formData.end_time, 
        editingShiftId
      );

      if (conflict.hasConflict) {
        alert(`⛔ AÇÃO BLOQUEADA POR CONFLITO DE ESCALA:\n\n${conflict.message}\n\nO profissional não pode assumir dois plantões no mesmo horário.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const prof = formData.professional_id ? professionalMap[formData.professional_id] : null;
      const finalSpecialty = (formData.target_specialty || prof?.specialty || 'Clínica Médica').trim();
      const sType = formData.start_time >= '18:00' || formData.start_time < '06:00' ? 'noturno' : 'diurno';

      let baseNotes = (formData.notes || '').replace(/\[ESP:[^\]]+\]/gi, '').replace(/\[AJUSTE_RETROATIVO:[^\]]+\]/gi, '').trim();
      baseNotes = baseNotes.split(EXTRA_VACANCY_TAG).join('').trim();
      let newNotes = `[ESP:${finalSpecialty}] ${baseNotes}${formData.is_extra ? ` ${EXTRA_VACANCY_TAG}` : ''}`;
      
      if (isPast && formData.action_type === 'alocar' && formData.retroactive_justification) {
        newNotes += ` [AJUSTE_RETROATIVO:${formData.retroactive_justification.replace(/\[|\]/g, '')}]`;
      }

      const payload = {
        company_id: company?.id || 'cmp_principal',
        unit_id: unitOfSector(formData.sector_id) || 'unit_h1',
        sector_id: formData.sector_id,
        target_specialty: finalSpecialty,
        professional_id: isMural ? null : formData.professional_id,
        professional_name: isMural ? null : (prof?.name || null),
        date: formData.date,
        shift_type: sType,
        start_time: formData.start_time,
        end_time: formData.end_time,
        status: isMural ? 'vago' : (isPast ? 'realizado' : 'confirmado'),
        notes: newNotes.trim()
      };

      const previousProfessionalId = editingShiftId
        ? String((shifts || []).find(s => String(s.id) === String(editingShiftId))?.professional_id || '')
        : '';
      const saved = await autoHealingSaveShift(editingShiftId, payload);
      if (!isMural && prof && String(prof.id) !== previousProfessionalId && !isPast) {
        await notifyAllocations([{ shift: { ...payload, id: saved?.id || editingShiftId }, prof }]);
      }

      setModalOpen(false); await syncGlobalData();
    } catch (err) {
      alert('Erro ao salvar plantão: ' + (err?.message || 'Tente novamente.'));
    } finally { setSubmitting(false); }
  };

  // Guarda a linha inteira antes de apagar: o "Desfazer" grava o mesmo plantão de volta.
  const handleDeleteShift = async (shiftId) => {
    try {
      const { data: row, error: readError } = await supabase.from('shifts').select('*').eq('id', shiftId).maybeSingle();
      if (readError) throw readError;
      const { error } = await supabase.from('shifts').delete().eq('id', shiftId);
      if (error) throw error;
      setModalOpen(false);
      await syncGlobalData();
      if (row) {
        const who = row.professional_id ? (professionalMap[String(row.professional_id)]?.name || row.professional_name) : '';
        offerUndo({
          title: `Plantão de ${formatDateBR(row.date)} excluído`,
          description: `${row.start_time || ''}–${row.end_time || ''} · ${sectorMap[String(row.sector_id)]?.name || 'Setor'}${who ? ` · ${who}` : ''}. Você tem 10 segundos para desfazer.`,
          onUndo: async () => {
            const { error: insertError } = await supabase.from('shifts').insert([row]);
            if (insertError) throw insertError;
            await syncGlobalData();
          }
        });
      }
    } catch (err) { alert(err.message); }
  };

const handleAssignLegacyShiftUnit = async (shift) => {
  const unitId = legacyUnitDrafts[String(shift.id)];
  if (!isManager || !unitId || !units.some(unit => String(unit.id) === String(unitId))) {
    alert('Selecione uma unidade válida antes de vincular o plantão.');
    return;
  }
  if (!confirm(`Vincular o plantão de ${formatDateBR(shift.date)} no setor ${sectorMap[String(shift.sector_id)]?.name || 'Setor'} à unidade ${units.find(unit => String(unit.id) === String(unitId))?.name}?`)) return;

  setLegacyAssignmentSaving(true);
  try {
    await autoHealingSaveShift(shift.id, {
      unit_id: String(unitId),
      company_id: shift.company_id || company?.id || 'cmp_principal'
    });
    await syncGlobalData();
    setLegacyUnitDrafts(prev => {
      const next = { ...prev };
      delete next[String(shift.id)];
      return next;
    });
  } catch (error) {
    console.error('Não foi possível vincular o plantão legado a uma unidade:', error);
    alert(`O plantão não foi alterado. Verifique sua conexão e tente novamente. ${error?.message || ''}`);
  } finally {
    setLegacyAssignmentSaving(false);
  }
};

  const openShiftEditor = (shift) => {
    if (!isManager || !shift) return;
    const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
    setEditingShiftId(shift.id);
    setFormData({
      date: shift.date,
      sector_id: shift.sector_id,
      target_specialty: extractSpecialty(shift, prof),
      start_time: shift.start_time,
      end_time: shift.end_time,
      shift_type: shift.shift_type || 'diurno',
      action_type: 'alocar',
      professional_id: shift.professional_id || '',
      notes: shift.notes || '',
      is_extra: isExtraVacancy(shift),
      retroactive_justification: extractRetroactiveJustification(shift.notes)
    });
    setModalOpen(true);
  };

  const TURNOS = [
    { id: 'manha', label: 'Manhã', icon: Sun, match: h => h >= 5 && h < 12 },
    { id: 'tarde', label: 'Tarde', icon: Sun, match: h => h >= 12 && h < 18 },
    { id: 'noite', label: 'Noite', icon: Moon, match: h => h >= 18 || h < 5 }
  ];

  // Lixeira do dia: tira todos os plantões do dia (no setor filtrado), com "Desfazer" por 10 segundos.
  const handleClearDay = async (dateStr, dayShifts) => {
    if (!dayShifts.length) return;
    const withProf = dayShifts.filter(s => !isVacant(s)).length;
    if (!confirm(`Tirar ${formatDateBR(dateStr)} da escala?\n\nSerão excluídos ${dayShifts.length} plantão(ões)${withProf ? `, ${withProf} com profissional` : ''}${selectedSectorObj ? ` do setor ${selectedSectorObj.name}` : ' de todos os setores mostrados'}. Dá para desfazer logo em seguida.`)) return;
    try {
      const ids = dayShifts.map(s => s.id);
      const { data: rows, error: readError } = await supabase.from('shifts').select('*').in('id', ids);
      if (readError) throw readError;
      const { error } = await supabase.from('shifts').delete().in('id', ids);
      if (error) throw error;
      await syncGlobalData();
      offerUndo({
        title: `${formatDateBR(dateStr)} tirado da escala`,
        description: `${ids.length} plantão(ões) excluído(s). Você tem 10 segundos para desfazer.`,
        onUndo: async () => {
          const { error: insertError } = await supabase.from('shifts').insert(rows || []);
          if (insertError) throw insertError;
          await syncGlobalData();
        }
      });
    } catch (err) { alert('Não foi possível limpar o dia: ' + (err?.message || 'tente de novo.')); }
  };

  // Excluir a escala do mês que ainda não foi publicada (V0.9.2): some de todas as telas; períodos já
  // publicados ficam. Vale para o setor escolhido ou, em "Todos", para todos os setores mostrados.
  const handleClearDraftMonth = async () => {
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const targets = (shifts || []).filter(s => s?.date && String(s.date).startsWith(prefix) &&
      (selectedSectorId === 'todos' || String(s.sector_id) === String(selectedSectorId)) &&
      !getSectorPublishedRanges(s.sector_id).some(r => s.date >= r.start_date && s.date <= r.end_date));
    const where = selectedSectorObj ? `do setor ${selectedSectorObj.name}` : 'de todos os setores mostrados';
    if (!targets.length) { alert(`Não há escala em rascunho em ${MONTH_NAMES[currentMonth]} ${where}.`); return; }
    const withProf = targets.filter(s => !isVacant(s)).length;
    if (!confirm(`Excluir a escala de ${MONTH_NAMES[currentMonth]} ${where}?

Saem ${targets.length} plantão(ões) que ainda não foram publicados${withProf ? `, ${withProf} com profissional` : ''}. Eles somem de todas as telas. Períodos já publicados ficam como estão.

Dá para desfazer logo em seguida.`)) return;
    try {
      const ids = targets.map(s => s.id);
      const { data: rows, error: readError } = await supabase.from('shifts').select('*').in('id', ids);
      if (readError) throw readError;
      const { error } = await supabase.from('shifts').delete().in('id', ids);
      if (error) throw error;
      await syncGlobalData();
      offerUndo({
        title: `Escala de ${MONTH_NAMES[currentMonth]} excluída`,
        description: `${ids.length} plantão(ões) excluído(s). Você tem 10 segundos para desfazer.`,
        onUndo: async () => {
          const { error: insertError } = await supabase.from('shifts').insert(rows || []);
          if (insertError) throw insertError;
          await syncGlobalData();
        }
      });
    } catch (err) { alert('Não foi possível excluir a escala: ' + (err?.message || 'tente de novo.')); }
  };

  const renderDayPanel = (dateStr) => {
    const dayShifts = (shiftsByDate[dateStr] || []).slice()
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)) || Number(isVacant(b)) - Number(isVacant(a)));
    const filled = dayShifts.filter(s => !isVacant(s)).length;
    const published = isDatePublishedForCurrentSector(dateStr);
    const title = (() => { const s = new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); })();

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-start justify-between gap-2 border-b border-slate-200 dark:border-slate-800 p-4">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {dayShifts.length === 0 ? 'Sem plantões' : `${filled} de ${dayShifts.length} preenchidos`}
              {' · '}{published ? 'Publicada' : 'Rascunho'}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1">
            {isManager && dayShifts.length > 0 && (
              <button type="button" onClick={() => handleClearDay(dateStr, dayShifts)} title="Tirar este dia da escala" aria-label="Tirar este dia da escala"
                className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 cursor-pointer">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            {isManager && (
              <button
                type="button"
                onClick={() => {
                  setEditingShiftId(null);
                  setFormData({ date: dateStr, sector_id: selectedSectorId !== 'todos' ? selectedSectorId : ((sectors || [])[0]?.id || ''), target_specialty: registeredSpecialties[0] || 'Clínica Médica', start_time: '07:00', end_time: '19:00', shift_type: 'diurno', action_type: 'alocar', professional_id: '', notes: '', retroactive_justification: '' });
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Plantão
              </button>
            )}
            <button type="button" onClick={() => setDayPanelOpen(false)} aria-label="Fechar" className="2xl:hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
          {dayShifts.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum plantão neste dia.</p>
          )}
          {TURNOS.map(turno => {
            const items = dayShifts.filter(s => turno.match(parseInt(String(s.start_time || '07').split(':')[0], 10)));
            if (items.length === 0) return null;
            const Icon = turno.icon;
            return (
              <section key={turno.id}>
                <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Icon className="h-3.5 w-3.5" /> {turno.label} <span className="font-normal normal-case">· {items.length}</span>
                </h4>
                <ul className="space-y-1.5">
                  {items.map(shift => {
                    const open = isVacant(shift);
                    const overdue = open && isShiftPast(shift, liveNow);
                    const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
                    const name = prof?.name || shift.professional_name;
                    const life = computeShiftHospitalLifecycle(shift, liveNow);
                    const spec = extractSpecialty(shift, prof);
                    const sectorName = !selectedSectorObj ? sectorMap[String(shift.sector_id)]?.name : '';
                    return (
                      <li
                        key={shift.id}
                        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={e => {
                          e.preventDefault(); e.stopPropagation();
                          if (!open) { setDraggingProfId(null); alert('Este horário já está preenchido. Solte o profissional em uma vaga aberta.'); return; }
                          handleDropOnSlot(e, dateStr, shift.start_time, shift.end_time, spec, shift.sector_id);
                        }}
                        className={`flex items-center gap-3 rounded-xl border p-2.5 ${open
                          ? (overdue ? 'border-rose-200 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/5' : 'border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/5')
                          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'} ${draggingProfId && open ? 'ring-2 ring-sky-500' : ''}`}
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${open
                          ? (overdue ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300')
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
                          {open ? <AlertTriangle className="h-4 w-4" /> : getInitials(name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">
                            {open ? (overdue ? 'Furo (sem profissional)' : 'Vaga aberta') : name}
                          </span>
                          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                            {shift.start_time}–{shift.end_time} · {spec}{sectorName ? ` · ${sectorName}` : ''}
                          </span>
                        </span>
                        {open ? (
                          isManager && (
                            <span className="flex shrink-0 items-center gap-1">
                              <button type="button" onClick={() => openShiftEditor(shift)} className="rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 cursor-pointer">
                                Alocar
                              </button>
                              <button type="button" onClick={() => { if (confirm(`Excluir a vaga de ${formatDateBR(dateStr)} ${shift.start_time}–${shift.end_time}?`)) handleDeleteShift(shift.id); }}
                                aria-label={`Excluir a vaga das ${shift.start_time}`} title="Excluir esta vaga"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 cursor-pointer">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </span>
                          )
                        ) : (
                          <span className="flex shrink-0 items-center gap-2">
                            {life.isLive && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Agora</span>}
                            {isManager && (
                              <button type="button" onClick={() => openShiftEditor(shift)} aria-label={`Editar plantão de ${name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer">
                                <SlidersHorizontal className="h-4 w-4" />
                              </button>
                            )}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    );
  };

  // Selo curto do plantão (cor só para status).
  const PILL_TONES = {
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    amber: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  };
  const shiftPill = (shift) => {
    if (isVacant(shift)) return isShiftPast(shift, liveNow) ? { label: 'Furo', tone: 'rose' } : { label: 'Vaga aberta', tone: 'amber' };
    const life = computeShiftHospitalLifecycle(shift, liveNow);
    if (life.isLive) return { label: life.isHandover ? 'Passagem de plantão' : 'Em andamento', tone: 'emerald' };
    if (life.isConcluded) return { label: 'Concluído', tone: 'slate' };
    return { label: 'Programado', tone: 'slate' };
  };

  const renderShiftCard = (shift, dateStr) => {
    const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
    const pill = shiftPill(shift);
    const realSpec = extractSpecialty(shift, prof);
    const validName = prof?.name || shift.professional_name;
    const isOpen = isVacant(shift);

    return (
      <div
        key={shift.id}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={e => {
          e.preventDefault();
          e.stopPropagation();
          if (!isOpen) {
            alert('Este horário já está preenchido. Solte o profissional em uma vaga aberta.');
            setDraggingProfId(null);
            return;
          }
          handleDropOnSlot(e, dateStr, shift.start_time, shift.end_time, realSpec, shift.sector_id);
        }}
        onClick={e => {
          e.stopPropagation();
          if (!isManager) return;
          setEditingShiftId(shift.id);
          setFormData({
            date: shift.date,
            sector_id: shift.sector_id,
            target_specialty: realSpec,
            start_time: shift.start_time,
            end_time: shift.end_time,
            shift_type: shift.shift_type || 'diurno',
            action_type: isOpen ? 'mural' : 'alocar',
            professional_id: shift.professional_id || '',
            notes: shift.notes || '',
            retroactive_justification: extractRetroactiveJustification(shift.notes)
          });
          setModalOpen(true);
        }}
        className={`rounded-xl border cursor-pointer transition-colors p-3 min-w-0 ${isOpen ? (pill.tone === 'rose' ? 'border-dashed border-rose-300 dark:border-rose-500/40 bg-rose-50/50 dark:bg-rose-500/5' : 'border-dashed border-amber-300 dark:border-amber-500/40 bg-amber-50/50 dark:bg-amber-500/5') : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'} ${draggingProfId && isOpen ? 'ring-2 ring-sky-500 ring-offset-1' : ''}`}
        title={isOpen ? 'Vaga aberta: clique para escalar ou arraste um profissional' : 'Clique para editar'}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{shift.start_time}–{shift.end_time}{isExtraVacancy(shift) && <span className="ml-1.5 rounded-md border border-dashed border-slate-300 dark:border-slate-600 px-1.5 py-px text-[10px] font-semibold text-slate-600 dark:text-slate-300">Extra</span>}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PILL_TONES[pill.tone]}`}>{pill.label}</span>
        </div>
        <div className="mt-2 flex items-center gap-2.5 min-w-0">
          <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold ${isOpen ? 'border border-dashed border-current text-amber-600 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>
            {isOpen ? <Plus className="w-3.5 h-3.5" /> : getInitials(validName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium leading-snug text-slate-900 dark:text-white truncate">{isOpen ? (isExtraVacancy(shift) ? 'Vaga extra' : 'Sem profissional') : formatFullName(validName)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {realSpec}{!selectedSectorObj && sectorMap[String(shift.sector_id)]?.name ? ` · ${sectorMap[String(shift.sector_id)].name}` : ''}{isAllUnits ? ` · ${unitName(shift.unit_id)}` : ''}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // 1. MODO TV CCO EM TELA CHEIA ISOLADA
  // =========================================================================
  if (activeTab === 'tv') {
    return <TvMode closeTvMode={closeTvMode} company={company} liveNow={liveNow} professionalMap={professionalMap} sectorMap={sectorMap} selectedUnitId={selectedUnitId} tvData={tvData} units={units} />;
  }

  // =========================================================================
  // 2. TELA NORMAL DE ESCALAS & PLANTÕES
  // =========================================================================
  return (
    <div className="relative p-3 md:p-6 space-y-4 font-sans bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <PageHero
        title="Escala"
        subtitle={isManager
          ? `${selectedSectorObj ? `${selectedSectorObj.name}${isAllUnits ? ` (${unitName(selectedSectorObj.unit_id)})` : ''}` : isAllUnits ? 'Todos os setores de todas as unidades' : 'Todos os setores'} · ${isCurrentSectorPublished ? 'publicada' : 'rascunho, ainda não publicada'}`
          : `${selectedSectorObj ? selectedSectorObj.name : 'Todos os setores'} · o que a coordenação já publicou`}
        actions={t => (
          <div className="flex flex-wrap items-center gap-2">
            <div className={`flex items-center p-1 rounded-xl gap-1 ${t.pill}`}>
              <button type="button" onClick={handlePrevMonth} aria-label="Mês anterior" title="Mês anterior" className={`p-1.5 rounded-lg cursor-pointer ${t.pillButton}`}><ChevronLeft className="w-4 h-4" /></button>
              <button type="button" onClick={handleToday} title="Voltar para o mês atual" className="px-1 sm:px-2 text-sm font-medium text-white cursor-pointer min-w-[112px] sm:min-w-[128px] text-center">{MONTH_NAMES[currentMonth]} {currentYear}</button>
              <button type="button" onClick={handleNextMonth} aria-label="Próximo mês" title="Próximo mês" className={`p-1.5 rounded-lg cursor-pointer ${t.pillButton}`}><ChevronRight className="w-4 h-4" /></button>
            </div>
            {isManager && (
              <>
                <Button onClick={() => setDuplicateModalOpen(true)} className={`hidden sm:inline-flex font-medium text-sm h-10 px-4 rounded-xl gap-2 cursor-pointer shadow-none ${t.outline}`}>
                  <Copy className={`w-4 h-4 ${t.outlineIcon}`} /> Copiar mês anterior
                </Button>
                <Button onClick={openPublishModal} className={`font-semibold text-sm h-10 px-4 rounded-xl gap-2 cursor-pointer shadow-none ${t.primary}`}>
                  <Send className="w-4 h-4" /> <span>Publicar<span className="hidden sm:inline"> {MONTH_NAMES[currentMonth].toLowerCase()}</span></span>
                </Button>
              </>
            )}
          </div>
        )}
      />

      {isManager && unassignedShifts.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold">{unassignedShifts.length} plantão(ões) antigo(s) precisam de unidade</p>
              <p className="mt-1 text-xs">Eles foram retirados das visões financeiras para não serem contados em unidades erradas. Confira cada registro antes de vinculá-lo.</p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => {
              setLegacyUnitDrafts({});
              setLegacyAssignmentOpen(true);
            }}
            variant="outline"
            className="h-9 shrink-0 border-amber-400 bg-white text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-slate-900 dark:text-amber-200"
          >
            Conferir e vincular unidades
          </Button>
        </div>
      )}

      {/* BANNER 1: ALERTA DE CONFLITO EXISTENTE NA BASE */}
      {allScaleConflicts.length > 0 && isManager && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <strong className="text-sm font-semibold text-rose-800 dark:text-rose-200 block">
                Choque de horário: {allScaleConflicts.length} caso(s)
              </strong>
              <p className="text-xs text-rose-700/80 dark:text-rose-200/80">
                Há profissional escalado em dois lugares no mesmo horário. Libere uma das vagas ou edite o plantão.
              </p>
            </div>
          </div>
          <Button 
            onClick={() => {
              const firstConflict = allScaleConflicts[0];
              if (firstConflict?.b?.id) {
                releaseShift(firstConflict.b)
                  .catch(err => alert('Erro ao liberar a vaga conflitante: ' + (err?.message || 'Tente novamente.')));
              }
            }}
            className="h-9 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs px-4 rounded-xl shadow-sm shrink-0 cursor-pointer"
          >
            Liberar a vaga em choque
          </Button>
        </div>
      )}

      {/* LINHA DE CONTROLES: setores, turno, busca, visão e "Mais" */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 sm:p-3 flex flex-col gap-2.5 print:hidden">
        <nav aria-label="Setores" className="flex items-center gap-1 overflow-x-auto min-w-0 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          {[{ id: 'todos', name: 'Todos' }, ...visibleSectorTabs].map(sec => {
            const active = String(selectedSectorId) === String(sec.id);
            const draft = sec.id !== 'todos' && draftSectorIds.has(String(sec.id));
            return (
              <button key={sec.id} type="button" onClick={() => handleSelectSector(String(sec.id))} aria-current={active ? 'page' : undefined}
                title={draft ? `${sec.name}: rascunho em ${MONTH_NAMES[currentMonth].toLowerCase()}` : sec.name}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${active ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-medium' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <span className="max-w-[170px] truncate">{sec.name}</span>
                {isAllUnits && sec.id !== 'todos' && <span className="max-w-[110px] truncate text-[11px] opacity-70">· {unitName(sec.unit_id)}</span>}
                {draft && <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-amber-500" aria-label="rascunho" />}
              </button>
            );
          })}
          {hiddenSectorTabs.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="shrink-0 px-3 py-1.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">+{hiddenSectorTabs.length}</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="z-[99999] max-h-72 overflow-y-auto">
                {hiddenSectorTabs.map(sec => (
                  <DropdownMenuItem key={sec.id} onClick={() => handleSelectSector(String(sec.id))} className="cursor-pointer flex items-center gap-2">
                    {sec.name}{isAllUnits ? ` · ${unitName(sec.unit_id)}` : ''}
                    {draftSectorIds.has(String(sec.id)) && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-label="rascunho" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input placeholder="Buscar profissional" value={scheduleProfessionalSearch} onChange={e => setScheduleProfessionalSearch(e.target.value)}
              className="pl-8 h-9 w-full text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 rounded-lg" aria-label="Buscar profissional na escala" />
          </div>
          <div className="sm:ml-auto flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg" role="group" aria-label="Turno">
            {[['todos', 'Todos'], ['diurno', 'Dia'], ['noturno', 'Noite']].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setFilterTurno(id)} aria-pressed={filterTurno === id}
                className={`px-2.5 py-1 rounded-md text-xs cursor-pointer ${filterTurno === id ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium shadow-sm' : 'text-slate-500'}`}>{label}</button>
            ))}
          </div>
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg" role="group" aria-label="Visão">
            {[['grade', 'Grade', LayoutGrid], ['calendario', 'Calendário', CalendarDays], ['lista', 'Lista', ListIcon]].map(([id, label, Icon]) => (
              <button key={id} type="button" onClick={() => { setMonthlyView(id); setActiveTab('mensal'); }} aria-pressed={activeTab === 'mensal' && monthlyView === id}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs cursor-pointer ${activeTab === 'mensal' && monthlyView === id ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium shadow-sm' : 'text-slate-500'}`}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 px-3 rounded-lg text-sm gap-1.5 cursor-pointer"><MoreHorizontal className="w-4 h-4" /> Mais</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 z-[99999]">
              {isManager && <DropdownMenuItem onClick={() => setDuplicateModalOpen(true)} className="cursor-pointer sm:hidden"><Copy className="w-4 h-4 mr-2" /> Copiar mês anterior</DropdownMenuItem>}
              {isManager && <DropdownMenuItem onClick={() => openNewShift()} className="cursor-pointer"><Plus className="w-4 h-4 mr-2" /> Plantão avulso</DropdownMenuItem>}
              {isManager && <DropdownMenuItem onClick={() => openGenerator()} className="cursor-pointer"><SlidersHorizontal className="w-4 h-4 mr-2" /> Montar turnos do mês</DropdownMenuItem>}
              {isManager && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={() => setActiveTab('dia')} className="cursor-pointer"><Clock className="w-4 h-4 mr-2" /> Plantão do dia</DropdownMenuItem>
              <DropdownMenuItem onClick={openTvMode} className="cursor-pointer"><MonitorPlay className="w-4 h-4 mr-2" /> Modo TV</DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrintMonthlySchedule} className="cursor-pointer"><Printer className="w-4 h-4 mr-2" /> Imprimir o mês</DropdownMenuItem>
              {isManager && (
                <>
                  <DropdownMenuSeparator />
                  {isCurrentSectorPublished && <DropdownMenuItem onClick={handleUnpublishSector} className="cursor-pointer text-rose-600"><History className="w-4 h-4 mr-2" /> Voltar para rascunho</DropdownMenuItem>}
                  <DropdownMenuItem onClick={handleClearDraftMonth} className="cursor-pointer text-rose-600"><Trash2 className="w-4 h-4 mr-2" /> Excluir escala do mês (rascunho)</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {activeTab === 'mensal' && isManager && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 print:hidden">
          {[
            ['Cobertura', monthStats.coverage === null ? '—' : `${monthStats.coverage}%`, ''],
            ['Vagas em aberto', String(monthStats.open), monthStats.open ? 'text-amber-700 dark:text-amber-300' : ''],
            ['Furos', String(monthStats.furos), monthStats.furos ? 'text-rose-700 dark:text-rose-300' : ''],
            ['Plantões · horas', `${monthStats.filled} de ${monthStats.total} · ${monthStats.hours.toLocaleString('pt-BR')} h`, '']
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 min-w-0">
              <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
              <div className={`text-lg font-semibold tabular-nums truncate ${tone || 'text-slate-900 dark:text-white'}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'dia' && (
        <button type="button" onClick={() => setActiveTab('mensal')} className="flex items-center gap-1 text-sm font-medium text-sky-700 dark:text-sky-300 hover:underline cursor-pointer">
          <ChevronLeft className="w-4 h-4" /> Voltar para a escala do mês
        </button>
      )}

      {activeTab === 'mensal' && (
        <div className="space-y-3">
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          {isManager && monthlyView === 'calendario' && (
            <aside className={`transition-all duration-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shrink-0 space-y-3 roll-professionals ${trayCollapsed ? 'w-full lg:w-14 p-2.5 items-center' : 'w-full lg:w-72'}`}>
              <div className="flex items-center justify-between">
                {!trayCollapsed && (
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
                    <HeartPulse className="w-4 h-4 text-slate-400" /> Profissionais · arraste para um dia
                  </span>
                )}
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={toggleTray} 
                  title={trayCollapsed ? "Expandir Roll" : "Recolher Roll para aumentar grade"}
                  className="h-8 w-8 p-0 rounded-xl text-slate-500 hover:text-sky-600 cursor-pointer"
                >
                  {trayCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
                </Button>
              </div>

              {!trayCollapsed && (
                <>
                  <Select value={traySpecialtyFilter} onValueChange={setTraySpecialtyFilter}>
                    <SelectTrigger className="h-8 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"><SelectValue placeholder="Especialidade..." /></SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900 z-[99999]">
                      <SelectItem value="todas">Todas Especialidades</SelectItem>
                      {registeredSpecialties.map(spec => <SelectItem key={spec} value={spec}>{spec}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input placeholder="Buscar profissional..." value={traySearch} onChange={e => setTraySearch(e.target.value)} className="pl-8 h-8 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl" />
                  </div>

                  <div className="space-y-2 rounded-2xl border border-slate-200 dark:border-slate-800 p-2.5">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Horário ao soltar no dia</label>
                    <Select value={trayHorario || 'perguntar'} onValueChange={v => setTrayHorario(v === 'perguntar' ? '' : v)}>
                      <SelectTrigger className="h-8 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-900 z-[99999]">
                        <SelectItem value="perguntar">Perguntar a cada vez</SelectItem>
                        {trayHorarios.map(h => <SelectItem key={h.key} value={h.key}>{h.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant={selectDaysMode ? 'default' : 'outline'} onClick={() => { setSelectDaysMode(v => !v); if (selectDaysMode) setSelectedDays([]); }}
                      className={`h-8 w-full text-xs font-semibold rounded-xl cursor-pointer ${selectDaysMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : ''}`}>
                      <CalendarDays className="w-3.5 h-3.5 mr-1.5" /> {selectDaysMode ? `Marcando dias (${selectedDays.length}) · concluir` : 'Marcar vários dias'}
                    </Button>
                    <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                      {selectDaysMode
                        ? 'Clique nos dias do calendário e depois arraste o profissional para qualquer um deles: entra em todos, no horário escolhido.'
                        : 'Solte sobre o horário no painel do dia, ou no dia: com mais de um horário aberto, o sistema pergunta qual.'}
                    </p>
                  </div>

                  <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                    {filteredTrayProfs.map(prof => (
                      <div key={prof.id} draggable onDragStart={(e) => handleDragStart(e, prof.id)} className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-sky-500 transition-all cursor-grab active:cursor-grabbing select-none shadow-sm flex items-center gap-2.5">
                        <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center tabular-nums font-semibold text-[10px] text-sky-600 dark:text-sky-400 shrink-0">{getInitials(prof.name)}</div>
                        <div className="min-w-0 flex-1"><div className="font-semibold text-xs text-slate-900 dark:text-white truncate">{formatFullName(prof.name)}</div><div className="text-[10px] text-slate-500 truncate">{prof.specialty || 'Clínica Geral'}</div></div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </aside>
          )}

{monthlyView === 'grade' && (
            <div className="w-full min-w-0">
              <ScheduleGrid
                days={daysInMonth}
                sectors={gridSectors}
                shifts={scheduleVisibleShifts}
                todayStr={todayLocalStr}
                isManager={isManager}
                helpers={gridHelpers}
                getCandidates={getGridCandidates}
                onAssign={handleGridAssign}
                onUnassign={handleGridUnassign}
                onEdit={openShiftEditor}
                onCreate={openNewShift}
                onAddTurn={(sector) => openGenerator(sector.id)}
                emptyActions={isManager ? (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button onClick={() => openGenerator()} className="h-9 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm gap-1.5 cursor-pointer"><SlidersHorizontal className="w-4 h-4" /> Montar turnos do mês</Button>
                    <Button variant="outline" onClick={() => setDuplicateModalOpen(true)} className="h-9 rounded-xl text-sm gap-1.5 cursor-pointer"><Copy className="w-4 h-4" /> Copiar mês anterior</Button>
                  </div>
                ) : null}
              />
            </div>
          )}

{monthlyView === 'calendario' && (() => {
            const activeDay = calendarDay && daysInMonth.some(d => getLocalDateString(d) === calendarDay)
              ? calendarDay
              : (daysInMonth.some(d => getLocalDateString(d) === todayLocalStr) ? todayLocalStr : (daysInMonth[0] ? getLocalDateString(daysInMonth[0]) : null));
            return (
            <div className="flex-1 w-full min-w-0 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px] items-start">
              <div className="min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-emerald-500" /> Completo</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-amber-500" /> Com vaga</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-rose-500" /> Furo</span>
                  <span className="inline-flex items-center gap-1.5"><CheckCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Publicada</span>
                </div>
                {isManager && monthlyShifts.length === 0 && (
                  <EmptyState compact icon={CalendarDays} className="border-b border-slate-200 dark:border-slate-800"
                    title="Este mês ainda não tem plantões"
                    text="Monte os turnos do mês a partir dos turnos padrão dos setores ou copie a escala do mês anterior. Depois é só arrastar a equipe para os dias."
                    actions={[
                      { label: 'Montar turnos do mês', icon: SlidersHorizontal, onClick: () => openGenerator() },
                      { label: 'Copiar mês anterior', icon: Copy, onClick: () => setDuplicateModalOpen(true) }
                    ]} />
                )}
                <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 text-center py-2">
                  {WEEKDAYS.map(day => (<div key={day.short} className="text-xs font-medium text-slate-400">{day.short}</div>))}
                </div>

                <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800">
                  {Array.from({ length: (daysInMonth[0]?.getDay() || 0) }).map((_, idx) => (<div key={`empty-${idx}`} className="bg-slate-50 dark:bg-slate-950/60" />))}

                  {daysInMonth.map(dateObj => {
                    const dateStr = getLocalDateString(dateObj);
                    const isToday = todayLocalStr === dateStr;
                    const isPastDay = dateStr < todayLocalStr;
                    const isActive = activeDay === dateStr;
                    const isSelected = selectedDays.includes(dateStr);
                    const dayShifts = shiftsByDate[dateStr] || [];
                    const total = dayShifts.length;
                    const filled = dayShifts.filter(s => !isVacant(s)).length;
                    const vacant = total - filled;
                    const overdue = dayShifts.some(s => isVacant(s) && isShiftPast(s, liveNow));
                    const barColor = vacant === 0 ? 'bg-emerald-500' : overdue ? 'bg-rose-500' : 'bg-amber-500';
                    const people = [...new Map(dayShifts.filter(s => !isVacant(s)).map(s => {
                      const prof = professionalMap[String(s.professional_id)];
                      return [String(s.professional_id || s.professional_name), prof?.name || s.professional_name];
                    })).values()];

                    return (
                      <button
                        type="button"
                        key={dateStr}
                        onClick={(e) => {
                          if (selectDaysMode || e.ctrlKey || e.metaKey) { handleDayClick(dateStr, e); return; }
                          if (selectedDays.length) setSelectedDays([]);
                          setCalendarDay(dateStr);
                          setDayPanelOpen(true);
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDropOnDay(e, dateStr)}
                        aria-pressed={isActive}
                        aria-label={`${dateObj.getDate()}: ${total ? `${filled} de ${total} preenchidos` : 'sem plantões'}`}
                        className={`group relative flex min-h-[78px] sm:min-h-[104px] flex-col gap-1.5 p-1.5 sm:p-2 text-left transition-colors cursor-pointer ${
                          isActive ? 'bg-sky-50 dark:bg-sky-950/40 ring-2 ring-inset ring-sky-500' :
                          isSelected ? 'bg-indigo-50 dark:bg-indigo-950/40 ring-2 ring-inset ring-indigo-500' :
                          'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'} ${isPastDay && !isActive ? 'opacity-60' : ''}`}
                      >
                        <span className="flex items-center justify-between">
                          <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${isToday ? 'bg-sky-600 text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                            {dateObj.getDate()}
                          </span>
                          {total > 0 && isDatePublishedForCurrentSector(dateStr) && <CheckCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />}
                        </span>

                        {total > 0 ? (
                          <>
                            <span className="block h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <span className={`block h-full rounded-full ${barColor}`} style={{ width: `${Math.max(6, Math.round((filled / total) * 100))}%` }} />
                            </span>
                            <span className="flex items-baseline justify-between gap-1 text-[11px]">
                              <span className="font-semibold text-slate-700 dark:text-slate-200">{filled}/{total}</span>
                              {vacant > 0 && <span className={`hidden sm:inline font-medium ${overdue ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>{vacant} vaga{vacant > 1 ? 's' : ''}</span>}
                            </span>
                            {people.length > 0 && (
                              <span className="mt-auto hidden sm:flex items-center -space-x-1.5">
                                {people.slice(0, 4).map((name, i) => (
                                  <span key={i} title={name} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700 text-[9px] font-semibold text-slate-700 dark:text-slate-200">
                                    {getInitials(name)}
                                  </span>
                                ))}
                                {people.length > 4 && <span className="pl-2.5 text-[10px] text-slate-500">+{people.length - 4}</span>}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="mt-auto text-[11px] text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Painel do dia: ao lado em telas largas; gaveta (direita ou de baixo) nas demais. */}
              {dayPanelOpen && <button type="button" aria-label="Fechar detalhes do dia" onClick={() => setDayPanelOpen(false)} className="2xl:hidden fixed inset-0 z-40 bg-slate-950/30 cursor-default" />}
              <aside
                aria-label="Plantões do dia"
                className={`${dayPanelOpen ? 'flex' : 'hidden'} 2xl:flex flex-col fixed z-50 inset-x-0 bottom-0 max-h-[75vh] rounded-t-3xl sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-0 sm:max-h-none sm:w-[380px] sm:rounded-none sm:rounded-l-3xl
                  2xl:sticky 2xl:z-auto 2xl:inset-auto 2xl:top-4 2xl:w-auto 2xl:max-h-[calc(100vh-180px)] 2xl:rounded-3xl
                  bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl 2xl:shadow-sm overflow-hidden`}
              >
                {activeDay ? renderDayPanel(activeDay) : <p className="p-6 text-sm text-slate-500">Escolha um dia no calendário.</p>}
              </aside>
            </div>
            );
          })()}
          {monthlyView === 'lista' && (
            <div className="w-full space-y-3">
              {daysInMonth
                .filter(dateObj => (shiftsByDate[getLocalDateString(dateObj)] || []).length > 0)
                .map(dateObj => {
                  const dateStr = getLocalDateString(dateObj);
                  const dayShifts = (shiftsByDate[dateStr] || [])
                    .slice()
                    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
                  const vacancies = dayShifts.filter(isVacant).length;
                  const isPublished = isDatePublishedForCurrentSector(dateStr);
                  const isToday = dateStr === todayLocalStr;

                  return (
                    <section
                      key={dateStr}
                      onClick={e => handleDayClick(dateStr, e)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => handleDropOnDay(e, dateStr)}
                      className={`rounded-2xl border shadow-sm p-3 sm:p-4 transition-colors ${selectedDays.includes(dateStr) ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/30' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'} ${isToday ? 'ring-1 ring-sky-300 dark:ring-sky-800' : ''}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-semibold text-slate-900 dark:text-white">
                            {dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                          </span>
                          {isToday && <span className="text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/50 px-2 py-0.5 rounded-full">Hoje</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold  px-2 py-1 rounded-full ${vacancies ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'}`}>
                            {vacancies} vaga(s) aberta(s)
                          </span>
                          {isManager && (
                            <span className={`text-xs font-semibold  px-2 py-1 rounded-full ${isPublished ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'}`}>
                              {isPublished ? 'Publicada' : 'Rascunho'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-2">
                        {dayShifts.map(shift => renderShiftCard(shift, dateStr))}
                      </div>
                    </section>
                  );
                })}
              {scheduleVisibleShifts.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
                  <Search className="w-7 h-7 mx-auto mb-2 text-slate-400" />
                  <p className="font-semibold text-slate-700 dark:text-slate-200">{isManager || monthlyShifts.length ? 'Nenhum plantão corresponde aos filtros.' : 'A escala deste mês ainda não foi publicada.'}</p>
                  <p className="text-xs text-slate-500 mt-1">{isManager || monthlyShifts.length ? 'Tente outro profissional, especialidade, setor ou período.' : 'Seus plantões já marcados aparecem em Minha Escala. Vagas abertas ficam no Mural.'}</p>
                </div>
              )}
            </div>
          )}
        </div>
</div>
)}

      <DayShiftsTab PILL_TONES={PILL_TONES} activeTab={activeTab} handlePrintA4Landscape={handlePrintA4Landscape} liveNow={liveNow} professionalMap={professionalMap} sectorMap={sectorMap} shiftPill={shiftPill} tvData={tvData} />

      <ShiftEditorDialog categorizedProfessionalsForModal={categorizedProfessionalsForModal} editingShiftId={editingShiftId} formData={formData} handleDeleteShift={handleDeleteShift} handleSaveShift={handleSaveShift} isEditingPastShift={isEditingPastShift} modalOpen={modalOpen} professionalMap={professionalMap} registeredSpecialties={registeredSpecialties} sectors={labeledSectors} setFormData={setFormData} setModalOpen={setModalOpen} submitting={submitting} />

      <GeneratorDialog generatorConfig={generatorConfig} generatorFromTemplate={generatorFromTemplate} generatorModalOpen={generatorModalOpen} handleAddSlot={handleAddSlot} handleExecuteGenerator={handleExecuteGenerator} handleRemoveSlot={handleRemoveSlot} handleUpdateSlot={handleUpdateSlot} isManager={isManager} loadSectorIntoGenerator={loadSectorIntoGenerator} registeredSpecialties={registeredSpecialties} saveAsTemplate={saveAsTemplate} sectors={labeledSectors} setGeneratorConfig={setGeneratorConfig} setGeneratorModalOpen={setGeneratorModalOpen} setSaveAsTemplate={setSaveAsTemplate} submitting={submitting} />

      <LegacyUnitDialog handleAssignLegacyShiftUnit={handleAssignLegacyShiftUnit} legacyAssignmentOpen={legacyAssignmentOpen} legacyAssignmentSaving={legacyAssignmentSaving} legacyUnitDrafts={legacyUnitDrafts} professionalMap={professionalMap} sectorMap={sectorMap} setLegacyAssignmentOpen={setLegacyAssignmentOpen} setLegacyUnitDrafts={setLegacyUnitDrafts} unassignedShifts={unassignedShifts} units={units} />

      <BulkAllocationDialog autoFillBulkAllocation={autoFillBulkAllocation} backToGenerator={backToGenerator} bulkAllocationDraft={bulkAllocationDraft} bulkAllocationOpen={bulkAllocationOpen} discardGeneratedSchedule={discardGeneratedSchedule} generatedAllocationRows={generatedAllocationRows} generatorSkippedCount={generatorSkippedCount} generatorSourceInfo={generatorSourceInfo} getBulkCandidates={getBulkCandidates} getBulkBlockReason={getBulkBlockReason} bulkPool={bulkPool} workloadWarningFor={(profId, row, draft) => { const others = Object.entries(draft || {}).filter(([rowId, id]) => id && String(id) === String(profId) && String(rowId) !== String(row.id)).map(([rowId]) => generatedRowsById[String(rowId)]).filter(Boolean); return workloadWarningsFor(profId, row, others).map(w => w.message).join('; '); }} handleSaveGeneratedSchedule={handleSaveGeneratedSchedule} professionalMap={professionalMap} sectorMap={sectorMap} setBulkAllocationDraft={setBulkAllocationDraft} submitting={submitting} />

      <PublishDialog existingPublishedOverlaps={existingPublishedOverlaps} handleApplyQuickRange={handleApplyQuickRange} handleExecutePublishSector={handleExecutePublishSector} professionals={professionals} shifts={shifts} publishConfig={publishConfig} publishModalOpen={publishModalOpen} sectors={labeledSectors} setPublishConfig={setPublishConfig} setPublishModalOpen={setPublishModalOpen} submitting={submitting} />

      <Dialog open={Boolean(dayDropChoice)} onOpenChange={open => { if (!open) { setDayDropChoice(null); setDraggingProfId(null); } }}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Em qual horário?</DialogTitle>
          </DialogHeader>
          {dayDropChoice && (
            <div className="space-y-2">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <b>{formatFullName(professionalMap[String(dayDropChoice.profId)]?.name) || 'Profissional'}</b> em {dayDropChoice.targetDates.length > 1 ? `${dayDropChoice.targetDates.length} dias marcados` : formatDateBR(dayDropChoice.targetDates[0])}.
              </p>
              {dayDropChoice.options.map(option => (
                <Button key={option.key} type="button" variant="outline" onClick={() => chooseDayDropHorario(option)} className="h-11 w-full justify-between rounded-xl text-sm cursor-pointer">
                  <span className="font-semibold">{option.label}</span>
                  <span className="text-xs text-slate-500">{option.count} vaga{option.count > 1 ? 's' : ''} aberta{option.count > 1 ? 's' : ''}</span>
                </Button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CopyMonthDialog duplicateConfig={duplicateConfig} duplicateModalOpen={duplicateModalOpen} handleExecuteDuplicate={handleExecuteDuplicate} sectors={labeledSectors} setDuplicateConfig={setDuplicateConfig} setDuplicateModalOpen={setDuplicateModalOpen} submitting={submitting} />

    </div>
  );
}
