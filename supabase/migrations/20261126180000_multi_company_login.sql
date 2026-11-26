-- Um login para vários estabelecimentos (V0.8.1).
--
-- O cadastro do usuário continua com UMA empresa ativa (data.company_id): todas as regras por
-- empresa seguem iguais. As outras empresas a que ele tem acesso ficam em data.company_access,
-- cada uma com o próprio perfil (papel, hospitais liberados, telas...). Trocar de estabelecimento
-- guarda o perfil da empresa atual e ativa o da escolhida.
--
-- - O dono da plataforma entra em qualquer empresa.
-- - "Adicionar gestor" com um usuário que já existe dá acesso à nova empresa com a mesma senha.
-- - Só o banco (troca de empresa) ou o dono da plataforma mexem em data.company_access.
-- Pode rodar de novo sem erro.
begin;

-- Campos do cadastro que valem por empresa.
create or replace function public.sm_company_profile_keys()
returns text[]
language sql
immutable
as $$
  select array['app_role', 'screen_access', 'can_edit', 'permissions', 'allowed_unit_ids',
               'selected_unit_id', 'blocked_sectors', 'professional_id']
$$;

-- Empresas que o usuário logado pode abrir.
create or replace function public.my_companies()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  u public.users;
  v_current text;
  v_access jsonb;
begin
  select * into u from public.users
   where auth_user_id = auth.uid() and coalesce(data ->> 'is_active', 'true') <> 'false' limit 1;
  if u.id is null then
    return '[]'::jsonb;
  end if;
  v_current := coalesce(u.data ->> 'company_id', 'cmp_principal');
  v_access := case when jsonb_typeof(u.data -> 'company_access') = 'object' then u.data -> 'company_access' else '{}'::jsonb end;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'current', c.id = v_current) order by c.id <> v_current, c.name)
      from public.companies c
     where c.id = v_current or v_access ? c.id or public.sm_auth_is_platform_owner()
  ), '[]'::jsonb);
end;
$$;

-- Troca o estabelecimento ativo do usuário logado. Devolve o cadastro (data) já trocado.
create or replace function public.switch_company(p_company_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.users;
  v_current text;
  v_access jsonb;
  v_profile jsonb := '{}'::jsonb;
  v_data jsonb;
  v_units jsonb;
  k text;
begin
  select * into u from public.users
   where auth_user_id = auth.uid() and coalesce(data ->> 'is_active', 'true') <> 'false' limit 1;
  if u.id is null then
    raise exception 'Sessão inválida. Entre de novo.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.companies where id = p_company_id) then
    raise exception 'Estabelecimento não encontrado.';
  end if;
  v_current := coalesce(u.data ->> 'company_id', 'cmp_principal');
  if p_company_id = v_current then
    return u.data;
  end if;
  v_access := case when jsonb_typeof(u.data -> 'company_access') = 'object' then u.data -> 'company_access' else '{}'::jsonb end;
  if not (v_access ? p_company_id or public.sm_auth_is_platform_owner()) then
    raise exception 'Você não tem acesso a este estabelecimento.' using errcode = '42501';
  end if;

  -- Guarda o perfil da empresa que está saindo.
  foreach k in array public.sm_company_profile_keys() loop
    if u.data ? k then
      v_profile := v_profile || jsonb_build_object(k, u.data -> k);
    end if;
  end loop;
  v_access := v_access || jsonb_build_object(v_current, v_profile);

  -- Perfil da empresa escolhida (o dono entrando pela 1ª vez vira gestor dela).
  v_profile := case when jsonb_typeof(v_access -> p_company_id) = 'object' then v_access -> p_company_id
                    else jsonb_build_object('app_role', 'gestor') end;
  -- Gestor abre todos os hospitais do estabelecimento (inclusive os criados depois).
  if u.role = 'admin' or coalesce(v_profile ->> 'app_role', '') in ('gestor', 'manager') then
    select coalesce(jsonb_agg(id::text order by name), '[]'::jsonb) into v_units
      from public.units where company_id = p_company_id;
    v_profile := v_profile || jsonb_build_object('allowed_unit_ids', v_units);
    if not (v_units ? coalesce(v_profile ->> 'selected_unit_id', '')) then
      v_profile := v_profile || jsonb_build_object('selected_unit_id', v_units ->> 0);
    end if;
  end if;

  v_data := u.data;
  foreach k in array public.sm_company_profile_keys() loop
    v_data := v_data - k;
  end loop;
  v_data := v_data || v_profile
            || jsonb_build_object('company_id', p_company_id, 'company_access', v_access - p_company_id);

  perform set_config('sm.company_switch', 'on', true);
  update public.users set data = v_data where id = u.id;
  perform set_config('sm.company_switch', 'off', true);
  return v_data;
end;
$$;

-- company_access só muda pela troca acima ou pelo dono da plataforma; de resto, fica como estava.
create or replace function public.users_guard_company_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated'
     or current_setting('sm.company_switch', true) = 'on'
     or public.sm_auth_is_platform_owner() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.data := coalesce(new.data, '{}'::jsonb) - 'company_access';
  elsif (new.data -> 'company_access') is distinct from (old.data -> 'company_access') then
    new.data := case when old.data ? 'company_access'
                     then jsonb_set(coalesce(new.data, '{}'::jsonb), '{company_access}', old.data -> 'company_access')
                     else coalesce(new.data, '{}'::jsonb) - 'company_access' end;
  end if;
  return new;
end;
$$;

drop trigger if exists users_guard_company_access on public.users;
create trigger users_guard_company_access before insert or update on public.users
  for each row execute function public.users_guard_company_access();

-- A troca de empresa também vale para quem não é gestor (ex.: plantonista em duas empresas).
create or replace function public.users_guard_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
begin
  if coalesce(auth.role(), '') <> 'authenticated' or public.sm_auth_is_manager()
     or current_setting('sm.company_switch', true) = 'on' then
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

-- Painel do dono: gestores de cada empresa incluem quem entra nela pelo mesmo login.
create or replace function public.platform_companies()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.sm_auth_is_platform_owner() then
    raise exception 'Acesso restrito ao dono da plataforma.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'plan', c.plan,
      'created_date', c.created_date,
      'registration_code', c.registration_code,
      'units', (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name) order by u.name), '[]'::jsonb)
                  from public.units u where u.company_id = c.id),
      'users_count', (select count(*) from public.users u
                       where coalesce(u.data ->> 'company_id', 'cmp_principal') = c.id
                          or coalesce(u.data -> 'company_access', '{}'::jsonb) ? c.id),
      'professionals_count', (select count(*) from public.professionals p where p.company_id = c.id),
      'shifts_count', (select count(*) from public.shifts s where s.company_id = c.id),
      'managers', (select coalesce(jsonb_agg(jsonb_build_object(
                      'id', u.id, 'full_name', u.full_name, 'username', u.username, 'email', u.email,
                      'is_active', coalesce(u.data ->> 'is_active', 'true') <> 'false',
                      'must_change_password', coalesce(u.data ->> 'must_change_password', 'false') = 'true',
                      'shared_login', coalesce(u.data ->> 'company_id', 'cmp_principal') <> c.id
                    ) order by u.full_name), '[]'::jsonb)
                     from public.users u
                    where (coalesce(u.data ->> 'company_id', 'cmp_principal') = c.id
                           and (u.role = 'admin' or coalesce(u.data ->> 'app_role', '') in ('gestor', 'manager')))
                       or (coalesce(u.data -> 'company_access', '{}'::jsonb) ? c.id
                           and coalesce(u.data -> 'company_access' -> c.id ->> 'app_role', '') in ('gestor', 'manager')))
    ) order by c.created_date)
    from public.companies c
  ), '[]'::jsonb);
end;
$$;

-- Gestor de uma empresa. Se o usuário (ou e-mail) já existe em outra empresa:
-- sem p_link_existing, devolve {"exists": true, ...} para o app confirmar;
-- com p_link_existing, dá acesso à empresa com a mesma senha.
drop function if exists public.platform_create_manager(text, text, text, text, text);
create or replace function public.platform_create_manager(
  p_company_id text, p_full_name text, p_username text, p_email text, p_password text,
  p_link_existing boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := lower(regexp_replace(coalesce(p_username, ''), '[^a-zA-Z0-9.]', '', 'g'));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_units jsonb;
  v_id text;
  v_existing public.users;
  v_access jsonb;
begin
  if not public.sm_auth_is_platform_owner() then
    raise exception 'Acesso restrito ao dono da plataforma.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.companies where id = p_company_id) then
    raise exception 'Empresa não encontrada.';
  end if;
  if v_username = '' and v_email = '' then
    raise exception 'Informe o usuário do gestor.';
  end if;

  select * into v_existing from public.users
   where (v_username <> '' and lower(username) = v_username) or (v_email <> '' and lower(email) = v_email)
   order by (lower(username) = v_username) desc
   limit 1;

  select coalesce(jsonb_agg(u.id::text order by u.name), '[]'::jsonb) into v_units
    from public.units u where u.company_id = p_company_id;

  if v_existing.id is not null then
    v_access := case when jsonb_typeof(v_existing.data -> 'company_access') = 'object' then v_existing.data -> 'company_access' else '{}'::jsonb end;
    if coalesce(v_existing.data ->> 'company_id', 'cmp_principal') = p_company_id or v_access ? p_company_id then
      raise exception 'O usuário "%" já entra nesta empresa.', v_existing.username;
    end if;
    if not coalesce(p_link_existing, false) then
      return jsonb_build_object(
        'exists', true, 'id', v_existing.id, 'username', v_existing.username, 'full_name', v_existing.full_name,
        'company_name', (select name from public.companies where id = coalesce(v_existing.data ->> 'company_id', 'cmp_principal')));
    end if;
    v_access := v_access || jsonb_build_object(p_company_id, jsonb_build_object(
      'app_role', 'gestor', 'allowed_unit_ids', v_units, 'selected_unit_id', v_units ->> 0));
    update public.users set data = jsonb_set(data, '{company_access}', v_access) where id = v_existing.id;
    return jsonb_build_object('linked', true, 'id', v_existing.id, 'username', v_existing.username, 'email', v_existing.email);
  end if;

  if coalesce(trim(p_full_name), '') = '' or v_username = '' then
    raise exception 'Informe o nome e o usuário do gestor.';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'A senha do primeiro acesso precisa ter pelo menos 8 caracteres.';
  end if;
  if v_email = '' then
    v_email := v_username || '.' || extract(epoch from clock_timestamp())::bigint || '@scalemedic.local';
  end if;

  insert into public.users (username, email, full_name, role, password, data)
  values (v_username, v_email, trim(p_full_name), 'user', p_password, jsonb_build_object(
    'company_id', p_company_id,
    'app_role', 'gestor',
    'allowed_unit_ids', v_units,
    'selected_unit_id', v_units ->> 0,
    'must_change_password', true,
    'is_active', true
  ))
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'username', v_username, 'email', v_email);
end;
$$;

-- Tira o acesso de um usuário a uma empresa que não é a ativa dele.
create or replace function public.platform_remove_company_access(p_user_id text, p_company_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sm_auth_is_platform_owner() then
    raise exception 'Acesso restrito ao dono da plataforma.' using errcode = '42501';
  end if;
  if exists (select 1 from public.users where id = p_user_id and coalesce(data ->> 'company_id', 'cmp_principal') = p_company_id) then
    raise exception 'Esta é a empresa em que o usuário está agora. Peça para ele trocar de estabelecimento antes.';
  end if;
  update public.users set data = jsonb_set(data, '{company_access}', (data -> 'company_access') - p_company_id)
   where id = p_user_id and coalesce(data -> 'company_access', '{}'::jsonb) ? p_company_id;
  return found;
end;
$$;

revoke all on function public.my_companies() from public, anon;
revoke all on function public.switch_company(text) from public, anon;
revoke all on function public.platform_companies() from public, anon;
revoke all on function public.platform_create_manager(text, text, text, text, text, boolean) from public, anon;
revoke all on function public.platform_remove_company_access(text, text) from public, anon;
revoke all on function public.users_guard_company_access() from public, anon, authenticated;
grant execute on function public.my_companies() to authenticated;
grant execute on function public.switch_company(text) to authenticated;
grant execute on function public.platform_companies() to authenticated;
grant execute on function public.platform_create_manager(text, text, text, text, text, boolean) to authenticated;
grant execute on function public.platform_remove_company_access(text, text) to authenticated;

commit;

notify pgrst, 'reload schema';

-- Conferência: deve mostrar 4.
select count(*) as funcoes_novas from pg_proc
 where proname in ('my_companies', 'switch_company', 'platform_remove_company_access', 'users_guard_company_access');
