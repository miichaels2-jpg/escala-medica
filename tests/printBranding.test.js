import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, getCompanyLogoUrl, getUnitLogoUrl } from '../src/lib/printBranding.js';

test('uses the company logo saved in either column', () => {
  assert.equal(getCompanyLogoUrl({ logo_url: 'data:image/png;base64,AAA' }), 'data:image/png;base64,AAA');
  assert.equal(getCompanyLogoUrl({ logo_url: '', data: { logo_url: 'data:image/png;base64,BBB' } }), 'data:image/png;base64,BBB');
  assert.equal(getCompanyLogoUrl(null), '');
  assert.equal(getUnitLogoUrl({ logo_url: ' data:image/png;base64,CCC ' }), 'data:image/png;base64,CCC');
});

test('escapes text injected into printable documents', () => {
  assert.equal(escapeHtml('<b>"Ana" & Cia</b>'), '&lt;b&gt;&quot;Ana&quot; &amp; Cia&lt;/b&gt;');
});
