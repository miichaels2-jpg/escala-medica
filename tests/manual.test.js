import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SHOTS } from '../scripts/manual/fotos.mjs';

const dir = 'scripts/manual/manuais';
const manuais = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.mjs')).sort()) {
  manuais.push((await import(pathToFileURL(path.resolve(dir, f)).href)).default);
}
const shotIds = new Set(SHOTS.map(s => s.id));

function figuras(blocos) {
  const out = [];
  for (const b of blocos) {
    if (b.figura) out.push(b.figura);
    for (const p of b.passos || []) if (typeof p === 'object' && p.figura) out.push(p.figura);
  }
  return out;
}

test('cada manual tem PDF gerado e está no catálogo da tela Treinamento', () => {
  const catalogo = JSON.parse(fs.readFileSync('public/manual/catalogo.json', 'utf8'));
  assert.deepEqual(catalogo.manuais.map(m => m.id), manuais.map(m => m.id));
  for (const m of manuais) assert.ok(fs.existsSync(`public/manual/${m.id}.pdf`), `falta public/manual/${m.id}.pdf`);
  assert.ok(fs.existsSync('public/manual/manual-completo.pdf'));
});

test('módulos numerados em sequência, com título, resumo e seções', () => {
  manuais.forEach((m, i) => {
    assert.equal(m.numero, i + 1, `${m.id}: numeração`);
    assert.ok(m.titulo && m.resumo && m.secoes.length >= 3, `${m.id}: conteúdo mínimo`);
  });
});

test('toda foto citada nos manuais tem roteiro de captura', () => {
  for (const m of manuais) {
    for (const s of m.secoes) for (const id of figuras(s.blocos)) assert.ok(shotIds.has(id), `${m.id}: foto sem roteiro: ${id}`);
  }
});
