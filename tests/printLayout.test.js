import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrintDocument, cssString, printHeader, printLogos, printWatermark, shortPersonName } from '../src/lib/printLayout.js';

test('texto do rodapé não quebra o CSS', () => {
  assert.equal(cssString('Ana "Teste"\\x'), '"Ana \\"Teste\\"\\\\x"');
  assert.equal(cssString('linha\nnova'), '"linha nova"');
});

test('logos: empresa e unidade lado a lado, sem repetir a mesma imagem', () => {
  const both = printLogos({ company: { logo_url: 'a.png' }, unit: { logo_url: 'b.png' } });
  assert.equal((both.match(/<img/g) || []).length, 2);
  const same = printLogos({ company: { logo_url: 'a.png' }, unit: { logo_url: 'a.png' } });
  assert.equal((same.match(/<img/g) || []).length, 1);
  assert.equal(printLogos({}), '');
});

test('cabeçalho escapa o conteúdo e omite meta vazia', () => {
  const html = printHeader({ orgName: '<Hosp>', title: 'Recibo', meta: [['Competência', 'Outubro / 2026'], ['Vazio', '']] });
  assert.ok(html.includes('&lt;Hosp&gt;'));
  assert.ok(html.includes('Competência'));
  assert.ok(!html.includes('Vazio'));
});

test('marca d\'água só quando pedida', () => {
  assert.equal(printWatermark(), '');
  assert.ok(printWatermark({ text: 'RASCUNHO' }).includes('RASCUNHO'));
  assert.ok(printWatermark({ imageUrl: 'logo.png' }).includes('logo.png'));
});

test('documento leva página X de Y, emissão e orientação', () => {
  const html = buildPrintDocument({ docTitle: 'T', orientation: 'landscape', body: '<p>x</p>', issuedBy: 'Gestor', issuedAt: new Date(2026, 10, 23, 15, 4) });
  assert.ok(html.includes('A4 landscape'));
  assert.ok(html.includes('counter(pages)'));
  assert.ok(html.includes('Emitido por Gestor em 23/11/2026'));
});

test('nome curto para a escala', () => {
  assert.equal(shortPersonName('Maria Clara Souza Lima'), 'Maria Lima');
  assert.equal(shortPersonName('João Cândido Teixeira Almeida Jr'), 'João Almeida');
  assert.equal(shortPersonName('Ana'), 'Ana');
});
