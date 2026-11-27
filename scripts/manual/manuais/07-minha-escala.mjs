// Manual 7: Minha Escala (a tela do plantonista, no celular).
export default {
  id: '07-minha-escala',
  numero: 7,
  titulo: 'Minha Escala (plantonista)',
  resumo: 'O dia a dia do plantonista no celular: próximo plantão, agenda, ganhos do mês, nota fiscal, informe de rendimentos e folgas.',
  publico: 'Plantonistas',
  secoes: [
    {
      titulo: 'Para que serve',
      blocos: [
        { p: 'A Minha Escala é a tela de quem dá plantão. Ela abre sozinha depois da entrada e reúne tudo o que importa: o próximo plantão com o endereço, quantos plantões você já cumpriu e quanto tem a receber no mês, as suas folgas e a lista de todos os próximos plantões, em todos os hospitais onde você trabalha.' },
        { p: 'Ela mostra só a escala **publicada** pela coordenação. Plantões em rascunho ainda não aparecem.' }
      ]
    },
    {
      titulo: 'O topo da tela',
      blocos: [
        { figura: 'cel-minha-escala', legenda: 'Minha Escala no celular.', pontos: [
          '`Adicionar à agenda`: coloca todos os seus plantões no calendário do celular, com lembrete 12 horas e 1 hora antes.',
          '`Ver o Mural`: vagas abertas que você pode assumir (Manual 6).',
          '**Sino:** avisos de escala publicada, vagas e trocas. Toque em `Ativar` para receber no celular mesmo com o app fechado.'
        ] },
        { p: 'No alto, uma frase resume o seu momento: "Bom dia, Ana! Seu próximo plantão é amanhã, às 7h, no setor UTI. Em novembro: 8 de 12 plantões feitos e R$ 9.600 a receber até agora." Durante o plantão, ela diz até que horas você fica; no dia do seu aniversário, deseja feliz aniversário.' },
        { lista: [
          '**Próximo plantão:** hospital, setor, data, horário e quanto falta para começar. `Como chegar` abre o mapa com o endereço do hospital.',
          '**Menu de baixo:** `Minha Escala`, `Escala` (a escala publicada do hospital), `Mural` e `Menu` (as outras telas, o tema claro/escuro e `Sair do sistema`).'
        ] }
      ]
    },
    {
      titulo: 'Resumo do mês e ganhos',
      blocos: [
        { figura: 'cel-resumo', legenda: 'Resumo do mês: as setas trocam o mês.', pontos: [] },
        { tabela: { cab: ['Cartão', 'O que mostra'], linhas: [
          ['Plantões cumpridos', 'Quantos plantões você já fez no mês e o total de horas.'],
          ['A fazer no mês', 'Quantos plantões ainda faltam no mês, quantos você tem no total e a data do próximo.'],
          ['Meus ganhos', 'Quanto já foi realizado, quanto ainda vai realizar e o previsto no mês, pelo valor do seu cadastro. Por hospital, mostra se já está **Pago**.']
        ] } },
        { p: '`Ver espelho do mês (PDF)` gera o seu demonstrativo do mês: cada plantão, horas e valores, pronto para salvar ou imprimir.' },
        { p: '**Informe de rendimentos (IR):** escolha o ano (o anterior ou o atual). O PDF traz tudo o que você recebeu de cada hospital no ano, mês a mês, com o CNPJ de cada um: bruto, retenção, líquido e se já foi pago. Serve para conferir a declaração do Imposto de Renda; o comprovante oficial continua sendo o de cada fonte pagadora.' },
        { dica: 'O valor previsto depende do valor cadastrado pela coordenação. Se algo parecer errado, fale com o faturamento do hospital.' }
      ]
    },
    {
      titulo: 'Nota fiscal (para quem é PJ)',
      blocos: [
        { p: 'Se o seu cadastro é de **pessoa jurídica (PJ)**, aparece o cartão **Nota fiscal do mês**, com uma linha para cada hospital em que você trabalhou no mês.' },
        { figura: 'cel-nota', legenda: 'Cartão da nota fiscal na Minha Escala.', pontos: [] },
        { passos: [
          'Emita a nota do mês no sistema da sua prefeitura, como de costume.',
          'Na linha do hospital, toque em `Enviar nota` e escolha o PDF ou a foto da nota (até 10 MB).',
          'A situação muda para **Enviada, aguardando conferência**. `Ver` abre o arquivo enviado.',
          'Quando o faturamento conferir, ela vira **Aceita** e você recebe o aviso. Se vier **Devolvida**, o motivo aparece logo abaixo: corrija e toque em `Enviar outra`.'
        ] },
        { dica: 'Mande a nota assim que fechar o mês: o faturamento libera o pagamento depois que a nota é aceita.' }
      ]
    },
    {
      titulo: 'Informar férias e folgas',
      blocos: [
        { figura: 'cel-disponibilidade', legenda: 'Cartão Minha disponibilidade.', pontos: [] },
        { passos: [
          'Em **Minha disponibilidade**, toque em `Informar`.',
          'Escolha a data de início, a data de fim e o motivo (férias, folga…).',
          'Salve. O período aparece no cartão.'
        ] },
        { p: 'Nesses dias, a coordenação não consegue te escalar: você não aparece como opção nas vagas e nem recebe propostas de troca para esses dias.' },
        { atencao: 'Informe com antecedência. Plantões que você já tem nesses dias continuam seus: para sair deles, use `Passar no Mural` ou peça uma troca.' }
      ]
    },
    {
      titulo: 'Minhas preferências',
      blocos: [
        { p: 'No cartão **Minhas preferências**, toque em `Informar` (ou `Alterar`) e conte à coordenação como prefere trabalhar:' },
        { lista: [
          '**Turno:** `Tanto faz`, `Prefiro diurno` ou `Prefiro noturno`.',
          '**Dias em que não faço plantão:** toque nos dias da semana (ex.: Dom).',
          '**Setores em que quero mais plantões:** aparece quando você atende em mais de um setor.'
        ] },
        { p: 'Toque em `Salvar preferências`. Quando a coordenação usa o preenchimento automático, você não é escalado nos dias que marcou e tem prioridade nos turnos e setores que prefere. No Mural, as vagas do seu interesse aparecem primeiro em cada dia, com a marca **Do seu interesse**.' },
        { atencao: 'É uma preferência, não um bloqueio: a coordenação ainda pode te escalar num dia que você marcou, se precisar. Para períodos em que você não pode de jeito nenhum (férias, congresso), use **Minha disponibilidade**.' }
      ]
    },
    {
      titulo: 'Comunicados da coordenação',
      blocos: [
        { p: 'Ao abrir o app, o comunicado novo aparece numa **janela**, com o texto inteiro: toque em `Li` (ou `Depois`, para ler mais tarde). Todos ficam guardados na tela **Avisos**, no menu, e tocar no aviso do sino abre essa tela. Quando a coordenação publica um comunicado para a sua unidade ou para a equipe de um setor seu, você recebe o aviso no sino (e no celular, se os avisos estiverem ativos), e ele aparece no alto da Minha Escala, em **Comunicados da coordenação**.' },
        { passos: [
          'Leia o comunicado.',
          'Toque em `Li`. A coordenação passa a ver que você leu.',
          'Os comunicados já lidos ficam guardados em `Ver lidos`.'
        ] }
      ]
    },
    {
      titulo: 'Sobreaviso',
      blocos: [
        { p: 'Quando a coordenação te coloca **de sobreaviso** (reserva) num dia, aparece o cartão **Meus sobreavisos** com a data e o setor. Se abrir uma vaga nesse dia, a coordenação pode te chamar (aviso no sino e no celular) e a vaga aparece no topo do seu Mural.' }
      ]
    },
    {
      titulo: 'Próximos plantões',
      blocos: [
        { figura: 'cel-proximos', legenda: 'Lista dos próximos plantões, do mais perto ao mais longe.', pontos: [
          '`Passar no Mural`: pede para liberar o plantão para um colega (precisa da aprovação da coordenação).'
        ] },
        { lista: [
          'Cada plantão mostra o hospital, o setor, o endereço com `Como chegar`, o horário, as horas e o **valor previsto**.',
          '`Google Agenda` coloca só aquele plantão na sua agenda do Google.',
          'Mais abaixo, **Concluídos no mês** guarda os plantões já feitos (toque em `Expandir`).',
          'No fim da tela, **Seus dados (LGPD)**: `Baixar meus dados` e `Pedir exclusão dos meus dados`.'
        ] }
      ]
    },
    {
      titulo: 'O menu do celular',
      blocos: [
        { figura: 'cel-menu', legenda: 'Menu aberto pelo botão Menu (embaixo, à direita).', pontos: [] },
        { p: 'No menu ficam todas as telas liberadas para você, o botão de tema claro/escuro, a versão do sistema e `Sair do sistema`.' }
      ]
    }
  ]
};
