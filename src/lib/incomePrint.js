// Impresso do informe de rendimentos do ano (A4 retrato, uma tabela por unidade).
import { escapeHtml } from './printBranding.js';
import { buildPrintDocument, printHeader, printLogos } from './printLayout.js';
import { formatCurrency } from './format.js';
import { MONTH_NAMES } from './incomeStatement.js';

const REGIME = { plantao: 'Por plantão', mensal: 'Fixo mensal', produtividade: 'Produtividade' };
const hoursText = h => `${String(h).replace('.', ',')} h`;

export function buildIncomeStatementHtml({ statement, professional, company, issuedBy = '', issuedAt = new Date() }) {
  const s = statement;
  const meta = { ...professional, ...(professional?.data || {}) };
  const cpf = professional?.cpf || professional?.data?.cpf || '';
  const registration = [meta.document, meta.specialty].filter(Boolean).join(' · ');
  const withValues = s.kind !== 'produtividade';

  const situation = m => {
    if (m.pendingProduction && !m.gross) return '<span class="pl-muted">No fechamento</span>';
    return m.paid ? 'Pago' : '<span class="due">A receber</span>';
  };

  const unitsHtml = s.units.map(unit => `
    <section class="unit">
      <h2>${escapeHtml(unit.name)}${unit.cnpj ? ` <span>CNPJ ${escapeHtml(unit.cnpj)}</span>` : ''}</h2>
      <table class="pl-table">
        <thead><tr><th>Mês</th><th class="pl-num">Plantões</th><th class="pl-num">Horas</th>${withValues ? '<th class="pl-num">Bruto</th><th class="pl-num">Retenção</th><th class="pl-num">Líquido</th>' : ''}<th>Situação</th></tr></thead>
        <tbody>
          ${unit.months.map(m => `<tr>
            <td>${MONTH_NAMES[Number(m.month.slice(5, 7)) - 1]}</td>
            <td class="pl-num">${m.shifts}</td>
            <td class="pl-num">${hoursText(m.hours)}</td>
            ${withValues ? `<td class="pl-num">${formatCurrency(m.gross)}${m.missingRate ? ' *' : ''}</td><td class="pl-num">${m.discount ? `− ${formatCurrency(m.discount)}` : '—'}</td><td class="pl-num">${formatCurrency(m.net)}</td>` : ''}
            <td>${situation(m)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr>
          <td>Total</td>
          <td class="pl-num">${unit.totals.shifts}</td>
          <td class="pl-num">${hoursText(unit.totals.hours)}</td>
          ${withValues ? `<td class="pl-num">${formatCurrency(unit.totals.gross)}</td><td class="pl-num">${unit.totals.discount ? `− ${formatCurrency(unit.totals.discount)}` : '—'}</td><td class="pl-num">${formatCurrency(unit.totals.net)}</td>` : ''}
          <td></td>
        </tr></tfoot>
      </table>
    </section>`).join('');

  const notes = [
    s.missingRate ? '* Mês com plantão sem valor cadastrado na tabela do profissional: o valor real pode ser maior. Confira com a unidade.' : '',
    s.pendingProduction ? `Produtividade: o valor de ${s.pendingProduction === 1 ? '1 plantão' : `${s.pendingProduction} plantões`} depende da produção do dia e aparece no demonstrativo mensal da unidade (Faturamento).` : '',
    s.unpaidMonths ? '"A receber": mês ainda não marcado como pago pela unidade; o valor pode mudar no fechamento.' : ''
  ].filter(Boolean);

  const body = `<section class="pl-sheet">
    ${printHeader({
      logos: printLogos({ company }),
      orgName: company?.name || '',
      title: `Informe de rendimentos · ${s.year}`,
      subtitle: [professional?.name, cpf ? `CPF ${cpf}` : '', registration, REGIME[s.kind]].filter(Boolean).join(' · '),
      meta: [['Ano-calendário', String(s.year)], ['Emissão', issuedAt.toLocaleDateString('pt-BR')]]
    })}
    ${withValues ? `<div class="summary">
      <div><span>Bruto no ano</span><b>${formatCurrency(s.totals.gross)}</b></div>
      <div><span>Retenção${s.taxRate ? ` (${String(s.taxRate).replace('.', ',')}%)` : ''}</span><b>${s.totals.discount ? `− ${formatCurrency(s.totals.discount)}` : '—'}</b></div>
      <div class="net"><span>Líquido no ano</span><b>${formatCurrency(s.totals.net)}</b></div>
      <div><span>Já marcado como pago</span><b>${formatCurrency(s.totals.paidNet)}</b></div>
    </div>` : ''}
    <p class="facts">${s.totals.shifts === 1 ? '1 plantão realizado' : `${s.totals.shifts} plantões realizados`} · ${hoursText(s.totals.hours)} · ${s.units.length === 1 ? '1 unidade' : `${s.units.length} unidades`}</p>
    ${unitsHtml || '<p class="pl-muted empty">Nenhum plantão realizado neste ano.</p>'}
    ${notes.length ? `<ul class="notes">${notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>` : ''}
    <p class="pl-note">Documento para conferência, gerado pelo ScaleMedic a partir da escala realizada e dos valores cadastrados. O comprovante oficial de rendimentos para o Imposto de Renda é o emitido por cada fonte pagadora (CNPJ).</p>
  </section>`;

  return buildPrintDocument({
    docTitle: `Informe de rendimentos ${s.year} · ${professional?.name || 'Profissional'}`,
    issuedBy,
    issuedAt,
    css: `
      .summary { display: flex; gap: 8px; margin: 2px 0 6px; }
      .summary div { flex: 1; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 6px; }
      .summary span { display: block; font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
      .summary b { font-size: 12.5px; font-variant-numeric: tabular-nums; }
      .summary .net { border-color: #0f172a; }
      .facts { margin: 0 0 10px; font-size: 9.5px; color: #475569; }
      .unit { margin-top: 12px; break-inside: avoid; page-break-inside: avoid; }
      .unit h2 { margin: 0 0 5px; font-size: 11.5px; }
      .unit h2 span { font-weight: 400; font-size: 9px; color: #64748b; margin-left: 6px; }
      .pl-table tfoot td { padding: 6px 7px; font-weight: 700; border-top: 1.5px solid #0f172a; }
      .due { color: #b45309; font-weight: 600; }
      .notes { margin: 12px 0 0; padding-left: 14px; font-size: 8.5px; color: #475569; }
      .empty { margin: 24px 0; text-align: center; }
    `,
    body
  });
}
