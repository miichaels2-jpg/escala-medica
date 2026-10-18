# Histórico de versões — ScaleMedic

## Regra de numeração

- Cada entrega publicada em produção sobe o último número: V0.1.2 → V0.1.3 → … → V0.1.10.
- Depois de V0.1.10, a próxima é **V0.2.1** (o número do meio sobe e o último recomeça em 1),
  e assim por diante: V0.2.10 → V0.3.1.
- A versão fica no campo `version` do `package.json` (sem o "V") e aparece no app
  (menu lateral, menu do celular e tela de Login). A regra está em `src/lib/version.js`.
- Cada versão publicada recebe uma tag git `vX.Y.Z` e uma entrada neste arquivo.

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
