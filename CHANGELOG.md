# Histórico de versões — ScaleMedic

## Regra de numeração

- Cada entrega publicada em produção sobe o último número: V0.1.2 → V0.1.3 → … → V0.1.10.
- Depois de V0.1.10, a próxima é **V0.2.1** (o número do meio sobe e o último recomeça em 1),
  e assim por diante: V0.2.10 → V0.3.1.
- A versão fica no campo `version` do `package.json` (sem o "V") e aparece no app
  (menu lateral, menu do celular e tela de Login). A regra está em `src/lib/version.js`.
- Cada versão publicada recebe uma tag git `vX.Y.Z` e uma entrada neste arquivo.

## V0.7.2 — 25/11/2026

Mostrar o resultado do mês para quem decide.

- **Apresentação do mês** (Relatórios › Visão geral, no lugar do antigo "Modo apresentação", que só abria a tela em tela cheia): 6 slides em tela cheia — capa com os logos, cobertura por dia, vagas e furos por setor, custo por setor comparado com o mês anterior, equipe (horas, diurno × noturno, quem mais esteve de plantão) e resumo com o próximo mês. Setas do teclado (ou passador de slides), escolha do mês e PDF com um slide por página, sempre no tema claro. Abre no mês que acabou de fechar quando o atual ainda está no começo.
- **Painel › Como estamos indo** (gestão): cobertura, vagas, custo previsto e horas do mês com a variação sobre o mês anterior, e um calendário do mês com os dias de vaga aberta ou furo; clicar num dia com vaga abre a vaga na escala.
- **Custo antes de publicar**: a janela de publicar mostra quantos plantões, quantos sem profissional e o custo estimado do período, comparado com o período anterior.
- Cálculo único do resumo do mês em `src/lib/monthSummary.js` (mesma base de custo dos Relatórios), com testes.
- Correção: no Painel em "Todas as unidades", "Hoje por setor", a cobertura e as vagas do mês contavam só os plantões de uma unidade (os setores das outras apareciam como "Sem plantão hoje").
- O Painel não lê mais a cópia antiga dos dados do profissional no navegador.
- Planejamento: itens 47 a 67 (ideias de 25/11).

## V0.7.1 — 25/11/2026

Limpeza final da varredura.

- As últimas funções com duas cópias agora ficam num lugar só: nome do profissional do plantão e regra de vaga (`shiftLiveStatus`), dados financeiros e atendimentos salvos do profissional (o Faturamento usa os de `reportUtils`) e o login sugerido a partir do nome (`format`, usado no Cadastro e na Plataforma).
- Atualização simples de três pacotes usados só para montar o site (alertas de segurança: de 5 para 2; os 2 que restam são do pacote do Excel e só valem para um uso que o sistema não faz).
- Teste novo para o login sugerido.

## V0.6.10 — 25/11/2026

Organização do código (nada muda na tela, exceto a correção abaixo):

- **Corpo Clínico lia "12.500" como R$ 12,50**: a tela tinha uma cópia antiga da leitura de valores que não entendia
  ponto de milhar (o Faturamento lia certo, R$ 12.500). Agora todas as telas usam a mesma leitura.
- Funções que existiam em várias cópias (datas, valores em R$, texto sem acento; até 6 cópias da mesma) ficam num só
  lugar, `src/lib/format.js`, com testes. −119 linhas.
- O verificador de código passa a olhar também `src/lib` (regras de negócio, cálculos, permissões), que antes ficava de
  fora: zero erros e zero avisos no projeto todo.
- Planilha do fechamento: total de descontos arredondado a centavos dentro da célula.

## V0.6.9 — 25/11/2026

Limpeza (nada muda para quem usa):

- 46 dos 65 pacotes instalados não eram usados (Stripe, mapas, 3D, editor de texto, gerador de PDF, moment, lodash,
  date-fns, zod e outros) e foram removidos; restam 19. Somem junto vários alertas de segurança desses pacotes.
- 39 arquivos sem uso apagados: 38 componentes de tela prontos que nenhuma tela usava (cerca de 3.200 linhas) e um
  arquivo de funções antigas.
- Fim da camada antiga de publicações e pagamentos guardados no navegador (anterior à V0.3): migração de chaves,
  envio único ao banco e o modo "salvo só neste navegador". Tudo fica no banco, como já era na prática (−130 linhas).
- A especialidade de cada plantão deixou de ser copiada no navegador (já é salva no banco). As cópias antigas são
  apagadas ao abrir o sistema.

## V0.6.8 — 25/11/2026

Correções da varredura de 25/11:

- **Segurança nos impressos**: o impresso dos Relatórios colocava nomes de profissionais, setores e especialidades
  direto no HTML; um cadastro com código no lugar do nome rodaria esse código na sessão de quem imprimisse. Agora todo
  texto do banco é filtrado, como nos outros impressos. O rodapé de todos os impressos também deixou de aceitar "<" no
  nome de quem imprime.
- **Validade da credencial não é mais inventada**: o cadastro novo vinha com "daqui a 1 ano" e a edição de quem não
  tinha validade mostrava (e salvava) "daqui a 180 dias". Agora o campo fica vazio até alguém preencher.
- **Dados pessoais fora do navegador**: o Corpo Clínico guardava no navegador uma cópia dos dados de cada profissional
  editado (CPF, PIX, banco, salário). A cópia deixou de existir e as antigas são apagadas ao abrir o sistema e ao sair.
- Relatórios: credencial aparecia vencida no seu último dia válido (data lida no fuso de Londres).
- Mural: vaga "Geral" ou sem especialidade aparecia como "Clínica Médica"; agora aparece "Geral", como a regra de quem
  pode pegar a vaga e o aviso do servidor já tratavam.
- React Router atualizado para a versão 7 (correção de segurança).

## V0.6.7 — 25/11/2026

- Planilhas Excel: em alguns Excel o topo (logo, título e cabeçalho da tabela) aparecia duas vezes ao abrir, porque a
  célula selecionada ficava na parte fixa. Agora a planilha abre na primeira linha de dados, logo abaixo do cabeçalho.
- A setinha do filtro tapava o fim dos títulos das colunas de números (Plantões, Horas, Bruto): o título fica no alto
  da célula e a setinha embaixo.

## V0.6.6 — 24/11/2026

- **Planilhas Excel de verdade (.xlsx)** no Fechamento de honorários e em todos os Relatórios, no mesmo padrão dos
  impressos: logos da empresa e da unidade, unidade, título, período e data de emissão no topo; valores em R$, horas e
  datas como números (dá para somar e filtrar); cabeçalho da tabela fixo e com filtro; linhas alternadas; totais; cor só
  para situação (pago, pendente, furo, vaga). Prontas para imprimir direto do Excel: A4, cabem na largura da folha,
  cabeçalho repetido em cada página e “Página X de Y” no rodapé. Antes eram páginas da web com extensão .xls, que o
  Excel abria com aviso e com valores como texto.
- Relatórios › Visão geral exporta uma aba por relatório (12 abas), incluindo **Resumo executivo** e
  **Confiabilidade**, que antes saíam vazias na planilha.
- Modelos de importação (Corpo Clínico e Atendimentos) com o mesmo visual de cabeçalho; as colunas não mudaram.
- **Escala no modo claro**: as janelas Montar escala, Lançar/editar plantão, Plantões antigos, Alocação em lote,
  Copiar mês e Publicar ficavam escuras mesmo no tema claro. Agora seguem o tema; o modo escuro não mudou.
- Manuais de treinamento: fotos dessas janelas refeitas no tema claro e dica da planilha nova em Relatórios.

## V0.6.5 — 24/11/2026

- **Material de treinamento** (nova tela, só para o dono da plataforma): 11 manuais em PDF, um por assunto, e o
  manual completo (70 páginas). Cada manual tem capa e marca ScaleMedic, sumário, explicação da tela, fotos com pontos
  numerados e passo a passo: primeiro acesso, Painel, Setores, Corpo Clínico, Escala, Mural, Minha Escala,
  Faturamento, Relatórios, Histórico e Configurações, e a ajuda do sistema. As fotos usam a demo com nomes, e-mails,
  telefones e CPFs trocados por fictícios e sem logo de cliente.
- Gerador dos manuais em `scripts/manual` (`capturar.mjs` tira as fotos sem salvar nada; `gerar.mjs` monta os
  PDFs): quando uma tela mudar, os manuais são refeitos em minutos.
- Corpo Clínico › Convidar equipe: o link e o botão Copiar estouravam a janela.
- Escala: botões “Cancelar” das janelas de plantão e de unidade dos plantões antigos ficavam apagados.

## V0.6.4 — 24/11/2026

- **Tema segue o aparelho:** quem nunca escolheu um tema abre o ScaleMedic no claro ou no escuro conforme o celular
  ou computador (antes, todo mundo começava no escuro). Quem já trocou pelo botão sol/lua continua com a escolha.
- O tema é aplicado antes da tela aparecer: acabou a "piscada" escura ao abrir o app no tema claro.
- Telas conferidas no tema claro (13 telas, página inteira).
- Gráficos da Visão geral (Relatórios): se uma versão nova sair com a tela aberta, recarrega sozinho em vez de dar erro.

## V0.6.3 — 24/11/2026

- **Código sem avisos do verificador (lint):** de 101 para 0. Nada muda na tela.
  - Imports e variáveis sem uso removidos, e trechos mortos apagados (ex.: um "Disponibilizar no Mural" da janela de
    plantão que não aparecia em lugar nenhum).
  - A função de salvar plantão, que estava copiada em três telas, virou uma só (`src/lib/saveRow.js`).
  - O verificador agora sabe que o service worker, os testes e os arquivos de configuração rodam fora da página, e
    aceita `catch {}` vazio (usado de propósito quando o navegador bloqueia o armazenamento).
- Conferência: as 81 capturas de telas, janelas, impressos e Excel saíram idênticas às da V0.6.2.

## V0.6.2 — 24/11/2026

- **Botão "Como fazer" mais visível:** agora fica ao lado do título da tela, em branco, com o nome escrito
  (antes era só um chapéu no canto).
- **Escala e Relatórios divididos em partes menores** (nada muda na tela). Escala: de 3.260 para 2.130 linhas, com as
  janelas (lançar plantão, gerador, alocação, publicar, copiar mês, unidade de plantões antigos), o Modo TV, a aba
  Plantão do dia e os impressos em arquivos próprios. Relatórios: de 2.715 para 839 linhas, com cada grupo de
  relatórios, o Excel e a impressão em arquivos próprios.
- **Relatórios abrem mais rápido:** os gráficos da Visão geral (~400 KB) só baixam quando ela é aberta; a tela em si
  caiu de 521 KB para 115 KB.
- Conferência: telas, janelas, impressos e Excel da versão anterior e da nova comparados texto a texto (81 capturas).

## V0.6.1 — 24/11/2026

- **Botão "Como fazer" no topo das telas** (chapéu na faixa azul) em Escala, Setores, Corpo Clínico, Mural,
  Faturamento e Minha Escala. Lista só as tarefas daquela tela e de quem está usando (gestão ou plantonista).
  Na primeira visita à tela abre sozinho uma vez; fechou, não volta (o botão fica).
- **"Mostrar na tela": guia passo a passo** que destaca onde clicar ("clique aqui em Montar mês"), explica cada
  passo e avança quando a pessoa clica. Não faz nada sozinho: quem faz é a pessoa. Segue entre telas (Setores →
  Escala) e janelas; quando falta algo (ex.: mês sem vaga), explica o que fazer.
- **Vídeo numa janelinha flutuante** no canto, por cima do sistema: dá para assistir e fazer ao mesmo tempo,
  recolher ou fechar. O vídeo continua de onde a pessoa parou, e o que já foi visto ganha ✓.
- Tela "Como usar": botão "Fazer junto na tela" em cada vídeo, que abre a tela certa já com o guia.

## V0.5.10 — 23/11/2026

- **Mais 4 vídeos em "Como usar"** (agora 9, em quatro assuntos): cadastrar um profissional, aprovar um pedido no
  Mural, fechar o mês no Faturamento e, para o plantonista, passar um plantão.
- **Faturamento:** o cartão "Esperando produção" mostra quantos dias faltam lançar (antes, "Lançar atendimentos" em
  letra grande); nomes e "Pagar em" não quebram mais em várias linhas na tabela; cabeçalho em uma linha.
- Gravador dos vídeos: a rolagem mira a área principal da tela (antes podia rolar o menu lateral).

## V0.5.9 — 23/11/2026

- **Nova tela "Como usar"** (menu): vídeos curtos, sem som, com cursor e legendas na própria tela do ScaleMedic.
  Gestão: montar o mês com os turnos padrão, escalar alguém pela Grade e publicar a escala. Plantonista (formato de
  celular): Minha Escala e pegar uma vaga no Mural. O plantonista vê só os vídeos dele.
- **Primeiros passos do Painel:** "Ver como fazer" nos passos de setores, escala e publicação abre o vídeo certo.
- **Gravador dos vídeos** em `scripts/tutoriais/` (`node scripts/tutoriais/gravar.mjs`): grava pelo próprio Chrome,
  sem ffmpeg, e devolve a demo ao estado original no fim. Quando uma tela mudar, regrava em minutos.
- Janela "Publicar e Oficializar Escala" e botão do Modo TV: os botões "7 Dias", "15 Dias", "Mês Inteiro" e
  "Cancelar" ficavam ilegíveis no tema claro.

## V0.5.8 — 23/11/2026

- **Relatórios com mês quase vazio:** no começo do mês, quando "Este mês" tem poucos plantões, aparece "Este mês tem
  só N plantões até agora · Ver o mês passado (X plantões)", que troca o período com um toque. Vale para todos os
  relatórios.
- **Confiabilidade mais útil:** o cartão "Maior índice" (quase todo mundo em 100%) virou "Mais plantões cumpridos"
  (plantões, horas e noites). A tabela ganhou **Noites** e **Fins de semana** cumpridos, para ver quem carrega a escala
  pesada.
- Contagens no singular quando é 1 ("1 profissional", "1 plantão").

## V0.5.7 — 23/11/2026

- **Impressos no mesmo padrão** (`src/lib/printLayout.js`): cabeçalho com as logos da empresa e da unidade, nome do
  hospital e tipo de documento; rodapé em toda folha com "Página X de Y" e quem emitiu e quando; tabelas leves.
- **Recibo e demonstrativo:** com logos, bruto / retenção / líquido em destaque, "Falta PIX ou conta" quando faltar e
  sem a matrícula provisória "MAT-XXXX". Marca d'água com sentido: "NÃO COMPROVA PAGAMENTO" no demonstrativo e a
  logo no recibo pago.
- **Escala do mês em quadro para o mural:** uma folha por setor, dias × turnos, VAGA/FURO marcados e "RASCUNHO" ao
  fundo no setor ainda não publicado (outubro da demo: de ~6 folhas de lista para 3).
- **Plantão do dia:** agrupado por setor, com vagas e as linhas de assinatura.
- **Fechamento do Faturamento:** total no pé da tabela, situação (pago / a pagar / esperando produção), "Falta PIX ou
  conta" e assinaturas do faturamento e da direção.
- **Espelho do profissional:** valor por plantão, resumo do mês e unidade em cada linha quando atende em mais de uma.
- **Relatórios:** mesmo cabeçalho e rodapé; o relatório completo não abre cada seção em folha nova nem imprime seções
  vazias (6 → 2 folhas na demo); nomes como "Maternidade e Obstetrícia" e "UCO" sem maiúscula errada.

## V0.5.6 — 23/11/2026

- **Cadastro de profissional em 3 passos** (Corpo Clínico › Novo profissional): **Dados** (categoria, nome,
  documentos, contato) → **Acesso** (perfil, telas, hospitais, setores, login) → **Valores** (regime, tabela por
  unidade, PIX/conta). Cada passo confere o que falta antes de avançar (nome, data de nascimento, hospital, telas);
  Enter avança em vez de salvar pela metade. Na edição, dá para ir direto a qualquer passo e salvar de onde estiver.
- **Telas liberadas recolhidas:** o passo Acesso mostra um resumo ("Escala, Mural, Minha Escala · só visualiza") e o
  botão "Ajustar telas" abre a lista completa.
- Títulos "Novo profissional" / "Editar profissional"; títulos de seção sem verde decorativo.

## V0.5.5 — 23/11/2026

- **Faturamento mais claro:** números do mês, produtividade e situação dos pagamentos em superfície neutra; cor só
  para status (pago, a pagar, falta cadastro). Valores líquidos, matrícula, regime e retenção sem destaque colorido.
- **"Falta PIX ou conta":** a coluna "Pagar em" diz o que falta e onde cadastrar (antes: "Pendente de cadastro").
- **Marcar como pago em lote:** caixas de seleção (e "selecionar todos a pagar") com a barra "N selecionados · total ·
  Marcar como pago", com confirmação. Só aparecem para quem está a pagar e com a produção fechada.
- Nomes mais diretos: "A pagar" e "Esperando produção" no status; o cartão "Esperando produção" só aparece quando há.

## V0.5.4 — 23/11/2026

Revisão feita logada como plantonista, no celular (login de teste na demo).

- **Primeiro acesso:** a troca da senha provisória virou "Crie sua senha", em azul (antes era um alerta vermelho de
  "Atualização de Segurança"). Plantonista com mais de uma unidade entra direto, sem a tela de escolher hospital — ele
  já vê todas as unidades num login só. Para a gestão, a escolha de hospital ficou sem o código interno da unidade.
- **Minha Escala:** "Próximos plantões" lista todos os plantões marcados, de qualquer mês (antes só o mês corrente:
  quem tinha plantão só no mês seguinte via "Nenhum plantão futuro nesta competência"). O seletor de mês ficou no
  "Resumo do mês" (cumpridos, ganhos e concluídos). Um botão de espelho só, cartões neutros (cor só para ao vivo, em
  análise e choque de horário) e sem "Valor previsto: R$ 0,00".
- **Ponto por GPS:** quando a unidade não tem coordenadas, o cartão do próximo plantão não mostra mais o aviso amarelo
  nem botões de check-in que nunca liberariam.
- **Escala para o plantonista:** mostra só o que a coordenação publicou (antes aparecia o rascunho, com a etiqueta
  "Rascunho"), sem os números de gestão (cobertura, furos, vagas). Mês sem escala publicada explica onde ver os
  próprios plantões e as vagas.

## V0.5.3 — 23/11/2026

- **Turnos padrão por setor:** em Setores, cada setor guarda os horários fixos de todo dia (ex.: UTI — 2 vagas
  07–19 e 1 vaga 19–07). Na Escala, "Montar turnos do mês" já abre com esses turnos e com o mês inteiro; trocar o
  setor no gerador carrega os turnos dele. O próprio gerador oferece "Guardar como turnos padrão do setor". Os turnos
  ficam nos dados da empresa (`sector_shift_templates`), sem mudança no banco.
- **Cartões de setor mais úteis:** turnos padrão, quantos profissionais estão autorizados e plantões/vagas abertas do
  mês, com o botão "Montar mês" (abre a Escala direto no gerador daquele setor). Saíram os três contadores coloridos
  do topo; a situação "Inativo" agora aparece de verdade (antes o cartão sempre dizia "Ativo").
- Editar um setor não troca mais a especialidade dele por "Geral".

## V0.5.2 — 23/11/2026

- **Mesmos nomes em todo o app:** menu e topo de cada tela com o mesmo nome curto — Painel, Escala, Mural, Minha
  Escala, Corpo Clínico, Setores, Relatórios, Faturamento, Histórico, Configurações (antes: "Painel Geral", "Mural de
  Oportunidades" × "Mural de vagas", "Setores & Especialidades", "Faturamento & Repasse"…). A lista de telas
  liberadas no Corpo Clínico usa os mesmos nomes.
- **Acessos num lugar só (Corpo Clínico):** novo botão "Convidar equipe" com o link e o código de credenciamento. Saiu
  a aba "Equipe & Acessos" das Configurações — o "Liberar acesso" de lá criava logins genéricos ("Usuário
  Convidado") sem cadastro de profissional; quem cria acesso agora é sempre o "Novo profissional", com nome, perfil e
  telas. Configurações ficam com hospital, contrato, hospitais e regras da escala.

## V0.5.1 — 23/11/2026

- **Painel enxuto:** saem a faixa de vagas, o anel "Eficiência de cobertura", o gráfico de horas (vazios quando não há
  plantão) e o cartão fixo de corpo clínico. Fica:
  - **Precisa de você:** só o que pede ação — vagas sem profissional nos próximos 7 dias (um toque abre a vaga na
    escala), furos do mês, setores com a escala do mês em rascunho e plantões de hoje sem valor ou aguardando
    produção. Sem pendências, uma linha só: "Tudo em dia".
  - **Números do dia:** em andamento agora, plantões hoje, cobertura do mês e custo de hoje.
  - **Hoje por setor:** só os setores com plantão hoje, com quem está, quem entra e vagas (junta a antiga cobertura
    por setor com a lista de plantões do dia).
  - No celular, sem o botão "Modo TV".

## V0.4.10 — 23/11/2026

- **LGPD na prática:**
  - **Aceite dos termos gravado pelo banco**, com a data do servidor e a versão dos termos (antes vinha do relógio do
    celular, e uma falha na gravação deixava a pessoa entrar sem o aceite registrado — agora ela não entra). Quando os
    termos mudarem, basta subir a versão: cada pessoa aceita de novo no próximo login. A página dos termos mostra a
    versão.
  - **Minha Escala › Seus dados (LGPD):** quando aceitou os termos, **baixar meus dados** (cadastro, plantões,
    notificações e registros de privacidade num arquivo) e **pedir exclusão dos meus dados**.
  - **Pedido de exclusão:** avisa os gestores da empresa no sino e aparece no Corpo Clínico com o prazo de 15 dias,
    até o gestor marcar como atendido.

## V0.4.9 — 23/11/2026

- **Histórico com autor garantido pelo banco:** o "quem fez" passa a vir do login oficial, descoberto pelo próprio
  banco (antes vinha de um cabeçalho que o navegador mandava e que alguém logado poderia trocar). Ações automáticas do
  servidor, como o alerta de furo, aparecem como "Sistema (automático)". Registros antigos não mudam.
- **Testes antes de publicar:** os 74 testes automáticos ganharam o comando `npm test` e rodam na Vercel antes da
  montagem do app — se algum falhar, a versão não sobe e o site continua na anterior. O GitHub também confere cada
  envio.
- **Aviso de erro em produção:** quando aparece a tela "Instabilidade no módulo" (ou o navegador acusa um erro), o
  app registra tela, mensagem, versão, quem e qual empresa. Só o dono vê, na Plataforma › Erros recentes. Sem
  repetição do mesmo erro em 10 minutos e com teto por hora.
- **Correção:** depois de um erro, trocar de tela pelo menu já limpa o aviso de instabilidade (antes só recarregando).

## V0.4.8 — 23/11/2026

- **Planejamento:** entra o item 41 — tela "Como usar" com vídeos narrados (voz feminina em português e legenda) de
  cada tela e tarefa, botão "?" em cada tela e "ver como fazer" nos Primeiros passos. Começa por um vídeo piloto.

## V0.4.7 — 23/11/2026

- **Planejamento:** entram os próximos passos da varredura completa do app, em três prioridades — segurança e
  confiança (histórico com autor garantido pelo banco, backup, testes antes de publicar, aviso de erro, LGPD), dia a
  dia mais simples (Painel enxuto, turnos padrão por setor, acessos num lugar só, mesmos nomes em todo o app,
  Faturamento mais claro, cadastro em passos, visão do plantonista) e acabamento (código mais leve, avisos antigos,
  tema claro como padrão).

## V0.4.6 — 23/11/2026

- **Escala, acabamento:** siglas da Grade sem repetição (duas pessoas com as mesmas iniciais viram, por exemplo,
  "CSi" e "CSo", ou "MT1" e "MT2") e legenda "quem é quem" embaixo de cada setor; setores numa linha própria, com os
  5 primeiros à vista e o resto no "+N"; no celular, o mês e o "Publicar" na mesma linha ("Copiar mês anterior" foi
  para o menu "Mais").
- **Lista, calendário e plantão do dia no mesmo padrão da Grade:** cartões neutros com selo curto ("Vaga aberta",
  "Furo", "Em andamento", "Concluído", "Programado"), sem bordas coloridas nem ícones piscando.

## V0.4.5 — 23/11/2026

- **Tela "Escala" (antes "Escalas & Plantões"):** topo com o mês, "Copiar mês anterior" e um único "Publicar"; uma
  linha com os setores (pontinho laranja = mês em rascunho), busca, dia/noite, visão e o menu "Mais" (plantão avulso,
  montar turnos do mês, plantão do dia, Modo TV, imprimir, voltar para rascunho); e os números do mês (cobertura,
  vagas em aberto, furos, plantões e horas).
- **Grade por setor (visão padrão no computador):** cada linha é uma vaga do turno, cada coluna um dia. O "+" mostra
  quem pode assumir — mesma especialidade primeiro, horas no mês, e quem não pode e por quê — e escala com um clique;
  em quem já está escalado dá para trocar, liberar a vaga ou editar. Usa as mesmas regras de sempre (choque de
  horário, férias, carga horária, setor autorizado) e grava os mesmos dados. No celular abre na lista.
- **Saíram:** o filtro "A partir de", que escondia os dias anteriores sem avisar; as faixas repetidas; o segundo
  botão de publicar; e o botão que escondia o menu lateral (podia deixá-lo sumido nas outras telas).

## V0.4.4 — 23/11/2026

- **Relatórios reorganizados:** os 12 relatórios da lista lateral viraram 4 abas no alto — Visão geral, Escalas
  (Plantões, Trocas e repasses, Setores), Equipe (Cadastro, Produtividade, Confiabilidade, Aniversariantes) e Financeiro
  (Custos, Apuração diária, Extrato individual). O "Resumo executivo", que repetia os números do Painel BI, foi
  absorvido pela Visão geral, que agora começa pelas vagas sem profissional.
- **Filtros valendo na hora:** uma linha só, com atalhos de período (este mês, mês passado, últimos 3 meses, este
  ano ou escolher datas), setor e busca; "Situação" só nos relatórios de equipe. Saiu o botão "Aplicar filtros".
- **Por dentro:** sem emoji nem palavras em maiúsculas ("Furo" e "Em aberto"), valores sem cor de alerta, tabelas
  sem negrito em tudo, "Sem horário" em vez de um 07:00–19:00 inventado e plantões mostrados de 50 em 50.

## V0.4.3 — 22/11/2026

- **Entrada:** os campos de usuário e senha ficam em branco. Saíram o exemplo "Ex: dr.carlos" e as bolinhas que
  pareciam uma senha já preenchida.

## V0.4.2 — 22/11/2026

- **Topo azul em todas as telas:** a faixa no azul da marca, que estava só na Minha Escala e no Painel, agora abre
  também Escalas, Mural de vagas, Corpo Clínico, Setores, Relatórios, Faturamento, Histórico, Configurações,
  Planejamento e Plataforma — com os botões principais dentro dela. Os títulos passam a ter o mesmo nome do menu
  (ex.: "Relatórios" em vez de "Central de Relatórios & BI Hospitalar", "Configurações" em vez de "Painel de
  Configurações", "Setores e especialidades" em vez de "Cadastro de Setor"). A Escalas ganhou topo, que antes não tinha.

## V0.4.1 — 22/11/2026

- **Acabamento visual em todas as telas:** a letra Inter passa a ser usada de fato (antes o app caía na fonte do
  sistema), títulos mais leves, sem palavras em maiúsculas espaçadas nem números em letra de máquina de escrever,
  sombras discretas e um só tom de fundo no tema escuro. Os topos escuros com degradê viraram cartões neutros com o
  mesmo tamanho de título em todas as telas; a cor fica para o que é status (vaga, alerta, pago). No menu, o item
  "Planejamento (temporário)" virou só "Planejamento".
- **Topo em destaque nas telas de entrada:** Minha Escala e Painel ganham uma faixa no azul da marca, com o símbolo da
  grade ao fundo. No Painel, o topo passa a ser a primeira coisa da tela.
- **Primeiros passos:** lista no Painel para o gestor de empresa nova — dados do hospital, setores, equipe (ou link de
  credenciamento), primeira escala e publicar. Cada passo se marca sozinho; a lista some quando tudo estiver feito ou
  quando o gestor fechar.
- **Abre mais rápido no celular:** cada tela é baixada só quando é aberta. A entrada caiu de 1,8 MB para cerca de
  700 KB; Relatórios e a planilha Excel só baixam quando alguém usa. React e Supabase ficam em arquivos separados, então
  numa versão nova o celular baixa só o que mudou. Se uma tela não for encontrada porque saiu versão nova com o app
  aberto, ele recarrega sozinho uma vez.

## V0.3.10 — 21/11/2026

- **Marca nova:** ícone "grade de plantões" (uma grade de escala 3×3 em que os dias do meio formam a cruz da saúde) e
  o nome Scale**Medic** com a nova letra, no ícone do app (celular e computador), na aba do navegador, na tela de
  entrada, no menu lateral, no topo do celular e no credenciamento. Quem já instalou o app no celular vê o ícone novo
  ao reinstalar (o Android costuma atualizar sozinho em alguns dias).
- **Planejamento:** entram "Confirmação em dois passos", "Domínio e e-mails" e as próximas etapas de aparência
  (acabamento visual, primeiros passos para empresa nova e abrir mais rápido no celular).

## V0.3.9 — 21/11/2026

- **Permissões por perfil também no banco:** antes, dentro da mesma empresa, qualquer pessoa logada conseguiria
  alterar dados chamando o banco por fora do app (a tela só escondia os botões). Agora o próprio banco garante:
  - **Gestor / coordenador / quem tem "pode editar":** tudo dentro da empresa, como antes.
  - **Faturamento:** também lança pagamentos, faturamento e produtividade.
  - **Profissional:** só o que é dele — assumir vaga sem ninguém (no próprio nome), pedir ou cancelar a liberação do
    próprio plantão no Mural, registrar entrada/saída, propor/aceitar/recusar/cancelar troca (aprovar, não), marcar a
    própria indisponibilidade e mandar notificações. Não cria nem apaga plantão, não mexe no plantão ou na ficha de
    outro, não muda o próprio valor ou setores, não publica escala nem marca pagamento.
  - **Notificações:** cada pessoa só lê as suas. **Histórico de alterações:** só a gestão.
- **Banco:** migração `20261121120000_role_based_rules.sql` (aplicada).

## V0.3.8 — 20/11/2026

- **Corpo Clínico › Recusar ficha:** fichas pendentes (do link de credenciamento) ganharam o botão "Recusar", que
  pede confirmação e **apaga a ficha** (LGPD: sem aprovação, não há motivo para guardar CPF e dados bancários).
  Profissional já aprovado não tem o botão; para ele continua "Desativar", que preserva o histórico.

## V0.3.7 — 20/11/2026

- **Especialidade / área de atuação com seletor novo:** no lugar da lista de sugestões do navegador, opções em botões
  (pílulas) **só da categoria escolhida**: enfermeiro vê só áreas de enfermagem, fisioterapeuta só de fisioterapia etc.
  Primeiro "Usadas em <hospital>" (os nomes que o hospital já usa nas vagas), depois as demais; busca quando a lista é
  grande e "Outra" para digitar. Nomes que não são área de saúde (ex.: "Administrativo") não aparecem, e variações do
  mesmo nome ("Cardiologista" × "Cardiologia") não se repetem. Trocar de categoria limpa a escolha anterior.
- **Banco:** migração `20261120210000_registration_specialties_by_category.sql` (aplicada).

## V0.3.6 — 20/11/2026

- **Código do hospital separado do link:** a Plataforma e Configurações › Equipe & Acessos mostram o **código** (com
  "Copiar código") e o **link** (com "Copiar link"). O link já abre o formulário com o hospital preenchido; o código é
  para quem abrir o formulário pela tela de entrada. Os dados copiados para enviar ao cliente trazem os dois.
- **Formulário aceita o link inteiro:** quem colar o link completo no campo "Código do hospital" também é reconhecido.

## V0.3.5 — 20/11/2026

- **Credenciamento novo, em 3 etapas** (Você · Registro profissional · Recebimento), com barra de progresso e erros
  mostrados no próprio campo. Chama-se agora "Credenciamento profissional" (vale para toda a equipe, não só médicos).
- **Muda conforme a categoria:** conselho certo (CRM, COREN, CREFITO, CRF, CRN, CRP, CRBM) com número e estado
  separados, RQE só para médico, CBO já preenchido.
- **Especialidade escolhida da lista:** primeiro as que o hospital já usa (as mesmas do Mural), depois as mais comuns
  da categoria. Assim o profissional passa a ver as vagas certas no Mural.
- **CPF, CNPJ e celular** com máscara e conferência dos dígitos; usuário de login sugerido pelo nome.
- **Recebimento:** "Pessoa física" ou "Pessoa jurídica" (CNPJ e razão social); a chave PIX já vem preenchida com o
  CPF/CNPJ. PF/PJ, CNPJ e razão social aparecem na ficha do Corpo Clínico para o RH conferir e editar.
- **LGPD:** aceite obrigatório antes de enviar, com data e hora gravadas na ficha.
- **Correção:** ficha que chega pelo link (ainda sem hospital definido) agora aparece na aba "Pendentes" do Corpo
  Clínico em qualquer hospital selecionado. Antes só aparecia na visão "Todas as unidades".
- **Banco:** migração `20261120190000_registration_form_v2.sql` (aplicada).

## V0.3.4 — 20/11/2026

- **Plataforma › Adicionar hospital:** cada empresa tem agora a lista de hospitais no próprio cartão e o botão
  "Adicionar hospital", para entregar uma rede já montada antes de o gestor entrar. O hospital novo já fica liberado
  para os gestores gerais da empresa (mesmo login). Nome repetido na mesma empresa é recusado.
- **Banco:** migração `20261120170000_platform_add_unit.sql` (aplicada).

## V0.3.3 — 20/11/2026

- **Empresa com mais de um hospital:** quando o gestor cadastra um novo hospital em Configurações › Gerenciar
  Hospitais, ele já fica liberado para os gestores gerais da empresa. Eles veem os dois no mesmo login (escolha na
  entrada, troca pelo seletor do topo e visão "Todas as unidades"), sem sair e entrar de novo. Antes, o gestor criado
  pela tela Plataforma só enxergava os hospitais que existiam quando foi criado.
- **Banco:** migração `20261120150000_new_unit_for_managers.sql` (aplicada).

## V0.3.2 — 20/11/2026

- **Pronto para vender a vários hospitais (mesmo banco, dados separados):** nova tela **Plataforma**, que só o dono
  do ScaleMedic vê. Nela ficam todas as empresas clientes com unidades, usuários, profissionais e plantões, e dá para:
  criar uma **empresa nova** já com a primeira unidade e o **primeiro gestor** (senha do 1º acesso = data de
  nascimento + inicial do nome, troca obrigatória), adicionar gestores e **redefinir a senha** de um gestor. A janela
  final traz os dados prontos para copiar e mandar ao cliente.
- **Link de credenciamento por empresa:** cada empresa tem o seu link (`/register?empresa=código`), que aparece na
  Plataforma e em Configurações › Equipe & Acessos. A ficha cai direto na aba "Pendentes" da empresa certa. Sem o link,
  o formulário pede o código do hospital. A ficha pública nunca traz permissões: entra sempre como plantonista pendente.
- **Correções para mais de uma empresa:** só um gestor da mesma empresa aprova troca de plantão; o aviso no celular só
  pode ser ativado em nome de quem está logado; o alerta automático de vaga urgente só vai para profissionais da
  empresa da vaga.
- **Banco:** migração `20261120120000_platform_multi_company.sql` (aplicada).

## V0.3.1 — 19/11/2026

- **Banco trancado (segurança):** até aqui, a chave de acesso que vai dentro do app permitia que qualquer pessoa
  que a copiasse do navegador lesse, alterasse ou apagasse dados direto no banco, sem passar pelo login. Agora o
  banco só responde para quem entrou no ScaleMedic com usuário e senha, e **cada empresa só enxerga os próprios
  dados**. Sem login, só funcionam a tela de entrada e o formulário "Solicite seu credenciamento" (que apenas
  cria uma ficha pendente).
- **Ninguém se promove sozinho:** quem não é gestor não consegue mudar o próprio perfil, as próprias permissões,
  unidades ou empresa, nem mesmo chamando o banco por fora do app. Senhas continuam guardadas só como hash.
- **Funções internas fechadas:** os alertas automáticos de plantão e a sincronização de contas só podem ser
  disparados pelo próprio banco.
- **Entrar de novo uma vez:** quem estava conectado numa versão antiga volta para a tela de login e entra com o
  mesmo usuário e senha. Se a sessão expirar com o app aberto, ele também volta ao login (antes ficaria com
  telas vazias).
- **Alerta do Supabase resolvido:** a tabela de especialidades estava sem proteção ("Table publicly accessible").
- **Banco:** migrações `20261119120000_specialties_rls.sql`, `20261119130000_company_rls_authenticated.sql` e
  `20261119140000_close_public_access.sql` (aplicadas).

## V0.2.10 — 23/10/2026

- **Login oficial do Supabase (fase 1):** cada usuário ganhou uma conta no sistema de login do próprio Supabase,
  com **a mesma senha de hoje** (ninguém precisa trocar nada). Ao entrar, o app abre também essa sessão oficial,
  que é o que vai permitir **trancar o banco** na próxima etapa (cada empresa só enxerga os próprios dados).
  Trocas de senha, e-mail, perfil e desativação de conta são copiadas para a conta oficial automaticamente.
- **Senha padrão do primeiro acesso:** todo novo cadastro no Corpo Clínico sem senha digitada recebe
  **data de nascimento completa + inicial do nome** (ex.: 12031995y), igual ao botão "Gerar senha padrão";
  o sistema obriga a troca no primeiro acesso.
- **Menu lateral:** o administrador aparece como "Gestor Geral" (antes aparecia "Profissional").
- **Banco:** migração `20261023120000_auth_accounts.sql` (aplicada).

## V0.2.9 — 21/10/2026

- **Alertas pelo servidor:** vaga urgente (menos de 24 h) e lembretes de plantão (12 h e 1 h antes, só escala
  publicada) agora são conferidos pelo próprio Supabase a cada 5 minutos (pg_cron), **mesmo com todo mundo
  deslogado**, e chegam no celular por push. Mesmas regras do app (unidade, setor, especialidade, férias, choque de
  horário) e o mesmo aviso nunca é enviado duas vezes.
- **Segurança do login:** removidos o login de emergência embutido no app ("admin" com 123456/admin) e a senha
  "123456" que valia para qualquer administrador no banco. A conta **admin** é um usuário normal, com senha própria
  guardada só como hash. Senhas provisórias de novos cadastros e convites passam a ser aleatórias (antes eram
  "123456" e "changeme123") e aparecem para o gestor ao salvar.
- **Banco:** migrações `20261021180000_server_shift_alerts.sql` e `20261021190000_remove_admin_master_password.sql`
  (aplicadas).

## V0.2.8 — 21/10/2026

- **Notificação push real:** toda notificação do sino (escala publicada, plantão alocado, vaga urgente,
  lembrete, trocas) também chega no celular **mesmo com o app fechado**, nos aparelhos em que a pessoa ativou os
  avisos (sino › "Ativar"). Tocar no aviso abre o app na tela certa. No iPhone, funciona com o app instalado na
  tela de início (iOS 16.4+); no Android e no computador, direto pelo navegador.
- Aparelho que desativa os avisos sai sozinho da lista; ao trocar de usuário no mesmo aparelho, os avisos passam
  a ser do novo usuário.
- **Supabase:** Edge Function `send-push` (chaves VAPID nos segredos da função) e migração
  `20261021150000_web_push.sql` (aplicada) — `push_subscriptions` e `app_private_config` sem acesso pelo app,
  funções `save_push_subscription`/`remove_push_subscription` e gatilho em `notifications` via `pg_net`.

## V0.2.7 — 21/10/2026

- **Ranking de confiabilidade (Relatórios › Confiabilidade, só gestão):** por profissional no período — plantões
  realizados, horas, vagas cobertas (vagas abertas ou repasses de colegas assumidos), repasses ao Mural, trocas
  diretas e o índice (plantões mantidos ÷ plantões que eram dele). Destaques de maior índice, mais vagas cobertas
  e mais repasses. Respeita período, setor e "Todas as unidades". Faltas e ponto não entram (ponto é opcional).
- **Segurança do login:** 5 senhas erradas seguidas bloqueiam o login por 15 minutos, com aviso na tela (vale
  também para quem não existe, para não revelar quais logins são válidos). Nova senha precisa ter 8+ caracteres,
  letras e números, e não pode conter o usuário/e-mail nem ser uma senha comum.
- **Banco:** migração `20261021120000_login_lockout.sql` (aplicada) — tabela `login_attempts` (sem acesso pelo
  app), `auth_fallback_login` com bloqueio e `login_lock_status`.

## V0.2.6 — 18/10/2026

- **"Todas as unidades" também no Corpo Clínico e nos Relatórios** (opção no seletor do topo). No Corpo
  Clínico aparece a equipe de todas as unidades administradas, cada profissional com as unidades dele. Nos
  Relatórios, indicadores, gráficos e exportações somam a rede, com o novo quadro **"Por unidade"** no Painel BI
  (plantões, cobertura, vagas, horas e custo de cada hospital). O custo de cada plantão segue a unidade dele;
  a folha de mensalistas sem plantão é calculada unidade por unidade.
- Escalas, Setores e Faturamento continuam por hospital (montagem, setores e fechamento são de um hospital).
- O nome mostrado no menu e no topo segue a escolha ("Todas as unidades" quando for o caso).
- Corpo Clínico: "Setores autorizados" passa a contar pela regra nova (setores vetados), incluindo setores
  criados depois do cadastro.

## V0.2.5 — 18/10/2026

- **Uma escolha de unidade para o sistema todo:** escolher um hospital nos cartões do Painel ou no seletor do
  topo vale em todas as telas (antes o Painel tinha uma escolha só dele). "Todas as unidades" vale nas telas
  que mostram tudo junto — Painel, Mural e Histórico (no Mural e no Histórico a opção fica no seletor do topo);
  as telas de um hospital por vez (Escalas, Faturamento, Setores, Relatórios, Configurações) seguem o último
  hospital escolhido, mostrado no topo. A escolha fica salva no aparelho e no cadastro do usuário.
- Saiu do Mural o botão "Esta unidade / Todas as unidades" (o seletor do topo faz isso) e do Histórico o
  filtro de unidade duplicado.

## V0.2.4 — 18/10/2026

- **Calendário da escala, novo visual:** cada dia mostra só o essencial — número (hoje em destaque), barra de
  cobertura (verde completo, laranja com vaga, vermelho furo), "preenchidos/total" e as iniciais de quem
  trabalha. Clicar no dia abre o **painel do dia** com os plantões por Manhã / Tarde / Noite, nomes completos,
  "Alocar" nas vagas, editar e "+ Plantão" já com a data. Em telas largas o painel fica ao lado; nas demais abre
  como gaveta (no celular, de baixo para cima). Arrastar profissional continua funcionando no dia e nas vagas.
- O calendário mostra o mês inteiro (dias passados esmaecidos); o filtro "a partir de" vale para a lista.

## V0.2.3 — 18/10/2026

- **Troca direta entre colegas:** em Mural › Meus plantões, "Propor troca" lista só os plantões de colegas
  que dá para trocar nos dois sentidos (especialidade, setor autorizado, unidade, sem choque de horário e sem
  férias). O colega aceita ou recusa pelo app; depois a coordenação aprova em Mural › Aprovações. A troca dos
  dois plantões acontece numa única operação no banco e só se a escala não mudou desde o pedido. Avisos no
  sino em cada etapa (inclusive para quem coordena a unidade); pedidos podem ser cancelados por quem propôs.
- **Meus ganhos do mês (Minha Escala):** já realizado, a realizar e total previsto no mês, por hospital, com a
  situação do pagamento (Pago / A receber / Previsto) e atalho para o espelho em PDF.
- "Meus plantões" no Mural mostra só plantões que ainda não começaram.
- Histórico de alterações inclui as trocas (filtro "Trocas").
- **Banco:** migração `20261019120000_direct_shift_swaps.sql` (aplicada) — colunas da troca direta, função
  `approve_shift_swap`, tempo real e histórico para `shift_swaps`.

## V0.2.2 — 18/10/2026

- **Acesso tela por tela (Corpo Clínico):** o perfil vira o ponto de partida e abaixo dele há a lista de
  todas as telas do menu para liberar ou bloquear uma a uma ("Liberar todas" / "Padrão do perfil"). A opção
  "Pode criar e alterar nas telas liberadas" dá os poderes de edição sem a pessoa ser Gestor — ex.: um
  administrativo com acesso a tudo. Cadastros antigos continuam seguindo o perfil até serem editados.
  O usuário logado é relido do banco ao abrir o app, então mudanças de acesso valem sem sair e entrar.
- **Montar mês seguinte (antes "Duplicar Mês"):** usa um mês como modelo, mantendo o dia da semana (ou o
  mesmo dia do mês). Quem ainda pode assumir continua no plantão; quem está de férias, em choque de horário,
  inativo ou sem autorização no setor vira vaga. Abre a mesma revisão do gerador — nada é gravado antes de
  "Salvar como rascunho" ou "Salvar e publicar".
- **Limite de carga horária:** aviso ao passar do máximo semanal (padrão 60 h) ou emendar plantões além do
  limite seguido (padrão 24 h) — na janela de alocação, ao arrastar e na revisão do gerador. O preenchimento
  automático não ultrapassa os limites. Limites ajustáveis em Configurações › Regras da escala.

## V0.2.1 — 18/10/2026

Primeira versão da série 0.2 (depois de V0.1.10, pela regra de numeração).

- **Painel do gestor sem controle duplicado:** os cartões de unidade viraram o filtro do próprio Painel
  ("Todas as unidades" ou um hospital) e o seletor do cabeçalho some nessa tela. Por padrão o Painel mostra
  todas as unidades juntas — profissionais, plantões do dia, vagas e custo — com o hospital ao lado do setor.
  Clicar numa vaga ou setor de outro hospital abre Escalas já na unidade certa.
- **Versão na tela de login**, logo abaixo da senha.
- **Agenda do celular:** botão "Adicionar à agenda" na Minha Escala baixa os próximos plantões (.ics,
  funciona no iPhone, Android e Outlook) com endereço e alarmes 12 h e 1 h antes — tocam mesmo com o app
  fechado. Cada plantão também tem o link "Google Agenda".
- **Lembrete no sino:** aviso nas últimas 12 h e na última hora antes do plantão (só escala publicada).
- **Histórico de alterações:** nova tela para o gestor com quem criou, alocou, trocou, liberou, excluiu,
  publicou ou marcou pagamento, e quando; filtros por período, tipo, unidade e busca. O registro é feito por
  gatilho no banco e o app não consegue apagá-lo.
- **Banco:** migração `20261018180000_audit_log.sql` (aplicada).

## V0.1.10 — 18/10/2026

- **Planejamento (temporário):** nova tela, só para gestor, com a lista das melhorias combinadas e o
  andamento de cada uma. Some quando terminarmos (ver `src/lib/roadmap.js`).
- **Visão de todas as unidades (gestor):** quadro "Suas unidades" no Painel (plantões hoje, vagas em 7 dias,
  urgentes e furos no mês, com "Abrir" para entrar na unidade) e opção "Todas as unidades" no Mural.
- **Alerta de furo iminente:** vaga sem ninguém a menos de 24 h ganha o selo "Urgente" no Mural, e os
  profissionais compatíveis, livres e disponíveis recebem um aviso no sino (um por vaga). Qualquer aparelho
  logado com o app aberto faz a conferência a cada 5 min.
- **Indisponibilidade e férias:** cartão "Minha disponibilidade" na Minha Escala. Quem marcou o dia aparece
  como indisponível na alocação, sai do preenchimento automático e não vê vagas desses dias no Mural; se o
  gestor escalar mesmo assim, o app pede confirmação.
- **Banco:** migração `20261018150000_notifications_dedupe_key.sql` (aplicada) — chave única por aviso.

## V0.1.9 — 18/10/2026

- **Várias unidades num único login (profissional):** Minha Escala, Mural e o sino mostram plantões e vagas
  de todas as unidades em que o profissional atua, sem trocar de unidade. Cada vaga indica o hospital; os
  cartões da Minha Escala mostram endereço e "Como chegar". O cabeçalho mostra "Todas as suas unidades";
  o seletor de unidade só aparece para ele na grade de Escalas. O gestor continua trocando de unidade.
- **Setores autorizados:** setor criado depois do cadastro já fica liberado para quem atende a unidade
  (o cadastro passa a guardar os setores *vetados*, `blocked_sectors`). Antes, setor novo — como a CTI 2 do
  Hospital Vida & Saúde Dois — não aparecia para ninguém na alocação. Os 8 cadastros existentes foram
  convertidos sem vetar nenhum setor. Ao liberar uma unidade no Corpo Clínico, os setores dela já vêm
  marcados, e a lista aparece agrupada por unidade.
- Regra centralizada em `src/lib/sectorAccess.js` (com testes).

## V0.1.8 — 18/10/2026

- **Correção em Setores & Especialidades:** salvar um setor dava "Could not find the 'status' column of
  'sectors'". A tabela guarda a situação na coluna `active` (sim/não); a tela agora grava ali, e o app
  traduz para Ativo/Inativo ao carregar. Nenhuma mudança no banco.

## V0.1.7 — 17/10/2026

- **Atualização automática:** quando alguém assume uma vaga, troca, aloca, publica ou marca pagamento,
  as telas abertas em outros computadores e celulares se atualizam sozinhas em poucos segundos (Supabase
  Realtime). Rajadas de mudanças viram no máximo uma recarga a cada 5 s. Como reserva, o app também
  recarrega a cada 30 s com a tela visível e ao voltar para a aba.
- **Banco:** migração `20261018120000_realtime_shifts.sql` (aplicada) inclui `shifts`, `published_schedules`
  e `payment_statuses` no Realtime. Nenhuma permissão nova.

## V0.1.6 — 17/10/2026

- **Faturamento › Produtividade diária:** o lançamento agora é do mês inteiro numa tela só. Lista os dias
  pendentes com os profissionais escalados em cada um; dá para preencher vários dias e salvar de uma vez.
  Campos em branco continuam pendentes. O botão mostra quantos dias faltam. O modelo Excel cobre todos os
  dias listados (com o rateio de cada dia), e a importação aceita o mês inteiro.
- **Mural (regra rígida de especialidade):** o plantonista vê por que as vagas não aparecem para ele (outra
  especialidade, setor não autorizado ou choque de horário). O botão "Assumir" também passa a exigir a
  especialidade da vaga, como o Mural já fazia.

## V0.1.5 — 17/10/2026

- **Montar escala (antigo Gerador de Grade Padrão):** agora é feito em etapas — grade → profissionais →
  salvar como rascunho ou salvar e publicar. Nada é gravado antes da última etapa. Voltar à grade mantém
  as escolhas. O preenchimento automático reparte os plantões entre os profissionais compatíveis, em vez
  de dar tudo ao primeiro da lista.
- **Especialidade:** o campo mostra sempre a lista completa (antes só aparecia depois de apagar o texto),
  com a opção "Outra (digitar)". Vale no gerador e no lançamento de plantão.
- **Calendário da escala:** uma linha por plantão (hora + nome curto); vagas agrupadas por horário;
  cor só para status (laranja = vaga, vermelho = vaga vencida, verde = em andamento); "+N outros" abre a
  lista daquele dia. Saíram o "Mapa de Vagas" e os blocos Manhã/Tarde/Noite de cada dia.
- **Mural de vagas:** o plantonista vê só as vagas que pode assumir (setor, especialidade e sem choque de
  horário em qualquer hospital). O gestor escolhe entre "Todas" e "Que eu posso assumir". Vagas agrupadas por
  dia, em linhas alinhadas (horário · setor · especialidade · ação). Cabeçalho e abas mais simples.
- **Notificações:** o plantonista não recebe aviso de vaga que choca com a escala dele; o gestor recebe aviso
  só das vagas das próximas 72 h (a lista completa continua no Painel e em Escalas).
- **Cores:** avisos de vagas e de setores em rascunho no topo de Escalas viraram cartões neutros, com a cor
  só no ícone e no marcador de status.

## V0.1.4 — 17/10/2026

Revisão de excesso de informação nas telas:

- **Painel Geral:** setores sem plantão no dia viram uma linha só; lista de setores em rascunho recolhida;
  menos animações piscando ao mesmo tempo; textos de alerta mais curtos.
- **Correções no Painel:** plantões do dia mostravam "Setor Geral" em vez do setor real; gráfico
  "Distribuição da carga horária 24h" aparecia vazio.
- **Escalas:** a lista abre a partir de hoje (antes começava no dia 1, cheia de furos já passados);
  alerta de vagas mostra 4 e expande sob demanda.
- **Mural:** plantonista vê primeiro "Compatíveis comigo" (setor e especialidade), com opção
  "Todas as vagas"; cartões de vaga mais compactos.
- **Faturamento:** configuração da produtividade recolhida em "Configurar"; aviso repetido removido.

## V0.1.3 — 17/10/2026

- **Correção — tela em branco após o login:** profissionais com permissões gravadas no
  formato antigo (ex.: `minha_escala`, `trocas_plantao`) caíam num redirecionamento
  infinito. O controle de acesso agora aceita os dois formatos e nunca redireciona para
  uma tela também bloqueada; sem nenhuma tela liberada, mostra aviso com botão Sair.
- **Plantonista entra direto em Minha Escala** (celular, app instalado e computador);
  gestores continuam entrando no Painel.
- **Telas de gestão** (Painel, Faturamento, Relatórios, Corpo Clínico, Setores,
  Configurações) fechadas para plantonistas, inclusive pelo endereço.
- **Menu e barra inferior** mostram só as telas liberadas; Minha Escala em primeiro.
- **Sair** também no topo do menu do celular, visível sem rolar.

## V0.1.2 — 17/10/2026

Primeira versão numerada. Reúne:

- **Consistência de dados:** regime de remuneração padrão unificado; plantões noturnos
  tratados corretamente (furo, conflito de horário); Minha Escala, Dashboard, Relatórios e
  Faturamento usando as mesmas regras de cálculo.
- **Banco:** unidades com UUID; escalas publicadas e status "PAGO" compartilhados entre
  gestores; tabela de notificações; senhas com hash bcrypt; senha de suporte 123456 válida
  só para administradores.
- **Notificações:** escala publicada, alocação em data publicada, troca aprovada/recusada,
  plantão assumido; vagas compatíveis com setor e especialidade; pedidos pendentes para gestores.
- **Celular:** aplicativo instalável (iPhone e Android) com ícone e guia de instalação,
  barra inferior, menu com perfil e "Sair", telas ajustadas ao celular.
- **Relatórios:** Painel BI de gestão com modo apresentação; custo de mensalista
  proporcional ao período; produtividade pelo rateio dos dias fechados.
- **Escalas:** conflito de horário entre hospitais, gerador e duplicação sem repetir vagas,
  publicação correta em períodos que atravessam meses.
- **Limpeza:** remoção do código legado do Base44 e de páginas sem uso.
