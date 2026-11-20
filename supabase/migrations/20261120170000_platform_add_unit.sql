-- Dono da plataforma cadastra hospitais (unidades) de qualquer empresa cliente (V0.3.4), para
-- entregar uma rede já montada antes de o gestor entrar. O gatilho units_grant_company_managers
-- libera o hospital novo para os gestores gerais da empresa.
begin;

create or replace function public.platform_add_unit(p_company_id text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  if not public.sm_auth_is_platform_owner() then
    raise exception 'Acesso restrito ao dono da plataforma.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.companies where id = p_company_id) then
    raise exception 'Empresa não encontrada.';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Informe o nome do hospital.';
  end if;
  if exists (select 1 from public.units where company_id = p_company_id and lower(trim(name)) = lower(trim(p_name))) then
    raise exception 'Esta empresa já tem um hospital chamado "%".', trim(p_name);
  end if;

  insert into public.units (id, company_id, legacy_id, name)
  values (v_id, p_company_id, v_id::text, trim(p_name));

  return jsonb_build_object('id', v_id, 'name', trim(p_name));
end;
$$;

revoke all on function public.platform_add_unit(text, text) from public, anon;
grant execute on function public.platform_add_unit(text, text) to authenticated;

commit;

notify pgrst, 'reload schema';
