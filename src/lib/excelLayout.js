// Modelo único das planilhas Excel (.xlsx), no mesmo padrão dos impressos (printLayout.js):
// logos da empresa e da unidade, unidade, título e período no topo; números de verdade
// (R$, horas, datas) para somar e filtrar; cabeçalho da tabela fixo e com filtro; cor só
// para situação; e a página pronta para imprimir (A4, cabe na largura, "Página X de Y").
import { getCompanyLogoUrl, getUnitLogoUrl } from './printBranding.js';

const INK = 'FF0F172A';
const SUB = 'FF475569';
const MUTED = 'FF64748B';
const HEAD_BG = 'FFF1F5F9';
const HEAD_INK = 'FF334155';
const HEAD_LINE = 'FF94A3B8';
const LINE = 'FFE2E8F0';
const ZEBRA = 'FFF8FAFC';
const FONT = 'Calibri';

// Situação: texto colorido e fundo claro, como os selos dos impressos.
export const XL_TONES = {
  good: { font: 'FF047857', fill: 'FFECFDF5' },
  warn: { font: 'FFB45309', fill: 'FFFFFBEB' },
  bad: { font: 'FFBE123C', fill: 'FFFFF1F2' },
  muted: { font: MUTED }
};

export const XL_FORMATS = {
  money: '"R$" #,##0.00',
  rate: '"R$" #,##0.0000',
  hours: '[h]:mm',
  int: '#,##0',
  decimal: '#,##0.##',
  percent: '0%',
  date: 'dd/mm/yyyy',
  text: '@'
};

const NUMERIC = new Set(['money', 'rate', 'hours', 'int', 'decimal', 'percent']);
const DEFAULT_WIDTH = { money: 16, rate: 16, hours: 10, int: 11, decimal: 11, percent: 10, date: 12, text: 22 };

const solid = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const line = argb => ({ style: 'thin', color: { argb } });

// "2026-11-24" vira data do Excel (sem fuso: meio-dia UTC não muda o dia).
function excelDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)) : null;
}

// Converte o valor conforme o tipo da coluna; texto (ex.: "Pendente") passa como está.
export function excelValue(value, type = 'text') {
  if (value === null || value === undefined || value === '') return null;
  if (type === 'date') return excelDate(value) ?? String(value);
  if (!NUMERIC.has(type)) return String(value);
  if (typeof value === 'string' && !/^-?\d+([.,]\d+)?$/.test(value.trim())) return value;
  const number = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(number)) return null;
  if (type === 'hours') return number / 24;
  if (type === 'percent') return number / 100;
  return number;
}

// Célula pode vir como valor simples ou { v, tone, bold }.
const cellParts = raw => (raw && typeof raw === 'object' && !(raw instanceof Date) && 'v' in raw ? raw : { v: raw });

// Logo como PNG (qualquer formato vira PNG pelo canvas), com altura fixa e proporção mantida.
async function loadLogo(url, height = 44) {
  if (!url || typeof document === 'undefined') return null;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const objectUrl = URL.createObjectURL(await response.blob());
    try {
      const img = await new Promise((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = objectUrl;
      });
      if (!img.naturalWidth || !img.naturalHeight) return null;
      let width = Math.round((img.naturalWidth / img.naturalHeight) * height);
      let finalHeight = height;
      if (width > 160) { finalHeight = Math.round((160 / width) * height); width = 160; }
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = finalHeight * 2;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      return { base64: canvas.toDataURL('image/png'), width, height: finalHeight };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

export async function createWorkbook({ company, unit } = {}) {
  const mod = await import('exceljs');
  const ExcelJS = mod.default?.Workbook ? mod.default : mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ScaleMedic';
  wb.created = new Date();
  const urls = [...new Set([getCompanyLogoUrl(company), getUnitLogoUrl(unit)].filter(Boolean))];
  const logos = (await Promise.all(urls.map(url => loadLogo(url)))).filter(Boolean)
    .map(logo => ({ ...logo, id: wb.addImage({ base64: logo.base64, extension: 'png' }) }));
  return { wb, logos, issuedAt: new Date() };
}

const issuedLabel = date => `${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
const footerText = value => String(value ?? '').replace(/&/g, '&&');

// Nome de aba: até 31 caracteres, sem : \ / ? * [ ] e sem repetir.
function sheetName(wb, name) {
  const base = String(name || 'Planilha').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Planilha';
  let candidate = base;
  for (let i = 2; wb.getWorksheet(candidate); i += 1) candidate = `${base.slice(0, 27)} (${i})`;
  return candidate;
}

// Coluna (em unidades do Excel, fracionária) onde cai um deslocamento em pixels.
function colAtPixel(widths, px) {
  let left = 0;
  for (let i = 0; i < widths.length; i += 1) {
    const w = widths[i] * 7 + 5;
    if (px < left + w) return i + (px - left) / w;
    left += w;
  }
  return widths.length;
}

/**
 * Uma aba no padrão ScaleMedic.
 * blocks: { type: 'table', title?, columns: [{ header, key, type, width, bold }], rows, totals?, empty? }
 *       | { type: 'summary', title?, items: [{ label, value, type, tone }] }
 *       | { type: 'note', text, tone? }
 * Linha de tabela: objeto com as chaves das colunas; `_tone` pinta a linha toda.
 */
export function addSheet(book, { name, orgName = '', title = '', subtitle = '', meta = [], blocks = [], landscape } = {}) {
  const { wb, logos, issuedAt } = book;
  const ws = wb.addWorksheet(sheetName(wb, name || title));
  const tables = blocks.filter(block => block.type === 'table');
  const columnCount = Math.max(2, ...tables.map(table => table.columns.length));

  const widths = Array.from({ length: columnCount }, (_, i) => Math.max(8, ...tables.map(table => {
    const column = table.columns[i];
    if (!column) return 0;
    // Nenhuma palavra do título da coluna quebra no meio.
    const longestWord = Math.max(...String(column.header).split(/s+/).map(word => word.length));
    return Math.max(column.width ?? DEFAULT_WIDTH[column.type || 'text'], Math.ceil(longestWord * 1.1) + 3);
  })));
  ws.columns = widths.map(width => ({ width }));
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  const lastCol = columnCount;

  const mergeRow = (rowNumber) => { if (lastCol > 1) ws.mergeCells(rowNumber, 1, rowNumber, lastCol); };
  // Texto longo em célula mesclada: o Excel não ajusta a altura sozinho.
  const fitHeight = (row, text, size = 9) => {
    const charsPerLine = Math.max(20, totalWidth * (10 / size) * 1.05);
    const lines = String(text).split('\n').reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / charsPerLine)), 0);
    row.height = Math.max(15, lines * size * 1.45 + 4);
  };

  let r = 1;
  if (logos.length) {
    ws.getRow(r).height = Math.max(...logos.map(logo => logo.height)) * 0.75 + 8;
    let px = 2;
    for (const logo of logos) {
      ws.addImage(logo.id, { tl: { col: colAtPixel(widths, px), row: r - 1 + 0.08 }, ext: { width: logo.width, height: logo.height }, editAs: 'oneCell' });
      px += logo.width + 14;
    }
    r += 1;
  }
  if (orgName) {
    const cell = ws.getCell(r, 1);
    cell.value = String(orgName).toUpperCase();
    cell.font = { name: FONT, size: 9, bold: true, color: { argb: SUB } };
    r += 1;
  }
  const titleCell = ws.getCell(r, 1);
  titleCell.value = title;
  titleCell.font = { name: FONT, size: 16, bold: true, color: { argb: INK } };
  ws.getRow(r).height = 24;
  r += 1;
  const metaText = [subtitle, ...meta.filter(([, value]) => value !== undefined && value !== null && value !== '').map(([label, value]) => `${label}: ${value}`), `Emitido em ${issuedLabel(issuedAt)}`]
    .filter(Boolean).join('   ·   ');
  const metaCell = ws.getCell(r, 1);
  metaCell.value = metaText;
  metaCell.font = { name: FONT, size: 9, color: { argb: SUB } };
  metaCell.alignment = { wrapText: true, vertical: 'top' };
  mergeRow(r);
  fitHeight(ws.getRow(r), metaText);
  // Linha fina sob o cabeçalho, como nos impressos.
  for (let c = 1; c <= lastCol; c += 1) ws.getCell(r, c).border = { bottom: { style: 'medium', color: { argb: INK } } };
  r += 2;

  let singleHeaderRow = null;
  let singleLastRow = null;

  for (const block of blocks) {
    if (block.title) {
      const cell = ws.getCell(r, 1);
      cell.value = block.title;
      cell.font = { name: FONT, size: 11, bold: true, color: { argb: INK } };
      ws.getRow(r).height = 18;
      r += 1;
    }

    if (block.type === 'note') {
      const cell = ws.getCell(r, 1);
      const tone = XL_TONES[block.tone];
      cell.value = block.text;
      cell.font = { name: FONT, size: 9, bold: Boolean(tone && block.tone !== 'muted'), color: { argb: tone?.font || SUB } };
      cell.alignment = { wrapText: true, vertical: 'top' };
      if (tone?.fill) cell.fill = solid(tone.fill);
      mergeRow(r);
      fitHeight(ws.getRow(r), block.text);
      r += 2;
      continue;
    }

    if (block.type === 'summary') {
      // Rótulo à esquerda, valor em destaque à direita (metade das colunas cada).
      const split = Math.max(1, Math.floor(lastCol / 2));
      for (const item of block.items) {
        const label = ws.getCell(r, 1);
        label.value = item.label;
        label.font = { name: FONT, size: 10, color: { argb: SUB } };
        label.alignment = { vertical: 'middle', wrapText: true };
        const value = ws.getCell(r, split + 1);
        const type = item.type || 'text';
        value.value = excelValue(item.value, type);
        if (XL_FORMATS[type] && type !== 'text') value.numFmt = XL_FORMATS[type];
        const tone = XL_TONES[item.tone];
        value.font = { name: FONT, size: 12, bold: true, color: { argb: tone?.font || INK } };
        value.alignment = { vertical: 'middle', horizontal: NUMERIC.has(type) ? 'right' : 'left' };
        if (split > 1) ws.mergeCells(r, 1, r, split);
        if (lastCol > split + 1) ws.mergeCells(r, split + 1, r, lastCol);
        for (let c = 1; c <= lastCol; c += 1) ws.getCell(r, c).border = { bottom: line(LINE) };
        ws.getRow(r).height = 20;
        r += 1;
      }
      r += 1;
      continue;
    }

    // Tabela
    const { columns, rows = [], totals } = block;
    const headerRow = ws.getRow(r);
    columns.forEach((column, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = String(column.header).toUpperCase();
      cell.font = { name: FONT, size: 9, bold: true, color: { argb: HEAD_INK } };
      cell.fill = solid(HEAD_BG);
      cell.border = { bottom: line(HEAD_LINE), top: line(HEAD_LINE) };
      cell.alignment = { vertical: 'top', wrapText: true, indent: 1, horizontal: NUMERIC.has(column.type) ? 'right' : 'left' };
    });
    // Título no alto da célula: a setinha do filtro fica embaixo, sem tapar o texto.
    headerRow.height = 34;
    const headerNumber = r;
    r += 1;

    if (!rows.length) {
      const cell = ws.getCell(r, 1);
      cell.value = block.empty || 'Nenhum registro no período.';
      cell.font = { name: FONT, size: 10, italic: true, color: { argb: MUTED } };
      cell.alignment = { horizontal: 'center' };
      if (columns.length > 1) ws.mergeCells(r, 1, r, columns.length);
      r += 1;
    }

    rows.forEach((data, index) => {
      const row = ws.getRow(r);
      const rowTone = XL_TONES[data._tone];
      columns.forEach((column, i) => {
        const type = column.type || 'text';
        const { v, tone, bold } = cellParts(data[column.key]);
        const cell = row.getCell(i + 1);
        cell.value = excelValue(v, type);
        if (XL_FORMATS[type] && type !== 'text' && typeof cell.value !== 'string') cell.numFmt = XL_FORMATS[type];
        const cellTone = XL_TONES[tone];
        cell.font = {
          name: FONT,
          size: 10,
          bold: Boolean(bold ?? column.bold) || Boolean(cellTone && tone !== 'muted'),
          color: { argb: cellTone?.font || rowTone?.font || (typeof cell.value === 'string' && NUMERIC.has(type) ? MUTED : INK) }
        };
        // Situação de uma célula só colore o texto; a linha inteira (furo, vaga) ganha fundo.
        const fill = rowTone?.fill || (index % 2 === 1 ? ZEBRA : null);
        if (fill) cell.fill = solid(fill);
        cell.border = { bottom: line(LINE) };
        cell.alignment = { vertical: 'top', indent: 1, wrapText: column.wrap ?? type === 'text', horizontal: NUMERIC.has(type) ? 'right' : type === 'date' ? 'center' : 'left' };
      });
      // O Excel não ajusta a altura de texto quebrado ao abrir: estima as linhas.
      const lines = Math.max(1, ...columns.map((column, i) => {
        const value = row.getCell(i + 1).value;
        if (typeof value !== 'string' || !(column.wrap ?? (column.type || 'text') === 'text')) return 1;
        return Math.ceil(value.length / Math.max(4, (widths[i] - 2) * 1.25));
      }));
      if (lines > 1) row.height = lines * 13 + 3;
      r += 1;
    });
    const lastDataRow = r - 1;

    if (totals && rows.length) {
      const row = ws.getRow(r);
      columns.forEach((column, i) => {
        const type = column.type || 'text';
        const cell = row.getCell(i + 1);
        const raw = i === 0 ? (totals[column.key] ?? totals.label ?? 'Total') : totals[column.key];
        cell.value = i === 0 && raw === (totals.label ?? 'Total') ? raw : excelValue(raw, type);
        if (XL_FORMATS[type] && type !== 'text' && typeof cell.value !== 'string') cell.numFmt = XL_FORMATS[type];
        cell.font = { name: FONT, size: 10.5, bold: true, color: { argb: INK } };
        cell.border = { top: { style: 'medium', color: { argb: INK } } };
        cell.alignment = { vertical: 'middle', indent: 1, horizontal: NUMERIC.has(type) ? 'right' : 'left' };
      });
      row.height = 20;
      r += 1;
    }

    if (tables.length === 1 && rows.length) {
      singleHeaderRow = headerNumber;
      singleLastRow = lastDataRow;
    }
    r += 1;
  }

  // Sem topLeftCell o Excel começa a parte que rola na linha 1 e mostra o topo duas vezes.
  ws.views = [singleHeaderRow
    ? { state: 'frozen', ySplit: singleHeaderRow, topLeftCell: `A${singleHeaderRow + 1}`, activeCell: `A${singleHeaderRow + 1}`, showGridLines: false }
    : { showGridLines: false, activeCell: 'A1' }];
  if (singleHeaderRow) {
    ws.autoFilter = { from: { row: singleHeaderRow, column: 1 }, to: { row: singleLastRow, column: tables[0].columns.length } };
  }

  ws.pageSetup = {
    paperSize: 9,
    orientation: landscape ?? totalWidth > 105 ? 'landscape' : 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.25, footer: 0.3 },
    ...(singleHeaderRow ? { printTitlesRow: `${singleHeaderRow}:${singleHeaderRow}` } : {})
  };
  const footerLeft = [title, orgName].filter(Boolean).join(' · ');
  ws.headerFooter = {
    oddFooter: `&L&8&K64748B${footerText(footerLeft)}&C&8&K64748BEmitido em ${footerText(issuedLabel(issuedAt))} · ScaleMedic&R&8&K64748BPágina &P de &N`
  };
  return ws;
}

export async function downloadWorkbook({ wb }, filename) {
  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Nome de arquivo seguro, mantendo acentos.
export function excelFileName(...parts) {
  return `${parts.filter(Boolean).map(part => String(part).replace(/[\\/:*?"<>|]+/g, '-').trim()).join(' - ')}.xlsx`;
}

// Modelos de importação: a linha 1 continua sendo o cabeçalho lido pela importação,
// só ganha o mesmo visual das outras planilhas.
export function styleImportHeader(ws) {
  const row = ws.getRow(1);
  row.eachCell(cell => {
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: HEAD_INK } };
    cell.fill = solid(HEAD_BG);
    cell.border = { bottom: line(HEAD_LINE) };
    cell.alignment = { vertical: 'middle', indent: 1 };
  });
  row.height = 24;
}
