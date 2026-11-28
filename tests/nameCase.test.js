import test from 'node:test';
import assert from 'node:assert/strict';
import { joinNames, nameCase } from '../src/lib/nameCase.js';

test('nome todo em maiúsculas vira nome próprio, mantendo siglas', () => {
  assert.equal(nameCase('BASE DE HOMOLOGAÇÃO'), 'Base de Homologação');
  assert.equal(nameCase('UPA EUSEBIO'), 'UPA Eusebio');
  assert.equal(nameCase('HOSPITAL DE HOMOLOGAÇÃO 2.0'), 'Hospital de Homologação 2.0');
  assert.equal(nameCase('HMDAS'), 'HMDAS');
  assert.equal(nameCase('UTI/UCI'), 'UTI/UCI');
});

test('nome que já tem minúsculas fica como está', () => {
  assert.equal(nameCase('Lima&Lima'), 'Lima&Lima');
  assert.equal(nameCase('MedTec'), 'MedTec');
  assert.equal(nameCase('  hospital  de homologação '), 'hospital de homologação');
});

test('lista de unidades em português', () => {
  assert.equal(joinNames(['UPA EUSEBIO']), 'UPA Eusebio');
  assert.equal(joinNames(['UTI/UCI', 'HMDAS', 'HIMA']), 'UTI/UCI, HMDAS e HIMA');
});
