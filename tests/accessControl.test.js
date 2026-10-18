import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessRoute, getHomePath, ROUTE_PRIORITY, SCREENS, defaultScreensForRole, isManagerUser } from '../src/lib/accessControl.js';

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

test('liberação tela por tela: administrativo com acesso a tudo sem ser gestor', () => {
  const adminStaff = { role: 'user', data: { app_role: 'assistencial', screen_access: SCREENS.map(s => s.path), can_edit: true } };
  for (const screen of SCREENS) assert.equal(canAccessRoute(adminStaff, screen.path), true, screen.path);
  assert.equal(isManagerUser(adminStaff), true);
});

test('liberação tela por tela também tira acesso, mesmo de gestor', () => {
  const limited = { role: 'user', data: { app_role: 'gestor', screen_access: ['/escalas', '/relatorios'] } };
  assert.equal(canAccessRoute(limited, '/escalas'), true);
  assert.equal(canAccessRoute(limited, '/relatorios'), true);
  assert.equal(canAccessRoute(limited, '/faturamento'), false);
  assert.equal(canAccessRoute(limited, '/dashboard'), false);
  assert.equal(getHomePath(limited), '/escalas');
});

test('perfis dão o ponto de partida das telas', () => {
  assert.deepEqual(defaultScreensForRole('assistencial'), ['/escalas', '/trocas', '/minha-escala']);
  assert.ok(defaultScreensForRole('faturamento').includes('/faturamento'));
  assert.ok(!defaultScreensForRole('faturamento').includes('/configuracoes'));
  assert.equal(defaultScreensForRole('gestor').length, SCREENS.length);
});
