// TEMPORÁRIO — acompanhamento das melhorias combinadas com a gestão.
// Quando tudo estiver entregue, remover: este arquivo, src/pages/Planejamento.jsx,
// a rota /planejamento (App.jsx), a regra em accessControl.js e o item do menu (AppLayout.jsx).
//
// status: 'entregue' | 'em_andamento' | 'planejado' | 'ideia'

export const ROADMAP_UPDATED_AT = '2026-11-22';

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
    title: 'Aparência e primeiros passos',
    items: [
      { id: 20, title: 'Marca nova', detail: 'Ícone "grade de plantões" (os dias do meio formam a cruz da saúde) no celular, navegador, login e menu.', status: 'entregue', version: 'V0.3.10' },
      { id: 21, title: 'Acabamento visual das telas', detail: 'Um só padrão de letras, cores, cartões e botões em todas as telas, no tom calmo da marca; topo azul da marca em todas as telas (V0.4.2).', status: 'entregue', version: 'V0.4.2' },
      { id: 22, title: 'Primeiros passos para empresa nova', detail: 'Lista no Painel: dados do hospital, setores, equipe (ou link de credenciamento), primeira escala, publicar. Some quando tudo estiver feito.', status: 'entregue', version: 'V0.4.1' },
      { id: 23, title: 'Abrir mais rápido no celular', detail: 'Cada tela baixa só quando é aberta: a entrada caiu de 1,8 MB para cerca de 700 KB.', status: 'entregue', version: 'V0.4.1' }
    ]
  },
  {
    title: 'Infraestrutura',
    items: [
      { id: 13, title: 'Ambiente de homologação', detail: 'Banco e site de teste separados da produção.', status: 'planejado' },
      { id: 14, title: 'Segurança do login e do banco', detail: 'Bloqueio após 5 senhas erradas, senha forte, fim da senha-mestre (V0.2.9); login oficial do Supabase (V0.2.10); banco trancado por empresa (V0.3.1); permissões por perfil no próprio banco (V0.3.9).', status: 'entregue', version: 'V0.3.9' },
      { id: 18, title: 'Confirmação em dois passos', detail: 'Código de 6 dígitos de um app no celular (Google/Microsoft Authenticator), sem e-mail nem custo. Obrigatório para admin e gestores, opcional para profissionais; o dono zera pela Plataforma se a pessoa perder o celular.', status: 'planejado' },
      { id: 19, title: 'Domínio e e-mails', detail: 'Depois do 1º contrato: comprar scalemedic.com.br no Registro.br; caixa de e-mail para pessoas (Google Workspace, Microsoft 365 ou Zoho) e envio pelo sistema com Resend (recuperar senha, relatório mensal); site em app.scalemedic.com.br. Só colar os registros de DNS que o Claude passar.', status: 'planejado' },
      { id: 17, title: 'Várias empresas no mesmo sistema', detail: 'Tela Plataforma (só o dono): criar empresa, primeiro gestor, redefinir senha; link de credenciamento por empresa. Falta: plano pago do Supabase com backup diário antes do primeiro cliente.', status: 'entregue', version: 'V0.3.2' },
      { id: 15, title: 'Notificação push real', detail: 'Aviso no celular mesmo com o app fechado.', status: 'entregue', version: 'V0.2.8' }
    ]
  }
];
