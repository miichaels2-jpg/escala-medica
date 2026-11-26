import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceKey, invoicePath, invoiceState, isPjProfessional, paymentNeedsInvoice, validateInvoiceFile } from '../src/lib/invoiceRules.js';
import { describeAuditEntry } from '../src/lib/auditLog.js';

const pj = { id: 'p1', data: { receipt_type: 'pj', cnpj: '12.345.678/0001-90' } };
const pf = { id: 'p2', data: { receipt_type: 'pf' } };

test('quem é PJ e quando o pagamento pede nota', () => {
  assert.equal(isPjProfessional(pj), true);
  assert.equal(isPjProfessional(pf), false);
  assert.equal(isPjProfessional({ id: 'x' }), false);
  assert.equal(paymentNeedsInvoice(pj, null), true);
  assert.equal(paymentNeedsInvoice(pj, { status: 'enviada' }), true);
  assert.equal(paymentNeedsInvoice(pj, { status: 'aceita' }), false);
  assert.equal(paymentNeedsInvoice(pf, null), false);
  assert.equal(invoiceState(null), 'falta');
  assert.equal(invoiceState({ status: 'devolvida' }), 'devolvida');
});

test('arquivo da nota: tipo, tamanho e caminho na pasta', () => {
  assert.equal(validateInvoiceFile({ type: 'application/pdf', size: 1000 }), '');
  assert.match(validateInvoiceFile({ type: 'image/gif', size: 1000 }), /PDF, JPG ou PNG/);
  assert.match(validateInvoiceFile({ type: 'image/png', size: 11 * 1024 * 1024 }), /10 MB/);
  assert.match(validateInvoiceFile(null), /Escolha/);
  assert.equal(invoicePath({ companyId: 'cmp_principal', professionalId: 'prof_1', month: '2026-11', unitId: 'u-1', type: 'image/jpeg', at: 5 }), 'cmp_principal/prof_1/2026-11/u-1-5.jpg');
  assert.equal(invoicePath({ companyId: 'c', professionalId: '../x', month: '2026-11', unitId: 'u', type: 'application/pdf', at: 1 }), 'c/___x/2026-11/u-1.pdf');
  assert.equal(invoiceKey('u', 'p', '2026-11'), 'u|p|2026-11');
});

test('histórico descreve a nota fiscal', () => {
  const ctx = { professionalName: () => 'Ana' };
  assert.equal(describeAuditEntry({ table_name: 'invoices', action: 'insert', new_data: { professional_id: 'p1', month: '2026-11', status: 'enviada' } }, ctx), 'Ana enviou a nota fiscal de novembro/2026');
  assert.equal(describeAuditEntry({ table_name: 'invoices', action: 'update', new_data: { professional_id: 'p1', month: '2026-11', status: 'devolvida', review_note: 'CNPJ errado' } }, ctx), 'Devolveu a nota fiscal de Ana (novembro/2026): CNPJ errado');
});
