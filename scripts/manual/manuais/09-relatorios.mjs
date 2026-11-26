// Manual 9: Relatórios.
export default {
  id: '09-relatorios',
  numero: 9,
  titulo: 'Relatórios',
  resumo: 'Os números do hospital por período: cobertura, furos, custos, produtividade e confiabilidade da equipe, com Excel e PDF.',
  publico: 'Gestão e faturamento',
  secoes: [
    {
      titulo: 'Para que serve',
      blocos: [
        { p: 'Os Relatórios juntam os dados da escala, da equipe e dos custos para um período escolhido. Servem para acompanhar a operação, prestar contas à direção e decidir: onde faltam profissionais, quanto custa cada setor, quem mais cobre vagas.' },
        { p: 'Todo relatório pode ser exportado para **Excel** ou impresso/salvo em **PDF**, com o cabeçalho do hospital.' }
      ]
    },
    {
      titulo: 'A tela de Relatórios',
      blocos: [
        { figura: 'relatorios', legenda: 'Relatórios abertos na Visão geral.', pontos: [
          '**Grupos:** `Visão geral` (apresentação com gráficos), `Escalas` (plantões, trocas, setores), `Equipe` (cadastro, produtividade, confiabilidade, aniversariantes) e `Financeiro` (custos e produtividade). Cada grupo abre a sua lista de relatórios logo abaixo.',
          '**Período:** este mês, mês passado, últimos 3 meses, este ano ou `Escolher datas`. Ao lado, o filtro de **Setor** e a **Busca** por profissional ou setor.',
          '`Exportar para Excel`: a planilha do relatório aberto.',
          '`Imprimir / salvar PDF`: o relatório pronto para imprimir. Na Visão geral, gera o relatório completo do período.'
        ] },
        { p: 'Embaixo dos filtros aparece o resumo do que está sendo analisado (datas, setor e quantidade). Se o mês ainda tem poucos plantões, o sistema sugere `Ver o mês passado`.' }
      ]
    },
    {
      titulo: 'Os relatórios, um a um',
      blocos: [
        { tabela: { cab: ['Grupo', 'Relatório', 'O que mostra'], linhas: [
          ['Visão geral', 'Visão geral', 'Indicadores do período (plantões, cobertura, vagas e furos, custo, horas, credenciais vencidas) e gráficos de cobertura diária, custo acumulado, custo por setor, profissionais com mais horas, dias da semana e diurno × noturno.'],
          ['Escalas', 'Plantões', 'Escalas e ocupação: todos os plantões do período, com vagas e furos.'],
          ['Escalas', 'Trocas e repasses', 'Histórico de alterações: quem passou plantão para quem.'],
          ['Escalas', 'Setores', 'Estrutura e custos de cada setor.'],
          ['Equipe', 'Cadastro', 'Cadastro e situação da equipe (com filtro de situação).'],
          ['Equipe', 'Produtividade', 'Atuação de cada profissional: plantões e horas.'],
          ['Equipe', 'Confiabilidade', 'Quem cumpre os plantões, cobre vagas e repassa (só a gestão vê).'],
          ['Equipe', 'Aniversariantes', 'Datas de aniversário da equipe no período.'],
          ['Financeiro', 'Custos', 'Custos e orçamento: custo previsto por setor e horas.'],
          ['Financeiro', 'Apuração diária', 'Produtividade: atendimentos e rateio de cada dia.'],
          ['Financeiro', 'Extrato individual', 'Produtividade de um profissional: atendimentos e saldo.']
        ] } },
        { dica: 'Na Visão geral, `Apresentação do mês` abre a apresentação para a diretoria (seção a seguir).' }
      ]
    },
    {
      titulo: 'Apresentação do mês para a diretoria',
      blocos: [
        { figura: 'relatorios-apresentacao', legenda: 'Primeiro slide da apresentação do mês.', pontos: [] },
        { p: 'São 6 slides em tela cheia, sempre comparando com o mês anterior: **capa** com os números principais, **cobertura** dia a dia, **vagas e furos** por setor, **custo** por setor, **equipe** (horas, diurno × noturno e quem mais esteve de plantão) e **resumo** com frases prontas e a situação do próximo mês.' },
        { lista: [
          'Passe os slides com as **setas do teclado**, a barra de espaço ou um passador de slides.',
          'Escolha o mês no alto. Quando o mês atual ainda está no começo, ela abre no mês que acabou de fechar.',
          '`PDF` gera um slide por página, para mandar por e-mail ou imprimir.',
          '`Esc` ou o **X** fecha a apresentação.'
        ] },
        { atencao: 'O custo é estimado pela tabela de valores de cada profissional. Plantões pagos por produtividade entram só no fechamento, e a apresentação avisa quantos ficaram de fora.' }
      ]
    },
    {
      titulo: 'Confiabilidade da equipe',
      blocos: [
        { figura: 'relatorios-confiabilidade', legenda: 'Equipe › Confiabilidade.', pontos: [] },
        { lista: [
          '**Índice:** plantões que a pessoa manteve ÷ plantões que eram dela (mantidos + repassados ao Mural). 100% = nunca passou um plantão.',
          '**Vagas cobertas:** vagas abertas ou repasses de colegas que ela assumiu.',
          '**Repasses** e **Trocas diretas:** quantas vezes passou plantão ou trocou com colega.',
          'Também mostra plantões realizados, horas, noites e fins de semana. Os cartões do alto destacam quem mais cumpriu plantões, quem mais cobriu vagas e quem mais repassou.'
        ] },
        { atencao: 'Faltas não entram no índice. Use a Confiabilidade como conversa com a equipe, não como punição automática.' }
      ]
    },
    {
      titulo: 'Gerar um relatório, passo a passo',
      blocos: [
        { passos: [
          'Escolha o grupo (`Escalas`, `Equipe`, `Financeiro`) e o relatório.',
          'Escolha o **Período** e, se quiser, um **Setor**. Para um intervalo específico, `Escolher datas`.',
          'Use a **Busca** para achar um profissional ou setor.',
          'Clique em `Exportar para Excel` ou `Imprimir / salvar PDF`. No PDF, escolha “Salvar como PDF” na janela de impressão para guardar o arquivo.'
        ] },
        { dica: 'A planilha já vem pronta para trabalhar: valores em R$, horas e datas como números (dá para somar e filtrar), filtro e cabeçalho fixo em cada tabela, e na `Visão geral` uma aba para cada relatório. Para imprimir direto do Excel, ela já cabe na largura da folha, com número de página no rodapé.' },
        { figura: 'relatorios-plantoes', legenda: 'Escalas › Plantões: o relatório de ocupação do período.', pontos: [] }
      ]
    }
  ]
};
