// TEMPORÁRIO — acompanhamento das melhorias combinadas com a gestão.
// Quando tudo estiver entregue, remover: este arquivo, src/pages/Planejamento.jsx,
// a rota /planejamento (App.jsx), a regra em accessControl.js e o item do menu (AppLayout.jsx).
//
// status: 'entregue' | 'em_andamento' | 'planejado' | 'ideia'

export const ROADMAP_UPDATED_AT = '2026-11-25';

export const ROADMAP_GROUPS = [
  // Ideias combinadas em 25/11/2026 para deixar o app mais acolhedor e mais fácil de vender.
  {
    title: 'Próximos · V0.7 · mostrar resultado e acolher quem usa',
    items: [
      { id: 47, title: 'Apresentação do mês para a diretoria', detail: 'Em Relatórios › Visão geral: 6 slides em tela cheia (capa, cobertura, vagas e furos, custo por setor, equipe, resumo e próximo mês), sempre comparando com o mês anterior; setas do teclado ou passador de slides e PDF com um slide por página.', status: 'entregue', version: 'V0.7.2' },
      { id: 48, title: 'Painel "Como estamos indo"', detail: 'Cobertura, vagas, custo e horas do mês com a variação sobre o mês anterior, e um calendário que mostra de relance os dias com vaga aberta ou furo (clicar abre a vaga na escala).', status: 'entregue', version: 'V0.7.2' },
      { id: 49, title: 'Custo antes de publicar', detail: 'Na janela de publicar: quantos plantões, quantos sem profissional e o custo estimado do período, comparado com o período anterior.', status: 'entregue', version: 'V0.7.2' },
      { id: 50, title: 'Boas-vindas do plantonista', detail: 'No topo da Minha Escala, uma frase no lugar de números soltos: "Bom dia, Ana! Seu próximo plantão é amanhã, às 7h, no setor UTI. Em novembro: 8 de 12 plantões feitos e R$ 9.600 a receber até agora." No dia do aniversário, "Feliz aniversário".', status: 'entregue', version: 'V0.7.3' },
      { id: 51, title: 'Reconhecimento', detail: 'Quem pega pelo Mural uma vaga que começava em menos de 24 h recebe um "obrigado" na hora; no Painel, o quadro "Equipe" mostra quem cobriu de última hora (botão Agradecer, que chega no sino e no celular) e os aniversários da semana (botão Dar parabéns).', status: 'entregue', version: 'V0.7.3' },
      { id: 52, title: 'Desfazer', detail: 'Ao tirar alguém da escala, liberar a vaga em choque ou excluir um plantão (Escala e Mural): 10 segundos de "Desfazer" no lugar da pergunta de confirmação.', status: 'entregue', version: 'V0.7.3' },
      { id: 53, title: 'Informe de rendimentos do ano', detail: 'PDF com tudo o que o profissional recebeu de cada unidade no ano, para o imposto de renda.', status: 'planejado' },
      { id: 54, title: 'Envio da nota fiscal (PJ)', detail: 'O profissional anexa a nota no app antes do pagamento; o gestor vê quem já mandou e o "Marcar como pago" libera depois.', status: 'planejado' },
      { id: 60, title: 'Ponto do plantão', detail: 'Entrada e saída pelo celular (localização ou QR code no setor): prova de presença e fechamento pelo que foi feito de verdade.', status: 'planejado' }
    ]
  },
  {
    title: 'Ideias · para depois',
    items: [
      { id: 55, title: 'Preferências do plantonista', detail: '"Prefiro noturno", "não faço domingo", "quero mais na UTI": o gerador respeita e quem tem interesse recebe primeiro o aviso da vaga.', status: 'ideia' },
      { id: 56, title: 'Documento vencendo, aviso para o profissional', detail: 'CRM, cursos e vacinas com arquivo anexado e lembrete para o próprio profissional 30 dias antes.', status: 'ideia' },
      { id: 57, title: 'Bônus para vaga difícil', detail: '"+R$ 300 se cobrir até amanhã", que entra sozinho no fechamento.', status: 'ideia' },
      { id: 58, title: 'Sobreaviso', detail: 'Lista de quem fica de reserva em cada dia; se abrir um furo, eles são chamados primeiro.', status: 'ideia' },
      { id: 59, title: 'Comunicados por setor com "li"', detail: 'Aviso oficial para a equipe de um setor, e o gestor vê quem já leu.', status: 'ideia' },
      { id: 61, title: 'Bilhete de passagem de plantão', detail: 'Campo curto que quem entra lê ao abrir o plantão ("leito 4 aguardando tomografia").', status: 'ideia' },
      { id: 62, title: 'Busca rápida (Ctrl+K)', detail: 'Achar profissional, setor ou plantão de qualquer tela.', status: 'ideia' },
      { id: 63, title: 'Telas vazias que orientam', detail: 'Trocar "nenhum registro" por uma frase e o botão do próximo passo.', status: 'ideia' },
      { id: 64, title: 'Demonstração que se monta sozinha', detail: 'Link que cria um hospital fictício para o cliente testar e apaga tudo em 7 dias.', status: 'ideia' },
      { id: 65, title: 'Cobrança dentro da Plataforma', detail: 'Plano por número de profissionais, PIX ou boleto recorrente e aviso de atraso.', status: 'ideia' },
      { id: 66, title: 'Saúde dos clientes', detail: 'Na Plataforma: acessos de cada empresa e quando publicou a última escala, para ligar antes de o cliente desistir.', status: 'ideia' },
      { id: 67, title: 'Avisos pelo WhatsApp', detail: 'Canal que todo médico usa, mas a versão oficial cobra por mensagem e exige aprovação da Meta: depois dos primeiros clientes pagantes.', status: 'ideia' }
    ]
  },
  // Varredura completa do app em 23/11/2026 (todas as telas, computador e celular, dados reais da demo).
  {
    title: 'Próximos · prioridade 1 · segurança e confiança',
    items: [
      { id: 26, title: 'Histórico com autor garantido pelo banco', detail: 'Hoje o "quem fez" vem do navegador e poderia ser forjado por alguém logado; passa a vir do login oficial, direto no banco. Registros antigos ficam como estão.', status: 'entregue', version: 'V0.4.9' },
      { id: 27, title: 'Backup diário antes do 1º cliente', detail: 'Assinar o plano pago do Supabase (backup diário e recuperação por data) e fazer um teste de restauração. A assinatura é com o Michael; o teste e o passo a passo, com o Claude.', status: 'planejado' },
      { id: 28, title: 'Testes automáticos antes de publicar', detail: 'Os 74 testes que já existem ganham um comando próprio e rodam sozinhos a cada envio ao GitHub, junto com a montagem do app; se algo quebrar, a versão não sobe.', status: 'entregue', version: 'V0.4.9' },
      { id: 29, title: 'Aviso de erro em produção', detail: 'Quando aparecer a tela "Instabilidade no módulo" para alguém, o erro fica registrado num painel com tela, horário e empresa — para corrigir antes de o cliente ligar.', status: 'entregue', version: 'V0.4.9' },
      { id: 30, title: 'LGPD na prática', detail: 'O profissional baixa os próprios dados e pode pedir exclusão; o aceite dos termos fica guardado com data e versão.', status: 'entregue', version: 'V0.4.10' }
    ]
  },
  {
    title: 'Próximos · prioridade 2 · dia a dia mais simples',
    items: [
      { id: 31, title: 'Painel enxuto', detail: 'Hoje são 11 blocos e vários ficam vazios quando não há plantão (anel "Sem escala", gráfico de horas zerado). Vira: topo, "o que precisa de você hoje" (vagas urgentes, setores em rascunho, pagamentos pendentes), números do dia e cobertura por setor. No celular, sem "Modo TV"; o "Plantão do dia" fica só num lugar.', status: 'entregue', version: 'V0.5.1' },
      { id: 32, title: 'Turnos padrão por setor', detail: 'Em Setores, cadastrar os turnos fixos de cada setor (ex.: UTI — 2 de dia 07–19 e 1 de noite 19–07) e montar o mês inteiro com um clique na Escala. Cada cartão de setor passa a mostrar turnos, equipe autorizada e vagas do mês.', status: 'entregue', version: 'V0.5.3' },
      { id: 33, title: 'Acessos num lugar só', detail: 'Hoje dá para liberar acesso no Corpo Clínico (telas liberadas) e também em Configurações › Equipe & Acessos. Juntar tudo no Corpo Clínico; Configurações fica com hospital, contrato e regras.', status: 'entregue', version: 'V0.5.2' },
      { id: 34, title: 'Mesmos nomes em todo o app', detail: 'Menu diz "Mural de Oportunidades" e a tela "Mural de vagas"; "Setores & Especialidades", "Faturamento & Repasse", "Painel Geral" e o botão "Abrir Escalas" com nomes diferentes das telas. Padronizar: Painel, Escala, Mural, Setores, Faturamento.', status: 'entregue', version: 'V0.5.2' },
      { id: 35, title: 'Faturamento mais claro', detail: 'Números sem cores de enfeite (só status), "Pendente de cadastro" explicando o que falta (PIX ou conta), "Marcar como pago" para vários de uma vez e matrícula sem destaque colorido.', status: 'entregue', version: 'V0.5.5' },
      { id: 36, title: 'Cadastro de profissional em passos', detail: 'A janela de novo profissional é longa (categoria, perfil, telas, valores numa tela só). Dividir em 3 passos — dados, perfil e acessos, valores — como no credenciamento.', status: 'entregue', version: 'V0.5.6' },
      { id: 37, title: 'Revisar a visão do plantonista', detail: 'A varredura foi feita como gestor. Revisar Minha Escala, Mural e trocas logado como profissional, no celular, que é onde ele usa.', status: 'entregue', version: 'V0.5.4' },
      { id: 41, title: 'Tela "Como usar" com vídeos', detail: 'Vídeos sem som, com cursor e legendas, gravados por script com os dados da demo (scripts/tutoriais). 9 vídeos: montar o mês, escalar pela Grade, publicar, cadastrar profissional, aprovar pedido no Mural, fechar o mês; e, para o plantonista, Minha Escala, pegar vaga e passar plantão. Narração fica para depois.', status: 'entregue', version: 'V0.5.10' },
      { id: 42, title: 'Impressos no mesmo padrão', detail: 'Recibo, demonstrativo, escala do mês (quadro por setor), plantão do dia, fechamento, espelho e relatórios com o mesmo cabeçalho, rodapé com página e emissão e marca d’água só quando ela diz algo (rascunho, não comprova pagamento, logo no recibo pago).', status: 'entregue', version: 'V0.5.7' },
      { id: 43, title: 'Ajuda dentro de cada tela', detail: 'Botão "Como fazer" no topo das telas: guia passo a passo que destaca onde clicar e vídeo numa janelinha flutuante que continua de onde parou. Abre sozinho na primeira visita.', status: 'entregue', version: 'V0.6.1' },
      { id: 44, title: 'Manuais de treinamento em PDF', detail: 'Tela Material de treinamento (só o dono): 11 manuais com marca ScaleMedic, fotos numeradas e passo a passo, e o manual completo. Gerados por script (scripts/manual) com dados fictícios.', status: 'entregue', version: 'V0.6.5' },
      { id: 45, title: 'Planilhas Excel no padrão dos impressos', detail: 'Fechamento e Relatórios em .xlsx de verdade: logos e cabeçalho do hospital, R$, horas e datas como números, filtro e cabeçalho fixo, uma aba por relatório e página pronta para imprimir com número de página.', status: 'entregue', version: 'V0.6.6' },
      { id: 46, title: 'Varredura de defeitos e limpeza do código', detail: 'Impressos à prova de código no nome, validade da credencial sem data inventada, dados pessoais fora do navegador, 46 pacotes e 39 arquivos sem uso removidos (−6.200 linhas), funções repetidas num lugar só e verificador cobrindo as regras de negócio.', status: 'entregue', version: 'V0.6.10' }
    ]
  },
  {
    title: 'Próximos · prioridade 3 · acabamento e crescimento',
    items: [
      { id: 38, title: 'Escala e Relatórios mais leves por dentro', detail: 'Escala (3.300 linhas) e Relatórios (2.700) divididos em partes menores: fica mais fácil e seguro mexer, e Relatórios baixa menos que os 510 KB de hoje.', status: 'entregue', version: 'V0.6.2' },
      { id: 39, title: 'Limpar avisos antigos do código', detail: '59 avisos do verificador (blocos vazios, variáveis sem uso) que vêm de versões antigas.', status: 'entregue', version: 'V0.6.3' },
      { id: 40, title: 'Tema segue o aparelho', detail: 'Quem nunca escolheu abre no claro ou no escuro conforme o celular/computador (antes, sempre escuro). A escolha pelo botão sol/lua continua valendo; sem piscada ao abrir.', status: 'entregue', version: 'V0.6.4' }
    ]
  },
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
      { id: 12, title: 'Relatório mensal automático por e-mail', detail: 'A apresentação do mês (V0.7.2) em PDF para a diretoria todo dia 1º. Depende do domínio e do envio de e-mails (item 19).', status: 'ideia' },
      { id: 16, title: 'Liberação de telas por profissional', detail: 'Acesso tela a tela no Corpo Clínico, com opção de editar sem ser gestor (ex.: administrativo com acesso a tudo).', status: 'entregue', version: 'V0.2.2' }
    ]
  },
  {
    title: 'Aparência e primeiros passos',
    items: [
      { id: 20, title: 'Marca nova', detail: 'Ícone "grade de plantões" (os dias do meio formam a cruz da saúde) no celular, navegador, login e menu.', status: 'entregue', version: 'V0.3.10' },
      { id: 21, title: 'Acabamento visual das telas', detail: 'Um só padrão de letras, cores, cartões e botões em todas as telas, no tom calmo da marca; topo azul da marca em todas as telas (V0.4.2).', status: 'entregue', version: 'V0.4.2' },
      { id: 22, title: 'Primeiros passos para empresa nova', detail: 'Lista no Painel: dados do hospital, setores, equipe (ou link de credenciamento), primeira escala, publicar. Some quando tudo estiver feito.', status: 'entregue', version: 'V0.4.1' },
      { id: 23, title: 'Abrir mais rápido no celular', detail: 'Cada tela baixa só quando é aberta: a entrada caiu de 1,8 MB para cerca de 700 KB.', status: 'entregue', version: 'V0.4.1' },
      { id: 24, title: 'Relatórios reorganizados', detail: '4 abas (Visão geral, Escalas, Equipe, Financeiro) e filtros que valem na hora.', status: 'entregue', version: 'V0.4.4' },
      { id: 25, title: 'Escala com grade e um clique', detail: 'Grade por setor (vaga × dia); o "+" mostra quem pode assumir e escala com um clique.', status: 'entregue', version: 'V0.4.5' }
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
