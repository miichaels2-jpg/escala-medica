// Manual 6: Mural (vagas, pedidos de liberação, trocas entre colegas, histórico).
export default {
  id: '06-mural',
  numero: 6,
  titulo: 'Mural: vagas e trocas',
  resumo: 'Pegar vagas abertas, passar um plantão, trocar com um colega e, para a coordenação, aprovar os pedidos.',
  publico: 'Plantonistas e gestão (coordenação)',
  secoes: [
    {
      titulo: 'Para que serve',
      blocos: [
        { p: 'O Mural é o lugar das **vagas abertas** e das **trocas**. Quando um plantão fica sem ninguém, ele aparece no Mural para os profissionais da mesma especialidade, que podem assumir com um toque. Quem não pode ir a um plantão pede para passar ou troca com um colega, sempre com a aprovação da coordenação.' },
        { tabela: { cab: ['Aba', 'Quem usa', 'Para quê'], linhas: [
          ['`Vagas`', 'Todos', 'Ver e assumir vagas abertas.'],
          ['`Aprovações`', 'Coordenação', 'Autorizar ou recusar pedidos de liberação e trocas entre colegas.'],
          ['`Meus plantões`', 'Plantonista', 'Passar um plantão para o Mural ou propor troca a um colega; responder propostas recebidas.'],
          ['`Histórico`', 'Todos', 'Os repasses já efetivados: de quem para quem e quem autorizou.']
        ] } }
      ]
    },
    {
      titulo: 'A tela do Mural',
      blocos: [
        { figura: 'mural-vagas', legenda: 'Mural visto pela coordenação.', pontos: [
          '`Vagas`: as vagas abertas, agrupadas por dia. O número é quantas existem.',
          '`Aprovações`: pedidos esperando a coordenação. Só aparece para a gestão.',
          '`Meus plantões`: os seus próximos plantões e as propostas de troca recebidas.',
          '`Histórico`: repasses já efetivados.',
          '`Que eu posso assumir`: filtra só as vagas que você pode pegar. `Todas` mostra todas.',
          '**Especialidade:** filtra as vagas por especialidade.'
        ] },
        { p: 'A coordenação vê a lixeira em cada vaga, para excluir uma vaga criada por engano. Excluiu a errada? Por 10 segundos aparece `Desfazer` no canto da tela.' }
      ]
    },
    {
      titulo: 'Plantonista: pegar uma vaga',
      blocos: [
        { figura: 'cel-mural', legenda: 'Mural no celular do plantonista.', pontos: [
          '`Vagas`: as vagas que você pode assumir, sem choque com a sua escala, em todos os seus hospitais.',
          '`Meus plantões`: os seus plantões, para passar ou trocar.'
        ] },
        { passos: [
          'Abra o **Mural** (menu de baixo, no celular).',
          'Escolha a vaga e toque em `Assumir`. Se a vaga começava em menos de 24 horas, você recebe um **obrigado** e a coordenação fica sabendo que foi você quem cobriu.',
          'Confira setor, data e horário na confirmação e confirme.',
          'Pronto: o plantão já é seu. Aparece em **Meus plantões** e na **Minha Escala**, e a coordenação é avisada.'
        ] },
        { lista: [
          'Você só vê vagas da **sua especialidade**, dos **setores em que está autorizado** e **sem choque** com outro plantão seu.',
          'Com os avisos ligados (sino › `Ativar`), chega uma notificação no celular quando abre vaga para você.'
        ] }
      ]
    },
    {
      titulo: 'Plantonista: passar ou trocar um plantão',
      blocos: [
        { figura: 'cel-meus-plantoes', legenda: 'Aba Meus plantões.', pontos: [
          '`Passar p/ Mural`: pede para liberar o plantão para qualquer colega.'
        ] },
        { h: 'Passar para o Mural' },
        { passos: [
          'Em `Meus plantões`, no plantão que não vai poder cobrir, toque em `Passar p/ Mural` e confirme.',
          'O pedido vai para a coordenação. **Enquanto não for aprovado, o plantão continua sendo seu.**',
          'Aprovado, o plantão vira vaga no Mural para os colegas da mesma especialidade, e você recebe o aviso.'
        ] },
        { h: 'Propor troca com um colega' },
        { passos: [
          'No seu plantão, toque em `Propor troca`.',
          'Aparecem os plantões de colegas que dá para trocar pelo seu: mesma especialidade e setor compatível, sem folga marcada e sem choque de horário. Escolha um e envie.',
          'O colega recebe a proposta em `Meus plantões` (**Proposta para você**) e toca em `Aceitar` ou `Recusar`.',
          'Aceita pelo colega, a troca vai para a coordenação aprovar. Aprovada, os dois plantões trocam de dono e cada um recebe o aviso.'
        ] },
        { atencao: 'Até a coordenação aprovar, nada muda: cada um continua com o seu plantão. Não falte contando com uma troca ainda não aprovada.' }
      ]
    },
    {
      titulo: 'Coordenação: aprovar pedidos',
      blocos: [
        { figura: 'mural-aprovacoes', legenda: 'Aba Aprovações: Mesa de Controle do Gestor.', pontos: [] },
        { passos: [
          'Abra `Aprovações`. O número na aba mostra quantos pedidos estão esperando.',
          'Em cada **pedido de liberação**, confira quem pediu, o dia e o horário. `Autorizar` abre a vaga no Mural; `Recusar` mantém o plantão com a pessoa.',
          'Em **Trocas entre colegas**, confira os dois plantões. `Aprovar troca` efetiva a troca; `Recusar` desfaz. Se a troca deixou de passar nas regras (choque de horário, férias, setor ou especialidade), o sistema avisa antes de aprovar.',
          'Quem pediu recebe o aviso da decisão no celular.'
        ] },
        { dica: 'Quando chega um pedido novo, a coordenação também recebe o aviso no sino e no celular.' }
      ]
    },
    {
      titulo: 'Histórico de repasses',
      blocos: [
        { figura: 'mural-historico', legenda: 'Aba Histórico: trilha de auditoria dos repasses.', pontos: [] },
        { p: 'Cada linha mostra a data do plantão, setor e horário, de quem para quem o plantão passou, quem autorizou e a situação. É a prova de quem estava responsável por cada plantão.' }
      ]
    }
  ]
};
