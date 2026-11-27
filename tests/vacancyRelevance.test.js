import test from 'node:test';
import assert from 'node:assert/strict';
import { isVacancyRelevantFor, isVisibleToProfessional, specialtyMatches } from '../src/lib/vacancyRelevance.js';

const clinico = { id: 'c', specialty: 'Clínica Médica', data: { authorized_sectors: ['emerg', 'uti'] } };
const semEsp = { id: 's', specialty: '', data: {} };
const vaga = (specialty, sector = 'emerg') => ({ sector_id: sector, target_specialty: specialty, status: 'vago', professional_id: null });

test('vaga aberta só aparece para a mesma especialidade', () => {
  assert.equal(isVacancyRelevantFor(vaga('Clínica Médica'), clinico), true);
  assert.equal(isVacancyRelevantFor(vaga('Ginecologia'), clinico), false);
  assert.equal(isVacancyRelevantFor(vaga('Geral'), clinico), true);
  assert.equal(isVacancyRelevantFor({ sector_id: 'emerg', notes: '[ESP:Pediatria]', status: 'vago' }, clinico), false);
});

test('setor não liberado também barra', () => {
  assert.equal(isVacancyRelevantFor(vaga('Clínica Médica', 'enfermaria'), clinico), false);
});

test('sem especialidade no cadastro só vê vaga geral', () => {
  assert.equal(specialtyMatches(vaga('Cardiologia'), semEsp), false);
  assert.equal(specialtyMatches(vaga(''), semEsp), true);
});

test('na escala publicada, plantão preenchido aparece para todos; vaga de outra especialidade não', () => {
  const preenchido = { sector_id: 'emerg', target_specialty: 'Ginecologia', status: 'confirmado', professional_id: 'x', professional_name: 'Ana' };
  assert.equal(isVisibleToProfessional(preenchido, clinico), true);
  assert.equal(isVisibleToProfessional(vaga('Ginecologia'), clinico), false);
  assert.equal(isVisibleToProfessional(vaga('Clínica Médica'), clinico), true);
});
