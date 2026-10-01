import React, { useState, useMemo, useEffect } from 'react';
import { useAppData } from '@/lib/useAppData';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  CalendarDays, Plus, Search, ChevronLeft, ChevronRight, 
  Clock, Building2, Trash2, X, CheckCheck, Send, 
  HeartPulse, SlidersHorizontal, Flame, ArrowRight, MonitorPlay, 
  GripVertical, Printer, Sun, Moon, AlertTriangle, CheckCircle2, 
  Radio, Calendar as CalendarIcon, PanelLeftClose, PanelLeftOpen, 
  Filter, ArrowLeftRight, Minimize2, Target, ShieldAlert,
  BellRing, Check, History, Copy
} from 'lucide-react';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS = [{ short: 'Dom', weekend: true }, { short: 'Seg', weekend: false }, { short: 'Ter', weekend: false }, { short: 'Qua', weekend: false }, { short: 'Qui', weekend: false }, { short: 'Sex', weekend: false }, { short: 'Sáb', weekend: true }];

function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
}

function timeToMinutes(timeStr, isEnd = false) {
  if (!timeStr) return isEnd ? 19 * 60 : 7 * 60;
  const [h, m] = String(timeStr).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function getShiftInterval(startStr, endStr) {
  const startMin = timeToMinutes(startStr);
  let endMin = timeToMinutes(endStr, true);
  if (endMin <= startMin) endMin += 24 * 60;
  return { startMin, endMin };
}

function isShiftPast(shift, liveNowDate) {
  if (!shift.date) return false;
  try {
    const dateStr = shift.date.split('T')[0];
    const endStr = shift.end_time || '23:59';
    const shiftEnd = new Date(`${dateStr}T${endStr}:00`);
    return shiftEnd < liveNowDate;
  } catch (e) {
    return false;
  }
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function getShiftName(shift) {
  return shift.professional_name || shift.professional?.name || shift.professionalName || '';
}

function isVacant(shift) {
  const name = normalize(getShiftName(shift));
  const hasProfId = Boolean(shift.professional_id);
  const hasName = Boolean(name);

  if (normalize(shift.status) === 'vago') return true;
  if (name.includes('vaga') || name.includes('descoberto') || name.includes('aberto') || name === 'plantao sem profissional') return true;
  if (!hasProfId && !hasName) return true;
  return false;
}

function computeShiftHospitalLifecycle(shift, liveNowDate) {
  if (!shift || !shift.date) {
    return { isLive: false, isConcluded: false, isProgrammed: true, isHandover: false, statusText: 'PROGRAMADO', detail: '' };
  }

  const [sYear, sMonth, sDay] = String(shift.date).split('-').map(Number);
  const [startH, startM] = String(shift.start_time || '07:00').split(':').map(Number);
  const [endH, endM] = String(shift.end_time || '19:00').split(':').map(Number);

  const startExact = new Date(sYear, sMonth - 1, sDay, startH || 0, startM || 0, 0);
  let endExact = new Date(sYear, sMonth - 1, sDay, endH || 0, endM || 0, 0);

  if (endExact.getTime() <= startExact.getTime()) {
    endExact.setDate(endExact.getDate() + 1);
  }

  const nowMs = liveNowDate.getTime();
  const startMs = startExact.getTime();
  const endMs = endExact.getTime();

  if (nowMs >= endMs) {
    return {
      isLive: false,
      isConcluded: true,
      isProgrammed: false,
      isHandover: false,
      statusText: 'CONCLUÍDO',
      detail: `Finalizado às ${shift.end_time}`
    };
  }

  if (nowMs >= startMs && nowMs < endMs) {
    const remainingMs = endMs - nowMs;
    const remainingMin = Math.max(1, Math.round(remainingMs / 60000));
    const isHandover = remainingMin <= 60;

    return {
      isLive: true,
      isConcluded: false,
      isProgrammed: false,
      isHandover,
      statusText: isHandover ? 'PASSAGEM DE PLANTÃO' : 'EM ANDAMENTO',
      remainingMinutes: remainingMin,
      detail: isHandover ? `Passagem: resta ${remainingMin}m` : `Resta ${Math.floor(remainingMin / 60)}h ${remainingMin % 60}m`
    };
  }

  const toStartMin = Math.round((startMs - nowMs) / 60000);
  const isIncomingHandover = toStartMin <= 60 && toStartMin > 0;

  return {
    isLive: false,
    isConcluded: false,
    isProgrammed: true,
    isHandover: isIncomingHandover,
    statusText: isIncomingHandover ? 'ASSUMINDO POSTO' : 'PROGRAMADO',
    startsInMinutes: toStartMin,
    detail: isIncomingHandover ? `Assume em ${toStartMin}m` : `Inicia às ${shift.start_time}`
  };
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatFullName(name) {
  if (!name) return 'Vago';
  const parts = name.trim().split(' ');
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function extractSpecialty(shift, prof) {
  if (shift.target_specialty) return shift.target_specialty;
  const match = String(shift.notes || '').match(/\[ESP:(.*?)\]/i);
  if (match && match[1]) return match[1].trim();
  return prof?.specialty || 'Geral';
}

function extractRetroactiveJustification(notes) {
  if (!notes) return '';
  const match = String(notes).match(/\[AJUSTE_RETROATIVO:(.*?)\]/i);
  return match && match[1] ? match[1].trim() : '';
}

function createScheduleNotification(notification) {
  try {
    const storageKeys = ['hospital_notifications', 'mural_notifications'];
    const current = {
      id: notification.id || `escala_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'escala_publicada',
      category: 'mural',
      title: notification.title || 'Novo plantão publicado',
      message: notification.message || 'Um novo plantão foi publicado na sua escala.',
      professional_id: notification.professional_id || null,
      shift_id: notification.shift_id || null,
      date: notification.date || null,
      start_time: notification.start_time || null,
      end_time: notification.end_time || null,
      sector_id: notification.sector_id || null,
      company_id: notification.company_id || null,
      unit_id: notification.unit_id || null,
      read: false,
      created_at: new Date().toISOString()
    };

    storageKeys.forEach(key => {
      const raw = window.localStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      const safeList = Array.isArray(list) ? list : [];
      safeList.unshift(current);
      window.localStorage.setItem(key, JSON.stringify(safeList.slice(0, 300)));
    });

    window.dispatchEvent(new CustomEvent('hospital-notification-created', { detail: current }));
    window.dispatchEvent(new CustomEvent('mural-notification-created', { detail: current }));

    return current;
  } catch (error) {
    return null;
  }
}

async function createRemoteScheduleNotification(notification, professional) {
  const recipientUserId = professional?.user_id || professional?.userId || professional?.auth_user_id;
  if (!recipientUserId) return false;

  try {
    const { error } = await supabase.from('notifications').insert([{
      user_id: recipientUserId,
      professional_id: notification.professional_id || professional.id || null,
      type: 'escala_publicada',
      category: 'mural',
      title: notification.title || 'Novo plantão publicado',
      message: notification.message || 'Um novo plantão foi publicado na sua escala.',
      read: false,
      data: {
        shift_id: notification.shift_id || null,
        date: notification.date || null,
        start_time: notification.start_time || null,
        end_time: notification.end_time || null,
        sector_id: notification.sector_id || null,
        company_id: notification.company_id || null,
        unit_id: notification.unit_id || null
      }
    }]);

    return !error;
  } catch (error) {
    // A tela continua funcionando mesmo se o projeto ainda não possuir
    // a tabela de notificações. O evento/localStorage continua disponível.
    return false;
  }
}

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

export default function Escalas() {
  const { shifts = [], sectors = [], professionals = [], selectedUnitId, units = [], company, isManager, syncGlobalData } = useAppData();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState('mensal'); 
  const [filterTurno, setFilterTurno] = useState('todos'); 
  const [startDateFilter, setStartDateFilter] = useState('');

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

  const [sidebarHidden, setSidebarHidden] = useState(() => {
    try { return window.localStorage.getItem('scale_main_sidebar_hidden') === 'true'; } catch { return false; }
  });

  const toggleMainSidebar = () => {
    const next = !sidebarHidden;
    setSidebarHidden(next);
    try {
      window.localStorage.setItem('scale_main_sidebar_hidden', String(next));
      const sidebarEl = document.querySelector('aside:not(.roll-professionals)') || document.querySelector('nav') || document.querySelector('[data-sidebar="true"]');
      if (sidebarEl) sidebarEl.style.display = next ? 'none' : '';
    } catch {}
  };

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const [publishedVersion, setPublishedVersion] = useState(0);

  const getSectorPublishedRanges = (secId) => {
    try {
      const raw = window.localStorage.getItem(`scale_published_ranges_${selectedUnitId}_${secId}_${currentYear}_${currentMonth + 1}`);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  };

  const isCurrentSectorPublished = useMemo(() => {
    if (selectedSectorId === 'todos') {
      return (sectors || []).length > 0 && (sectors || []).every(s => getSectorPublishedRanges(s.id).length > 0);
    }
    return getSectorPublishedRanges(selectedSectorId).length > 0;
  }, [selectedSectorId, sectors, currentYear, currentMonth, selectedUnitId, publishedVersion]);

  const unsubmittedSectors = useMemo(() => {
    return (sectors || []).filter(s => getSectorPublishedRanges(s.id).length === 0);
  }, [sectors, currentYear, currentMonth, selectedUnitId, publishedVersion]);

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
    const ranges = getSectorPublishedRanges(publishConfig.sector_id);

    return ranges.filter(r => {
      return Math.max(new Date(r.start_date).getTime(), new Date(publishConfig.start_date).getTime()) <= 
             Math.min(new Date(r.end_date).getTime(), new Date(publishConfig.end_date).getTime());
    });
  }, [publishConfig, publishedVersion]);

  const publishTargetShifts = useMemo(() => {
    if (!publishConfig.sector_id || !publishConfig.start_date || !publishConfig.end_date) return [];
    return (shifts || []).filter(s => {
      if (!s || s.status === 'cancelado') return false;
      if (String(s.sector_id) !== String(publishConfig.sector_id)) return false;
      return s.date >= publishConfig.start_date && s.date <= publishConfig.end_date;
    });
  }, [shifts, publishConfig]);

  const publishImpactedProfessionalsCount = useMemo(() => {
    const set = new Set();
    publishTargetShifts.forEach(s => { if (s.professional_id) set.add(String(s.professional_id)); });
    return set.size;
  }, [publishTargetShifts]);

  const handleExecutePublishSector = async () => {
    if (!publishConfig.sector_id) { alert('Selecione o setor a ser publicado.'); return; }
    if (publishConfig.start_date > publishConfig.end_date) { alert('Data de término inválida.'); return; }

    const secName = sectorMap[String(publishConfig.sector_id)]?.name || 'Setor Hospitalar';

    setSubmitting(true);
    try {
      const storageKey = `scale_published_ranges_${selectedUnitId}_${publishConfig.sector_id}_${currentYear}_${currentMonth + 1}`;
      const currentRanges = getSectorPublishedRanges(publishConfig.sector_id);
      
      const newRange = {
        start_date: publishConfig.start_date,
        end_date: publishConfig.end_date,
        published_at: new Date().toISOString()
      };

      const updatedRanges = [
        ...currentRanges.filter(r => !(r.start_date >= newRange.start_date && r.end_date <= newRange.end_date)),
        newRange
      ];

      window.localStorage.setItem(storageKey, JSON.stringify(updatedRanges));
      
      for (const shift of publishTargetShifts) {
        const currNotes = String(shift.notes || '');
        const wasAlreadyPublished = currNotes.includes('[ESCALA_PUBLICADA]');
        const publishedNotes = `${currNotes} [ESCALA_PUBLICADA] [NOTIFICACAO_ESCALA_PUBLICADA] [VIGENCIA:${publishConfig.start_date}_A_${publishConfig.end_date}]`.trim();

        await autoHealingSaveShift(shift.id, {
          notes: publishedNotes
        });

        // Cada profissional recebe uma notificação individual somente quando
        // a escala entra efetivamente em estado publicado.
        if (!wasAlreadyPublished && shift.professional_id) {
          const sector = sectorMap[String(shift.sector_id)];
          const notificationPayload = {
            professional_id: shift.professional_id,
            shift_id: shift.id,
            date: shift.date,
            start_time: shift.start_time,
            end_time: shift.end_time,
            sector_id: shift.sector_id,
            company_id: shift.company_id || company?.id || 'cmp_principal',
            unit_id: shift.unit_id || selectedUnitId || 'unit_h1',
            title: 'Plantão publicado',
            message: `Seu plantão de ${formatDateBR(shift.date)} das ${shift.start_time} às ${shift.end_time} foi publicado${sector?.name ? ` no setor ${sector.name}` : ''}.`
          };

          createScheduleNotification(notificationPayload);
          await createRemoteScheduleNotification(notificationPayload, professionalMap[String(shift.professional_id)]);
        }
      }

      setPublishedVersion(v => v + 1);
      setPublishModalOpen(false);
      await syncGlobalData();

      alert(`✓ Escala de "${secName}" oficializada!\n\nVigência: ${formatDateBR(publishConfig.start_date)} até ${formatDateBR(publishConfig.end_date)}\n${publishImpactedProfessionalsCount} profissional(is) notificado(s).`);
      } catch (err) { alert('Erro ao publicar escala: ' + err.message); } finally { setSubmitting(false); }
  };

  const handleUnpublishSector = () => {
    const secId = selectedSectorId !== 'todos' ? selectedSectorId : ((sectors || [])[0]?.id || '');
    const secName = sectorMap[String(secId)]?.name || 'Setor';

    if (!confirm(`Reverter escala de "${secName}" para Modo Rascunho?`)) return;

    window.localStorage.removeItem(`scale_published_ranges_${selectedUnitId}_${secId}_${currentYear}_${currentMonth + 1}`);
    setPublishedVersion(v => v + 1);
    alert(`A escala de "${secName}" voltou para Modo Rascunho.`);
  };

  // MODAL DE DUPLICAR ESCALA 
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateConfig, setDuplicateConfig] = useState({
    source_date: getLocalDateString(new Date(currentYear, currentMonth - 1, 1)).slice(0, 7), // Mês Anterior (YYYY-MM)
    target_date: getLocalDateString(new Date(currentYear, currentMonth, 1)).slice(0, 7),     // Mês Atual
    sector_id: 'todos'
  });

  const handleExecuteDuplicate = async (e) => {
    e.preventDefault();
    if (!confirm(`Isso fará uma cópia de todos os plantões de ${duplicateConfig.source_date} para ${duplicateConfig.target_date}. Confirma a operação?`)) return;

    setSubmitting(true);
    try {
      const [sY, sM] = duplicateConfig.source_date.split('-');
      const [tY, tM] = duplicateConfig.target_date.split('-');
      const prefixSource = `${sY}-${sM}-`;
      const prefixTarget = `${tY}-${tM}-`;

      const sourceShifts = shifts.filter(s => {
        if (!s.date.startsWith(prefixSource)) return false;
        if (s.status === 'cancelado') return false;
        if (duplicateConfig.sector_id !== 'todos' && String(s.sector_id) !== String(duplicateConfig.sector_id)) return false;
        return true;
      });

      if (sourceShifts.length === 0) throw new Error("Nenhum plantão encontrado no mês de origem para ser copiado.");

      let copiedCount = 0;
      for (const shift of sourceShifts) {
        const day = shift.date.split('-')[2];
        const newDate = `${prefixTarget}${day}`;
        
        // Validação: Ignora dia 31 se o mês de destino só tiver 30 dias (ex: Copiar de Agosto pra Setembro)
        const checkDate = new Date(parseInt(tY), parseInt(tM) - 1, parseInt(day));
        if (checkDate.getMonth() !== parseInt(tM) - 1) continue; 

        await autoHealingSaveShift(null, {
          company_id: shift.company_id,
          unit_id: shift.unit_id,
          sector_id: shift.sector_id,
          target_specialty: shift.target_specialty,
          professional_id: shift.professional_id,
          professional_name: shift.professional_name,
          date: newDate,
          shift_type: shift.shift_type,
          start_time: shift.start_time,
          end_time: shift.end_time,
          // Se estava realizado no passado, vira "confirmado" (ou "vago" se não tiver profissional)
          status: shift.status === 'realizado' ? 'confirmado' : shift.status, 
          notes: shift.notes ? String(shift.notes).replace(/\[ESCALA_PUBLICADA\]/gi, '').replace(/\[AJUSTE_RETROATIVO:[^\]]+\]/gi, '').trim() : ''
        });
        copiedCount++;
      }
      
      setDuplicateModalOpen(false);
      await syncGlobalData();
      alert(`✅ Sucesso! ${copiedCount} plantões foram duplicados com sucesso para ${duplicateConfig.target_date}.`);
    } catch (err) {
      alert("Erro ao duplicar: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const [selectedDays, setSelectedDays] = useState([]);
  const [traySearch, setTraySearch] = useState('');
  const [traySpecialtyFilter, setTraySpecialtyFilter] = useState('todas');
  const [scheduleProfessionalSearch, setScheduleProfessionalSearch] = useState('');
  const [scheduleSpecialtyFilter, setScheduleSpecialtyFilter] = useState('todas');
  const [draggingProfId, setDraggingProfId] = useState(null);

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
  const [allocationPromptOpen, setAllocationPromptOpen] = useState(false);
  const [bulkAllocationOpen, setBulkAllocationOpen] = useState(false);
  const [generatedAllocationRows, setGeneratedAllocationRows] = useState([]);
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

  const isEditingPastShift = useMemo(() => {
    return isShiftPast({ date: formData.date, end_time: formData.end_time }, liveNow);
  }, [formData.date, formData.end_time, liveNow]);

  const sectorMap = useMemo(() => { const m = {}; (sectors || []).forEach(s => { if(s) m[String(s.id)] = s; }); return m; }, [sectors]);
  const professionalMap = useMemo(() => { const m = {}; (professionals || []).forEach(p => { if(p) m[String(p.id)] = p; }); return m; }, [professionals]);

  const todayLocalStr = useMemo(() => getLocalDateString(liveNow), [liveNow]);

  const vacantShiftAlerts = useMemo(() => {
    const alerts = [];
    (shifts || []).forEach(s => {
      if (!s || s.status === 'cancelado') return;
      if (selectedSectorId !== 'todos' && String(s.sector_id) !== String(selectedSectorId)) return;
      
      const sMonth = String(s.date || '').slice(0, 7);
      const mStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      
      if (sMonth === mStr && isVacant(s) && !isShiftPast(s, liveNow)) {
        alerts.push(s);
      }
    });

    return alerts.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [shifts, selectedSectorId, currentYear, currentMonth, liveNow]);


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
      const sDate = (shift.date || '').split('T')[0];

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

  const handlePrintA4Landscape = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      alert('Permita pop-ups para abrir a impressão.');
      return;
    }

    const hospitalName = company?.name || 'HOSPITAL PRINCIPAL';
    const logoLetter = hospitalName[0] || 'H';
    const dataVigencia = liveNow.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const dataEmissao = liveNow.toLocaleDateString('pt-BR') + ' às ' + liveNow.toLocaleTimeString('pt-BR');

    // LOGOS CONFIGURÁVEIS (Empresa Matriz e Unidade Local)
    const companyLogoHtml = company?.logo_url ? `<img src="${company.logo_url}" style="max-height: 55px; max-width: 140px; object-fit: contain; margin-right: 15px;" />` : `<div class="logo-badge">${logoLetter}</div>`;
    const currentUnitObj = units?.find(u => String(u.id) === String(selectedUnitId));
    const unitLogoHtml = currentUnitObj?.logo_url ? `<img src="${currentUnitObj.logo_url}" style="max-height: 55px; max-width: 140px; object-fit: contain; margin-left: 15px; border-left: 2px solid #eee; padding-left: 15px;" />` : '';

    const activeShiftsOnly = tvData.tableDayShifts.filter(shift => !isVacant(shift));

    const tableRowsHtml = activeShiftsOnly.length === 0
      ? `<tr><td colspan="6" style="padding: 24px; text-align: center; color: #666; font-size: 11px;">Nenhum profissional escalado e ativo para esta data.</td></tr>`
      : activeShiftsOnly.map((shift, idx) => {
          const prof = professionalMap[String(shift.professional_id)];
          const sector = sectorMap[String(shift.sector_id)];
          const realSpecialty = extractSpecialty(shift, prof);
          const bg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
          const profNome = `Dr(a). ${formatFullName(prof?.name || shift.professional_name)}`;
          const conselho = prof?.document || '—';

          const [sYear, sMonth, sDay] = (shift.date || '').split('-');
          const formattedDate = sDay && sMonth ? `${sDay}/${sMonth}/${sYear}` : shift.date;

          const life = computeShiftHospitalLifecycle(shift, liveNow);

          const statusHtml = life.isLive
            ? `<span style="font-weight: bold; color: #0369a1; background-color: #e0f2fe; padding: 2px 6px; border-radius: 4px; font-size: 9px;">● EM ANDAMENTO</span>`
            : life.isConcluded
            ? `<span style="font-weight: bold; color: #166534; background-color: #dcfce7; padding: 2px 6px; border-radius: 4px; font-size: 9px;">✓ CONCLUÍDO</span>`
            : `<span style="color: #475569; background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 9px;">PROGRAMADO</span>`;

          return `
            <tr style="background-color: ${bg};">
              <td style="border: 1px solid #111; padding: 7px 10px; font-weight: bold; text-transform: uppercase;">${sector?.name || 'Setor'}</td>
              <td style="border: 1px solid #111; padding: 7px 10px; font-family: monospace; font-weight: bold; text-align: center; white-space: nowrap;">
                ${formattedDate}<br><span style="color: #334155; font-size: 10px;">${shift.start_time} às ${shift.end_time}</span>
              </td>
              <td style="border: 1px solid #111; padding: 7px 10px; font-weight: bold;">${profNome}</td>
              <td style="border: 1px solid #111; padding: 7px 10px;">${realSpecialty}</td>
              <td style="border: 1px solid #111; padding: 7px 10px; font-family: monospace; text-align: center;">${conselho}</td>
              <td style="border: 1px solid #111; padding: 7px 10px; text-align: center;">${statusHtml}</td>
            </tr>
          `;
        }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Escala Oficial - ${hospitalName}</title>
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; background: #fff !important; color: #000 !important; padding: 15px; font-size: 11px; }
          .header-box { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 15px; }
          .logo-badge { width: 55px; height: 55px; border: 2px solid #000; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 900; margin-right: 15px; }
          .header-info h1 { font-size: 19px; font-weight: 900; text-transform: uppercase; margin-bottom: 2px;}
          table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 30px; }
          th { background-color: #e5e7eb; border: 1px solid #000; padding: 8px 10px; text-align: left; font-size: 9.5px; font-weight: 900; text-transform: uppercase; }
          .signatures-area { display: flex; justify-content: space-around; margin-top: 35px; }
          .sig-box { text-align: center; width: 320px; }
          .sig-line { border-bottom: 1px solid #000; margin-bottom: 6px; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div style="display: flex; align-items: center;">
            ${companyLogoHtml}
            ${unitLogoHtml}
            <div class="header-info" style="${unitLogoHtml ? 'margin-left: 15px;' : ''}">
              <h1>${currentUnitObj ? currentUnitObj.name : hospitalName}</h1>
              <p>ESCALA OFICIAL DE PLANTÃO • MURAL HOSPITALAR</p>
              <div style="margin-top: 4px;">Vigência do Relatório: <b>${dataVigencia}</b></div>
            </div>
          </div>
          <div style="text-align: right; font-size: 9.5px;">
            <div style="border: 1px solid #000; padding: 3px 8px; font-weight: 900; display: inline-block;">DOCUMENTO OFICIAL AUDITÁVEL</div>
            <div style="margin-top: 4px;">Emissão: ${dataEmissao}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 20%;">Seção / Setor</th>
              <th style="width: 18%; text-align: center;">Data & Horário</th>
              <th style="width: 26%;">Profissional Escalado</th>
              <th style="width: 18%;">Especialidade / Atuação</th>
              <th style="width: 10%; text-align: center;">Conselho</th>
              <th style="width: 14%; text-align: center;">Situação / Status</th>
            </tr>
          </thead>
          <tbody>${tableRowsHtml}</tbody>
        </table>
        <div class="signatures-area">
          <div class="sig-box"><div class="sig-line"></div><div style="font-weight: 900; text-transform: uppercase;">Diretoria Clínica / RT Médica</div></div>
          <div class="sig-box"><div class="sig-line"></div><div style="font-weight: 900; text-transform: uppercase;">Gerência de Enfermagem / RT Assistencial</div></div>
        </div>
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
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

    const candInt = getShiftInterval(startTime, endTime);

    for (const s of shifts) {
      if (!s || s.status === 'cancelado' || s.status === 'vago') continue;
      if (excludeShiftId && String(s.id) === String(excludeShiftId)) continue;
      if (s.date !== targetDate) continue;
      if (String(s.professional_id) !== String(profId)) continue;

      const sInt = getShiftInterval(s.start_time, s.end_time);
      const overlaps = Math.max(sInt.startMin, candInt.startMin) < Math.min(sInt.endMin, candInt.endMin);

      if (overlaps) {
        const secName = sectorMap[String(s.sector_id)]?.name || 'outro setor';
        const profName = professionalMap[String(profId)]?.name || 'O profissional';
        return {
          hasConflict: true,
          conflictShift: s,
          message: `${profName} já está escalado(a) em "${secName}" das ${s.start_time} às ${s.end_time} nesta mesma data!`
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
      const conflict = checkProfessionalConflict(
        prof.id, 
        formData.date, 
        formData.start_time, 
        formData.end_time, 
        editingShiftId
      );

      if (conflict.hasConflict) {
        const conflictSec = sectorMap[String(conflict.conflictShift?.sector_id)]?.name || 'Outro Setor';
        unavailable.push({
          ...prof,
          conflictReason: `Alocado em ${conflictSec} (${conflict.conflictShift?.start_time} - ${conflict.conflictShift?.end_time})`
        });
      } else {
        available.push(prof);
      }
    });

    return { available, unavailable };
  }, [professionals, formData.date, formData.start_time, formData.end_time, editingShiftId, shifts, sectorMap]);

  const allScaleConflicts = useMemo(() => {
    const list = (shifts || []).filter(s => s && s.status !== 'cancelado' && s.status !== 'vago' && s.professional_id);
    const conflicts = [];

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];

        if (a.date !== b.date) continue;
        if (String(a.professional_id) !== String(b.professional_id)) continue;

        const aInt = getShiftInterval(a.start_time, a.end_time);
        const bInt = getShiftInterval(b.start_time, b.end_time);

        if (Math.max(aInt.startMin, bInt.startMin) < Math.min(aInt.endMin, bInt.endMin)) {
          conflicts.push({ a, b });
        }
      }
    }
    return conflicts;
  }, [shifts]);

  const [generatorConfig, setGeneratorConfig] = useState({
    sector_id: '', start_date: getLocalDateString(), duration_days: 30, interval_days: 1,
    slots: [
      { id: 'slot_1', specialty: 'Clínica Médica', start_time: '07:00', end_time: '19:00', quantity: 2, shift_type: 'diurno' },
      { id: 'slot_2', specialty: 'Clínica Médica', start_time: '19:00', end_time: '07:00', quantity: 2, shift_type: 'noturno' }
    ]
  });

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

  const handleExecuteGenerator = async (e) => {
    e.preventDefault();
    if (!generatorConfig.sector_id) { alert('Selecione o setor para a escala.'); return; }

    const totalDays = parseInt(generatorConfig.duration_days) || 30;
    const interval = parseInt(generatorConfig.interval_days) || 1;
    const validSlots = (generatorConfig.slots || []).filter(slot => (parseInt(slot.quantity) || 0) > 0);

    if (validSlots.length === 0) {
      alert('Configure pelo menos um turno com quantidade de vagas maior que zero.');
      return;
    }

    setSubmitting(true);
    try {
      const startDt = new Date(generatorConfig.start_date + 'T12:00:00');
      const generatedRows = [];

      // Gera exatamente a quantidade configurada para cada horário.
      // Ex.: 2 x 07:00-13:00 + 2 x 13:00-19:00 + 2 x 19:00-07:00.
      for (let dayOffset = 0; dayOffset < totalDays; dayOffset += interval) {
        const curDate = new Date(startDt);
        curDate.setDate(curDate.getDate() + dayOffset);
        const dateStr = getLocalDateString(curDate);

        for (const slot of validSlots) {
          const qty = parseInt(slot.quantity) || 0;
          for (let q = 0; q < qty; q++) {
            const spec = (slot.specialty || 'Clínica Médica').trim();
            const sType = slot.shift_type || (slot.start_time >= '18:00' || slot.start_time < '06:00' ? 'noturno' : 'diurno');

            const saved = await autoHealingSaveShift(null, {
              company_id: company?.id || 'cmp_principal',
              unit_id: selectedUnitId || 'unit_h1',
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

            if (saved?.id) {
              const row = {
                ...saved,
                target_specialty: spec,
                professional_id: null,
                professional_name: null,
                status: 'vago'
              };
              generatedRows.push(row);
              try { window.localStorage.setItem(`shift_spec_${saved.id}`, spec); } catch {}
            }
          }
        }
      }

      if (generatedRows.length === 0) {
        throw new Error('Nenhuma vaga foi gerada. Verifique a quantidade configurada.');
      }

      setGeneratedAllocationRows(generatedRows);
      setGeneratorModalOpen(false);
      await syncGlobalData();

      // Em vez de simplesmente encerrar a operação, abre o próximo passo.
      setAllocationPromptOpen(true);
    } catch (err) {
      alert('Erro ao gerar escala: ' + (err?.message || 'Tente novamente.'));
    } finally {
      setSubmitting(false);
    }
  };

  const getBulkDraftConflict = (shift, profId, draft) => {
    if (!shift || !profId) return false;

    const candidate = getShiftInterval(shift.start_time, shift.end_time);

    // Conflitos já existentes na base.
    const existingConflict = (shifts || []).some(existing => {
      if (!existing || existing.status === 'cancelado' || existing.status === 'vago') return false;
      if (String(existing.id) === String(shift.id)) return false;
      if (String(existing.professional_id) !== String(profId)) return false;
      if (existing.date !== shift.date) return false;

      const interval = getShiftInterval(existing.start_time, existing.end_time);
      return Math.max(interval.startMin, candidate.startMin) < Math.min(interval.endMin, candidate.endMin);
    });

    if (existingConflict) return true;

    // Conflitos entre as próprias vagas que estão sendo preenchidas neste lote.
    return Object.entries(draft || {}).some(([shiftId, assignedProfId]) => {
      if (!assignedProfId || String(shiftId) === String(shift.id)) return false;
      if (String(assignedProfId) !== String(profId)) return false;

      const other = generatedAllocationRows.find(row => String(row.id) === String(shiftId));
      if (!other || other.date !== shift.date) return false;

      const interval = getShiftInterval(other.start_time, other.end_time);
      return Math.max(interval.startMin, candidate.startMin) < Math.min(interval.endMin, candidate.endMin);
    });
  };

  const getBulkCandidates = (shift, draft = bulkAllocationDraft) => {
    if (!shift) return [];

    const requiredSpecialty = normalize(extractSpecialty(shift));
    return (professionals || [])
      .filter(prof => prof?.status === 'ativo')
      .filter(prof => {
        if (!requiredSpecialty) return true;
        return !prof.specialty || normalize(prof.specialty) === requiredSpecialty || requiredSpecialty === 'geral';
      })
      .filter(prof => !getBulkDraftConflict(shift, prof.id, draft))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  };

  const openBulkAllocation = () => {
    const draft = {};
    (generatedAllocationRows || []).forEach(row => { draft[String(row.id)] = ''; });
    setBulkAllocationDraft(draft);
    setAllocationPromptOpen(false);
    setBulkAllocationOpen(true);
  };

  const autoFillBulkAllocation = () => {
    const draft = { ...bulkAllocationDraft };

    // Preenche somente vagas ainda vazias, respeitando especialidade e conflitos.
    (generatedAllocationRows || [])
      .slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.start_time).localeCompare(String(b.start_time)))
      .forEach(row => {
        if (draft[String(row.id)]) return;
        const candidate = getBulkCandidates(row, draft)[0];
        if (candidate) draft[String(row.id)] = String(candidate.id);
      });

    setBulkAllocationDraft(draft);
  };

  const handleSaveBulkAllocation = async () => {
    const assignments = (generatedAllocationRows || []).filter(row => bulkAllocationDraft[String(row.id)]);
    if (assignments.length === 0) {
      alert('Selecione pelo menos um profissional para salvar a alocação.');
      return;
    }

    // Última validação antes de gravar: nenhum profissional pode ficar com dois
    // plantões sobrepostos no mesmo dia.
    const validationDraft = {};
    for (const row of assignments) {
      const profId = bulkAllocationDraft[String(row.id)];
      if (getBulkDraftConflict(row, profId, validationDraft)) {
        const prof = professionalMap[String(profId)];
        alert(`⛔ Conflito de escala: ${prof?.name || 'Profissional'} não pode ser alocado em ${formatDateBR(row.date)} das ${row.start_time} às ${row.end_time} porque existe outro plantão sobreposto.`);
        return;
      }
      validationDraft[String(row.id)] = String(profId);
    }

    setSubmitting(true);
    try {
      for (const row of assignments) {
        const profId = String(bulkAllocationDraft[String(row.id)]);
        const prof = professionalMap[profId];
        if (!prof) continue;

        const currentNotes = String(row.notes || '')
          .replace(/\[GERADO_ESCALA_MASSA\]/gi, '')
          .trim();

        await autoHealingSaveShift(row.id, {
          professional_id: prof.id,
          professional_name: prof.name,
          status: 'confirmado',
          notes: `${currentNotes} [ALOCADO_APOS_GERACAO]`.trim()
        });
      }

      setBulkAllocationOpen(false);
      setAllocationPromptOpen(false);
      setGeneratedAllocationRows([]);
      setBulkAllocationDraft({});
      await syncGlobalData();

      alert(`✓ ${assignments.length} vaga(s) foram alocadas e salvas na escala.`);
    } catch (err) {
      alert('Erro ao salvar alocações: ' + (err?.message || 'Tente novamente.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrevMonth = () => {
    const nextDate = new Date(currentYear, currentMonth - 1, 1);
    setCurrentDate(nextDate);

    const targetMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    const todayMonth = `${liveNow.getFullYear()}-${String(liveNow.getMonth() + 1).padStart(2, '0')}`;
    setStartDateFilter(targetMonth === todayMonth ? todayLocalStr : `${targetMonth}-01`);
  };

  const handleNextMonth = () => {
    const nextDate = new Date(currentYear, currentMonth + 1, 1);
    setCurrentDate(nextDate);

    const targetMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    const todayMonth = `${liveNow.getFullYear()}-${String(liveNow.getMonth() + 1).padStart(2, '0')}`;
    setStartDateFilter(targetMonth === todayMonth ? todayLocalStr : `${targetMonth}-01`);
  };

  const handleToday = () => {
    const today = new Date(liveNow);
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setStartDateFilter(getLocalDateString(today));
    setSelectedDays([]);
  };

  const handleStartDateChange = (e) => {
    const val = e.target.value;
    setStartDateFilter(val);
    if (val) {
      const [y, m, d] = val.split('-').map(Number);
      setCurrentDate(new Date(y, m - 1, d || 1));
    }
  };

  const daysInMonth = useMemo(() => {
    const date = new Date(currentYear, currentMonth, 1);
    const days = [];
    while (date.getMonth() === currentMonth) { 
      const curStr = getLocalDateString(date);
      if (!startDateFilter || curStr >= startDateFilter) {
        days.push(new Date(date)); 
      }
      date.setDate(date.getDate() + 1); 
    }
    return days;
  }, [currentYear, currentMonth, startDateFilter]);

  const getStatusBadge = (shift) => {
    const isVago = isVacant(shift);
    const life = computeShiftHospitalLifecycle(shift, liveNow);

    if (isVago) {
      if (isShiftPast(shift, liveNow)) {
        return { dot: 'bg-rose-700', label: 'FURO / FALTA', text: 'text-rose-700 dark:text-rose-500', wrapper: 'border-l-rose-700 bg-rose-100 dark:bg-rose-950/50 opacity-90', icon: <AlertTriangle className="w-3 h-3 text-rose-700" /> };
      }
      return { dot: 'bg-amber-500 animate-pulse', label: 'VAGA ABERTA', text: 'text-amber-600 dark:text-amber-400', wrapper: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/30', icon: <Flame className="w-3 h-3 text-amber-500 animate-pulse" /> };
    }
    
    if (life.isLive) {
      return { 
        dot: 'bg-emerald-500 animate-ping', 
        label: life.statusText, 
        text: 'text-emerald-600 dark:text-emerald-400', 
        wrapper: 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500/50', 
        icon: <Radio className="w-3 h-3 text-emerald-500 animate-ping" /> 
      };
    }

    if (life.isConcluded) {
      return { 
        dot: 'bg-slate-400', 
        label: 'CONCLUÍDO', 
        text: 'text-slate-500 dark:text-slate-400', 
        wrapper: 'border-l-slate-300 bg-slate-100 dark:bg-slate-800/40 opacity-70 grayscale hover:grayscale-0', 
        icon: <CheckCircle2 className="w-3 h-3 text-slate-400" /> 
      };
    }

    return { 
      dot: 'bg-sky-500', 
      label: life.statusText, 
      text: 'text-sky-600 dark:text-sky-400', 
      wrapper: 'border-l-sky-400 bg-sky-50 dark:bg-sky-900/10', 
      icon: <CalendarIcon className="w-3 h-3 text-sky-500" /> 
    };
  };

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
      if (startDateFilter && s.date < startDateFilter) return false;
      if (selectedSectorId !== 'todos' && String(s.sector_id) !== String(selectedSectorId)) return false;
      if (!isShiftMatchingTurno(s, filterTurno)) return false;
      return true;
    });
  }, [shifts, currentYear, currentMonth, selectedSectorId, filterTurno, startDateFilter]);

  const scheduleSpecialties = useMemo(() => {
    const specialties = new Set(
      monthlyShifts
        .map(shift => extractSpecialty(shift, professionalMap))
        .filter(Boolean)
    );
    return Array.from(specialties).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [monthlyShifts, professionalMap]);

  const scheduleFilteredShifts = useMemo(() => {
    if (scheduleSpecialtyFilter === 'todas') return monthlyShifts;
    const selectedSpecialty = normalize(scheduleSpecialtyFilter);
    return monthlyShifts.filter(shift =>
      normalize(extractSpecialty(shift, professionalMap)) === selectedSpecialty
    );
  }, [monthlyShifts, scheduleSpecialtyFilter, professionalMap]);

  const scheduleVisibleShifts = useMemo(() => {
    const searchTerm = normalize(scheduleProfessionalSearch);
    if (!searchTerm) return scheduleFilteredShifts;
    return scheduleFilteredShifts.filter(shift => {
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

  // Mapa visual da capacidade configurada para cada dia/horário.
  // A chave representa um slot físico da grade: setor + horário + especialidade.
  const vacancyGroupsByDate = useMemo(() => {
    const map = {};

    scheduleFilteredShifts.forEach(shift => {
      if (!shift?.date) return;

      const dateKey = shift.date;
      if (!map[dateKey]) map[dateKey] = {};

      const specialty = extractSpecialty(shift, professionalMap);
      const key = [
        String(shift.sector_id || ''),
        String(shift.start_time || '07:00'),
        String(shift.end_time || '19:00'),
        normalize(specialty)
      ].join('|');

      if (!map[dateKey][key]) {
        map[dateKey][key] = {
          key,
          sector_id: shift.sector_id,
          start_time: shift.start_time || '07:00',
          end_time: shift.end_time || '19:00',
          specialty,
          total: 0,
          vacant: 0,
          filled: 0,
          shifts: []
        };
      }

      const group = map[dateKey][key];
      group.total += 1;
      if (isVacant(shift)) group.vacant += 1;
      else group.filled += 1;
      group.shifts.push(shift);
    });

    const result = {};
    Object.entries(map).forEach(([date, groups]) => {
      result[date] = Object.values(groups).sort((a, b) => {
        return String(a.start_time).localeCompare(String(b.start_time));
      });
    });

    return result;
  }, [scheduleFilteredShifts, professionalMap]);

  const allActiveProfessionals = useMemo(() => (professionals || []).filter(p => p?.status === 'ativo'), [professionals]);

  const filteredTrayProfs = useMemo(() => {
    const term = traySearch.toLowerCase().trim();
    return (professionals || []).filter(p => {
      if (p?.status !== 'ativo') return false;
      if (traySpecialtyFilter !== 'todas' && (p.specialty || '').toLowerCase() !== traySpecialtyFilter.toLowerCase()) return false;
      if (!term) return true;
      return (p.name || '').toLowerCase().includes(term) || (p.specialty || '').toLowerCase().includes(term);
    });
  }, [professionals, traySearch, traySpecialtyFilter]);

  const handleDayClick = (dateStr, e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setSelectedDays(prev => prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]);
    } else {
      if (selectedDays.length > 0) setSelectedDays([]);
    }
  };

  const handleDragStart = (e, profId) => { setDraggingProfId(profId); e.dataTransfer.setData('text/plain', profId); };

  const handleDropOnSlot = async (e, dateStr, startTime, endTime, specialty, sectorId) => {
    e.preventDefault();
    e.stopPropagation();

    const profId = e.dataTransfer.getData('text/plain') || draggingProfId;
    if (!profId) return;

    const prof = professionalMap[String(profId)];
    if (!prof) return;

    const targetDates = selectedDays.includes(dateStr) && selectedDays.length > 1 ? selectedDays : [dateStr];
    const normalizedSpec = normalize(specialty || prof.specialty || 'Clínica Médica');

    // Localiza uma vaga física já criada pelo gerador. Não cria um novo plantão
    // por fora da grade; preenche exatamente o slot configurado.
    const targets = [];
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
        alert(`Não existe vaga aberta para ${formatDateBR(d)} • ${startTime} às ${endTime} • ${specialty || 'Geral'} neste setor.`);
        setDraggingProfId(null);
        return;
      }

      const conflict = checkProfessionalConflict(profId, d, startTime, endTime, candidate.id);
      if (conflict.hasConflict) {
        alert(`⛔ BLOQUEIO DE ESCALA:\n\n${conflict.message}\n\nO profissional não pode assumir dois plantões no mesmo horário.`);
        setDraggingProfId(null);
        return;
      }

      targets.push(candidate);
    }

    const targetSummary = targets.map(target => {
      const targetSpecialty = extractSpecialty(target);
      const targetSector = sectorMap[String(target.sector_id)]?.name || 'Setor';
      return `• ${formatDateBR(target.date)} | ${target.start_time}-${target.end_time} | ${targetSpecialty} | ${targetSector}`;
    }).join('\n');

    const vacancyCountText = targets.length === 1 ? '1 vaga' : `${targets.length} vagas`;
    if (!confirm(`Confirme a alocação de ${prof.name}:\n\n${targetSummary}\n\nIsso preencherá ${vacancyCountText}. Deseja continuar?`)) {
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

      setSelectedDays([]);
      await syncGlobalData();
    } catch (err) {
      alert('Erro ao alocar: ' + err.message);
    } finally {
      setDraggingProfId(null);
    }
  };

  // Compatibilidade com o drop no corpo do dia: se o usuário soltar fora de um
  // horário específico, usamos a primeira vaga aberta daquele dia.
  const handleDropOnDay = async (e, dateStr) => {
    e.preventDefault();
    e.stopPropagation();

    const dayVacancies = (shifts || [])
      .filter(s => s?.date === dateStr && s.status !== 'cancelado' && isVacant(s))
      .filter(s => selectedSectorId === 'todos' || String(s.sector_id) === String(selectedSectorId))
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));

    const first = dayVacancies[0];
    if (!first) {
      alert('Este dia não possui vaga aberta. Solte o profissional diretamente sobre o horário desejado.');
      return;
    }

    await handleDropOnSlot(
      e,
      dateStr,
      first.start_time,
      first.end_time,
      extractSpecialty(first),
      first.sector_id
    );
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!formData.sector_id || !formData.date) return;

    const isPast = isShiftPast({ date: formData.date, end_time: formData.end_time }, liveNow);
    const isMural = formData.action_type === 'mural';

    if (isPast && !isMural && (!formData.retroactive_justification || !formData.retroactive_justification.trim())) {
      alert("Atenção: O plantão já foi encerrado. Você deve preencher a justificativa para o ajuste retroativo.");
      return;
    }

    if (!isMural && formData.professional_id) {
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
      let newNotes = `[ESP:${finalSpecialty}] ${baseNotes}`;
      
      if (isPast && formData.action_type === 'alocar' && formData.retroactive_justification) {
        newNotes += ` [AJUSTE_RETROATIVO:${formData.retroactive_justification.replace(/\[|\]/g, '')}]`;
      }

      const payload = {
        company_id: company?.id || 'cmp_principal',
        unit_id: selectedUnitId || 'unit_h1',
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

      const saved = await autoHealingSaveShift(editingShiftId, payload);
      if (saved?.id || editingShiftId) try { window.localStorage.setItem(`shift_spec_${saved?.id || editingShiftId}`, finalSpecialty); } catch {}

      setModalOpen(false); await syncGlobalData();
    } finally { setSubmitting(false); }
  };

  const handleSendToMuralFromModal = async () => {
    if (!editingShiftId) return;
    if (!confirm('Disponibilizar no Mural?')) return;
    try {
      await autoHealingSaveShift(editingShiftId, { professional_id: null, professional_name: null, status: 'vago' });
      setModalOpen(false); await syncGlobalData();
    } catch (err) { alert(err.message); }
  };

  const handleDeleteShift = async (shiftId) => {
    if (!confirm('Excluir plantão?')) return;
    try { 
      await supabase.from('shifts').delete().eq('id', shiftId); 
      setModalOpen(false); 
      await syncGlobalData(); 
    } catch (err) { alert(err.message); }
  };

  // =========================================================================
  // 1. MODO TV CCO EM TELA CHEIA ISOLADA
  // =========================================================================
  if (activeTab === 'tv') {
    return (
      <div className="fixed inset-0 z-[99999] bg-slate-950 text-white flex flex-col justify-between p-6 lg:p-8 select-none overflow-hidden font-sans">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-2xl">
              <Radio className="w-7 h-7 animate-pulse text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-sky-400">
                <span>{company?.name || 'Hospital Santa Clara'}</span>
                <span>•</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" /> CCO AO VIVO</span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white mt-0.5">
                Centro de Comando & Situação
              </h1>
              <p className="text-xs text-slate-400 font-bold">
                {liveNow.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} · Escalas em Tempo Real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="bg-slate-900 border border-slate-800 px-6 py-2.5 rounded-2xl text-right">
              <div className="text-3xl lg:text-4xl font-black font-mono tracking-tight text-cyan-400">
                {liveNow.toLocaleTimeString('pt-BR')}
              </div>
              <div className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500">Horário Oficial CCO</div>
            </div>

            <button 
              onClick={() => setActiveTab('mensal')} 
              className="p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
              title="Sair do Modo TV"
            >
              <Minimize2 className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 my-6 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
          {/* ATIVOS NO MOMENTO */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl flex flex-col justify-between overflow-hidden">
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0">
                <span className="text-sm font-black uppercase text-emerald-400 tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /> Profissionais no Posto Agora ({tvData.emAndamento.length})
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">AO VIVO</span>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {tvData.emAndamento.length === 0 ? (
                  <div className="py-24 text-center text-xs text-slate-500">Nenhum profissional em atendimento neste exato momento.</div>
                ) : (
                  tvData.emAndamento.map((shift, idx) => {
                    const prof = professionalMap[String(shift.professional_id)];
                    const sector = sectorMap[String(shift.sector_id)];
                    const realSpecialty = extractSpecialty(shift, prof);
                    const validName = prof?.name || shift.professional_name;

                    return (
                      <div key={shift.id || `em-${idx}`} className="p-4 bg-slate-950 border border-emerald-500/40 rounded-2xl shadow-lg flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-emerald-400 uppercase">{sector?.name}</span>
                            {shift.lifecycle.isHandover && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                                Passagem de Turno
                              </span>
                            )}
                          </div>
                          <div className="text-base font-black text-white mt-0.5">{formatFullName(validName)}</div>
                          <span className="text-xs text-slate-400">{realSpecialty} • {shift.start_time} às {shift.end_time}</span>
                        </div>
                        <span className="text-xs font-mono font-black text-emerald-300 bg-emerald-500/20 px-3 py-1.5 rounded-xl">
                          {shift.detail}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* PLANTÕES PROGRAMADOS */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl flex flex-col justify-between overflow-hidden">
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0">
                <span className="text-sm font-black uppercase text-sky-400 tracking-wider flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" /> Plantões Programados (Hoje)
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">{tvData.programadosHoje.length} programado(s)</span>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {tvData.programadosHoje.length === 0 ? (
                  <div className="py-24 text-center text-xs text-slate-500">Nenhum plantão futuro programado para a data de hoje.</div>
                ) : (
                  tvData.programadosHoje.map(({ shift, lifecycle }, idx) => {
                    const prof = professionalMap[String(shift.professional_id)];
                    const sector = sectorMap[String(shift.sector_id)];
                    const validName = prof?.name || shift.professional_name;

                    return (
                      <div key={shift.id || `prog-${idx}`} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                        <div>
                          <span className="text-xs font-black text-slate-400 uppercase">{sector?.name}</span>
                          <div className="text-base font-black text-white">{formatFullName(validName)}</div>
                          <span className="text-xs text-sky-400 font-mono">{shift.start_time} às {shift.end_time}</span>
                        </div>
                        <span className="text-xs font-black uppercase bg-sky-500/20 text-sky-300 px-3 py-1.5 rounded-xl font-mono">
                          {lifecycle.detail}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-3 shrink-0 flex items-center justify-between text-xs text-slate-400 font-bold">
          <div>ScaleMedic Enterprise CCO • Hospital Santa Clara</div>
          <Button onClick={() => setActiveTab('mensal')} variant="outline" className="h-8 text-xs border-slate-700 text-slate-300 cursor-pointer">
            Fechar Modo TV
          </Button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. TELA NORMAL DE ESCALAS & PLANTÕES
  // =========================================================================
  return (
    <div className="relative p-3 md:p-6 space-y-4 font-sans bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      {/* BOTÃO LATERAL FIXADO */}
      <button
        onClick={toggleMainSidebar}
        title={sidebarHidden ? "Expandir Menu Lateral Principal" : "Recolher Menu Lateral"}
        style={{ top: '480px' }}
        className="fixed left-0 z-[50] bg-slate-900 border border-slate-700 text-sky-400 hover:text-white hover:bg-sky-600 shadow-2xl px-1.5 py-3 rounded-r-xl transition-all duration-200 flex items-center justify-center cursor-pointer"
      >
        {sidebarHidden ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* BANNER 0: ALERTA CRÍTICO DE VAGAS EM ABERTO/FUROS */}
      {vacantShiftAlerts.length > 0 && isManager && (
        <div className="p-4 rounded-3xl bg-rose-500/15 border-2 border-rose-500/60 shadow-lg animate-in fade-in flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-600 text-white shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <strong className="text-sm font-black text-rose-500 uppercase tracking-wider block">
                Alerta Crítico: Plantões Descobertos ({vacantShiftAlerts.length})
              </strong>
              <p className="text-xs text-rose-600 dark:text-rose-300">
                Os turnos abaixo estão sem profissional alocado e precisam de atenção imediata da coordenação.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
            {vacantShiftAlerts.slice(0, 8).map(v => {
              const isPast = isShiftPast(v, liveNow);
              return (
                <div 
                  key={v.id} 
                  onClick={() => { setEditingShiftId(v.id); setFormData({ date: v.date, sector_id: v.sector_id, target_specialty: v.target_specialty, start_time: v.start_time, end_time: v.end_time, shift_type: v.shift_type || 'diurno', action_type: 'alocar', professional_id: '', notes: v.notes || '', retroactive_justification: extractRetroactiveJustification(v.notes) }); setModalOpen(true); }}
                  className={`p-2 rounded-xl text-xs font-bold border cursor-pointer transition-all flex flex-col gap-1 shadow-sm hover:scale-[1.02] ${
                    isPast ? 'bg-rose-100 border-rose-400 text-rose-800 dark:bg-rose-950/80 dark:border-rose-500 dark:text-rose-300' : 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-950/60 dark:border-amber-500/60 dark:text-amber-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="truncate">{sectorMap[v.sector_id]?.name || 'Setor'}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${isPast ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'}`}>
                      {isPast ? 'Falta / Furo' : 'Vaga Futura'}
                    </span>
                  </div>
                  <div className="font-mono opacity-80">{formatDateBR(v.date)} • {v.start_time} às {v.end_time}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BANNER 1: ALERTA DE CONFLITO EXISTENTE NA BASE */}
      {allScaleConflicts.length > 0 && isManager && (
        <div className="p-4 rounded-3xl bg-rose-500/15 border-2 border-rose-500/60 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-600 text-white shrink-0">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <strong className="text-sm font-black text-rose-500 uppercase tracking-wider block">
                Alerta de Choque de Horário ({allScaleConflicts.length} ocorrências detectadas)
              </strong>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Existem profissionais escalados em mais de um setor no mesmo dia e horário. Regularize pelo Mural ou edite o plantão.
              </p>
            </div>
          </div>
          <Button 
            onClick={() => {
              const firstConflict = allScaleConflicts[0];
              if (firstConflict?.b?.id) {
                if (confirm(`Liberar vaga conflitante de ${professionalMap[firstConflict.b.professional_id]?.name || 'profissional'} em ${sectorMap[firstConflict.b.sector_id]?.name || 'setor'} no dia ${firstConflict.b.date}?`)) {
                  autoHealingSaveShift(firstConflict.b.id, { professional_id: null, professional_name: null, status: 'vago' }).then(() => syncGlobalData());
                }
              }
            }}
            className="h-9 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs px-4 rounded-xl shadow-md shrink-0 cursor-pointer"
          >
            Resolver Conflito Imediato
          </Button>
        </div>
      )}

      {/* BANNER 2: RADAR DE SETORES PENDENTES DE PUBLICAÇÃO */}
      {unsubmittedSectors.length > 0 && isManager && (
        <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500 text-white shrink-0 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <strong className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 block">
                {unsubmittedSectors.length} Setor(es) Pendente(s) de Publicação em {MONTH_NAMES[currentMonth]}
              </strong>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className="text-[11px] text-slate-600 dark:text-slate-300">Setores em rascunho:</span>
                {unsubmittedSectors.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectSector(String(s.id))}
                    className="text-[10px] font-black uppercase px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-200 hover:bg-amber-500/30 transition-all cursor-pointer border border-amber-500/30"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button 
            onClick={openPublishModal}
            className="h-9 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs px-4 rounded-xl shadow-md shrink-0 cursor-pointer gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> Publicar Setor
          </Button>
        </div>
      )}

      {/* SELETOR DE SEÇÕES COM PERSISTÊNCIA & CONFIGURADOR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-400 shrink-0">
            <Building2 className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Setor:
          </div>
          <div className="w-full max-w-xs">
            <Select value={selectedSectorId} onValueChange={handleSelectSector}>
              <SelectTrigger className="h-9 text-xs font-black bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 z-[99999]">
                <SelectItem value="todos" className="font-bold text-sky-600">🏥 Todos os Setores</SelectItem>
                {(sectors || []).map(s => <SelectItem key={s.id} value={String(s.id)} className="text-xs">{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isManager && (
            <>
              <Button onClick={() => setDuplicateModalOpen(true)} variant="outline" className="h-9 text-indigo-600 hover:bg-indigo-50 border-indigo-200 font-black text-xs px-4 rounded-2xl shadow-sm gap-1.5 cursor-pointer">
                <Copy className="w-4 h-4" /> Duplicar Mês
              </Button>
              <Button onClick={() => { setGeneratorConfig(prev => ({ ...prev, sector_id: selectedSectorId !== 'todos' ? selectedSectorId : ((sectors || [])[0]?.id || '') })); setGeneratorModalOpen(true); }} className="h-9 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-4 rounded-2xl shadow-md gap-1.5 shrink-0 cursor-pointer">
                <SlidersHorizontal className="w-4 h-4" /> Configurar & Gerar Escala
              </Button>
            </>
          )}

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0">
            <button onClick={() => setFilterTurno('todos')} className={`px-3 py-1 rounded-xl text-xs font-black cursor-pointer ${filterTurno === 'todos' ? 'bg-white dark:bg-slate-800 shadow-sm' : 'text-slate-500'}`}>Todos</button>
            <button onClick={() => setFilterTurno('diurno')} className={`px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer ${filterTurno === 'diurno' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300' : 'text-slate-500'}`}><Sun className="w-3 h-3 text-amber-500" /> Diurno</button>
            <button onClick={() => setFilterTurno('noturno')} className={`px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer ${filterTurno === 'noturno' ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300' : 'text-slate-500'}`}><Moon className="w-3 h-3 text-indigo-500" /> Noturno</button>
          </div>
        </div>
      </div>

      {/* ALERTA VISUAL ANTI-ERRO SE UM SETOR ESTIVER FILTRADO */}
      {selectedSectorObj && (
        <div className="p-3 px-4 rounded-2xl bg-gradient-to-r from-sky-950/70 via-indigo-950/70 to-slate-900 border border-sky-500/50 shadow-md flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5 text-xs font-black text-sky-300">
            <Target className="w-4 h-4 text-sky-400 animate-pulse shrink-0" />
            <span>
              VISÃO FILTRADA POR SETOR: <strong className="text-white uppercase tracking-wider text-sm ml-1 underline decoration-sky-400 underline-offset-4">{selectedSectorObj.name}</strong>
            </span>
          </div>
          <button 
            onClick={() => handleSelectSector('todos')}
            className="text-[11px] font-bold text-sky-300 hover:text-white bg-sky-500/20 hover:bg-sky-500/40 px-3 py-1 rounded-xl border border-sky-500/40 transition-all flex items-center gap-1 cursor-pointer"
          >
            <span>Ver Todos os Setores</span>
            <X className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>
      )}

      {/* BARRA DE COMANDO COM O STATUS DO SETOR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 rounded-2xl p-1 border border-slate-200 dark:border-slate-800 shadow-sm">
            <button
              onClick={handlePrevMonth}
              title="Mês anterior"
              className="h-8 w-8 flex items-center justify-center hover:bg-white dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              title="Voltar para o mês e o dia atuais"
              className="h-8 px-3 rounded-xl bg-white dark:bg-slate-800 shadow-sm text-[10px] font-black uppercase tracking-wide text-sky-600 dark:text-sky-300 cursor-pointer hover:shadow-md transition-all"
            >
              Hoje
            </button>
            <button
              onClick={handleNextMonth}
              title="Próximo mês"
              className="h-8 w-8 flex items-center justify-center hover:bg-white dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 px-3.5 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
            <Filter className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span className="text-[11px] text-slate-500 whitespace-nowrap">A partir de:</span>
            <input
              type="date"
              value={startDateFilter}
              onChange={handleStartDateChange}
              className="bg-transparent text-xs font-black text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              title="Altere para amanhã ou qualquer outra data para iniciar a visualização"
            />
            <button
              onClick={handleToday}
              title="Usar novamente a data de hoje"
              className="px-2 py-1 rounded-lg text-[9px] font-black uppercase text-sky-600 dark:text-sky-300 hover:bg-sky-500/10 cursor-pointer"
            >
              Hoje
            </button>
          </div>

          <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-sky-600" /> {MONTH_NAMES[currentMonth]} {currentYear}
              {selectedSectorObj && (
                <span className="text-xs px-2.5 py-0.5 rounded-lg bg-sky-500/20 text-sky-400 font-mono font-bold border border-sky-500/30">
                  {selectedSectorObj.name}
                </span>
              )}
            </h2>
            <span className={`text-xs font-bold ${isCurrentSectorPublished ? 'text-emerald-600' : 'text-amber-500'}`}>
              {isCurrentSectorPublished ? '✓ Escala Publicada (Oficializada)' : '⚠️ Modo Rascunho (Não Publicada)'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* BOTÃO DE PUBLICAR POR SETOR */}
          {isManager && (
            <div className="flex items-center gap-1.5">
              <Button 
                onClick={openPublishModal}
                className="h-9 px-4 text-xs font-black rounded-2xl gap-1.5 shadow-md bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Publicar Escala
              </Button>

              {isCurrentSectorPublished && (
                <Button 
                  onClick={handleUnpublishSector}
                  variant="outline"
                  title="Voltar escala para rascunho"
                  className="h-9 px-3 text-xs font-bold rounded-2xl border-slate-300 dark:border-slate-700 text-slate-500 hover:text-rose-600 cursor-pointer"
                >
                  Rascunho
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
            <button onClick={() => setActiveTab('mensal')} className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer ${activeTab === 'mensal' ? 'bg-white dark:bg-sky-600 shadow-sm text-sky-600 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Grade Mensal</button>
            <button onClick={() => setActiveTab('dia')} className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ${activeTab === 'dia' ? 'bg-white dark:bg-sky-600 shadow-sm text-sky-600 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}><Clock className="w-3.5 h-3.5" /> Plantão do Dia</button>
          </div>

          <Button variant="outline" onClick={() => setActiveTab('tv')} className="h-9 px-4 text-xs font-black rounded-2xl gap-2 bg-slate-50 dark:bg-slate-950 text-amber-600 border-slate-200 hover:bg-slate-100 cursor-pointer">
            <MonitorPlay className="w-4 h-4" /> <span>Modo TV CCO</span>
          </Button>

          {isManager && (
            <Button onClick={() => { setEditingShiftId(null); setFormData({ date: getLocalDateString(), sector_id: selectedSectorId !== 'todos' ? selectedSectorId : ((sectors || [])[0]?.id || ''), target_specialty: registeredSpecialties[0] || 'Clínica Médica', start_time: '07:00', end_time: '19:00', shift_type: 'diurno', action_type: 'alocar', professional_id: '', notes: '', retroactive_justification: '' }); setModalOpen(true); }} className="h-9 bg-sky-600 hover:bg-sky-500 text-white text-xs font-black px-5 rounded-2xl gap-1.5 cursor-pointer">
              <Plus className="w-4 h-4" /> Lançar Plantão
            </Button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. ABA 1: GRADE MENSAL COM BADGE VISUAL DE PUBLICADO                      */}
      {/* ========================================================================= */}
      {activeTab === 'mensal' && (
        <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm print:hidden">
          <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Filtrar plantões da grade
              </div>
              <div className="text-[10px] text-slate-400">
                O setor é controlado pelo filtro geral acima. As vagas abertas continuam visíveis ao buscar um profissional.
              </div>
            </div>
            <div className="relative w-full lg:w-64 shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar profissional na escala..."
                value={scheduleProfessionalSearch}
                onChange={e => setScheduleProfessionalSearch(e.target.value)}
                className="pl-8 h-9 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl"
                aria-label="Buscar profissional na escala"
              />
            </div>
            <Select value={scheduleSpecialtyFilter} onValueChange={setScheduleSpecialtyFilter}>
              <SelectTrigger className="w-full lg:w-56 h-9 text-xs font-bold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl">
                <SelectValue placeholder="Todas as especialidades" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 z-[99999]">
                <SelectItem value="todas">Todas as especialidades</SelectItem>
                {scheduleSpecialties.map(specialty => (
                  <SelectItem key={specialty} value={specialty}>{specialty}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(scheduleProfessionalSearch || scheduleSpecialtyFilter !== 'todas') && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setScheduleProfessionalSearch('');
                  setScheduleSpecialtyFilter('todas');
                }}
                className="h-9 px-3 text-xs font-bold rounded-xl shrink-0"
              >
                <X className="w-3.5 h-3.5 mr-1" /> Limpar
              </Button>
            )}
          </div>
          {(scheduleProfessionalSearch || scheduleSpecialtyFilter !== 'todas') && (
            <div className="mt-2 text-[10px] font-semibold text-sky-700 dark:text-sky-300" role="status" aria-live="polite">
              {scheduleVisibleShifts.length} plantão(ões) encontrado(s) na grade
              {scheduleProfessionalSearch && ' • vagas abertas continuam no mapa para facilitar a alocação'}
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-4 items-start">
          {isManager && (
            <aside className={`transition-all duration-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm shrink-0 space-y-3 roll-professionals ${trayCollapsed ? 'w-full lg:w-14 p-2.5 items-center' : 'w-full lg:w-72'}`}>
              <div className="flex items-center justify-between">
                {!trayCollapsed && (
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
                    <HeartPulse className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Roll Profissionais
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
                    <SelectTrigger className="h-8 text-xs font-bold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"><SelectValue placeholder="Especialidade..." /></SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900 z-[99999]">
                      <SelectItem value="todas">Todas Especialidades</SelectItem>
                      {registeredSpecialties.map(spec => <SelectItem key={spec} value={spec}>{spec}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input placeholder="Buscar profissional..." value={traySearch} onChange={e => setTraySearch(e.target.value)} className="pl-8 h-8 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl" />
                  </div>

                  <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                    {filteredTrayProfs.map(prof => (
                      <div key={prof.id} draggable onDragStart={(e) => handleDragStart(e, prof.id)} className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-sky-500 transition-all cursor-grab active:cursor-grabbing select-none shadow-sm flex items-center gap-2.5">
                        <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-mono font-black text-[10px] text-sky-600 dark:text-sky-400 shrink-0">{getInitials(prof.name)}</div>
                        <div className="min-w-0 flex-1"><div className="font-black text-xs text-slate-900 dark:text-white truncate">{formatFullName(prof.name)}</div><div className="text-[10px] text-slate-500 truncate">{prof.specialty || 'Clínica Geral'}</div></div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </aside>
          )}

          <div className="flex-1 w-full min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-center py-2.5">
              {WEEKDAYS.map(day => (<div key={day.short} className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400"><span className={day.weekend ? 'text-indigo-600 font-black' : ''}>{day.short}</span></div>))}
            </div>
            
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 dark:divide-slate-800">
              {Array.from({ length: (daysInMonth[0]?.getDay() || 0) }).map((_, idx) => (<div key={`empty-${idx}`} className="min-h-[190px] bg-slate-50/60 dark:bg-slate-950/40"></div>))}
              
              {daysInMonth.map(dateObj => {
                const dateStr = getLocalDateString(dateObj);
                const isToday = todayLocalStr === dateStr;
                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                const isSelected = selectedDays.includes(dateStr);
                const isDatePublished = isDatePublishedForCurrentSector(dateStr);
                const dayShifts = shiftsByDate[dateStr] || [];

                const manha = dayShifts.filter(s => { const h = parseInt((s.start_time || '07:00').split(':')[0]); return h >= 6 && h < 13; });
                const tarde = dayShifts.filter(s => { const h = parseInt((s.start_time || '07:00').split(':')[0]); return h >= 13 && h < 18; });
                const noite = dayShifts.filter(s => { const h = parseInt((s.start_time || '07:00').split(':')[0]); return h >= 18 || h < 6; });
                const dayVacancyGroups = vacancyGroupsByDate[dateStr] || [];
                const dayVacantCount = dayVacancyGroups.reduce((sum, group) => sum + group.vacant, 0);
                const hasOverdueVacancy = dayVacancyGroups.some(group =>
                  group.shifts.some(shift => isVacant(shift) && isShiftPast(shift, liveNow))
                );

                const renderCard = (shift) => {
                  const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
                  const status = getStatusBadge(shift);
                  const realSpec = extractSpecialty(shift, prof);
                  const validName = prof?.name || shift.professional_name;
				const isOpen = isVacant(shift);

				return (
					<div
						key={shift.id}
						onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
						onDrop={(e) => {
							e.preventDefault();
							e.stopPropagation();
							if (!isOpen) {
								alert('Este horário já está preenchido. Solte o profissional em uma vaga aberta.');
								setDraggingProfId(null);
								return;
							}
							handleDropOnSlot(e, dateStr, shift.start_time, shift.end_time, realSpec, shift.sector_id);
						}}
						onClick={(e) => { e.stopPropagation(); if (isManager) { setEditingShiftId(shift.id); setFormData({ date: shift.date, sector_id: shift.sector_id, target_specialty: realSpec, start_time: shift.start_time, end_time: shift.end_time, shift_type: shift.shift_type || 'diurno', action_type: (shift.status === 'vago' || !validName) ? 'mural' : 'alocar', professional_id: shift.professional_id || '', notes: shift.notes || '', retroactive_justification: extractRetroactiveJustification(shift.notes) }); setModalOpen(true); } }}
						className={`p-1.5 rounded-xl border border-l-4 shadow-sm cursor-pointer transition-all hover:brightness-95 ${status.wrapper} ${draggingProfId && isOpen ? 'ring-2 ring-sky-500 ring-offset-1' : ''}`}
						title={isOpen ? 'Arraste um profissional para alocar neste horário' : 'Horário já preenchido'}
					>
                      <div className="flex justify-between font-mono text-[9px] mb-0.5 opacity-80">
                        <span>{shift.start_time}-{shift.end_time}</span>
                        <span className={`font-black uppercase tracking-tight flex items-center gap-1 ${status.text}`}>{status.icon} {status.label}</span>
                      </div>
                      <div className="font-black truncate leading-tight text-slate-900 dark:text-white">
                        {status.label.includes('FALTA') || status.label.includes('VAGA') || status.label.includes('ABERTA') ? `⚠️ ${status.label}` : formatFullName(validName)}
                      </div>
                      <div className="text-[9px] font-semibold opacity-70 truncate flex items-center justify-between">
                        <span>{realSpec}</span>
                        {!selectedSectorObj && (
                          <span className="text-[8px] font-mono text-slate-400 opacity-60 truncate max-w-[60px]">{sectorMap[shift.sector_id]?.name}</span>
                        )}
                      </div>
                    </div>
                  );
                };

                return (
                  <div key={dateStr} onClick={(e) => handleDayClick(dateStr, e)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDropOnDay(e, dateStr)} className={`min-h-[220px] p-2 transition-all flex flex-col justify-between select-none cursor-pointer ${isSelected ? 'bg-indigo-50 dark:bg-indigo-950/50 ring-2 ring-indigo-500 z-10' : isToday ? 'bg-sky-50/60 dark:bg-sky-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-850/50'}`}>
                    <div className={`flex items-center justify-between p-1 px-2 rounded-xl mb-1.5 border shadow-sm ${isToday ? 'bg-gradient-to-r from-sky-600 to-cyan-600 border-sky-400 text-white font-black' : isWeekend ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-200 text-indigo-800 dark:text-indigo-300 font-bold' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 text-slate-800 dark:text-slate-200 font-bold'}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black">{dateObj.getDate()}</span>
                        <span className="text-[9px] uppercase font-bold opacity-70">{WEEKDAYS[dateObj.getDay()].short}</span>
                      </div>

                      {isDatePublished ? (
<span title="Escala oficializada e publicada para esta data" className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-emerald-600 text-white flex items-center gap-0.5 ring-1 ring-white/40">
<CheckCheck className="w-2.5 h-2.5" /> Publicada
                        </span>
                      ) : (
<span title="Rascunho: alterações ainda não foram publicadas" className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 ring-1 ring-amber-300/70 dark:ring-amber-500/40">
                          Rascunho
                        </span>
                      )}
                    </div>

                    <div className="mb-2 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/80 dark:bg-indigo-950/30 p-2">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[9px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                            <Target className="w-3 h-3" /> Mapa de Vagas
                          </span>
                          <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-300">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${dayVacantCount ? (hasOverdueVacancy ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white') : 'bg-emerald-600 text-white'}`}>
                              {dayVacantCount} {dayVacantCount === 1 ? 'vaga aberta' : 'vagas abertas'}
                            </span>
                          </span>
                        </div>

                        <div className="space-y-1">
                          {dayVacancyGroups.map(group => {
                            const sectorName = sectorMap[String(group.sector_id)]?.name;
                            const isOpen = group.vacant > 0;
                            return (
                              <div
                                key={group.key}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onDrop={(e) => handleDropOnSlot(e, dateStr, group.start_time, group.end_time, group.specialty, group.sector_id)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const firstVacant = group.shifts.find(s => isVacant(s));
                                  if (firstVacant && isManager) {
                                    setEditingShiftId(firstVacant.id);
                                    setFormData({
                                      date: firstVacant.date,
                                      sector_id: firstVacant.sector_id,
                                      target_specialty: extractSpecialty(firstVacant),
                                      start_time: firstVacant.start_time,
                                      end_time: firstVacant.end_time,
                                      shift_type: firstVacant.shift_type || 'diurno',
                                      action_type: 'alocar',
                                      professional_id: '',
                                      notes: firstVacant.notes || '',
                                      retroactive_justification: extractRetroactiveJustification(firstVacant.notes)
                                    });
                                    setModalOpen(true);
                                  }
                                }}
                                className={`rounded-lg border px-2 py-1.5 transition-all ${
                                  isOpen
                                    ? `border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 hover:border-amber-500 cursor-pointer ${draggingProfId ? 'ring-2 ring-sky-500 ring-offset-1 shadow-md' : ''}`
                                    : 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20'
                                }`}
                                title={isOpen ? 'Arraste um profissional para este horário ou clique para alocar' : 'Horário completamente preenchido'}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    {isOpen ? <Flame className="w-3 h-3 text-amber-500 shrink-0" /> : <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                                    <span className="font-mono font-black text-[10px] text-slate-800 dark:text-slate-100 whitespace-nowrap">
                                      {group.start_time}–{group.end_time}
                                    </span>
                                    <span className="text-[9px] text-slate-500 truncate">
                                      {group.specialty}{sectorName && !selectedSectorObj ? ` • ${sectorName}` : ''}
                                    </span>
                                  </div>
                                  <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                                    isOpen
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-emerald-600 text-white'
                                  }`}>
                                    {group.vacant > 0 ? `${group.vacant} vaga${group.vacant > 1 ? 's' : ''}` : `${group.filled}/${group.total}`}
                                  </span>
                                </div>
                                <div className="mt-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${isOpen ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(100, (group.filled / Math.max(1, group.total)) * 100)}%` }}
                                  />
                                </div>
                                <div className="flex justify-between mt-1 text-[8px] font-bold text-slate-400">
                                  <span>{group.filled} preenchida(s)</span>
                                  <span>{group.total} configurada(s)</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2 flex-1 overflow-y-auto max-h-[240px] pr-0.5 text-[11px]">
                      {manha.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-200 block">☀️ Manhã</span>
                          {manha.map(renderCard)}
        </div>
                      )}
                      {tarde.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-200 block">🌇 Tarde</span>
                          {tarde.map(renderCard)}
                        </div>
                      )}
                      {noite.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-200 block">🌙 Noite</span>
                          {noite.map(renderCard)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
</div>
)}

      {/* ========================================================================= */}
      {/* 4. ABA 2: PLANTÃO DO DIA (RESTAURADA E OPERACIONAL)                       */}
      {/* ========================================================================= */}
      {activeTab === 'dia' && (
        <div className="space-y-5 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase text-sky-600 dark:text-sky-400 tracking-wider block">Escala Oficial Diária</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  Plantões de Hoje ({liveNow.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })})
                </h3>
              </div>
              <Button onClick={handlePrintA4Landscape} className="h-10 bg-slate-900 hover:bg-slate-800 text-white dark:bg-sky-600 dark:hover:bg-sky-500 text-xs font-black px-5 rounded-2xl gap-2 shadow-md cursor-pointer">
                <Printer className="w-4 h-4" /> Imprimir Plantão do Dia (A4 Paisagem)
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 uppercase text-[10px] font-black border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Seção / Setor</th>
                    <th className="py-3 px-4 text-center">Data & Horário</th>
                    <th className="py-3 px-4">Profissional Escalado</th>
                    <th className="py-3 px-4">Especialidade / Atuação</th>
                    <th className="py-3 px-4 text-center">Situação / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {tvData.tableDayShifts.length === 0 ? (
                    <tr><td colSpan="5" className="py-8 text-center text-slate-400">Nenhum plantão registrado tocando o dia de hoje.</td></tr>
                  ) : (
                    tvData.tableDayShifts.map(shift => {
                      const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
                      const sector = sectorMap[String(shift.sector_id)];
                      const status = getStatusBadge(shift);
                      const realSpecialty = extractSpecialty(shift, prof);
                      const validName = prof?.name || shift.professional_name;

                      const [sYear, sMonth, sDay] = (shift.date || '').split('-');
                      const formattedDate = sDay && sMonth ? `${sDay}/${sMonth}/${sYear}` : shift.date;

                      return (
                        <tr key={shift.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60 transition-colors">
                          <td className="py-3 px-4 font-black text-slate-900 dark:text-white">{sector?.name || 'Setor'}</td>
                          <td className="py-3 px-4 font-mono font-bold text-sky-600 dark:text-sky-400 text-center whitespace-nowrap">
                            {formattedDate}<br />
                            <span className="text-[10px] text-slate-400">{shift.start_time} às {shift.end_time}</span>
                          </td>
                          <td className="py-3 px-4 font-black text-slate-900 dark:text-slate-100">
                            {status.label.includes('FALTA') || status.label.includes('VAGA') ? <span className="text-rose-600 dark:text-rose-400">⚠️ {status.label}</span> : formatFullName(validName)}
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-semibold">{realSpecialty}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-wider ${status.wrapper} ${status.text} border-none`}>
                              {status.icon} {status.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL LANÇAR / EDITAR PLANTÃO COM ALTURA RESPONSIVA (MAX-H-85VH)       */}
      {/* ========================================================================= */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto bg-slate-950 border border-slate-800 text-white shadow-2xl z-[9999] p-4 sm:p-6 rounded-3xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-800">
            <DialogTitle className="text-base font-black text-sky-400">
              {editingShiftId ? 'Editar Plantão da Escala' : 'Lançar Novo Plantão'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveShift} className="space-y-3.5 py-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Data do Plantão *</Label>
                <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl cursor-pointer" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Setor / Seção *</Label>
                <Select value={formData.sector_id} onValueChange={v => setFormData({ ...formData, sector_id: v })}>
                  <SelectTrigger className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl">
                    <SelectValue placeholder="Selecione o setor..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white z-[99999]">
                    {(sectors || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-300">Especialidade Exigida *</Label>
              <Input placeholder="Ex: Ginecologista, Cirurgião Geral..." value={formData.target_specialty} onChange={e => setFormData({ ...formData, target_specialty: e.target.value })} className="h-10 bg-slate-900 border-slate-700 font-bold text-sky-400 rounded-xl" list="modal-specs" />
              <datalist id="modal-specs">{registeredSpecialties.map(spec => <option key={spec} value={spec} />)}</datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Horário Entrada</Label>
                <Input type="time" value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })} className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Horário Saída</Label>
                <Input type="time" value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })} className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl" />
              </div>
            </div>

            <div className="p-3.5 sm:p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3">
              <Label className="text-xs font-black uppercase text-slate-400 block">Modo de Alocação</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button 
                  type="button" 
                  onClick={() => setFormData({ ...formData, action_type: 'alocar' })} 
                  className={`p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${formData.action_type === 'alocar' ? 'bg-sky-600 border-sky-600 text-white shadow-md' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'}`}
                >
                  Alocar Pessoal
                </button>
                <button 
                  type="button" 
                  onClick={() => setFormData({ ...formData, action_type: 'mural', professional_id: '' })} 
                  className={`p-2.5 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${formData.action_type === 'mural' ? 'bg-rose-600 border-rose-600 text-white shadow-md' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'}`}
                >
                  <Flame className="w-3.5 h-3.5" /> Vaga no Mural
                </button>
              </div>
              
              {formData.action_type === 'alocar' ? (
                <div className="space-y-1.5 pt-1 w-full">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-300">Profissional Disponível *</Label>
                    <span className="text-[10px] font-bold text-emerald-400">
                      {categorizedProfessionalsForModal.available.length} livre(s)
                    </span>
                  </div>

                  <div className="relative w-full">
                    <select
                      value={formData.professional_id || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const p = professionalMap[v];
                        setFormData({
                          ...formData,
                          professional_id: v,
                          target_specialty: p?.specialty || formData.target_specialty
                        });
                      }}
                      className="w-full h-11 px-3.5 py-2 bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none appearance-none truncate pr-9 cursor-pointer"
                    >
                      <option value="">Selecione o profissional...</option>
                      
                      <optgroup label="🟢 PROFISSIONAIS DISPONÍVEIS">
                        {categorizedProfessionalsForModal.available.map(p => (
                          <option key={p.id} value={String(p.id)} className="bg-slate-900 text-white py-1.5">
                            ✓ {p.name} • {p.specialty || 'Geral'} ({p.document || 'CRM'})
                          </option>
                        ))}
                      </optgroup>

                      {categorizedProfessionalsForModal.unavailable.length > 0 && (
                        <optgroup label="⛔ INDISPONÍVEIS">
                          {categorizedProfessionalsForModal.unavailable.map(p => (
                            <option key={p.id} value={String(p.id)} disabled className="bg-slate-950 text-rose-400 py-1 opacity-70">
                              ✕ {p.name} • {p.conflictReason}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                      ▼
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-rose-400 bg-rose-950/40 p-3 rounded-xl border border-rose-900/60 leading-tight">
                  O plantão será disponibilizado no <b>Mural de Oportunidades</b> para que os profissionais assumam.
                </p>
              )}

              {/* CAMPO DE JUSTIFICATIVA RETROATIVA */}
              {isEditingPastShift && formData.action_type === 'alocar' && (
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <Label className="text-xs font-bold text-amber-500 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Justificativa Retroativa *
                  </Label>
                  <p className="text-[10px] text-slate-400 leading-tight mb-1">Como este plantão já aconteceu, descreva o motivo do lançamento tardio para fins de auditoria financeira.</p>
                  <Input 
                    value={formData.retroactive_justification} 
                    onChange={e => setFormData({...formData, retroactive_justification: e.target.value})} 
                    placeholder="Ex: Profissional cobriu furo de última hora..." 
                    className="h-10 bg-slate-950 border-amber-500/50 text-amber-100 rounded-xl" 
                    required 
                  />
                </div>
              )}
            </div>
            
            <DialogFooter className="pt-3 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between border-t border-slate-800 mt-2 gap-2">
              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                {editingShiftId && (
                  <Button type="button" variant="ghost" onClick={() => handleDeleteShift(editingShiftId)} className="h-10 text-xs font-bold text-rose-400 hover:bg-rose-950/30 rounded-xl px-3 cursor-pointer">
                    <Trash2 className="w-4 h-4 mr-1" /> Excluir
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1 sm:flex-none h-10 text-xs font-bold border-slate-700 text-slate-300 rounded-xl px-4 cursor-pointer">
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1 sm:flex-none h-10 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs px-6 rounded-xl shadow-md cursor-pointer">
                  Confirmar
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 6. MODAL GERADOR E CONFIGURADOR DE ESCALAS EM MASSA                       */}
      {/* ========================================================================= */}
      <Dialog open={generatorModalOpen} onOpenChange={setGeneratorModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-950 border border-slate-800 text-white shadow-2xl rounded-3xl p-6">
          <DialogHeader className="border-b border-slate-800 pb-4">
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-indigo-400">
              <SlidersHorizontal className="w-5 h-5" /> Gerador de Grade Padrão
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleExecuteGenerator} className="space-y-5 py-2">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <Label className="text-xs font-bold text-slate-400">Setor Alvo</Label>
                <Select value={generatorConfig.sector_id} onValueChange={v => setGeneratorConfig({ ...generatorConfig, sector_id: v })}>
                  <SelectTrigger className="h-10 bg-slate-950 border-slate-700 text-white font-bold rounded-xl">
                    <SelectValue placeholder="Selecione o setor..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white z-[99999]">
                    {(sectors || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-400">Data de Início da Grade</Label>
                <Input type="date" value={generatorConfig.start_date} onChange={e => setGeneratorConfig({ ...generatorConfig, start_date: e.target.value })} className="h-10 bg-slate-900 border-slate-800 text-white rounded-xl cursor-pointer" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-400">Duração (Dias Sequenciais)</Label>
                <Input type="number" min="1" max="365" value={generatorConfig.duration_days} onChange={e => setGeneratorConfig({ ...generatorConfig, duration_days: e.target.value })} className="h-10 bg-slate-900 border-slate-800 text-white rounded-xl" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-amber-400 flex items-center gap-1"><ArrowRight className="w-3.5 h-3.5"/> Repetir de N em N dias</Label>
                <Input type="number" min="1" max="30" value={generatorConfig.interval_days} onChange={e => setGeneratorConfig({ ...generatorConfig, interval_days: e.target.value })} placeholder="Ex: 15" className="h-10 bg-slate-900 border-amber-500/50 text-amber-300 font-bold rounded-xl" required />
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-black text-sky-400 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Configuração Diária das Vagas
                </Label>
                <Button type="button" onClick={handleAddSlot} variant="outline" className="h-8 text-xs font-bold border-slate-700 text-slate-300 hover:text-white rounded-lg px-3 cursor-pointer">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Novo Turno
                </Button>
              </div>

              <div className="space-y-2">
                {generatorConfig.slots.map((slot, index) => (
                  <div key={slot.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-3 bg-slate-900 border border-slate-800 rounded-2xl relative group">
                    <div className="w-full sm:w-auto flex-1 space-y-1">
                      <Label className="text-[10px] uppercase text-slate-500 font-bold">Especialidade</Label>
                      <Input placeholder="Especialidade" value={slot.specialty} onChange={e => handleUpdateSlot(slot.id, 'specialty', e.target.value)} className="h-9 text-xs bg-slate-950 border-slate-800 text-white" list="gen-specs" />
                    </div>
                    <div className="w-24 shrink-0 space-y-1">
                      <Label className="text-[10px] uppercase text-slate-500 font-bold">Entrada</Label>
                      <Input type="time" value={slot.start_time} onChange={e => handleUpdateSlot(slot.id, 'start_time', e.target.value)} className="h-9 text-xs bg-slate-950 border-slate-800 text-white" required />
                    </div>
                    <div className="w-24 shrink-0 space-y-1">
                      <Label className="text-[10px] uppercase text-slate-500 font-bold">Saída</Label>
                      <Input type="time" value={slot.end_time} onChange={e => handleUpdateSlot(slot.id, 'end_time', e.target.value)} className="h-9 text-xs bg-slate-950 border-slate-800 text-white" required />
                    </div>
                    <div className="w-20 shrink-0 space-y-1">
                      <Label className="text-[10px] uppercase text-slate-500 font-bold">Vagas (Qtd)</Label>
                      <Input type="number" min="1" value={slot.quantity} onChange={e => handleUpdateSlot(slot.id, 'quantity', e.target.value)} className="h-9 text-xs font-black text-sky-400 bg-slate-950 border-slate-800 text-center" required />
                    </div>
                    {generatorConfig.slots.length > 1 && (
                      <div className="w-full sm:w-auto mt-2 sm:mt-0 flex justify-end">
                        <Button type="button" variant="ghost" onClick={() => handleRemoveSlot(slot.id)} className="h-9 w-9 p-0 text-rose-500 hover:bg-rose-950/50 rounded-xl cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                <datalist id="gen-specs">{registeredSpecialties.map(spec => <option key={spec} value={spec} />)}</datalist>
              </div>
            </div>

            <div className="p-4 bg-sky-950/30 border border-sky-900/50 rounded-2xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
              <p className="text-xs text-sky-200 leading-relaxed">
                A cada data gerada, o sistema cria exatamente a quantidade configurada por horário. Serão <b>{Math.ceil((parseInt(generatorConfig.duration_days) || 0) / (parseInt(generatorConfig.interval_days) || 1))}</b> dia(s) de grade e <b>{(generatorConfig.slots.reduce((acc, slot) => acc + (parseInt(slot.quantity) || 0), 0)) * Math.ceil((parseInt(generatorConfig.duration_days) || 0) / (parseInt(generatorConfig.interval_days) || 1))}</b> vagas no total. Após a geração, o sistema perguntará se você deseja iniciar a alocação.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setGeneratorModalOpen(false)} className="h-11 border-slate-700 text-slate-300 rounded-xl cursor-pointer">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-black px-8 rounded-xl shadow-lg shadow-indigo-500/20 cursor-pointer">
                Gerar Escala em Massa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/*       {/* ========================================================================= */}
      {/* 6A. PÓS-GERAÇÃO: CONFIRMAÇÃO PARA ALOCAÇÃO DOS PROFISSIONAIS            */}
      {/* ========================================================================= */}
      <Dialog open={allocationPromptOpen} onOpenChange={setAllocationPromptOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg bg-slate-950 border border-slate-800 text-white shadow-2xl rounded-3xl p-6">
          <DialogHeader className="border-b border-slate-800 pb-4">
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-sky-400">
              <HeartPulse className="w-5 h-5" /> Escala gerada — deseja alocar agora?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="p-4 rounded-2xl bg-sky-950/40 border border-sky-800/60">
              <div className="text-2xl font-black text-white">{generatedAllocationRows.length}</div>
              <div className="text-[10px] uppercase tracking-wider font-black text-sky-300 mt-0.5">
                vagas criadas na grade
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              A grade já foi salva com os horários e quantidades configurados. Agora você pode
              continuar diretamente para a alocação dos profissionais, mantendo cada profissional
              exatamente no horário e setor da vaga gerada.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAllocationPromptOpen(false);
                  setGeneratedAllocationRows([]);
                }}
                className="h-11 border-slate-700 text-slate-300 rounded-xl cursor-pointer"
              >
                Fazer depois
              </Button>
              <Button
                type="button"
                onClick={openBulkAllocation}
                className="h-11 bg-sky-600 hover:bg-sky-500 text-white font-black rounded-xl shadow-lg shadow-sky-500/20 cursor-pointer"
              >
                <HeartPulse className="w-4 h-4 mr-2" /> Sim, alocar profissionais
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 6B. ALOCAÇÃO EM LOTE DAS VAGAS GERADAS                                  */}
      {/* ========================================================================= */}
      <Dialog open={bulkAllocationOpen} onOpenChange={setBulkAllocationOpen}>
        <DialogContent className="w-[96vw] sm:max-w-5xl max-h-[92vh] overflow-y-auto bg-slate-950 border border-slate-800 text-white shadow-2xl rounded-3xl p-5 sm:p-6">
          <DialogHeader className="border-b border-slate-800 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <DialogTitle className="text-lg font-black flex items-center gap-2 text-sky-400">
                  <HeartPulse className="w-5 h-5" /> Alocação da Escala Gerada
                </DialogTitle>
                <p className="text-[11px] text-slate-400 mt-1">
                  Cada linha representa uma vaga real criada pelo gerador. Selecione o profissional
                  no horário correto ou use o preenchimento automático.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
                  {(generatedAllocationRows || []).filter(row => !bulkAllocationDraft[String(row.id)]).length} pendente(s)
                </span>
                <span className="text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                  {(generatedAllocationRows || []).filter(row => bulkAllocationDraft[String(row.id)]).length} alocada(s)
                </span>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3">
            <div className="text-xs text-slate-400">
              A especialidade configurada na vaga é usada para priorizar profissionais compatíveis.
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={autoFillBulkAllocation}
              className="h-9 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 rounded-xl font-black text-xs cursor-pointer"
            >
              <CheckCheck className="w-4 h-4 mr-1.5" /> Preencher automaticamente
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-800 overflow-hidden">
            <div className="grid grid-cols-[95px_120px_minmax(120px,1fr)_minmax(220px,1.5fr)_90px] gap-0 bg-slate-900 border-b border-slate-800 text-[9px] uppercase tracking-wider font-black text-slate-500">
              <div className="px-3 py-2">Data</div>
              <div className="px-3 py-2">Horário</div>
              <div className="px-3 py-2">Setor</div>
              <div className="px-3 py-2">Profissional</div>
              <div className="px-3 py-2 text-center">Situação</div>
            </div>

            <div className="max-h-[58vh] overflow-y-auto divide-y divide-slate-800/80">
              {(generatedAllocationRows || [])
                .slice()
                .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.start_time).localeCompare(String(b.start_time)))
                .map(row => {
                  const assignedId = bulkAllocationDraft[String(row.id)] || '';
                  const candidates = getBulkCandidates(row, bulkAllocationDraft);
                  const assignedProf = assignedId ? professionalMap[String(assignedId)] : null;

                  return (
                    <div key={row.id} className="grid grid-cols-[95px_120px_minmax(120px,1fr)_minmax(220px,1.5fr)_90px] items-center bg-slate-950 hover:bg-slate-900/80">
                      <div className="px-3 py-2 text-[10px] font-black text-slate-200">{formatDateBR(row.date)}</div>
                      <div className="px-3 py-2 font-mono text-[10px] font-black text-sky-300 whitespace-nowrap">
                        {row.start_time}–{row.end_time}
                      </div>
                      <div className="px-3 py-2 text-[10px] text-slate-300 truncate">
                        {sectorMap[String(row.sector_id)]?.name || 'Setor'}
                        <span className="block text-[9px] text-slate-500 truncate">{extractSpecialty(row)}</span>
                      </div>
                      <div className="px-3 py-2">
                        <select
                          value={assignedId}
                          onChange={e => setBulkAllocationDraft(prev => ({ ...prev, [String(row.id)]: e.target.value }))}
                          className="w-full h-9 rounded-lg bg-slate-900 border border-slate-700 text-white text-[10px] font-bold px-2 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                        >
                          <option value="">Selecionar profissional...</option>
                          {assignedProf && !candidates.some(p => String(p.id) === String(assignedProf.id)) && (
                            <option value={String(assignedProf.id)}>{assignedProf.name} • selecionado</option>
                          )}
                          {candidates.map(p => (
                            <option key={p.id} value={String(p.id)}>
                              {p.name} • {p.specialty || 'Geral'}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="px-3 py-2 text-center">
                        {assignedId ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[8px] font-black uppercase">
                            <Check className="w-3 h-3" /> Alocada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[8px] font-black uppercase">
                            <Flame className="w-3 h-3" /> Vaga
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkAllocationOpen(false)}
              className="h-11 border-slate-700 text-slate-300 rounded-xl cursor-pointer"
            >
              Fechar
            </Button>
            <Button
              type="button"
              onClick={handleSaveBulkAllocation}
              disabled={submitting}
              className="h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-7 rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4 mr-2" /> Salvar alocações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. MODAL DE PUBLICAÇÃO DE ESCALA */}
      {/* ========================================================================= */}
      <Dialog open={publishModalOpen} onOpenChange={setPublishModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md bg-slate-950 border border-slate-800 text-white shadow-2xl rounded-3xl p-6">
          <DialogHeader className="border-b border-slate-800 pb-4">
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-emerald-400">
              <Send className="w-5 h-5" /> Publicar e Oficializar Escala
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-400 leading-relaxed">
              A publicação oficializa a grade para os profissionais. A partir desse momento, ela fica visível no aplicativo (Minha Escala) e os médicos recebem as notificações de confirmação de seus plantões.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Setor a ser publicado</Label>
              <Select value={publishConfig.sector_id} onValueChange={v => setPublishConfig({ ...publishConfig, sector_id: v })}>
                <SelectTrigger className="h-10 bg-slate-900 border-slate-700 text-white font-bold rounded-xl">
                  <SelectValue placeholder="Selecione o setor..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white z-[99999]">
                  {(sectors || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Data Inicial</Label>
                <Input type="date" value={publishConfig.start_date} onChange={e => setPublishConfig({ ...publishConfig, start_date: e.target.value })} className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl cursor-pointer" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Data Final</Label>
                <Input type="date" value={publishConfig.end_date} onChange={e => setPublishConfig({ ...publishConfig, end_date: e.target.value })} className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl cursor-pointer" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="button" onClick={() => handleApplyQuickRange('7days')} variant="outline" className="flex-1 h-8 text-[10px] font-bold border-slate-700 text-slate-300 cursor-pointer">7 Dias</Button>
              <Button type="button" onClick={() => handleApplyQuickRange('15days')} variant="outline" className="flex-1 h-8 text-[10px] font-bold border-slate-700 text-slate-300 cursor-pointer">15 Dias</Button>
              <Button type="button" onClick={() => handleApplyQuickRange('month')} variant="outline" className="flex-1 h-8 text-[10px] font-bold border-slate-700 text-slate-300 cursor-pointer">Mês Inteiro</Button>
            </div>

            {existingPublishedOverlaps.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <p className="text-[10px] font-bold text-amber-500 flex items-center gap-1.5 mb-1"><History className="w-3.5 h-3.5" /> Sobrescrita Detectada</p>
                <p className="text-[10px] text-amber-200/70 leading-tight">Você está publicando um período que já possui dias oficializados. A versão mais recente se tornará a escala principal.</p>
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t border-slate-800">
            <Button type="button" variant="outline" onClick={() => setPublishModalOpen(false)} className="h-11 border-slate-700 text-slate-300 rounded-xl cursor-pointer">Cancelar</Button>
            <Button type="button" onClick={handleExecutePublishSector} disabled={submitting || !publishConfig.sector_id} className="h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer">
              Oficializar Escala
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 8. MODAL DE DUPLICAR MÊS (COPIAR ESCALAS)                                 */}
      {/* ========================================================================= */}
      <Dialog open={duplicateModalOpen} onOpenChange={setDuplicateModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md bg-slate-950 border border-slate-800 text-white shadow-2xl rounded-3xl p-6">
          <DialogHeader className="border-b border-slate-800 pb-4">
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-indigo-400">
              <Copy className="w-5 h-5" /> Duplicar Escala
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleExecuteDuplicate} className="space-y-4 py-2">
            <p className="text-xs text-slate-400 leading-relaxed">
              Copia toda a estrutura de plantões (vagas e alocações) de um mês anterior para um novo mês, mantendo os mesmos dias e profissionais.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Setor a ser duplicado</Label>
              <Select value={duplicateConfig.sector_id} onValueChange={v => setDuplicateConfig({ ...duplicateConfig, sector_id: v })}>
                <SelectTrigger className="h-10 bg-slate-900 border-slate-700 text-white font-bold rounded-xl">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white z-[99999]">
                  <SelectItem value="todos" className="text-sky-400 font-bold">Todos os Setores</SelectItem>
                  {(sectors || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Mês de Origem</Label>
                <Input type="month" value={duplicateConfig.source_date} onChange={e => setDuplicateConfig({ ...duplicateConfig, source_date: e.target.value })} className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl cursor-pointer" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Mês de Destino</Label>
                <Input type="month" value={duplicateConfig.target_date} onChange={e => setDuplicateConfig({ ...duplicateConfig, target_date: e.target.value })} className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl cursor-pointer" required />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-800">
              <Button type="button" variant="outline" onClick={() => setDuplicateModalOpen(false)} className="h-11 border-slate-700 text-slate-300 rounded-xl cursor-pointer">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 rounded-xl shadow-lg shadow-indigo-500/20 cursor-pointer">
                Processar Cópia
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
    </div>
  );
}
