-- Login oficial do Supabase, fase 1 (V0.2.10).
-- Cada usuário do ScaleMedic (public.users) ganha uma conta no Supabase Auth com a
-- MESMA senha (o hash bcrypt já existente é copiado; ninguém troca de senha). Daqui
-- em diante, mudanças de senha/e-mail/perfil em public.users são copiadas para a
-- conta oficial por gatilho. O app passa a abrir uma sessão oficial no login; o
-- banco ainda NÃO exige essa sessão (isso é a fase 2, depois de testar tudo).
begin;

alter table public.users add column if not exists auth_user_id uuid unique;

create or replace function public.sync_auth_account(p_user_id text)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  u public.users;
  v_auth uuid;
  v_email text;
  v_meta jsonb;
begin
  select * into u from public.users where id = p_user_id;
  if u.id is null then return null; end if;
  v_email := lower(trim(coalesce(u.email, '')));
  if v_email = '' or u.password_hash is null then return null; end if;

  v_meta := jsonb_build_object(
    'provider', 'email',
    'providers', jsonb_build_array('email'),
    'app_user_id', u.id,
    'company_id', coalesce(u.data ->> 'company_id', 'cmp_principal'),
    'app_role', coalesce(u.data ->> 'app_role', case when u.role = 'admin' then 'gestor' else 'assistencial' end),
    'role', coalesce(u.role, 'user')
  );

  v_auth := u.auth_user_id;
  if v_auth is null or not exists (select 1 from auth.users where id = v_auth) then
    select id into v_auth from auth.users where lower(email) = v_email limit 1;
  end if;

  if v_auth is null then
    v_auth := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token,
      is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000', v_auth, 'authenticated', 'authenticated', v_email, u.password_hash, now(),
      v_meta, jsonb_build_object('full_name', coalesce(u.full_name, '')), now(), now(),
      '', '', '', '', '', '', '', '', false, false
    );
  else
    update auth.users set
      email = v_email,
      encrypted_password = u.password_hash,
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || v_meta,
      banned_until = case when coalesce(u.data ->> 'is_active', 'true') = 'false' then 'infinity'::timestamptz else null end,
      updated_at = now()
    where id = v_auth;
  end if;

  if not exists (select 1 from auth.identities where user_id = v_auth and provider = 'email') then
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_auth::text, v_auth, jsonb_build_object('sub', v_auth::text, 'email', v_email, 'email_verified', true), 'email', null, now(), now());
  else
    update auth.identities
       set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', v_email, 'email_verified', true), updated_at = now()
     where user_id = v_auth and provider = 'email';
  end if;

  if u.auth_user_id is distinct from v_auth then
    update public.users set auth_user_id = v_auth where id = u.id;
  end if;
  return v_auth;
end;
$$;

revoke all on function public.sync_auth_account(text) from anon, authenticated;

-- Mantém a conta oficial igual ao cadastro do app.
create or replace function public.users_sync_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.auth_user_id is not null then
      delete from auth.users where id = old.auth_user_id;
    end if;
    return old;
  end if;
  if tg_op = 'INSERT'
     or new.password_hash is distinct from old.password_hash
     or new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.data is distinct from old.data then
    perform public.sync_auth_account(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists users_sync_auth on public.users;
create trigger users_sync_auth after insert or update or delete on public.users
  for each row execute function public.users_sync_auth();

-- Contas para os usuários que já existem.
do $$
declare r record;
begin
  for r in select id from public.users loop
    perform public.sync_auth_account(r.id);
  end loop;
end $$;

commit;
