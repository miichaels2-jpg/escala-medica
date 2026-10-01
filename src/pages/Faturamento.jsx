import { useState, useMemo, useEffect } from 'react';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  DollarSign, Search, Receipt, Send, ChevronLeft, ChevronRight, FileText, Printer, Download, AlertTriangle
} from 'lucide-react';

function safeNumber(val, fb = 0) {
  if (val === null || val === undefined || val === '') return fb;
  if (typeof val === 'number') return Number.isFinite(val) ? val : fb;
  let normalized = String(val).replace(/[R$\s]/g, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else {
    normalized = normalized.replace(',', '.');
  }
  if (!normalized) return fb;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fb;
}

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safeNumber(val));
}

function roundCurrency(val) {
  return Math.round((safeNumber(val) + Number.EPSILON) * 100) / 100;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function getShiftSchedule(shift) {
  const dateParts = String(shift?.date || '').split('T')[0].split('-').map(Number);
  if (dateParts.length !== 3 || dateParts.some(part => !Number.isFinite(part))) return null;
  const [year, month, day] = dateParts;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const parseTime = (value, fallback) => {
    const match = String(value || fallback).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes };
  };

  const startTime = parseTime(shift.start_time, '07:00');
  const endTime = parseTime(shift.end_time, '19:00');
  if (!startTime || !endTime) return null;

  const start = new Date(year, month - 1, day, startTime.hours, startTime.minutes);
  const end = new Date(year, month - 1, day, endTime.hours, endTime.minutes);
  if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) return null;
  if (end <= start) end.setDate(end.getDate() + 1);

  return { start, end, duration: (end.getTime() - start.getTime()) / 3_600_000 };
}

function isBillableShift(shift) {
  const status = normalizeText(shift?.status);
  const professionalName = normalizeText(shift?.professional_name || shift?.professional?.name || shift?.professionalName);
  if (!shift || status === 'cancelado' || status === 'vago' || status === 'vaga' || shift.is_open === true) return false;
  if (!shift.professional_id) return false;
  return !['vaga', 'aberto', 'descoberto', 'sem profissional', 'plantao sem profissional']
    .some(marker => professionalName.includes(marker));
}

export default function Faturamento() {
  const { shifts = [], professionals = [], sectors = [], company, selectedUnitId, units = [] } = useAppData();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfModal, setSelectedProfModal] = useState(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const [pagamentosStatus, setPagamentosStatus] = useState(() => {
    try { 
      const stored = window.localStorage.getItem('scale_faturamento_pagos');
      const parsed = stored ? JSON.parse(stored) : {};
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      console.warn('Não foi possível carregar os status de pagamento locais:', error);
      return {};
    }
  });

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const todayStr = getLocalDateString(now);

  const currentUnitObj = units.find(u => String(u.id) === String(selectedUnitId));
  const currentUnitName = currentUnitObj?.name || company?.name || 'Hospital Principal';

  const sectorMap = useMemo(() => {
    const m = {};
    (sectors || []).forEach(s => { if (s) m[String(s.id)] = s; });
    return m;
  }, [sectors]);

  function getProfMeta(prof) {
    if (!prof) return {};
    const serverMeta = [
      prof.data,
      prof.metadata
    ].filter(source => source && typeof source === 'object' && !Array.isArray(source));
    let localMeta = {};
    try {
      const stored = window.localStorage.getItem(`prof_meta_${prof.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) localMeta = parsed;
      }
    } catch (error) {
      console.warn(`Não foi possível carregar os dados locais do profissional ${prof.id}:`, error);
    }
    return Object.assign({}, localMeta, ...serverMeta);
  }

  const handleTogglePago = (profId) => {
    setPagamentosStatus(prev => {
      const key = `${profId}_${monthPrefix}`;
      const nextState = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem('scale_faturamento_pagos', JSON.stringify(nextState));
      } catch (error) {
        console.warn('Não foi possível salvar o status de pagamento neste navegador:', error);
      }
      return nextState;
    });
  };

  const reportData = useMemo(() => {
    const profsSummary = {};

    (professionals || []).forEach(p => {
      if (!p) return;
      const meta = getProfMeta(p);

      const remunType = meta.remuneration_type || p.remuneration_type || 'plantao';
      const unitRates = meta.unit_rates || {};
      
      const salaryBase = safeNumber(meta.monthly_salary !== undefined ? meta.monthly_salary : p.monthly_salary, 0);
      const taxRate = meta.coop_tax_rate ?? p.coop_tax_rate ?? 0;
      const matricula = meta.registration_id || p.registration_id || 'MAT-XXXX';
      const chavePix = (meta.pix_key || p.pix_key || '').trim();
      const pixTipo = meta.pix_type || p.pix_type || 'CPF';
      const banco = (meta.bank_info || p.bank_info || '').trim();

      profsSummary[String(p.id)] = {
        prof: p,
        profStatus: normalizeText(p.status || meta.status || 'ativo'),
        matricula,
        chavePix,
        pixTipo,
        banco,
        remunType,
        salarioBaseContratual: salaryBase,
        unitRates,
        taxRate: safeNumber(taxRate),
        plantõesRealizados: 0,
        horasRealizadas: 0,
        valorApuradoPlantões: 0, // Novo acumulador
        plantõesSemTarifa: 0,
        plantõesFuturos: 0,
        plantõesList: []
      };
    });

    (shifts || []).forEach(shift => {
      if (!shift) return;
      if (String(shift.unit_id) !== String(selectedUnitId)) return;
      const shiftDate = String(shift.date || '').split('T')[0];
      if (!shiftDate.startsWith(monthPrefix) || !isBillableShift(shift)) return;

      const pId = String(shift.professional_id);
      if (profsSummary[pId]) {
        const schedule = getShiftSchedule(shift);
        if (!schedule) return;
        const status = normalizeText(shift.status);
        const isRealizado = ['realizado', 'concluido', 'concluida'].includes(status) || schedule.end <= now;
        const profRef = profsSummary[pId];

        let valorDoPlantaoAtual = 0;
        let tarifaPendente = false;
        if (profRef.remunType === 'plantao') {
          const rates = profRef.unitRates[String(shift.unit_id)] || {};
          const d = new Date(`${shiftDate}T12:00:00`);
          const isFds = d.getDay() === 0 || d.getDay() === 6;
          const startTime = shift.start_time || '07:00';
          const isNight = normalizeText(shift.shift_type) === 'noturno' || startTime >= '18:00' || startTime < '06:00';
          const rate = isFds ? rates.fds : (isNight ? rates.noturno : rates.diurno);
          tarifaPendente = rate === undefined || rate === null || rate === '';
          valorDoPlantaoAtual = tarifaPendente ? 0 : safeNumber(rate);
        }

        if (isRealizado) {
          profRef.plantõesRealizados += 1;
          profRef.horasRealizadas += Math.round(schedule.duration * 10) / 10;
          profRef.valorApuradoPlantões += valorDoPlantaoAtual;
          if (tarifaPendente && profRef.remunType === 'plantao') profRef.plantõesSemTarifa += 1;
        } else {
          profRef.plantõesFuturos += 1;
        }

        profRef.plantõesList.push({
          ...shift,
          duration: Math.round(schedule.duration * 10) / 10,
          valorAplicado: valorDoPlantaoAtual,
          tarifaPendente,
          isRealizado
        });
      }
    });

    return Object.values(profsSummary).map(item => {
      let valorBrutoTotal = 0;

      if (monthPrefix > todayStr.substring(0, 7)) {
        valorBrutoTotal = 0;
      } else {
        if (item.remunType === 'mensal') {
          valorBrutoTotal = item.salarioBaseContratual;
        } else if (item.remunType === 'produtividade') {
          valorBrutoTotal = 0; // Calculado externamente ou via lançamento avulso
        } else {
          // 'plantao': O bruto é a soma exata do que foi apurado no laço acima
          valorBrutoTotal = item.valorApuradoPlantões;
        }
      }

      valorBrutoTotal = roundCurrency(valorBrutoTotal);
      const valorDesconto = roundCurrency((valorBrutoTotal * item.taxRate) / 100);
      const valorLiquido = roundCurrency(valorBrutoTotal - valorDesconto);
      const isPago = pagamentosStatus[`${item.prof.id}_${monthPrefix}`] || false;

      return {
        ...item,
        valorBruto: valorBrutoTotal,
        valorDesconto,
        valorLiquido,
        isPago
      };
    }).filter(item =>
      item.plantõesRealizados > 0 ||
      item.plantõesFuturos > 0 ||
      (item.remunType === 'mensal' && item.profStatus === 'ativo')
    );
  }, [professionals, shifts, monthPrefix, selectedUnitId, pagamentosStatus, todayStr, now]);

  const filteredReport = useMemo(() => {
    const term = normalizeText(searchQuery);
    return reportData.filter(item => {
      if (!term) return true;
      const nome = normalizeText(item.prof.name);
      const doc = normalizeText(item.prof.document);
      const mat = normalizeText(item.matricula);
      return nome.includes(term) || doc.includes(term) || mat.includes(term);
    });
  }, [reportData, searchQuery]);

  const filteredTotals = useMemo(() => filteredReport.reduce((summary, item) => ({
    bruto: summary.bruto + item.valorBruto,
    liquido: summary.liquido + item.valorLiquido,
    plantões: summary.plantões + item.plantõesRealizados,
    horas: summary.horas + item.horasRealizadas
  }), { bruto: 0, liquido: 0, plantões: 0, horas: 0 }), [filteredReport]);

  const shiftsWithoutProfessional = useMemo(() => {
    const professionalIds = new Set((professionals || []).map(prof => String(prof?.id)));
    return (shifts || []).filter(shift => {
      const shiftDate = String(shift?.date || '').split('T')[0];
      return shift &&
        String(shift.unit_id) === String(selectedUnitId) &&
        shiftDate.startsWith(monthPrefix) &&
        isBillableShift(shift) &&
        !professionalIds.has(String(shift.professional_id));
    }).length;
  }, [professionals, shifts, monthPrefix, selectedUnitId]);

  const shiftsWithInvalidSchedule = useMemo(() => (shifts || []).filter(shift => {
    const shiftDate = String(shift?.date || '').split('T')[0];
    return shift &&
      String(shift.unit_id) === String(selectedUnitId) &&
      shiftDate.startsWith(monthPrefix) &&
      isBillableShift(shift) &&
      !getShiftSchedule(shift);
  }).length, [shifts, monthPrefix, selectedUnitId]);

  const shiftsWithoutRate = reportData.reduce((total, item) => total + item.plantõesSemTarifa, 0);
  const paymentSummary = useMemo(() => reportData.reduce((summary, item) => {
    const bucket = item.isPago ? 'paid' : 'pending';
    summary[bucket].count += 1;
    summary[bucket].net += item.valorLiquido;
    return summary;
  }, { paid: { count: 0, net: 0 }, pending: { count: 0, net: 0 } }), [reportData]);

  const totals = useMemo(() => {
    let bruto = 0, liquido = 0, plantões = 0, horas = 0;
    reportData.forEach(i => {
      bruto += i.valorBruto;
      liquido += i.valorLiquido;
      plantões += i.plantõesRealizados;
      horas += i.horasRealizadas;
    });
    return { bruto, liquido, plantões, horas };
  }, [reportData]);

  // =========================================================================
  // EXPORTAÇÃO EXCEL NATIVA (COM ESTILOS CONTÁBEIS E DE TEMPO)
  // =========================================================================
  const handleExportExcel = () => {
    if (filteredReport.length === 0) return alert('Não há dados para exportar neste mês.');

    const hospitalName = currentUnitName;
    const competencia = `${MONTH_NAMES[currentMonth]} / ${currentYear}`;
    const emissao = new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR');

    const formatHourForExcel = (num) => {
      const h = Math.floor(safeNumber(num));
      const m = Math.round((safeNumber(num) - h) * 60);
      return `${h}:${String(m).padStart(2, '0')}`;
    };

    const rowsHtml = filteredReport.map(item => {
      const formaPagamento = item.chavePix ? `PIX (${item.pixTipo}): ${item.chavePix}` : (item.banco ? `Banco: ${item.banco}` : 'Pendente de Cadastro');
      const regime = item.remunType === 'mensal' ? 'Fixo Mensal' : item.remunType === 'produtividade' ? 'Produtividade' : 'Por Plantão (Tabela)';

      return `
        <tr>
          <td style="border: 1px solid #cbd5e1;">${item.prof.name}</td>
          <td style="border: 1px solid #cbd5e1; mso-number-format:'\\@';">${item.matricula}</td>
          <td style="border: 1px solid #cbd5e1;">${item.prof.specialty || 'Geral'}</td>
          <td style="border: 1px solid #cbd5e1;">${regime}</td>
          <td class="num" style="border: 1px solid #cbd5e1;">${item.plantõesRealizados}</td>
          <td class="time" style="border: 1px solid #cbd5e1;">${formatHourForExcel(item.horasRealizadas)}</td>
          <td class="money" style="border: 1px solid #cbd5e1;">${item.valorBruto.toFixed(2).replace('.', ',')}</td>
          <td class="money" style="border: 1px solid #cbd5e1; color: #ef4444;">${item.valorDesconto.toFixed(2).replace('.', ',')}</td>
          <td class="money" style="border: 1px solid #cbd5e1; font-weight: bold; color: #059669;">${item.valorLiquido.toFixed(2).replace('.', ',')}</td>
          <td style="border: 1px solid #cbd5e1; mso-number-format:'\\@';">${formaPagamento}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: ${item.isPago ? '#059669' : '#f59e0b'};">${item.isPago ? 'PAGO' : 'Pendente'}</td>
        </tr>
      `;
    }).join('');

    const htmlTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
          th { background-color: #1e293b; color: #ffffff; border: 1px solid #cbd5e1; font-weight: bold; text-align: center; padding: 10px; }
          td { padding: 6px; vertical-align: middle; }
          .money { mso-number-format: "_-\\[\\$R\\$-pt-BR\\]\\* \\#\\,\\#\\#0\\.00_-"; text-align: right; }
          .time { mso-number-format: "\\[h\\]\\:mm"; text-align: center; font-weight: bold; }
          .num { mso-number-format: "0"; text-align: center; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="11" style="font-size: 20px; font-weight: bold; text-align: center; background-color: #0f172a; color: #ffffff; padding: 12px;">${hospitalName}</td>
          </tr>
          <tr>
            <td colspan="11" style="font-size: 14px; font-weight: bold; text-align: center; background-color: #1e293b; color: #94a3b8; padding: 6px;">RELATÓRIO OFICIAL DE FATURAMENTO E REPASSE</td>
          </tr>
          <tr>
            <td colspan="5" style="font-weight: bold; padding: 10px 0;">Competência Mês: ${competencia}</td>
            <td colspan="6" style="text-align: right; padding: 10px 0;">Emissão do Relatório: ${emissao}</td>
          </tr>
          <tr><td colspan="11" style="padding-bottom: 8px;">Busca: ${searchQuery.trim() || 'Todos os profissionais'}</td></tr>
          <tr><td colspan="11"></td></tr>
          <tr>
            <th>Profissional</th>
            <th>Matrícula</th>
            <th>Especialidade</th>
            <th>Regime Contratual</th>
            <th>Plantões Cumpridos</th>
            <th>Horas Totais</th>
            <th>Valor Bruto (R$)</th>
            <th>Descontos/Taxa (R$)</th>
            <th>Valor Líquido (R$)</th>
            <th>Dados p/ Pagamento</th>
            <th>Status do Repasse</th>
          </tr>
          ${rowsHtml}
          <tr><td colspan="11"></td></tr>
          <tr>
            <td colspan="4" style="font-weight: bold; text-align: right; padding: 8px;">TOTAIS DOS PROFISSIONAIS LISTADOS:</td>
            <td class="num" style="font-weight: bold; border: 1px solid #000; background-color: #f8fafc;">${filteredTotals.plantões}</td>
            <td class="time" style="font-weight: bold; border: 1px solid #000; background-color: #f8fafc;">${formatHourForExcel(filteredTotals.horas)}</td>
            <td class="money" style="font-weight: bold; border: 1px solid #000; background-color: #f8fafc;">${filteredTotals.bruto.toFixed(2).replace('.', ',')}</td>
            <td class="money" style="font-weight: bold; border: 1px solid #000; background-color: #f8fafc; color: #ef4444;">${(filteredTotals.bruto - filteredTotals.liquido).toFixed(2).replace('.', ',')}</td>
            <td class="money" style="font-weight: bold; border: 1px solid #000; background-color: #f8fafc; color: #059669; font-size: 14px;">${filteredTotals.liquido.toFixed(2).replace('.', ',')}</td>
            <td colspan="2"></td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Fechamento_Honorarios_${currentUnitName.replace(/[^a-zA-Z0-9]/g, '_')}_${monthPrefix}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintConsolidatedReport = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      alert('Permita os pop-ups para abrir o relatório.');
      return;
    }

    const hospitalName = currentUnitName;
    const logoLetter = hospitalName[0] || 'H';
    const competencia = `${MONTH_NAMES[currentMonth]} / ${currentYear}`;
    const emissao = new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR');

    const companyLogoHtml = company?.logo_url ? `<img src="${company.logo_url}" style="max-height: 55px; max-width: 140px; object-fit: contain; margin-right: 15px;" />` : `<div class="logo-badge">${logoLetter}</div>`;
    const unitLogoHtml = currentUnitObj?.logo_url ? `<img src="${currentUnitObj.logo_url}" style="max-height: 55px; max-width: 140px; object-fit: contain; margin-left: 15px; border-left: 2px solid #eee; padding-left: 15px;" />` : '';

    const rowsHtml = filteredReport.map((item, idx) => {
      const formaPagto = item.chavePix ? `PIX: ${item.chavePix}` : (item.banco ? `Banco: ${item.banco}` : 'Pendente');
      const statusPago = item.isPago ? `<span style="color: #166534; font-weight: bold;">[ PAGO ]</span>` : `<span style="color: #64748b;">Pendente</span>`;
      const regime = item.remunType === 'mensal' ? 'Fixo Mensal' : item.remunType === 'produtividade' ? 'Produtividade' : 'Por Plantão';

      return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
          <td style="border: 1px solid #111; padding: 6px 8px; font-weight: bold;">${item.prof.name}</td>
          <td style="border: 1px solid #111; padding: 6px 8px; font-family: monospace;">${item.matricula}</td>
          <td style="border: 1px solid #111; padding: 6px 8px;">${item.prof.specialty || 'Geral'}</td>
          <td style="border: 1px solid #111; padding: 6px 8px; font-size: 9px;">${regime}</td>
          <td style="border: 1px solid #111; padding: 6px 8px; text-align: center;">${item.plantõesRealizados}</td>
          <td style="border: 1px solid #111; padding: 6px 8px; font-family: monospace; font-size: 9px;">${formaPagto}</td>
          <td style="border: 1px solid #111; padding: 6px 8px; text-align: right;">${formatCurrency(item.valorBruto)}</td>
          <td style="border: 1px solid #111; padding: 6px 8px; text-align: right; font-weight: bold;">${formatCurrency(item.valorLiquido)}</td>
          <td style="border: 1px solid #111; padding: 6px 8px; text-align: center;">${statusPago}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Fechamento de Honorários - ${competencia}</title>
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, Helvetica, sans-serif; background: #ffffff !important; color: #000 !important; padding: 15px; font-size: 11px; }
          .header-box { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 15px; }
          .logo-badge { width: 55px; height: 55px; border: 2px solid #000; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 900; margin-right: 15px; }
          .header-info h1 { font-size: 18px; text-transform: uppercase; font-weight: 900; margin-bottom: 2px; }
          table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 20px; font-size: 10px; }
          th { background: #f3f4f6; border: 1px solid #000; padding: 6px 8px; text-transform: uppercase; font-size: 9px; text-align: left; }
          .totals { display: flex; justify-content: flex-end; gap: 30px; font-size: 12px; margin-top: 10px; font-weight: bold; border-top: 2px solid #000; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div style="display: flex; align-items: center;">
            ${companyLogoHtml}
            ${unitLogoHtml}
            <div class="header-info" style="${unitLogoHtml ? 'margin-left: 15px;' : ''}">
              <h1>${hospitalName}</h1>
              <p>FECHAMENTO DE HONORÁRIOS E REPASSE DE PLANTÕES REALIZADOS</p>
              <div style="margin-top: 4px;">Competência: <b>${competencia}</b></div>
            </div>
          </div>
          <div style="text-align: right; font-size: 9.5px;">
            <div style="border: 1px solid #000; padding: 3px 8px; font-weight: 900; display: inline-block;">DOCUMENTO OFICIAL AUDITÁVEL</div>
            <div style="margin-top: 4px;">Emissão: ${emissao}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Profissional</th>
              <th>Matrícula</th>
              <th>Especialidade</th>
              <th>Regime</th>
              <th style="text-align: center;">Plantões Efetivados</th>
              <th>Dados p/ Pagamento</th>
              <th style="text-align: right;">Bruto Apurado</th>
              <th style="text-align: right;">Líquido a Pagar</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>

        <div class="totals">
          <span>Plantões Cumpridos: ${filteredTotals.plantões}</span>
          <span>Total Bruto: ${formatCurrency(filteredTotals.bruto)}</span>
          <span style="color: #000;">TOTAL LÍQUIDO DOS PROFISSIONAIS LISTADOS: ${formatCurrency(filteredTotals.liquido)}</span>
        </div>

        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintIndividualReceipt = (item) => {
    const printWindow = window.open('', '_blank', 'width=900,height=850');
    if (!printWindow) {
      alert('Permita os pop-ups para abrir o recibo.');
      return;
    }

    const hospitalName = currentUnitName;
    const competencia = `${MONTH_NAMES[currentMonth]} / ${currentYear}`;
    const emissao = new Date().toLocaleDateString('pt-BR');

    let dadosPagamentoHtml = '';
    if (item.chavePix && item.banco) {
      dadosPagamentoHtml = `
        <div class="grid"><span>Chave PIX (${item.pixTipo}):</span> <span>${item.chavePix}</span></div>
        <div class="grid"><span>Dados Bancários Físicos:</span> <span>${item.banco}</span></div>
      `;
    } else if (item.chavePix) {
      dadosPagamentoHtml = `<div class="grid"><span>Chave PIX (${item.pixTipo}):</span> <span>${item.chavePix}</span></div>`;
    } else if (item.banco) {
      dadosPagamentoHtml = `<div class="grid"><span>Dados Bancários Físicos:</span> <span>${item.banco}</span></div>`;
    } else {
      dadosPagamentoHtml = `<div class="grid"><span style="color: #b91c1c; font-weight: bold;">Forma de Pagamento:</span> <span style="color: #b91c1c;">Pendente de cadastro</span></div>`;
    }

    const regimeLabel = item.remunType === 'mensal' ? 'Fixo Mensal' : item.remunType === 'produtividade' ? 'Comissionamento/Produtividade' : 'Plantão Dinâmico';

    const templateVia = (tituloVia) => `
      <div class="via-box">
        <div class="header">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h1>${hospitalName}</h1>
              <p>{item.isPago ? 'RECIBO DE HONORÁRIOS & REPASSE MÉDICO' : 'DEMONSTRATIVO DE HONORÁRIOS A PAGAR'}</p>
              <p style="font-size: 9.5px; margin-top: 2px;">Competência: <b>${competencia}</b></p>
            </div>
            <div style="text-align: right;">
              <span class="via-tag">${tituloVia}</span>
              <div style="font-size: 8.5px; color: #555; margin-top: 3px;">Data: ${emissao}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="grid"><span>Profissional:</span> <span>${item.prof.name} (ID: ${item.matricula})</span></div>
          <div class="grid"><span>Documento / Especialidade:</span> <span>${item.prof.document || 'CRM'} • ${item.prof.specialty || 'Geral'}</span></div>
          <div class="grid"><span>Regime de Contratação:</span> <span>${regimeLabel}</span></div>
          <div class="grid"><span>Plantões Cumpridos no Período:</span> <span>${item.plantõesRealizados} plantões (${item.horasRealizadas}h computadas)</span></div>
        </div>

        <div class="val-box">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>Valor Bruto: <b>${formatCurrency(item.valorBruto)}</b></span>
            <span>Retenção/Taxa: <b>- ${formatCurrency(item.valorDesconto)}</b></span>
            <span style="color: #000; font-size: 13px;">LÍQUIDO A RECEBER: <b>${formatCurrency(item.valorLiquido)}</b></span>
          </div>
        </div>

        <div class="section" style="margin-top: 6px;">
          ${dadosPagamentoHtml}
        </div>

        <p class="termo">
          ${item.isPago
            ? `Declaro ter recebido da instituição ${hospitalName} a quantia líquida discriminada acima, correspondente à quitação integral dos serviços profissionais prestados no período de ${competencia}, dando plena e geral quitação.`
            : `Demonstrativo dos valores apurados pelos serviços profissionais prestados no período de ${competencia}. Este documento não comprova pagamento ou quitação.`
          }
        </p>

        <div class="signatures">
          <div class="sig-col">
            <div class="sig-line"></div>
            <span>${hospitalName}</span>
          </div>
          <div class="sig-col">
            <div class="sig-line"></div>
            <span>${item.prof.name}</span>
          </div>
        </div>
      </div>
    `;

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>${item.isPago ? 'Recibo Oficial' : 'Demonstrativo de Honorários'} - ${item.prof.name}</title>
        <style>
          @page { size: A4 portrait; margin: 8mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, Helvetica, sans-serif; background: #ffffff !important; color: #000000 !important; padding: 5px; font-size: 10px; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .via-box { border: 1.5px solid #000; padding: 14px 18px; border-radius: 4px; height: 47%; display: flex; flex-direction: column; justify-content: space-between; background: #fff; }
          .header { border-bottom: 1.5px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
          .header h1 { font-size: 15px; text-transform: uppercase; font-weight: 900; }
          .header p { font-size: 9px; font-weight: bold; }
          .via-tag { border: 1px solid #000; padding: 2px 6px; font-weight: 900; font-size: 8.5px; text-transform: uppercase; background: #f3f4f6; }
          .section { margin-bottom: 6px; }
          .grid { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 9.5px; }
          .grid span:last-child { font-weight: bold; }
          .val-box { background: #f3f4f6; border: 1px solid #000; padding: 7px 10px; font-size: 11px; margin: 8px 0; }
          .termo { font-size: 8px; color: #333; text-align: justify; margin: 8px 0; line-height: 1.25; }
          .signatures { display: flex; justify-content: space-around; margin-top: 24px; text-align: center; }
          .sig-col { width: 220px; }
          .sig-line { border-top: 1px solid #000; margin-bottom: 3px; }
          .cut-divider { border-top: 1.5px dashed #666; margin: 14px 0; text-align: center; position: relative; height: 12px; }
          .cut-divider span { position: relative; top: -8px; background: #fff; padding: 0 10px; font-size: 8px; color: #666; text-transform: uppercase; font-weight: bold; }
        </style>
      </head>
      <body>
        ${templateVia('1ª VIA - INSTITUIÇÃO')}
        
        <div class="cut-divider">
          <span>✂ CORTE AQUI ✂</span>
        </div>

        ${templateVia('2ª VIA - PROFISSIONAL')}

        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleSendStatementWhatsApp = (item) => {
    const cleanPhone = String(item.prof.phone || '').replace(/\D/g, '');
    if (!cleanPhone) { alert('Profissional não possui telefone cadastrado.'); return; }
    const phoneWithDDI = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    const dadosPgto = item.chavePix ? `• Chave PIX: ${item.chavePix} (${item.pixTipo})` : (item.banco ? `• Conta: ${item.banco}` : `• Dados de Pagamento: Pendente`);
    const regimeLabel = item.remunType === 'mensal' ? 'Fixo Mensal' : item.remunType === 'produtividade' ? 'Produtividade' : 'Plantão Dinâmico';

    const msg = [
      `*ScaleMedic - Extrato de Honorários & Repasse* 🏥`,
      `Competência: *${MONTH_NAMES[currentMonth]} / ${currentYear}*`,
      `Profissional: *${item.prof.name}* (ID: ${item.matricula})\n`,
      `📊 *Demonstrativo de Produção:*`,
      `• Regime: ${regimeLabel}`,
      `• Plantões Cumpridos: ${item.plantõesRealizados} plantões (${item.horasRealizadas}h totais)\n`,
      `💰 *Valores Apurados:*`,
      `• Valor Bruto Apurado: ${formatCurrency(item.valorBruto)}`,
      `• Retenções/Impostos: ${formatCurrency(item.valorDesconto)}`,
      `• *VALOR LÍQUIDO A RECEBER:* ${formatCurrency(item.valorLiquido)}\n`,
      `💳 *Forma de Repasse:*`,
      `${dadosPgto}\n`,
      `_Por favor, confira seu demonstrativo. Havendo divergência, contate a coordenação médica._`
    ].filter(Boolean).join('\n');

    window.open(`https://api.whatsapp.com/send?phone=${phoneWithDDI}&text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans bg-slate-100 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      
      {/* BANNER PRINCIPAL */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <DollarSign className="w-4 h-4" /> Gestão Financeira & Conciliação de Plantões
          </div>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black">Faturamento & Repasse</h2>
          <p className="text-xs text-slate-300">
            Apuração inteligente baseada na matriz de remuneração (Fixo, Produtividade ou Plantão Dinâmico).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            onClick={handleExportExcel}
            className="h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-4 rounded-2xl shadow-lg gap-2 cursor-pointer transition-all"
            title="Baixar Relatório em Excel (Abre formatado no Excel)"
          >
            <Download className="w-4 h-4" /> Exportar Planilha (.xls)
          </Button>

          <Button 
            onClick={handlePrintConsolidatedReport}
            className="h-10 bg-white text-slate-900 hover:bg-slate-100 font-black text-xs px-4 rounded-2xl shadow-lg gap-2 cursor-pointer transition-all"
          >
            <Printer className="w-4 h-4" /> Imprimir Fechamento
          </Button>

          <div className="flex items-center bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl gap-2">
            <button onClick={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))} className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-black px-2 uppercase cursor-default">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
            <button onClick={() => setCurrentDate(new Date(currentYear, currentMonth + 1, 1))} className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* CARDS EXECUTIVOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black uppercase text-slate-400">Total Bruto Apurado</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatCurrency(totals.bruto)}</div>
          <span className="text-[10px] text-slate-500 font-semibold">{totals.plantões} plantões concluídos · inclui fixo mensal</span>
        </Card>

        <Card className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Total Líquido p/ Repasse</span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(totals.liquido)}</div>
          <span className="text-[10px] text-slate-500 font-semibold">Valor acumulado na competência</span>
        </Card>

        <Card className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black uppercase text-sky-600 dark:text-sky-400">Horas de plantões concluídos</span>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">{totals.horas.toFixed(1).replace('.', ',')}h</div>
          <span className="text-[10px] text-slate-500 font-semibold">Horas assistenciais efetivadas</span>
        </Card>

        <Card className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">Profissionais na competência</span>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{reportData.length}</div>
          <span className="text-[10px] text-slate-500 font-semibold">Com plantões ou regime mensal</span>
        </Card>
      </div>

      {(shiftsWithoutRate > 0 || shiftsWithoutProfessional > 0 || shiftsWithInvalidSchedule > 0) && (
        <Card className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1">
              <h3 className="text-sm font-black text-amber-900 dark:text-amber-300">Verifique os dados antes de fechar o repasse</h3>
              {shiftsWithoutRate > 0 && (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  {shiftsWithoutRate} plantão(ões) realizado(s) sem tarifa cadastrada na unidade. Esses valores aparecem como R$ 0,00 e deixam o total bruto incompleto.
                </p>
              )}
              {shiftsWithoutProfessional > 0 && (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  {shiftsWithoutProfessional} plantão(ões) da competência apontam para um profissional que não foi localizado no Corpo Clínico e não entraram na conciliação.
                </p>
              )}
              {shiftsWithInvalidSchedule > 0 && (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  {shiftsWithInvalidSchedule} plantão(ões) têm data ou horário inválido e foram excluídos da apuração de horas.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-950/20">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Marcado como pago</p>
            <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-300/80">{paymentSummary.paid.count} profissional(is)</p>
          </div>
          <strong className="text-lg font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(paymentSummary.paid.net)}</strong>
        </Card>
        <Card className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-950/20">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-amber-700 dark:text-amber-400">Pendente de pagamento</p>
            <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-300/80">{paymentSummary.pending.count} profissional(is)</p>
          </div>
          <strong className="text-lg font-black text-amber-700 dark:text-amber-300">{formatCurrency(paymentSummary.pending.net)}</strong>
        </Card>
      </div>

      {/* TABELA DE CONCILIAÇÃO FINANCEIRA COM STATUS DE PAGAMENTO */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Espelho de Conciliação Financeira</h3>
            <p className="text-xs text-slate-500">Apuração restrita para <b>{currentUnitName}</b>. O status de pagamento é salvo neste navegador.</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="Buscar por médico ou matrícula..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="pl-9 h-9 text-xs" 
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 uppercase text-[10px] font-black border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Profissional / Matrícula</th>
                <th className="py-3 px-4">Regime Contratual</th>
                <th className="py-3 px-4 text-center">Volume Apurado</th>
                <th className="py-3 px-4">Dados p/ Repasse</th>
                <th className="py-3 px-4 text-right">Líquido a Pagar</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredReport.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    Nenhum profissional com produção na unidade atual para esta competência.
                  </td>
                </tr>
              ) : (
                filteredReport.map(item => {
                  const formaPagto = item.chavePix ? (
                    <div><span className="text-sky-600 font-bold">{item.chavePix}</span><div className="text-[9px] text-slate-400">PIX ({item.pixTipo})</div></div>
                  ) : item.banco ? (
                    <div><span className="text-slate-800 dark:text-slate-200 font-bold">{item.banco}</span><div className="text-[9px] text-slate-400">Dados Bancários</div></div>
                  ) : (
                    <span className="text-[10px] text-rose-500 italic">Pendente de cadastro</span>
                  );

                  const regimeBadge = item.remunType === 'mensal' 
                    ? <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold text-[10px]">Fixo Mensal</span> 
                    : item.remunType === 'produtividade'
                    ? <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md font-bold text-[10px]">Produtividade</span>
                    : <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md font-bold text-[10px]">Por Plantão</span>;

                  return (
                    <tr key={item.prof.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-black text-slate-900 dark:text-white">{item.prof.name}</div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono font-bold">
                          <span className="text-indigo-600 dark:text-indigo-400">{item.matricula} • {item.prof.document || 'CRM'}</span>
                          {item.profStatus && item.profStatus !== 'ativo' && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-sans text-[9px] uppercase text-slate-500 dark:bg-slate-800">{item.profStatus} · com registro</span>}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {regimeBadge}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-slate-900 dark:text-white">{item.plantõesRealizados} plantões</span>
                        <div className="text-[10px] font-mono text-slate-400">{item.horasRealizadas.toFixed(1).replace('.', ',')}h totais</div>
                      </td>

                      <td className="py-3 px-4 font-mono">
                        {formaPagto}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(item.valorLiquido)}
                        </span>
                        {item.taxRate > 0 && <div className="text-[9px] text-rose-500">-{item.taxRate}% retenção</div>}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button 
                          onClick={() => handleTogglePago(item.prof.id)}
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all border ${
                            item.isPago 
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800' 
                              : 'bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {item.isPago ? '✓ Pago' : 'Pendente'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handlePrintIndividualReceipt(item)}
                            title={item.isPago ? 'Imprimir recibo em 2 vias' : 'Imprimir demonstrativo; não comprova pagamento'}
                            className="h-8 text-xs font-bold gap-1 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-white cursor-pointer"
                          >
                            <Receipt className="w-3.5 h-3.5 text-emerald-600" /> {item.isPago ? 'Recibo' : 'Demonstrativo'}
                          </Button>

                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setSelectedProfModal(item)}
                            className="h-8 text-xs font-bold gap-1 rounded-xl cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-sky-600" /> Detalhar
                          </Button>

                          {item.prof.phone && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleSendStatementWhatsApp(item)}
                              title="Enviar Extrato no WhatsApp"
                              className="h-8 px-2.5 rounded-xl border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE DETALHAMENTO */}
      <Dialog open={!!selectedProfModal} onOpenChange={() => setSelectedProfModal(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-950 text-slate-900 dark:text-white border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-slate-900 dark:text-white">
              <Receipt className="w-5 h-5 text-emerald-600" />
              Espelho de Produção • {selectedProfModal?.prof.name}
            </DialogTitle>
          </DialogHeader>

          {selectedProfModal && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Matrícula ID</span>
                  <strong className="font-mono text-sm text-indigo-600 dark:text-indigo-400">{selectedProfModal.matricula}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Regime Contratual</span>
                  <strong className="text-xs text-slate-900 dark:text-white block uppercase">
                    {selectedProfModal.remunType === 'mensal' ? 'Fixo Mensal' : selectedProfModal.remunType === 'produtividade' ? 'Produtividade' : 'Plantão Dinâmico'}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Plantões Realizados</span>
                  <strong className="text-sm">{selectedProfModal.plantõesRealizados} plantões</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Líquido Apurado</span>
                  <strong className="text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedProfModal.valorLiquido)}</strong>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-black uppercase text-slate-500 text-[11px] block">Extrato de Plantões (Realizados vs Programados)</span>
                <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedProfModal.plantõesList.length === 0 ? (
                    <div className="p-4 text-center text-slate-400">Nenhum plantão localizado na grade deste mês.</div>
                  ) : (
                    selectedProfModal.plantõesList.map(p => (
                      <div key={p.id} className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-900/50 gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {new Date(p.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${p.isRealizado ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                              {p.isRealizado ? 'Realizado' : 'A Realizar'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">{sectorMap[p.sector_id]?.name || 'Setor'} • {p.start_time} às {p.end_time}</span>
                        </div>
                        
                        <div className="flex items-center gap-3 justify-between sm:justify-end">
                          {selectedProfModal.remunType === 'plantao' && p.isRealizado && (
                            <span className={`text-[10px] font-bold ${p.tarifaPendente ? 'text-amber-600' : 'text-slate-500'}`}>
                              {p.tarifaPendente ? 'Tarifa não cadastrada' : `Apurado: ${formatCurrency(p.valorAplicado)}`}
                            </span>
                          )}
                          <span className="font-mono font-bold text-sky-600 bg-sky-50 dark:bg-sky-950/30 px-2 py-1 rounded-lg">
                            {p.duration}h
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => handlePrintIndividualReceipt(selectedProfModal)}
                  className="h-9 text-xs font-black gap-1.5 cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5 text-emerald-600" /> {selectedProfModal.isPago ? 'Imprimir recibo' : 'Imprimir demonstrativo'}
                </Button>
                
                <Button onClick={() => handleSendStatementWhatsApp(selectedProfModal)} className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 gap-2 cursor-pointer">
                  <Send className="w-3.5 h-3.5" /> Enviar WhatsApp
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}