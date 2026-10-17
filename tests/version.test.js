import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// version.js importa o package.json; aqui testamos só a regra, lendo o arquivo-fonte.
const source = readFileSync(new URL('../src/lib/version.js', import.meta.url), 'utf8')
  .replace(/^import pkg.*$/m, 'const pkg = { version: "0.0.0" };');
const { nextVersion } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

test('sobe o último número a cada entrega', () => {
  assert.equal(nextVersion('0.1.2'), '0.1.3');
  assert.equal(nextVersion('V0.1.9'), '0.1.10');
});

test('depois do 10, sobe o número do meio e recomeça em 1', () => {
  assert.equal(nextVersion('0.1.10'), '0.2.1');
  assert.equal(nextVersion('V0.2.10'), '0.3.1');
});

test('a versão do package.json segue o formato esperado', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.version, /^\d+\.\d+\.([1-9]|10)$/);
});
