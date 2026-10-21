import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordProblem, formatLockWait, generateProvisionalPassword } from '../src/lib/passwordPolicy.js';

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

test('senha provisória aleatória passa na regra de senha forte', () => {
  const a = generateProvisionalPassword();
  const b = generateProvisionalPassword();
  assert.match(a, /^Sm[a-z]{4}[2-9]{4}$/);
  assert.notEqual(a, b);
  assert.equal(passwordProblem(a), '');
});
