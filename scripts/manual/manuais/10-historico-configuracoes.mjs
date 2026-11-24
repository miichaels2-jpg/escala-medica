// Manual 10: Histórico (auditoria) e Configurações (hospital, contrato, hospitais, regras).
export default {
  id: '10-historico-configuracoes',
  numero: 10,
  titulo: 'Histórico e Configurações',
  resumo: 'Quem fez o quê no sistema e quando; dados do hospital, contrato, hospitais da rede e limites de carga horária.',
  publico: 'Gestão (coordenação)',
  secoes: [
    {
      titulo: 'Histórico: quem fez o quê',
      blocos: [
        { p: 'O Histórico registra as ações importantes do sistema: quem criou, alocou, trocou ou excluiu plantões, quem publicou escalas, quem aprovou trocas e quem marcou pagamentos, com data e hora. Serve para tirar dúvidas (“quem tirou fulano desse plantão?”) e como prova em auditorias.' },
        { figura: 'historico', legenda: 'Histórico dos últimos 7 dias.', pontos: [] },
        { passos: [
          'Escolha o período: `Hoje`, `7 dias` ou `30 dias`.',
          'Filtre o tipo: `Tudo`, `Plantões`, `Publicações`, `Pagamentos` ou `Trocas`.',
          'Use a busca para achar um profissional, setor ou quem fez a ação.',
          'Cada linha mostra a hora, o que foi feito e, embaixo, quem fez e em qual hospital. `Atualizar` traz as ações mais recentes.'
        ] },
        { dica: 'O Histórico só registra. Para desfazer algo, vá à tela de origem (Escala, Mural ou Faturamento).' }
      ]
    },
    {
      titulo: 'Configurações: Hospital Atual',
      blocos: [
        { p: 'As Configurações têm quatro abas. **Hospital Atual** edita os dados do hospital escolhido no topo da tela, que saem nos relatórios, recibos e impressos.' },
        { figura: 'config-hospital', legenda: 'Aba Hospital Atual.', pontos: [
          '`Hospital Atual`: dados do hospital escolhido no topo.',
          '`Contrato Matriz`: dados da empresa contratante e vigência do contrato com o ScaleMedic.',
          '`Gerenciar Hospitais`: os hospitais da rede.',
          '`Regras da escala`: limites de carga horária.'
        ] },
        { passos: [
          '**Logomarca da Unidade:** `Procurar Imagem` (PNG ou JPG, até 2 MB). Sai nos documentos deste hospital. `Remover Imagem` apaga.',
          'Preencha **Nome Oficial do Hospital**, CNPJ, telefone da recepção, endereço completo, e-mail de contato e o coordenador responsável.',
          'Clique em `Salvar Hospital`.'
        ] },
        { dica: 'Com a logo da rede (Contrato Matriz) e a logo do hospital cadastradas, os impressos saem com as duas.' }
      ]
    },
    {
      titulo: 'Contrato Matriz',
      blocos: [
        { figura: 'config-contrato', legenda: 'Aba Contrato Matriz.', pontos: [] },
        { lista: [
          '**Logomarca da Matriz / Rede:** a logo principal da rede, que sai em todos os documentos.',
          '**Razão Social (Empresa Pagadora)**, CNPJ, responsável e ciclo de faturamento.',
          '**Início** e **Vencimento do Contrato** com o ScaleMedic. Perto do vencimento, aparece o aviso **Contrato próximo do vencimento**, aqui e no Painel.'
        ] },
        { atencao: 'Contrato vencido suspende os acessos. Fale com o ScaleMedic antes do vencimento para renovar.' }
      ]
    },
    {
      titulo: 'Gerenciar Hospitais',
      blocos: [
        { figura: 'config-hospitais', legenda: 'Os hospitais da rede.', pontos: [] },
        { passos: [
          '`Adicionar Hospital` cadastra um hospital novo da rede, com logotipo, CNPJ, endereço e contatos próprios.',
          '`Editar` muda os dados e a **situação** do hospital (ativo ou inativo).',
          '`Remover` tira o hospital da rede. Use com cuidado: escalas e cadastros ligados a ele deixam de aparecer.'
        ] },
        { p: 'Depois de criar um hospital, cadastre os setores dele (Manual 3) e libere os profissionais no passo **Acesso** do cadastro (Manual 4).' }
      ]
    },
    {
      titulo: 'Regras da escala',
      blocos: [
        { figura: 'config-regras', largura: '80%', legenda: 'Limite de carga horária.', pontos: [] },
        { lista: [
          '**Máximo de horas por semana** (segunda a domingo).',
          '**Máximo de horas seguidas, sem descanso.**',
          'Ao escalar alguém acima desses limites, a Escala avisa e pede confirmação. O `Preencher automaticamente` do gerador nunca passa dos limites.'
        ] },
        { p: 'Ajuste os números conforme a política do hospital e clique em `Salvar limites`.' }
      ]
    }
  ]
};
