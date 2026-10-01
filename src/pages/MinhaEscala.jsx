import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CalendarDays, Clock, Building2, Repeat, CheckCircle2, Loader2, DollarSign, AlertCircle, 
  Radio, Printer, ChevronLeft, ChevronRight, Send, Timer, Sparkles, Flame, ArrowRight, 
  Layers, CalendarCheck, Zap, ChevronDown, ChevronUp, Clock3, ShieldAlert, LogIn, LogOut, MapPin
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function safeNumber(val, fb = 0) {
  if (val === null || val === undefined || val === '') return fb;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : fb;
}

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safeNumber(val));
}

function formatDateBR(dateStr) {
  if (!dateStr) return '—';
  const parts = String(dateStr).trim().split('T')[0].split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(dateStr);
}

function getShiftDateTime(date, time) {
  const [year, month, day] = String(date || '').split('T')[0].split('-').map(Number);
  const [hour = 0, minute = 0] = String(time || '00:00').split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function getShiftBoundaries(shift) {
  const start = getShiftDateTime(shift.date, shift.start_time || '07:00');
  const end = getShiftDateTime(shift.date, shift.end_time || '19:00');
  if (end <= start) end.setDate(end.getDate() + 1);
  return { start, end };
}

function hasValidCoordinates(unit) {
  if (!unit || unit.lat === null || unit.lat === undefined || unit.lat === '' ||
      unit.lng === null || unit.lng === undefined || unit.lng === '') return false;
  const lat = Number(unit.lat);
  const lng = Number(unit.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// CÁLCULO DE DISTÂNCIA ENTRE DUAS COORDENADAS (Fórmula de Haversine em metros)
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Raio da terra em metros
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
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

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function MinhaEscala() {
  const { user, company, units, professionals = [], sectors = [], selectedUnitId, loading: appLoading, syncGlobalData } = useAppData();
  const navigate = useNavigate();

  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [showPastShifts, setShowPastShifts] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Estados para Geolocalização do Aparelho
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const companyId = user?.data?.company_id || user?.company_id || company?.id || 'cmp_principal';
  const myProfId = user?.data?.professional_id || user?.id;

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const currentProfessional = useMemo(() => {
    return (professionals || []).find(p => 
      String(p.id) === String(myProfId) || 
      (p.name && user?.full_name && p.name.toLowerCase().trim() === user.full_name.toLowerCase().trim())
    ) || null;
  }, [professionals, myProfId, user]);

  const profMeta = useMemo(() => {
    if (!currentProfessional) return {};
    let localMeta = {};
    try {
      const stored = window.localStorage.getItem(`prof_meta_${currentProfessional.id}`);
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) localMeta = parsed;
    } catch (error) {
      console.warn(`Não foi possível carregar os dados locais do profissional ${currentProfessional.id}:`, error);
    }
    const serverMeta = [currentProfessional.data, currentProfessional.metadata]
      .filter(source => source && typeof source === 'object' && !Array.isArray(source));
    return Object.assign({}, localMeta, ...serverMeta);
  }, [currentProfessional]);

  const sectorMap = useMemo(() => {
    const m = {};
    (sectors || []).forEach(s => { if (s) m[String(s.id)] = s; });
    return m;
  }, [sectors]);

  const loadMyShifts = useCallback(async () => {
    setLoading(true);
    try {
      const { data: allShifts } = await supabase.from('shifts').select('*').eq('company_id', companyId);
      
      const myShifts = (allShifts || []).filter(s => {
        if (!s || s.status === 'cancelado') return false;
        if (s.status === 'vago' || !s.professional_id) return false;

        const matchesId = currentProfessional && String(s.professional_id) === String(currentProfessional.id);
        const matchesUserProf = String(s.professional_id) === String(myProfId);
        const matchesName = user?.full_name && s.professional_name && s.professional_name.toLowerCase().trim() === user.full_name.toLowerCase().trim();

        return matchesId || matchesUserProf || matchesName;
      });

      setShifts(myShifts);
    } catch (e) {
      console.error('Erro ao carregar minha escala:', e);
    } finally {
      setLoading(false);
    }
  }, [companyId, currentProfessional, myProfId, user]);

  useEffect(() => {
    if (!appLoading) loadMyShifts();
  }, [appLoading, loadMyShifts]);

  // Captura Localização do GPS se o navegador permitir
  const requestLocation = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setLocationError('Seu navegador/dispositivo não suporta GPS.');
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocationError('');
          resolve(coords);
        },
        (err) => {
          setLocationError('GPS bloqueado. Permita a localização no navegador.');
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  };

  const getShiftValue = useCallback((shift) => {
    const remunType = profMeta.remuneration_type || 'plantao';
    if (remunType === 'mensal') return { type: 'mensal', value: 0 };
    if (remunType === 'produtividade') return { type: 'produtividade', value: 0 };
    
    const rates = profMeta.unit_rates?.[shift.unit_id] || {};
    const d = new Date((shift.date || '').split('T')[0] + 'T12:00:00');
    const isFds = d.getDay() === 0 || d.getDay() === 6; 
    const isNight = shift.shift_type === 'noturno' || shift.start_time >= '18:00' || shift.start_time < '06:00';
    
    const val = isFds ? rates.fds : (isNight ? rates.noturno : rates.diurno);
    return { type: 'valor', value: Number(val || 0) };
  }, [profMeta]);

  // AÇÃO DE PONTO: VALIDA TEMPO (15m MÁX) E ESPAÇO (GEOFENCE 100m)
  const handleCheckAction = async (shift, actionType) => {
    setLocationError('');
    const { start, end } = getShiftBoundaries(shift);
    const target = actionType === 'in' ? start : end;
    const diffToTarget = now.getTime() - target.getTime();
    const limitMs = 15 * 60 * 1000;

    if (diffToTarget < -limitMs) {
      alert(`Bloqueado: O ${actionType === 'in' ? 'Check-in' : 'Check-out'} só é liberado 15 minutos ANTES do horário.`);
      return;
    }
    if (diffToTarget > limitMs) {
      alert(`Bloqueado: O limite de tolerância para ${actionType === 'in' ? 'Check-in' : 'Check-out'} de 15 minutos já estourou. Fale com a gestão para um ajuste retroativo.`);
      return;
    }

    const unitObj = (units || []).find(u => String(u.id) === String(shift.unit_id));
    const unitLat = Number(unitObj?.lat);
    const unitLng = Number(unitObj?.lng);
    if (!hasValidCoordinates(unitObj)) {
      setLocationError('Ponto indisponível: as coordenadas desta unidade não estão cadastradas ou são inválidas.');
      alert('Não é possível registrar o ponto porque as coordenadas desta unidade não estão cadastradas ou são inválidas. Avise a gestão.');
      return;
    }

    const loc = await requestLocation();
    if (!loc) {
      alert('GPS não encontrado. Ative a localização do dispositivo e permita o acesso no navegador para registrar o ponto.');
      return;
    }

    const distanceInMeters = getDistanceInMeters(loc.lat, loc.lng, unitLat, unitLng);
    
    if (distanceInMeters > 100) {
      alert(`Fora do Perímetro: Você está a ${Math.round(distanceInMeters)} metros do hospital.\nO Check-in exige distância máxima de 100 metros da recepção da unidade.`);
      return;
    }

    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const tag = `[${actionType === 'in' ? 'CHECKIN' : 'CHECKOUT'}:${timeStr}]`;
    if (!confirm(`Confirmar ${actionType === 'in' ? 'Check-in' : 'Check-out'} às ${timeStr}?\nDistância auditada: ${Math.round(distanceInMeters)}m.`)) return;

    try {
      const newNotes = `${shift.notes || ''} ${tag}`.trim();
      await autoHealingSaveShift(shift.id, { notes: newNotes });
      await loadMyShifts();
      alert(`✅ ${actionType === 'in' ? 'Check-in' : 'Check-out'} registrado com sucesso na geolocalização exata da unidade!`);
    } catch (e) { alert('Erro ao registrar ponto no servidor: ' + e.message); }
  };

  const enrichedShifts = useMemo(() => {
    const list = (shifts || []).map(s => {
      const { start: startDateTime, end: endDateTime } = getShiftBoundaries(s);
      const nowMs = now.getTime();

      const notesStr = String(s.notes || '');
      const isPendingApproval = s.status === 'aguardando_aprovacao_gestor' || notesStr.includes('[AGUARDANDO_GESTOR]');

      let state = nowMs < startDateTime.getTime() ? 'programado' : 'concluido';
      let timeLeftDesc = '';
      const startDiffMs = startDateTime.getTime() - nowMs;
      const endDiffMs = endDateTime.getTime() - nowMs;

      if (startDiffMs <= 0 && endDiffMs > 0) {
        state = 'ativo';
        const left = Math.ceil(endDiffMs / 60000);
        timeLeftDesc = `Resta ${Math.floor(left / 60)}h ${left % 60}m`;
      } else if (startDiffMs > 0) {
        const countdownDiffMinutes = Math.ceil(startDiffMs / 60000);
        const days = Math.floor(countdownDiffMinutes / 1440);
        const hours = Math.floor((countdownDiffMinutes % 1440) / 60);
        timeLeftDesc = days > 0 ? `Inicia em ${days}d e ${hours}h` : `Inicia em ${hours}h`;
      } else {
        state = 'concluido';
      }

      let duration = (endDateTime.getTime() - startDateTime.getTime()) / 3600000;
      duration = Math.round(duration * 10) / 10;

      const sectorName = s.sector_name || sectorMap[s.sector_id]?.name || 'Setor Hospitalar';
      const unitObj = (units || []).find(u => String(u.id) === String(s.unit_id));
      const unitName = unitObj ? unitObj.name : (company?.name || 'Unidade Principal');

      const checkinMatch = notesStr.match(/\[CHECKIN:([^\]]+)\]/);
      const checkoutMatch = notesStr.match(/\[CHECKOUT:([^\]]+)\]/);
      const checkinTime = checkinMatch ? checkinMatch[1] : null;
      const checkoutTime = checkoutMatch ? checkoutMatch[1] : null;
      const checkinDiff = nowMs - startDateTime.getTime();
      const checkoutDiff = nowMs - endDateTime.getTime();

      return {
        ...s,
        sectorName,
        unitName,
        state,
        isPendingApproval,
        duration,
        timeLeftDesc,
        startDateTime,
        endDateTime,
        shiftValue: getShiftValue(s),
        checkinTime,
        checkoutTime,
        canCheckIn: !checkinTime && checkinDiff >= -900000 && checkinDiff <= 900000,
        canCheckOut: !!checkinTime && !checkoutTime && checkoutDiff >= -900000 && checkoutDiff <= 900000
      };
    });

    return list.map(item => {
      const hasConflict = list.some(other => {
        if (other.id === item.id) return false;
        if (other.status === 'cancelado' || other.status === 'vago') return false;
        return Math.max(item.startDateTime.getTime(), other.startDateTime.getTime()) <
          Math.min(item.endDateTime.getTime(), other.endDateTime.getTime());
      });
      return { ...item, hasConflict };
    });
  }, [shifts, now, sectorMap, units, company, getShiftValue]);

  const conflictingShiftsCount = useMemo(() => enrichedShifts.filter(s => s.hasConflict).length, [enrichedShifts]);
  
  const activeShiftNow = useMemo(() => {
    return enrichedShifts
      .filter(s => s.state === 'ativo')
      .sort((a, b) => a.endDateTime.getTime() - b.endDateTime.getTime())[0] || null;
  }, [enrichedShifts]);

  const nextHighlightedShift = useMemo(() => {
    const upcoming = enrichedShifts.filter(s => s.state === 'programado' && s.id !== activeShiftNow?.id);
    if (upcoming.length === 0) return null;
    return upcoming.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime())[0];
  }, [enrichedShifts, activeShiftNow]);

  const pendingCheckoutShift = useMemo(() => enrichedShifts
    .filter(s => s.checkinTime && !s.checkoutTime &&
      now.getTime() >= s.startDateTime.getTime() - 900000 &&
      now.getTime() <= s.endDateTime.getTime() + 900000)
    .sort((a, b) => b.startDateTime.getTime() - a.startDateTime.getTime())[0] || null,
  [enrichedShifts, now]);

  const featuredShift = activeShiftNow || pendingCheckoutShift || nextHighlightedShift;
  const featuredShiftUnit = featuredShift
    ? (units || []).find(u => String(u.id) === String(featuredShift.unit_id))
    : null;
  const featuredShiftHasCoordinates = hasValidCoordinates(featuredShiftUnit);

  const monthShifts = useMemo(() => enrichedShifts.filter(s => (s.date || '').startsWith(monthPrefix)), [enrichedShifts, monthPrefix]);

  const upcomingMonthShifts = useMemo(() => monthShifts.filter(s => s.state === 'programado' || s.state === 'ativo').sort((a, b) => {
    const cmp = (a.date || '').localeCompare(b.date || '');
    if (cmp !== 0) return cmp;
    return (a.start_time || '').localeCompare(b.start_time || '');
  }), [monthShifts]);

  const completedMonthShifts = useMemo(() => monthShifts.filter(s => s.state === 'concluido').sort((a, b) => {
    const cmp = (b.date || '').localeCompare(a.date || '');
    if (cmp !== 0) return cmp;
    return (b.start_time || '').localeCompare(a.start_time || '');
  }), [monthShifts]);

  const monthMetrics = useMemo(() => {
    let cumpridos = 0; let futuros = 0; let horas = 0; let valorBruto = 0;
    
    if (profMeta.remuneration_type === 'mensal') {
      const monthlyByUnit = profMeta.unit_monthly_salaries || {};
      const allowedUnits = Array.isArray(profMeta.allowed_unit_ids)
        ? profMeta.allowed_unit_ids
        : Array.isArray(currentProfessional?.unit_ids)
          ? currentProfessional.unit_ids
          : currentProfessional?.unit_id ? [currentProfessional.unit_id] : [];
      if (Object.keys(monthlyByUnit).length > 0) {
        const salaryUnitIds = allowedUnits.length > 0 ? allowedUnits : Object.keys(monthlyByUnit);
        valorBruto = salaryUnitIds.reduce((total, unitId) => {
          const unitSalary = monthlyByUnit[String(unitId)];
          return unitSalary === '' || unitSalary === null || unitSalary === undefined
            ? total
            : total + safeNumber(unitSalary);
        }, 0);
      } else {
        valorBruto = safeNumber(profMeta.monthly_salary);
      }
    }

    monthShifts.forEach(s => {
      if (s.state === 'concluido' || s.state === 'ativo') { 
        cumpridos += 1; 
        horas += s.duration; 
        if (s.shiftValue?.type === 'valor') valorBruto += s.shiftValue.value;
      } 
      else { futuros += 1; }
    });
    
    return { cumpridos, futuros, horas: Math.round(horas * 10) / 10, valorBruto, totalMes: monthShifts.length };
  }, [monthShifts, profMeta, currentProfessional]);

  const handlePassShiftToMural = async (shift) => {
    const requesterName = currentProfessional?.name || user?.full_name || 'Profissional';
    const requesterId = currentProfessional?.id || user?.id || '';

    if (!confirm(`Deseja solicitar a liberação do seu plantão de ${formatDateBR(shift.date)} (${shift.start_time} às ${shift.end_time}) no Mural de Oportunidades?\n\nO pedido será enviado para aprovação da coordenação antes de ser liberado.`)) {
      return;
    }

    setSubmitting(true);
    try {
      const currentNotes = String(shift.notes || '');
      const cleanNotes = currentNotes.replace(/\[SOLICITADO_POR:[^\]]+\]/gi, '').replace(/\[AGUARDANDO_GESTOR\]/gi, '').trim();
      const updatedNotes = `${cleanNotes} [SOLICITADO_POR: ${requesterName}] [SOLICITADO_ID: ${requesterId}] [AGUARDANDO_GESTOR]`.trim();

      await autoHealingSaveShift(shift.id, { status: 'aguardando_aprovacao_gestor', notes: updatedNotes });

      alert('Solicitação enviada! Aguarde a aprovação da coordenação para liberação no Mural.');
      if (typeof syncGlobalData === 'function') await syncGlobalData();
      await loadMyShifts();
    } catch (e) {
      alert('Erro ao solicitar envio ao mural: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintMyStatement = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) return alert('Permita pop-ups para imprimir o comprovante.');

    const profNome = currentProfessional?.name || user?.full_name || 'Profissional';
    const matricula = currentProfessional?.registration_id || currentProfessional?.document || 'MAT-XXXX';
    const competencia = `${MONTH_NAMES[currentMonth]} / ${currentYear}`;
    const emissao = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR');

    const allOrdered = [...monthShifts].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const rowsHtml = allOrdered.map((s, idx) => {
      const statusHtml = s.state === 'concluido' ? 'CONCLUÍDO' : s.state === 'ativo' ? 'EM ATENDIMENTO' : 'PROGRAMADO';
      const points = (s.checkinTime || s.checkoutTime) ? `<br><span style="font-size:8px; color:#555;">In: ${s.checkinTime||'--'} Out: ${s.checkoutTime||'--'}</span>` : '';
      
      return `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="border: 1px solid #000; padding: 6px 8px; font-weight: bold;">${formatDateBR(s.date)}</td>
        <td style="border: 1px solid #000; padding: 6px 8px; text-transform: uppercase;"><b>${s.unitName}</b> - ${s.sectorName}</td>
        <td style="border: 1px solid #000; padding: 6px 8px; font-family: monospace; text-align: center;">${s.start_time} às ${s.end_time}</td>
        <td style="border: 1px solid #000; padding: 6px 8px; text-align: center;">${s.duration}h ${points}</td>
        <td style="border: 1px solid #000; padding: 6px 8px; text-align: center; font-weight: bold;">
          ${statusHtml}
        </td>
      </tr>
      `;
    }).join('');

    const regimeLabel = profMeta.remuneration_type === 'mensal' ? 'Fixo Mensal' : profMeta.remuneration_type === 'produtividade' ? 'Produtividade' : 'Plantão Dinâmico';

    // ----------------------------------------------------
    // LÓGICA DE INJEÇÃO DAS LOGOS COMO NO FATURAMENTO
    // ----------------------------------------------------
    const currentUnitObj = (units || []).find(u => String(u.id) === String(selectedUnitId));
    const hospitalName = currentUnitObj?.name || company?.name || 'Hospital Principal';
    const logoLetter = hospitalName[0] || 'H';

    const companyLogoHtml = company?.logo_url || company?.data?.logo_url 
      ? `<img src="${company.logo_url || company.data?.logo_url}" style="max-height: 55px; max-width: 140px; object-fit: contain; margin-right: 15px;" />` 
      : `<div style="width: 55px; height: 55px; border: 2px solid #000; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 900; margin-right: 15px;">${logoLetter}</div>`;
    
    const unitLogoHtml = currentUnitObj?.logo_url 
      ? `<img src="${currentUnitObj.logo_url}" style="max-height: 55px; max-width: 140px; object-fit: contain; margin-left: 15px; border-left: 2px solid #eee; padding-left: 15px;" />` 
      : '';

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Espelho de Plantões - ${profNome}</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body { font-family: Arial, sans-serif; background: #fff; color: #000; padding: 15px; font-size: 11px; }
          .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
          table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-top: 15px; }
          th { background: #e2e8f0; border: 1px solid #000; padding: 6px 8px; text-transform: uppercase; font-size: 9.5px; }
          .summary { margin-top: 20px; border-top: 2px solid #000; padding-top: 10px; display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display: flex; align-items: center;">
            ${companyLogoHtml}
            ${unitLogoHtml}
            <div style="${unitLogoHtml ? 'margin-left: 15px;' : ''}">
              <h1 style="font-size: 18px; text-transform: uppercase; margin: 0;">${hospitalName}</h1>
              <p style="margin: 3px 0;">ESPELHO INDIVIDUAL DE PLANTÕES • PRESTAÇÃO DE CONTAS</p>
              <p style="margin: 3px 0;">Profissional: <b>Dr(a). ${profNome}</b> (ID: ${matricula})</p>
              <p style="margin: 3px 0;">Regime: <b>${regimeLabel}</b></p>
            </div>
          </div>
          <div style="text-align: right; font-size: 9.5px;">
            <p style="margin: 0;">Competência: <b>${competencia}</b></p>
            <p style="margin: 3px 0;">Emissão: ${emissao}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 15%;">Data</th>
              <th style="width: 40%;">Unidade / Setor</th>
              <th style="width: 15%; text-align: center;">Horário</th>
              <th style="width: 15%; text-align: center;">Duração/Ponto</th>
              <th style="width: 15%; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml.length > 0 ? rowsHtml : '<tr><td colspan="5" style="padding: 15px; text-align: center;">Nenhum plantão registrado nesta competência.</td></tr>'}
          </tbody>
        </table>

        <div class="summary">
          <span>Plantões Cumpridos: ${monthMetrics.cumpridos} de ${monthMetrics.totalMes}</span>
          <span>Horas Efetivadas: ${monthMetrics.horas}h</span>
          <span>Produção Apurada: ${profMeta.remuneration_type === 'produtividade' ? 'A Calcular' : formatCurrency(monthMetrics.valorBruto)}</span>
        </div>

        <div style="margin-top: 50px; display: flex; justify-content: space-around; text-align: center; font-size: 10px;">
          <div style="width: 220px; border-top: 1px solid #000; padding-top: 4px;">Assinatura do Profissional</div>
          <div style="width: 220px; border-top: 1px solid #000; padding-top: 4px;">Coordenação de Escala</div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans bg-slate-100 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-sky-400">
            <CalendarDays className="w-4 h-4" /> Painel Assistencial do Profissional
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            Olá, Dr(a). {currentProfessional?.name ? currentProfessional.name.split(' ')[0] : user?.full_name?.split(' ')[0] || 'Profissional'}!
          </h1>
          <p className="text-xs md:text-sm text-slate-300 font-medium">
            Consulte seus plantões, acompanhe horários e, se desejar, registre check-in e check-out.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button 
            onClick={handlePrintMyStatement} 
            className="h-11 bg-white hover:bg-slate-100 text-slate-900 font-black text-xs px-5 rounded-2xl shadow-lg gap-2 cursor-pointer transition-all hover:scale-105"
          >
            <Printer className="w-4 h-4 text-sky-600" /> Imprimir Espelho
          </Button>

          <Button 
            onClick={() => navigate('/trocas')} 
            className="h-11 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs px-5 rounded-2xl shadow-lg gap-2 cursor-pointer transition-all hover:scale-105"
          >
            <Flame className="w-4 h-4" /> Mural de Oportunidades
          </Button>
        </div>
      </div>

      {conflictingShiftsCount > 0 && (
        <div className="p-4 rounded-3xl bg-rose-500/10 border-2 border-rose-500/50 shadow-md text-rose-900 dark:text-rose-200 flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-600 text-white shrink-0">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <strong className="text-sm font-black uppercase tracking-wider block">
                Alerta de Choque de Horário ({conflictingShiftsCount} turnos sobrepostos)
              </strong>
              <p className="text-xs opacity-90">
                Você possui plantões alocados no mesmo horário em setores diferentes (destacados em vermelho). Solicite o envio ao Mural de um deles ou alinhe com a coordenação.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CARD DE PLANTÃO DO DIA COM GEOFENCING E LOCK DE TEMPO */}
      {featuredShift && (
        <div className={`p-5 md:p-6 rounded-3xl border-2 shadow-lg text-slate-950 dark:text-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in ${
          featuredShift.state === 'ativo'
            ? 'bg-emerald-500/10 border-emerald-500/60'
            : featuredShift === pendingCheckoutShift
            ? 'bg-amber-500/10 border-amber-500/50'
            : 'bg-sky-500/10 border-sky-500/50'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl text-white font-bold shadow-md shrink-0 ${
              featuredShift.state === 'ativo' ? 'bg-emerald-600' : featuredShift === pendingCheckoutShift ? 'bg-amber-600' : 'bg-sky-600'
            }`}>
              {featuredShift.state === 'ativo' ? <Radio className="w-6 h-6" /> : <Timer className="w-6 h-6" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full text-white tracking-wider ${
                  featuredShift.state === 'ativo' ? 'bg-emerald-600' : featuredShift === pendingCheckoutShift ? 'bg-amber-600' : 'bg-sky-600'
                }`}>
                  {featuredShift.state === 'ativo'
                    ? 'Plantão em andamento'
                    : featuredShift === pendingCheckoutShift
                    ? 'Check-out disponível'
                    : 'Próximo plantão'}
                </span>
                <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
                  {featuredShift.timeLeftDesc || (featuredShift === pendingCheckoutShift ? 'Janela de check-out' : '')}
                </span>
              </div>
              <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sky-700 dark:text-sky-300">🏥 {featuredShift.unitName}</span>
                <span className="text-slate-400">·</span>
                <span>{featuredShift.sectorName}</span>
                <span className="text-slate-400">·</span>
                <span className="text-sm font-bold">{formatDateBR(featuredShift.date)} · {featuredShift.start_time}–{featuredShift.end_time}</span>
              </h3>
              <p className={`text-[11px] font-semibold mt-1 flex items-center gap-1 ${
                featuredShiftHasCoordinates ? 'text-slate-500 dark:text-slate-400' : 'text-amber-700 dark:text-amber-300'
              }`}>
                <MapPin className="w-3 h-3 shrink-0" />
                {featuredShiftHasCoordinates
                  ? 'Ponto opcional: GPS a até 100 m, disponível 15 min antes/depois do horário.'
                    : 'Ponto indisponível: coordenadas da unidade ausentes ou inválidas.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:min-w-44 gap-2 shrink-0">
            {locationError && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold leading-tight">{locationError}</span>}
            <Button 
              onClick={() => handleCheckAction(featuredShift, 'in')}
              disabled={!featuredShift.canCheckIn || !featuredShiftHasCoordinates}
              className={`h-10 text-xs font-black rounded-xl gap-2 ${
                featuredShift.canCheckIn && featuredShiftHasCoordinates
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md cursor-pointer'
                  : 'bg-slate-200 text-slate-500 dark:bg-slate-800 cursor-not-allowed'
              }`}
            >
              <LogIn className="w-4 h-4" />
              {featuredShift.checkinTime ? `Check-in · ${featuredShift.checkinTime}` : 'Fazer check-in'}
            </Button>
            <Button 
              onClick={() => handleCheckAction(featuredShift, 'out')}
              disabled={!featuredShift.canCheckOut || !featuredShiftHasCoordinates}
              className={`h-10 text-xs font-black rounded-xl gap-2 ${
                featuredShift.canCheckOut && featuredShiftHasCoordinates
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md cursor-pointer'
                  : 'bg-slate-200 text-slate-500 dark:bg-slate-800 cursor-not-allowed'
              }`}
            >
              <LogOut className="w-4 h-4" />
              {featuredShift.checkoutTime ? `Check-out · ${featuredShift.checkoutTime}` : 'Fazer check-out'}
            </Button>
            <span className="text-[9px] text-slate-500 dark:text-slate-400 text-center">
              {featuredShift.canCheckIn || featuredShift.canCheckOut
                ? 'Ação voluntária, sem bloquear o plantão.'
                : 'Check-in/out libera até 15 min antes ou depois.'}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Plantões Cumpridos</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
            {monthMetrics.cumpridos}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-semibold">{monthMetrics.horas}h totais em {MONTH_NAMES[currentMonth]}</p>
        </Card>

        <Card className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Repasse Apurado</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-3 font-mono">
            {profMeta.remuneration_type === 'produtividade' ? 'COMISSÃO' : formatCurrency(monthMetrics.valorBruto)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-semibold">Base de cálculo até hoje</p>
        </Card>

        <Card className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Próximos Plantões</span>
            <CalendarCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
            {monthMetrics.futuros}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-semibold">Agendados no mês vigente</p>
        </Card>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Plantões a Realizar (Escala Futura & Hoje)
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Turnos que faltam cumprir em {MONTH_NAMES[currentMonth]} {currentYear}, ordenados a partir da data atual.
            </p>
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1 rounded-2xl gap-2">
            <button onClick={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))} className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-500 cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-black px-2 uppercase font-mono">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
            <button onClick={() => setCurrentDate(new Date(currentYear, currentMonth + 1, 1))} className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-500 cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />Carregando...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingMonthShifts.map(shift => {
              const isAtivo = shift.state === 'ativo';
              const isPending = shift.isPendingApproval;
              const hasConflict = shift.hasConflict;
              const isNext = shift.id === nextHighlightedShift?.id;

              return (
                <div 
                  key={shift.id} 
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                    hasConflict
                      ? 'border-2 border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 shadow-md ring-2 ring-rose-500/20'
                      : isAtivo 
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-md ring-1 ring-emerald-500/40' 
                      : isPending
                      ? 'border-amber-300 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20'
                      : isNext
                      ? 'border-indigo-400 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm ring-1 ring-indigo-300/50'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-sky-400'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black font-mono text-slate-900 dark:text-white">
                          {formatDateBR(shift.date)}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">
                          ({new Date(shift.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' })})
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {hasConflict && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white flex items-center gap-1 animate-pulse">
                            <ShieldAlert className="w-3 h-3" /> Choque Horário
                          </span>
                        )}
                        <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                          isAtivo 
                            ? 'bg-emerald-600 text-white animate-pulse' 
                            : isPending
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                            : isNext
                            ? 'bg-indigo-600 text-white'
                            : 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                        }`}>
                          {isAtivo ? '● Ao Vivo' : isPending ? '⏳ Em Análise' : isNext ? 'Próximo plantão' : 'Programado'}
                        </span>
                      </div>
                    </div>

                    <div className="text-sm font-black text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                      <span className="text-sky-600">🏥 {shift.unitName}</span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span>{shift.sectorName}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                      <span>Horário: <b>{shift.start_time} às {shift.end_time}</b></span>
                      <span>{shift.duration}h</span>
                    </div>

                    {shift.shiftValue?.type === 'valor' && (
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <DollarSign className="w-3.5 h-3.5" />
                        Valor Previsto: {formatCurrency(shift.shiftValue.value)}
                      </div>
                    )}
                  </div>

                  {!isAtivo && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                      {isPending ? (
                        <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Clock3 className="w-3.5 h-3.5 animate-pulse" /> Aguardando Gestão
                        </span>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handlePassShiftToMural(shift)}
                          disabled={submitting}
                          className="h-8 text-[11px] font-bold border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl gap-1.5 cursor-pointer"
                        >
                          <Flame className="w-3.5 h-3.5" /> Passar no Mural
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {upcomingMonthShifts.length === 0 && (
              <div className="md:col-span-2 lg:col-span-3 py-10 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                <CalendarCheck className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Nenhum plantão futuro nesta competência</p>
                <p className="text-xs text-slate-500 mt-1">Use as setas para consultar outros meses. O próximo plantão, quando houver, aparece em destaque acima.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">
              Plantões Já Concluídos ({completedMonthShifts.length})
            </h3>
          </div>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowPastShifts(!showPastShifts)}
            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            {showPastShifts ? (
              <span className="flex items-center gap-1">Ocultar <ChevronUp className="w-3.5 h-3.5" /></span>
            ) : (
              <span className="flex items-center gap-1">Expandir <ChevronDown className="w-3.5 h-3.5" /></span>
            )}
          </Button>
        </div>

        {showPastShifts && (
          completedMonthShifts.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Nenhum plantão concluído até o momento nesta competência.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 opacity-85">
              {completedMonthShifts.map(shift => (
                <div key={shift.id} className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-xs flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900 dark:text-white block">
                      {formatDateBR(shift.date)}
                    </span>
                    <span className="text-[9px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-black px-2 py-0.5 rounded-lg shrink-0">
                      ✓ Concluído
                    </span>
                  </div>
                  
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-sky-700 dark:text-sky-400 font-bold block truncate">
                      🏥 {shift.unitName}
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      {shift.sectorName}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1 border-t border-slate-200 dark:border-slate-800 pt-1.5">
                    <span>{shift.start_time} - {shift.end_time} ({shift.duration}h)</span>
                    {shift.shiftValue?.type === 'valor' && (
                      <span className="font-bold text-emerald-600">{formatCurrency(shift.shiftValue.value)}</span>
                    )}
                  </div>
                  
                  {(shift.checkinTime || shift.checkoutTime) && (
                    <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 bg-white dark:bg-slate-900 p-1.5 rounded-lg mt-0.5 border border-slate-100 dark:border-slate-800">
                      <span>In: <b className="text-emerald-600">{shift.checkinTime || '--:--'}</b></span>
                      <span>Out: <b className="text-rose-600">{shift.checkoutTime || '--:--'}</b></span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}