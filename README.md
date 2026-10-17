# ScaleMedic

Gestão de escalas médicas: plantões, mural de trocas, corpo clínico, faturamento,
relatórios/BI e aplicativo instalável no celular (PWA).

Stack: React 18 + Vite + Tailwind, dados no Supabase, publicação na Vercel.

## Rodar localmente

```bash
npm install
npm run dev
```

Crie um arquivo `.env` (não versionado) com:

```
VITE_SUPABASE_URL=https://<projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<chave pública (publishable/anon)>
```

Atenção: o `.env` aponta para o banco real. O que for salvo pelo app local vai para produção.

## Verificações antes de publicar

```bash
npm run lint
node --test tests/*.test.js
npm run build
```

## Banco de dados (Supabase)

As migrações ficam em `supabase/migrations/` e são aplicadas pelo SQL Editor do
Supabase, na ordem do nome do arquivo:

| Arquivo | O que faz | Situação |
| --- | --- | --- |
| `20261006190000_units_as_uuid_records.sql` | Unidades (hospitais) em tabela própria com UUID | Aplicada em 17/10/2026 |
| `20261017120000_shared_state_notifications_password_hash.sql` | Escalas publicadas e status de pagamento no banco, notificações, senhas com hash bcrypt e login sem senha mestra | Aplicada em 17/10/2026 |
| `20261017130000_restrict_users_secret_columns.sql` | Impede a chave pública de ler senha/hash | **Aplicar depois de publicar esta versão do app** |

## Login

O app usa login próprio (tabela `users` + função `auth_fallback_login`), não o Supabase Auth.
Senhas ficam como hash bcrypt (`users.password_hash`); qualquer senha gravada em
`users.password` é convertida automaticamente por um gatilho do banco.

## Aplicativo no celular

`public/manifest.webmanifest`, `public/sw.js` e `public/icons/` tornam o sistema instalável.
O guia de instalação (iPhone e Android) aparece no Login, no menu do celular e numa faixa
após o login. A instalação exige HTTPS (a Vercel já fornece).
