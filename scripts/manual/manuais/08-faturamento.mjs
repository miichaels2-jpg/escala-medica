// Manual 8: Faturamento (fechar o mês, produtividade, pagamentos, recibos).
export default {
  id: '08-faturamento',
  numero: 8,
  titulo: 'Faturamento',
  resumo: 'Fechar o mês: quanto pagar a cada profissional, lançar a produtividade, marcar pagamentos e imprimir recibos.',
  publico: 'Faturamento e gestão',
  secoes: [
    {
      titulo: 'Para que serve',
      blocos: [
        { p: 'O Faturamento calcula, para o hospital escolhido no topo, quanto pagar a cada profissional no mês. O cálculo usa os plantões **concluídos** da escala e o valor cadastrado de cada um no Corpo Clínico: por plantão (diurno, noturno, fim de semana), fixo mensal ou produtividade. Daqui saem também os recibos, os demonstrativos e o relatório de fechamento para a direção.' },
        { atencao: 'O Faturamento é tão certo quanto a escala e o cadastro. Plantão que não aconteceu precisa ser corrigido na Escala; valor ou PIX errado, no Corpo Clínico.' }
      ]
    },
    {
      titulo: 'A tela do Faturamento',
      blocos: [
        { figura: 'faturamento', legenda: 'Fechamento de outubro do Hospital Santa Clara.', pontos: [
          '**Mês:** as setas escolhem o mês a fechar.',
          '`Lançar atendimentos`: lançamento da produtividade diária (seção 4). Aparece quando o hospital usa produtividade.',
          '**Selecionar todos a pagar:** marca de uma vez todos os que estão “A pagar”, para pagar em lote.',
          '`Demonstrativo` (ou `Recibo`, depois de pago): o documento de cada profissional, pronto para imprimir.',
          '`Imprimir fechamento`: o relatório do mês para a direção. Ao lado, `Exportar planilha` baixa tudo em Excel.'
        ] },
        { tabela: { cab: ['Cartão', 'O que mostra'], linhas: [
          ['Total bruto', 'Soma do que os profissionais produziram no mês (plantões concluídos e fixos mensais).'],
          ['Total líquido a repassar', 'O que de fato será pago, depois das retenções (PJ/cooperativa).'],
          ['Horas trabalhadas', 'Horas dos plantões concluídos.'],
          ['Profissionais no mês', 'Quantos têm plantões ou regime mensal no hospital.'],
          ['Pago / A pagar', 'Quanto e quantos profissionais já foram pagos e quanto falta.']
        ] } }
      ]
    },
    {
      titulo: 'A tabela de profissionais',
      blocos: [
        { figura: 'faturamento-tabela', legenda: 'Uma linha por profissional.', pontos: [] },
        { tabela: { cab: ['Coluna', 'O que significa'], linhas: [
          ['Profissional', 'Nome, matrícula e conselho. Para quem é PJ, o selo **NF** mostra a nota do mês: falta, enviada, aceita ou devolvida.'],
          ['Regime', 'Por plantão, fixo mensal ou produtividade.'],
          ['Trabalhado', 'Plantões e horas concluídos no mês.'],
          ['Pagar em', 'A chave PIX ou a conta. **Falta PIX ou conta**: complete no Corpo Clínico antes de pagar.'],
          ['Líquido', 'Valor a pagar, já com a retenção, se houver.'],
          ['Status', '**A pagar**, **✓ Pago** ou **Esperando produção** (produtividade com dias ainda sem lançamento).'],
          ['Ações', '`Demonstrativo`/`Recibo`, `Detalhar` (extrato de plantões realizados e programados) e envio do extrato pelo WhatsApp.']
        ] } }
      ]
    },
    {
      titulo: 'Detalhar: extrato, nota fiscal e informe',
      blocos: [
        { figura: 'faturamento-detalhar', legenda: 'Detalhar de um profissional PJ com a nota enviada.', pontos: [
          '`Ver nota`: abre o arquivo que o profissional enviou.',
          '`Aceitar`: confirma a nota. O profissional recebe o aviso.',
          '`Devolver`: pede o motivo (ex.: "CNPJ do tomador errado") e devolve para correção. O profissional lê o motivo na Minha Escala.',
          '`Informe`: o informe de rendimentos do ano desse profissional, com todos os hospitais que você coordena.'
        ] },
        { p: 'O profissional PJ envia a nota pela Minha Escala (Manual 7). Enquanto a nota não estiver **aceita**, marcar o pagamento dele pede uma confirmação, com o nome de quem está sem nota.' },
        { dica: 'O informe de rendimentos é para conferência do Imposto de Renda. Até maio, o botão já traz o ano anterior, que é o da declaração.' }
      ]
    },
    {
      titulo: 'Produtividade diária (rateio)',
      blocos: [
        { p: 'No regime de produtividade, cada dia tem um valor fixo (ex.: R$ 150,00) dividido entre os profissionais escalados, na proporção dos atendimentos de cada um. A regra aparece no quadro **Produtividade diária**; `Configurar` muda o valor do dia.' },
        { figura: 'faturamento-atendimentos', legenda: 'Janela Lançar atendimentos.', pontos: [] },
        { passos: [
          'Clique em `Lançar atendimentos`. O número ao lado mostra quantos dias estão pendentes.',
          'Em `Pendentes`, aparecem os dias que ainda faltam. Para cada profissional escalado no dia, digite o número de atendimentos, inclusive **0** se não atendeu.',
          'O dia **fecha** quando todos os escalados têm um número. Pode deixar em branco o que ainda não sabe: o dia continua pendente.',
          'Muitos dias de uma vez? `Baixar modelo Excel`, preencha e `Importar Excel`.',
          'Salve. Os valores de cada um passam a entrar no fechamento.'
        ] },
        { dica: 'Enquanto houver dia pendente, o profissional fica como **Esperando produção** e não dá para marcar o pagamento dele.' }
      ]
    },
    {
      titulo: 'Fechar o mês, passo a passo',
      blocos: [
        { passos: [
          'Escolha o mês nas setas.',
          'Confira **Pagar em**: resolva todo “Falta PIX ou conta” no Corpo Clínico.',
          'Se o hospital usa produtividade, lance todos os dias pendentes (seção 4).',
          'Confira os valores. Em caso de dúvida, `Detalhar` mostra o extrato de plantões de cada profissional.',
          'Para os PJ, confira o selo **NF** e aceite ou devolva as notas enviadas (seção 4).',
          'Fez os pagamentos? Clique no status **A pagar** de cada um para virar **✓ Pago**, ou marque vários na caixa da esquerda (ou **Selecionar todos a pagar**) e clique em `Marcar como pago`. O sistema confirma quantos e o total.',
          'Imprima ou salve: `Recibo` de cada profissional e `Imprimir fechamento` para a direção. `Exportar planilha` leva tudo para o Excel.'
        ] },
        { lista: [
          'Marcou por engano? Clique de novo em **✓ Pago** para voltar a **A pagar**.',
          'Quem marca como pago marca para **todos os gestores**: o status é o mesmo para todo mundo, e fica registrado no Histórico.',
          'O profissional vê **Pago** nos ganhos da Minha Escala.'
        ] }
      ]
    },
    {
      titulo: 'Recibo e demonstrativo',
      blocos: [
        { tabela: { cab: ['Documento', 'Quando aparece', 'O que traz'], linhas: [
          ['Demonstrativo', 'Antes do pagamento.', 'Plantões, horas, valores e retenção. Marca d’água “não comprova pagamento”.'],
          ['Demonstrativo parcial', 'Produtividade com dias pendentes.', 'O mesmo, com aviso de que ainda falta lançar produção.'],
          ['Recibo', 'Depois de marcado como pago.', 'Comprovante em duas vias, com o logo do hospital e espaço para assinatura.']
        ] } },
        { p: 'Os documentos abrem prontos para imprimir ou salvar em PDF, com os dados do hospital de **Configurações › Hospital Atual**.' }
      ]
    }
  ]
};
