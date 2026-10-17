# Histórico de versões — ScaleMedic

## Regra de numeração

- Cada entrega publicada em produção sobe o último número: V0.1.2 → V0.1.3 → … → V0.1.10.
- Depois de V0.1.10, a próxima é **V0.2.1** (o número do meio sobe e o último recomeça em 1),
  e assim por diante: V0.2.10 → V0.3.1.
- A versão fica no campo `version` do `package.json` (sem o "V") e aparece no app
  (menu lateral, menu do celular e tela de Login). A regra está em `src/lib/version.js`.
- Cada versão publicada recebe uma tag git `vX.Y.Z` e uma entrada neste arquivo.

## V0.1.3 — 17/10/2026

- **Correção — tela em branco após o login:** profissionais com permissões gravadas no
  formato antigo (ex.: , ) caíam num redirecionamento
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
