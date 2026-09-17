import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CalendarDays, 
  Clock, 
  Building2, 
  Repeat, 
  CheckCircle2, 
  Loader2, 
  DollarSign,
  AlertCircle,
  Radio,
  Printer,
  ChevronLeft,
  ChevronRight,
  Send,
  Timer,
  Sparkles,
  Flame,
  ArrowRight,
  Layers,
  CalendarCheck,
  Zap,
  MapPin
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
  const parts = String(dateStr).trim().split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(dateStr);
}

function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function MinhaEscala() {
  const { user, company, professionals = [], sectors = [], loading: appLoading, syncGlobalData } = useAppData();
  const navigate = useNavigate();

  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const myProfId = user?.data?.professional_id || user?.id;

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const todayStr = useMemo(() => getLocalDateString(now), [now]);

  // Identificação do profissional logado
  const currentProfessional = useMemo(() => {
    return (professionals || []).find(p => 
      String(p.id) === String(myProfId) || 
      (p.name && user?.full_name && p.name.toLowerCase().trim() === user.full_name.toLowerCase().trim())
    ) || null;
  }, [professionals, myProfId, user]);

  const sectorMap = useMemo(() => {
    const m = {};
    (sectors || []).forEach(s => { if (s) m[String(s.id)] = s; });
    return m;
  }, [sectors]);

  // Carga e filtro dos plantões do profissional
  const loadMyShifts = useCallback(async () => {
    setLoading(true);
    try {
      const query = companyId ? { company_id: companyId } : {};
      const allShifts = await base44.entities.Shift.filter(query, '-date', 1000);
      
      const myShifts = (allShifts || []).filter(s => {
        if (!s || s.status === 'cancelado') return false;
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

  // Remuneração configurada
  const remunConfig = useMemo(() => {
    let meta = {};
    if (currentProfessional?.id) {
      try {
        const stored = window.localStorage.getItem(`prof_meta_${currentProfessional.id}`);
        if (stored) meta = JSON.parse(stored);
      } catch {}
    }

    const remunType = meta.remuneration_type || currentProfessional?.remuneration_type || 'mensal';
    
    let baseSalario = 1672;
    if (meta.monthly_salary !== undefined && meta.monthly_salary !== null) {
      baseSalario = safeNumber(meta.monthly_salary, 1672);
    } else if (currentProfessional?.monthly_salary !== undefined && currentProfessional?.monthly_salary !== null) {
      baseSalario = safeNumber(currentProfessional.monthly_salary, 1672);
    }

    const dailyRate = meta.daily_rate !== undefined ? safeNumber(meta.daily_rate) : safeNumber(currentProfessional?.daily_rate, 0);
    const hourlyRate = meta.hourly_rate !== undefined ? safeNumber(meta.hourly_rate) : safeNumber(currentProfessional?.hourly_rate, 0);

    let valorPorPlantao = 0;
    let valorPorHora = 0;

    if (remunType === 'mensal') {
      valorPorPlantao = baseSalario / 20;
      valorPorHora = baseSalario / 220;
    } else if (remunType === 'diaria') {
      valorPorPlantao = dailyRate > 0 ? dailyRate : (baseSalario / 20);
      valorPorHora = valorPorPlantao / 12;
    } else {
      valorPorHora = hourlyRate > 0 ? hourlyRate : (baseSalario / 220);
      valorPorHora = valorPorHora * 12;
    }

    return { 
      valorPorPlantao: safeNumber(valorPorPlantao, 83.6), 
      valorPorHora: safeNumber(valorPorHora, 7.6), 
      remunType, 
      salarioBase: baseSalario 
    };
  }, [currentProfessional]);

  // Classificação dos plantões com cálculo temporal
  const enrichedShifts = useMemo(() => {
    const nowHour = now.getHours();
    const nowMin = now.getMinutes();
    const nowTotalMin = nowHour * 60 + nowMin;

    return (shifts || []).map(s => {
      const [startH, startM] = (s.start_time || '07:00').split(':').map(Number);
      const [endH, endM] = (s.end_time || '19:00').split(':').map(Number);
      const startMin = (startH || 7) * 60 + (startM || 0);
      let endMin = (endH || 19) * 60 + (endM || 0);
      if (endMin <= startMin) endMin += 24 * 60;

      let effNow = nowTotalMin;
      if (endMin > 24 * 60 && nowTotalMin < startMin) effNow += 24 * 60;

      const sDate = (s.date || '').split('T')[0];
      const isPastDay = sDate < todayStr;
      const isToday = sDate === todayStr;

      let state = 'programado'; // 'ativo' | 'concluido' | 'programado'
      let timeLeftDesc = '';
      let countdownDiffMinutes = 0;

      // Cria timestamp do início
      const startDateTime = new Date(`${sDate}T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`);
      const diffMs = startDateTime.getTime() - now.getTime();
      countdownDiffMinutes = Math.round(diffMs / 60000);

      if (isPastDay) {
        state = 'concluido';
      } else if (isToday) {
        if (effNow >= startMin && effNow < endMin) {
          state = 'ativo';
          const left = endMin - effNow;
          timeLeftDesc = `Resta ${Math.floor(left / 60)}h ${left % 60}m`;
        } else if (effNow >= endMin) {
          state = 'concluido';
        } else {
          state = 'programado';
          const toStart = startMin - effNow;
          timeLeftDesc = `Inicia em ${Math.floor(toStart / 60)}h ${toStart % 60}m`;
        }
      } else {
        state = 'programado';
        const days = Math.floor(countdownDiffMinutes / 1440);
        const hours = Math.floor((countdownDiffMinutes % 1440) / 60);
        timeLeftDesc = days > 0 ? `Inicia em ${days}d e ${hours}h` : `Inicia em ${hours}h`;
      }

      let duration = (endH - startH) + (endM - startM) / 60;
      if (duration <= 0) duration += 24;

      const sectorName = s.sector_name || sectorMap[s.sector_id]?.name || 'Setor Hospitalar';

      return {
        ...s,
        sectorName,
        state,
        duration: Math.round(duration * 10) / 10,
        timeLeftDesc,
        countdownDiffMinutes,
        startDateTime
      };
    });
  }, [shifts, now, todayStr, sectorMap]);

  // 1. Plantão Ativo Agora (se estiver dentro da jornada)
  const activeShiftNow = useMemo(() => {
    return enrichedShifts.find(s => s.state === 'ativo') || null;
  }, [enrichedShifts]);

  // 2. PRÓXIMO PLANTÃO IMEDIATO DESTACADO (O mais próximo a acontecer no futuro)
  const nextHighlightedShift = useMemo(() => {
    const upcoming = enrichedShifts.filter(s => s.state === 'programado');
    if (upcoming.length === 0) return null;
    return upcoming.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime())[0];
  }, [enrichedShifts]);

  // 3. MINHA GRADE EM ORDEM CRESCENTE (Cronológica: 1º ao último dia do mês)
  const monthShiftsSortedAsc = useMemo(() => {
    return enrichedShifts
      .filter(s => (s.date || '').startsWith(monthPrefix))
      .sort((a, b) => {
        // Ordena por data crescente
        const cmpDate = (a.date || '').localeCompare(b.date || '');
        if (cmpDate !== 0) return cmpDate;
        // Se for na mesma data, ordena pelo horário de início crescente
        return (a.start_time || '').localeCompare(b.start_time || '');
      });
  }, [enrichedShifts, monthPrefix]);

  // Métricas do Mês
  const monthMetrics = useMemo(() => {
    let cumpridos = 0;
    let futuros = 0;
    let horas = 0;

    monthShiftsSortedAsc.forEach(s => {
      if (s.state === 'concluido' || s.state === 'ativo') {
        cumpridos += 1;
        horas += s.duration;
      } else {
        futuros += 1;
      }
    });

    const valorBruto = cumpridos * remunConfig.valorPorPlantao;
    const extrasQtd = Math.max(0, cumpridos - 20);

    return {
      cumpridos,
      futuros,
      horas: Math.round(horas * 10) / 10,
      valorBruto,
      extrasQtd,
      totalMes: monthShiftsSortedAsc.length
    };
  }, [monthShiftsSortedAsc, remunConfig]);

  // Passar Plantão para o Mural
  const handlePassShiftToMural = async (shift) => {
    if (!confirm(`Deseja disponibilizar seu plantão de ${formatDateBR(shift.date)} (${shift.start_time} às ${shift.end_time}) no Mural de Oportunidades?`)) return;

    try {
      await base44.entities.Shift.update(shift.id, {
        professional_id: null,
        status: 'vago',
        notes: `[DISPONIBILIZADO POR: ${currentProfessional?.name || user?.full_name}]`
      });
      alert('Plantão disponibilizado com sucesso no Mural de Oportunidades!');
      if (typeof syncGlobalData === 'function') await syncGlobalData();
      await loadMyShifts();
    } catch (e) {
      alert('Erro ao passar plantão: ' + e.message);
    }
  };

  // Impressão Oficial do Espelho de Plantões Pessoal
  const handlePrintMyStatement = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      alert('Permita pop-ups para imprimir o comprovante.');
      return;
    }

    const hospitalName = company?.name || 'HOSPITAL PRINCIPAL';
    const profNome = currentProfessional?.name || user?.full_name || 'Profissional';
    const matricula = currentProfessional?.registration_id || currentProfessional?.document || 'MAT-XXXX';
    const competencia = `${MONTH_NAMES[currentMonth]} / ${currentYear}`;
    const emissao = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR');

    const rowsHtml = monthShiftsSortedAsc.map((s, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="border: 1px solid #000; padding: 6px 8px; font-weight: bold;">${formatDateBR(s.date)}</td>
        <td style="border: 1px solid #000; padding: 6px 8px; text-transform: uppercase;">${s.sectorName}</td>
        <td style="border: 1px solid #000; padding: 6px 8px; font-family: monospace; text-align: center;">${s.start_time} às ${s.end_time}</td>
        <td style="border: 1px solid #000; padding: 6px 8px; text-align: center;">${s.duration}h</td>
        <td style="border: 1px solid #000; padding: 6px 8px; text-align: center; font-weight: bold;">
          ${s.state === 'concluido' ? 'CONCLUÍDO' : s.state === 'ativo' ? 'EM ATENDIMENTO' : 'PROGRAMADO'}
        </td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Espelho de Plantões - ${profNome}</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body { font-family: Arial, sans-serif; background: #fff; color: #000; padding: 15px; font-size: 11px; }
          .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-top: 15px; }
          th { background: #e2e8f0; border: 1px solid #000; padding: 6px 8px; text-transform: uppercase; font-size: 9.5px; }
          .summary { margin-top: 20px; border-top: 2px solid #000; padding-top: 10px; display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 style="font-size: 18px; text-transform: uppercase; margin: 0;">${hospitalName}</h1>
            <p style="margin: 3px 0;">ESPELHO INDIVIDUAL DE PLANTÕES • PRESTAÇÃO DE CONTAS</p>
            <p style="margin: 3px 0;">Profissional: <b>${profNome}</b> (ID: ${matricula})</p>
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
              <th style="width: 35%;">Setor / Posto</th>
              <th style="width: 20%; text-align: center;">Horário</th>
              <th style="width: 15%; text-align: center;">Duração</th>
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
          <span>Produção Apurada: ${formatCurrency(monthMetrics.valorBruto)}</span>
        </div>

        <div style="margin-top: 50px; display: flex; justify-content: space-around; text-align: center; font-size: 10px;">
          <div style="width: 220px; border-top: 1px solid #000; padding-top: 4px;">Assinatura do Profissional</div>
          <div style="width: 220px; border-top: 1px solid #000; padding-top: 4px;">Coordenação de Escala</div>
        </div>

        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans bg-slate-100 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      
      {/* 1. HERO BANNER PRINCIPAL */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-sky-400">
            <CalendarDays className="w-4 h-4" /> Painel Assistencial do Profissional
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            Olá, {currentProfessional?.name ? `Dr(a). ${currentProfessional.name.split(' ')[0]}` : user?.full_name || 'Profissional'}!
          </h1>
          <p className="text-xs md:text-sm text-slate-300 font-medium">
            Gerencie sua agenda de plantões, acompanhe seu repasse e solicite trocas rápidas.
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
            onClick={() => navigate('/mural')} 
            className="h-11 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs px-5 rounded-2xl shadow-lg gap-2 cursor-pointer transition-all hover:scale-105"
          >
            <Flame className="w-4 h-4" /> Mural de Oportunidades
          </Button>
        </div>
      </div>

      {/* 2. CARD DE PLANTÃO AO VIVO (SE ESTIVER EM JORNADA NESTE MOMENTO) */}
      {activeShiftNow && (
        <div className="p-6 rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/60 shadow-xl text-emerald-950 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-emerald-600 text-white font-bold shadow-md animate-pulse shrink-0">
              <Radio className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase px-3 py-1 rounded-full bg-emerald-600 text-white tracking-wider">
                  ● Plantão em Andamento
                </span>
                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {activeShiftNow.timeLeftDesc}
                </span>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1.5">
                {activeShiftNow.sectorName} • {activeShiftNow.start_time} às {activeShiftNow.end_time}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                Jornada de {activeShiftNow.duration}h computada no fechamento deste mês.
              </p>
            </div>
          </div>

          <div className="text-right shrink-0 bg-white/60 dark:bg-slate-900/60 p-4 rounded-2xl border border-emerald-500/30">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Diária Apurada</span>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {formatCurrency(remunConfig.valorPorPlantao)}
            </div>
          </div>
        </div>
      )}

      {/* 3. NOVO CAMPO: DESTAQUE DO PRÓXIMO PLANTÃO AGENDADO (MAIOR E VISÍVEL) */}
      {nextHighlightedShift && (
        <div className="rounded-3xl border border-sky-300 dark:border-sky-800 bg-gradient-to-r from-sky-50 via-white to-sky-50/50 dark:from-slate-900 dark:via-sky-950/30 dark:to-slate-900 p-6 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="p-4 rounded-2xl bg-sky-600 text-white font-black shadow-lg shadow-sky-600/30 shrink-0">
              <Zap className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Próximo Plantão Agendado
                </span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-mono">
                  {nextHighlightedShift.timeLeftDesc}
                </span>
              </div>

              <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                {nextHighlightedShift.sectorName}
              </h2>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300 font-medium">
                <span className="font-bold text-slate-900 dark:text-white">
                  📅 {formatDateBR(nextHighlightedShift.date)} ({new Date(nextHighlightedShift.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })})
                </span>
                <span>•</span>
                <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                  ⏰ {nextHighlightedShift.start_time} às {nextHighlightedShift.end_time} ({nextHighlightedShift.duration}h)
                </span>
                <span>•</span>
                <span>Diária Prevista: <b>{formatCurrency(remunConfig.valorPorPlantao)}</b></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button 
              onClick={() => handlePassShiftToMural(nextHighlightedShift)}
              variant="outline"
              className="h-10 text-xs font-black rounded-xl border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1.5"
            >
              <Flame className="w-4 h-4" /> Passar no Mural
            </Button>
          </div>
        </div>
      )}

      {/* 4. BARÔMETRO DE PRODUÇÃO & METAS DO MÊS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Plantões Cumpridos</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
            {monthMetrics.cumpridos} <span className="text-xs font-bold text-slate-400">/ 20 meta</span>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
            {monthMetrics.extrasQtd > 0 ? `+${monthMetrics.extrasQtd} plantões extras` : `${Math.max(0, 20 - monthMetrics.cumpridos)} para atingir a meta`}
          </p>
        </Card>

        <Card className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Horas Realizadas</span>
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
            {monthMetrics.horas}h <span className="text-xs font-bold text-slate-400">computadas</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-semibold">
            Em {monthMetrics.cumpridos} turnos finalizados
          </p>
        </Card>

        <Card className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Repasse Acumulado</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-3 font-mono">
            {formatCurrency(monthMetrics.valorBruto)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-semibold">
            {formatCurrency(remunConfig.valorPorPlantao)} por plantão dia
          </p>
        </Card>

        <Card className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Plantões a Realizar</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-3">
            {monthMetrics.futuros} <span className="text-xs font-bold text-slate-400">turnos</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-semibold">
            Programados na grade do mês
          </p>
        </Card>
      </div>

      {/* 5. MINHA GRADE EM ORDEM CRESCENTE (DO 1º AO ÚLTIMO DIA DO MÊS) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-sky-600" />
              Minha Grade Cronológica • {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Turnos organizados em ordem crescente por data e horário de execução.
            </p>
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1 rounded-2xl gap-2">
            <button 
              onClick={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))} 
              className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-500 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-black px-2 uppercase font-mono">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
            <button 
              onClick={() => setCurrentDate(new Date(currentYear, currentMonth + 1, 1))} 
              className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-500 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* LISTAGEM DOS PLANTÕES EM ORDEM CRESCENTE */}
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-sky-600" />
            Carregando sua grade pessoal de plantões...
          </div>
        ) : monthShiftsSortedAsc.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8">
            <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30 text-sky-600" />
            Você não possui plantões agendados para {MONTH_NAMES[currentMonth]} de {currentYear}.<br />
            Acesse o <b>Mural de Oportunidades</b> para assumir turnos disponíveis.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monthShiftsSortedAsc.map(shift => {
              const isConcluido = shift.state === 'concluido';
              const isAtivo = shift.state === 'ativo';

              return (
                <div 
                  key={shift.id} 
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                    isAtivo 
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-md ring-1 ring-emerald-500/40' 
                      : isConcluido
                      ? 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-75'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-sky-300'
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

                      <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                        isAtivo 
                          ? 'bg-emerald-600 text-white animate-pulse' 
                          : isConcluido
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          : 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                      }`}>
                        {isAtivo ? '● Ao Vivo' : isConcluido ? '✓ Concluído' : 'Programado'}
                      </span>
                    </div>

                    <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {shift.sectorName}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                      <span>Horário: <b>{shift.start_time} às {shift.end_time}</b></span>
                      <span>{shift.duration}h</span>
                    </div>

                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <DollarSign className="w-3.5 h-3.5" />
                      Valor: {formatCurrency(remunConfig.valorPorPlantao)}
                    </div>
                  </div>

                  {!isConcluido && !isAtivo && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handlePassShiftToMural(shift)}
                        className="h-8 text-[11px] font-bold border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl gap-1.5 cursor-pointer"
                      >
                        <Flame className="w-3.5 h-3.5" /> Passar no Mural
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}