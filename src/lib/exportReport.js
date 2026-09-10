import { jsPDF } from 'jspdf';

function addBrandHeader(doc, company, title, subtitle) {
  const left = 40;
  const W = doc.internal.pageSize.getWidth();
  const logoUrl = company?.logo_url;
  let y = 36;

  if (logoUrl) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = logoUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 40;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        doc.addImage(dataUrl, 'PNG', left, y, 110, 34);
      };
    } catch (error) {
      // ignore image issues and keep text fallback
    }
  }

  doc.setFillColor(14, 165, 233);
  doc.rect(0, 0, W, 62, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(company?.app_name || 'ScaleMedic CGT', left, 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text((subtitle || title || 'Relatório').toUpperCase(), left, 44);
  doc.text(company?.name || 'Empresa', left, 56);
  doc.setTextColor(0, 0, 0);
}

export function exportReportPDF({ company, byProfessional, bySector, overview, monthLabel = '' }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const left = 40;
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 80;

  addBrandHeader(doc, company, 'Relatório de Escalas', monthLabel ? `Mês: ${monthLabel}` : 'Escala médica');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`EMPRESA: ${company?.name || '—'}`, left, y); y += 14;
  doc.text(`EMITIDO EM: ${new Date().toLocaleString('pt-BR')}`, left, y); y += 26;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(30);
  doc.text('VISÃO GERAL', left, y); y += 18;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(60);
  [
    `TOTAL DE PLANTÕES: ${overview.total}`,
    `CONFIRMADOS: ${overview.confirmed}`,
    `PENDENTES: ${overview.pending}`,
    `VAGAS ABERTAS: ${overview.open}`,
  ].forEach((t) => { doc.text(t, left, y); y += 16; });
  y += 12;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(30);
  doc.text('HORAS POR PROFISSIONAL', left, y); y += 18;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60);
  if (byProfessional.length === 0) { doc.text('SEM DADOS SUFICIENTES.', left, y); y += 16; }
  byProfessional.forEach((p) => {
    if (y > 770) { doc.addPage(); y = 50; }
    doc.text(`${p.name} — ${p.hours}h (${p.confirmed} confirmados, ${p.pending} pendentes)`, left, y);
    y += 15;
  });
  y += 14;

  if (y > 710) { doc.addPage(); y = 50; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(30);
  doc.text('COBERTURA POR SETOR', left, y); y += 18;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60);
  if (bySector.length === 0) { doc.text('SEM DADOS SUFICIENTES.', left, y); y += 16; }
  bySector.forEach(([name, d]) => {
    if (y > 770) { doc.addPage(); y = 50; }
    const pct = d.total ? Math.round((d.filled / d.total) * 100) : 0;
    doc.text(`${name}: ${pct}% coberto · ${d.open} vagas · ${d.total} plantões`, left, y);
    y += 15;
  });

  doc.setFontSize(8); doc.setTextColor(150);
  doc.text(`${company?.app_name || 'ScaleMedic CGT'} — SISTEMA DE GESTÃO DE ESCALAS HOSPITALARES`, left, pageHeight - 18);

  doc.save(`relatorio-escalas-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportSchedulePDF({ company, shifts, monthLabel = '', dateLabel = '' }) {
  const scheduleShifts = shifts || [];
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 32;
  const marginRight = 32;
  const tableWidth = pageWidth - marginLeft - marginRight;
  const headerHeight = 62;
  const bodyTop = 104;
  const rowHeight = 34;

  doc.setFillColor(14, 165, 233);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(company?.app_name || 'ScaleMedic CGT', marginLeft, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('ESCALA DO DIA', marginLeft, 48);
  doc.text((dateLabel || monthLabel || 'ESCALA MÉDICA').toUpperCase(), pageWidth - marginRight, 48, { align: 'right', maxWidth: 300 });

  doc.setFillColor(241, 245, 249);
  doc.rect(marginLeft, bodyTop - 20, tableWidth, 52, 'F');
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`EMPRESA: ${company?.name || '—'}`, marginLeft + 12, bodyTop - 2, { maxWidth: 220 });
  doc.text(`DATA: ${dateLabel || monthLabel || 'SELECIONADA'}`.toUpperCase(), marginLeft + 260, bodyTop - 2, { maxWidth: 220 });
  doc.text(`PLANTÕES: ${scheduleShifts.length}`, marginLeft + 520, bodyTop - 2, { maxWidth: 100 });

  const cols = [
    { title: 'DATA', x: marginLeft + 12, w: 110 },
    { title: 'SETOR', x: marginLeft + 132, w: 122 },
    { title: 'PROFISSIONAL', x: marginLeft + 264, w: 170 },
    { title: 'TURNO', x: marginLeft + 444, w: 110 },
  ];

  const tableTop = bodyTop + 18;
  const headerY = tableTop + 18;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(marginLeft, tableTop, tableWidth, 28, 8, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  cols.forEach((col) => doc.text(col.title, col.x, headerY));

  doc.setDrawColor(203, 213, 225);
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');

  let y = tableTop + 42;
  if (!scheduleShifts.length) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(marginLeft, tableTop + 36, tableWidth, 52, 8, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('NENHUM PLANTÃO ENCONTRADO PARA ESTE DIA.', marginLeft + 18, tableTop + 62);
    y = tableTop + 90;
  } else {
    scheduleShifts.forEach((s) => {
      if (y > pageHeight - 70) {
        doc.addPage();
        y = 52;
        doc.setFillColor(14, 165, 233);
        doc.rect(0, 0, pageWidth, 46, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text((company?.app_name || 'ScaleMedic CGT').toUpperCase(), marginLeft, 28);
      }

      doc.setFillColor(255, 255, 255);
      doc.roundedRect(marginLeft, y, tableWidth, rowHeight, 6, 6, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(marginLeft, y, tableWidth, rowHeight, 6, 6, 'S');

      const dateLabel = new Date(s.date + 'T00:00').toLocaleDateString('pt-BR');
      doc.text(dateLabel, marginLeft + 18, y + 14, { maxWidth: 95 });
      doc.text(doc.splitTextToSize(s.sector_name || '—', 112), marginLeft + 142, y + 12, { lineHeightFactor: 1.1 });
      doc.text(doc.splitTextToSize(s.professional_name || 'SEM PROFISSIONAL', 155), marginLeft + 274, y + 12, { lineHeightFactor: 1.1 });
      doc.text(`${s.start_time || '--'} - ${s.end_time || '--'}`, marginLeft + 456, y + 14, { maxWidth: 95 });

      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      y += rowHeight + 2;
    });
  }

  doc.setFontSize(8); doc.setTextColor(148, 163, 184);
  doc.text(`${company?.app_name || 'ScaleMedic CGT'} • ESCALA MÉDICA • ${dateLabel || monthLabel || 'DIA ATUAL'}`.toUpperCase(), marginLeft, pageHeight - 18);
  doc.save(`escala-${dateLabel ? new Date().toISOString().slice(0, 10) : 'dia'}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportProfessionalReceiptPDF({ company, professional, records, monthLabel = '' }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 24;
  const gap = 18;
  const boxWidth = (pageWidth - margin * 2 - gap) / 2;
  const boxHeight = pageHeight - margin * 2 - 8;
  const total = records.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
  const totalHours = records.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
  const issuedAt = new Date().toLocaleDateString('pt-BR');

  const renderReceipt = (x, y, width, height, sideLabel) => {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, width, height, 10, 10, 'F');
    doc.setDrawColor(14, 165, 233);
    doc.setLineWidth(1.2);
    doc.roundedRect(x, y, width, height, 10, 10, 'S');

    doc.setFillColor(14, 165, 233);
    doc.rect(x, y, width, 52, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(company?.app_name || 'ScaleMedic CGT', x + 18, y + 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(sideLabel || 'VIA DO CREDOR', x + 18, y + 38);

    doc.setTextColor(44, 62, 80);
    let currentY = y + 72;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('DADOS DA EMPRESA', x + 18, currentY); currentY += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Nome: ${company?.name || 'Empresa'}`, x + 18, currentY); currentY += 13;
    doc.text(`CNPJ: ${company?.cnpj || 'Não informado'}`, x + 18, currentY); currentY += 13;
    doc.text(`Período: ${monthLabel || 'Mensal'}`, x + 18, currentY); currentY += 16;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('DADOS DO PROFISSIONAL', x + 18, currentY); currentY += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Nome: ${professional?.name || '—'}`, x + 18, currentY, { maxWidth: width - 36 }); currentY += 13;
    doc.text(`Cargo: ${professional?.role || professional?.specialty || professional?.category || 'Profissional'}`, x + 18, currentY, { maxWidth: width - 36 }); currentY += 13;
    doc.text(`Setor de atuação: ${professional?.sector_name || professional?.specialty || 'Não informado'}`, x + 18, currentY, { maxWidth: width - 36 }); currentY += 13;
    doc.text(`Registro: ${professional?.document || 'Não informado'}`, x + 18, currentY, { maxWidth: width - 36 }); currentY += 13;
    doc.text(`Horas trabalhadas: ${totalHours}h`, x + 18, currentY); currentY += 13;
    doc.text(`Valor líquido do período: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, x + 18, currentY, { maxWidth: width - 36 }); currentY += 18;

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(x + 18, currentY, width - 36, 112, 8, 8, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('DETALHAMENTO DO PAGAMENTO', x + 28, currentY + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    let detY = currentY + 28;
    records.slice(0, 5).forEach((r) => {
      const dateLabel = r.date ? new Date(r.date + 'T00:00').toLocaleDateString('pt-BR') : '—';
      const recordSector = r.sector_name && r.sector_name.trim().toLowerCase() !== 'setor' ? r.sector_name : '';
      const sectorLabel = recordSector || professional?.sector_name || professional?.specialty || 'Não informado';
      const detail = doc.splitTextToSize(`${dateLabel}  |  ${sectorLabel}  |  ${r.hours || 0}h  |  R$ ${(Number(r.value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, width - 58);
      doc.text(detail, x + 28, detY, { lineHeightFactor: 1.15 });
      detY += Math.max(12, detail.length * 10);
    });
    if (records.length > 5) doc.text(`+ ${records.length - 5} lançamento(s) no período`, x + 28, currentY + 100, { maxWidth: width - 58 });

    doc.setDrawColor(190, 200, 210);
    const signatureY = y + height - 46;
    const sigWidth = (width - 60) / 2;
    doc.line(x + 18, signatureY, x + 18 + sigWidth, signatureY);
    doc.line(x + 18 + sigWidth + 24, signatureY, x + width - 18, signatureY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Assinatura da empresa', x + 18, signatureY + 10);
    doc.text('Assinatura do profissional', x + 18 + sigWidth + 24, signatureY + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Emitido em: ${issuedAt}`, x + 18, y + height - 18);
  };

  doc.setFillColor(14, 165, 233);
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Recibo de pagamento e repasse', 24, 14);

  renderReceipt(margin, 36, boxWidth, boxHeight, 'VIA DA EMPRESA');
  renderReceipt(margin + boxWidth + gap, 36, boxWidth, boxHeight, 'VIA DO PROFISSIONAL');

  doc.setFontSize(8); doc.setTextColor(150);
  doc.text(`${company?.app_name || 'ScaleMedic CGT'} • ${company?.name || 'Empresa'}`, 24, pageHeight - 8);
  doc.save(`recibo-${(professional?.name || 'profissional').toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

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

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-escalas-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}