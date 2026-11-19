-- Fase 2 do login oficial, etapa 1 (V0.3.1): regras por empresa para quem entrou no ScaleMedic.
--
-- Quem tem a sessão oficial (papel "authenticated", aberta no login do app) passa a ver e
-- alterar só os dados da própria empresa. As regras antigas "libera tudo" ficam valendo só para
-- a chave pública (papel "anon"), para as versões antigas do app continuarem funcionando até a
-- etapa 3, que fecha o acesso público.
--
-- Também fecha:
-- - funções internas (alertas, sincronização de contas, gatilhos) que qualquer um podia chamar;
-- - escrita direta em users.password_hash / users.auth_user_id;
-- - autopromoção: quem não é gestor não muda o próprio perfil, permissões ou empresa.
begin;

-- Quem está chamando, pelo cadastro do app (fonte da verdade; o token pode estar desatualizado).
create or replace function public.sm_auth_company()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(u.data ->> 'company_id', 'cmp_principal')
    from public.users u
   where u.auth_user_id = auth.uid()
     and coalesce(u.data ->> 'is_active', 'true') <> 'false'
   limit 1
$$;

create or replace function public.sm_auth_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.id from public.users u where u.auth_user_id = auth.uid() limit 1
$$;

-- Mesma regra do app (isManagerUser em src/lib/accessControl.js).
create or replace function public.sm_auth_is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select u.role = 'admin'
        or coalesce(u.data ->> 'app_role', '') in ('gestor', 'manager', 'coordenador')
        or coalesce(u.data ->> 'can_edit', '') = 'true'
      from public.users u
     where u.auth_user_id = auth.uid()
       and coalesce(u.data ->> 'is_active', 'true') <> 'false'
     limit 1
  ), false)
$$;

revoke all on function public.sm_auth_company() from public, anon;
revoke all on function public.sm_auth_user_id() from public, anon;
revoke all on function public.sm_auth_is_manager() from public, anon;
grant execute on function public.sm_auth_company() to authenticated;
grant execute on function public.sm_auth_user_id() to authenticated;
grant execute on function public.sm_auth_is_manager() to authenticated;

-- Registro gravado sem empresa (algumas telas não mandam) fica com a empresa de quem gravou.
create or replace function public.sm_fill_company_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.company_id is null and coalesce(auth.role(), '') = 'authenticated' then
    new.company_id := public.sm_auth_company();
  end if;
  return new;
end;
$$;

-- Tabelas com company_id: acesso completo dentro da própria empresa.
do $$
declare t text;
begin
  foreach t in array array['billing_records', 'notifications', 'payment_statuses', 'professionals',
                           'published_schedules', 'sectors', 'shift_swaps', 'shifts', 'units'] loop
    execute format('alter policy %I on public.%I to anon', 'Allow app access ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'Allow auth full access ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'Company access ' || t, t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (company_id = (select public.sm_auth_company()))
         with check (company_id = (select public.sm_auth_company()))',
      'Company access ' || t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop trigger if exists sm_fill_company_id on public.%I', t);
    execute format('create trigger sm_fill_company_id before insert on public.%I
                      for each row execute function public.sm_fill_company_id()', t);
  end loop;
end $$;

-- Histórico de alterações: só leitura, da própria empresa.
alter policy "Allow app read audit_log" on public.audit_log to anon;
drop policy if exists "Company read audit_log" on public.audit_log;
create policy "Company read audit_log" on public.audit_log for select to authenticated
  using (company_id = (select public.sm_auth_company()));

-- Empresa: todos leem a sua; só gestor altera.
alter policy "Allow app access companies" on public.companies to anon;
drop policy if exists "Allow auth full access companies" on public.companies;
drop policy if exists "Company read companies" on public.companies;
drop policy if exists "Company managers write companies" on public.companies;
drop policy if exists "Company managers update companies" on public.companies;
create policy "Company read companies" on public.companies for select to authenticated
  using (id = (select public.sm_auth_company()));
create policy "Company managers write companies" on public.companies for insert to authenticated
  with check (id = (select public.sm_auth_company()) and (select public.sm_auth_is_manager()));
create policy "Company managers update companies" on public.companies for update to authenticated
  using (id = (select public.sm_auth_company()) and (select public.sm_auth_is_manager()))
  with check (id = (select public.sm_auth_company()) and (select public.sm_auth_is_manager()));

-- Usuários: todos leem os da empresa; cada um altera o próprio cadastro; gestor altera todos.
alter policy "Allow app access users" on public.users to anon;
drop policy if exists "Allow auth full access users" on public.users;
drop policy if exists "Company read users" on public.users;
drop policy if exists "Company managers insert users" on public.users;
drop policy if exists "Company update users" on public.users;
drop policy if exists "Company managers delete users" on public.users;
create policy "Company read users" on public.users for select to authenticated
  using (coalesce(data ->> 'company_id', 'cmp_principal') = (select public.sm_auth_company()));
create policy "Company managers insert users" on public.users for insert to authenticated
  with check (coalesce(data ->> 'company_id', 'cmp_principal') = (select public.sm_auth_company())
              and (select public.sm_auth_is_manager()));
create policy "Company update users" on public.users for update to authenticated
  using (coalesce(data ->> 'company_id', 'cmp_principal') = (select public.sm_auth_company())
         and (id = (select public.sm_auth_user_id()) or (select public.sm_auth_is_manager())))
  with check (coalesce(data ->> 'company_id', 'cmp_principal') = (select public.sm_auth_company()));
create policy "Company managers delete users" on public.users for delete to authenticated
  using (coalesce(data ->> 'company_id', 'cmp_principal') = (select public.sm_auth_company())
         and (select public.sm_auth_is_manager()));

-- Ninguém grava hash de senha ou vínculo da conta direto (o banco cuida disso por gatilho).
revoke insert, update, truncate on public.users from anon, authenticated;
grant insert (id, username, email, full_name, role, data, password, created_date, updated_date) on public.users to anon, authenticated;
grant update (id, username, email, full_name, role, data, password, created_date, updated_date) on public.users to anon, authenticated;
grant delete on public.users to authenticated;

-- Quem não é gestor não muda perfil, permissões, unidades liberadas ou empresa (nem os próprios).
create or replace function public.users_guard_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or public.sm_auth_is_manager() then
    return new;
  end if;
  if new.id is distinct from old.id or new.role is distinct from old.role then
    raise exception 'Somente gestores podem alterar perfil de acesso.' using errcode = '42501';
  end if;
  foreach k in array array['app_role', 'screen_access', 'can_edit', 'permissions', 'company_id',
                           'allowed_unit_ids', 'blocked_sectors', 'is_active'] loop
    if (new.data -> k) is distinct from (old.data -> k) then
      raise exception 'Somente gestores podem alterar permissões.' using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists users_guard_privileged_fields on public.users;
create trigger users_guard_privileged_fields before update on public.users
  for each row execute function public.users_guard_privileged_fields();

-- Funções internas: só o próprio banco (cron, gatilhos) chama.
revoke execute on function public.run_shift_alerts() from public, anon, authenticated;
revoke execute on function public.sync_auth_account(text) from public, anon, authenticated;
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (p.proname in ('users_hash_password', 'audit_log_capture', 'notifications_send_push',
                          'users_sync_auth', 'users_guard_privileged_fields')
            or p.proname like 'sm\_%' and p.proname not like 'sm\_auth\_%')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

commit;

notify pgrst, 'reload schema';
