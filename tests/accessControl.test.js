import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessRoute, getHomePath, ROUTE_PRIORITY } from '../src/lib/accessControl.js';

const professionalWithOldPermissions = {
  role: 'user',
  data: { app_role: 'assistencial', permissions: ['minha_escala', 'trocas_plantao', 'mural_oportunidades', 'meus_repasses'] }
};
const manager = { role: 'user', data: { app_role: 'gestor', permissions: ['dashboard'] } };
const admin = { role: 'admin', data: { app_role: 'gestor' } };
const professionalWithoutPermissions = { role: 'user', data: { app_role: 'assistencial' } };

test('plantonista com permissões no formato antigo abre Minha Escala e o Mural (caso da tela em branco)', () => {
  assert.equal(canAccessRoute(professionalWithOldPermissions, '/minha-escala'), true);
  assert.equal(canAccessRoute(professionalWithOldPermissions, '/trocas'), true);
  assert.equal(getHomePath(professionalWithOldPermissions), '/minha-escala');
});

test('sempre existe uma tela de destino liberada para quem foi negado (sem ciclo de redirecionamento)', () => {
  for (const user of [professionalWithOldPermissions, professionalWithoutPermissions, manager, admin]) {
    assert.ok(ROUTE_PRIORITY.some(path => canAccessRoute(user, path)));
    assert.equal(canAccessRoute(user, getHomePath(user)), true);
  }
});

test('plantonista não abre telas de gestão nem pelo endereço', () => {
  for (const path of ['/dashboard', '/faturamento', '/relatorios', '/corpo-clinico', '/configuracoes', '/setores']) {
    assert.equal(canAccessRoute(professionalWithoutPermissions, path), false, path);
  }
});

test('gestor e administrador entram no Painel e acessam a gestão', () => {
  assert.equal(getHomePath(manager), '/dashboard');
  assert.equal(getHomePath(admin), '/dashboard');
  assert.equal(canAccessRoute(manager, '/configuracoes'), true);
  assert.equal(canAccessRoute(admin, '/faturamento'), true);
});
