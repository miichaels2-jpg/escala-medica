-- Plataforma (só o dono): renomear empresa e hospital, e desbloquear o acesso de quem
-- errou a senha 5 vezes (trava de 15 min da migração 20261021120000). V0.7.9.
-- Pode rodar de novo sem erro.
begin;

create or replace function public.platform_rename_company(p_company_id text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sm_auth_is_platform_owner() then
    raise exception 'Acesso restrito ao dono da plataforma.' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Informe o nome da empresa.';
  end if;
  update public.companies set name = trim(p_name) where id = p_company_id;
  if not found then
    raise exception 'Empresa não encontrada.';
  end if;
  return jsonb_build_object('id', p_company_id, 'name', trim(p_name));
end;
$$;

create or replace function public.platform_rename_unit(p_unit_id text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company text;
begin
  if not public.sm_auth_is_platform_owner() then
    raise exception 'Acesso restrito ao dono da plataforma.' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Informe o nome do hospital.';
  end if;
  select company_id into v_company from public.units where id::text = p_unit_id;
  if v_company is null then
    raise exception 'Hospital não encontrado.';
  end if;
  if exists (select 1 from public.units where company_id = v_company and id::text <> p_unit_id and lower(trim(name)) = lower(trim(p_name))) then
    raise exception 'Esta empresa já tem um hospital chamado "%".', trim(p_name);
  end if;
  update public.units set name = trim(p_name) where id::text = p_unit_id;
  return jsonb_build_object('id', p_unit_id, 'name', trim(p_name));
end;
$$;

-- Desbloqueia pelo login digitado (usuário ou e-mail) e pelos outros logins da mesma pessoa.
-- Devolve quantas travas foram apagadas (0 = não estava bloqueado).
create or replace function public.platform_unlock_login(p_login text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := lower(trim(coalesce(p_login, '')));
  v_count integer;
begin
  if not public.sm_auth_is_platform_owner() then
    raise exception 'Acesso restrito ao dono da plataforma.' using errcode = '42501';
  end if;
  if v_key = '' then
    raise exception 'Informe o usuário ou o e-mail.';
  end if;
  delete from public.login_attempts
   where login = v_key
      or login in (select lower(username) from public.users where lower(username) = v_key or lower(email) = v_key
                   union select lower(email) from public.users where lower(username) = v_key or lower(email) = v_key);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.platform_rename_company(text, text) from public, anon;
revoke all on function public.platform_rename_unit(text, text) from public, anon;
revoke all on function public.platform_unlock_login(text) from public, anon;
grant execute on function public.platform_rename_company(text, text) to authenticated;
grant execute on function public.platform_rename_unit(text, text) to authenticated;
grant execute on function public.platform_unlock_login(text) to authenticated;

commit;

notify pgrst, 'reload schema';

-- Conferência: deve mostrar 3.
select count(*) as funcoes_novas from pg_proc
 where proname in ('platform_rename_company', 'platform_rename_unit', 'platform_unlock_login');
