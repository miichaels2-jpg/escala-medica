import React, { useState, useMemo } from 'react';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  DollarSign, Search, Receipt, Send, ChevronLeft, ChevronRight, FileText, Printer, PlusCircle, CheckCircle2, Download
} from 'lucide-react';

function safeNumber(val, fb = 0) {
  if (val === null || val === undefined || val === '') return fb;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : fb;
}

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safeNumber(val));
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

export default function Faturamento() {
  const { shifts = [], professionals = [], sectors = [], company, selectedUnitId, units = [] } = useAppData();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfModal, setSelectedProfModal] = useState(null);

  const [pagamentosStatus, setPagamentosStatus] = useState(() => {
    try { 
      const stored = window.localStorage.getItem('scale_faturamento_pagos');
      return stored ? JSON.parse(stored) : {}; 
    } catch { return {}; }
  });

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const todayStr = getLocalDateString(new Date());

  const currentUnitObj = units.find(u => String(u.id) === String(selectedUnitId));
  const currentUnitName = currentUnitObj?.name || company?.name || 'Hospital Principal';

  const sectorMap = useMemo(() => {
    const m = {};
    (sectors || []).forEach(s => { if (s) m[String(s.id)] = s; });
    return m;
  }, [sectors]);

  function getProfMeta(prof) {
    if (!prof) return {};
    try {
      const stored = window.localStorage.getItem(`prof_meta_${prof.id}`);
      if (stored) return JSON.parse(stored);
    } catch {}
    if (prof.data && typeof prof.data === 'object') return prof.data;
    return {};
  }

  const handleTogglePago = (profId) => {
    setPagamentosStatus(prev => {
      const key = `${profId}_${monthPrefix}`;
      const nextState = { ...prev, [key]: !prev[key] };
      try { window.localStorage.setItem('scale_faturamento_pagos', JSON.stringify(nextState)); } catch {}
      return nextState;
    });
  };

  // MOTOR FINANCEIRO RECONSTRUÍDO: Lendo matriz de preços dinâmicos por dia/turno
  const reportData = useMemo(() => {
    const profsSummary = {};

    (professionals || []).forEach(p => {
      if (!p) return;
      const meta = getProfMeta(p);
      const st = String(p.status || meta.status || 'ativo').toLowerCase();
      if (st === 'inativo' || st === 'recusado') return;

      const remunType = meta.remuneration_type || p.remuneration_type || 'plantao'; // Padroniza para plantão dinâmico
      const unitRates = meta.unit_rates || {}; // Nova matriz de preços { [unit_id]: {diurno, noturno, fds} }
      
      const salaryBase = safeNumber(meta.monthly_salary !== undefined ? meta.monthly_salary : p.monthly_salary, 0);
      const taxRate = p.coop_tax_rate ?? meta.coop_tax_rate ?? 0;
      const matricula = meta.registration_id || p.registration_id || 'MAT-XXXX';
      const chavePix = (meta.pix_key || p.pix_key || '').trim();
      const pixTipo = meta.pix_type || p.pix_type || 'CPF';
      const banco = (meta.bank_info || p.bank_info || '').trim();

      profsSummary[String(p.id)] = {
        prof: p,
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
        plantõesFuturos: 0,
        plantõesList: []
      };
    });

    (shifts || []).forEach(shift => {
      if (String(shift.unit_id) !== String(selectedUnitId)) return;
      if (!shift || !shift.date || !shift.date.startsWith(monthPrefix)) return;
      if (!shift.professional_id || shift.status === 'vago') return;

      const pId = String(shift.professional_id);
      if (profsSummary[pId]) {
        const startParts = (shift.start_time || '07:00').split(':');
        const endParts = (shift.end_time || '19:00').split(':');
        const startH = parseInt(startParts[0], 10) || 7;
        const startM = parseInt(startParts[1], 10) || 0;
        const endH = parseInt(endParts[0], 10) || 19;
        const endM = parseInt(endParts[1], 10) || 0;

        let duration = endH - startH + (endM - startM) / 60;
        if (duration <= 0) duration += 24;

        const isRealizado = shift.date <= todayStr;
        const profRef = profsSummary[pId];

        // Lógica de precificação do plantão
        let valorDoPlantaoAtual = 0;
        if (profRef.remunType === 'plantao' && profRef.unitRates[shift.unit_id]) {
          const rates = profRef.unitRates[shift.unit_id];
          const d = new Date(shift.date + 'T12:00:00');
          const isFds = d.getDay() === 0 || d.getDay() === 6;
          const isNight = shift.shift_type === 'noturno' || shift.start_time >= '18:00' || shift.start_time < '06:00';
          
          valorDoPlantaoAtual = isFds ? safeNumber(rates.fds) : (isNight ? safeNumber(rates.noturno) : safeNumber(rates.diurno));
        }

        if (isRealizado) {
          profRef.plantõesRealizados += 1;
          profRef.horasRealizadas += Math.round(duration * 10) / 10;
          profRef.valorApuradoPlantões += valorDoPlantaoAtual;
        } else {
          profRef.plantõesFuturos += 1;
        }

        profRef.plantõesList.push({
          ...shift,
          duration: Math.round(duration * 10) / 10,
          valorAplicado: valorDoPlantaoAtual,
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

      const valorDesconto = (valorBrutoTotal * item.taxRate) / 100;
      const valorLiquido = valorBrutoTotal - valorDesconto;
      const isPago = pagamentosStatus[`${item.prof.id}_${monthPrefix}`] || false;

      return {
        ...item,
        valorBruto: valorBrutoTotal,
        valorDesconto,
        valorLiquido,
        isPago
      };
    }).filter(item => item.plantõesRealizados > 0 || item.plantõesFuturos > 0 || item.remunType === 'mensal'); 
  }, [professionals, shifts, monthPrefix, todayStr, selectedUnitId, pagamentosStatus]);

  const filteredReport = useMemo(() => {
    const term = searchQuery.toLowerCase().trim();
    return reportData.filter(item => {
      if (!term) return true;
      const nome = (item.prof.name || '').toLowerCase();
      const doc = (item.prof.document || '').toLowerCase();
      const mat = (item.matricula || '').toLowerCase();
      return nome.includes(term) || doc.includes(term) || mat.includes(term);
    });
  }, [reportData, searchQuery]);

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
            <td colspan="4" style="font-weight: bold; text-align: right; padding: 8px;">TOTAIS GERAIS DA UNIDADE:</td>
            <td class="num" style="font-weight: bold; border: 1px solid #000; background-color: #f8fafc;">${totals.plantões}</td>
            <td class="time" style="font-weight: bold; border: 1px solid #000; background-color: #f8fafc;">${formatHourForExcel(totals.horas)}</td>
            <td class="money" style="font-weight: bold; border: 1px solid #000; background-color: #f8fafc;">${totals.bruto.toFixed(2).replace('.', ',')}</td>
            <td class="money" style="font-weight: bold; border: 1px solid #000; background-color: #f8fafc; color: #ef4444;">${(totals.bruto - totals.liquido).toFixed(2).replace('.', ',')}</td>
            <td class="money" style="font-weight: bold; border: 1px solid #000; background-color: #f8fafc; color: #059669; font-size: 14px;">${totals.liquido.toFixed(2).replace('.', ',')}</td>
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
          <span>Plantões Cumpridos: ${totals.plantões}</span>
          <span>Total Bruto: ${formatCurrency(totals.bruto)}</span>
          <span style="color: #000;">TOTAL LÍQUIDO A REPASSAR: ${formatCurrency(totals.liquido)}</span>
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
              <p>RECIBO DE HONORÁRIOS & REPASSE MÉDICO</p>
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
          Declaro ter recebido da instituição ${hospitalName} a quantia líquida discriminada acima, correspondente à quitação integral dos serviços profissionais prestados no período de ${competencia}, dando plena e geral quitação.
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
        <title>Recibo Oficial 2 Vias - ${item.prof.name}</title>
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
          <span className="text-[10px] font-black uppercase text-slate-400">Total Bruto Realizado</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatCurrency(totals.bruto)}</div>
          <span className="text-[10px] text-slate-500 font-semibold">{totals.plantões} plantões apurados</span>
        </Card>

        <Card className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Total Líquido p/ Repasse</span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(totals.liquido)}</div>
          <span className="text-[10px] text-slate-500 font-semibold">Valor acumulado na competência</span>
        </Card>

        <Card className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black uppercase text-sky-600 dark:text-sky-400">Tempo de Atendimento</span>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">{totals.horas.toFixed(1).replace('.', ',')}h</div>
          <span className="text-[10px] text-slate-500 font-semibold">Horas assistenciais efetivadas</span>
        </Card>

        <Card className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">Equipe Ativa no Mês</span>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{reportData.length}</div>
          <span className="text-[10px] text-slate-500 font-semibold">Profissionais com produção vinculada</span>
        </Card>
      </div>

      {/* TABELA DE CONCILIAÇÃO FINANCEIRA COM STATUS DE PAGAMENTO */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Espelho de Conciliação Financeira</h3>
            <p className="text-xs text-slate-500">Apuração restrita e isolada para o <b>{currentUnitName}</b>.</p>
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
                        <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">{item.matricula} • {item.prof.document || 'CRM'}</div>
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
                            title="Imprimir Recibo em 2 Vias"
                            className="h-8 text-xs font-bold gap-1 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-white cursor-pointer"
                          >
                            <Receipt className="w-3.5 h-3.5 text-emerald-600" /> Recibo
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
                            <span className="text-[10px] font-bold text-slate-500">Apurado: {formatCurrency(p.valorAplicado)}</span>
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
                  <Receipt className="w-3.5 h-3.5 text-emerald-600" /> Imprimir Recibo
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