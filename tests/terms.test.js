import test from 'node:test';
import assert from 'node:assert/strict';
import { TERMS_VERSION, needsTermsAcceptance } from '../src/lib/terms.js';

test('quem nunca aceitou precisa aceitar', () => {
  assert.equal(needsTermsAcceptance(undefined), true);
  assert.equal(needsTermsAcceptance({}), true);
  assert.equal(needsTermsAcceptance({ lgpd_accepted: false }), true);
});

test('aceite antigo, sem número de versão, vale como versão 1', () => {
  assert.equal(needsTermsAcceptance({ lgpd_accepted: true }), TERMS_VERSION !== '1');
});

test('aceite da versão vigente não pede de novo; versão antiga pede', () => {
  assert.equal(needsTermsAcceptance({ lgpd_accepted: true, lgpd_terms_version: TERMS_VERSION }), false);
  assert.equal(needsTermsAcceptance({ lgpd_accepted: true, lgpd_terms_version: '0' }), true);
});
