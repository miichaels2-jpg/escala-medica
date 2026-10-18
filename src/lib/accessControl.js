// Controle de acesso às telas.
//
// Perfis (users.data.app_role): gestor/manager e role=admin (acesso total),
// coordenador (gestão de escalas), faturamento (financeiro) e
// assistencial/medico (plantonista).
//
// users.data.permissions (opcional) restringe ainda mais. Existem dois formatos
// gravados no banco ("escalas", "trocas" e "minha_escala", "trocas_plantao",
// "mural_oportunidades", "meus_repasses"); os dois são aceitos.

export function getAppRole(user) {
  return user?.data?.app_role || (user?.role === 'admin' ? 'gestor' : 'assistencial');
}

export function isManagerUser(user) {
  const role = getAppRole(user);
  return user?.role === 'admin' || ['gestor', 'manager', 'coordenador'].includes(role);
}

export function isBillingUser(user) {
  return isManagerUser(user) || getAppRole(user) === 'faturamento';
}

export function isFieldProfessional(user) {
  return ['assistencial', 'medico'].includes(getAppRole(user)) && user?.role !== 'admin';
}

// Quem pode abrir cada tela (pelo perfil).
const ROLE_RULES = {
  '/minha-escala': () => true,
  '/trocas': () => true,
  '/escalas': () => true,
  '/dashboard': user => isBillingUser(user),
  '/corpo-clinico': user => isBillingUser(user),
  '/relatorios': user => isBillingUser(user),
  '/faturamento': user => isBillingUser(user),
  '/setores': user => isManagerUser(user),
  '/configuracoes': user => isManagerUser(user),
  '/historico': user => isManagerUser(user),
  '/planejamento': user => isManagerUser(user) // TEMPORÁRIO
};

// Nomes de permissão aceitos para cada tela.
const PERMISSION_KEYS = {
  '/minha-escala': ['minha_escala', 'escalas', 'meus_repasses'],
  '/trocas': ['trocas', 'trocas_plantao', 'mural_oportunidades'],
  '/escalas': ['escalas'],
  '/dashboard': ['dashboard'],
  '/corpo-clinico': ['corpo_clinico'],
  '/relatorios': ['relatorios'],
  '/faturamento': ['faturamento', 'meus_repasses'],
  '/setores': ['setores'],
  '/configuracoes': ['configuracoes'],
  '/historico': ['configuracoes', 'relatorios'],
  '/planejamento': ['configuracoes'] // TEMPORÁRIO
};

// Ordem usada para escolher a tela de destino quando uma rota é negada.
export const ROUTE_PRIORITY = ['/minha-escala', '/trocas', '/escalas', '/dashboard', '/relatorios', '/faturamento'];

export function canAccessRoute(user, pathname) {
  const rule = ROLE_RULES[pathname];
  if (!rule) return true;
  if (!rule(user)) return false;
  if (user?.role === 'admin' || isManagerUser(user)) return true;
  const permissions = Array.isArray(user?.data?.permissions) ? user.data.permissions.map(String) : [];
  if (permissions.length === 0) return true;
  return PERMISSION_KEYS[pathname].some(key => permissions.includes(key));
}

// Tela inicial após o login: o plantonista vai direto para a própria agenda.
export function getHomePath(user) {
  return isFieldProfessional(user) ? '/minha-escala' : '/dashboard';
}
