import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { addSheet, createWorkbook, excelFileName, excelValue } from '../src/lib/excelLayout.js';

test('valores viram número de verdade conforme o tipo da coluna', () => {
  assert.equal(excelValue(1234.5, 'money'), 1234.5);
  assert.equal(excelValue('12,5', 'money'), 12.5);
  assert.equal(excelValue(12, 'hours'), 0.5);
  assert.equal(excelValue(95, 'percent'), 0.95);
  assert.equal(excelValue('Pendente', 'int'), 'Pendente');
  assert.equal(excelValue('', 'money'), null);
  const date = excelValue('2026-11-24', 'date');
  assert.equal(date.getUTCFullYear(), 2026);
  assert.equal(date.getUTCMonth(), 10);
  assert.equal(date.getUTCDate(), 24);
});

test('aba com cabeçalho fixo, filtro, totais e página pronta para imprimir', async () => {
  const book = await createWorkbook();
  addSheet(book, {
    name: 'Fechamento',
    orgName: 'Hospital Exemplo',
    title: 'Fechamento de honorários',
    subtitle: 'Competência Novembro / 2026',
    blocks: [{
      type: 'table',
      columns: [
        { header: 'Profissional', key: 'name' },
        { header: 'Horas', key: 'hours', type: 'hours' },
        { header: 'Líquido', key: 'net', type: 'money' },
        { header: 'Situação', key: 'status' }
      ],
      rows: [
        { name: 'Ana Souza', hours: 24, net: 2400, status: { v: 'Pago', tone: 'good' } },
        { name: 'Bruno Lima', hours: 12, net: 1200.5, status: { v: 'A pagar', tone: 'muted' } }
      ],
      totals: { hours: 36, net: 3600.5 }
    }]
  });
  const buffer = await book.wb.xlsx.writeBuffer();
  const back = new ExcelJS.Workbook();
  await back.xlsx.load(buffer);
  const ws = back.getWorksheet('Fechamento');
  assert.ok(ws, 'aba criada');

  let header = 0;
  ws.eachRow((row, n) => { if (row.getCell(1).value === 'PROFISSIONAL') header = n; });
  assert.ok(header > 0, 'cabeçalho da tabela');
  assert.equal(ws.views[0].state, 'frozen');
  assert.equal(ws.views[0].ySplit, header);
  assert.equal(ws.getCell(header + 1, 3).value, 2400);
  assert.equal(ws.getCell(header + 1, 3).numFmt, '"R$" #,##0.00');
  assert.equal(ws.getCell(header + 1, 2).numFmt, '[h]:mm');
  assert.equal(ws.getCell(header + 3, 1).value, 'Total');
  assert.equal(ws.getCell(header + 3, 3).value, 3600.5);
  assert.equal(ws.pageSetup.fitToWidth, 1);
  assert.equal(ws.pageSetup.paperSize, 9);
  assert.match(ws.headerFooter.oddFooter, /Página &P de &N/);
});

test('nomes de aba e de arquivo seguros', async () => {
  const book = await createWorkbook();
  addSheet(book, { name: 'Plantões: 01/11 a 30/11 [todos os setores]', title: 'x', blocks: [] });
  addSheet(book, { name: 'Plantões: 01/11 a 30/11 [todos os setores]', title: 'x', blocks: [] });
  const names = book.wb.worksheets.map(ws => ws.name);
  assert.ok(names.every(name => name.length <= 31 && !/[:\\/?*[\]]/.test(name)));
  assert.notEqual(names[0], names[1]);
  assert.equal(excelFileName('Relatório completo', 'UPA / Centro', '01-11-2026 a 30-11-2026'), 'Relatório completo - UPA - Centro - 01-11-2026 a 30-11-2026.xlsx');
});
