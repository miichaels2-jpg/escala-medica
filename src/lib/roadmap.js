// TEMPORÁRIO — acompanhamento das melhorias combinadas com a gestão.
// Quando tudo estiver entregue, remover: este arquivo, src/pages/Planejamento.jsx,
// a rota /planejamento (App.jsx), a regra em accessControl.js e o item do menu (AppLayout.jsx).
//
// status: 'entregue' | 'em_andamento' | 'planejado' | 'ideia'

export const ROADMAP_UPDATED_AT = '2026-10-21';

export const ROADMAP_GROUPS = [
  {
    title: 'Para o gestor',
    items: [
      { id: 1, title: 'Visão "Todas as unidades" no Painel e no Mural', detail: 'Vagas, furos e plantões de todos os hospitais numa tela; clicar numa unidade entra nela.', status: 'entregue', version: 'V0.1.10' },
      { id: 2, title: 'Alerta de furo iminente', detail: 'Vaga sem ninguém a menos de 24 h: destaque "Urgente" e aviso para os profissionais compatíveis e livres. Desde a V0.2.9 o servidor confere a cada 5 min, mesmo sem ninguém logado.', status: 'entregue', version: 'V0.1.10' },
      { id: 3, title: 'Escala do mês seguinte com 1 clique', detail: 'Sugere a mesma distribuição do mês anterior, descontando férias e choques, para revisar e publicar.', status: 'entregue', version: 'V0.2.2' },
      { id: 4, title: 'Indisponibilidade e férias', detail: 'O profissional marca os dias em que não pode; a alocação e o gerador deixam de sugeri-lo.', status: 'entregue', version: 'V0.1.10' }
    ]
  },
  {
    title: 'Para o profissional',
    items: [
      { id: 5, title: 'Adicionar plantões à agenda do celular', detail: 'Google Agenda / Calendário do iPhone, com endereço.', status: 'entregue', version: 'V0.2.1' },
      { id: 6, title: 'Lembrete antes do plantão', detail: 'Alarmes 12 h e 1 h antes na agenda do celular (tocam com o app fechado) e aviso no sino.', status: 'entregue', version: 'V0.2.1' },
      { id: 7, title: 'Troca direta entre colegas', detail: '"Troco meu sábado pelo seu domingo"; os dois aceitam e o gestor aprova.', status: 'entregue', version: 'V0.2.3' },
      { id: 8, title: 'Meus ganhos do mês', detail: 'Quanto já fez, quanto falta receber e quando cai, com espelho em PDF.', status: 'entregue', version: 'V0.2.3' }
    ]
  },
  {
    title: 'Inteligência e controle',
    items: [
      { id: 9, title: 'Ranking de confiabilidade (só gestor)', detail: 'Quem mais cobre vagas, falta ou troca.', status: 'entregue', version: 'V0.2.7' },
      { id: 10, title: 'Limite de carga horária', detail: 'Aviso ao passar de X horas na semana ou emendar plantões sem descanso.', status: 'entregue', version: 'V0.2.2' },
      { id: 11, title: 'Histórico de alterações', detail: 'Quem alocou, trocou, apagou ou publicou, e quando.', status: 'entregue', version: 'V0.2.1' },
      { id: 12, title: 'Relatório mensal automático por e-mail', detail: 'BI do mês anterior para a diretoria todo dia 1º.', status: 'ideia' },
      { id: 16, title: 'Liberação de telas por profissional', detail: 'Acesso tela a tela no Corpo Clínico, com opção de editar sem ser gestor (ex.: administrativo com acesso a tudo).', status: 'entregue', version: 'V0.2.2' }
    ]
  },
  {
    title: 'Infraestrutura',
    items: [
      { id: 13, title: 'Ambiente de homologação', detail: 'Banco e site de teste separados da produção.', status: 'planejado' },
      { id: 14, title: 'Segurança do login', detail: 'Feito: bloqueio após 5 senhas erradas, senha forte, senha-mestre e login de emergência removidos, senhas provisórias aleatórias. Falta: recuperar senha por e-mail (aguarda domínio) e confirmação em dois passos.', status: 'em_andamento', version: 'V0.2.9' },
      { id: 15, title: 'Notificação push real', detail: 'Aviso no celular mesmo com o app fechado.', status: 'entregue', version: 'V0.2.8' }
    ]
  }
];
