// Manual 4: Corpo Clínico (cadastro, acesso, valores, convites e credenciamento).
export default {
  id: '04-corpo-clinico',
  numero: 4,
  titulo: 'Corpo Clínico',
  resumo: 'Cadastrar a equipe, definir o que cada um acessa, os valores por hospital e aprovar os credenciamentos.',
  publico: 'Gestão (coordenação) e faturamento',
  secoes: [
    {
      titulo: 'Para que serve',
      blocos: [
        { p: 'O Corpo Clínico é o cadastro de todos os profissionais: dados pessoais e do conselho, em quais hospitais e setores cada um pode trabalhar, quais telas acessa, quanto recebe e como recebe. Tudo o que a Escala, o Mural e o Faturamento fazem depende deste cadastro estar certo.' },
        { tabela: { cab: ['Jeito de cadastrar', 'Quando usar'], linhas: [
          ['`Novo profissional`', 'A coordenação preenche tudo. Bom para poucas pessoas ou quem não tem facilidade com celular.'],
          ['`Convidar equipe`', 'Manda um link; cada profissional preenche a própria ficha e ela chega para aprovação. Bom para a equipe toda.'],
          ['`Importar planilha`', 'Traz muitos profissionais de uma vez, da planilha do próprio hospital (.xlsx ou .csv) ou do modelo.']
        ] } }
      ]
    },
    {
      titulo: 'A tela do Corpo Clínico',
      blocos: [
        { figura: 'corpo-clinico', legenda: 'Lista de profissionais ativos do hospital escolhido no topo.', pontos: [
          '**Abas:** `Ativos` (quem está trabalhando), `Pendentes` (fichas de credenciamento esperando aprovação) e `Inativos`.',
          '**Busca:** por nome, CPF, número do conselho ou e-mail. Ao lado, o filtro por categoria e a troca entre lista e cartões.',
          '`Novo profissional`: cadastro feito pela coordenação, em 3 passos.',
          '`Convidar equipe`: link de credenciamento para mandar à equipe.',
          '`Importar planilha`: cadastro em massa, com a planilha que o hospital já tem. Se preferir, `Baixar modelo Excel` traz uma planilha pronta para preencher.',
          '`Editar`: abre o cadastro do profissional. Ao lado, `Desativar` e o botão do WhatsApp, que abre uma conversa com ele.'
        ] },
        { p: 'Cada linha mostra a categoria, a situação, a matrícula, especialidade, conselho, validade da credencial, hospitais, regime de pagamento, telefone e quantos setores ele pode cobrir.' }
      ]
    },
    {
      titulo: 'Novo profissional, passo 1: Dados',
      blocos: [
        { figura: 'cadastro-1', legenda: 'Passo 1 do cadastro.', pontos: [
          '**Data de nascimento:** obrigatória. É dela que sai a senha do primeiro acesso.',
          '`Próximo: Acesso` leva ao passo 2. Também dá para clicar nos passos no topo da janela.'
        ] },
        { passos: [
          'Clique em `Novo profissional`.',
          'Escolha a **Categoria Profissional** (Médico, Enfermeiro, Fisioterapeuta…). Cada uma já sabe o conselho (CRM, COREN…). `Gerenciar Categorias` cria categorias novas.',
          'Preencha **Nome completo oficial**, **Especialidade / Atuação**, CPF, **data de nascimento**, conselho (número e estado) e **Telefone / WhatsApp**. RQE, CBO, validade da credencial e e-mail são opcionais. A matrícula é gerada sozinha.',
          'Clique em `Próximo: Acesso`. Se faltar nome ou data de nascimento, o sistema avisa.'
        ] },
        { atencao: 'A **especialidade** decide quais vagas a pessoa vê no Mural e para quais vagas ela aparece ao escalar. Escreva igual à especialidade dos turnos do setor (ex.: “Clínica Médica”).' }
      ]
    },
    {
      titulo: 'Passo 2: Acesso',
      blocos: [
        { figura: 'cadastro-2', legenda: 'Passo 2: perfil, telas, hospitais e setores.', pontos: [] },
        { passos: [
          'Escolha o **Perfil de Permissão**: `Profissional Assistencial` (Minha Escala, Mural e trocas), `Coordenador de Escala` (monta escalas e setores), `Faturamento / Financeiro` (fechamento e pagamentos) ou `Gestor Geral / Administrador` (tudo).',
          '**Telas liberadas** já vêm marcadas pelo perfil. Para tirar ou dar uma tela específica, ou deixar só para visualizar, clique em `Ajustar telas`.',
          'Em **Hospitais Liberados**, marque os hospitais onde a pessoa trabalha. Para cada um, aparece a tabela de valores no passo 3.',
          'Em **Setores autorizados para alocação**, deixe marcados só os setores que ela pode cobrir. Setores criados depois já entram marcados.'
        ] },
        { figura: 'cadastro-2b', legenda: 'Fim do passo 2: o acesso ao sistema.', pontos: [
          '`Senha (Data Nasc)` gera a senha do primeiro acesso: data de nascimento (DDMMAAAA) + inicial do nome em minúscula. `Gerar Aleatória` cria uma senha qualquer. Se você não gerar, o sistema usa a da data de nascimento ao salvar.',
          '`Enviar link de acesso via WhatsApp` abre o WhatsApp com a mensagem pronta e o endereço do sistema. Por segurança, a mensagem **não leva usuário nem senha**: passe esses dados à pessoa à parte.'
        ] },
        { p: 'O **Usuário** (login) é sugerido a partir do nome, sem acentos (ex.: `ana.rocha`). Pode ser trocado.' }
      ]
    },
    {
      titulo: 'Passo 3: Valores e recebimento',
      blocos: [
        { figura: 'cadastro-3', legenda: 'Passo 3: quanto recebe e como recebe.', pontos: [
          '`Cadastrar profissional` salva tudo e cria o acesso ao sistema.'
        ] },
        { tabela: { cab: ['Regime contratual', 'Como o Faturamento calcula'], linhas: [
          ['Por plantão', 'Um valor por plantão em cada hospital: **diurno**, **noturno** e **fim de semana**.'],
          ['Fixo mensal', 'Um valor por mês em cada hospital, independente do número de plantões.'],
          ['Produtividade / comissão', 'Pelos atendimentos lançados no dia, dividindo o valor do dia entre quem atendeu (veja o Manual 8).']
        ] } },
        { passos: [
          'Escolha o **Regime Contratual** e preencha os valores de **cada hospital** liberado no passo 2.',
          'Se houver desconto de pessoa jurídica ou cooperativa, informe a **Retenção PJ/Coop (%)**.',
          'Em **Dados para Recebimento**, escolha pessoa física ou jurídica e informe a **chave PIX** (ou os dados bancários, se não usar PIX).',
          'Clique em `Cadastrar profissional`. Aparece a mensagem com o **usuário e a senha do primeiro acesso**: anote ou envie ao profissional.'
        ] },
        { dica: 'Sem PIX nem conta, o Faturamento mostra “Falta PIX ou conta” para essa pessoa. Sem valor cadastrado, o custo dos plantões dela fica de fora dos relatórios.' }
      ]
    },
    {
      titulo: 'Convidar a equipe e aprovar credenciamentos',
      blocos: [
        { figura: 'convidar', largura: '70%', legenda: 'Janela Convidar equipe.', pontos: [] },
        { passos: [
          'Clique em `Convidar equipe` e `Copiar` o **link**. Mande pelo grupo de WhatsApp da equipe ou por e-mail. Quem abrir pela tela de entrada usa o **código do hospital**.',
          'Cada profissional preenche a própria ficha (Manual 1, seção 4). As fichas chegam na aba `Pendentes`.',
          'Em `Pendentes`, abra a ficha com `Editar`, confira os dados, complete o passo 2 (perfil, hospitais e setores) e o passo 3 (valores), mude o **Status Cadastral** para `Ativo` e salve.',
          'Passe à pessoa o usuário e a senha do primeiro acesso (aparecem na mensagem ao salvar). O botão do WhatsApp manda o endereço do sistema, mas não leva usuário nem senha.',
          'Ficha que não deve ser aprovada: `Recusar`. Os dados enviados são apagados de vez (por causa da LGPD); se a pessoa quiser, preenche de novo.'
        ] }
      ]
    },
    {
      titulo: 'Importar planilha',
      blocos: [
        { p: 'Não precisa refazer a planilha do hospital. A importação reconhece colunas com nomes comuns, como **Nome, CPF, E-mail, Celular, CRM, Profissão, Especialidade, Data de nascimento, Hospital, Setor, Valor do plantão, Chave PIX e CNPJ**, em qualquer ordem. Uma linha por profissional; a primeira linha é o cabeçalho.' },
        { passos: [
          'Clique em `Importar planilha` e escolha o arquivo (.xlsx ou .csv).',
          'Confira a **prévia**, que separa as linhas em quatro grupos (tabela abaixo).',
          'Clique em `Importar N profissional(is)`. Entram os prontos e os com ajustes.',
          'Depois, abra quem ficou com aviso em `Editar` e complete o que faltou (valor do plantão, categoria, setor…).'
        ] },
        { tabela: { cab: ['Grupo', 'O que significa'], linhas: [
          ['Pronto', 'Tudo reconhecido. Entra como está.'],
          ['Entra com ajustes', 'Algum valor não foi reconhecido (ex.: categoria "Motorista", data "ontem", e-mail sem domínio, hospital com outro nome). Entra com o padrão e o aviso diz o que ajustar depois.'],
          ['Já cadastrado', 'Já existe alguém com o mesmo CPF, e-mail ou matrícula. Fica de fora para não duplicar.'],
          ['Não entra', 'Linha sem nome ou repetida dentro da própria planilha.']
        ] } },
        { dica: 'A especialidade entra do jeito que está na planilha e já aparece nas listas do sistema. Se ela já existir escrita de outro jeito ("clinica medica"), o sistema usa a grafia cadastrada ("Clínica Médica"). Nomes em MAIÚSCULAS viram "Nome Próprio". Datas podem vir como 05/03/1990, 05-03-90 ou no formato de data do Excel.' },
        { atencao: 'A planilha não leva senhas e não cria o acesso ao sistema. Depois de importar, abra cada profissional em `Editar` para gerar a senha e liberar o acesso.' }
      ]
    },
    {
      titulo: 'Editar, desativar e trocar a senha',
      blocos: [
        { lista: [
          '**Editar:** `Editar` na linha do profissional abre o mesmo cadastro em 3 passos, e dá para ir direto ao passo que precisa.',
          '**Desativar:** `Desativar` tira a pessoa das escalas novas e bloqueia o acesso, mas guarda o histórico. Ela vai para a aba `Inativos`, onde `Ativar` traz de volta.',
          '**Nova senha:** quem esqueceu a senha precisa de uma nova provisória. Em `Editar`, passo 2, clique em `Senha (Data Nasc)` ou `Gerar Aleatória`, salve e envie ao profissional. No próximo acesso ele cria a senha pessoal.',
          '**WhatsApp:** o botão verde da linha abre uma conversa com o profissional.'
        ] }
      ]
    }
  ]
};
