import test from 'node:test';
import assert from 'node:assert/strict';
import { inferPixType, mapRow, parseCsv, parseFlexibleDate, prepareProfessionalRow, resolveCategory, resolveSpecialty } from '../src/lib/professionalImport.js';

const categories = [
  { id: 'medico', label: 'Médico(a)' }, { id: 'enfermeiro', label: 'Enfermeiro(a)' },
  { id: 'tecnico_enfermagem', label: 'Téc. Enfermagem' }, { id: 'fisioterapeuta', label: 'Fisioterapeuta' }
];
const roles = [{ id: 'assistencial', label: 'Profissional Assistencial' }, { id: 'gestor', label: 'Gestor Geral / Administrador' }, { id: 'coordenador', label: 'Coordenador de Escala' }, { id: 'faturamento', label: 'Faturamento / Financeiro' }];
const units = [{ id: 'u1', name: 'Hospital Santa Clara' }, { id: 'u2', name: 'Hospital Vida & Saúde Dois' }];
const sectors = [{ id: 's1', name: 'UTI Adulto', unit_id: 'u1' }, { id: 's2', name: 'Pronto-Socorro', unit_id: 'u1' }];
const ctx = extra => ({ lineNumber: 2, seenKeys: new Set(), categories, roles, units, sectors, selectedUnitId: 'u1', companyId: 'c1', existing: [], existingSpecialties: ['Clínica Médica'], ...extra });

test('cabeçalhos com nomes comuns', () => {
  const { row, unknown } = mapRow({ 'Nome': 'Ana', 'E-mail': 'a@x.com', 'Celular': '85 99999-0000', 'CRM': '1234-CE', 'Data de Nascimento': '05/03/1990', 'Especialização': 'Pediatria', 'Observação': 'x' });
  assert.deepEqual(row, { nome_completo: 'Ana', email: 'a@x.com', telefone: '85 99999-0000', conselho: '1234-CE', data_nascimento: '05/03/1990', especialidade: 'Pediatria' });
  assert.deepEqual(unknown, ['Observação']);
});

test('datas em vários formatos', () => {
  assert.equal(parseFlexibleDate('1990-03-05'), '1990-03-05');
  assert.equal(parseFlexibleDate('5/3/1990'), '1990-03-05');
  assert.equal(parseFlexibleDate('05-03-1990'), '1990-03-05');
  assert.equal(parseFlexibleDate('05.03.90'), '1990-03-05');
  assert.equal(parseFlexibleDate('05/03/05'), '2005-03-05');
  assert.equal(parseFlexibleDate('32937'), '1990-03-05'); // número de série do Excel
  assert.equal(parseFlexibleDate('31/02/1990'), null);
  assert.equal(parseFlexibleDate('ontem'), null);
  assert.equal(parseFlexibleDate(''), '');
});

test('categoria, especialidade e PIX', () => {
  assert.deepEqual(resolveCategory('Enfermeiro(a)', categories), { id: 'enfermeiro', guessed: false });
  assert.equal(resolveCategory('Técnico de Enfermagem', categories).id, 'tecnico_enfermagem');
  assert.equal(resolveCategory('ENFERMEIRA', categories).id, 'enfermeiro');
  assert.equal(resolveCategory('Médico Plantonista', categories).id, 'medico');
  assert.equal(resolveCategory('Motorista', categories).unknown, true);
  assert.equal(resolveSpecialty('clinica medica', ['Clínica Médica']), 'Clínica Médica');
  assert.equal(resolveSpecialty('MEDICINA DE FAMILIA E COMUNIDADE', []), 'Medicina de Familia e Comunidade');
  assert.equal(resolveSpecialty('Ortopedia', []), 'Ortopedia');
  assert.equal(inferPixType('ana@x.com', ''), 'Email');
  assert.equal(inferPixType('123.456.789-09', ''), 'CPF');
  assert.equal(inferPixType('85999990000', '', { phone: '(85) 99999-0000' }), 'Telefone');
  assert.equal(inferPixType('12345678909', '', { cpf: '123.456.789-09' }), 'CPF');
  assert.equal(inferPixType('12.345.678/0001-90', ''), 'CNPJ');
  assert.equal(inferPixType('x', 'aleatório'), 'Aleatoria');
});

test('linha da planilha do hospital entra com ajustes em vez de travar', () => {
  const r = prepareProfessionalRow({
    'Nome': 'maria souza', 'Profissão': 'Motorista', 'Especialidade': 'clinica medica', 'Status': 'férias',
    'Nascimento': '1/2/85', 'E-mail': 'maria@', 'Hospital': 'santa clara', 'Setor': 'UTI', 'Valor do plantão': 'R$ 1.200,00',
    'Chave PIX': 'maria@pix.com', 'CNPJ': '12.345.678/0001-90'
  }, ctx());
  assert.deepEqual(r.errors, []);
  assert.equal(r.payload.specialty, 'Clínica Médica');
  assert.equal(r.payload.name, 'Maria Souza');
  assert.equal(r.payload.status, 'ativo');
  assert.equal(r.payload.birth_date, '1985-02-01');
  assert.match(r.payload.email, /@scalemedic\.local$/);
  assert.deepEqual(r.payload.unit_ids, ['u1']);
  assert.equal(r.payload.data.main_sector, 'UTI Adulto');
  assert.deepEqual(r.payload.data.unit_rates, { u1: { diurno: 1200, noturno: 1200, fds: 1200 } });
  assert.equal(r.payload.data.pix_type, 'Email');
  assert.equal(r.payload.data.receipt_type, 'pj');
  assert.equal(r.warnings.length, 3); // categoria, status, e-mail
});

test('sem nome, repetido e já cadastrado', () => {
  const seenKeys = new Set();
  assert.deepEqual(prepareProfessionalRow({ Nome: '' }, ctx({ seenKeys })).errors, ['linha sem nome']);
  prepareProfessionalRow({ Nome: 'Ana', CPF: '123.456.789-09' }, ctx({ seenKeys }));
  assert.deepEqual(prepareProfessionalRow({ Nome: 'Ana B', CPF: '12345678909' }, ctx({ seenKeys })).errors, ['repetido nesta planilha']);
  const existing = [{ id: 'p1', name: 'Bruno Lima', cpf: '', email: 'bruno@x.com', data: {} }];
  assert.equal(prepareProfessionalRow({ Nome: 'Bruno', 'E-mail': 'BRUNO@x.com' }, ctx({ existing })).existingMatch.id, 'p1');
});

test('CSV com ponto e vírgula e aspas', () => {
  assert.deepEqual(parseCsv('﻿Nome;Especialidade\n"Silva; Ana";Pediatria\r\n\nBruno;"Clínica ""Geral"""'), [
    ['Nome', 'Especialidade'], ['Silva; Ana', 'Pediatria'], ['Bruno', 'Clínica "Geral"']
  ]);
});
