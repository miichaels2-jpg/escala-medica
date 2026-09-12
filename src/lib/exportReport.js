import { jsPDF } from 'jspdf';

// Paleta Executiva Padrão ScaleMedic
const COLORS = {
  headerBg: [15, 23, 42],       // Slate 900 #0f172a
  accentSky: [2, 132, 199],      // Sky 600 #0284c7
  bgLight: [248, 250, 252],      // Slate 50 #f8fafc
  border: [226, 232, 240],       // Slate 200 #e2e8f0
  textDark: [15, 23, 42],        // Slate 900
  textMuted: [100, 116, 139],    // Slate 500
  diurnoBg: [240, 249, 255],     // Sky 50
  diurnoText: [3, 105, 161],     // Sky 700
  noturnoBg: [238, 242, 255],    // Indigo 50
  noturnoText: [67, 56, 202],    // Indigo 700
  vacantBg: [254, 252, 232],     // Amber 50
  vacantText: [180, 83, 9],      // Amber 700
  concludedBg: [239, 246, 255],  // Blue 50
  concludedText: [29, 78, 216],  // Blue 700
  activeBg: [236, 253, 245],     // Emerald 50
  activeText: [4, 120, 87],      // Emerald 700
};

function addBrandHeaderLandscape(doc, company, title, subtitle) {
  const W = doc.internal.pageSize.getWidth();
  const left = 32;

  // Barra Superior Slate 900
  doc.setFillColor(...COLORS.headerBg);
  doc.rect(0, 0, W, 58, 'F');

  // Linha de detalhe Sky 600
  doc.setFillColor(...COLORS.accentSky);
  doc.rect(0, 58, W, 3, 'F');

  // Identidade / Nome da Unidade
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text((company?.app_name || 'ScaleMedic CGT').toUpperCase(), left, 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`Unidade: ${company?.name || 'Hospital Santa Clara'} · CNPJ: ${company?.cnpj || '00.000.000/0001-00'}`, left, 42);

  // Título e Período à direita
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text((title || 'RELATÓRIO DE ESCALA').toUpperCase(), W - 32, 26, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(186, 230, 253);
  doc.text((subtitle || 'Período Vigente').toUpperCase(), W - 32, 42, { align: 'right' });
}

function addBrandHeaderPortrait(doc, company, title, subtitle) {
  const W = doc.internal.pageSize.getWidth();
  const left = 36;

  doc.setFillColor(...COLORS.headerBg);
  doc.rect(0, 0, W, 62, 'F');

  doc.setFillColor(...COLORS.accentSky);
  doc.rect(0, 62, W, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text((company?.app_name || 'ScaleMedic CGT').toUpperCase(), left, 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`Unidade: ${company?.name || 'Hospital Santa Clara'} · CNPJ: ${company?.cnpj || '00.000.000/0001-00'}`, left, 44);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(186, 230, 253);
  doc.text((subtitle || title || 'RELATÓRIO GERENCIAL').toUpperCase(), W - 36, 44, { align: 'right' });
}

// 1. ESCALA MÉDICA HOSPITALAR OFICIAL (A4 LANDSCAPE)
export function exportSchedulePDF({ company, shifts, monthLabel = '', dateLabel = '' }) {
  const scheduleShifts = shifts || [];
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 32;
  const marginRight = 32;
  const tableWidth = pageWidth - marginLeft - marginRight;
  const rowHeight = 26;

  addBrandHeaderLandscape(doc, company, 'Escala Médica Hospitalar', dateLabel || monthLabel || 'Escala Operacional');

  // Cálculos de Auditoria para o Topo
  const totalShifts = scheduleShifts.length;
  const vacantShifts = scheduleShifts.filter((s) => !s.professional_id || (s.professional_name || '').toLowerCase().includes('vaga')).length;
  const filledShifts = totalShifts - vacantShifts;
  const fillRate = totalShifts > 0 ? Math.round((filledShifts / totalShifts) * 100) : 100;
  const totalHours = scheduleShifts.reduce((acc, s) => acc + (Number(s.duration_hours) || 12), 0);

  // Faixa de KPIs Operacionais do Topo
  const kpiTop = 72;
  const kpiHeight = 36;
  const kpiWidth = (tableWidth - 24) / 4;

  const kpis = [
    { label: 'TURNOS NA GRADE', val: `${totalShifts} plantões` },
    { label: 'COBERTURA EFETIVA', val: `${fillRate}% preenchidos` },
    { label: 'VAGAS DESCOBERTAS', val: `${vacantShifts} desfalques` },
    { label: 'CARGA HORÁRIA TOTAL', val: `${totalHours} horas` },
  ];

  kpis.forEach((k, idx) => {
    const kx = marginLeft + idx * (kpiWidth + 8);
    doc.setFillColor(...COLORS.bgLight);
    doc.roundedRect(kx, kpiTop, kpiWidth, kpiHeight, 6, 6, 'F');
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(kx, kpiTop, kpiWidth, kpiHeight, 6, 6, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(k.label, kx + 10, kpiTop + 14);

    doc.setFontSize(11);
    doc.setTextColor(...COLORS.textDark);
    doc.text(k.val, kx + 10, kpiTop + 28);
  });

  // Cabeçalho da Tabela
  const tableTop = kpiTop + kpiHeight + 14;
  doc.setFillColor(...COLORS.headerBg);
  doc.roundedRect(marginLeft, tableTop, tableWidth, 24, 6, 6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);

  const colData = marginLeft + 12;
  const colHora = marginLeft + 95;
  const colTurno = marginLeft + 200;
  const colSetor = marginLeft + 290;
  const colProf = marginLeft + 440;
  const colStatus = marginLeft + 640;

  doc.text('DATA / DIA', colData, tableTop + 16);
  doc.text('HORÁRIO', colHora, tableTop + 16);
  doc.text('TURNO', colTurno, tableTop + 16);
  doc.text('SETOR HOSPITALAR', colSetor, tableTop + 16);
  doc.text('PROFISSIONAL PLANTONISTA', colProf, tableTop + 16);
  doc.text('STATUS OPERACIONAL', colStatus, tableTop + 16);

  let y = tableTop + 30;

  if (!scheduleShifts.length) {
    doc.setFillColor(...COLORS.bgLight);
    doc.roundedRect(marginLeft, y, tableWidth, 40, 6, 6, 'F');
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(marginLeft, y, tableWidth, 40, 6, 6, 'S');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.textMuted);
    doc.text('Nenhum plantão agendado para o período ou filtros selecionados.', marginLeft + 16, y + 24);
  } else {
    scheduleShifts.forEach((s, idx) => {
      // Quebra de página segura
      if (y > pageHeight - 55) {
        doc.addPage();
        addBrandHeaderLandscape(doc, company, 'Escala Médica Hospitalar (Cont.)', dateLabel || monthLabel);
        y = 75;

        doc.setFillColor(...COLORS.headerBg);
        doc.roundedRect(marginLeft, y, tableWidth, 24, 6, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text('DATA / DIA', colData, y + 16);
        doc.text('HORÁRIO', colHora, y + 16);
        doc.text('TURNO', colTurno, y + 16);
        doc.text('SETOR HOSPITALAR', colSetor, y + 16);
        doc.text('PROFISSIONAL PLANTONISTA', colProf, y + 16);
        doc.text('STATUS OPERACIONAL', colStatus, y + 16);
        y += 30;
      }

      const isEven = idx % 2 === 0;
      const isVacant = !s.professional_id || (s.professional_name || '').toLowerCase().includes('vaga');
      const isNight = s.shift_type === 'noturno' || (s.start_time >= '18:00' || s.start_time < '06:00');

      // Fundo zebra suave
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.roundedRect(marginLeft, y, tableWidth, rowHeight, 4, 4, 'F');
      doc.setDrawColor(...COLORS.border);
      doc.roundedRect(marginLeft, y, tableWidth, rowHeight, 4, 4, 'S');

      // Data formatada DD/MM (Semana)
      const cleanDate = (s.date || '').split('T')[0];
      const [yyyy, mm, dd] = cleanDate.split('-');
      const dObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      const wDay = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dObj.getDay()] || '';
      const dateText = `${dd}/${mm} (${wDay})`;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.textDark);
      doc.text(dateText, colData, y + 17);

      // Horário
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(`${s.start_time || '--:--'} às ${s.end_time || '--:--'} (${s.duration_hours || 12}h)`, colHora, y + 17);

      // Tag Turno (Diurno ou Noturno suave)
      const shiftTagColor = isNight ? COLORS.noturnoBg : COLORS.diurnoBg;
      const shiftTextColor = isNight ? COLORS.noturnoText : COLORS.diurnoText;
      doc.setFillColor(...shiftTagColor);
      doc.roundedRect(colTurno, y + 5, 66, 16, 4, 4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...shiftTextColor);
      doc.text(isNight ? 'NOTURNO' : 'DIURNO', colTurno + 8, y + 16);

      // Setor
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.textDark);
      doc.text(s.sector_name || 'Setor Geral', colSetor, y + 17, { maxWidth: 140 });

      // Profissional Plantonista
      if (isVacant) {
        doc.setFillColor(...COLORS.vacantBg);
        doc.roundedRect(colProf - 4, y + 4, 150, 18, 4, 4, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...COLORS.vacantText);
        doc.text('⚠️ VAGA EM ABERTO', colProf, y + 16);
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...COLORS.textDark);
        doc.text(s.professional_name || 'Profissional', colProf, y + 17, { maxWidth: 180 });
      }

      // Status Operacional
      const st = s.lifecycle?.state;
      let statusLabel = 'PROGRAMADO';
      let statusBg = COLORS.bgLight;
      let statusTextColor = COLORS.textMuted;

      if (isVacant) {
        statusLabel = 'DESCOBERTO';
        statusBg = COLORS.vacantBg;
        statusTextColor = COLORS.vacantText;
      } else if (st === 'active') {
        statusLabel = '● EM PLANTÃO';
        statusBg = COLORS.activeBg;
        statusTextColor = COLORS.activeText;
      } else if (st === 'concluded' || st === 'recently_finished') {
        statusLabel = '✓ CONCLUÍDO';
        statusBg = COLORS.concludedBg;
        statusTextColor = COLORS.concludedText;
      }

      doc.setFillColor(...statusBg);
      doc.roundedRect(colStatus, y + 5, 88, 16, 4, 4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...statusTextColor);
      doc.text(statusLabel, colStatus + 8, y + 16);

      y += rowHeight + 3;
    });
  }

  // Rodapé Institucional
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(
      `ScaleMedic CGT · Sistema Integrado de Gestão Hospitalar · Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
      marginLeft,
      pageHeight - 16
    );
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - marginRight, pageHeight - 16, { align: 'right' });
  }

  doc.save(`escala-hospitalar-${cleanFilename(dateLabel || monthLabel || 'geral')}.pdf`);
}

// 2. RECIBO / CONTRACHEQUE EM 2 VIAS (A4 LANDSCAPE COM CORTE PONTILHADO)
export function exportProfessionalReceiptPDF({ company, professional, records, monthLabel = '' }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 28;
  const gap = 20;
  const boxWidth = (pageWidth - margin * 2 - gap) / 2;
  const boxHeight = pageHeight - margin * 2;
  const total = records.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
  const totalHours = records.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
  const issuedAt = `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`;

  const renderReceipt = (x, y, width, height, sideLabel, isHospital) => {
    // Card Base
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, width, height, 8, 8, 'F');
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(x, y, width, height, 8, 8, 'S');

    // Cabeçalho da Via
    doc.setFillColor(...COLORS.headerBg);
    doc.rect(x, y, width, 44, 'F');
    doc.setFillColor(...COLORS.accentSky);
    doc.rect(x, y + 44, width, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text((company?.name || 'Hospital Santa Clara').toUpperCase(), x + 14, y + 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    doc.text(`CNPJ: ${company?.cnpj || '00.000.000/0001-00'} · ${company?.address || 'Centro Hospitalar'}`, x + 14, y + 34);

    // Tag da Via
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(186, 230, 253);
    doc.text(sideLabel, x + width - 14, y + 26, { align: 'right' });

    let curY = y + 58;

    // Dados do Profissional
    doc.setFillColor(...COLORS.bgLight);
    doc.roundedRect(x + 12, curY, width - 24, 62, 6, 6, 'F');
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(x + 12, curY, width - 24, 62, 6, 6, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textMuted);
    doc.text('PROFISSIONAL CREDENCIADO', x + 20, curY + 14);
    doc.text('CONTRATO / REPASSE', x + width / 2 + 10, curY + 14);

    doc.setFontSize(10);
    doc.setTextColor(...COLORS.textDark);
    doc.text(professional?.name || 'Profissional', x + 20, curY + 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${professional?.specialty || 'Clínica Geral'} · CRM/Reg: ${professional?.document || '—'}`, x + 20, curY + 41);
    doc.text(`Chave PIX: ${professional?.pix_key || 'Não informada'}`, x + 20, curY + 53);

    const remType = (professional?.remuneration_type || 'hora').toUpperCase();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`MODALIDADE: ${remType}`, x + width / 2 + 10, curY + 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Competência: ${monthLabel || 'Mês Corrente'}`, x + width / 2 + 10, curY + 41);
    doc.text(`Plantões Cumpridos: ${records.length} turnos (${totalHours}h)`, x + width / 2 + 10, curY + 53);

    curY += 72;

    // Tabela de Detalhamento
    doc.setFillColor(...COLORS.headerBg);
    doc.roundedRect(x + 12, curY, width - 24, 18, 4, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('DATA', x + 20, curY + 12);
    doc.text('SETOR', x + 80, curY + 12);
    doc.text('HORAS', x + 180, curY + 12);
    doc.text('VALOR LIBERADO', x + width - 24, curY + 12, { align: 'right' });

    curY += 22;
    records.slice(0, 6).forEach((r) => {
      const dt = r.date ? new Date(r.date + 'T00:00').toLocaleDateString('pt-BR') : '—';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.textDark);
      doc.text(dt, x + 20, curY + 10);
      doc.text(r.sector_name || 'Geral', x + 80, curY + 10, { maxWidth: 90 });
      doc.text(`${r.hours || 12}h`, x + 180, curY + 10);
      doc.setFont('helvetica', 'bold');
      doc.text(`R$ ${(Number(r.value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, x + width - 24, curY + 10, { align: 'right' });
      curY += 15;
    });

    if (records.length > 6) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLORS.textMuted);
      doc.text(`+ ${records.length - 6} outros plantões cumpridos no período`, x + 20, curY + 8);
    }

    // Box do Total Líquido
    const totalBoxY = y + height - 120;
    doc.setFillColor(...COLORS.activeBg);
    doc.roundedRect(x + 12, totalBoxY, width - 24, 30, 6, 6, 'F');
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(x + 12, totalBoxY, width - 24, 30, 6, 6, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.activeText);
    doc.text('VALOR LÍQUIDO A RECEBER:', x + 22, totalBoxY + 19);

    doc.setFontSize(13);
    doc.text(`R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, x + width - 22, totalBoxY + 20, { align: 'right' });

    // Assinaturas
    const sigY = y + height - 42;
    const halfWidth = (width - 48) / 2;

    doc.setDrawColor(...COLORS.textMuted);
    doc.line(x + 14, sigY, x + 14 + halfWidth, sigY);
    doc.line(x + 24 + halfWidth, sigY, x + width - 14, sigY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.textMuted);
    doc.text('Assinatura do Profissional', x + 14 + halfWidth / 2, sigY + 10, { align: 'center' });
    doc.text('Diretoria Médica / Financeiro', x + 24 + halfWidth + halfWidth / 2, sigY + 10, { align: 'center' });

    // Rodapé da Via
    doc.setFontSize(6.5);
    doc.text(`Emitido em ${issuedAt} · Autenticação SM-${(professional?.id || 'REC').slice(0, 8).toUpperCase()}`, x + 14, y + height - 10);
  };

  // Renderiza Via 1 (Hospital) e Via 2 (Profissional)
  renderReceipt(margin, margin, boxWidth, boxHeight, '1ª VIA · HOSPITAL / ADMINISTRAÇÃO', true);
  renderReceipt(margin + boxWidth + gap, margin, boxWidth, boxHeight, '2ª VIA · PROFISSIONAL CREDENCIADO', false);

  // Linha de Picote Central
  const cutX = margin + boxWidth + gap / 2;
  doc.setDrawColor(...COLORS.textMuted);
  doc.setLineDashPattern([3, 3], 0);
  doc.line(cutX, margin, cutX, margin + boxHeight);
  doc.setLineDashPattern([], 0);

  doc.save(`recibo-repasse-${cleanFilename(professional?.name || 'profissional')}.pdf`);
}

// 3. RELATÓRIO GERENCIAL DE COBERTURA E HORAS (A4 PORTRAIT)
export function exportReportPDF({ company, byProfessional = [], bySector = [], overview = {}, monthLabel = '' }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const left = 36;
  const contentWidth = W - left * 2;

  addBrandHeaderPortrait(doc, company, 'Relatório Gerencial de Escalas', monthLabel ? `Mês: ${monthLabel}` : 'Visão Geral');

  let y = 82;

  // Box de Indicadores Gerais
  doc.setFillColor(...COLORS.bgLight);
  doc.roundedRect(left, y, contentWidth, 54, 6, 6, 'F');
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(left, y, contentWidth, 54, 6, 6, 'S');

  const kpis = [
    { label: 'TOTAL DE PLANTÕES', val: `${overview.total || 0}` },
    { label: 'CONFIRMADOS', val: `${overview.confirmed || 0}` },
    { label: 'PENDENTES', val: `${overview.pending || 0}` },
    { label: 'VAGAS ABERTAS', val: `${overview.open || 0}` },
  ];

  const colW = contentWidth / 4;
  kpis.forEach((k, idx) => {
    const kx = left + idx * colW + 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(k.label, kx, y + 20);

    doc.setFontSize(14);
    doc.setTextColor(...COLORS.textDark);
    doc.text(k.val, kx, y + 40);
  });

  y += 72;

  // Seção 1: Produtividade por Profissional
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.textDark);
  doc.text('HORAS E PLANTÕES POR PROFISSIONAL', left, y);
  y += 14;

  doc.setFillColor(...COLORS.headerBg);
  doc.roundedRect(left, y, contentWidth, 20, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('PROFISSIONAL', left + 10, y + 13);
  doc.text('CATEGORIA', left + 200, y + 13);
  doc.text('CONFIRMADOS', left + 330, y + 13);
  doc.text('TOTAL HORAS', left + contentWidth - 14, y + 13, { align: 'right' });

  y += 24;

  if (byProfessional.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.textMuted);
    doc.text('Nenhum profissional registrado no período.', left + 10, y + 12);
    y += 20;
  } else {
    byProfessional.forEach((p, idx) => {
      if (y > H - 80) {
        doc.addPage();
        addBrandHeaderPortrait(doc, company, 'Relatório Gerencial de Escalas (Cont.)', monthLabel);
        y = 80;
      }
      doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
      doc.roundedRect(left, y, contentWidth, 20, 2, 2, 'F');
      doc.setDrawColor(...COLORS.border);
      doc.roundedRect(left, y, contentWidth, 20, 2, 2, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.textDark);
      doc.text(p.name, left + 10, y + 13);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(p.category || 'Médico', left + 200, y + 13);
      doc.text(`${p.confirmed} turno(s)`, left + 330, y + 13);

      doc.setFont('helvetica', 'bold');
      doc.text(`${p.hours}h`, left + contentWidth - 14, y + 13, { align: 'right' });

      y += 23;
    });
  }

  y += 14;

  // Seção 2: Cobertura por Setor
  if (y > H - 140) {
    doc.addPage();
    addBrandHeaderPortrait(doc, company, 'Relatório Gerencial de Escalas (Cont.)', monthLabel);
    y = 80;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.textDark);
  doc.text('COBERTURA POR SETOR CLÍNICO', left, y);
  y += 14;

  doc.setFillColor(...COLORS.headerBg);
  doc.roundedRect(left, y, contentWidth, 20, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('SETOR', left + 10, y + 13);
  doc.text('TOTAL TURNOS', left + 200, y + 13);
  doc.text('DESFALQUES', left + 320, y + 13);
  doc.text('TAXA DE COBERTURA', left + contentWidth - 14, y + 13, { align: 'right' });

  y += 24;

  bySector.forEach(([name, d], idx) => {
    if (y > H - 60) {
      doc.addPage();
      addBrandHeaderPortrait(doc, company, 'Relatório Gerencial de Escalas (Cont.)', monthLabel);
      y = 80;
    }
    const pct = d.total ? Math.round((d.filled / d.total) * 100) : 100;
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.roundedRect(left, y, contentWidth, 20, 2, 2, 'F');
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(left, y, contentWidth, 20, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.textDark);
    doc.text(name, left + 10, y + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${d.total} plantão(ões)`, left + 200, y + 13);
    doc.text(`${d.open} vaga(s)`, left + 320, y + 13);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(pct < 100 ? COLORS.vacantText[0] : COLORS.activeText[0], pct < 100 ? COLORS.vacantText[1] : COLORS.activeText[1], pct < 100 ? COLORS.vacantText[2] : COLORS.activeText[2]);
    doc.text(`${pct}% coberto`, left + contentWidth - 14, y + 13, { align: 'right' });

    y += 23;
  });

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(
      `ScaleMedic CGT · Gestão Hospitalar · Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
      left,
      H - 16
    );
    doc.text(`Página ${i} de ${totalPages}`, W - left, H - 16, { align: 'right' });
  }

  doc.save(`relatorio-gerencial-${cleanFilename(monthLabel || 'mensal')}.pdf`);
}

// Helper para nomes de arquivos
function cleanFilename(str) {
  return (str || 'documento')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-');
}

// 4. EXPORTAÇÃO CSV
export function exportReportCSV({ byProfessional, bySector, overview }) {
  const rows = [];
  rows.push(['Relatório de Escalas — ScaleMedic CGT']);
  rows.push(['Emitido em', new Date().toLocaleString('pt-BR')]);
  rows.push([]);
  rows.push(['VISÃO GERAL']);
  rows.push(['Total de plantões', overview.total]);
  rows.push(['Confirmados', overview.confirmed]);
  rows.push(['Pendentes', overview.pending]);
  rows.push(['Vagas abertas', overview.open]);
  rows.push([]);
  rows.push(['HORAS POR PROFISSIONAL', 'Categoria', 'Confirmados', 'Pendentes', 'Horas']);
  byProfessional.forEach((p) => rows.push([p.name, p.category || '', p.confirmed, p.pending, p.hours]));
  rows.push([]);
  rows.push(['COBERTURA POR SETOR', 'Total', 'Preenchidos', 'Vagas', 'Cobertura %']);
  bySector.forEach(([name, d]) => {
    const pct = d.total ? Math.round((d.filled / d.total) * 100) : 0;
    rows.push([name, d.total, d.filled, d.open, `${pct}%`]);
  });

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-escalas-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}