import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppData } from '@/lib/useAppData';
import AvailabilityCard from '@/components/AvailabilityCard';
import PrivacyCard from '@/components/PrivacyCard';
import InvoiceCard from '@/components/InvoiceCard';
import { buildIcs, googleCalendarUrl, shiftEventInfo } from '@/lib/calendarExport';
import { getMonthlySalaryForUnit, getProfessionalFinancialMeta, getShiftCostEstimate, normalizeFinancialText } from '@/lib/financialCalculations';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PageHero from '@/components/PageHero';
import { CheckCircle2, Loader2, DollarSign, 
  Radio, ChevronLeft, ChevronRight, Timer, Flame, CalendarCheck, ChevronDown, ChevronUp, Clock3, ShieldAlert, LogIn, LogOut, MapPin, CalendarPlus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { escapeHtml } from '@/lib/printBranding';
import { buildPrintDocument, openPrintWindow, printHeader, printLogos } from '@/lib/printLayout';
import { autoHealingSaveShift } from '@/lib/escalaUtils';
import { formatCurrency, formatDateOrDash } from '@/lib/format';
import { birthDateOf, buildWelcome, isBirthday } from '@/lib/welcome';
import { buildIncomeStatement } from '@/lib/incomeStatement';
import { buildIncomeStatementHtml } from '@/lib/incomePrint';

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

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function MinhaEscala() {
  // Minha Escala mostra os plantões de TODAS as unidades do profissional, sem trocar de unidade.
  const { user, company, units, allCompanyProfessionals = [], allCompanySectors = [], loading: appLoading, syncGlobalData, isPaymentMarkedPaid } = useAppData();
  const sectors = allCompanySectors;
  const navigate = useNavigate();

  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shiftsLoadError, setShiftsLoadError] = useState('');
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
    return allCompanyProfessionals.find(p =>
      String(p.id) === String(myProfId) || 
      (p.name && user?.full_name && p.name.toLowerCase().trim() === user.full_name.toLowerCase().trim())
    ) || null;
  }, [allCompanyProfessionals, myProfId, user]);

  const profMeta = useMemo(() => {
    return getProfessionalFinancialMeta(currentProfessional);
  }, [currentProfessional]);
  const normalizedRemunerationType = normalizeFinancialText(profMeta.remuneration_type || currentProfessional?.remuneration_type || 'plantao');
  const isMonthlyRemuneration = ['mensal', 'monthly', 'salario mensal'].includes(normalizedRemunerationType);
  const isProductivityRemuneration = ['produtividade', 'production'].includes(normalizedRemunerationType);

  const sectorMap = useMemo(() => {
    const m = {};
    (sectors || []).forEach(s => { if (s) m[String(s.id)] = s; });
    return m;
  }, [sectors]);

  const loadMyShifts = useCallback(async () => {
    setLoading(true);
    try {
      const { data: allShifts, error } = await supabase.from('shifts').select('*').eq('company_id', companyId);
      if (error) throw error;
      
      const myShifts = (allShifts || []).filter(s => {
        if (!s || s.status === 'cancelado') return false;
        if (s.status === 'vago' || !s.professional_id) return false;

        const matchesId = currentProfessional && String(s.professional_id) === String(currentProfessional.id);
        const matchesUserProf = String(s.professional_id) === String(myProfId);
        const matchesName = user?.full_name && s.professional_name && s.professional_name.toLowerCase().trim() === user.full_name.toLowerCase().trim();

        return matchesId || matchesUserProf || matchesName;
      });

      setShifts(myShifts);
      setShiftsLoadError('');
    } catch (e) {
      console.error('Erro ao carregar minha escala:', e);
      setShiftsLoadError(e?.message || 'Não foi possível carregar seus plantões.');
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
        () => {
          setLocationError('GPS bloqueado. Permita a localização no navegador.');
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  };

  const getShiftValue = useCallback((shift) => {
    const remunerationType = profMeta.remuneration_type || currentProfessional?.remuneration_type || 'plantao';
    if (isMonthlyRemuneration) return { type: 'mensal', value: 0 };
    if (isProductivityRemuneration) return { type: 'produtividade', value: 0 };

    const estimate = getShiftCostEstimate({
      ...currentProfessional,
      remuneration_type: remunerationType
    }, shift);
    return { type: 'valor', value: estimate.amount, missingRate: estimate.missingRate };
  }, [profMeta, currentProfessional, isMonthlyRemuneration, isProductivityRemuneration]);

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
        const minutes = countdownDiffMinutes % 60;
        timeLeftDesc = days > 0
          ? `Inicia em ${days}d e ${hours}h`
          : hours > 0 ? `Inicia em ${hours}h${minutes ? ` ${minutes}min` : ''}` : `Inicia em ${minutes} min`;
      } else {
        state = 'concluido';
      }

      let duration = (endDateTime.getTime() - startDateTime.getTime()) / 3600000;
      duration = Math.round(duration * 10) / 10;

      const sectorName = s.sector_name || sectorMap[s.sector_id]?.name || 'Setor Hospitalar';
      const unitObj = (units || []).find(u => String(u.id) === String(s.unit_id));
      const unitName = unitObj ? unitObj.name : (company?.name || 'Unidade Principal');
      const unitAddress = String(unitObj?.address || unitObj?.data?.address || '').trim();

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
        unitAddress,
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

  const calendarInfo = (shift) => shiftEventInfo(shift, {
    unitName: shift.unitName,
    unitAddress: shift.unitAddress,
    sectorName: shift.sectorName
  });

  const handleAddToCalendar = () => {
    const upcoming = enrichedShifts
      .filter(s => s.state === 'programado' || s.state === 'ativo')
      .sort((a, b) => a.startDateTime - b.startDateTime);
    if (upcoming.length === 0) {
      alert('Você não tem plantões futuros para adicionar à agenda.');
      return;
    }
    const blob = new Blob([buildIcs(upcoming.map(calendarInfo))], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'meus-plantoes-scalemedic.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

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

  // Próximos plantões de qualquer mês, do mais perto ao mais longe.
  const upcomingShifts = useMemo(() => enrichedShifts.filter(s => s.state === 'programado' || s.state === 'ativo').sort((a, b) => {
    const cmp = (a.date || '').localeCompare(b.date || '');
    if (cmp !== 0) return cmp;
    return (a.start_time || '').localeCompare(b.start_time || '');
  }), [enrichedShifts]);

  const completedMonthShifts = useMemo(() => monthShifts.filter(s => s.state === 'concluido').sort((a, b) => {
    const cmp = (b.date || '').localeCompare(a.date || '');
    if (cmp !== 0) return cmp;
    return (b.start_time || '').localeCompare(a.start_time || '');
  }), [monthShifts]);

  const monthMetrics = useMemo(() => {
    let cumpridos = 0; let futuros = 0; let horas = 0; let valorBruto = 0; let monthlySalaryMissing = false;
    
    if (isMonthlyRemuneration) {
      const monthlyByUnit = profMeta.unit_monthly_salaries || {};
      const allowedUnits = Array.isArray(profMeta.allowed_unit_ids)
        ? profMeta.allowed_unit_ids
        : Array.isArray(currentProfessional?.unit_ids)
          ? currentProfessional.unit_ids
          : currentProfessional?.unit_id ? [currentProfessional.unit_id] : [];
      if (Object.keys(monthlyByUnit).length > 0) {
        monthlySalaryMissing = allowedUnits.length === 0;
        valorBruto = allowedUnits.reduce((total, unitId) => {
          const salary = getMonthlySalaryForUnit(currentProfessional, unitId);
          if (salary.missing) monthlySalaryMissing = true;
          return salary.missing ? total : total + salary.value;
        }, 0);
      } else {
        const primaryUnitId = currentProfessional?.unit_id || allowedUnits[0];
        const salary = getMonthlySalaryForUnit(currentProfessional, primaryUnitId);
        valorBruto = salary.missing ? 0 : salary.value;
        monthlySalaryMissing = salary.missing;
      }
    }

    monthShifts.forEach(s => {
      // Mesmo critério do Faturamento: só entra no repasse o plantão encerrado
      // (ou já marcado como realizado); o que está em andamento ainda não conta.
      const isCompleted = s.state === 'concluido' ||
        ['realizado', 'concluido', 'concluida'].includes(normalizeFinancialText(s.status));
      if (isCompleted) {
        cumpridos += 1; 
        horas += s.duration; 
        if (s.shiftValue?.type === 'valor') valorBruto += s.shiftValue.value;
      } 
      else { futuros += 1; }
    });
    
    return { cumpridos, futuros, horas: Math.round(horas * 10) / 10, valorBruto, totalMes: monthShifts.length, monthlySalaryMissing };
  }, [monthShifts, profMeta, currentProfessional, isMonthlyRemuneration]);

  const earnings = useMemo(() => {
    const byUnit = new Map();
    const entry = unitId => {
      const key = String(unitId || '');
      if (!byUnit.has(key)) {
        const unit = (units || []).find(u => String(u.id) === key);
        byUnit.set(key, { unitId: key, name: unit?.name || company?.name || 'Unidade', done: 0, upcoming: 0, shiftsDone: 0, shiftsUpcoming: 0, missingRate: false });
      }
      return byUnit.get(key);
    };
    monthShifts.forEach(s => {
      const isCompleted = s.state === 'concluido' || ['realizado', 'concluido', 'concluida'].includes(normalizeFinancialText(s.status));
      const row = entry(s.unit_id);
      const value = s.shiftValue?.type === 'valor' ? s.shiftValue.value : 0;
      if (s.shiftValue?.missingRate) row.missingRate = true;
      if (isCompleted) { row.done += value; row.shiftsDone += 1; } else { row.upcoming += value; row.shiftsUpcoming += 1; }
    });
    if (isMonthlyRemuneration) {
      const allowedUnits = Array.isArray(profMeta.allowed_unit_ids) && profMeta.allowed_unit_ids.length
        ? profMeta.allowed_unit_ids
        : currentProfessional?.unit_id ? [currentProfessional.unit_id] : [];
      allowedUnits.forEach(unitId => {
        const salary = getMonthlySalaryForUnit(currentProfessional, unitId);
        if (!salary.missing && salary.value > 0) entry(unitId).done += salary.value;
      });
    }
    const rows = [...byUnit.values()]
      .filter(row => row.shiftsDone || row.shiftsUpcoming || row.done)
      .map(row => ({ ...row, paid: Boolean(currentProfessional?.id && isPaymentMarkedPaid?.(row.unitId, currentProfessional.id, monthPrefix)) }));
    return {
      rows,
      done: rows.reduce((sum, row) => sum + row.done, 0),
      upcoming: rows.reduce((sum, row) => sum + row.upcoming, 0),
      missingRate: rows.some(row => row.missingRate)
    };
  }, [monthShifts, units, company, isMonthlyRemuneration, profMeta, currentProfessional, isPaymentMarkedPaid, monthPrefix]);

  // Boas-vindas: uma frase com o próximo plantão e o mês, no lugar de números soltos.
  const nowMinute = Math.floor(now.getTime() / 60000);
  const welcome = useMemo(() => {
    const at = new Date(nowMinute * 60000);
    const multiUnit = (units || []).length > 1;
    const allPaid = earnings.rows.length > 0 && earnings.rows.every(row => row.paid);
    const showAmount = !isMonthlyRemuneration && !isProductivityRemuneration && !earnings.missingRate && !allPaid;
    return buildWelcome({
      name: currentProfessional?.name || user?.full_name,
      now: at,
      activeShift: activeShiftNow,
      nextShift: nextHighlightedShift && { ...nextHighlightedShift, unitName: multiUnit ? nextHighlightedShift.unitName : '' },
      monthName: MONTH_NAMES[currentMonth]?.toLowerCase(),
      done: monthMetrics.cumpridos,
      total: monthMetrics.totalMes,
      amount: showAmount ? earnings.done : null,
      paid: allPaid,
      birthday: isBirthday(birthDateOf(currentProfessional), at)
    });
  }, [nowMinute, units, earnings, isMonthlyRemuneration, isProductivityRemuneration, currentProfessional, user, activeShiftNow, nextHighlightedShift, currentMonth, monthMetrics]);

  const handlePassShiftToMural = async (shift) => {
    const requesterName = currentProfessional?.name || user?.full_name || 'Profissional';
    const requesterId = currentProfessional?.id || user?.id || '';

    if (!confirm(`Deseja solicitar a liberação do seu plantão de ${formatDateOrDash(shift.date)} (${shift.start_time} às ${shift.end_time}) no Mural?\n\nO pedido será enviado para aprovação da coordenação antes de ser liberado.`)) {
      return;
    }

    setSubmitting(true);
    try {
      const currentNotes = String(shift.notes || '');
      const cleanNotes = currentNotes.replace(/\[SOLICITADO_POR:[^\]]+\]/gi, '').replace(/\[AGUARDANDO_GESTOR\]/gi, '').trim();
      const updatedNotes = `${cleanNotes} [SOLICITADO_POR: ${requesterName}] [SOLICITADO_ID: ${requesterId}] [AGUARDANDO_GESTOR]`.trim();

      try {
        await autoHealingSaveShift(shift.id, { status: 'aguardando_aprovacao_gestor', notes: updatedNotes });
      } catch (statusError) {
        // Mesmo tratamento do Mural (Trocas): bancos que não aceitam esse status
        // mantêm o plantão confirmado e sinalizam o pedido pelo marcador [AGUARDANDO_GESTOR].
        const message = String(statusError?.message || '');
        if (!/status|enum|check constraint/i.test(message)) throw statusError;
        await autoHealingSaveShift(shift.id, { status: 'confirmado', notes: updatedNotes });
      }

      alert('Solicitação enviada! Aguarde a aprovação da coordenação para liberação no Mural.');
      if (typeof syncGlobalData === 'function') await syncGlobalData();
      await loadMyShifts();
    } catch (e) {
      alert('Erro ao solicitar envio ao mural: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Informe de rendimentos do ano (todas as unidades), para conferir o Imposto de Renda.
  const handlePrintIncomeStatement = (year) => {
    const professional = currentProfessional || { id: myProfId, name: user?.full_name || 'Profissional' };
    const statement = buildIncomeStatement({
      professional,
      shifts,
      units,
      year,
      isPaid: (unitId, profId, month) => Boolean(isPaymentMarkedPaid?.(unitId, profId, month)),
      now: new Date()
    });
    const html = buildIncomeStatementHtml({ statement, professional, company, issuedBy: user?.full_name || '' });
    if (!openPrintWindow(html, 'width=1000,height=800')) alert('Permita pop-ups para abrir o informe.');
  };

  const handlePrintMyStatement = () => {
    const profNome = currentProfessional?.name || user?.full_name || 'Profissional';
    const registration = profMeta.registration_id || currentProfessional?.registration_id || '';
    const competencia = `${MONTH_NAMES[currentMonth]} / ${currentYear}`;
    const regimeLabel = isMonthlyRemuneration ? 'Fixo mensal' : isProductivityRemuneration ? 'Produtividade' : 'Por plantão';
    const showValue = !isMonthlyRemuneration && !isProductivityRemuneration;
    const allOrdered = [...monthShifts].sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.start_time || '').localeCompare(b.start_time || ''));
    // O plantonista atende em todas as suas unidades: o espelho leva a marca da empresa.
    const unitIds = [...new Set(allOrdered.map(s => String(s.unit_id)))];
    const singleUnit = unitIds.length === 1 ? (units || []).find(u => String(u.id) === unitIds[0]) : null;

    const rowsHtml = allOrdered.map(s => {
      const state = s.state === 'concluido' ? 'Cumprido' : s.state === 'ativo' ? 'Em andamento' : 'A fazer';
      const points = (s.checkinTime || s.checkoutTime) ? `<div class="pl-muted">ponto ${s.checkinTime || '--'} → ${s.checkoutTime || '--'}</div>` : '';
      return `<tr>
        <td class="pl-num" style="text-align:left">${formatDateOrDash(s.date)} <span class="pl-muted">${new Date(s.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' })}</span></td>
        <td>${unitIds.length > 1 ? `<b>${escapeHtml(s.unitName)}</b> · ` : ''}${escapeHtml(s.sectorName)}</td>
        <td class="pl-num" style="text-align:left">${escapeHtml(s.start_time)}–${escapeHtml(s.end_time)}${points}</td>
        <td class="pl-num">${String(s.duration).replace('.', ',')} h</td>
        ${showValue ? `<td class="pl-num">${s.shiftValue?.type === 'valor' && s.shiftValue.value > 0 ? formatCurrency(s.shiftValue.value) : '—'}</td>` : ''}
        <td>${state}</td>
      </tr>`;
    }).join('');

    const body = `<section class="pl-sheet">
      ${printHeader({
        logos: printLogos({ company, unit: singleUnit }),
        orgName: singleUnit?.name || company?.name || '',
        title: 'Espelho de plantões',
        subtitle: `${profNome}${registration ? ` · ${registration}` : ''} · ${regimeLabel}`,
        meta: [['Competência', competencia]]
      })}
      <table class="pl-table">
        <thead><tr><th>Data</th><th>${unitIds.length > 1 ? 'Unidade · setor' : 'Setor'}</th><th>Horário</th><th class="pl-num">Duração</th>${showValue ? '<th class="pl-num">Valor</th>' : ''}<th>Situação</th></tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="${showValue ? 6 : 5}" class="pl-muted" style="text-align:center;padding:18px">Nenhum plantão neste mês.</td></tr>`}</tbody>
      </table>
      <div class="summary">
        <div><span>Cumpridos</span><b>${monthMetrics.cumpridos} de ${monthMetrics.totalMes}</b></div>
        <div><span>Horas</span><b>${String(monthMetrics.horas).replace('.', ',')} h</b></div>
        <div><span>${isMonthlyRemuneration ? 'Fixo do mês' : 'Valor apurado'}</span><b>${isProductivityRemuneration ? 'No fechamento' : formatCurrency(monthMetrics.valorBruto)}</b></div>
      </div>
      <p class="pl-note">Espelho para conferência. O valor a receber é confirmado no fechamento do mês.</p>
      <div class="pl-signatures"><div>${escapeHtml(profNome)}</div><div>Coordenação de escala</div></div>
    </section>`;

    const html = buildPrintDocument({
      docTitle: `Espelho de plantões · ${profNome} · ${competencia}`,
      issuedBy: user?.full_name || '',
      css: `
        .summary { display: flex; gap: 10px; margin-top: 12px; }
        .summary div { flex: 1; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 6px; }
        .summary span { display: block; font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
        .summary b { font-size: 12px; font-variant-numeric: tabular-nums; }
        .pl-signatures { margin-top: 40px; }
      `,
      body
    });
    if (!openPrintWindow(html, 'width=1000,height=800')) alert('Permita pop-ups para imprimir o espelho.');
  };

  return (
    <div className="p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6 font-sans bg-slate-100 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      
      <PageHero
        title={welcome.title}
        subtitle={welcome.lines.join(' ')}
        actions={t => (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <Button
              onClick={handleAddToCalendar}
              title="Baixa seus próximos plantões para a agenda do celular, com lembrete 12 h e 1 h antes"
              className={`h-11 font-medium text-sm px-3 sm:px-4 rounded-xl gap-2 cursor-pointer shadow-none ${t.outline}`}
            >
              <CalendarPlus className={`w-4 h-4 ${t.outlineIcon}`} /> Adicionar à agenda
            </Button>

            <Button onClick={() => navigate('/trocas')} className={`h-11 font-semibold text-sm px-3 sm:px-4 rounded-xl gap-2 cursor-pointer shadow-none ${t.primary}`}>
              <Flame className="w-4 h-4" /> Ver o Mural
            </Button>
          </div>
        )}
      />

      {conflictingShiftsCount > 0 && (
        <div className="p-4 rounded-3xl bg-rose-500/10 border-2 border-rose-500/50 shadow-sm text-rose-900 dark:text-rose-200 flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-600 text-white shrink-0">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <strong className="text-sm font-semibold block">
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
        <div className={`p-4 sm:p-5 md:p-6 rounded-3xl border-2 shadow-sm text-slate-950 dark:text-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in ${
          featuredShift.state === 'ativo'
            ? 'bg-emerald-500/10 border-emerald-500/60'
            : featuredShift === pendingCheckoutShift
            ? 'bg-amber-500/10 border-amber-500/50'
            : 'bg-sky-500/10 border-sky-500/50'
        }`}>
          <div className="flex items-start sm:items-center gap-3 sm:gap-4">
            <div className={`p-3 rounded-2xl text-white font-semibold shadow-sm shrink-0 ${
              featuredShift.state === 'ativo' ? 'bg-emerald-600' : featuredShift === pendingCheckoutShift ? 'bg-amber-600' : 'bg-sky-600'
            }`}>
              {featuredShift.state === 'ativo' ? <Radio className="w-6 h-6" /> : <Timer className="w-6 h-6" />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs font-semibold  px-3 py-1 rounded-full text-white ${
                  featuredShift.state === 'ativo' ? 'bg-emerald-600' : featuredShift === pendingCheckoutShift ? 'bg-amber-600' : 'bg-sky-600'
                }`}>
                  {featuredShift.state === 'ativo'
                    ? 'Plantão em andamento'
                    : featuredShift === pendingCheckoutShift
                    ? 'Check-out disponível'
                    : 'Próximo plantão'}
                </span>
                <span className="tabular-nums text-xs font-medium text-slate-600 dark:text-slate-300">
                  {featuredShift.timeLeftDesc || (featuredShift === pendingCheckoutShift ? 'Janela de check-out' : '')}
                </span>
              </div>
              <h3 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-white mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sky-700 dark:text-sky-300">🏥 {featuredShift.unitName}</span>
                <span className="hidden sm:inline text-slate-400">·</span>
                <span>{featuredShift.sectorName}</span>
                <span className="hidden sm:inline text-slate-400">·</span>
                <span className="text-sm font-semibold">{formatDateOrDash(featuredShift.date)} · {featuredShift.start_time}–{featuredShift.end_time}</span>
              </h3>
              {featuredShift.unitAddress && (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(featuredShift.unitAddress)}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-sky-700 dark:hover:text-sky-300 hover:underline">
                  <MapPin className="w-3.5 h-3.5 shrink-0" /> {featuredShift.unitAddress} · <span className="text-sky-700 dark:text-sky-300">Como chegar</span>
                </a>
              )}
              {featuredShiftHasCoordinates && (
                <p className="text-[11px] font-semibold mt-1 flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <MapPin className="w-3 h-3 shrink-0" />
                  Ponto opcional: GPS a até 100 m, disponível 15 min antes/depois do horário.
                </p>
              )}
            </div>
          </div>

          {featuredShiftHasCoordinates && (
          <div className="grid grid-cols-2 sm:flex sm:flex-col sm:min-w-44 gap-2 shrink-0">
            {locationError && <span className="col-span-2 text-[10px] text-rose-600 dark:text-rose-400 font-semibold leading-tight">{locationError}</span>}
            <Button 
              onClick={() => handleCheckAction(featuredShift, 'in')}
              disabled={!featuredShift.canCheckIn || !featuredShiftHasCoordinates}
              className={`h-12 sm:h-10 text-xs font-semibold rounded-xl gap-2 ${
                featuredShift.canCheckIn && featuredShiftHasCoordinates
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer'
                  : 'bg-slate-200 text-slate-500 dark:bg-slate-800 cursor-not-allowed'
              }`}
            >
              <LogIn className="w-4 h-4" />
              {featuredShift.checkinTime ? `Check-in · ${featuredShift.checkinTime}` : 'Fazer check-in'}
            </Button>
            <Button 
              onClick={() => handleCheckAction(featuredShift, 'out')}
              disabled={!featuredShift.canCheckOut || !featuredShiftHasCoordinates}
              className={`h-12 sm:h-10 text-xs font-semibold rounded-xl gap-2 ${
                featuredShift.canCheckOut && featuredShiftHasCoordinates
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm cursor-pointer'
                  : 'bg-slate-200 text-slate-500 dark:bg-slate-800 cursor-not-allowed'
              }`}
            >
              <LogOut className="w-4 h-4" />
              {featuredShift.checkoutTime ? `Check-out · ${featuredShift.checkoutTime}` : 'Fazer check-out'}
            </Button>
            <span className="col-span-2 text-[10px] text-slate-500 dark:text-slate-400 text-center">
              {featuredShift.canCheckIn || featuredShift.canCheckOut
                ? 'Ação voluntária, sem bloquear o plantão.'
                : 'Check-in/out libera até 15 min antes ou depois.'}
            </span>
          </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Resumo do mês</h2>
        <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-2xl gap-1">
          <button onClick={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))} aria-label="Mês anterior" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold px-1 tabular-nums min-w-28 text-center">{MONTH_NAMES[currentMonth]} {currentYear}</span>
          <button onClick={() => setCurrentDate(new Date(currentYear, currentMonth + 1, 1))} aria-label="Próximo mês" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 !mt-3">
        <Card className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-xs font-medium text-slate-400">Plantões cumpridos</span>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl font-semibold text-slate-900 dark:text-white mt-3">
            {monthMetrics.cumpridos}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">{monthMetrics.horas}h totais em {MONTH_NAMES[currentMonth]}</p>
        </Card>

        <Card className="col-span-2 sm:col-span-1 order-last sm:order-none p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-xs font-medium text-slate-400">Meus ganhos · {MONTH_NAMES[currentMonth]}</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          {isProductivityRemuneration ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Produtividade: o valor sai no fechamento, conforme os atendimentos lançados pela coordenação.</p>
          ) : (
            <>
              <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400 mt-3 tabular-nums">{formatCurrency(earnings.done)}</div>
              <p className="text-[11px] text-slate-500 font-medium">{isMonthlyRemuneration ? 'Salário mensal das unidades' : 'Já realizado'}</p>
              {!isMonthlyRemuneration && (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  + {formatCurrency(earnings.upcoming)} a realizar · <b>{formatCurrency(earnings.done + earnings.upcoming)}</b> previsto no mês
                </p>
              )}
            </>
          )}
          {earnings.rows.length > 0 && (
            <ul className="mt-2 space-y-1 border-t border-slate-100 dark:border-slate-800 pt-2">
              {earnings.rows.map(row => (
                <li key={row.unitId} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate text-slate-600 dark:text-slate-300">{row.name}{!isProductivityRemuneration && !isMonthlyRemuneration ? (row.shiftsDone ? ` · ${formatCurrency(row.done)}` : ` · ${formatCurrency(row.upcoming)} a realizar`) : ''}</span>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 font-semibold ${row.paid ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                    {row.paid ? 'Pago' : row.shiftsDone || isMonthlyRemuneration ? 'A receber' : 'Previsto'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {(earnings.missingRate || (isMonthlyRemuneration && monthMetrics.monthlySalaryMissing)) && (
            <p className="mt-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              Falta valor cadastrado em alguma unidade; o total pode estar incompleto. Fale com a coordenação.
            </p>
          )}
          <button type="button" onClick={handlePrintMyStatement} className="mt-2 text-[11px] font-semibold text-sky-700 dark:text-sky-300 hover:underline cursor-pointer">
            Ver espelho do mês (PDF)
          </button>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Informe de rendimentos (IR):{' '}
            {[now.getFullYear() - 1, now.getFullYear()].map((year, index) => (
              <span key={year}>
                {index > 0 && ' · '}
                <button type="button" onClick={() => handlePrintIncomeStatement(year)} className="font-semibold text-sky-700 dark:text-sky-300 hover:underline cursor-pointer">{year}</button>
              </span>
            ))}
          </p>
        </Card>

        <Card className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-xs font-medium text-slate-400">A fazer em {MONTH_NAMES[currentMonth]}</span>
            <CalendarCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl font-semibold text-slate-900 dark:text-white mt-3">
            {monthMetrics.futuros}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">{upcomingShifts.length ? `${upcomingShifts.length} no total · o próximo em ${formatDateOrDash(upcomingShifts[0].date).slice(0, 5)}` : 'Nenhum plantão marcado'}</p>
        </Card>
      </div>

      <InvoiceCard
        professional={currentProfessional}
        companyId={companyId}
        month={monthPrefix}
        monthName={MONTH_NAMES[currentMonth].toLowerCase()}
        units={earnings.rows.filter(row => row.shiftsDone > 0 || (isMonthlyRemuneration && row.done > 0))}
        uploadedBy={user?.full_name || ''}
      />

      <AvailabilityCard professional={currentProfessional} onSaved={syncGlobalData} />

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 rounded-3xl shadow-sm space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">

              <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                Próximos plantões{upcomingShifts.length ? ` (${upcomingShifts.length})` : ''}
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Do mais perto ao mais longe, em todas as suas unidades.
            </p>
          </div>
        </div>

        {shiftsLoadError && (
          <div role="alert" className="mb-4 flex flex-col gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-xs font-semibold text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 sm:flex-row sm:items-center sm:justify-between">
            <span>Falha ao carregar sua escala: {shiftsLoadError}</span>
            <Button type="button" onClick={loadMyShifts} variant="outline" className="h-8 border-rose-300 text-rose-800 dark:border-rose-500/40 dark:text-rose-200">
              Tentar novamente
            </Button>
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />Carregando...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingShifts.map(shift => {
              const isAtivo = shift.state === 'ativo';
              const isPending = shift.isPendingApproval;
              const hasConflict = shift.hasConflict;
              const isNext = shift.id === nextHighlightedShift?.id;

              return (
                <div 
                  key={shift.id} 
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                    hasConflict
                      ? 'border-2 border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 shadow-sm ring-2 ring-rose-500/20'
                      : isAtivo 
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm ring-1 ring-emerald-500/40' 
                      : isPending
                      ? 'border-amber-300 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
                          {formatDateOrDash(shift.date)}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500">
                          ({new Date(shift.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' })})
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {hasConflict && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-600 text-white flex items-center gap-1 animate-pulse">
                            <ShieldAlert className="w-3 h-3" /> Choque Horário
                          </span>
                        )}
                        <span className={`text-xs font-semibold  px-2.5 py-0.5 rounded-full ${
                          isAtivo 
                            ? 'bg-emerald-600 text-white animate-pulse' 
                            : isPending
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}>
                          {isAtivo ? '● Ao vivo' : isPending ? 'Em análise' : isNext ? 'Próximo' : 'Marcado'}
                        </span>
                      </div>
                    </div>

                    <div className="text-sm font-semibold text-slate-900 dark:text-white flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span className="text-sky-600">🏥 {shift.unitName}</span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span>{shift.sectorName}</span>
                    </div>
                    {shift.unitAddress && (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shift.unitAddress)}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-sky-700 dark:hover:text-sky-300 hover:underline">
                  <MapPin className="w-3.5 h-3.5 shrink-0" /> {shift.unitAddress} · <span className="text-sky-700 dark:text-sky-300">Como chegar</span>
                </a>
              )}
                    <a href={googleCalendarUrl(calendarInfo(shift))} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 dark:text-sky-300 hover:underline">
                      <CalendarPlus className="w-3.5 h-3.5 shrink-0" /> Google Agenda
                    </a>

                    <div className="flex items-center justify-between text-xs text-slate-500 tabular-nums">
                      <span>Horário: <b>{shift.start_time} às {shift.end_time}</b></span>
                      <span>{shift.duration}h</span>
                    </div>

                    {shift.shiftValue?.type === 'valor' && shift.shiftValue.value > 0 && (
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <DollarSign className="w-3.5 h-3.5" />
                        Valor Previsto: {formatCurrency(shift.shiftValue.value)}
                      </div>
                    )}
                  </div>

                  {!isAtivo && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                      {isPending ? (
                        <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Clock3 className="w-3.5 h-3.5 animate-pulse" /> Aguardando Gestão
                        </span>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handlePassShiftToMural(shift)}
                          disabled={submitting}
                          className="h-10 sm:h-8 w-full sm:w-auto text-[11px] font-semibold rounded-xl gap-1.5 cursor-pointer"
                        >
                          <Flame className="w-3.5 h-3.5" /> Passar no Mural
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {upcomingShifts.length === 0 && (
              <div className="md:col-span-2 lg:col-span-3 py-10 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                <CalendarCheck className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhum plantão marcado</p>
                <p className="text-xs text-slate-500 mt-1">Quando a coordenação te escalar, aparece aqui. Vagas abertas ficam no <button type="button" onClick={() => navigate('/trocas')} className="font-semibold text-sky-700 dark:text-sky-300 hover:underline cursor-pointer">Mural</button>.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Concluídos em {MONTH_NAMES[currentMonth]} ({completedMonthShifts.length})
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
            <p className="text-xs text-slate-400 py-4 text-center">Nenhum plantão concluído neste mês.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 opacity-85">
              {completedMonthShifts.map(shift => (
                <div key={shift.id} className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-xs flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="tabular-nums font-semibold text-slate-900 dark:text-white block">
                      {formatDateOrDash(shift.date)}
                    </span>
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-lg shrink-0">
                      ✓ Concluído
                    </span>
                  </div>
                  
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-sky-700 dark:text-sky-400 font-semibold block truncate">
                      🏥 {shift.unitName}
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      {shift.sectorName}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-[10px] text-slate-400 tabular-nums mt-1 border-t border-slate-200 dark:border-slate-800 pt-1.5">
                    <span>{shift.start_time} - {shift.end_time} ({shift.duration}h)</span>
                    {shift.shiftValue?.type === 'valor' && shift.shiftValue.value > 0 && (
                      <span className="font-semibold text-emerald-600">{formatCurrency(shift.shiftValue.value)}</span>
                    )}
                  </div>
                  
                  {(shift.checkinTime || shift.checkoutTime) && (
                    <div className="flex items-center justify-between text-[10px] tabular-nums text-slate-500 bg-white dark:bg-slate-900 p-1.5 rounded-lg mt-0.5 border border-slate-100 dark:border-slate-800">
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

      <PrivacyCard user={user} professional={currentProfessional} />
    </div>
  );
}