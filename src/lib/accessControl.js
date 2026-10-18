// Controle de acesso às telas.
//
// Perfis (users.data.app_role): gestor/manager e role=admin (acesso total),
// coordenador (gestão de escalas), faturamento (financeiro) e
// assistencial/medico (plantonista).
//
// users.data.screen_access (lista de telas, definida no Corpo Clínico) libera
// tela por tela, independente do perfil; users.data.can_edit dá poderes de
// alteração nas telas liberadas sem a pessoa ser gestor.
//
// users.data.permissions (opcional, formato antigo) restringe ainda mais. Existem dois formatos
// gravados no banco ("escalas", "trocas" e "minha_escala", "trocas_plantao",
// "mural_oportunidades", "meus_repasses"); os dois são aceitos.

export function getAppRole(user) {
  return user?.data?.app_role || (user?.role === 'admin' ? 'gestor' : 'assistencial');
}

export function isManagerUser(user) {
  const role = getAppRole(user);
  return user?.role === 'admin' || ['gestor', 'manager', 'coordenador'].includes(role) || user?.data?.can_edit === true;
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
export const ROUTE_PRIORITY = ['/minha-escala', '/trocas', '/escalas', '/dashboard', '/relatorios', '/faturamento', '/corpo-clinico', '/setores', '/historico', '/configuracoes'];

// Telas que podem ser liberadas uma a uma (ordem do menu).
export const SCREENS = [
  { path: '/dashboard', label: 'Painel Geral', desc: 'Visão do dia, vagas, custos e unidades' },
  { path: '/escalas', label: 'Escalas & Plantões', desc: 'Grade, alocação, geração e publicação' },
  { path: '/trocas', label: 'Mural de Oportunidades', desc: 'Vagas abertas, trocas e repasses' },
  { path: '/minha-escala', label: 'Minha Escala', desc: 'Os próprios plantões, agenda e disponibilidade' },
  { path: '/corpo-clinico', label: 'Corpo Clínico', desc: 'Cadastro de profissionais e acessos' },
  { path: '/setores', label: 'Setores & Especialidades', desc: 'Setores de cada unidade' },
  { path: '/relatorios', label: 'Relatórios', desc: 'BI, custos e exportações' },
  { path: '/faturamento', label: 'Faturamento & Repasse', desc: 'Fechamento, produtividade e pagamentos' },
  { path: '/historico', label: 'Histórico de alterações', desc: 'Quem mudou o quê, e quando' },
  { path: '/configuracoes', label: 'Configurações', desc: 'Unidades, logos e regras gerais' }
];
const SCREEN_PATHS = SCREENS.map(screen => screen.path);

// Lista de telas liberadas para o usuário (null = segue o perfil).
export function getScreenAccess(user) {
  const list = user?.data?.screen_access;
  return Array.isArray(list) ? list.map(String).filter(path => SCREEN_PATHS.includes(path)) : null;
}

// Telas que cada perfil recebe por padrão (ponto de partida no Corpo Clínico).
export function defaultScreensForRole(appRole) {
  const probe = { role: 'user', data: { app_role: appRole } };
  return SCREEN_PATHS.filter(path => ROLE_RULES[path](probe));
}

// Perfis com poder de alteração por padrão.
export function defaultCanEditForRole(appRole) {
  return ['gestor', 'manager', 'coordenador'].includes(appRole);
}

export function canAccessRoute(user, pathname) {
  const rule = ROLE_RULES[pathname];
  if (!rule) return true;
  if (user?.role === 'admin') return true;
  const screens = getScreenAccess(user);
  if (screens && SCREEN_PATHS.includes(pathname)) return screens.includes(pathname);
  if (!rule(user)) return false;
  if (user?.role === 'admin' || isManagerUser(user)) return true;
  const permissions = Array.isArray(user?.data?.permissions) ? user.data.permissions.map(String) : [];
  if (permissions.length === 0) return true;
  return PERMISSION_KEYS[pathname].some(key => permissions.includes(key));
}

// Tela inicial após o login: o plantonista vai direto para a própria agenda.
export function getHomePath(user) {
  const preferred = isFieldProfessional(user) ? '/minha-escala' : '/dashboard';
  if (canAccessRoute(user, preferred)) return preferred;
  return ROUTE_PRIORITY.find(path => canAccessRoute(user, path)) || '/minha-escala';
}
