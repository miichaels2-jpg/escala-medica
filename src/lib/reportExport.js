// Exportar para Excel e imprimir os relatórios (tela Relatórios).
import { DEFAULT_REMUNERATION_TYPE } from '@/lib/financialCalculations';
import { REPORT_PRINT_CSS, REPORT_TITLES, formatCurrency, formatDate, formatNumber, formatUnitRate, getProductivityDayStatus, getProfessionalRemuneration, getSectorName, getShiftHours, getShiftName, isShiftPast, isVacant, titleCase } from '@/lib/reportUtils';
import { buildPrintDocument, openPrintWindow, printHeader, printLogos } from '@/lib/printLayout';

export function exportReportExcel(requestedMode, { activeTab, appliedFilters, birthDaysList, enrichedSectors, filterSummary, filteredProfessionals, filteredShifts, financialSummary, hasSearched, hospitalName, periodLabel, productivityProfessionalReportReady, productivityReport, professionalMetrics, sectorMetrics, sectors, selectedProductivityRows, selectedProductivitySummary, selectedUnitId, shiftCost, swapsList }) {
  // No Painel BI, exportar/imprimir gera o relatório completo do período.
  const mode = activeTab === 'bi' ? 'all' : requestedMode;
  if (!hasSearched) {
    alert('Atenção: Aplique os filtros antes de exportar a planilha.');
    return;
  }
  if (activeTab === 'produtividade_profissional' && !productivityProfessionalReportReady) {
    alert('Selecione um profissional com plantões produtivos no período para exportar o extrato.');
    return;
  }

  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
    <meta charset="utf-8">
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; }
      table { border-collapse: collapse; width: 100%; font-size: 13px; }
      th { background-color: #0e7490; color: #ffffff; font-weight: bold; padding: 12px; border: 1px solid #cbd5e1; text-align: left; text-transform: uppercase; }
      td { padding: 10px; border: 1px solid #cbd5e1; vertical-align: middle; }
      .row-alt { background-color: #f8fafc; }
      .vago { color: #d97706; font-weight: bold; background-color: #fef3c7; }
      .furo { color: #be123c; font-weight: bold; background-color: #ffe4e6; }
      .header-main { background-color: #ffffff; text-align: center; padding: 15px; border: none; }
      .h1 { font-size: 24px; font-weight: bold; color: #0f172a; margin: 0; }
      .h2 { font-size: 14px; color: #475569; margin: 5px 0 0 0; }
      .money { mso-number-format:"_-* #\\,##0\\.00_-\\;\\-* #\\,##0\\.00_-\\;_-* &quot;-&quot;??_-\\;_-@_-"; }
      .section-title { font-size: 16px; font-weight: bold; color: #0f172a; background-color: #e2e8f0; padding: 10px; text-align: left; border: 1px solid #cbd5e1; }
    </style>
    </head>
    <body>
      <table>
        <tr>
          <td colspan="7" class="header-main">
            <div class="h1">${hospitalName} - ${REPORT_TITLES[activeTab] || 'Relatório de Gestão'}</div>
            <div class="h2">Período: ${periodLabel} · ${filterSummary} · Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
          </td>
        </tr>
        <tr><td colspan="7" style="border:none;"></td></tr>
  `;

  if (mode === 'all' || activeTab === 'escalas') {
    html += `
        <tr><td colspan="7" class="section-title">EXTRATO DETALHADO DE ESCALAS (Cronológico)</td></tr>
        <tr>
          <th>Data do Plantão</th>
          <th>Setor de Atuação</th>
          <th>Profissional Alocado</th>
          <th>Horário</th>
          <th>Status Operacional</th>
          <th>Carga (h)</th>
          <th>Custo Estimado (R$)</th>
        </tr>
    `;
    filteredShifts.forEach((s, i) => {
      const isVago = isVacant(s);
      const isPast = isShiftPast(s);
      let statusTexto = s.status || 'Confirmado';
      let profName = titleCase(getShiftName(s)) || 'Não Identificado';
      let rowClass = i % 2 === 0 ? '' : 'class="row-alt"';

      if (isVago) {
        if (isPast) { profName = 'FALTA / NÃO OCUPADO'; statusTexto = 'Furo de Escala'; rowClass = 'class="furo"'; }
        else { profName = 'VAGA EM ABERTO'; statusTexto = 'Vago'; rowClass = 'class="vago"'; }
      }

      const cost = shiftCost(s);
      html += `
        <tr ${rowClass}>
          <td>${formatDate(s.date)}</td>
          <td>${getSectorName(s, sectors)}</td>
          <td>${profName}</td>
          <td>${s.start_time || ''} às ${s.end_time || ''}</td>
          <td>${statusTexto}</td>
          <td>${getShiftHours(s)}h</td>
          <td class="money">${cost.toFixed(2).replace('.', ',')}</td>
        </tr>
      `;
    });
    html += `<tr><td colspan="7" style="border:none; height:20px;"></td></tr>`;
  }

  if (mode === 'all' || activeTab === 'trocas') {
    html += `
        <tr><td colspan="6" class="section-title">HISTÓRICO DE TROCAS E REPASSES (MURAL)</td></tr>
        <tr>
          <th>Data do Plantão</th>
          <th>Setor Clínico</th>
          <th>Horário</th>
          <th>Dono Original (Solicitante)</th>
          <th>Assumido Por (Atual)</th>
          <th>Status da Troca</th>
        </tr>
    `;
    swapsList.forEach((s, i) => {
      const rowClass = i % 2 === 0 ? '' : 'class="row-alt"';
      html += `
        <tr ${rowClass}>
          <td>${formatDate(s.date)}</td>
          <td>${getSectorName(s, sectors)}</td>
          <td>${s.start_time || ''} às ${s.end_time || ''}</td>
          <td style="font-weight:bold; color:#be123c;">${s.requester}</td>
          <td style="font-weight:bold; color:#059669;">${s.currentProf}</td>
          <td>${s.swapStatus}</td>
        </tr>
      `;
    });
    html += `<tr><td colspan="6" style="border:none; height:20px;"></td></tr>`;
  }

  if (mode === 'all' || activeTab === 'base_setores') {
    html += `
        <tr><td colspan="5" class="section-title">ESTRUTURA DE SETORES</td></tr>
        <tr>
          <th>Nome do Setor</th>
          <th>Especialidade Exigida</th>
          <th>Status</th>
          <th>Plantões no Período</th>
          <th>Custo Projetado (R$)</th>
        </tr>
    `;
    enrichedSectors.forEach((s, i) => {
      const rowClass = i % 2 === 0 ? '' : 'class="row-alt"';
      html += `
        <tr ${rowClass}>
          <td style="font-weight:bold;">${titleCase(s.name)}</td>
          <td>${s.specialty || 'Não def.'}</td>
          <td>${(s.status || 'Ativo').toUpperCase()}</td>
          <td>${s.shiftsCount}</td>
          <td class="money">${s.totalCost.toFixed(2).replace('.', ',')}</td>
        </tr>
      `;
    });
    html += `<tr><td colspan="5" style="border:none; height:20px;"></td></tr>`;
  }

  if (mode === 'all' || activeTab === 'base_profissionais') {
    html += `
        <tr><td colspan="11" class="section-title">BASE DE PROFISSIONAIS (CORPO CLÍNICO)</td></tr>
        <tr>
          <th>Nome Completo</th>
          <th>Especialidade</th>
          <th>Status</th>
          <th>Documento (CRM)</th>
          <th>Vencimento Doc.</th>
          <th>Telefone</th>
          <th>E-mail</th>
          <th>Tipo Remuneração</th>
          <th>Remuneração (${hospitalName})</th>
          <th>Banco</th>
          <th>Chave PIX</th>
        </tr>
    `;
    filteredProfessionals.forEach((p, i) => {
      const rowClass = i % 2 === 0 ? '' : 'class="row-alt"';
      const vencimento = formatDate(p.document_expiry || p.documentExpiry || p.valid_until);
      const isVencido = p.document_expiry && new Date(p.document_expiry) < new Date() ? 'class="furo"' : '';
      html += `
        <tr ${rowClass}>
          <td style="font-weight:bold;">${titleCase(p.name)}</td>
          <td>${p.specialty || 'Não inf.'}</td>
          <td>${(p.status || 'Ativo').toUpperCase()}</td>
          <td>${p.document || 'Não inf.'}</td>
          <td ${isVencido}>${vencimento}</td>
          <td>${p.phone || p.telefone || 'Não inf.'}</td>
          <td>${p.email || 'Não inf.'}</td>
          <td>${titleCase(p.remuneration_type || p.payment_type || DEFAULT_REMUNERATION_TYPE)}</td>
          <td>${getProfessionalRemuneration(p, selectedUnitId)}</td>
          <td>${p.bank_name || p.banco || 'Não inf.'}</td>
          <td>${p.pix_key || p.chave_pix || p.pix || 'Não inf.'}</td>
        </tr>
      `;
    });
    html += `<tr><td colspan="11" style="border:none; height:20px;"></td></tr>`;
  }

  if (mode === 'all' || activeTab === 'aniversariantes') {
    html += `
        <tr><td colspan="4" class="section-title">ANIVERSARIANTES DO MÊS (${birthDaysList.length})</td></tr>
        <tr>
          <th>Dia do Aniversário</th>
          <th>Nome do Profissional</th>
          <th>Idade que Completa</th>
          <th>Setor Principal / Especialidade</th>
        </tr>
    `;
    birthDaysList.forEach((p, i) => {
      const rowClass = i % 2 === 0 ? '' : 'class="row-alt"';
      html += `
        <tr ${rowClass}>
          <td style="font-weight:bold; text-align:center;">Dia ${p.birthDateFormatted}</td>
          <td style="font-weight:bold;">${titleCase(p.name)}</td>
          <td style="text-align:center;">${p.ageTurns} anos</td>
          <td>${p.specialty || 'Geral'}</td>
        </tr>
      `;
    });
    html += `<tr><td colspan="4" style="border:none; height:20px;"></td></tr>`;
  }

  if (mode === 'all' || activeTab === 'profissionais') {
    html += `
        <tr><td colspan="6" class="section-title">MATRIZ DE PRODUTIVIDADE MÉDICA (No Período)</td></tr>
        <tr>
          <th>Nome do Profissional</th>
          <th>Especialidade Principal</th>
          <th>Setores Atuados no Período</th>
          <th>Nº Plantões</th>
          <th>Horas Realizadas</th>
          <th>Honorários Brutos (R$)</th>
        </tr>
    `;
    professionalMetrics.forEach((doc, i) => {
      const rowClass = i % 2 === 0 ? '' : 'class="row-alt"';
      html += `
        <tr ${rowClass}>
          <td style="font-weight:bold;">${doc.name}</td>
          <td>${doc.specialty}</td>
          <td>${doc.sectors}</td>
          <td style="text-align:center;">${doc.shifts}</td>
          <td style="text-align:center;">${doc.hours}h</td>
          <td class="money">${doc.cost.toFixed(2).replace('.', ',')}</td>
        </tr>
      `;
    });
    html += `<tr><td colspan="6" style="border:none; height:20px;"></td></tr>`;
  }

  if (mode === 'all' || activeTab === 'produtividade_diaria') {
    html += `
      <tr><td colspan="6" class="section-title">APURAÇÃO DIÁRIA DE PRODUTIVIDADE</td></tr>
      <tr><td colspan="6">${productivityReport.available
        ? `Unidade da regra: ${hospitalName} · Pool diário configurado: ${formatCurrency(productivityReport.dailyPool)} · Rateio proporcional por atendimentos, fechado somente após conferência de todos os profissionais produtivos escalados e conclusão dos plantões.`
        : productivityReport.error || `A regra de produtividade não está configurada para a unidade selecionada (${hospitalName}); não há valores apurados neste relatório.`}</td></tr>
      <tr>
        <th>Data</th><th>Atendimentos apurados</th><th>Plantões</th><th>Pool diário aplicado (R$)</th><th>Valor por atendimento (R$)</th><th>Status</th>
      </tr>
    `;
    productivityReport.days.forEach(day => {
      html += `
        <tr>
          <td>${formatDate(day.date)}</td>
          <td>${day.complete ? formatNumber(day.totalAttendance) : 'Pendente'}</td>
          <td>${day.items.reduce((sum, item) => sum + item.shifts, 0)}</td>
          <td class="money">${day.complete ? formatCurrency(day.totalAttendance > 0 ? day.poolAmount : 0) : '—'}</td>
          <td class="money">${day.complete && day.totalAttendance > 0 ? formatCurrency(day.poolAmount / day.totalAttendance) : '—'}</td>
          <td>${getProductivityDayStatus(day)}</td>
        </tr>
      `;
    });
    html += `
      <tr><td colspan="11" class="section-title">RATEIO POR PROFISSIONAL E DIA</td></tr>
      <tr>
        <th>Data</th><th>Profissional</th><th>Especialidade</th><th>Setor(es)</th><th>Plantões</th><th>Total atendimentos do dia</th><th>Atendimentos individuais</th><th>Valor por atendimento</th><th>Pool diário</th><th>Valor rateado</th><th>Situação</th>
      </tr>
    `;
    productivityReport.rows.forEach(row => {
      const daily = productivityReport.days.find(day => day.date === row.date);
      html += `
        <tr>
          <td>${formatDate(row.date)}</td>
          <td>${titleCase(row.professional.name)}</td>
          <td>${row.professional.specialty || '—'}</td>
          <td>${row.sectors}</td>
          <td>${row.shifts}</td>
          <td>${row.complete ? formatNumber(daily?.totalAttendance) : 'Pendente'}</td>
          <td>${row.attendance ?? 'não lançado'}</td>
          <td class="money">${row.unitRate === null ? '—' : formatUnitRate(row.unitRate)}</td>
          <td class="money">${row.complete ? formatCurrency(daily?.totalAttendance > 0 ? productivityReport.dailyPool : 0) : '—'}</td>
          <td class="money">${row.complete ? formatCurrency(row.amount) : '—'}</td>
          <td>${row.complete ? 'Rateado' : `Pendente · ${row.pendingReason}`}</td>
        </tr>
      `;
    });
    html += `
      <tr><td colspan="7" class="section-title">ACUMULADO POR PROFISSIONAL NO PERÍODO</td></tr>
      <tr><th>Profissional</th><th>Especialidade</th><th>Plantões</th><th>Atendimentos fechados</th><th>Valor acumulado</th><th>Dias pendentes</th><th>Situação</th></tr>
    `;
    productivityReport.professionalTotals.forEach(item => {
      html += `<tr><td>${titleCase(item.professional.name)}</td><td>${item.professional.specialty || '—'}</td><td>${item.shifts}</td><td>${item.attendance}</td><td class="money">${formatCurrency(item.amount)}</td><td>${item.pendingDays}</td><td>${item.pendingDays ? 'Saldo parcial' : 'Completo'}</td></tr>`;
    });
    html += `
      <tr><td colspan="6" class="section-title">CONSOLIDADO DO PERÍODO (UNIDADE)</td></tr>
      <tr>
        <td>Atendimentos em dias fechados: ${productivityReport.available ? formatNumber(productivityReport.totals.attendance) : '—'}</td>
        <td>Plantões produtivos: ${productivityReport.available ? productivityReport.totals.shifts : '—'}</td>
        <td>Pool rateado: ${productivityReport.available ? formatCurrency(productivityReport.totals.pool) : '—'}</td>
        <td>Dias pendentes: ${productivityReport.available ? productivityReport.totals.pendingDays : '—'}</td>
        <td colspan="2">Pool diário configurado: ${productivityReport.available ? formatCurrency(productivityReport.dailyPool) : '—'}</td>
      </tr>
      <tr><td colspan="6" style="border:none; height:20px;"></td></tr>
    `;
  }

  if ((mode === 'all' || activeTab === 'produtividade_profissional') && selectedProductivitySummary) {
    html += `
      <tr><td colspan="8" class="section-title">EXTRATO INDIVIDUAL DE PRODUTIVIDADE</td></tr>
      <tr><td colspan="8">Profissional: ${titleCase(selectedProductivitySummary.professional.name)} · Especialidade: ${selectedProductivitySummary.professional.specialty || '—'} · Período: ${periodLabel} · Unidade: ${hospitalName}</td></tr>
      <tr><td colspan="8">Regra: valor por atendimento = pool diário configurado (${formatCurrency(productivityReport.dailyPool)}) ÷ total de atendimentos da unidade no dia. Valor individual = atendimentos do profissional × valor por atendimento. Dias pendentes não entram no saldo fechado.</td></tr>
      <tr>
        <th>Data</th><th>Setor(es)</th><th>Plantões</th><th>Atendimentos do profissional</th><th>Atendimentos totais no dia</th><th>Valor por atendimento</th><th>Valor rateado</th><th>Situação</th>
      </tr>
    `;
    selectedProductivityRows.forEach(row => {
      const day = productivityReport.days.find(item => item.date === row.date);
      html += `
        <tr>
          <td>${formatDate(row.date)}</td>
          <td>${row.sectors}</td>
          <td>${row.shifts}</td>
          <td>${row.attendance ?? 'Não lançado'}</td>
          <td>${row.complete ? formatNumber(day?.totalAttendance) : 'Pendente'}</td>
          <td class="money">${row.unitRate === null ? '—' : formatUnitRate(row.unitRate)}</td>
          <td class="money">${row.complete ? formatCurrency(row.amount) : '—'}</td>
          <td>${row.complete ? 'Rateado' : `Pendente · ${row.pendingReason}`}</td>
        </tr>
      `;
    });
    html += `
      <tr>
        <td colspan="2"><strong>Total do período fechado</strong></td>
        <td>${selectedProductivitySummary.shifts}</td>
        <td>${formatNumber(selectedProductivitySummary.attendance)}</td>
        <td>—</td>
        <td>—</td>
        <td class="money"><strong>${formatCurrency(selectedProductivitySummary.amount)}</strong></td>
        <td>${selectedProductivitySummary.pendingDays ? `${selectedProductivitySummary.pendingDays} dia(s) pendente(s) · saldo parcial` : 'Completo'}</td>
      </tr>
      <tr><td colspan="8" style="border:none; height:20px;"></td></tr>
    `;
  }

  if (mode === 'all' || activeTab === 'financeiro') {
    html += `
        <tr><td colspan="4" class="section-title">RELATÓRIO FINANCEIRO OPERACIONAL</td></tr>
        <tr><td colspan="4" style="font-size:10px; color:#475569;">Mesma base do Faturamento: salário mensal proporcional aos dias do período e dividido entre os plantões do profissional; produtividade pelo rateio dos dias fechados; demais regimes pela tarifa cadastrada.</td></tr>
        ${financialSummary.shiftsMissingRate > 0 || financialSummary.shiftsAwaitingProduction > 0 ? `<tr><td colspan="4" style="font-weight:bold; color:#92400e;">Atenção: ${financialSummary.shiftsMissingRate} plantão(ões) sem tarifa ou profissional identificado; ${financialSummary.shiftsAwaitingProduction} plantão(ões) por produtividade aguardam lançamento. Valores pendentes não integram os totais.</td></tr>` : ''}
        <tr>
          <th colspan="2">Previsão das escalas ocupadas</th>
          <th colspan="2" style="background-color: #047857;">Realizado Concluído</th>
        </tr>
        <tr>
          <td colspan="2" class="money" style="font-weight:bold; font-size:16px;">${financialSummary.totalCost.toFixed(2).replace('.', ',')}</td>
          <td colspan="2" class="money" style="font-weight:bold; font-size:16px; color:#047857;">${financialSummary.executedCost.toFixed(2).replace('.', ',')}</td>
        </tr>
        <tr>
          <th colspan="2" style="background-color: #b45309;">Valor Pendente a Realizar</th>
          <th colspan="2" style="background-color: #be123c;">Valor Retido (Vagas e Furos)</th>
        </tr>
        <tr>
          <td colspan="2" class="money" style="font-weight:bold; font-size:16px; color:#b45309;">${financialSummary.pendingCost.toFixed(2).replace('.', ',')}</td>
          <td colspan="2" class="money" style="font-weight:bold; font-size:16px; color:#be123c;">${financialSummary.vacantCost.toFixed(2).replace('.', ',')}</td>
        </tr>
        <tr><td colspan="4" style="border:none; height: 20px;"></td></tr>
        <tr><td colspan="4" class="section-title">CUSTOS DESDOBRADOS POR SETOR CLÍNICO</td></tr>
        <tr>
          <th colspan="2">Setor Clínico / Unidade</th>
          <th class="text-center">Horas Assistenciais</th>
          <th class="text-right">Alocação Orçamentária (R$)</th>
        </tr>
    `;
    sectorMetrics.forEach((sec, i) => {
      const rowClass = i % 2 === 0 ? '' : 'class="row-alt"';
      html += `
        <tr ${rowClass}>
          <td colspan="2" style="font-weight:bold;">${sec.name}</td>
          <td style="text-align:center;">${sec.hours}h</td>
          <td class="money">${sec.cost.toFixed(2).replace('.', ',')}</td>
        </tr>
      `;
    });
  }

  html += `
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Relatorio_${mode === 'all' ? 'Completo' : activeTab}_${appliedFilters.start}_a_${appliedFilters.end}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printReport(requestedMode, { activeTab, birthDaysList, company, coverageRate, credentialAudit, currentUnitObj, enrichedSectors, filledShiftsCount, filterSummary, filteredProfessionals, filteredShifts, financialSummary, hasSearched, hospitalName, periodLabel, productivityProfessionalReportReady, productivityReport, professionalMetrics, sectorMetrics, sectors, selectedProductivityRows, selectedProductivitySummary, selectedUnitId, swapsList, totalShiftsCount, user, vacantShiftItems }) {
  const mode = activeTab === 'bi' ? 'all' : requestedMode;
  if (!hasSearched) {
    alert('Atenção: Aplique os filtros para renderizar a telemetria antes de imprimir.');
    return;
  }
  if (activeTab === 'produtividade_profissional' && !productivityProfessionalReportReady) {
    alert('Selecione um profissional com plantões produtivos no período para imprimir o extrato.');
    return;
  }

  let printHtml = printHeader({
    logos: printLogos({ company, unit: currentUnitObj }),
    orgName: hospitalName,
    title: REPORT_TITLES[activeTab] || 'Relatório gerencial',
    subtitle: periodLabel,
    meta: [['Filtros', filterSummary]]
  });

  if (mode === 'all' || activeTab === 'executivo') {
    printHtml += `
      <div class="section-title break-inside-avoid">1. Resumo Operacional Global</div>
      <div class="grid-4 break-inside-avoid">
        <div class="grid-card">
          <div class="card-title">Total de Plantões</div>
          <div class="card-value">${totalShiftsCount}</div>
          <div class="card-sub" style="color:#059669;">${filledShiftsCount} Preenchidos</div>
        </div>
        <div class="grid-card">
          <div class="card-title">Taxa de Cobertura</div>
          <div class="card-value">${coverageRate}%</div>
          <div class="card-sub" style="color:#475569;">Meta: > 98%</div>
        </div>
        <div class="grid-card">
          <div class="card-title">Custo das escalas ocupadas</div>
          <div class="card-value">${formatCurrency(financialSummary.totalCost)}</div>
          <div class="card-sub" style="color:#475569;">${financialSummary.hours}h Assistenciais</div>
        </div>
        <div class="grid-card">
          <div class="card-title">Profissionais Ativos</div>
          <div class="card-value">${filteredProfessionals.length}</div>
          <div class="card-sub" style="color:#e11d48;">${credentialAudit.expired} Vencidos</div>
        </div>
      </div>
    `;

    if (vacantShiftItems.length > 0) {
      printHtml += `
        <div class="section-title alert break-inside-avoid">Atenção: Ocorrências de Furos e Vagas Abertas (${vacantShiftItems.length})</div>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Setor Clínico</th>
              <th class="text-center">Horário</th>
              <th class="text-center">Diagnóstico</th>
            </tr>
          </thead>
          <tbody>
      `;
      vacantShiftItems.forEach(v => {
        const isPast = isShiftPast(v);
        printHtml += `
          <tr>
            <td class="font-bold">${formatDate(v.date)}</td>
            <td>${getSectorName(v, sectors)}</td>
            <td class="text-center font-bold">${v.start_time} - ${v.end_time}</td>
            <td class="text-center ${isPast ? 'furo' : 'vago'}">${isPast ? 'NÃO OCUPADO (FALTA)' : 'VAGA PENDENTE'}</td>
          </tr>
        `;
      });
      printHtml += `</tbody></table>`;
    }
  }

  if (mode === 'all' || activeTab === 'escalas') {
    printHtml += `
      <div class="section-title ${mode === 'all' ? 'break-before' : 'break-inside-avoid'}">Extrato Detalhado de Escalas (Cronológico)</div>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Setor Clínico</th>
            <th>Profissional</th>
            <th class="text-center">Horário</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
    `;
    filteredShifts.forEach(s => {
      const isVago = isVacant(s);
      const isPast = isShiftPast(s);
      let profName = titleCase(s.professional_name);
      let badgeText = s.status || 'Confirmado';
      let rowClass = '';

      if (isVago) {
        if (isPast) { profName = 'NÃO OCUPADO (FURO)'; badgeText = 'Sem Cobertura'; rowClass = 'furo'; }
        else { profName = 'VAGA EM ABERTO'; badgeText = 'Vago'; rowClass = 'vago'; }
      }

      printHtml += `
        <tr>
          <td class="font-bold">${formatDate(s.date)}</td>
          <td>${getSectorName(s, sectors)}</td>
          <td class="${rowClass}">${profName}</td>
          <td class="text-center font-bold">${s.start_time} - ${s.end_time}</td>
          <td class="text-center ${rowClass}">${badgeText.toUpperCase()}</td>
        </tr>
      `;
    });
    printHtml += `</tbody></table>`;
  }

  if ((mode === 'all' && swapsList.length > 0) || activeTab === 'trocas') {
    printHtml += `
      <div class="section-title ${mode === 'all' ? 'break-before' : 'break-inside-avoid'}">Histórico de Trocas e Repasses (Mural)</div>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Setor Clínico</th>
            <th class="text-center">Horário</th>
            <th>Dono Original</th>
            <th>Assumido Por</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
    `;
    if (swapsList.length === 0) {
      printHtml += `<tr><td colspan="6" class="text-center" style="color: #64748b; padding: 20px;">Nenhum repasse ou troca registrada no período.</td></tr>`;
    } else {
      swapsList.forEach(s => {
        printHtml += `
          <tr>
            <td class="font-bold">${formatDate(s.date)}</td>
            <td>${getSectorName(s, sectors)}</td>
            <td class="text-center font-bold">${s.start_time} - ${s.end_time}</td>
            <td style="color:#be123c; font-weight:bold;">${s.requester}</td>
            <td style="color:#059669; font-weight:bold;">${s.currentProf}</td>
            <td class="text-center font-bold">${s.swapStatus}</td>
          </tr>
        `;
      });
    }
    printHtml += `</tbody></table>`;
  }

  if (mode === 'all' || activeTab === 'base_setores') {
    printHtml += `
      <div class="section-title ${mode === 'all' ? 'break-before' : 'break-inside-avoid'}">Estrutura de Setores</div>
      <table>
        <thead>
          <tr>
            <th>Nome do Setor</th>
            <th>Especialidade Exigida</th>
            <th>Status</th>
            <th class="text-center">Plantões no Período</th>
            <th class="text-right">Custo Projetado (R$)</th>
          </tr>
        </thead>
        <tbody>
    `;
    enrichedSectors.forEach(s => {
      printHtml += `
        <tr>
          <td class="font-bold">${titleCase(s.name)}</td>
          <td>${s.specialty || 'Não def.'}</td>
          <td>${(s.status || 'Ativo').toUpperCase()}</td>
          <td class="text-center">${s.shiftsCount}</td>
          <td class="text-right font-bold">${formatCurrency(s.totalCost)}</td>
        </tr>
      `;
    });
    printHtml += `</tbody></table>`;
  }

  if (mode === 'all' || activeTab === 'base_profissionais') {
    printHtml += `
      <div class="section-title ${mode === 'all' ? 'break-before' : 'break-inside-avoid'}">Base do Corpo Clínico (${filteredProfessionals.length} profissionais)</div>
      <table>
        <thead>
          <tr>
            <th>Nome Completo</th>
            <th>Especialidade</th>
            <th>Remuneração (${hospitalName})</th>
            <th>Documento (CRM)</th>
            <th>Vencimento Doc.</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
    `;
    filteredProfessionals.forEach(p => {
      const expiryDate = p.document_expiry || p.documentExpiry || p.valid_until;
      const isExpired = expiryDate && new Date(expiryDate) < new Date();
      printHtml += `
        <tr>
          <td class="font-bold">${titleCase(p.name)}</td>
          <td>${p.specialty}</td>
          <td>${getProfessionalRemuneration(p, selectedUnitId)}</td>
          <td>${p.document || '—'}</td>
          <td class="${isExpired ? 'furo' : ''}">${formatDate(expiryDate)}</td>
          <td class="text-center">${(p.status || 'Ativo').toUpperCase()}</td>
        </tr>
      `;
    });
    printHtml += `</tbody></table>`;
  }

  if ((mode === 'all' && birthDaysList.length > 0) || activeTab === 'aniversariantes') {
    printHtml += `
      <div class="section-title ${mode === 'all' ? 'break-before' : 'break-inside-avoid'}">Aniversariantes do Mês (${birthDaysList.length})</div>
      <table>
        <thead>
          <tr>
            <th class="text-center" style="width: 15%">Dia do Aniversário</th>
            <th style="width: 45%">Nome do Profissional</th>
            <th class="text-center" style="width: 15%">Idade</th>
            <th style="width: 25%">Setor / Especialidade</th>
          </tr>
        </thead>
        <tbody>
    `;
    if (birthDaysList.length === 0) {
      printHtml += `<tr><td colspan="4" class="text-center" style="color: #64748b; padding: 20px;">Nenhum aniversariante encontrado neste período.</td></tr>`;
    } else {
      birthDaysList.forEach(p => {
        printHtml += `
          <tr>
            <td class="text-center font-bold" style="font-size: 14px;">Dia ${p.birthDateFormatted}</td>
            <td class="font-bold" style="font-size: 14px;">${titleCase(p.name)}</td>
            <td class="text-center">${p.ageTurns} anos</td>
            <td>${p.specialty || 'Geral'}</td>
          </tr>
        `;
      });
    }
    printHtml += `</tbody></table>`;
  }

  if (mode === 'all' || activeTab === 'profissionais') {
    printHtml += `
      <div class="section-title ${mode === 'all' ? 'break-before' : 'break-inside-avoid'}">Matriz de Produtividade Médica</div>
      <table>
        <thead>
          <tr>
            <th>Profissional</th>
            <th>Especialidade</th>
            <th class="text-center">Nº Plantões</th>
            <th class="text-center">Horas Realizadas</th>
            <th class="text-right">Honorários Brutos (R$)</th>
          </tr>
        </thead>
        <tbody>
    `;
    professionalMetrics.forEach(doc => {
      printHtml += `
        <tr>
          <td class="font-bold">${doc.name}</td>
          <td>${doc.specialty}</td>
          <td class="text-center font-bold">${doc.shifts}</td>
          <td class="text-center">${doc.hours}h</td>
          <td class="text-right font-bold">${formatCurrency(doc.cost)}</td>
        </tr>
      `;
    });
    printHtml += `</tbody></table>`;
  }

  if ((mode === 'all' && productivityReport.available && productivityReport.days.length > 0) || activeTab === 'produtividade_diaria') {
    printHtml += `
      <div class="section-title ${mode === 'all' ? 'break-before' : 'break-inside-avoid'}">Apuração diária de produtividade</div>
      <p style="font-size:9px; color:#475569; margin-bottom:10px;">
        ${productivityReport.available
          ? `Unidade da regra: ${hospitalName} · Pool configurado: ${formatCurrency(productivityReport.dailyPool)} por dia. Cada diária é rateada proporcionalmente aos atendimentos cadastrados para profissionais com remuneração por produtividade. Dias pendentes não compõem o total rateado.`
          : productivityReport.error || `A regra de produtividade não está configurada para a unidade selecionada (${hospitalName}); não há valores apurados neste relatório.`}
      </p>
      <div class="grid-cards">
        <div class="grid-card"><div class="card-title">Atendimentos em dias fechados</div><div class="card-value">${productivityReport.available ? formatNumber(productivityReport.totals.attendance) : '—'}</div></div>
        <div class="grid-card"><div class="card-title">Pool rateado no período</div><div class="card-value">${productivityReport.available ? formatCurrency(productivityReport.totals.pool) : '—'}</div></div>
        <div class="grid-card"><div class="card-title">Plantões produtivos</div><div class="card-value">${productivityReport.available ? productivityReport.totals.shifts : '—'}</div></div>
        <div class="grid-card"><div class="card-title">Dias pendentes</div><div class="card-value">${productivityReport.available ? productivityReport.totals.pendingDays : '—'}</div></div>
      </div>
      <table>
        <thead><tr><th>Data</th><th class="text-center">Atendimentos</th><th class="text-center">Plantões</th><th class="text-right">Pool aplicado</th><th class="text-right">Valor / atendimento</th><th>Status</th></tr></thead>
        <tbody>
          ${productivityReport.days.map(day => `
            <tr>
              <td class="font-semibold">${formatDate(day.date)}</td>
              <td class="text-center">${day.complete ? formatNumber(day.totalAttendance) : 'Pendente'}</td>
              <td class="text-center">${day.items.reduce((sum, item) => sum + item.shifts, 0)}</td>
              <td class="text-right font-semibold">${day.complete ? formatCurrency(day.totalAttendance > 0 ? day.poolAmount : 0) : '—'}</td>
              <td class="text-right">${day.complete && day.totalAttendance > 0 ? formatCurrency(day.poolAmount / day.totalAttendance) : '—'}</td>
              <td>${getProductivityDayStatus(day)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="section-title break-inside-avoid">Rateio individual por profissional e dia</div>
      <table>
        <thead><tr><th>Data</th><th>Profissional</th><th>Especialidade</th><th>Setor(es)</th><th class="text-center">Plantões</th><th class="text-center">Total do dia</th><th class="text-center">Atendimentos individuais</th><th class="text-right">Valor / atendimento</th><th class="text-right">Pool diário</th><th class="text-right">Valor rateado</th><th>Status</th></tr></thead>
        <tbody>
          ${productivityReport.rows.map(row => `
            <tr>
              <td class="font-semibold">${formatDate(row.date)}</td>
              <td>${titleCase(row.professional.name)}</td>
              <td>${row.professional.specialty || '—'}</td>
              <td>${row.sectors}</td>
              <td class="text-center">${row.shifts}</td>
              <td class="text-center">${row.complete ? formatNumber(productivityReport.days.find(day => day.date === row.date)?.totalAttendance) : 'Pendente'}</td>
              <td class="text-center">${row.attendance ?? 'Não lançado'}</td>
              <td class="text-right">${row.unitRate === null ? '—' : formatUnitRate(row.unitRate)}</td>
              <td class="text-right">${row.complete ? formatCurrency(productivityReport.days.find(day => day.date === row.date)?.totalAttendance > 0 ? productivityReport.dailyPool : 0) : '—'}</td>
              <td class="text-right font-semibold">${row.complete ? formatCurrency(row.amount) : '—'}</td>
              <td>${row.complete ? 'Rateado' : row.pendingReason}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="section-title break-inside-avoid">Acumulado por profissional no período</div>
      <table>
        <thead><tr><th>Profissional</th><th>Especialidade</th><th class="text-center">Plantões</th><th class="text-center">Atendimentos em dias fechados</th><th class="text-right">Saldo acumulado</th><th class="text-center">Dias pendentes</th><th>Situação</th></tr></thead>
        <tbody>
          ${productivityReport.professionalTotals.map(item => `
            <tr>
              <td class="font-semibold">${titleCase(item.professional.name)}</td>
              <td>${item.professional.specialty || '—'}</td>
              <td class="text-center">${item.shifts}</td>
              <td class="text-center">${formatNumber(item.attendance)}</td>
              <td class="text-right font-semibold">${formatCurrency(item.amount)}</td>
              <td class="text-center">${item.pendingDays}</td>
              <td>${item.pendingDays ? 'Saldo parcial' : 'Completo'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  if ((mode === 'all' || activeTab === 'produtividade_profissional') && selectedProductivitySummary) {
    printHtml += `
      <div class="section-title ${mode === 'all' ? 'break-before' : 'break-inside-avoid'}">Extrato individual de produtividade</div>
      <p style="font-size:10px; font-weight:bold; margin-bottom:5px;">
        Profissional: ${titleCase(selectedProductivitySummary.professional.name)}
        · Especialidade: ${selectedProductivitySummary.professional.specialty || 'Não informada'}
        · Unidade: ${hospitalName}
      </p>
      <p style="font-size:9px; color:#475569; margin-bottom:12px;">
        Pool diário configurado: ${formatCurrency(productivityReport.dailyPool)}.
        Valor por atendimento = pool diário ÷ total de atendimentos da unidade no dia.
        Valor individual = atendimentos do profissional × valor por atendimento.
        Dias pendentes não entram no saldo fechado.
      </p>
      <div class="grid-4 break-inside-avoid">
        <div class="grid-card"><div class="card-title">Plantões no período</div><div class="card-value">${formatNumber(selectedProductivitySummary.shifts)}</div></div>
        <div class="grid-card"><div class="card-title">Atendimentos em dias fechados</div><div class="card-value">${formatNumber(selectedProductivitySummary.attendance)}</div></div>
        <div class="grid-card"><div class="card-title">Valor acumulado fechado</div><div class="card-value">${formatCurrency(selectedProductivitySummary.amount)}</div></div>
        <div class="grid-card"><div class="card-title">Dias pendentes</div><div class="card-value">${formatNumber(selectedProductivitySummary.pendingDays)}</div></div>
      </div>
      <table>
        <thead><tr><th>Data</th><th>Setor(es)</th><th class="text-center">Plantões</th><th class="text-center">Atendimentos individuais</th><th class="text-center">Atendimentos totais no dia</th><th class="text-right">Valor / atendimento</th><th class="text-right">Valor rateado</th><th>Situação</th></tr></thead>
        <tbody>
          ${selectedProductivityRows.map(row => {
            const day = productivityReport.days.find(item => item.date === row.date);
            return `
              <tr>
                <td class="font-semibold">${formatDate(row.date)}</td>
                <td>${row.sectors}</td>
                <td class="text-center">${row.shifts}</td>
                <td class="text-center">${row.attendance ?? 'Não lançado'}</td>
                <td class="text-center">${row.complete ? formatNumber(day?.totalAttendance) : 'Pendente'}</td>
                <td class="text-right">${row.unitRate === null ? '—' : formatUnitRate(row.unitRate)}</td>
                <td class="text-right font-semibold">${row.complete ? formatCurrency(row.amount) : '—'}</td>
                <td>${row.complete ? 'Rateado' : `Pendente · ${row.pendingReason}`}</td>
              </tr>
            `;
          }).join('')}
          <tr>
            <td colspan="2" class="font-bold">Total fechado no período</td>
            <td class="text-center font-bold">${selectedProductivitySummary.shifts}</td>
            <td class="text-center font-bold">${formatNumber(selectedProductivitySummary.attendance)}</td>
            <td class="text-center">—</td>
            <td class="text-right">—</td>
            <td class="text-right font-bold">${formatCurrency(selectedProductivitySummary.amount)}</td>
            <td>${selectedProductivitySummary.pendingDays ? `${selectedProductivitySummary.pendingDays} dia(s) pendente(s) · saldo parcial` : 'Completo'}</td>
          </tr>
        </tbody>
      </table>
    `;
  }

  if (mode === 'all' || activeTab === 'financeiro') {
    printHtml += `
      <div class="section-title ${mode === 'all' ? 'break-before' : 'break-inside-avoid'}">Relatório Financeiro Operacional</div>
      <p style="font-size:9px; color:#475569; margin-bottom:10px;">Mesma base do Faturamento: salário mensal proporcional aos dias do período e dividido entre os plantões do profissional; produtividade pelo rateio dos dias fechados; demais regimes pela tarifa cadastrada.</p>
      ${financialSummary.shiftsMissingRate > 0 || financialSummary.shiftsAwaitingProduction > 0 ? `<p style="font-size:9px; font-weight:bold; color:#92400e; margin-bottom:10px;">Atenção: ${financialSummary.shiftsMissingRate} plantão(ões) sem tarifa ou profissional identificado; ${financialSummary.shiftsAwaitingProduction} plantão(ões) por produtividade aguardam lançamento. Valores pendentes não integram os totais.</p>` : ''}

      <div class="grid-4 break-inside-avoid" style="margin-bottom: 30px;">
        <div class="grid-card">
          <div class="card-title">Valor Total Previsão</div>
          <div class="card-value">${formatCurrency(financialSummary.totalCost)}</div>
        </div>
        <div class="grid-card" style="background-color: #f0fdf4; border-color: #86efac;">
          <div class="card-title" style="color: #047857;">Realizado Concluído</div>
          <div class="card-value" style="color: #047857;">${formatCurrency(financialSummary.executedCost)}</div>
        </div>
        <div class="grid-card" style="background-color: #fffbeb; border-color: #fcd34d;">
          <div class="card-title" style="color: #b45309;">Pendente a Realizar</div>
          <div class="card-value" style="color: #b45309;">${formatCurrency(financialSummary.pendingCost)}</div>
        </div>
        <div class="grid-card" style="background-color: #fff1f2; border-color: #fda4af;">
          <div class="card-title" style="color: #be123c;">Vagas e Furos</div>
          <div class="card-value" style="color: #be123c;">${formatCurrency(financialSummary.vacantCost)}</div>
        </div>
      </div>

      <div class="section-title break-inside-avoid">Desdobramento de Custos por Setor</div>
      <table>
        <thead>
          <tr>
            <th>Setor Clínico / Unidade</th>
            <th class="text-center">Horas Assistenciais</th>
            <th class="text-right">Alocação Orçamentária (R$)</th>
          </tr>
        </thead>
        <tbody>
    `;
    sectorMetrics.forEach(sec => {
      printHtml += `
        <tr>
          <td class="font-bold">${sec.name}</td>
          <td class="text-center">${sec.hours}h</td>
          <td class="text-right font-bold">${formatCurrency(sec.cost)}</td>
        </tr>
      `;
    });
    printHtml += `</tbody></table>`;
  }

  const html = buildPrintDocument({
    docTitle: `${REPORT_TITLES[activeTab] || 'Relatório'} · ${hospitalName}`,
    orientation: ['produtividade_diaria', 'produtividade_profissional'].includes(activeTab) ? 'landscape' : 'portrait',
    issuedBy: user?.full_name || '',
    css: REPORT_PRINT_CSS,
    body: printHtml
  });
  if (!openPrintWindow(html)) alert('Permita pop-ups para abrir o relatório de impressão.');
}
