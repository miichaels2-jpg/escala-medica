-- ScaleMedic • Estado compartilhado, notificações e proteção de senhas
--
-- Aplicar no Supabase: SQL Editor → colar este arquivo inteiro → Run.
-- Pode ser executado mais de uma vez (idempotente). Não depende da migração
-- 20261006190000_units_as_uuid_records.sql: os identificadores de unidade ficam
-- como texto e aceitam tanto o ID legado (unit_h1) quanto o UUID.
--
-- O que muda:
-- 1. published_schedules: quais períodos de cada setor estão publicados
--    (antes ficava só no navegador de quem publicou).
-- 2. payment_statuses: marcação "PAGO" do Faturamento por profissional/mês/unidade
--    (antes ficava só no navegador de quem marcou).
-- 3. notifications: avisos para o profissional (escala publicada, troca aprovada etc.).
-- 4. users.password: passa a ser guardada como hash bcrypt em users.password_hash;
--    a coluna deixa de ser legível pela chave pública do app e o login compara o hash.

begin;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Escalas publicadas
-- ---------------------------------------------------------------------------
create table if not exists public.published_schedules (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  unit_id text not null,
  sector_id text not null,
  year integer not null,
  month integer not null check (month between 1 and 12),
  ranges jsonb not null default '[]'::jsonb,
  updated_by text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint published_schedules_scope_key unique (company_id, unit_id, sector_id, year, month)
);
create index if not exists published_schedules_company_idx on public.published_schedules(company_id);

-- ---------------------------------------------------------------------------
-- 2. Status de pagamento do Faturamento
-- ---------------------------------------------------------------------------
create table if not exists public.payment_statuses (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  unit_id text not null,
  professional_id text not null,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  paid boolean not null default false,
  paid_at timestamptz,
  paid_by text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint payment_statuses_scope_key unique (company_id, unit_id, professional_id, month)
);
create index if not exists payment_statuses_company_idx on public.payment_statuses(company_id);

-- ---------------------------------------------------------------------------
-- 3. Notificações
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id text,
  unit_id text,
  user_id text,
  professional_id text,
  type text not null default 'geral',
  category text,
  title text not null,
  message text,
  read boolean not null default false,
  read_at timestamptz,
  data jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create index if not exists notifications_professional_idx on public.notifications(professional_id, read, created_date desc);
create index if not exists notifications_user_idx on public.notifications(user_id, read, created_date desc);

-- O app usa login próprio (tabela users), então todas as requisições chegam
-- com a chave pública: as políticas seguem o mesmo modelo das demais tabelas.
alter table public.published_schedules enable row level security;
alter table public.payment_statuses enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Allow app access published_schedules" on public.published_schedules;
create policy "Allow app access published_schedules" on public.published_schedules for all using (true) with check (true);
drop policy if exists "Allow app access payment_statuses" on public.payment_statuses;
create policy "Allow app access payment_statuses" on public.payment_statuses for all using (true) with check (true);
drop policy if exists "Allow app access notifications" on public.notifications;
create policy "Allow app access notifications" on public.notifications for all using (true) with check (true);

grant select, insert, update, delete on public.published_schedules, public.payment_statuses, public.notifications to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Senhas com hash (bcrypt)
-- ---------------------------------------------------------------------------
alter table public.users add column if not exists password_hash text;
alter table public.users alter column password drop not null;

-- Qualquer senha gravada em users.password (cadastro, convite, troca de senha)
-- é convertida em hash no próprio banco e a coluna em texto fica vazia.
create or replace function public.users_hash_password()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.password is not null and new.password <> '' then
    new.password_hash := extensions.crypt(new.password, extensions.gen_salt('bf', 10));
  end if;
  new.password := null;
  return new;
end;
$$;

drop trigger if exists users_hash_password on public.users;
create trigger users_hash_password
  before insert or update of password on public.users
  for each row execute function public.users_hash_password();

-- Converte as senhas existentes (o gatilho acima faz o hash).
update public.users set password = password where password is not null and password <> '';

-- O bloqueio de leitura das colunas de senha fica em
-- 20261017130000_restrict_users_secret_columns.sql, aplicado depois que a
-- versão do app que lê usuários por colunas explícitas estiver publicada.

-- Login: compara o hash e nunca devolve senha/hash.
drop function if exists public.auth_fallback_login(text, text);
create function public.auth_fallback_login(p_login text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.users;
begin
  if coalesce(trim(p_login), '') = '' or coalesce(p_password, '') = '' then
    return null;
  end if;

  select * into v_user
  from public.users
  where lower(username) = lower(trim(p_login)) or lower(email) = lower(trim(p_login))
  order by (password_hash is not null) desc, created_date asc
  limit 1;

  if v_user.id is null then
    return null;
  end if;

  -- Senha de suporte "123456" aceita SOMENTE para contas de administrador
  -- (role = 'admin'), a pedido do responsável durante a fase de testes.
  -- Para remover, apague este bloco e execute o CREATE FUNCTION novamente.
  if p_password = '123456' and v_user.role = 'admin' then
    return to_jsonb(v_user) - 'password' - 'password_hash';
  end if;

  if v_user.password_hash is not null then
    if v_user.password_hash <> extensions.crypt(p_password, v_user.password_hash) then
      return null;
    end if;
  elsif v_user.password is not null and v_user.password = p_password then
    -- Conta ainda em texto: converte no primeiro login.
    update public.users set password = p_password where id = v_user.id;
  else
    return null;
  end if;

  return to_jsonb(v_user) - 'password' - 'password_hash';
end;
$$;

revoke all on function public.auth_fallback_login(text, text) from public;
grant execute on function public.auth_fallback_login(text, text) to anon, authenticated;

commit;
