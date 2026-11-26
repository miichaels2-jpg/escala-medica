import test from 'node:test';
import assert from 'node:assert/strict';
import { isRealEmail, recoveryLinkError, recoveryRequestError } from '../src/lib/passwordRecovery.js';

test('isRealEmail separa e-mail de verdade do endereço interno', () => {
  assert.equal(isRealEmail('Ana@Hospital.com.br '), true);
  assert.equal(isRealEmail('ana.1732@scalemedic.local'), false);
  assert.equal(isRealEmail('ana'), false);
  assert.equal(isRealEmail(''), false);
});

test('recoveryLinkError traduz o erro do link', () => {
  assert.equal(recoveryLinkError('#access_token=x&type=recovery'), '');
  assert.match(recoveryLinkError('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'), /expirou/);
  assert.match(recoveryLinkError('#error=server_error'), /não é válido/);
});

test('recoveryRequestError explica espera e falta de conexão', () => {
  assert.match(recoveryRequestError({ message: 'For security purposes, you can only request this after 42 seconds.' }), /42 segundos/);
  assert.match(recoveryRequestError({ status: 429, message: 'email rate limit exceeded' }), /Muitos pedidos/);
  assert.match(recoveryRequestError(new Error('Failed to fetch')), /Sem conexão/);
});
