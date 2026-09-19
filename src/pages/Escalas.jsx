import React, { useState, useMemo, useEffect } from 'react';
import { useAppData } from '@/lib/useAppData';
import { base44 } from '@/api/base44Client';
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
  BellRing, Check, History
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

async function autoHealingSaveShift(id, initialPayload) {
  let payload = { ...initialPayload };
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      if (id) return await base44.entities.Shift.update(id, payload);
      else return await base44.entities.Shift.create(payload);
    } catch (err) {
      const msg = err.message || '';
      const match = msg.match(/Could not find the '([^']+)' column/i);
      if (match && match[1]) { delete payload[match[1]]; continue; }
      throw err;
    }
  }
}

function formatFullName(name) {
  if (!name) return 'Vaga em Aberto';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function getInitials(name) {
  if (!name) return 'VA';
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return p[0].substring(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function extractSpecialty(shift, prof) {
  if (shift?.target_specialty && shift.target_specialty.trim() && shift.target_specialty.toLowerCase() !== 'geral') return shift.target_specialty.trim();
  if (shift?.notes) {
    const match = shift.notes.match(/\[ESP:([^\]]+)\]/i);
    if (match && match[1]) return match[1].trim();
  }
  try { const cached = window.localStorage.getItem(`shift_spec_${shift?.id}`); if (cached) return cached; } catch {}
  return prof?.specialty || shift?.target_specialty || 'Clínica Médica';
}

function extractRetroactiveJustification(notes) {
  const match = (notes || '').match(/\[AJUSTE_RETROATIVO:([^\]]+)\]/i);
  return match ? match[1].trim() : '';
}

export default function Escalas() {
  const { shifts = [], sectors = [], professionals = [], selectedUnitId, company, isManager, syncGlobalData } = useAppData();

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
        if (!currNotes.includes('[ESCALA_PUBLICADA]')) {
          await autoHealingSaveShift(shift.id, {
            notes: `${currNotes} [ESCALA_PUBLICADA] [VIGENCIA:${publishConfig.start_date}_A_${publishConfig.end_date}]`.trim()
          });
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

  const [selectedDays, setSelectedDays] = useState([]);
  const [traySearch, setTraySearch] = useState('');
  const [traySpecialtyFilter, setTraySpecialtyFilter] = useState('todas');
  const [draggingProfId, setDraggingProfId] = useState(null);

  const [liveNow, setLiveNow] = useState(() => new Date());
  useEffect(() => { 
    const t = setInterval(() => setLiveNow(new Date()), 1000); 
    return () => clearInterval(t); 
  }, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [generatorModalOpen, setGeneratorModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
  // TV CCO & IMPRESSÃO - ESPELHO EXATO (MOSTRA TODOS SE ESTIVEREM NA GRADE)
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
          .header-info h1 { font-size: 19px; font-weight: 900; text-transform: uppercase; }
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
            <div class="logo-badge">${logoLetter}</div>
            <div class="header-info">
              <h1>${hospitalName}</h1>
              <p>ESCALA OFICIAL DE PLANTÃO • MURAL HOSPITALAR</p>
              <div>Vigência: <b>${dataVigencia}</b></div>
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
        prof.id, formData.date, formData.start_time, formData.end_time, editingShiftId
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
        const a = list[i]; const b = list[j];
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
    sector_id: '', start_date: getLocalDateString(), duration_days: 30,
    slots: [
      { id: 'slot_1', specialty: 'Clínica Médica', start_time: '07:00', end_time: '19:00', quantity: 2, shift_type: 'diurno' },
      { id: 'slot_2', specialty: 'Clínica Médica', start_time: '19:00', end_time: '07:00', quantity: 2, shift_type: 'noturno' }
    ]
  });

  const handleAddSlot = () => setGeneratorConfig(prev => ({ ...prev, slots: [...prev.slots, { id: `slot_${Date.now()}`, specialty: registeredSpecialties[0] || 'Clínica Médica', start_time: '07:00', end_time: '19:00', quantity: 1, shift_type: 'diurno' }] }));
  const handleRemoveSlot = (slotId) => setGeneratorConfig(prev => ({ ...prev, slots: prev.slots.filter(s => s.id !== slotId) }));
  const handleUpdateSlot = (slotId, field, value) => setGeneratorConfig(prev => ({ ...prev, slots: prev.slots.map(s => { if (s.id !== slotId) return s; const updated = { ...s, [field]: value }; if (field === 'start_time') updated.shift_type = value >= '18:00' || value < '06:00' ? 'noturno' : 'diurno'; return updated; }) }));

  const handleExecuteGenerator = async (e) => {
    e.preventDefault();
    if (!generatorConfig.sector_id) { alert('Selecione o setor para a escala.'); return; }
    setSubmitting(true);
    try {
      const startDt = new Date(generatorConfig.start_date + 'T12:00:00');
      const totalDays = parseInt(generatorConfig.duration_days) || 30;
      for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
        const curDate = new Date(startDt);
        curDate.setDate(curDate.getDate() + dayOffset);
        const dateStr = getLocalDateString(curDate);
        for (const slot of generatorConfig.slots) {
          const qty = parseInt(slot.quantity) || 0;
          for (let q = 0; q < qty; q++) {
            const spec = slot.specialty || 'Clínica Médica';
            const sType = slot.shift_type || (slot.start_time >= '18:00' || slot.start_time < '06:00' ? 'noturno' : 'diurno');
            const saved = await autoHealingSaveShift(null, { company_id: company?.id || 'cmp_principal', unit_id: selectedUnitId || 'unit_h1', sector_id: generatorConfig.sector_id, target_specialty: spec, notes: `[ESP:${spec}]`, professional_id: null, date: dateStr, shift_type: sType, start_time: slot.start_time, end_time: slot.end_time, status: 'vago' });
            if (saved?.id) try { window.localStorage.setItem(`shift_spec_${saved.id}`, spec); } catch {}
          }
        }
      }
      setGeneratorModalOpen(false); await syncGlobalData(); alert('Vagas geradas com sucesso!');
    } catch (err) { alert(err.message); } finally { setSubmitting(false); }
  };

  const handlePrevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  const handleToday = () => { setCurrentDate(new Date()); setStartDateFilter(''); };
  const handleStartDateChange = (e) => { const val = e.target.value; setStartDateFilter(val); if (val) { const [y, m, d] = val.split('-').map(Number); setCurrentDate(new Date(y, m - 1, d || 1)); } };

  const daysInMonth = useMemo(() => {
    const date = new Date(currentYear, currentMonth, 1);
    const days = [];
    while (date.getMonth() === currentMonth) { 
      const curStr = getLocalDateString(date);
      if (!startDateFilter || curStr >= startDateFilter) days.push(new Date(date)); 
      date.setDate(date.getDate() + 1); 
    }
    return days;
  }, [currentYear, currentMonth, startDateFilter]);

  const getStatusBadge = (shift) => {
    const isVago = isVacant(shift);
    const life = computeShiftHospitalLifecycle(shift, liveNow);

    if (isVago) {
      if (isShiftPast(shift, liveNow)) return { dot: 'bg-rose-700', label: 'FURO / FALTA', text: 'text-rose-700 dark:text-rose-500', wrapper: 'border-l-rose-700 bg-rose-100 dark:bg-rose-950/50 opacity-90', icon: <AlertTriangle className="w-3 h-3 text-rose-700" /> };
      return { dot: 'bg-amber-500 animate-pulse', label: 'VAGA ABERTA', text: 'text-amber-600 dark:text-amber-400', wrapper: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/30', icon: <Flame className="w-3 h-3 text-amber-500 animate-pulse" /> };
    }
    if (life.isLive) return { dot: 'bg-emerald-500 animate-ping', label: life.statusText, text: 'text-emerald-600 dark:text-emerald-400', wrapper: 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500/50', icon: <Radio className="w-3 h-3 text-emerald-500 animate-ping" /> };
    if (life.isConcluded) return { dot: 'bg-slate-400', label: 'CONCLUÍDO', text: 'text-slate-500 dark:text-slate-400', wrapper: 'border-l-slate-300 bg-slate-100 dark:bg-slate-800/40 opacity-70 grayscale hover:grayscale-0', icon: <CheckCircle2 className="w-3 h-3 text-slate-400" /> };
    return { dot: 'bg-sky-500', label: life.statusText, text: 'text-sky-600 dark:text-sky-400', wrapper: 'border-l-sky-400 bg-sky-50 dark:bg-sky-900/10', icon: <CalendarIcon className="w-3 h-3 text-sky-500" /> };
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

  const shiftsByDate = useMemo(() => {
    const map = {};
    monthlyShifts.forEach(s => { if (!map[s.date]) map[s.date] = []; map[s.date].push(s); });
    return map;
  }, [monthlyShifts]);

  const handleDayClick = (dateStr, e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault(); setSelectedDays(prev => prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]);
    } else { if (selectedDays.length > 0) setSelectedDays([]); }
  };

  const handleDragStart = (e, profId) => { setDraggingProfId(profId); e.dataTransfer.setData('text/plain', profId); };

  const handleDropOnDay = async (e, dateStr) => {
    e.preventDefault();
    const profId = e.dataTransfer.getData('text/plain') || draggingProfId;
    if (!profId) return;

    const prof = professionalMap[profId];
    const targetSector = selectedSectorId !== 'todos' ? selectedSectorId : ((sectors || [])[0]?.id || '');
    if (!targetSector) { alert('Selecione ou cadastre um setor hospitalar.'); return; }

    const targetDates = selectedDays.includes(dateStr) && selectedDays.length > 1 ? selectedDays : [dateStr];
    for (const d of targetDates) {
      const conflict = checkProfessionalConflict(profId, d, '07:00', '19:00');
      if (conflict.hasConflict) { alert(`⛔ BLOQUEIO DE ESCALA:\n\n${conflict.message}\n\nAção cancelada.`); setDraggingProfId(null); return; }
    }

    if (!confirm(`Alocar ${prof?.name} para ${targetDates.length} dia(s)?`)) { setDraggingProfId(null); return; }

    try {
      for (const d of targetDates) {
        const spec = prof?.specialty || 'Clínica Médica';
        const saved = await autoHealingSaveShift(null, { company_id: company?.id || 'cmp_principal', unit_id: selectedUnitId || 'unit_h1', sector_id: targetSector, professional_id: profId, professional_name: prof?.name, target_specialty: spec, notes: `[ESP:${spec}]`, date: d, shift_type: 'diurno', start_time: '07:00', end_time: '19:00', status: 'confirmado' });
        if (saved?.id) try { window.localStorage.setItem(`shift_spec_${saved.id}`, spec); } catch {}
      }
      setSelectedDays([]); await syncGlobalData();
    } catch (err) { alert('Erro ao alocar: ' + err.message); } finally { setDraggingProfId(null); }
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!formData.sector_id || !formData.date) return;

    const isPast = isShiftPast({ date: formData.date, end_time: formData.end_time }, liveNow);
    const isMural = formData.action_type === 'mural';

    if (isPast && !isMural && (!formData.retroactive_justification || !formData.retroactive_justification.trim())) { alert("Preencha a justificativa retroativa."); return; }

    if (!isMural && formData.professional_id) {
      const conflict = checkProfessionalConflict(formData.professional_id, formData.date, formData.start_time, formData.end_time, editingShiftId);
      if (conflict.hasConflict) { alert(`⛔ CONFLITO:\n\n${conflict.message}`); return; }
    }

    setSubmitting(true);
    try {
      const prof = formData.professional_id ? professionalMap[formData.professional_id] : null;
      const finalSpecialty = (formData.target_specialty || prof?.specialty || 'Clínica Médica').trim();
      const sType = formData.start_time >= '18:00' || formData.start_time < '06:00' ? 'noturno' : 'diurno';
      let baseNotes = (formData.notes || '').replace(/\[ESP:[^\]]+\]/gi, '').replace(/\[AJUSTE_RETROATIVO:[^\]]+\]/gi, '').trim();
      let newNotes = `[ESP:${finalSpecialty}] ${baseNotes}`;
      
      if (isPast && formData.action_type === 'alocar' && formData.retroactive_justification) { newNotes += ` [AJUSTE_RETROATIVO:${formData.retroactive_justification.replace(/\[|\]/g, '')}]`; }

      const payload = { company_id: company?.id || 'cmp_principal', unit_id: selectedUnitId || 'unit_h1', sector_id: formData.sector_id, target_specialty: finalSpecialty, professional_id: isMural ? null : formData.professional_id, professional_name: isMural ? null : (prof?.name || null), date: formData.date, shift_type: sType, start_time: formData.start_time, end_time: formData.end_time, status: isMural ? 'vago' : (isPast ? 'realizado' : 'confirmado'), notes: newNotes.trim() };
      const saved = await autoHealingSaveShift(editingShiftId, payload);
      if (saved?.id || editingShiftId) try { window.localStorage.setItem(`shift_spec_${saved?.id || editingShiftId}`, finalSpecialty); } catch {}
      setModalOpen(false); await syncGlobalData();
    } finally { setSubmitting(false); }
  };

  const handleSendToMuralFromModal = async () => { if (!editingShiftId || !confirm('Disponibilizar no Mural?')) return; try { await autoHealingSaveShift(editingShiftId, { professional_id: null, professional_name: null, status: 'vago' }); setModalOpen(false); await syncGlobalData(); } catch (err) { alert(err.message); } };
  const handleDeleteShift = async (shiftId) => { if (!confirm('Excluir plantão?')) return; try { await base44.entities.Shift.delete(shiftId); setModalOpen(false); await syncGlobalData(); } catch (err) { alert(err.message); } };

  // =========================================================================
  // MODO TV CCO EM TELA CHEIA ISOLADA
  // =========================================================================
  if (activeTab === 'tv') {
    return (
      <div className="fixed inset-0 z-[99999] bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8 select-none overflow-hidden font-sans">
        
        {/* BOTÃO FLUTUANTE EXCLUSIVO PARA MOBILE (FECHAR TV) */}
        <button 
          onClick={() => setActiveTab('mensal')} 
          className="lg:hidden fixed top-4 right-4 z-[99999] p-2.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 shadow-xl cursor-pointer hover:bg-slate-700"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start sm:items-center justify-between border-b border-slate-800 pb-4 shrink-0 gap-4">
          <div className="flex items-center gap-3 sm:gap-4 max-w-[85%] sm:max-w-none">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-2xl shrink-0">
              <Radio className="w-5 h-5 sm:w-7 sm:h-7 animate-pulse text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest text-sky-400 truncate">
                <span className="truncate">{company?.name || 'Hospital Santa Clara'}</span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" /> CCO AO VIVO</span>
              </div>
              <h1 className="text-lg sm:text-3xl lg:text-4xl font-black tracking-tight text-white mt-0.5 truncate">
                Centro de Comando
              </h1>
              <p className="text-[9px] sm:text-xs text-slate-400 font-bold truncate">
                {liveNow.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} · Escalas
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-5">
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

        {/* CONTAINER DA TV ROLÁVEL NO MOBILE, FIXO NO DESKTOP */}
        <div className="flex-1 my-4 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 overflow-y-auto lg:overflow-hidden pr-1 pb-16 md:pb-0">
          
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 shadow-2xl flex flex-col min-h-[300px] lg:min-h-0 lg:overflow-hidden">
            <div className="flex flex-col h-full lg:overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0">
                <span className="text-sm font-black uppercase text-emerald-400 tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /> Profissionais no Posto Agora ({tvData.emAndamento.length})
                </span>
                <span className="text-xs font-mono font-bold text-slate-400 hidden sm:block">AO VIVO</span>
              </div>
              <div className="flex-1 space-y-3 lg:overflow-y-auto pr-1">
                {tvData.emAndamento.length === 0 ? (
                  <div className="py-24 text-center text-xs text-slate-500">Nenhum profissional em atendimento neste exato momento.</div>
                ) : (
                  tvData.emAndamento.map((shift, idx) => {
                    const prof = professionalMap[String(shift.professional_id)];
                    const sector = sectorMap[String(shift.sector_id)];
                    const realSpecialty = extractSpecialty(shift, prof);
                    const validName = prof?.name || shift.professional_name;

                    return (
                      <div key={shift.id || `em-${idx}`} className="p-3 sm:p-4 bg-slate-950 border border-emerald-500/40 rounded-2xl shadow-lg flex items-center justify-between">
                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-[10px] sm:text-xs font-black text-emerald-400 uppercase truncate">{sector?.name}</span>
                          </div>
                          <div className="text-sm sm:text-base font-black text-white mt-0.5 truncate">{formatFullName(validName)}</div>
                          <span className="text-[10px] sm:text-xs text-slate-400 truncate block">{realSpecialty} • {shift.start_time} às {shift.end_time}</span>
                        </div>
                        <span className="text-[10px] sm:text-xs font-mono font-black text-emerald-300 bg-emerald-500/20 px-2 sm:px-3 py-1.5 rounded-xl whitespace-nowrap">
                          {shift.detail}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 shadow-2xl flex flex-col min-h-[300px] lg:min-h-0 lg:overflow-hidden">
            <div className="flex flex-col h-full lg:overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0">
                <span className="text-sm font-black uppercase text-sky-400 tracking-wider flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" /> Plantões Programados (Hoje)
                </span>
                <span className="text-xs font-mono font-bold text-slate-400 hidden sm:block">{tvData.programadosHoje.length} programado(s)</span>
              </div>
              <div className="flex-1 space-y-3 lg:overflow-y-auto pr-1">
                {tvData.programadosHoje.length === 0 ? (
                  <div className="py-24 text-center text-xs text-slate-500">Nenhum plantão futuro programado para a data de hoje.</div>
                ) : (
                  tvData.programadosHoje.map(({ shift, lifecycle }, idx) => {
                    const prof = professionalMap[String(shift.professional_id)];
                    const sector = sectorMap[String(shift.sector_id)];
                    const validName = prof?.name || shift.professional_name;

                    return (
                      <div key={shift.id || `prog-${idx}`} className="p-3 sm:p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                        <div className="min-w-0 pr-3">
                          <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase truncate block">{sector?.name}</span>
                          <div className="text-sm sm:text-base font-black text-white truncate">{formatFullName(validName)}</div>
                          <span className="text-[10px] sm:text-xs text-sky-400 font-mono truncate block">{shift.start_time} às {shift.end_time}</span>
                        </div>
                        <span className="text-[10px] sm:text-xs font-black uppercase bg-sky-500/20 text-sky-300 px-2 sm:px-3 py-1.5 rounded-xl font-mono whitespace-nowrap">
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

        <div className="hidden lg:flex border-t border-slate-800 pt-3 shrink-0 flex items-center justify-between text-xs text-slate-400 font-bold">
          <div>ScaleMedic Enterprise CCO • Hospital Santa Clara</div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // TELA NORMAL DE ESCALAS
  // =========================================================================
  return (
    <div className="relative p-3 md:p-6 space-y-4 font-sans bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      <button onClick={toggleMainSidebar} className="fixed left-0 z-[50] bg-slate-900 border border-slate-700 text-sky-400 hover:text-white hover:bg-sky-600 shadow-2xl px-1.5 py-3 rounded-r-xl transition-all flex items-center justify-center cursor-pointer" style={{ top: '480px' }}>
        {sidebarHidden ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* BANNER 0: ALERTA CRÍTICO */}
      {vacantShiftAlerts.length > 0 && isManager && (
        <div className="p-4 rounded-3xl bg-rose-500/15 border-2 border-rose-500/60 shadow-lg animate-in fade-in flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-600 text-white shrink-0"><AlertTriangle className="w-5 h-5 animate-pulse" /></div>
            <div>
              <strong className="text-sm font-black text-rose-500 uppercase tracking-wider block">Alerta Crítico: Plantões Descobertos ({vacantShiftAlerts.length})</strong>
              <p className="text-xs text-rose-600 dark:text-rose-300">Os turnos abaixo estão sem profissional alocado.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
            {vacantShiftAlerts.slice(0, 8).map(v => {
              const isPast = isShiftPast(v, liveNow);
              return (
                <div key={v.id} onClick={() => { setEditingShiftId(v.id); setFormData({ date: v.date, sector_id: v.sector_id, target_specialty: v.target_specialty, start_time: v.start_time, end_time: v.end_time, shift_type: v.shift_type || 'diurno', action_type: 'alocar', professional_id: '', notes: v.notes || '', retroactive_justification: extractRetroactiveJustification(v.notes) }); setModalOpen(true); }} className={`p-2 rounded-xl text-xs font-bold border cursor-pointer transition-all flex flex-col gap-1 shadow-sm hover:scale-[1.02] ${isPast ? 'bg-rose-100 border-rose-400 text-rose-800 dark:bg-rose-950/80 dark:border-rose-500 dark:text-rose-300' : 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-950/60 dark:border-amber-500/60 dark:text-amber-300'}`}>
                  <div className="flex justify-between items-center"><span className="truncate">{sectorMap[v.sector_id]?.name || 'Setor'}</span><span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${isPast ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'}`}>{isPast ? 'Falta / Furo' : 'Vaga Futura'}</span></div>
                  <div className="font-mono opacity-80">{formatDateBR(v.date)} • {v.start_time} às {v.end_time}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SELETORES E BARRA PRINCIPAL */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-400 shrink-0"><Building2 className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Setor:</div>
          <div className="w-full max-w-xs">
            <Select value={selectedSectorId} onValueChange={handleSelectSector}>
              <SelectTrigger className="h-9 text-xs font-black bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900">
                <SelectItem value="todos" className="font-bold text-sky-600">🏥 Todos os Setores</SelectItem>
                {(sectors || []).map(s => <SelectItem key={s.id} value={String(s.id)} className="text-xs">{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <Button onClick={() => { setGeneratorConfig(prev => ({ ...prev, sector_id: selectedSectorId !== 'todos' ? selectedSectorId : ((sectors || [])[0]?.id || '') })); setGeneratorModalOpen(true); }} className="h-9 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-4 rounded-2xl shadow-md gap-1.5 cursor-pointer"><SlidersHorizontal className="w-4 h-4" /> Configurar & Gerar</Button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 rounded-2xl p-1 border border-slate-200 dark:border-slate-800">
            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={handleToday} className="px-3 py-1 text-xs font-black cursor-pointer">Hoje</button>
            <button onClick={handleNextMonth} className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2"><CalendarDays className="w-5 h-5 text-sky-600" /> {MONTH_NAMES[currentMonth]} {currentYear}</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
            <button onClick={() => setActiveTab('mensal')} className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer ${activeTab === 'mensal' ? 'bg-white dark:bg-sky-600 shadow-sm text-sky-600 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Mensal</button>
            <button onClick={() => setActiveTab('dia')} className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ${activeTab === 'dia' ? 'bg-white dark:bg-sky-600 shadow-sm text-sky-600 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}><Clock className="w-3.5 h-3.5" /> Dia</button>
          </div>
          <Button variant="outline" onClick={() => setActiveTab('tv')} className="h-9 px-4 text-xs font-black rounded-2xl gap-2 bg-slate-50 dark:bg-slate-950 text-amber-600 border-slate-200 hover:bg-slate-100 cursor-pointer">
            <MonitorPlay className="w-4 h-4" /> <span>TV CCO</span>
          </Button>
          {isManager && (
            <Button onClick={() => { setEditingShiftId(null); setFormData({ date: getLocalDateString(), sector_id: selectedSectorId !== 'todos' ? selectedSectorId : ((sectors || [])[0]?.id || ''), target_specialty: registeredSpecialties[0] || 'Clínica Médica', start_time: '07:00', end_time: '19:00', shift_type: 'diurno', action_type: 'alocar', professional_id: '', notes: '', retroactive_justification: '' }); setModalOpen(true); }} className="h-9 bg-sky-600 hover:bg-sky-500 text-white text-xs font-black px-5 rounded-2xl gap-1.5 cursor-pointer">
              <Plus className="w-4 h-4" /> Lançar
            </Button>
          )}
        </div>
      </div>

      {/* GRADE MENSAL */}
      {activeTab === 'mensal' && (
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          {isManager && (
            <aside className={`transition-all duration-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm shrink-0 space-y-3 roll-professionals ${trayCollapsed ? 'w-full lg:w-14 p-2.5 items-center' : 'w-full lg:w-72'}`}>
              <div className="flex items-center justify-between">
                {!trayCollapsed && <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate"><HeartPulse className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Profissionais</span>}
                <Button size="sm" variant="ghost" onClick={toggleTray} className="h-8 w-8 p-0 rounded-xl text-slate-500 cursor-pointer">{trayCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}</Button>
              </div>
              {!trayCollapsed && (
                <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                  {filteredTrayProfs.map(prof => (
                    <div key={prof.id} draggable onDragStart={(e) => handleDragStart(e, prof.id)} className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-sky-500 transition-all cursor-grab active:cursor-grabbing select-none shadow-sm flex items-center gap-2.5">
                      <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div className="min-w-0 flex-1"><div className="font-black text-xs text-slate-900 dark:text-white truncate">{formatFullName(prof.name)}</div><div className="text-[10px] text-slate-500 truncate">{prof.specialty || 'Clínica Geral'}</div></div>
                    </div>
                  ))}
                </div>
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
                const isSelected = selectedDays.includes(dateStr);
                const dayShifts = shiftsByDate[dateStr] || [];

                return (
                  <div key={dateStr} onClick={(e) => handleDayClick(dateStr, e)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDropOnDay(e, dateStr)} className={`min-h-[220px] p-2 transition-all flex flex-col justify-between select-none cursor-pointer ${isSelected ? 'bg-indigo-50 dark:bg-indigo-950/50 ring-2 ring-indigo-500 z-10' : isToday ? 'bg-sky-50/60 dark:bg-sky-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-850/50'}`}>
                    <div className={`flex items-center justify-between p-1 px-2 rounded-xl mb-1.5 border shadow-sm ${isToday ? 'bg-gradient-to-r from-sky-600 to-cyan-600 border-sky-400 text-white font-black' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 text-slate-800 dark:text-slate-200 font-bold'}`}>
                      <span className="text-xs font-black">{dateObj.getDate()}</span>
                    </div>
                    <div className="space-y-2 flex-1 overflow-y-auto max-h-[240px] pr-0.5 text-[11px]">
                      {dayShifts.map((shift) => {
                        const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
                        const status = getStatusBadge(shift);
                        const validName = prof?.name || shift.professional_name;

                        return (
                          <div key={shift.id} onClick={(e) => { e.stopPropagation(); if (isManager) { setEditingShiftId(shift.id); setFormData({ date: shift.date, sector_id: shift.sector_id, target_specialty: extractSpecialty(shift, prof), start_time: shift.start_time, end_time: shift.end_time, shift_type: shift.shift_type || 'diurno', action_type: (shift.status === 'vago' || !validName) ? 'mural' : 'alocar', professional_id: shift.professional_id || '', notes: shift.notes || '', retroactive_justification: extractRetroactiveJustification(shift.notes) }); setModalOpen(true); } }} className={`p-1.5 rounded-xl border border-l-4 shadow-sm cursor-pointer transition-all hover:brightness-95 ${status.wrapper}`}>
                            <div className="flex justify-between font-mono text-[9px] mb-0.5 opacity-80">
                              <span>{shift.start_time}-{shift.end_time}</span>
                            </div>
                            <div className="font-black truncate leading-tight text-slate-900 dark:text-white">
                              {status.label.includes('FALTA') || status.label.includes('VAGA') || status.label.includes('ABERTA') ? `⚠️ ${status.label}` : formatFullName(validName)}
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
        </div>
      )}

      {/* PLANTÃO DO DIA */}
      {activeTab === 'dia' && (
        <div className="space-y-5 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase text-sky-600 dark:text-sky-400 tracking-wider block">Escala Oficial Diária</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">Plantões de Hoje</h3>
              </div>
              <Button onClick={handlePrintA4Landscape} className="h-10 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black px-5 rounded-2xl gap-2 cursor-pointer">
                <Printer className="w-4 h-4" /> Imprimir
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 uppercase text-[10px] font-black border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Seção / Setor</th>
                    <th className="py-3 px-4 text-center">Data & Horário</th>
                    <th className="py-3 px-4">Profissional Escalado</th>
                    <th className="py-3 px-4 text-center">Situação / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {tvData.tableDayShifts.length === 0 ? (
                    <tr><td colSpan="4" className="py-8 text-center text-slate-400">Nenhum plantão.</td></tr>
                  ) : (
                    tvData.tableDayShifts.map(shift => {
                      const prof = shift.professional_id ? professionalMap[String(shift.professional_id)] : null;
                      const sector = sectorMap[String(shift.sector_id)];
                      const status = getStatusBadge(shift);
                      const validName = prof?.name || shift.professional_name;

                      return (
                        <tr key={shift.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60 transition-colors">
                          <td className="py-3 px-4 font-black text-slate-900 dark:text-white">{sector?.name || 'Setor'}</td>
                          <td className="py-3 px-4 font-mono font-bold text-sky-600 dark:text-sky-400 text-center whitespace-nowrap">
                            {shift.date.split('-').reverse().join('/')}<br /><span className="text-[10px] text-slate-400">{shift.start_time} às {shift.end_time}</span>
                          </td>
                          <td className="py-3 px-4 font-black text-slate-900 dark:text-slate-100">
                            {status.label.includes('FALTA') || status.label.includes('VAGA') ? <span className="text-rose-600 dark:text-rose-400">⚠️ {status.label}</span> : formatFullName(validName)}
                          </td>
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
      {/* 5. MODAL LANÇAR / EDITAR PLANTÃO (REESTRUTURADO PARA MOBILE C/ FLEX)      */}
      {/* ========================================================================= */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg h-auto max-h-[90dvh] flex flex-col bg-slate-950 border border-slate-800 text-white shadow-2xl z-[9999] p-4 sm:p-6 rounded-3xl gap-0">
          
          <DialogHeader className="shrink-0 flex flex-row items-center justify-between pb-3 border-b border-slate-800 mb-2">
            <DialogTitle className="text-base font-black text-sky-400">
              {editingShiftId ? 'Editar Plantão da Escala' : 'Lançar Novo Plantão'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveShift} className="flex flex-col flex-1 overflow-hidden text-xs">
            
            {/* ÁREA INTERNA COM SCROLL INDEPENDENTE NO MOBILE */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
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
                  <button type="button" onClick={() => setFormData({ ...formData, action_type: 'alocar' })} className={`p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${formData.action_type === 'alocar' ? 'bg-sky-600 border-sky-600 text-white shadow-md' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'}`}>
                    Alocar Pessoal
                  </button>
                  <button type="button" onClick={() => setFormData({ ...formData, action_type: 'mural', professional_id: '' })} className={`p-2.5 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${formData.action_type === 'mural' ? 'bg-rose-600 border-rose-600 text-white shadow-md' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'}`}>
                    <Flame className="w-3.5 h-3.5" /> Vaga no Mural
                  </button>
                </div>
                
                {formData.action_type === 'alocar' ? (
                  <div className="space-y-1.5 pt-1 w-full">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-300">Profissional Disponível *</Label>
                      <span className="text-[10px] font-bold text-emerald-400">{categorizedProfessionalsForModal.available.length} livre(s)</span>
                    </div>

                    <div className="relative w-full">
                      <select
                        value={formData.professional_id || ''}
                        onChange={(e) => { const v = e.target.value; const p = professionalMap[v]; setFormData({ ...formData, professional_id: v, target_specialty: p?.specialty || formData.target_specialty }); }}
                        className="w-full h-11 px-3.5 py-2 bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none appearance-none truncate pr-9 cursor-pointer"
                      >
                        <option value="">Selecione o profissional...</option>
                        <optgroup label="🟢 PROFISSIONAIS DISPONÍVEIS">
                          {categorizedProfessionalsForModal.available.map(p => <option key={p.id} value={String(p.id)} className="bg-slate-900 text-white py-1.5">✓ {p.name} • {p.specialty || 'Geral'} ({p.document || 'CRM'})</option>)}
                        </optgroup>
                        {categorizedProfessionalsForModal.unavailable.length > 0 && (
                          <optgroup label="⛔ INDISPONÍVEIS">
                            {categorizedProfessionalsForModal.unavailable.map(p => <option key={p.id} value={String(p.id)} disabled className="bg-slate-950 text-rose-400 py-1 opacity-70">✕ {p.name} • {p.conflictReason}</option>)}
                          </optgroup>
                        )}
                      </select>
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-rose-400 bg-rose-950/40 p-3 rounded-xl border border-rose-900/60 leading-tight">O plantão será disponibilizado no <b>Mural de Oportunidades</b> para que os profissionais assumam.</p>
                )}
              </div>
            </div>
            
            {/* FOOTER FIXO (NÃO ROLA COM O FORM) */}
            <DialogFooter className="shrink-0 pt-3 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between border-t border-slate-800 mt-3 gap-2 pb-1">
              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                {editingShiftId && <Button type="button" variant="ghost" onClick={() => handleDeleteShift(editingShiftId)} className="h-10 text-xs font-bold text-rose-400 hover:bg-rose-950/30 rounded-xl px-3 cursor-pointer"><Trash2 className="w-4 h-4 mr-1" /> Excluir</Button>}
                {editingShiftId && formData.action_type === 'alocar' && <Button type="button" variant="outline" onClick={handleSendToMuralFromModal} className="h-10 text-xs font-bold border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xl px-3 cursor-pointer"><ArrowLeftRight className="w-3.5 h-3.5 mr-1 text-amber-400" /> Mural</Button>}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1 sm:flex-none h-10 text-xs font-bold border-slate-700 text-slate-300 rounded-xl px-4 cursor-pointer">Cancelar</Button>
                <Button type="submit" disabled={submitting} className="flex-1 sm:flex-none h-10 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs px-6 rounded-xl shadow-md cursor-pointer">Confirmar</Button>
              </div>
            </DialogFooter>

          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL CONFIGURAR & GERAR ESCALA (REESTRUTURADO PARA MOBILE C/ FLEX) */}
      <Dialog open={generatorModalOpen} onOpenChange={setGeneratorModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90dvh] flex flex-col bg-slate-950 border border-slate-800 text-white rounded-3xl p-4 sm:p-6 shadow-2xl z-[9999] gap-0">
          
          <DialogHeader className="shrink-0 flex flex-row items-center justify-between pb-3 border-b border-slate-800 mb-2">
            <DialogTitle className="text-base font-black flex items-center gap-2 text-indigo-400">
              <SlidersHorizontal className="w-5 h-5 text-indigo-400" /> Configurar & Gerar Escala
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleExecuteGenerator} className="flex flex-col flex-1 overflow-hidden text-xs">
            
            {/* ÁREA INTERNA COM SCROLL */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="p-3.5 bg-slate-900 rounded-2xl border border-slate-800 space-y-3 mt-1">
                <span className="text-xs font-black uppercase text-slate-400 block">1. Setor & Período</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-300">Setor *</Label>
                    <Select value={generatorConfig.sector_id} onValueChange={v => setGeneratorConfig({ ...generatorConfig, sector_id: v })}>
                      <SelectTrigger className="h-9 bg-slate-950 border-slate-700 text-white rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white z-[99999]">{(sectors || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-300">Início *</Label>
                    <Input type="date" value={generatorConfig.start_date} onChange={e => setGeneratorConfig({ ...generatorConfig, start_date: e.target.value })} className="h-9 bg-slate-950 border-slate-700 text-white rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-300">Dias</Label>
                    <Select value={String(generatorConfig.duration_days)} onValueChange={v => setGeneratorConfig({ ...generatorConfig, duration_days: parseInt(v) })}>
                      <SelectTrigger className="h-9 bg-slate-950 border-slate-700 text-white rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white z-[99999]">
                        <SelectItem value="7">7 Dias</SelectItem>
                        <SelectItem value="15">15 Dias</SelectItem>
                        <SelectItem value="30">30 Dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-200">2. Especialidades & Vagas</span>
                  <Button type="button" size="sm" onClick={handleAddSlot} className="h-8 bg-sky-600 text-white font-black text-xs px-3 rounded-xl gap-1 cursor-pointer"><Plus className="w-3.5 h-3.5" /> Adicionar</Button>
                </div>

                <div className="space-y-2">
                  {generatorConfig.slots.map(slot => (
                    <div key={slot.id} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                      <div className="sm:col-span-3 space-y-1"><Label className="text-[10px] text-slate-400">Especialidade</Label><Input value={slot.specialty} onChange={e => handleUpdateSlot(slot.id, 'specialty', e.target.value)} className="h-8 text-xs font-bold bg-slate-900 border-slate-700 text-white" list="specialties-datalist" /></div>
                      <div className="sm:col-span-2 space-y-1"><Label className="text-[10px] text-slate-400">Turno</Label><Select value={slot.shift_type} onValueChange={v => handleUpdateSlot(slot.id, 'shift_type', v)}><SelectTrigger className="h-8 bg-slate-900 border-slate-700 text-white"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-900 border-slate-800 text-white"><SelectItem value="diurno">Diurno</SelectItem><SelectItem value="noturno">Noturno</SelectItem></SelectContent></Select></div>
                      <div className="sm:col-span-2 space-y-1"><Label className="text-[10px] text-slate-400">Entrada</Label><Input type="time" value={slot.start_time} onChange={e => handleUpdateSlot(slot.id, 'start_time', e.target.value)} className="h-8 text-xs bg-slate-900 border-slate-700 text-white" /></div>
                      <div className="sm:col-span-2 space-y-1"><Label className="text-[10px] text-slate-400">Saída</Label><Input type="time" value={slot.end_time} onChange={e => handleUpdateSlot(slot.id, 'end_time', e.target.value)} className="h-8 text-xs bg-slate-900 border-slate-700 text-white" /></div>
                      <div className="sm:col-span-2 space-y-1"><Label className="text-[10px] text-slate-400">Qtd.</Label><Input type="number" min="1" value={slot.quantity} onChange={e => handleUpdateSlot(slot.id, 'quantity', parseInt(e.target.value) || 1)} className="h-8 text-xs bg-slate-900 border-slate-700 text-white" /></div>
                      <div className="sm:col-span-1 flex justify-end"><Button type="button" variant="ghost" onClick={() => handleRemoveSlot(slot.id)} className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-950/30 cursor-pointer"><Trash2 className="w-4 h-4" /></Button></div>
                    </div>
                  ))}
                </div>
                <datalist id="specialties-datalist">{registeredSpecialties.map(spec => <option key={spec} value={spec} />)}</datalist>
              </div>
            </div>

            {/* FOOTER FIXO */}
            <DialogFooter className="shrink-0 pt-3 flex flex-row items-center justify-end border-t border-slate-800 mt-3 gap-2 pb-1">
              <Button type="button" variant="outline" onClick={() => setGeneratorModalOpen(false)} className="h-9 text-xs border-slate-700 text-slate-300 cursor-pointer">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="h-9 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-6 rounded-xl shadow-md cursor-pointer">Gerar Vagas</Button>
            </DialogFooter>

          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}