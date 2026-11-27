// Manual 11: a ajuda dentro do sistema (Como fazer, guia na tela, vídeos).
export default {
  id: '11-ajuda',
  numero: 11,
  titulo: 'Ajuda dentro do sistema',
  resumo: 'O botão “Como fazer” de cada tela, o guia que mostra onde clicar e os vídeos da tela Como usar.',
  publico: 'Todos',
  secoes: [
    {
      titulo: 'Três jeitos de aprender usando',
      blocos: [
        { p: 'Além destes manuais, o próprio ScaleMedic ensina enquanto a pessoa usa. Ninguém precisa decorar nada: em cada tela com tarefa importante há ajuda a um clique.' },
        { tabela: { cab: ['Ajuda', 'Onde fica', 'Como funciona'], linhas: [
          ['Como fazer', 'Ao lado do título da tela', 'Lista as tarefas daquela tela, com o guia e o vídeo de cada uma.'],
          ['Mostrar na tela', 'Dentro do Como fazer', 'Destaca o botão certo e explica passo a passo, na tela de verdade.'],
          ['Vídeos', 'Como fazer e tela Como usar', 'Vídeos curtos, sem som, com legendas, que ficam numa janelinha no canto.']
        ] } }
      ]
    },
    {
      titulo: 'O botão Como fazer',
      blocos: [
        { figura: 'como-fazer', legenda: 'Como fazer aberto na tela Escala.', pontos: [
          '`Como fazer`: aparece nas telas Escala, Setores, Corpo Clínico, Mural, Faturamento e Minha Escala.'
        ] },
        { lista: [
          'Cada pessoa vê só as tarefas do seu perfil: a coordenação vê, por exemplo, “Aprovar um pedido”; o plantonista vê “Pegar uma vaga” e “Passar um plantão”.',
          'Na **primeira visita** a cada tela, a lista abre sozinha uma vez. Fechou, não abre mais sozinha; o botão continua lá.',
          'O que você já viu ganha um **✓**.'
        ] }
      ]
    },
    {
      titulo: 'Mostrar na tela: o guia passo a passo',
      blocos: [
        { figura: 'guia-na-tela', legenda: 'Guia “Publicar a escala”, passo 1 de 3: o botão certo fica destacado.', pontos: [] },
        { passos: [
          'Em `Como fazer`, toque em `Mostrar na tela` na tarefa desejada.',
          'A tela escurece e o botão do passo fica com contorno azul. O cartão explica o que fazer.',
          'Clique no destaque: o guia passa sozinho para o próximo passo, inclusive dentro de janelas e de uma tela para outra.',
          '`Próximo` e `Voltar` navegam entre os passos; `Pular` segue sem clicar; o **X** fecha o guia. No último passo, `Concluir`.'
        ] },
        { dica: 'O guia nunca clica nem salva nada sozinho: quem faz é você. Se faltar algo na tela (por exemplo, nenhuma vaga no mês), o cartão explica o que fazer.' }
      ]
    },
    {
      titulo: 'Vídeos e a tela Como usar',
      blocos: [
        { lista: [
          'Em `Como fazer`, o botão `Vídeo` abre o vídeo numa **janelinha no canto**, por cima do sistema: dá para assistir e fazer ao mesmo tempo. A janelinha pode ser recolhida, fechada ou, com `Na tela`, virar o guia passo a passo.',
          'O vídeo **continua de onde você parou** se fechar e abrir de novo.',
          'A tela **Como usar** (no menu) reúne todos os vídeos por assunto. Em cada um, `Fazer junto na tela` abre a tela certa já com o guia.'
        ] },
        { figura: 'como-usar', legenda: 'Tela Como usar.', pontos: [] }
      ]
    },
    {
      titulo: 'Busca rápida',
      blocos: [
        { p: 'Aperte **Ctrl+K** (no Mac, Cmd+K) ou toque na **lupa** do topo, em qualquer tela, e digite:' },
        { lista: [
          '**Nome de um profissional:** abre o cadastro no Corpo Clínico; logo abaixo, `Abrir o próximo plantão` vai direto ao plantão dele na Escala.',
          '**Nome de um setor:** abre a Escala já nesse setor.',
          '**Uma data** (12/12, hoje, amanhã): lista os plantões do dia; escolher um abre o plantão. O plantonista vê só os dele.',
          '**Nome de uma tela:** abre a tela.'
        ] },
        { p: 'Use as setas para escolher e Enter para abrir.' }
      ]
    }
  ]
};
