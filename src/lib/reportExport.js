// Exportar para Excel e imprimir os relatórios (tela Relatórios).
import { DEFAULT_REMUNERATION_TYPE } from '@/lib/financialCalculations';
import { REPORT_PRINT_CSS, REPORT_TITLES, formatCurrency, formatDate, formatNumber, formatUnitRate, getProductivityDayStatus, getProfessionalRemuneration, getSectorName, getShiftHours, getShiftName, isShiftPast, isVacant, titleCase } from '@/lib/reportUtils';
import { buildPrintDocument, openPrintWindow, printHeader, printLogos } from '@/lib/printLayout';

// Planilha .xlsx no modelo único (src/lib/excelLayout.js): uma aba por relatório.
export async function exportReportExcel(requestedMode, { activeTab, appliedFilters, birthDaysList, company, coverageRate, credentialAudit, currentUnitObj, enrichedSectors, filledShiftsCount, filterSummary, filteredProfessionals, filteredShifts, financialSummary, hasSearched, hospitalName, periodLabel, productivityProfessionalReportReady, productivityReport, professionalMetrics, reliabilityRows = [], sectorMetrics, sectors, selectedProductivityRows, selectedProductivitySummary, selectedUnitId, shiftCost, swapsList, totalShiftsCount, vacantShiftItems = [] }) {
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

  try {
    const { addSheet, createWorkbook, downloadWorkbook, excelFileName } = await import('@/lib/excelLayout');
    const book = await createWorkbook({ company, unit: currentUnitObj });
    const wants = tab => mode === 'all' || activeTab === tab;
    const sheet = (name, title, blocks, extra = {}) => addSheet(book, { name, orgName: hospitalName, title, subtitle: periodLabel, meta: [['Filtros', filterSummary]], blocks, ...extra });
    const sector = s => getSectorName(s, sectors);
    const hoursRange = s => `${s.start_time || ''} às ${s.end_time || ''}`;
    const isExpired = date => Boolean(date) && new Date(date) < new Date();

    if (wants('executivo')) {
      sheet('Resumo', REPORT_TITLES.executivo, [
        { type: 'summary', items: [
          { label: 'Total de plantões', value: totalShiftsCount, type: 'int' },
          { label: 'Plantões preenchidos', value: filledShiftsCount, type: 'int' },
          { label: 'Taxa de cobertura (meta: acima de 98%)', value: coverageRate, type: 'percent', tone: coverageRate >= 98 ? 'good' : coverageRate >= 90 ? 'warn' : 'bad' },
          { label: 'Custo das escalas ocupadas', value: financialSummary.totalCost, type: 'money' },
          { label: 'Horas assistenciais', value: financialSummary.hours, type: 'hours' },
          { label: 'Profissionais ativos', value: filteredProfessionals.length, type: 'int' },
          { label: 'Credenciais vencidas', value: credentialAudit?.expired ?? 0, type: 'int', tone: credentialAudit?.expired ? 'bad' : undefined }
        ] },
        { type: 'table', title: `Furos e vagas abertas (${vacantShiftItems.length})`, empty: 'Nenhum furo ou vaga aberta no período.', columns: [
          { header: 'Data', key: 'date', type: 'date' },
          { header: 'Setor', key: 'sector', width: 28 },
          { header: 'Horário', key: 'time', width: 16 },
          { header: 'Situação', key: 'status', width: 22 }
        ], rows: vacantShiftItems.map(v => ({
          date: v.date,
          sector: sector(v),
          time: hoursRange(v),
          status: isShiftPast(v) ? { v: 'Não ocupado (furo)', tone: 'bad' } : { v: 'Vaga pendente', tone: 'warn' }
        })) }
      ]);
    }

    if (wants('escalas')) {
      sheet('Plantões', REPORT_TITLES.escalas, [{ type: 'table', columns: [
        { header: 'Data', key: 'date', type: 'date' },
        { header: 'Setor', key: 'sector', width: 24 },
        { header: 'Profissional', key: 'professional', width: 28 },
        { header: 'Horário', key: 'time', width: 16 },
        { header: 'Situação', key: 'status', width: 16 },
        { header: 'Horas', key: 'hours', type: 'hours' },
        { header: 'Custo estimado', key: 'cost', type: 'money' }
      ], rows: filteredShifts.map(s => {
        const vacant = isVacant(s);
        const past = isShiftPast(s);
        return {
          _tone: vacant ? (past ? 'bad' : 'warn') : undefined,
          date: s.date,
          sector: sector(s),
          professional: vacant ? (past ? 'Não ocupado' : 'Vaga em aberto') : (titleCase(getShiftName(s)) || 'Não identificado'),
          time: hoursRange(s),
          status: vacant ? (past ? 'Furo de escala' : 'Vago') : titleCase(s.status || 'Confirmado'),
          hours: getShiftHours(s),
          cost: shiftCost(s)
        };
      }), totals: {
        label: `Total (${filteredShifts.length})`,
        hours: filteredShifts.reduce((sum, s) => sum + getShiftHours(s), 0),
        cost: filteredShifts.reduce((sum, s) => sum + shiftCost(s), 0)
      } }]);
    }

    if (wants('trocas')) {
      sheet('Trocas', REPORT_TITLES.trocas, [{ type: 'table', empty: 'Nenhuma troca ou repasse no período.', columns: [
        { header: 'Data', key: 'date', type: 'date' },
        { header: 'Setor', key: 'sector', width: 24 },
        { header: 'Horário', key: 'time', width: 16 },
        { header: 'Solicitante', key: 'requester', width: 26 },
        { header: 'Assumido por', key: 'current', width: 26 },
        { header: 'Situação', key: 'status', width: 20 }
      ], rows: swapsList.map(s => ({
        date: s.date,
        sector: sector(s),
        time: hoursRange(s),
        requester: s.requester,
        current: s.currentProf,
        status: { v: s.swapStatus, tone: s.swapStatus === 'Aguardando Gestão' ? 'warn' : 'good' }
      })) }]);
    }

    if (wants('base_setores')) {
      sheet('Setores', REPORT_TITLES.base_setores, [{ type: 'table', columns: [
        { header: 'Setor', key: 'name', width: 28, bold: true },
        { header: 'Especialidade', key: 'specialty', width: 22 },
        { header: 'Situação', key: 'status', width: 12 },
        { header: 'Plantões', key: 'shifts', type: 'int' },
        { header: 'Custo projetado', key: 'cost', type: 'money', width: 17 }
      ], rows: enrichedSectors.map(s => ({
        name: titleCase(s.name),
        specialty: s.specialty || 'Não definida',
        status: titleCase(s.status || 'Ativo'),
        shifts: s.shiftsCount,
        cost: s.totalCost
      })), totals: {
        shifts: enrichedSectors.reduce((sum, s) => sum + (s.shiftsCount || 0), 0),
        cost: enrichedSectors.reduce((sum, s) => sum + (s.totalCost || 0), 0)
      } }]);
    }

    if (wants('base_profissionais')) {
      sheet('Corpo clínico', REPORT_TITLES.base_profissionais, [{ type: 'table', columns: [
        { header: 'Nome', key: 'name', width: 28, bold: true },
        { header: 'Especialidade', key: 'specialty', width: 18 },
        { header: 'Situação', key: 'status', width: 11 },
        { header: 'Documento (CRM)', key: 'document', width: 15 },
        { header: 'Validade', key: 'expiry', type: 'date' },
        { header: 'Telefone', key: 'phone', width: 16 },
        { header: 'E-mail', key: 'email', width: 26 },
        { header: 'Regime', key: 'regime', width: 14 },
        { header: `Remuneração (${hospitalName})`, key: 'pay', width: 24 },
        { header: 'Banco', key: 'bank', width: 16 },
        { header: 'Chave PIX', key: 'pix', width: 22 }
      ], rows: filteredProfessionals.map(p => {
        const expiry = p.document_expiry || p.documentExpiry || p.valid_until;
        return {
          name: titleCase(p.name),
          specialty: p.specialty || '',
          status: titleCase(p.status || 'Ativo'),
          document: p.document || '',
          expiry: expiry ? { v: expiry, tone: isExpired(expiry) ? 'bad' : undefined } : null,
          phone: p.phone || p.telefone || '',
          email: p.email || '',
          regime: titleCase(p.remuneration_type || p.payment_type || DEFAULT_REMUNERATION_TYPE),
          pay: getProfessionalRemuneration(p, selectedUnitId),
          bank: p.bank_name || p.banco || '',
          pix: p.pix_key || p.chave_pix || p.pix || ''
        };
      }) }]);
    }

    if (wants('aniversariantes')) {
      sheet('Aniversariantes', `${REPORT_TITLES.aniversariantes} (${birthDaysList.length})`, [{ type: 'table', empty: 'Nenhum aniversariante no período.', columns: [
        { header: 'Dia', key: 'day', width: 10 },
        { header: 'Nome', key: 'name', width: 30, bold: true },
        { header: 'Completa (anos)', key: 'age', type: 'int', width: 14 },
        { header: 'Especialidade', key: 'specialty', width: 22 }
      ], rows: birthDaysList.map(p => ({ day: p.birthDateFormatted, name: titleCase(p.name), age: p.ageTurns, specialty: p.specialty || 'Geral' })) }]);
    }

    if (wants('profissionais')) {
      sheet('Produtividade', REPORT_TITLES.profissionais, [{ type: 'table', columns: [
        { header: 'Profissional', key: 'name', width: 28, bold: true },
        { header: 'Especialidade', key: 'specialty', width: 20 },
        { header: 'Setores no período', key: 'sectors', width: 30 },
        { header: 'Plantões', key: 'shifts', type: 'int' },
        { header: 'Horas', key: 'hours', type: 'hours' },
        { header: 'Honorários brutos', key: 'cost', type: 'money', width: 18 }
      ], rows: professionalMetrics.map(doc => ({ name: doc.name, specialty: doc.specialty, sectors: doc.sectors, shifts: doc.shifts, hours: doc.hours, cost: doc.cost })), totals: {
        shifts: professionalMetrics.reduce((sum, doc) => sum + doc.shifts, 0),
        hours: professionalMetrics.reduce((sum, doc) => sum + doc.hours, 0),
        cost: professionalMetrics.reduce((sum, doc) => sum + doc.cost, 0)
      } }]);
    }

    if (wants('confiabilidade') && (activeTab === 'confiabilidade' || reliabilityRows.length)) {
      sheet('Confiabilidade', REPORT_TITLES.confiabilidade, [
        { type: 'note', text: 'Índice = plantões que a pessoa manteve ÷ plantões que eram dela (mantidos + repassados ao Mural). Vagas cobertas = vagas abertas ou repasses de colegas que ela assumiu. Faltas e ponto não entram.' },
        { type: 'table', empty: 'Nenhum plantão de profissional no período.', columns: [
          { header: '#', key: 'rank', type: 'int', width: 6 },
          { header: 'Profissional', key: 'name', width: 28, bold: true },
          { header: 'Especialidade', key: 'specialty', width: 18 },
          { header: 'Escalados', key: 'scheduled', type: 'int' },
          { header: 'Realizados', key: 'done', type: 'int' },
          { header: 'Horas', key: 'hours', type: 'int', width: 9 },
          { header: 'Noites', key: 'nights', type: 'int', width: 9 },
          { header: 'Fins de semana', key: 'weekends', type: 'int' },
          { header: 'Vagas cobertas', key: 'covered', type: 'int' },
          { header: 'Repasses', key: 'released', type: 'int' },
          { header: 'Trocas diretas', key: 'directSwaps', type: 'int' },
          { header: 'Índice', key: 'index', type: 'percent' }
        ], rows: reliabilityRows.map((row, i) => ({
          ...row,
          rank: i + 1,
          index: row.index === null ? { v: '—', tone: 'muted' } : { v: row.index, tone: row.index >= 95 ? 'good' : row.index >= 85 ? 'warn' : 'bad' }
        })) }
      ]);
    }

    if (wants('produtividade_diaria')) {
      const pr = productivityReport;
      sheet('Apuração por dia', REPORT_TITLES.produtividade_diaria, [
        { type: 'note', tone: pr.available ? undefined : 'warn', text: pr.available
          ? `Pool diário configurado: ${formatCurrency(pr.dailyPool)}. Rateio proporcional aos atendimentos; o dia só fecha depois que todos os profissionais produtivos escalados forem conferidos e os plantões terminarem.`
          : pr.error || `A regra de produtividade não está configurada para ${hospitalName}; não há valores apurados.` },
        ...(pr.available ? [{ type: 'summary', title: 'Consolidado do período', items: [
          { label: 'Atendimentos em dias fechados', value: pr.totals.attendance, type: 'int' },
          { label: 'Plantões produtivos', value: pr.totals.shifts, type: 'int' },
          { label: 'Pool rateado', value: pr.totals.pool, type: 'money' },
          { label: 'Dias pendentes', value: pr.totals.pendingDays, type: 'int', tone: pr.totals.pendingDays ? 'warn' : 'good' }
        ] }] : []),
        { type: 'table', columns: [
          { header: 'Data', key: 'date', type: 'date' },
          { header: 'Atendimentos', key: 'attendance', type: 'int' },
          { header: 'Plantões', key: 'shifts', type: 'int' },
          { header: 'Pool aplicado', key: 'pool', type: 'money' },
          { header: 'Valor por atendimento', key: 'rate', type: 'rate', width: 18 },
          { header: 'Situação', key: 'status', width: 34 }
        ], rows: pr.days.map(day => ({
          date: day.date,
          attendance: day.complete ? day.totalAttendance : 'Pendente',
          shifts: day.items.reduce((sum, item) => sum + item.shifts, 0),
          pool: day.complete ? (day.totalAttendance > 0 ? day.poolAmount : 0) : '—',
          rate: day.complete && day.totalAttendance > 0 ? day.poolAmount / day.totalAttendance : '—',
          status: { v: getProductivityDayStatus(day), tone: day.complete ? 'good' : 'warn' }
        })) }
      ]);
      sheet('Rateio por dia', 'Rateio por profissional e dia', [
        { type: 'table', columns: [
          { header: 'Data', key: 'date', type: 'date' },
          { header: 'Profissional', key: 'name', width: 26 },
          { header: 'Especialidade', key: 'specialty', width: 18 },
          { header: 'Setor(es)', key: 'sectors', width: 18 },
          { header: 'Plantões', key: 'shifts', type: 'int' },
          { header: 'Atendimentos do dia', key: 'dayTotal', type: 'int' },
          { header: 'Atendimentos individuais', key: 'attendance', type: 'int' },
          { header: 'Valor por atendimento', key: 'rate', type: 'rate' },
          { header: 'Valor rateado', key: 'amount', type: 'money' },
          { header: 'Situação', key: 'status', width: 34 }
        ], rows: pr.rows.map(row => {
          const daily = pr.days.find(day => day.date === row.date);
          return {
            date: row.date,
            name: titleCase(row.professional.name),
            specialty: row.professional.specialty || '—',
            sectors: row.sectors,
            shifts: row.shifts,
            dayTotal: row.complete ? daily?.totalAttendance : 'Pendente',
            attendance: row.attendance ?? 'Não lançado',
            rate: row.unitRate === null ? '—' : row.unitRate,
            amount: row.complete ? row.amount : '—',
            status: row.complete ? { v: 'Rateado', tone: 'good' } : { v: `Pendente · ${row.pendingReason}`, tone: 'warn' }
          };
        }) }
      ]);
      sheet('Acumulado', 'Produtividade acumulada por profissional', [
        { type: 'table', columns: [
          { header: 'Profissional', key: 'name', width: 26, bold: true },
          { header: 'Especialidade', key: 'specialty', width: 18 },
          { header: 'Plantões', key: 'shifts', type: 'int' },
          { header: 'Atendimentos fechados', key: 'attendance', type: 'int' },
          { header: 'Valor acumulado', key: 'amount', type: 'money' },
          { header: 'Dias pendentes', key: 'pending', type: 'int' },
          { header: 'Situação', key: 'status', width: 16 }
        ], rows: pr.professionalTotals.map(item => ({
          name: titleCase(item.professional.name),
          specialty: item.professional.specialty || '—',
          shifts: item.shifts,
          attendance: item.attendance,
          amount: item.amount,
          pending: item.pendingDays,
          status: item.pendingDays ? { v: 'Saldo parcial', tone: 'warn' } : { v: 'Completo', tone: 'good' }
        })) }
      ]);
    }

    if (wants('produtividade_profissional') && selectedProductivitySummary) {
      const summary = selectedProductivitySummary;
      sheet('Extrato individual', REPORT_TITLES.produtividade_profissional, [
        { type: 'summary', items: [
          { label: 'Profissional', value: titleCase(summary.professional.name) },
          { label: 'Especialidade', value: summary.professional.specialty || '—' },
          { label: 'Valor fechado no período', value: summary.amount, type: 'money' },
          { label: 'Dias pendentes', value: summary.pendingDays, type: 'int', tone: summary.pendingDays ? 'warn' : 'good' }
        ] },
        { type: 'note', text: `Valor por atendimento = pool diário (${formatCurrency(productivityReport.dailyPool)}) ÷ total de atendimentos da unidade no dia. Valor individual = atendimentos do profissional × valor por atendimento. Dias pendentes não entram no saldo fechado.` },
        { type: 'table', columns: [
          { header: 'Data', key: 'date', type: 'date' },
          { header: 'Setor(es)', key: 'sectors', width: 22 },
          { header: 'Plantões', key: 'shifts', type: 'int' },
          { header: 'Atendimentos do profissional', key: 'attendance', type: 'int', width: 15 },
          { header: 'Atendimentos no dia', key: 'dayTotal', type: 'int', width: 14 },
          { header: 'Valor por atendimento', key: 'rate', type: 'rate', width: 15 },
          { header: 'Valor rateado', key: 'amount', type: 'money' },
          { header: 'Situação', key: 'status', width: 34 }
        ], rows: selectedProductivityRows.map(row => {
          const day = productivityReport.days.find(item => item.date === row.date);
          return {
            date: row.date,
            sectors: row.sectors,
            shifts: row.shifts,
            attendance: row.attendance ?? 'Não lançado',
            dayTotal: row.complete ? day?.totalAttendance : 'Pendente',
            rate: row.unitRate === null ? '—' : row.unitRate,
            amount: row.complete ? row.amount : '—',
            status: row.complete ? { v: 'Rateado', tone: 'good' } : { v: `Pendente · ${row.pendingReason}`, tone: 'warn' }
          };
        }), totals: { label: 'Total fechado', shifts: summary.shifts, attendance: summary.attendance, amount: summary.amount } }
      ]);
    }

    if (wants('financeiro')) {
      const fs = financialSummary;
      sheet('Financeiro', REPORT_TITLES.financeiro, [
        { type: 'summary', items: [
          { label: 'Previsão das escalas ocupadas', value: fs.totalCost, type: 'money' },
          { label: 'Realizado (plantões concluídos)', value: fs.executedCost, type: 'money', tone: 'good' },
          { label: 'Pendente a realizar', value: fs.pendingCost, type: 'money', tone: 'warn' },
          { label: 'Retido (vagas e furos)', value: fs.vacantCost, type: 'money', tone: 'bad' }
        ] },
        { type: 'note', text: 'Mesma base do Faturamento: salário mensal proporcional aos dias do período e dividido entre os plantões do profissional; produtividade pelo rateio dos dias fechados; demais regimes pela tarifa cadastrada.' },
        ...(fs.shiftsMissingRate > 0 || fs.shiftsAwaitingProduction > 0 ? [{ type: 'note', tone: 'warn', text: `Atenção: ${fs.shiftsMissingRate} plantão(ões) sem tarifa ou profissional identificado; ${fs.shiftsAwaitingProduction} plantão(ões) por produtividade aguardam lançamento. Valores pendentes não entram nos totais.` }] : []),
        { type: 'table', title: 'Custos por setor', columns: [
          { header: 'Setor', key: 'name', width: 30, bold: true },
          { header: 'Plantões', key: 'total', type: 'int' },
          { header: 'Vagos', key: 'vacant', type: 'int', width: 9 },
          { header: 'Horas', key: 'hours', type: 'hours' },
          { header: 'Custo', key: 'cost', type: 'money', width: 18 }
        ], rows: sectorMetrics.map(sec => ({ name: sec.name, total: sec.total, vacant: sec.vacant ? { v: sec.vacant, tone: 'warn' } : 0, hours: sec.hours, cost: sec.cost })), totals: {
          total: sectorMetrics.reduce((sum, sec) => sum + sec.total, 0),
          vacant: sectorMetrics.reduce((sum, sec) => sum + sec.vacant, 0),
          hours: sectorMetrics.reduce((sum, sec) => sum + sec.hours, 0),
          cost: sectorMetrics.reduce((sum, sec) => sum + sec.cost, 0)
        } }
      ]);
    }

    if (!book.wb.worksheets.length) {
      alert('Este relatório não tem dados para exportar.');
      return;
    }
    const name = mode === 'all' ? 'Relatório completo' : (REPORT_TITLES[activeTab] || 'Relatório');
    await downloadWorkbook(book, excelFileName(name, hospitalName, `${formatDate(appliedFilters.start).replace(/\//g, '-')} a ${formatDate(appliedFilters.end).replace(/\//g, '-')}`));
  } catch (error) {
    console.error('Falha ao gerar a planilha do relatório:', error);
    alert(`Não foi possível gerar a planilha. ${error?.message || 'Tente novamente.'}`);
  }
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
