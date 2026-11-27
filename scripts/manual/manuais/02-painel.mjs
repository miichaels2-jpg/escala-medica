// Manual 2: Painel (tela inicial da gestão) e avisos.
export default {
  id: '02-painel',
  numero: 2,
  titulo: 'Painel',
  resumo: 'A tela inicial da gestão: o que precisa de atenção hoje, quem está de plantão e como estão os hospitais.',
  publico: 'Gestão (coordenação)',
  secoes: [
    {
      titulo: 'Para que serve',
      blocos: [
        { p: 'O Painel é a primeira tela de quem coordena. Em um só lugar ele mostra o que precisa ser resolvido (vagas, furos, escala em rascunho), quem está de plantão agora e os números do dia. A ideia é abrir o Painel no começo do turno e resolver o que aparece em **Precisa de você**.' },
        { p: 'Quem é plantonista entra direto na **Minha Escala** e não vê o Painel.' }
      ]
    },
    {
      titulo: 'As partes da tela',
      blocos: [
        { figura: 'painel', legenda: 'Painel de um hospital com dois hospitais (unidades) na mesma empresa.', pontos: [
          '**Primeiros passos:** roteiro de implantação em 5 passos (dados do hospital, setores, equipe, primeira escala e publicação). Cada passo tem `Começar` e, quando há vídeo, `Ver como fazer`. Some sozinho quando tudo está feito, ou pelo **X**.',
          '**Mostrar no painel:** escolha entre ver **todas as unidades** juntas ou um hospital. Cada cartão resume: plantões de hoje preenchidos, vagas nos próximos 7 dias, vagas urgentes e furos do mês.',
          '**Precisa de você:** a lista do que resolver agora, com o botão que leva direto ao lugar certo.',
          '**Modo TV:** mostra o Painel em tela cheia, para deixar numa TV da sala da coordenação.',
          '**Sino (Notificações):** avisos de vagas, pedidos e mudanças. Veja a seção 4.'
        ] },
        { p: 'Abaixo de **Precisa de você** ficam quatro números do dia:' },
        { tabela: { cab: ['Cartão', 'O que mostra'], linhas: [
          ['Em andamento agora', 'Quantos profissionais estão de plantão neste momento.'],
          ['Plantões hoje', 'Total de plantões do dia, quantos ainda vão começar e quantos já terminaram.'],
          ['Cobertura do mês', 'Percentual de plantões do mês que já têm profissional, e quantas vagas faltam preencher.'],
          ['Custo de hoje', 'Quanto os plantões do dia custam, pelo valor cadastrado de cada profissional.']
        ] } },
        { p: '**Hoje por setor** lista cada setor com quem está de plantão, quem entra mais tarde e as vagas do dia.' }
      ]
    },
    {
      titulo: 'Como estamos indo (o mês)',
      blocos: [
        { figura: 'painel-tendencias', legenda: 'O mês atual comparado com o mês anterior inteiro.', pontos: [] },
        { tabela: { cab: ['Número', 'O que mostra'], linhas: [
          ['Cobertura do mês', 'Quanto da escala do mês já tem profissional, e quantos pontos subiu ou caiu em relação ao mês anterior.'],
          ['Vagas sem profissional', 'Plantões do mês ainda sem ninguém, comparado com o mês anterior.'],
          ['Custo previsto do mês', 'Estimativa pela tabela de valores de cada profissional (produtividade só entra no fechamento).'],
          ['Horas de plantão', 'Total de horas dos plantões preenchidos no mês.']
        ] } },
        { p: 'Ao lado, o **calendário do mês** mostra de relance como está cada dia: vermelho é **furo** (passou sem ninguém), amarelo é **vaga aberta** e cinza é **preenchido**. O número no dia é a quantidade de vagas. Clique num dia com vaga para abrir a vaga na escala.' },
        { dica: 'Seta verde é melhora e vermelha é piora. Custo e horas aparecem em cinza: gastar menos pode ser só escala incompleta, então olhe junto com a cobertura.' }
      ]
    },
    {
      titulo: 'Equipe: agradecer e dar parabéns',
      blocos: [
        { p: 'Quando há algo para mostrar, aparece o quadro **Equipe** no fim do Painel:' },
        { lista: [
          '**Cobriram vaga de última hora:** quem pegou pelo Mural, nos últimos 14 dias, uma vaga que começava em menos de 24 horas. `Agradecer` manda um "obrigado" que chega no sino e no celular do profissional.',
          '**Aniversários da semana:** quem faz aniversário nos próximos 7 dias. No dia, `Dar parabéns` manda a mensagem.'
        ] },
        { dica: 'Um obrigado na hora certa faz diferença: é quem salvou o plantão que está sendo reconhecido.' }
      ]
    },
    {
      titulo: 'Comunicados para a equipe',
      blocos: [
        { p: 'O quadro **Comunicados**, no alto do Painel (e também na tela **Avisos** do menu), serve para avisos oficiais: mudança de rotina, protocolo novo, reunião da equipe. Cada profissional vê o comunicado numa janela ao abrir o app e encontra todos guardados em **Avisos**.' },
        { passos: [
          'Clique em `Novo comunicado`.',
          'Em **Para quem**, escolha `Toda a equipe da unidade` ou a equipe de um setor (com várias unidades, escolha antes a **Unidade**). O sistema mostra quantos profissionais vão receber.',
          'Escreva o **Título** e a **Mensagem** e clique em `Publicar`. Cada um recebe o aviso no sino e no celular.'
        ] },
        { p: 'Na lista aparece **lido por X de Y**. Clique no comunicado para ver a mensagem, quem **leu** e quem **falta**. A lixeira apaga o comunicado para todos.' },
        { dica: 'A equipe de um setor é quem está liberado nele (Corpo Clínico, passo 2). Quem não está liberado no setor não recebe o comunicado dele.' }
      ]
    },
    {
      titulo: 'Precisa de você: o que pode aparecer',
      blocos: [
        { tabela: { cab: ['Aviso', 'O que significa', 'Onde resolver'], linhas: [
          ['Vagas nos próximos 7 dias', 'Plantões sem profissional na próxima semana.', '`Abrir na escala`: escale alguém ou deixe a vaga no Mural.'],
          ['Furos', 'Plantões que já passaram sem ninguém.', 'Na Escala: corrija ou registre quem cobriu.'],
          ['Escala em rascunho', 'Setores com a escala do mês ainda não publicada: os profissionais não veem nem recebem aviso.', '`Abrir escala` e publique (Manual 5).'],
          ['Custo incompleto', 'Plantões de hoje de profissionais sem valor cadastrado ou esperando o lançamento da produção.', '`Abrir faturamento` ou complete o valor no Corpo Clínico.']
        ] } },
        { p: 'Quando não há nada pendente, aparece **Tudo em dia**: sem vagas nos próximos 7 dias, sem furos e com a escala do mês publicada.' },
        { dica: 'Os setores e os números do Painel seguem o hospital escolhido no topo da tela (campo **Unidade**). Para ver todos os hospitais juntos, escolha `Todas as unidades` em **Mostrar no painel**.' }
      ]
    },
    {
      titulo: 'Notificações (o sino)',
      blocos: [
        { figura: 'avisos', legenda: 'Painel de notificações aberto pelo sino, no topo da tela.', pontos: [] },
        { passos: [
          'Toque no **sino**, no topo da tela. Um número vermelho no sino indica avisos novos.',
          'Leia os avisos: vagas novas, pedidos de troca para aprovar, escala publicada, mudanças nos seus plantões.',
          'Para receber os avisos **no celular, mesmo com o app fechado**, toque em `Ativar` e permita as notificações quando o navegador perguntar.',
          '`Abrir o Mural` leva às vagas e aos pedidos.'
        ] },
        { atencao: 'A permissão de avisos é por aparelho. Quem usa o ScaleMedic no celular e no computador precisa ativar nos dois.' }
      ]
    },
    {
      titulo: 'Trocar de hospital',
      blocos: [
        { p: 'Quem coordena mais de um hospital escolhe com qual trabalhar no campo **Unidade**, no topo da tela. Escala, Corpo Clínico, Setores, Faturamento, Indicadores e Relatórios passam a mostrar os dados do hospital escolhido. O Painel também pode mostrar todos juntos.' },
        { dica: 'O plantonista não precisa trocar de hospital: ele vê os plantões de todos os hospitais onde trabalha na mesma Minha Escala.' }
      ]
    }
  ]
};
