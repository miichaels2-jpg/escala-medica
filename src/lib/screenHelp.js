// Ajuda de cada tela: o botão "Como fazer" no topo (PageHero) lista as tarefas da tela,
// cada uma com o vídeo (janelinha flutuante) e/ou o guia na própria tela ("clique aqui").
//
// Alvo de um passo (target): onde a tela fica em destaque. Pode ser uma lista de opções,
// e vale a primeira que estiver visível:
//   { button: 'Grade' }             botão com esse texto exato
//   { buttonStarts: 'Publicar' }    botão cujo texto começa assim
//   { selector: 'tbody tr', includes: 'texto' }   primeiro elemento visível (com o texto, se houver)
//   inDialog: true                  procura só dentro da janela aberta
// click: true → o guia avança sozinho quando a pessoa clica no destaque e o próximo alvo aparece.
// skipWhen: alvo que, se já estiver na tela, pula este passo.
// missing: texto mostrado quando o alvo não existe agora (ex.: nenhuma vaga no mês).
import { findTutorial } from './tutorials.js';

const GENERATOR_DIALOG = { selector: '[role=dialog]', includes: 'Montar escala' };

const GENERATOR_STEPS = [
  {
    target: GENERATOR_DIALOG,
    title: 'Confira os turnos',
    text: 'O setor já vem com os turnos padrão e o mês inteiro. Dá para mudar horários, vagas e o período antes de seguir.'
  },
  {
    target: { buttonStarts: 'Próximo: escolher profissionais', inDialog: true },
    title: 'Escolha os profissionais',
    text: 'Clique aqui para escolher quem fica em cada vaga.',
    click: true
  },
  {
    target: { buttonStarts: 'Salvar como rascunho', inDialog: true },
    title: 'Salve',
    text: 'Escolha quem fica em cada vaga ou deixe aberta para o Mural. Nada é gravado até você salvar como rascunho ou publicar.'
  }
];

export const TOURS = {
  'escala-montar-mes': [
    {
      target: [{ buttonStarts: 'Montar turnos do mês' }, { button: 'Mais' }],
      skipWhen: GENERATOR_DIALOG,
      title: 'Montar o mês',
      text: 'Abra “Mais” e escolha “Montar turnos do mês”. Ele cria todas as vagas do mês de uma vez.',
      click: true
    },
    {
      target: { selector: '[role=menuitem]', includes: 'Montar turnos do mês' },
      skipWhen: GENERATOR_DIALOG,
      title: 'Montar turnos do mês',
      text: 'Clique aqui.',
      click: true
    },
    ...GENERATOR_STEPS
  ],
  'setores-montar-mes': [
    {
      target: { selector: '.rounded-3xl dd' },
      title: 'Turnos padrão do setor',
      text: 'Cada setor guarda os seus turnos fixos, por exemplo 2 vagas de dia e 1 de noite. Para mudar, use “Editar”.'
    },
    {
      target: { buttonStarts: 'Montar mês' },
      title: 'Montar mês',
      text: 'Clique em “Montar mês”: a Escala abre com o mês inteiro pronto para conferir.',
      missing: 'Cadastre um setor em “Novo setor” para começar.',
      click: true
    },
    ...GENERATOR_STEPS
  ],
  'escalar-pela-grade': [
    {
      target: { button: 'Grade' },
      title: 'Visão Grade',
      text: 'Use a Grade: cada linha é um turno do setor e cada coluna é um dia.',
      click: true
    },
    {
      target: { selector: 'button[title="Vaga em aberto: clique para escalar"]' },
      title: 'Vaga em aberto',
      text: 'Quadrado tracejado é vaga em aberto. Clique em uma para escolher quem vai cobrir.',
      missing: 'Não há vaga em aberto neste mês. Mude o mês ou use “Montar turnos do mês”.',
      click: true
    },
    {
      target: { selector: '[role=dialog]' },
      title: 'Escolha quem cobre',
      text: 'Só aparece quem pode assumir: mesma especialidade, liberado no setor e sem choque de horário. Clique no nome para escalar.'
    }
  ],
  'publicar-escala': [
    {
      target: { buttonStarts: 'Publicar' },
      title: 'Publicar',
      text: 'Enquanto você monta, a escala é rascunho e ninguém vê. Quando estiver pronta, clique em “Publicar”.',
      click: true
    },
    {
      target: { button: 'Mês Inteiro', inDialog: true },
      title: 'Período',
      text: 'Confira o setor e o período. Dá para publicar aos poucos: o mês inteiro, 15 ou 7 dias.'
    },
    {
      target: { selector: '[role=dialog] button.bg-emerald-600' },
      title: 'Confirmar',
      text: 'Ao confirmar, cada profissional escalado recebe o aviso no celular e passa a ver a escala.'
    }
  ],
  'cadastrar-profissional': [
    {
      target: { buttonStarts: 'Novo profissional' },
      title: 'Novo profissional',
      text: 'Clique em “Novo profissional”. Se preferir, mande o link de cadastro em “Convidar equipe”.',
      click: true
    },
    {
      target: { selector: '[role=dialog] input[type=date]' },
      title: 'Passo 1: Dados',
      text: 'Preencha categoria, nome, documentos e contato. A data de nascimento gera a senha do primeiro acesso.'
    },
    {
      target: { buttonStarts: 'Próximo: Acesso', inDialog: true },
      title: 'Seguir',
      text: 'Com os dados preenchidos, clique aqui.',
      click: true
    },
    {
      target: { buttonStarts: 'Próximo: Valores', inDialog: true },
      title: 'Passo 2: Acesso',
      text: 'O perfil já marca as telas certas. Escolha os hospitais e os setores onde a pessoa pode ser escalada e siga.',
      click: true
    },
    {
      target: { buttonStarts: 'Cadastrar profissional', inDialog: true },
      title: 'Passo 3: Valores',
      text: 'Informe quanto ela recebe em cada hospital e o PIX. Depois clique em “Cadastrar profissional”.'
    }
  ],
  'aprovar-troca': [
    {
      target: { buttonStarts: 'Aprovações' },
      title: 'Aprovações',
      text: 'Quando alguém pede para passar um plantão, o pedido cai aqui.',
      click: true
    },
    {
      target: { button: 'Autorizar' },
      title: 'Autorizar ou recusar',
      text: 'Confira quem pediu, o dia e o horário. “Autorizar” abre a vaga no Mural; “Recusar” mantém o plantão com a pessoa.',
      missing: 'Nenhum pedido esperando agora. Quando chegar, aparece aqui e você recebe o aviso.'
    }
  ],
  'pegar-vaga': [
    {
      target: { buttonStarts: 'Vagas' },
      title: 'Vagas',
      text: 'Aqui ficam as vagas que você pode assumir: só da sua especialidade e sem choque com a sua escala.',
      click: true
    },
    {
      target: { button: 'Assumir' },
      title: 'Assumir',
      text: 'Gostou de uma? Toque em “Assumir” e confirme. O plantão vai para a sua escala.',
      missing: 'Nenhuma vaga para você agora. Quando surgir, chega o aviso no celular.'
    }
  ],
  'passar-plantao': [
    {
      target: { buttonStarts: 'Meus plantões' },
      title: 'Meus plantões',
      text: 'Aqui estão todos os seus próximos plantões.',
      click: true
    },
    {
      target: { button: 'Passar p/ Mural' },
      title: 'Passar p/ Mural',
      text: 'Toque em “Passar p/ Mural”. A coordenação aprova e, enquanto isso, o plantão continua sendo seu.',
      missing: 'Você não tem plantões futuros para passar.'
    }
  ],
  'fechar-mes': [
    {
      target: { selector: '[aria-label="Mês anterior"]' },
      title: 'Escolha o mês',
      text: 'Volte até o mês que vai fechar. O valor de cada um sai do cadastro: por plantão, fixo ou produtividade.'
    },
    {
      target: { selector: 'tbody tr' },
      title: 'Quanto e onde pagar',
      text: 'Cada linha mostra o valor e onde pagar. “Falta PIX ou conta”: complete no Corpo Clínico.',
      missing: 'Ninguém para pagar neste mês.'
    },
    {
      target: { selector: 'input[aria-label="Selecionar todos a pagar"]' },
      title: 'Marque quem já recebeu',
      text: 'Pagou? Marque um por um ou todos de uma vez.',
      missing: 'Não há ninguém a pagar neste mês.',
      click: true
    },
    {
      target: { buttonStarts: 'Marcar como pago' },
      title: 'Marcar como pago',
      text: 'Depois clique em “Marcar como pago”.'
    },
    {
      target: [{ selector: 'tbody button', includes: 'Demonstrativo' }, { selector: 'tbody button', includes: 'Recibo' }],
      title: 'Demonstrativo e recibo',
      text: 'O demonstrativo (ou o recibo, depois de pago) de cada um sai pronto para imprimir.'
    },
    {
      target: { buttonStarts: 'Imprimir fechamento' },
      title: 'Fechamento',
      text: 'E aqui sai o resumo do mês para a direção.'
    }
  ],
  'minha-escala': [
    {
      target: { buttonStarts: 'Adicionar à agenda' },
      title: 'Agenda do celular',
      text: 'Leva todos os seus plantões para o calendário do celular, com lembrete 12 h e 1 h antes.'
    },
    {
      target: { selector: 'h2', includes: 'Resumo do mês' },
      title: 'Resumo do mês',
      text: 'Quanto você já fez e tem a receber no mês.'
    },
    {
      target: { selector: 'h2', includes: 'Minha disponibilidade' },
      title: 'Folgas e férias',
      text: 'Vai tirar folga ou férias? Informe aqui e a coordenação não te escala nesses dias.'
    },
    {
      target: [{ button: 'Passar no Mural' }, { selector: 'h2, h3, button', includes: 'Próximos plantões' }],
      title: 'Próximos plantões',
      text: 'Todos os seus próximos plantões. Precisa passar um? Use “Passar no Mural”.'
    }
  ]
};

// audience: 'gestor' (coordenação), 'plantonista' (quem não é gestor) ou 'todos'.
export const SCREEN_HELP = {
  '/escalas': [
    { id: 'escala-montar-mes', title: 'Montar o mês', video: 'montar-mes', tour: 'escala-montar-mes', audience: 'gestor' },
    { id: 'escalar-pela-grade', title: 'Escalar alguém pela Grade', video: 'escalar-pela-grade', tour: 'escalar-pela-grade', audience: 'gestor' },
    { id: 'publicar-escala', title: 'Publicar a escala', video: 'publicar-escala', tour: 'publicar-escala', audience: 'gestor' }
  ],
  '/setores': [
    { id: 'setores-montar-mes', title: 'Montar o mês com os turnos padrão', video: 'montar-mes', tour: 'setores-montar-mes', audience: 'todos' }
  ],
  '/corpo-clinico': [
    { id: 'cadastrar-profissional', title: 'Cadastrar um profissional', video: 'cadastrar-profissional', tour: 'cadastrar-profissional', audience: 'todos' }
  ],
  '/trocas': [
    { id: 'aprovar-troca', title: 'Aprovar um pedido', video: 'aprovar-troca', tour: 'aprovar-troca', audience: 'gestor' },
    { id: 'pegar-vaga', title: 'Pegar uma vaga', video: 'pegar-vaga', tour: 'pegar-vaga', audience: 'plantonista' },
    { id: 'passar-plantao', title: 'Passar um plantão', video: 'passar-plantao', tour: 'passar-plantao', audience: 'plantonista' }
  ],
  '/faturamento': [
    { id: 'fechar-mes', title: 'Fechar o mês', video: 'fechar-mes', tour: 'fechar-mes', audience: 'todos' }
  ],
  '/minha-escala': [
    { id: 'minha-escala', title: 'Conhecer a Minha Escala', video: 'minha-escala', tour: 'minha-escala', audience: 'todos' }
  ]
};

export function screenHelpFor(pathname, isManager) {
  const items = SCREEN_HELP[pathname] || [];
  return items
    .filter(item => item.audience === 'todos' || (isManager ? item.audience === 'gestor' : item.audience === 'plantonista'))
    .map(item => ({ ...item, path: pathname, videoInfo: item.video ? findTutorial(item.video) : null }));
}

// Na tela "Como usar": de qual tela e com qual guia dá para "fazer junto" cada vídeo.
export function tourForVideo(videoId, isManager) {
  for (const pathname of Object.keys(SCREEN_HELP)) {
    const item = screenHelpFor(pathname, isManager).find(entry => entry.video === videoId && entry.tour);
    if (item) return item;
  }
  return null;
}
