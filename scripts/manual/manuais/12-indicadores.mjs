// Manual 12: Indicadores (distribuição da equipe, trocas, segurança e pendências).
export default {
  id: '12-indicadores',
  numero: 12,
  titulo: 'Indicadores',
  resumo: 'Como a escala está distribuída no período: equipe, trocas e repasses, segurança do plantão, rankings e pendências.',
  publico: 'Gestão (coordenação)',
  secoes: [
    {
      titulo: 'Para que serve',
      blocos: [
        { p: 'O Painel mostra o que resolver **hoje**. Os Indicadores mostram como foi (ou como está ficando) o **período**: se as vagas estão bem divididas entre a equipe, quanto a escala mexe com trocas e repasses, se alguém passou dos limites de horas e o que ainda espera resposta.' },
        { p: 'Tudo é comparado com o período anterior, e cada bloco traz uma frase com o que fazer.' },
        { atencao: 'Os profissionais são PJ e cooperados: os Indicadores servem para **dividir as vagas de forma justa** e cuidar da segurança do plantão, não para controlar jornada.' }
      ]
    },
    {
      titulo: 'Filtros e blocos de cima',
      blocos: [
        { figura: 'indicadores', legenda: 'Indicadores de outubro do Hospital Santa Clara.', pontos: [
          '**Período:** este mês, mês passado ou datas escolhidas. A comparação é sempre com o período anterior do mesmo tamanho.',
          '**Setor:** todos ou um setor.',
          '**Especialidade:** todas ou uma.',
          '`Ver lista`: abre a lista completa do bloco, com `Exportar Excel` e `Imprimir`.'
        ] },
        { tabela: { cab: ['Bloco', 'O que mostra'], linhas: [
          ['Retrato da escala', 'Profissionais ativos, plantões do período, quantos já foram publicados (o resto está em rascunho), vagas abertas e a divisão por turno (manhã, tarde e noite). Clique nos números para ver a lista.'],
          ['Trocas e repasses', 'Trocas diretas, repasses pelo Mural e vagas assumidas: quantas foram feitas, quantas estão em aberto e em que dia da semana acontecem mais (fim de semana em destaque).'],
          ['Segurança do plantão', 'Quem emendou plantões acima do limite e quem passou do máximo de horas na semana, pelas regras de **Configurações › Regras da escala**.']
        ] } }
      ]
    },
    {
      titulo: 'Distribuição da equipe',
      blocos: [
        { figura: 'indicadores-distribuicao', legenda: 'Quem tem mais e menos horas no período.', pontos: [] },
        { p: 'As barras mostram as horas escaladas de cada profissional no período. A **linha vertical** é a mediana do grupo: metade da equipe está acima dela e metade abaixo.' },
        { lista: [
          '**Mais horas:** quem está carregando a escala. Bem acima da linha por vários meses? Vale dividir melhor.',
          '**Menos horas:** quem tem menos plantões, inclusive quem não tem nenhum no período. Há vaga aberta? Ofereça primeiro a essas pessoas.',
          '`Ver todos` lista a equipe inteira, com "bem acima", "na média" ou "bem abaixo" do grupo.'
        ] }
      ]
    },
    {
      titulo: 'Movimentações, rankings e pendências',
      blocos: [
        { lista: [
          '**Movimentações por dia:** quantas trocas, repasses e vagas assumidas houve em cada dia do período.',
          '**Quem mais movimentou:** quem mais assumiu vagas e repasses, quem mais repassou plantões e quem mais fez trocas diretas.',
          '**Pendências:** pedidos esperando resposta (da coordenação, do colega ou de alguém assumir no Mural). `Resolver no Mural` leva direto para lá.'
        ] },
        { dica: 'Quem aparece sempre em "assumiram vagas" é quem salva a escala: lembre de agradecer no quadro **Equipe** do Painel.' }
      ]
    },
    {
      titulo: 'Listas, Excel e impressão',
      blocos: [
        { figura: 'indicadores-lista', legenda: 'Lista da Segurança do plantão.', pontos: [
          '`Exportar Excel`: a lista em planilha, com o período e os filtros no cabeçalho.',
          '`Imprimir`: a lista pronta para imprimir ou salvar em PDF, com o logo do hospital.'
        ] },
        { p: 'Toda lista respeita o período, o setor e a especialidade escolhidos no alto da tela.' }
      ]
    }
  ]
};
