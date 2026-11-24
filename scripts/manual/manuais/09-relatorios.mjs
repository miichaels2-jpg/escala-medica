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
        { dica: 'Na Visão geral, `Modo apresentação` abre os gráficos em tela cheia, para reuniões com a direção.' }
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
        { atencao: 'Faltas e ponto não entram no índice (o ponto é opcional). Use a Confiabilidade como conversa com a equipe, não como punição automática.' }
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
        { figura: 'relatorios-plantoes', legenda: 'Escalas › Plantões: o relatório de ocupação do período.', pontos: [] }
      ]
    }
  ]
};
