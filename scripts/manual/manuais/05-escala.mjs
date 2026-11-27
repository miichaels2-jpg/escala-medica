// Manual 5: Escala (montar, escalar, publicar, copiar, plantão do dia, Modo TV, imprimir).
export default {
  id: '05-escala',
  numero: 5,
  titulo: 'Escala',
  resumo: 'Montar o mês, escalar os profissionais, publicar para a equipe e acompanhar o plantão do dia.',
  publico: 'Gestão (coordenação)',
  secoes: [
    {
      titulo: 'Para que serve',
      blocos: [
        { p: 'A Escala é onde a coordenação monta os plantões de cada setor: cria as vagas do mês, escolhe quem cobre cada uma e publica para a equipe. Os profissionais só veem a escala depois de **publicada**; enquanto isso, ela é **rascunho**.' },
        { tabela: { cab: ['Etapa', 'O que acontece', 'Seção'], linhas: [
          ['1. Montar o mês', 'O sistema cria todas as vagas do mês a partir dos turnos do setor.', '3'],
          ['2. Escalar', 'Cada vaga recebe um profissional, ou fica aberta para o Mural.', '3 e 4'],
          ['3. Publicar', 'A equipe passa a ver a escala e recebe o aviso no celular.', '5'],
          ['4. Ajustar', 'Trocas, liberações e plantões avulsos ao longo do mês.', '4 e 6']
        ] } },
        { dica: 'Antes de montar a primeira escala, cadastre os setores com os turnos padrão (Manual 3) e a equipe (Manual 4).' }
      ]
    },
    {
      titulo: 'A tela da Escala',
      blocos: [
        { figura: 'escala-grade', legenda: 'Escala de dezembro do setor Enfermaria, na visão Grade.', pontos: [
          '**Mês:** as setas trocam o mês; clicar no nome do mês volta para o mês atual.',
          '`Publicar`: publica a escala do setor para a equipe (seção 5). Ao lado, `Copiar mês anterior` (seção 6).',
          '**Setores:** escolha um setor ou `Todos`. A bolinha laranja indica setor com a escala do mês em rascunho.',
          '**Visões:** `Calendário` (um quadro por dia; é a que abre primeiro, porque é nela que se arrasta a equipe), `Grade` (o mês inteiro, linha por turno) e `Lista`. A última escolhida fica lembrada. À esquerda, o filtro de turno: `Todos`, `Dia` ou `Noite`.',
          '`Mais`: plantão avulso, montar turnos do mês, plantão do dia, Modo TV e imprimir.',
          '**Vaga em aberto:** quadrado tracejado com **+**. Clique para escalar alguém.'
        ] },
        { p: 'Abaixo dos filtros ficam os números do mês: **Cobertura** (percentual de plantões com profissional), **Vagas em aberto**, **Furos** (plantões que passaram sem ninguém) e **Plantões · horas**. O subtítulo, no alto, diz se o setor está **publicado** ou em **rascunho**.' },
        { h: 'Como ler a Grade' },
        { lista: [
          'Cada **linha** é um turno do setor (ex.: Diurno 07:00–19:00, Clínica Médica) e cada **coluna** é um dia. Fins de semana e o dia de hoje aparecem destacados.',
          'Plantão preenchido mostra a **sigla** do profissional (ex.: PT); a legenda embaixo diz de quem é cada sigla.',
          'Tracejado amarelo é **vaga em aberto**; tracejado vermelho é **furo** (já passou sem ninguém).',
          '`Adicionar turnos ao setor` abre o gerador para criar mais vagas no setor.'
        ] },
        { figura: 'escala-calendario', legenda: 'Visão Calendário: barra verde = dia completo, laranja = com vaga, vermelha = furo. À esquerda, a lista de profissionais para arrastar até um dia, o horário ao soltar e Marcar vários dias.', pontos: [] }
      ]
    },
    {
      titulo: 'Montar o mês inteiro',
      blocos: [
        { p: 'Há dois caminhos para abrir o gerador: `Montar mês` no cartão do setor (tela Setores) ou, na Escala, `Mais` › `Montar turnos do mês`.' },
        { dica: 'Mês ainda sem plantões? O calendário mostra o aviso **Este mês ainda não tem plantões**, com os botões `Montar turnos do mês` e `Copiar mês anterior`: é só escolher um.' },
        { figura: 'escala-mais', largura: '80%', legenda: 'Menu Mais da Escala.', pontos: [
          '`Plantão avulso`: cria um plantão só (seção 6).',
          '`Montar turnos do mês`: abre o gerador do mês.',
          '`Plantão do dia`: lista de quem está em cada setor hoje (seção 7).',
          '`Modo TV`: tela cheia para a sala da coordenação (seção 7).',
          '`Imprimir o mês`: a escala do mês em PDF, um quadro por setor.'
        ] },
        { passos: [
          { texto: 'No gerador (**Montar escala**, etapa 1 · Grade), confira o **Setor Alvo**, a **Data de Início** e a **Duração** em dias. Com turnos padrão, tudo já vem preenchido para o mês inteiro.', figura: 'escala-gerador', legenda: 'Gerador do mês com os turnos padrão da UTI.', pontos: [
            '**Setor Alvo:** trocar o setor carrega os turnos padrão dele.',
            '**Data de Início da Grade** e **Duração:** o período a montar. `Repetir de N em N dias` serve para escalas alternadas (ex.: 2 = dia sim, dia não).',
            '`Novo Turno` acrescenta um horário. Cada turno tem especialidade, entrada, saída e número de vagas.',
            '`Próximo: escolher profissionais` vai para a etapa 2.'
          ] },
          'Ajuste horários e vagas só para este mês, se precisar. Para que a mudança valha nos próximos meses, marque **Atualizar os turnos padrão do setor**.',
          'O quadro azul confirma quantos dias e quantas vagas serão criados. **Nada é gravado ainda.** Clique em `Próximo: escolher profissionais`.',
          { texto: 'Na etapa 2 · Profissionais, o **Quadro** mostra o mês em calendário, com as vagas de cada dia, e a equipe à esquerda. `Preencher automaticamente` distribui a equipe disponível, respeitando especialidade, setores autorizados, folgas e choque de horário; depois é só ajustar.', figura: 'escala-alocar', legenda: 'Etapa 2: o Quadro do mês, com a equipe à esquerda.', pontos: [
            '**Arrastar:** pegue o nome na lista e solte sobre a **vaga** (o horário exato). Soltar sobre uma vaga preenchida troca a pessoa de lugar; arrastar de volta para a lista tira da vaga.',
            '**Pincel (celular e computador):** toque no nome e depois nas vagas, uma atrás da outra. Tocar de novo numa vaga dele tira; a `Borracha` limpa vagas.',
            '**Horário ao soltar no dia:** com mais de um horário no dia (manhã, tarde, noite), escolha o horário nos botões acima do quadro. Aí dá para soltar no dia inteiro ou tocar em **Seg, Ter…** no topo, que coloca a pessoa em todos aqueles dias da semana. Sem horário escolhido, o sistema não encaixa sozinho: pede para soltar sobre a vaga.',
            'A frase no alto diz o que aconteceu ou por que a pessoa não entrou (outra especialidade, setor não liberado, folga, choque de horário). `Desfazer` volta o último passo. `Lista` mostra o modo antigo, uma vaga por linha.',
            '`Salvar como rascunho`: grava a escala sem avisar ninguém. Dá para revisar e publicar depois.',
            '`Salvar e publicar`: grava e já publica. Cada profissional escalado recebe o aviso no celular.'
          ] }
        ] },
        { atencao: 'No Quadro e na Lista só entram profissionais que podem assumir: mesma especialidade, autorizados no setor, sem folga ou férias informadas e sem outro plantão no mesmo horário. O sistema também alerta quando alguém passa do limite de carga configurado em Configurações › Regras da escala.' }
      ]
    },
    {
      titulo: 'Escalar e trocar vaga por vaga',
      blocos: [
        { passos: [
          'Na visão `Grade`, clique na vaga em aberto (o **+** tracejado).',
          { texto: 'Aparece **Quem pode assumir**, com as horas que cada um já tem no mês. Clique no nome para escalar. `Mostrar outras especialidades` lista também quem é de outra especialidade.', figura: 'escala-escalar', largura: '55%', legenda: 'Vaga do dia 05/12: dois profissionais podem assumir.' },
          'Pronto: a sigla da pessoa aparece na vaga. Com a escala publicada, ela recebe o aviso.'
        ] },
        { h: 'Plantão já preenchido' },
        { figura: 'escala-preenchido', largura: '55%', legenda: 'Clique num plantão com profissional.', pontos: [
          '`Liberar vaga` tira a pessoa do plantão e ele volta a ser vaga (aparece no Mural). Em **Trocar por**, clique em outro nome para substituir direto.',
          'Tirou por engano? Por **10 segundos** aparece, no canto da tela, o aviso com `Desfazer`: a pessoa volta para o plantão. O mesmo vale para **excluir um plantão**.'
        ] },
        { p: '`Editar` abre o plantão completo: data, setor, especialidade, horários e quem está escalado.' },
        { h: 'Arrastar no calendário' },
        { passos: [
          'Na visão `Calendário`, a lista da esquerda traz a equipe. Arraste o nome até o dia.',
          'Clique no dia para ver os plantões dele à direita. A **lixeira** ao lado de `Alocar` exclui aquela vaga; a lixeira no alto do painel tira o dia inteiro da escala. Nos dois casos aparece `Desfazer` por 10 segundos.',
          'Se o dia tem vagas em mais de um horário, aparece **Em qual horário?**: escolha manhã, tarde ou noite. O sistema nunca escolhe sozinho. Para não perguntar toda vez, fixe o turno em **Horário ao soltar no dia**.',
          'Para vários dias de uma vez: clique em `Marcar vários dias`, clique nos dias do calendário e arraste o profissional para qualquer um deles. Ele entra em todos os dias marcados, no horário escolhido. Os dias em que não dá (sem vaga nesse horário, choque de horário, folga) aparecem na confirmação e ficam de fora.'
        ] },
        { dica: 'Vaga aberta em escala publicada aparece no Mural para a especialidade certa. Quem pegar a vaga entra na escala sozinho, e a coordenação é avisada.' }
      ]
    },
    {
      titulo: 'Publicar a escala',
      blocos: [
        { passos: [
          'Com o setor escolhido, clique em `Publicar` (no alto da tela).',
          { texto: 'Confira o **Setor a ser publicado** e o período (**Data Inicial** e **Data Final**). Os atalhos `7 Dias`, `15 Dias` e `Mês Inteiro` preenchem as datas.', figura: 'escala-publicar', largura: '62%', legenda: 'Janela de publicação.', pontos: [
            '`Mês Inteiro`: publica o mês todo. Dá para publicar aos poucos, só a primeira quinzena, por exemplo.',
            'O quadro de resumo mostra quantos plantões entram, quantos ainda estão **sem profissional** e o **custo estimado** do período, comparado com o período anterior. Confira antes de publicar.',
            '`Oficializar Escala` publica.'
          ] },
          'Clique em `Oficializar Escala`. Cada profissional escalado recebe o aviso no celular, e os plantões aparecem para ele na Minha Escala.'
        ] },
        { lista: [
          '**Mudou algo depois de publicar?** Quem foi afetado é avisado na hora (entrou, saiu ou mudou de horário).',
          '**Despublicar:** `Mais` › `Voltar para rascunho` tira a publicação do setor no mês. Use só em caso de erro: a equipe deixa de ver os plantões.',
          '**Vagas extras:** publicam junto e continuam na escala, mesmo vazias, para você encaixar alguém durante o mês (clique na vaga extra e escolha o profissional). Vazias, não vão para o Mural e não contam nos números. Para criar uma vaga extra fora dos turnos padrão, use `Mais` › `Plantão avulso` e marque **Vaga extra**.',
          '**Começar o mês de novo:** `Mais` › `Excluir escala do mês (rascunho)` apaga todos os plantões do mês que ainda não foram publicados (do setor escolhido ou, em `Todos`, de todos os setores). Eles somem de todas as telas, e dá para montar outra escala do zero. Períodos já publicados ficam. Aparece `Desfazer` por 10 segundos.'
        ] },
        { atencao: 'Enquanto a escala está em rascunho, os profissionais não veem os plantões e as vagas não vão para o Mural.' }
      ]
    },
    {
      titulo: 'Copiar o mês anterior e plantão avulso',
      blocos: [
        { h: 'Copiar mês anterior' },
        { figura: 'escala-copiar', largura: '62%', legenda: 'Montar o mês seguinte a partir de um mês modelo.', pontos: [] },
        { passos: [
          'Clique em `Copiar mês anterior`.',
          'Escolha o setor (ou todos), o **Mês modelo** e o **Mês a montar**.',
          'Em **Como repetir os dias**, escolha `Mesmo dia da semana` (a 2ª segunda continua na 2ª segunda) ou `Mesmo dia do mês` (dia 15 continua dia 15).',
          'Clique em `Revisar escala`. Quem ainda pode assumir continua no mesmo plantão; quem está de férias, em choque de horário ou inativo vira vaga. Revise e salve como rascunho ou publique.'
        ] },
        { h: 'Plantão avulso' },
        { figura: 'escala-avulso', largura: '62%', legenda: 'Lançar um plantão fora dos turnos padrão.', pontos: [] },
        { passos: [
          '`Mais` › `Plantão avulso`.',
          'Informe data, setor, especialidade exigida e horários.',
          'Em **Modo de Alocação**, escolha `Alocar Pessoal` e o profissional, ou `Vaga no Mural` para deixar a vaga aberta.',
          'Clique em `Confirmar`.'
        ] }
      ]
    },
    {
      titulo: 'Plantão do dia, Modo TV e impressão',
      blocos: [
        { figura: 'escala-dia', legenda: '`Mais` › `Plantão do dia`: quem está em cada setor hoje.', pontos: [
          '`Imprimir (A4 deitado)`: a folha do plantão do dia por setor, com vagas e linhas para assinatura.'
        ] },
        { p: '`Voltar para a escala do mês` retorna à Grade.' },
        { figura: 'escala-tv', legenda: '`Mais` › `Modo TV`: tela cheia com quem está no posto agora e os plantões programados para hoje.', pontos: [] },
        { lista: [
          'O **Modo TV** atualiza sozinho e mostra o relógio. Bom para deixar numa TV da sala da coordenação. Para sair, `Fechar Modo TV`.',
          '`Mais` › `Imprimir o mês` gera a escala do mês em PDF, um quadro por setor (dias × turnos), com a marca “rascunho” quando ainda não foi publicada.'
        ] }
      ]
    }
  ]
};
