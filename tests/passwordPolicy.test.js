import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordProblem, formatLockWait } from '../src/lib/passwordPolicy.js';

test('senha forte: 8+ caracteres, letras e números, nada óbvio', () => {
  assert.match(passwordProblem('abc123'), /8 caracteres/);
  assert.match(passwordProblem('abcdefgh'), /letras e números/);
  assert.match(passwordProblem('12345678'), /letras e números/);
  assert.match(passwordProblem('changeme123'), /senha pessoal/);
  assert.match(passwordProblem('yasmin2026', { username: 'yasmin' }), /usuário ou e-mail/);
  assert.match(passwordProblem('Joao12345', { email: 'joao@x.com' }), /usuário ou e-mail/);
  assert.equal(passwordProblem('Plantao#2026'), '');
});

test('tempo de bloqueio em minutos', () => {
  assert.equal(formatLockWait(900), '15 minutos');
  assert.equal(formatLockWait(30), '1 minuto');
});
