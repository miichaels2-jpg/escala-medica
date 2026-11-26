// Manual 1: entrar no ScaleMedic (primeiro acesso, dia a dia, credenciamento e celular).
export default {
  id: '01-primeiro-acesso',
  numero: 1,
  titulo: 'Primeiro acesso e entrada',
  resumo: 'Como entrar no ScaleMedic pela primeira vez, criar a senha pessoal, pedir credenciamento e instalar o app no celular.',
  publico: 'Todos: gestão, faturamento e plantonistas',
  secoes: [
    {
      titulo: 'O que é o ScaleMedic',
      blocos: [
        { p: 'O ScaleMedic organiza as escalas de plantão do hospital: a coordenação monta e publica a escala, os profissionais recebem os plantões no celular, as vagas abertas vão para o Mural e o faturamento calcula quanto pagar a cada um no fim do mês.' },
        { p: 'Ele funciona pelo navegador, no computador ou no celular, sem instalar nada. O endereço é **scalemedic.com.br**. No celular, dá para instalar como aplicativo (veja a seção 6).' },
        { tabela: { cab: ['Perfil', 'O que faz no sistema'], linhas: [
          ['Gestão (coordenação)', 'Cadastra setores e profissionais, monta e publica a escala, aprova trocas, acompanha relatórios.'],
          ['Faturamento', 'Confere quanto pagar a cada profissional, marca pagamentos, imprime recibos e relatórios.'],
          ['Plantonista', 'Vê os próprios plantões, pega vagas no Mural, pede trocas, informa folgas e acompanha os ganhos.']
        ] } },
        { dica: 'Cada pessoa vê só as telas do seu perfil. Se faltar alguma tela para você, fale com a coordenação: ela libera no seu cadastro.' }
      ]
    },
    {
      titulo: 'A tela de entrada',
      blocos: [
        { figura: 'login', largura: '78%', legenda: 'Tela de entrada no computador.', pontos: [
          '**Usuário ou E-mail:** o usuário que a coordenação passou (normalmente `nome.sobrenome`, sem acentos) ou o seu e-mail.',
          '**Senha:** a senha provisória no primeiro acesso; depois, a sua senha pessoal. O olho à direita mostra o que foi digitado.',
          '**Lembrar-me neste dispositivo:** guarda só o usuário, nunca a senha. Não marque em computador compartilhado.',
          '**Entrar no Sistema:** confirma a entrada.',
          '**Instalar o app no celular:** mostra como colocar o ScaleMedic na tela inicial do celular.',
          '**Solicite seu credenciamento:** para quem ainda não tem cadastro (veja a seção 4).'
        ] },
        { p: 'O link `Esqueceu a senha?`, acima do campo de senha, manda para o seu e-mail um link para criar uma senha nova (veja a seção 5).' }
      ]
    },
    {
      titulo: 'Primeiro acesso, passo a passo',
      blocos: [
        { p: 'Quando a coordenação cadastra você, ela passa o seu **usuário** e uma **senha provisória**. O endereço do sistema costuma chegar por WhatsApp; por segurança, o usuário e a senha vêm à parte. A senha provisória é a sua data de nascimento completa (dia, mês e ano, só números) seguida da inicial do seu nome, em letra minúscula.' },
        { tabela: { cab: ['Exemplo', 'Senha provisória'], linhas: [['Ana, nascida em 12/04/1990', '`12041990a`'], ['Carlos, nascido em 03/11/1985', '`03111985c`']] } },
        { passos: [
          'Abra **scalemedic.com.br** no navegador do celular ou do computador.',
          'Digite o **usuário** e a **senha provisória** e toque em `Entrar no Sistema`.',
          'Na janela `Crie sua senha`, escolha a sua senha pessoal e repita no segundo campo. Toque em `Salvar e Continuar`. A senha precisa ter **8 ou mais caracteres, com letras e números**, e não pode conter o seu usuário ou e-mail nem ser uma sequência comum (como 12345678).',
          'Na janela `Privacidade e LGPD`, leia os termos, marque a declaração de que concorda e confirme. Isso só aparece no primeiro acesso.',
          'Quem tem acesso a mais de um **estabelecimento** (empresa) vê a janela `Escolha o estabelecimento`: escolha e toque em `Entrar`. O estabelecimento abre com todos os hospitais dele.',
          'Quem é da gestão, tem um estabelecimento só e trabalha em mais de um hospital vê a janela `Escolha o hospital`: escolha e toque em `Entrar`. Dá para trocar de hospital depois, no topo da tela.',
          'Pronto. O plantonista cai direto na tela **Minha Escala**; a gestão, no **Painel**.'
        ] },
        { dica: 'Um login só para vários estabelecimentos: quem trabalha para mais de uma empresa usa o mesmo usuário e a mesma senha em todas. Para trocar sem sair, use o seletor `Estabelecimento` no topo da tela (no celular, dentro do menu). A tela recarrega já com os dados do estabelecimento escolhido.' },
        { atencao: 'A senha provisória só serve para o primeiro acesso. Depois de criar a senha pessoal, use sempre ela. Ninguém da coordenação consegue ver a sua senha.' }
      ]
    },
    {
      titulo: 'Ainda não tenho cadastro: credenciamento',
      blocos: [
        { p: 'Cada hospital tem um **link de credenciamento**, enviado pela coordenação. Ao abrir o link, o hospital já vem preenchido. Sem o link, toque em `Solicite seu credenciamento` na tela de entrada e informe o **código do hospital** que a coordenação passou.' },
        { figura: 'credenciamento', largura: '82%', legenda: 'Ficha de credenciamento.', pontos: [
          '**Código do hospital:** cole aqui o link inteiro ou só o código; o nome do hospital aparece embaixo quando o código está certo.',
          '**Etapas da ficha:** Você, Registro profissional e Recebimento.'
        ] },
        { passos: [
          '**Você:** nome completo, CPF, data de nascimento, celular/WhatsApp, e-mail (opcional, mas ajuda a recuperar o acesso) e o usuário que você quer usar para entrar.',
          '**Registro profissional:** categoria, conselho e estado, validade do registro (se a carteira tiver), RQE e especialidade.',
          '**Recebimento:** como você recebe (pessoa física ou CNPJ), chave PIX ou dados bancários.',
          'Envie a ficha. Aparece **Ficha enviada!** e os dados vão para a coordenação aprovar.',
          'Quando o cadastro for aprovado, você recebe o usuário e a senha provisória e segue o primeiro acesso (seção 3).'
        ] }
      ]
    },
    {
      titulo: 'Dia a dia: entrar, sair e esqueci a senha',
      blocos: [
        { lista: [
          '**Entrar:** usuário (ou e-mail) e senha pessoal, depois `Entrar no Sistema`.',
          '**Sair:** no computador, o botão ao lado do seu nome, no pé do menu lateral; no celular, abra `Menu` e toque em `Sair do sistema`.',
          '**Saída automática:** depois de **1 hora sem uso**, o sistema sai sozinho, para proteger os dados se o aparelho ficar aberto.',
          '**Tema claro ou escuro:** o ScaleMedic segue o tema do aparelho. O botão de lua/sol, no topo, troca e guarda a sua escolha.'
        ] },
        { h: 'Esqueci a senha' },
        { p: 'Quem tem **e-mail no cadastro** troca a senha sozinho, pelo link que chega no e-mail:' },
        { figura: 'recuperar-senha', largura: '46%', legenda: 'Janela aberta pelo link `Esqueceu a senha?`.', pontos: [
          '**E-mail:** o e-mail do seu cadastro. Se você digitou o e-mail no campo de entrada, ele já vem preenchido.',
          '**Enviar link:** manda o e-mail com o link para criar a senha nova.'
        ] },
        { passos: [
          'Na tela de entrada, toque em `Esqueceu a senha?`.',
          'Digite o e-mail do seu cadastro e toque em `Enviar link`.',
          'Abra o e-mail **Redefinir sua senha do ScaleMedic**, enviado por **naoresponda@scalemedic.com.br**, e toque em `Criar nova senha`. Se não chegar em alguns minutos, confira a caixa de spam.',
          'Na tela `Redefinir senha`, digite a senha nova duas vezes e toque em `Salvar nova senha`. Ela segue as mesmas regras do primeiro acesso.',
          'Aparece **Senha alterada**. Toque em `Entrar` e use o seu usuário com a senha nova.'
        ] },
        { atencao: 'O link vale por **1 hora** e funciona uma vez só. Passou do prazo, peça outro. Nunca repasse esse e-mail: quem abre o link consegue trocar a sua senha.' },
        { p: 'Sem e-mail no cadastro, procure a coordenação ou o RH da sua unidade: eles geram uma nova senha provisória no seu cadastro (Corpo Clínico) e você cria a senha pessoal de novo no próximo acesso. Vale aproveitar para pedir que incluam o seu e-mail.' }
      ]
    },
    {
      titulo: 'Instalar o app no celular',
      blocos: [
        { p: 'Instalado, o ScaleMedic abre como aplicativo, com ícone na tela inicial, e pode avisar de plantões e vagas mesmo com o app fechado.' },
        { figura: 'instalar', legenda: 'Guia de instalação aberto pelo botão `Instalar o app no celular`.', pontos: [] },
        { h: 'iPhone (Safari)' },
        { passos: [
          'Abra o ScaleMedic no **Safari** (o navegador com ícone de bússola). Se o link abriu dentro do WhatsApp ou do Instagram, toque em “Abrir no Safari”.',
          'Toque em **Compartilhar** (quadrado com uma seta para cima), na barra de baixo.',
          'Role as opções e toque em **Adicionar à Tela de Início**. Confirme em `Adicionar`.'
        ] },
        { h: 'Android (Chrome)' },
        { passos: [
          'Abra o ScaleMedic no **Chrome**. Se o link abriu dentro do WhatsApp, toque nos três pontinhos e escolha “Abrir no Chrome”.',
          'Toque no menu **⋮**, no canto superior direito.',
          'Toque em **Instalar app** (ou **Adicionar à tela inicial**) e confirme. Em alguns celulares, o próprio ScaleMedic mostra o botão `Instalar agora`.'
        ] },
        { dica: 'Depois de instalar, ative os avisos no sino do topo da tela. Assim você recebe no celular a escala publicada, vagas da sua especialidade e respostas das suas trocas.' }
      ]
    },
    {
      titulo: 'Problemas comuns',
      blocos: [
        { tabela: { cab: ['O que aparece', 'O que fazer'], linhas: [
          ['Usuário ou senha inválidos', 'Confira se o usuário está sem acentos e sem espaços. No primeiro acesso, a senha provisória é a data de nascimento (DDMMAAAA) + a inicial do nome em minúscula.'],
          ['A nova senha não é aceita', 'Use 8 ou mais caracteres, com letras e números, sem o seu usuário ou e-mail e sem sequências como 12345678.'],
          ['O sistema saiu sozinho', 'Passou 1 hora sem uso. Entre de novo.'],
          ['O e-mail de recuperação não chegou', 'Confira o spam e se digitou o e-mail do cadastro. Aguarde 1 minuto para pedir de novo. Sem e-mail no cadastro, procure a coordenação.'],
          ['“Este link expirou ou já foi usado”', 'Peça um link novo em `Esqueceu a senha?`. Use sempre o e-mail mais recente.'],
          ['Não aparece o meu hospital ou uma tela', 'A coordenação libera hospitais, setores e telas no seu cadastro.'],
          ['Não aparece o outro estabelecimento', 'O acesso a cada estabelecimento é liberado pelo ScaleMedic. Peça para incluírem o seu usuário; a senha continua a mesma.'],
          ['“Código não encontrado” no credenciamento', 'Cole o link inteiro enviado pela coordenação ou peça o código de novo.']
        ] } }
      ]
    }
  ]
};
