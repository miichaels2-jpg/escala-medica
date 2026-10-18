import test from 'node:test';
import assert from 'node:assert/strict';
import { describeAuditEntry, isInternalOnly } from '../src/lib/auditLog.js';

const ctx = {
  sectorName: id => ({ s1: 'UTI Adulto' })[id],
  professionalName: id => ({ p1: 'Ana Souza', p2: 'Bruno Lima' })[id]
};
const base = { date: '2026-10-20', start_time: '07:00', end_time: '19:00', sector_id: 's1' };

test('plantão criado, alocado, trocado, liberado e excluído', () => {
  assert.equal(describeAuditEntry({ table_name: 'shifts', action: 'insert', new_data: { ...base, status: 'vago' } }, ctx),
    'Criou plantão de 20/10/2026 07:00–19:00 · UTI Adulto (vaga aberta)');
  assert.equal(describeAuditEntry({ table_name: 'shifts', action: 'update', changed_fields: ['professional_id', 'status'], old_data: { ...base }, new_data: { ...base, professional_id: 'p1' } }, ctx),
    'Alocou Ana Souza — plantão de 20/10/2026 07:00–19:00 · UTI Adulto');
  assert.equal(describeAuditEntry({ table_name: 'shifts', action: 'update', changed_fields: ['professional_id'], old_data: { ...base, professional_id: 'p1' }, new_data: { ...base, professional_id: 'p2' } }, ctx),
    'Trocou Ana Souza por Bruno Lima — plantão de 20/10/2026 07:00–19:00 · UTI Adulto');
  assert.equal(describeAuditEntry({ table_name: 'shifts', action: 'update', changed_fields: ['professional_id', 'status'], old_data: { ...base, professional_id: 'p1' }, new_data: { ...base, professional_id: null } }, ctx),
    'Liberou o plantão de Ana Souza (virou vaga) — plantão de 20/10/2026 07:00–19:00 · UTI Adulto');
  assert.equal(describeAuditEntry({ table_name: 'shifts', action: 'delete', old_data: { ...base, professional_id: 'p2' } }, ctx),
    'Excluiu plantão de 20/10/2026 07:00–19:00 · UTI Adulto (Bruno Lima)');
});

test('publicação e pagamento', () => {
  assert.equal(describeAuditEntry({ table_name: 'published_schedules', action: 'insert', new_data: { sector_id: 's1', year: 2026, month: 10, ranges: [{ start_date: '2026-10-01', end_date: '2026-10-31' }] } }, ctx),
    'Publicou a escala de UTI Adulto (outubro/2026): 01/10/2026 a 31/10/2026');
  assert.equal(describeAuditEntry({ table_name: 'published_schedules', action: 'update', new_data: { sector_id: 's1', year: 2026, month: 10, ranges: [] } }, ctx),
    'Voltou a escala de UTI Adulto (outubro/2026) para rascunho');
  assert.equal(describeAuditEntry({ table_name: 'payment_statuses', action: 'insert', new_data: { professional_id: 'p1', month: '2026-10', paid: true } }, ctx),
    'Marcou como pago Ana Souza (2026-10)');
});

test('ajuste só de observações é interno', () => {
  assert.equal(isInternalOnly({ table_name: 'shifts', action: 'update', changed_fields: ['notes'] }), true);
  assert.equal(isInternalOnly({ table_name: 'shifts', action: 'update', changed_fields: ['notes', 'status'] }), false);
  assert.equal(isInternalOnly({ table_name: 'shifts', action: 'insert' }), false);
});
