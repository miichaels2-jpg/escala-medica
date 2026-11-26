// Roteiro das fotos do manual: cada foto abre uma tela da demo, faz os cliques (sem salvar nada),
// troca dados pessoais por fictícios e guarda a imagem + a posição dos pontos numerados.
const B = t => ({ button: t });
const S = t => ({ buttonStarts: t });
const SEL = (selector, includes, extra = {}) => ({ selector, includes, ...extra });
const ARIA = a => ({ aria: a });

// foto recortada na janela aberta
const DIALOG = { altura: 1000, clip: { alvos: [{ selector: '[role=dialog]', last: true }], margem: [14, 14, 14, 14] } };
const nextMonth = ['click', ARIA('Próximo mês')];
const sector = name => ['click', S(name)];

export const SHOTS = [
  // ---------- Entrada ----------
  { id: 'login', as: 'anon', view: 'pc', path: '/login', clip: { alvos: [SEL('form'), S('Instalar o app')], margem: [200, 60, 20, 60] }, marks: [SEL('form input', null, { index: 0 }), SEL('input[type=password]'), SEL('input[type=checkbox]'), SEL('form button[type=submit]'), S('Instalar o app'), SEL('a', 'Solicite seu credenciamento')] },
  { id: 'login-cel', as: 'anon', view: 'cel', path: '/login', marks: [] },
  { id: 'instalar', as: 'anon', view: 'cel', path: '/login', steps: [['click', S('Instalar o app')], ['wait', 1200]], marks: [] },
  { id: 'credenciamento', as: 'anon', view: 'pc', path: '/register', altura: 1400, clip: { alvos: [SEL('form')], margem: [24, 24, 24, 24] }, marks: [SEL('input', null, { index: 0 }), SEL('ol[aria-label=Etapas]')] },

  // ---------- Painel ----------
  { id: 'painel', as: 'gestor', view: 'pc', path: '/dashboard', altura: 1400, marks: [SEL('h2, h3, p', 'Primeiros passos'), SEL('p, h2, h3, span', 'Mostrar no painel'), SEL('h2, h3', 'Precisa de você'), S('Modo TV'), ARIA('Notificações')] },
  { id: 'avisos', as: 'gestor', view: 'pc', path: '/dashboard', steps: [['click', ARIA('Notificações')], ['wait', 1200]], marks: [] },
  { id: 'painel-tendencias', as: 'gestor', view: 'pc', path: '/dashboard', altura: 1700, clip: { alvos: [SEL('section', 'Como estamos indo', { last: true })], margem: [14, 14, 14, 14] }, marks: [] },

  // ---------- Setores ----------
  { id: 'setores', as: 'gestor', view: 'pc', path: '/setores', marks: [S('Novo setor'), SEL('.rounded-3xl dd', null, { index: 0 }), S('Montar mês'), B('Editar')] },
  { id: 'setor-editar', ...DIALOG, as: 'gestor', view: 'pc', path: '/setores', steps: [['clickIn', SEL('.rounded-3xl', 'UTI Adulto', { last: true }), 'Editar'], ['wait', 1500], ['scrollDialog', 'Turnos padrão']], marks: [SEL('[role=dialog] p', 'Turnos padrão')] },

  // ---------- Corpo Clínico ----------
  { id: 'corpo-clinico', as: 'gestor', view: 'pc', path: '/corpo-clinico', marks: [S('Ativos'), SEL('input[placeholder^="Nome"]'), S('Novo profissional'), S('Convidar equipe'), S('Importar planilha'), B('Editar')] },
  { id: 'cadastro-1', ...DIALOG, as: 'gestor', view: 'pc', path: '/corpo-clinico', steps: [['click', S('Novo profissional')], ['wait', 1200], ['fillProfessional']], marks: [SEL('[role=dialog] input[type=date]'), { buttonStarts: 'Próximo: Acesso', inDialog: true }] },
  { id: 'cadastro-2', ...DIALOG, as: 'gestor', view: 'pc', path: '/corpo-clinico', steps: [['click', S('Novo profissional')], ['wait', 1200], ['fillProfessional'], ['click', { buttonStarts: 'Próximo: Acesso', inDialog: true }], ['wait', 1200]], marks: [{ buttonStarts: 'Próximo: Valores', inDialog: true }] },
  { id: 'cadastro-2b', ...DIALOG, as: 'gestor', view: 'pc', path: '/corpo-clinico', steps: [['click', S('Novo profissional')], ['wait', 1200], ['fillProfessional'], ['click', { buttonStarts: 'Próximo: Acesso', inDialog: true }], ['wait', 1200], ['scrollDialog', 'Credenciais de Login & Acesso']], marks: [{ buttonStarts: 'Senha (Data Nasc)', inDialog: true }, { buttonStarts: 'Enviar link de acesso', inDialog: true }] },
  { id: 'cadastro-3', ...DIALOG, as: 'gestor', view: 'pc', path: '/corpo-clinico', steps: [['click', S('Novo profissional')], ['wait', 1200], ['fillProfessional'], ['click', { buttonStarts: 'Próximo: Acesso', inDialog: true }], ['wait', 1000], ['click', { buttonStarts: 'Próximo: Valores', inDialog: true }], ['wait', 1200]], marks: [{ buttonStarts: 'Cadastrar profissional', inDialog: true }] },
  { id: 'convidar', ...DIALOG, as: 'gestor', view: 'pc', path: '/corpo-clinico', steps: [['click', S('Convidar equipe')], ['wait', 1500]], marks: [] },

  // ---------- Escala ----------
  { id: 'escala-grade', as: 'gestor', view: 'pc', path: '/escalas', steps: [nextMonth, ['wait', 1500], sector('Enfermaria / Clínica'), ['click', B('Grade')]], marks: [ARIA('Próximo mês'), S('Publicar'), S('Enfermaria / Clínica'), SEL('[role=group][aria-label="Visão"]'), B('Mais'), SEL('button[title="Vaga em aberto: clique para escalar"]')] },
  { id: 'escala-calendario', as: 'gestor', view: 'pc', path: '/escalas', steps: [nextMonth, ['wait', 1500], sector('Enfermaria / Clínica'), ['click', B('Calendário')], ['wait', 1200]], marks: [] },
  { id: 'escala-lista', as: 'gestor', view: 'pc', path: '/escalas', steps: [nextMonth, ['wait', 1500], sector('Enfermaria / Clínica'), ['click', B('Lista')], ['wait', 1200]], marks: [] },
  { id: 'escala-escalar', ...DIALOG, as: 'gestor', view: 'pc', path: '/escalas', steps: [nextMonth, ['wait', 1500], sector('Enfermaria / Clínica'), ['click', B('Grade')], ['click', SEL('button[title="Vaga em aberto: clique para escalar"]')], ['wait', 1500]], marks: [] },
  { id: 'escala-preenchido', as: 'gestor', view: 'pc', path: '/escalas', steps: [nextMonth, ['wait', 1500], sector('Enfermaria / Clínica'), ['click', B('Grade')], ['click', SEL('button[title^="Plantonista Teste"]')], ['wait', 1500]], clip: { alvos: [{ selector: '[role=dialog]', last: true }], margem: [14, 14, 14, 14] }, marks: [{ buttonStarts: 'Liberar vaga', inDialog: true }] },
  { id: 'escala-avulso', ...DIALOG, as: 'gestor', view: 'pc', path: '/escalas', steps: [nextMonth, ['wait', 1500], ['click', B('Mais')], ['wait', 800], ['click', SEL('[role=menuitem]', 'Plantão avulso')], ['wait', 1500]], marks: [] },
  { id: 'escala-mais', as: 'gestor', view: 'pc', path: '/escalas', steps: [nextMonth, ['wait', 1500], ['click', B('Mais')], ['wait', 900]], marks: [SEL('[role=menuitem]', 'Plantão avulso'), SEL('[role=menuitem]', 'Montar turnos do mês'), SEL('[role=menuitem]', 'Plantão do dia'), SEL('[role=menuitem]', 'Modo TV'), SEL('[role=menuitem]', 'Imprimir o mês')], keepOpen: true },
  { id: 'escala-gerador', ...DIALOG, as: 'gestor', view: 'pc', path: '/setores', steps: [['clickIn', SEL('.rounded-3xl', 'UTI Adulto', { last: true }), 'Montar mês'], ['wait', 7000]], marks: [SEL('[role=dialog] button[role=combobox]', null, { index: 0 }), SEL('[role=dialog] input[type=date]'), S('Novo Turno'), { buttonStarts: 'Próximo: escolher profissionais', inDialog: true }] },
  { id: 'escala-alocar', ...DIALOG, as: 'gestor', view: 'pc', path: '/setores', steps: [['clickIn', SEL('.rounded-3xl', 'UTI Adulto', { last: true }), 'Montar mês'], ['wait', 7000], ['uncheckTemplate'], ['click', { buttonStarts: 'Próximo: escolher profissionais', inDialog: true }], ['wait', 2500]], marks: [{ buttonStarts: 'Salvar como rascunho', inDialog: true }, { buttonStarts: 'Salvar e publicar', inDialog: true }] },
  { id: 'escala-publicar', ...DIALOG, as: 'gestor', view: 'pc', path: '/escalas', steps: [nextMonth, ['wait', 1500], sector('Enfermaria / Clínica'), ['click', S('Publicar')], ['wait', 1500]], marks: [{ button: 'Mês Inteiro', inDialog: true }, SEL('[role=dialog] button.bg-emerald-600')] },
  { id: 'escala-copiar', ...DIALOG, as: 'gestor', view: 'pc', path: '/escalas', steps: [nextMonth, ['wait', 1500], ['click', S('Copiar mês anterior')], ['wait', 1500]], marks: [] },
  { id: 'escala-dia', as: 'gestor', view: 'pc', path: '/escalas', steps: [['click', B('Mais')], ['wait', 800], ['click', SEL('[role=menuitem]', 'Plantão do dia')], ['wait', 1500]], marks: [S('Imprimir')] },
  { id: 'escala-tv', as: 'gestor', view: 'pc', path: '/escalas', steps: [['click', B('Mais')], ['wait', 800], ['click', SEL('[role=menuitem]', 'Modo TV')], ['wait', 2500]], marks: [] },

  // ---------- Mural ----------
  { id: 'mural-vagas', as: 'gestor', view: 'pc', path: '/trocas', marks: [S('Vagas'), S('Aprovações'), S('Meus plantões'), SEL('main button', 'Histórico'), S('Que eu posso assumir'), SEL('select')] },
  { id: 'mural-aprovacoes', as: 'gestor', view: 'pc', path: '/trocas', steps: [['click', S('Aprovações')], ['wait', 1200]], marks: [] },
  { id: 'mural-historico', as: 'gestor', view: 'pc', path: '/trocas', steps: [['click', SEL('main button', 'Histórico')], ['wait', 1200]], marks: [] },

  // ---------- Plantonista (celular) ----------
  { id: 'cel-minha-escala', as: 'plantonista', view: 'cel', path: '/minha-escala', marks: [S('Adicionar à agenda'), S('Ver o Mural'), ARIA('Notificações')] },
  { id: 'cel-resumo', as: 'plantonista', view: 'cel', path: '/minha-escala', steps: [['scrollTo', SEL('h2', 'Resumo do mês')]], marks: [] },
  { id: 'cel-nota', as: 'plantonista', view: 'cel', path: '/minha-escala', steps: [['scrollTo', SEL('h2', 'Nota fiscal de')]], marks: [] },
  { id: 'cel-disponibilidade', as: 'plantonista', view: 'cel', path: '/minha-escala', steps: [['scrollTo', SEL('h2', 'Minha disponibilidade')]], marks: [] },
  { id: 'cel-proximos', as: 'plantonista', view: 'cel', path: '/minha-escala', steps: [['scrollTo', SEL('h2, h3, button', 'Próximos plantões')]], marks: [S('Passar no Mural')] },
  { id: 'cel-mural', as: 'plantonista', view: 'cel', path: '/trocas', marks: [S('Vagas'), S('Meus plantões')] },
  { id: 'cel-meus-plantoes', as: 'plantonista', view: 'cel', path: '/trocas', steps: [['click', S('Meus plantões')], ['wait', 1200]], marks: [B('Passar p/ Mural')] },
  { id: 'cel-menu', as: 'plantonista', view: 'cel', path: '/minha-escala', steps: [['click', ARIA('Abrir menu')], ['wait', 900]], marks: [] },

  // ---------- Faturamento ----------
  { id: 'faturamento', as: 'gestor', view: 'pc', path: '/faturamento', altura: 1500, steps: [['click', ARIA('Mês anterior')], ['wait', 2500]], marks: [ARIA('Mês anterior'), S('Lançar atendimentos'), SEL('input[aria-label="Selecionar todos a pagar"]'), SEL('tbody button', 'Demonstrativo'), S('Imprimir fechamento')] },
  { id: 'faturamento-atendimentos', ...DIALOG, as: 'gestor', view: 'pc', path: '/faturamento', steps: [['click', S('Lançar atendimentos')], ['wait', 1800]], marks: [] },
  { id: 'faturamento-tabela', as: 'gestor', view: 'pc', path: '/faturamento', steps: [['click', ARIA('Mês anterior')], ['wait', 2500], ['scrollTo', SEL('table')]], marks: [] },
  { id: 'faturamento-detalhar', ...DIALOG, as: 'gestor', view: 'pc', path: '/faturamento', steps: [['clickIn', SEL('tr', 'Plantonista Teste'), 'Detalhar'], ['wait', 1500]], marks: [B('Ver nota'), B('Aceitar'), B('Devolver'), S('Informe')] },

  // ---------- Relatórios ----------
  { id: 'relatorios', as: 'gestor', view: 'pc', path: '/relatorios', marks: [B('Visão geral'), SEL('main button[role=combobox]', null, { index: 0 }), S('Exportar para Excel'), S('Imprimir')] },
  // ---------- Indicadores ----------
  { id: 'indicadores', as: 'gestor', view: 'pc', path: '/indicadores', altura: 1150, steps: [['selectValue', 'section[aria-label=Filtros] select', 'anterior']], marks: [SEL('section[aria-label=Filtros] select', null, { index: 0 }), SEL('section[aria-label=Filtros] select', null, { index: 1 }), SEL('section[aria-label=Filtros] select', null, { index: 2 }), B('Ver lista')] },
  { id: 'indicadores-distribuicao', as: 'gestor', view: 'pc', path: '/indicadores', altura: 1700, steps: [['selectValue', 'section[aria-label=Filtros] select', 'anterior']], clip: { alvos: [SEL('section', 'Distribuição da equipe', { last: true })], margem: [14, 14, 14, 14] }, marks: [] },
  { id: 'indicadores-lista', ...DIALOG, as: 'gestor', view: 'pc', path: '/indicadores', steps: [['selectValue', 'section[aria-label=Filtros] select', 'anterior'], ['clickIn', SEL('section', 'Segurança do plantão', { last: true }), 'Ver lista'], ['wait', 1200]], marks: [S('Exportar Excel'), S('Imprimir')] },
  { id: 'relatorios-apresentacao', as: 'gestor', view: 'pc', path: '/relatorios', steps: [['click', S('Apresentação do mês')], ['wait', 3500]], marks: [] },
  { id: 'relatorios-plantoes', as: 'gestor', view: 'pc', path: '/relatorios', steps: [['click', B('Escalas')], ['wait', 900], ['click', B('Plantões')], ['wait', 1500]], marks: [] },
  { id: 'relatorios-confiabilidade', as: 'gestor', view: 'pc', path: '/relatorios', steps: [['click', B('Equipe')], ['wait', 900], ['click', B('Confiabilidade')], ['wait', 1500]], marks: [] },

  // ---------- Histórico e Configurações ----------
  { id: 'historico', as: 'gestor', view: 'pc', path: '/historico', marks: [] },
  { id: 'config-hospital', as: 'gestor', view: 'pc', path: '/configuracoes', marks: [S('Hospital Atual'), S('Contrato Matriz'), S('Gerenciar Hospitais'), S('Regras da escala')] },
  { id: 'config-contrato', as: 'gestor', view: 'pc', path: '/configuracoes', steps: [['click', S('Contrato Matriz')], ['wait', 1200]], marks: [] },
  { id: 'config-hospitais', as: 'gestor', view: 'pc', path: '/configuracoes', steps: [['click', S('Gerenciar Hospitais')], ['wait', 1200]], marks: [] },
  { id: 'config-regras', as: 'gestor', view: 'pc', path: '/configuracoes', steps: [['click', S('Regras da escala')], ['wait', 1200]], marks: [] },

  // ---------- Ajuda ----------
  { id: 'como-fazer', as: 'gestor', view: 'pc', path: '/escalas', steps: [['click', ARIA('Como fazer nesta tela')], ['wait', 1000]], marks: [ARIA('Como fazer nesta tela')], keepOpen: true },
  { id: 'guia-na-tela', as: 'gestor', view: 'pc', path: '/escalas', steps: [['click', ARIA('Como fazer nesta tela')], ['wait', 900], ['click', SEL('[role=dialog] li button', 'Mostrar na tela', { index: 2 })], ['wait', 1800]], marks: [], keepOpen: true },
  { id: 'como-usar', as: 'gestor', view: 'pc', path: '/como-usar', marks: [] }
];
