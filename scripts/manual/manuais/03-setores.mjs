// Manual 3: Setores e turnos padrão.
export default {
  id: '03-setores',
  numero: 3,
  titulo: 'Setores e turnos padrão',
  resumo: 'Cadastrar os setores do hospital e os turnos fixos de cada um, para montar o mês inteiro em um clique.',
  publico: 'Gestão (coordenação)',
  secoes: [
    {
      titulo: 'Para que serve',
      blocos: [
        { p: 'Setor é cada área que tem escala própria: UTI, Emergência, Enfermaria, Centro Cirúrgico. Cada setor guarda os seus **turnos padrão**, os horários fixos de todo dia, com especialidade e número de vagas. Por exemplo, a UTI com 2 médicos intensivistas de dia (07h às 19h) e 1 à noite (19h às 07h).' },
        { p: 'Com os turnos padrão cadastrados, a coordenação monta o mês inteiro do setor em um clique, em vez de lançar plantão por plantão.' },
        { dica: 'Cadastre os setores antes da equipe: no cadastro do profissional, você escolhe em quais setores ele pode ser escalado.' }
      ]
    },
    {
      titulo: 'A tela de Setores',
      blocos: [
        { figura: 'setores', legenda: 'Um cartão para cada setor do hospital escolhido no topo da tela.', pontos: [
          '`Novo setor`: cadastra um setor novo.',
          '**Turnos padrão:** o resumo dos horários fixos (ex.: 2 × 07–19 · 1 × 19–07) e quantas vagas por dia. Sem turnos, aparece `Sem turnos padrão · cadastrar`.',
          '`Montar mês`: abre a Escala com o gerador do mês já preenchido com os turnos do setor.',
          '`Editar`: muda o nome, a situação (ativo ou inativo) e os turnos padrão.'
        ] },
        { p: 'Cada cartão mostra ainda quantos profissionais estão **autorizados** a trabalhar no setor e quantos plantões ele tem no mês, com as vagas em aberto. A lixeira, à direita, exclui o setor. A busca no topo filtra os setores pelo nome.' },
        { p: 'Para a gestão, o cartão mostra também os **valores do plantão** do setor (ex.: Dia R$ 800 · Noite R$ 1.000). Sem tabela, aparece `Sem tabela de valores · cadastrar`.' }
      ]
    },
    {
      titulo: 'Cadastrar um setor com turnos padrão',
      blocos: [
        { passos: [
          'Clique em `Novo setor`.',
          'Em **Nome do setor**, escreva o nome como a equipe conhece (ex.: UTI Adulto). Deixe a **Situação** como `Ativo`.',
          { texto: 'Em **Turnos padrão**, clique em `Adicionar turno` e preencha: **Especialidade** de quem cobre o turno, horário de **Entrada** e **Saída** e o número de **Vagas** por dia. Repita para cada turno do dia (dia e noite, por exemplo).', figura: 'setor-editar', legenda: 'Setor UTI Adulto com dois turnos padrão: 2 vagas de dia e 1 de noite.' },
          'Turno que vira o dia (ex.: 19:00 às 07:00) é normal: o sistema entende que termina na manhã seguinte.',
          '**Vagas extras** (opcional): logo abaixo de cada turno, informe quantas vagas a mais você quer e toque nos **dias da semana** em que elas entram (ex.: 1 extra só na segunda e na terça). Servem para encaixar alguém além da equipe fixa. Na Escala elas aparecem como **Vaga extra** e continuam lá depois de publicar, para você encaixar alguém quando precisar. Vazias, não vão para o Mural e não contam como vaga em aberto, furo ou aviso de vaga urgente.',
          'Clique em `Salvar setor`. O cartão passa a mostrar o resumo dos turnos.'
        ] },
        { h: 'Valores do plantão' },
        { p: 'No mesmo cadastro, em **Valores do plantão**, informe quanto se paga por plantão neste setor, numa tabela com duas linhas (**Plantão inteiro** e **Meio expediente**) e quatro colunas. A tabela vale para toda a equipe do setor, e o Faturamento usa esses valores para calcular quanto cada um recebe.' },
        { tabela: { cab: ['Campo', 'Quando vale'], linhas: [
          ['Dia de semana · diurno', 'Segunda a sexta, plantão que começa antes das 18h.'],
          ['Dia de semana · noturno', 'Segunda a sexta, plantão que começa a partir das 18h (ou antes das 6h).'],
          ['Fim de semana · diurno e noturno', 'Sábado e domingo, com a mesma regra de horário.'],
          ['Meio expediente (até 6 h)', 'Plantão de até 6 horas (ex.: 15:00 às 21:00). Tem as mesmas quatro colunas do plantão inteiro: semana diurno e noturno, fim de semana diurno e noturno. Em branco, o plantão curto segue a tabela do plantão inteiro.']
        ] } },
        { dica: 'Quem tem um valor diferente do resto da equipe recebe pelo **valor próprio** do cadastro dele (Corpo Clínico, passo 3). O valor próprio vence só nos campos preenchidos; o que estiver em branco vem da tabela do setor.' },
        { atencao: 'Todo turno precisa de especialidade. Se esquecer, o sistema avisa “Escolha a especialidade de cada turno (ou remova o turno)”. A especialidade define quem pode assumir a vaga: o Mural só mostra a vaga para profissionais da mesma especialidade.' }
      ]
    },
    {
      titulo: 'Montar o mês do setor',
      blocos: [
        { passos: [
          'No cartão do setor, clique em `Montar mês`.',
          'A Escala abre com a janela **Montar escala** já preenchida: o setor, o mês inteiro e os turnos padrão.',
          'Confira e, se precisar, ajuste horários, vagas ou o período só para este mês. Clique em `Próximo: escolher profissionais`.',
          'Escolha quem fica em cada vaga, ou deixe vagas em aberto para o Mural, e salve como rascunho ou publique. O passo a passo completo está no **Manual 5 — Escala**.'
        ] },
        { dica: 'Mudou os horários só neste mês? Deixe desmarcada a opção “Atualizar os turnos padrão do setor” no gerador. Marque só quando a mudança for para valer nos próximos meses.' }
      ]
    },
    {
      titulo: 'Editar, desativar ou excluir',
      blocos: [
        { lista: [
          '**Editar:** clique em `Editar` no cartão, mude o que precisar e `Salvar setor`. Mudar os turnos padrão não altera plantões já criados; vale para os próximos meses montados.',
          '**Desativar:** em `Editar`, mude a **Situação** para `Inativo`. O setor deixa de aparecer para montar escalas, mas o histórico continua guardado. É o recomendado para setores que fecharam.',
          '**Excluir:** a lixeira do cartão apaga o setor de vez, junto com a escala dele que ainda não foi publicada (a confirmação diz quantos plantões saem). Se o setor já tem escala publicada ou plantões feitos, o sistema não deixa excluir, para guardar o histórico: desative o setor.'
        ] },
        { h: 'Quem pode trabalhar no setor' },
        { p: 'O número de **profissionais autorizados** vem do cadastro de cada profissional (Corpo Clínico, passo **Acesso**), onde a coordenação marca os hospitais e setores em que ele pode ser escalado. Quem não está autorizado não aparece para ser escalado no setor nem vê as vagas dele no Mural.' }
      ]
    }
  ]
};
