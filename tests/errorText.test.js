import test from 'node:test';
import assert from 'node:assert/strict';
import { errorInPortuguese } from '../src/lib/errorText.js';

test('erros comuns em português', () => {
  assert.equal(errorInPortuguese("Cannot read properties of null (reading 'name')"), 'A tela tentou usar uma informação que ainda não tinha carregado (campo "name").');
  assert.equal(errorInPortuguese('Presentation is not defined'), 'Uma parte do sistema não foi encontrada ("Presentation"). Recarregar a página costuma resolver.');
  assert.equal(errorInPortuguese("Can't find variable: Presentation"), 'Uma parte do sistema não foi encontrada ("Presentation"). Recarregar a página costuma resolver.');
  assert.match(errorInPortuguese('Importing a module script failed.'), /Não foi possível baixar uma parte do app/);
  assert.equal(errorInPortuguese('useEffect is not defined'), 'Uma parte do sistema não foi encontrada ("useEffect"). Recarregar a página costuma resolver.');
  assert.equal(errorInPortuguese('invalid input syntax for type date: ""'), 'Valor inválido para data ("").');
  assert.equal(errorInPortuguese('duplicate key value violates unique constraint "users_username_key"'), 'Já existe um registro igual (users_username_key).');
  assert.equal(errorInPortuguese('Usuário não encontrado.'), 'Usuário não encontrado.');
  assert.equal(errorInPortuguese(''), 'Erro inesperado.');
});
