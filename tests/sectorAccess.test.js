import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isProfessionalAuthorizedForSector,
  blockedSectorsFrom,
  legacyBlockedSectors,
  authorizedSectorIdsFor,
  getProfessionalUnitIds
} from '../src/lib/sectorAccess.js';

const sectors = [
  { id: 'a1', unit_id: 'A' }, { id: 'a2', unit_id: 'A' }, { id: 'a3', unit_id: 'A' },
  { id: 'b1', unit_id: 'B' }
];

test('setor novo fica liberado no formato atual (lista de vetados)', () => {
  const prof = { data: { blocked_sectors: ['a2'] } };
  assert.equal(isProfessionalAuthorizedForSector(prof, 'a1'), true);
  assert.equal(isProfessionalAuthorizedForSector(prof, 'a2'), false);
  assert.equal(isProfessionalAuthorizedForSector(prof, 'novo'), true);
});

test('formato antigo continua respeitando a lista de liberados', () => {
  const prof = { data: { authorized_sectors: ['a1'] } };
  assert.equal(isProfessionalAuthorizedForSector(prof, 'a1'), true);
  assert.equal(isProfessionalAuthorizedForSector(prof, 'a2'), false);
  assert.equal(isProfessionalAuthorizedForSector({}, 'a2'), true);
});

test('vetados = setores das unidades do profissional que ficaram desmarcados', () => {
  assert.deepEqual(blockedSectorsFrom(['a1', 'a3'], sectors, ['A']), ['a2']);
  assert.deepEqual(blockedSectorsFrom(['a1', 'a2', 'a3'], sectors, ['A', 'B']), ['b1']);
});

test('conversão do formato antigo não veta unidade sem setor marcado', () => {
  // Marcou todos os setores de A e nenhum de B (B foi criada depois): nada vetado.
  assert.deepEqual(legacyBlockedSectors(['a1', 'a2', 'a3'], sectors, ['A', 'B']), []);
  // Restringiu de propósito dentro de A: continua vetado.
  assert.deepEqual(legacyBlockedSectors(['a1'], sectors, ['A', 'B']), ['a2', 'a3']);
});

test('formulário marca tudo que não está vetado', () => {
  assert.deepEqual(authorizedSectorIdsFor({ data: { blocked_sectors: ['a3'] } }, sectors), ['a1', 'a2', 'b1']);
});

test('unidades do profissional: lista liberada, depois unit_ids, depois unidade principal', () => {
  assert.deepEqual(getProfessionalUnitIds({ data: { allowed_unit_ids: ['A', 'B', 'A'] }, unit_id: 'A' }), ['A', 'B']);
  assert.deepEqual(getProfessionalUnitIds({ unit_ids: ['C'], unit_id: 'A' }), ['C']);
  assert.deepEqual(getProfessionalUnitIds({ unit_id: 'A' }), ['A']);
  assert.deepEqual(getProfessionalUnitIds(null), []);
});
