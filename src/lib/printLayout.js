// Modelo único dos impressos: cabeçalho com logos, rodapé com página e emissão,
// marca d'água opcional e o mesmo estilo de tabela em todos os documentos.
import { escapeHtml, getCompanyLogoUrl, getUnitLogoUrl, PRINT_WHEN_IMAGES_READY_SCRIPT } from './printBranding.js';

// Texto dentro de content: "..." no CSS (o rodapé da página).
export function cssString(value) {
  return `"${String(value ?? '').replace(/[\\"]/g, '\\$&').replace(/[\r\n]+/g, ' ')}"`;
}

// Logo da empresa e logo da unidade, lado a lado (a unidade pode ter as duas).
export function printLogos({ company, unit } = {}) {
  const urls = [getCompanyLogoUrl(company), getUnitLogoUrl(unit)].filter(Boolean);
  const unique = [...new Set(urls)];
  return unique.map(url => `<img src="${escapeHtml(url)}" alt="" class="pl-logo" />`).join('');
}

export function firstLogoUrl({ company, unit } = {}) {
  return getUnitLogoUrl(unit) || getCompanyLogoUrl(company) || '';
}

export function printHeader({ logos = '', orgName = '', title = '', subtitle = '', meta = [] } = {}) {
  const metaHtml = meta
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `<div><span>${escapeHtml(label)}</span> <b>${escapeHtml(value)}</b></div>`)
    .join('');
  return `<header class="pl-header">
    ${logos ? `<div class="pl-logos">${logos}</div>` : ''}
    <div class="pl-heading">
      <div class="pl-org">${escapeHtml(orgName)}</div>
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<div class="pl-subtitle">${escapeHtml(subtitle)}</div>` : ''}
    </div>
    ${metaHtml ? `<div class="pl-meta">${metaHtml}</div>` : ''}
  </header>`;
}

// Marca d'água só quando ela diz algo: texto (ex.: "RASCUNHO") ou a logo no recibo pago.
export function printWatermark({ text = '', imageUrl = '' } = {}) {
  if (imageUrl) return `<div class="pl-watermark pl-watermark-img" aria-hidden="true"><img src="${escapeHtml(imageUrl)}" alt="" /></div>`;
  if (text) return `<div class="pl-watermark" aria-hidden="true"><span>${escapeHtml(text)}</span></div>`;
  return '';
}

export function formatIssued(date = new Date()) {
  const d = date.toLocaleDateString('pt-BR');
  const t = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${d} às ${t}`;
}

export const PRINT_BASE_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { color: #0f172a; font: 10px/1.4 "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media screen { body { padding: 16px; } }
  .pl-header { display: flex; align-items: center; gap: 14px; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1.5px solid #0f172a; }
  .pl-logos { display: flex; align-items: center; gap: 10px; flex: none; }
  .pl-logo { height: 40px; max-width: 120px; object-fit: contain; }
  .pl-heading { flex: 1; min-width: 0; }
  .pl-org { font-size: 9px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #475569; }
  .pl-header h1 { margin: 1px 0 0; font-size: 16px; font-weight: 700; color: #0f172a; }
  .pl-subtitle { margin-top: 2px; font-size: 10px; color: #475569; }
  .pl-meta { flex: none; text-align: right; font-size: 9px; color: #475569; line-height: 1.55; }
  .pl-meta b { color: #0f172a; font-weight: 600; }
  .pl-table { width: 100%; border-collapse: collapse; }
  .pl-table thead { display: table-header-group; }
  .pl-table tr { break-inside: avoid; page-break-inside: avoid; }
  .pl-table th { padding: 6px 7px; text-align: left; font-size: 8px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #334155; background: #f1f5f9; border-bottom: 1px solid #94a3b8; }
  .pl-table td { padding: 5px 7px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  .pl-num, .pl-table th.pl-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .pl-muted { color: #64748b; }
  .pl-note { margin-top: 8px; font-size: 8.5px; color: #475569; }
  .pl-watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 2; overflow: hidden; mix-blend-mode: multiply; }
  .pl-watermark span { transform: rotate(-22deg); font-size: 40px; font-weight: 800; letter-spacing: .08em; color: #e8ecf2; white-space: nowrap; }
  .pl-watermark-img img { width: 46%; max-height: 70%; object-fit: contain; opacity: .07; filter: grayscale(1); }
  .pl-sheet { position: relative; }
  .pl-sheet > *:not(.pl-watermark) { position: relative; z-index: 1; }
  .pl-signatures { display: flex; justify-content: space-around; gap: 24px; margin-top: 28px; text-align: center; font-size: 9px; color: #334155; }
  .pl-signatures div { width: 220px; border-top: 1px solid #0f172a; padding-top: 4px; }
`;

// Documento completo, pronto para window.print(). O rodapé (página X de Y e emissão)
// vai nas margens da página, então se repete em todas as folhas.
export function buildPrintDocument({ docTitle = 'Impresso', orientation = 'portrait', body = '', issuedBy = '', issuedAt = new Date(), css = '', margin = '12mm 11mm 15mm' } = {}) {
  const footerLeft = `Emitido${issuedBy ? ` por ${issuedBy}` : ''} em ${formatIssued(issuedAt)} · ScaleMedic`;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(docTitle)}</title>
  <style>
    @page {
      size: A4 ${orientation === 'landscape' ? 'landscape' : 'portrait'};
      margin: ${margin};
      @bottom-left { content: ${cssString(footerLeft)}; font: 7.5px "Segoe UI", Arial, sans-serif; color: #64748b; }
      @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 7.5px "Segoe UI", Arial, sans-serif; color: #64748b; }
    }
    ${PRINT_BASE_CSS}
    ${css}
  </style>
</head>
<body>
${body}
${PRINT_WHEN_IMAGES_READY_SCRIPT}
</body>
</html>`;
}

// Abre a janela de impressão; devolve false se o navegador bloqueou o pop-up.
export function openPrintWindow(html, features = 'width=1100,height=800') {
  const printWindow = window.open('', '_blank', features);
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}

// "Maria Clara Souza Lima" → "Maria Lima" (cabe na célula da escala).
export function shortPersonName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(' ');
  const last = parts[parts.length - 1];
  const tail = /^(jr\.?|junior|júnior|filho|neto|sobrinho)$/i.test(last) && parts.length > 2 ? parts[parts.length - 2] : last;
  return `${parts[0]} ${tail}`;
}
