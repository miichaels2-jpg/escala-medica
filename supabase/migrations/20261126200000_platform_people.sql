-- Plataforma › Pessoas e acessos (V0.8.3, só o dono da plataforma):
-- - ver quem entra em cada estabelecimento e com qual papel; trocar o papel ou tirar o acesso;
-- - transferir (copiar ou mover) profissionais para outro estabelecimento, escolhendo os hospitais.
--   Quem tem login continua com a mesma senha e passa a abrir o novo estabelecimento.
-- Depende da migração 20261126180000_multi_company_login.sql. Pode rodar de novo sem erro.
begin;

-- Logins e profissionais de um estabelecimento.
create or replace function public.platform_company_people(p_company_id text)
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
  return jsonb_build_object(
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id, 'full_name', u.full_name, 'username', u.username,
        'is_admin', u.role = 'admin',
        'active_here', coalesce(u.data ->> 'company_id', 'cmp_principal') = p_company_id,
        'role', case when coalesce(u.data ->> 'company_id', 'cmp_principal') = p_company_id
                     then coalesce(u.data ->> 'app_role', case when u.role = 'admin' then 'gestor' else 'assistencial' end)
                     else coalesce(u.data -> 'company_access' -> p_company_id ->> 'app_role', 'assistencial') end,
        'companies', 1 + (select count(*) from jsonb_object_keys(case when jsonb_typeof(u.data -> 'company_access') = 'object' then u.data -> 'company_access' else '{}'::jsonb end))
      ) order by u.full_name)
        from public.users u
       where coalesce(u.data ->> 'company_id', 'cmp_principal') = p_company_id
          or coalesce(u.data -> 'company_access', '{}'::jsonb) ? p_company_id
    ), '[]'::jsonb),
    'professionals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'specialty', p.specialty, 'status', p.status,
        'has_login', exists (select 1 from public.users u where u.id = p.user_id or u.data ->> 'professional_id' = p.id)
      ) order by p.name)
        from public.professionals p
       where p.company_id = p_company_id
    ), '[]'::jsonb)
  );
end;
$$;

-- Papel de um login num estabelecimento: gestor, coordenador, faturamento, assistencial ou 'remover'.
create or replace function public.platform_set_company_role(p_user_id text, p_company_id text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.users;
  v_access jsonb;
  v_active text;
  v_data jsonb;
  v_next text;
  v_profile jsonb;
  v_units jsonb;
  k text;
begin
  if not public.sm_auth_is_platform_owner() then
    raise exception 'Acesso restrito ao dono da plataforma.' using errcode = '42501';
  end if;
  if p_role not in ('gestor', 'coordenador', 'faturamento', 'assistencial', 'remover') then
    raise exception 'Papel inválido.';
  end if;
  select * into u from public.users where id = p_user_id;
  if u.id is null then
    raise exception 'Usuário não encontrado.';
  end if;
  if u.role = 'admin' then
    raise exception 'O administrador geral não muda por aqui.';
  end if;
  v_active := coalesce(u.data ->> 'company_id', 'cmp_principal');
  v_access := case when jsonb_typeof(u.data -> 'company_access') = 'object' then u.data -> 'company_access' else '{}'::jsonb end;
  if v_active <> p_company_id and not v_access ? p_company_id then
    raise exception 'Este login não entra neste estabelecimento.';
  end if;
  select coalesce(jsonb_agg(id::text order by name), '[]'::jsonb) into v_units from public.units where company_id = p_company_id;

  if v_active <> p_company_id then
    -- Estabelecimento guardado (não é o que ele está usando agora).
    if p_role = 'remover' then
      v_data := jsonb_set(u.data, '{company_access}', v_access - p_company_id);
    else
      v_profile := (v_access -> p_company_id) - 'screen_access' - 'can_edit' - 'permissions' || jsonb_build_object('app_role', p_role);
      if p_role = 'gestor' then v_profile := v_profile || jsonb_build_object('allowed_unit_ids', v_units); end if;
      v_data := jsonb_set(u.data, '{company_access}', v_access || jsonb_build_object(p_company_id, v_profile));
    end if;
  elsif p_role <> 'remover' then
    -- Estabelecimento em uso: muda o papel no próprio cadastro (telas extras voltam ao padrão do papel).
    v_data := (u.data - 'screen_access' - 'can_edit' - 'permissions') || jsonb_build_object('app_role', p_role);
    if p_role = 'gestor' then v_data := v_data || jsonb_build_object('allowed_unit_ids', v_units); end if;
  else
    -- Tirar o acesso do estabelecimento em uso: passa a usar outro que ele tenha.
    select key into v_next from jsonb_object_keys(v_access) as t(key) order by key limit 1;
    if v_next is null then
      raise exception 'É o único estabelecimento deste login. Para tirar o acesso, desative o usuário em Configurações do estabelecimento.';
    end if;
    v_profile := case when jsonb_typeof(v_access -> v_next) = 'object' then v_access -> v_next else '{}'::jsonb end;
    v_data := u.data;
    foreach k in array public.sm_company_profile_keys() loop
      v_data := v_data - k;
    end loop;
    v_data := v_data || v_profile || jsonb_build_object('company_id', v_next, 'company_access', v_access - v_next);
  end if;

  perform set_config('sm.company_switch', 'on', true);
  update public.users set data = v_data where id = u.id;
  perform set_config('sm.company_switch', 'off', true);
  return jsonb_build_object('id', u.id, 'company_id', p_company_id, 'role', p_role);
end;
$$;

-- Copia (ou move) profissionais para outro estabelecimento, liberados nos hospitais escolhidos.
-- A ficha nova começa sem setores e sem valores por hospital (a gestão ajusta no Corpo Clínico).
create or replace function public.platform_transfer_professionals(
  p_professional_ids text[], p_target_company text, p_unit_ids text[], p_keep_origin boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.professionals;
  u public.users;
  v_new_id text;
  v_units jsonb;
  v_copied integer := 0;
  v_skipped jsonb := '[]'::jsonb;
  v_access jsonb;
  v_active text;
  v_role text;
  v_profile jsonb;
  v_data jsonb;
  k text;
begin
  if not public.sm_auth_is_platform_owner() then
    raise exception 'Acesso restrito ao dono da plataforma.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.companies where id = p_target_company) then
    raise exception 'Estabelecimento de destino não encontrado.';
  end if;
  if coalesce(array_length(p_unit_ids, 1), 0) = 0 then
    raise exception 'Escolha pelo menos um hospital do destino.';
  end if;
  if exists (select 1 from unnest(p_unit_ids) x where not exists (select 1 from public.units where id::text = x and company_id = p_target_company)) then
    raise exception 'Algum hospital escolhido não é do estabelecimento de destino.';
  end if;
  v_units := to_jsonb(p_unit_ids);

  for p in select * from public.professionals where id = any (p_professional_ids) loop
    if p.company_id = p_target_company then
      v_skipped := v_skipped || jsonb_build_object('name', p.name, 'reason', 'já é deste estabelecimento');
      continue;
    end if;
    if exists (select 1 from public.professionals t where t.company_id = p_target_company and (
                 (p.user_id is not null and t.user_id = p.user_id)
              or (coalesce(regexp_replace(p.cpf, '\D', '', 'g'), '') <> '' and regexp_replace(coalesce(t.cpf, ''), '\D', '', 'g') = regexp_replace(p.cpf, '\D', '', 'g'))
              or (coalesce(trim(p.email), '') <> '' and lower(trim(t.email)) = lower(trim(p.email))))) then
      v_skipped := v_skipped || jsonb_build_object('name', p.name, 'reason', 'já está no destino');
      continue;
    end if;

    v_new_id := 'prof_' || gen_random_uuid()::text;
    insert into public.professionals
    select (jsonb_populate_record(null::public.professionals, to_jsonb(p) || jsonb_build_object(
      'id', v_new_id,
      'company_id', p_target_company,
      'unit_id', p_unit_ids[1],
      'unit_ids', v_units,
      'default_sector_id', null,
      'created_date', now(),
      'updated_date', now(),
      'data', coalesce(p.data, '{}'::jsonb) || jsonb_build_object(
        'allowed_unit_ids', v_units, 'authorized_sectors', '[]'::jsonb, 'blocked_sectors', '[]'::jsonb,
        'main_sector', '', 'unit_rates', '{}'::jsonb, 'unit_monthly_salaries', '{}'::jsonb,
        'transferred_from', p.company_id)
    ))).*;
    v_copied := v_copied + 1;

    -- Login da pessoa: passa a abrir o destino com a ficha nova (mesma senha).
    select * into u from public.users where id = p.user_id or data ->> 'professional_id' = p.id order by (id = p.user_id) desc limit 1;
    if u.id is not null then
      v_active := coalesce(u.data ->> 'company_id', 'cmp_principal');
      v_access := case when jsonb_typeof(u.data -> 'company_access') = 'object' then u.data -> 'company_access' else '{}'::jsonb end;
      v_role := case when v_active = p.company_id then u.data ->> 'app_role' else v_access -> p.company_id ->> 'app_role' end;
      v_profile := jsonb_build_object('app_role', coalesce(v_role, 'assistencial'), 'professional_id', v_new_id,
                                      'allowed_unit_ids', v_units, 'selected_unit_id', p_unit_ids[1]);
      if v_active = p_target_company then
        v_data := u.data || v_profile;
      else
        v_access := v_access || jsonb_build_object(p_target_company, coalesce(v_access -> p_target_company, '{}'::jsonb) || v_profile);
        v_data := jsonb_set(u.data, '{company_access}', v_access);
      end if;
      if not coalesce(p_keep_origin, true) then
        if coalesce(v_data ->> 'company_id', 'cmp_principal') = p.company_id then
          -- Mover: o destino vira o estabelecimento em uso e a origem sai.
          v_profile := v_access -> p_target_company;
          foreach k in array public.sm_company_profile_keys() loop
            v_data := v_data - k;
          end loop;
          v_data := v_data || v_profile || jsonb_build_object('company_id', p_target_company, 'company_access', (v_access - p_target_company) - p.company_id);
        else
          v_data := jsonb_set(v_data, '{company_access}', (v_data -> 'company_access') - p.company_id);
        end if;
      end if;
      perform set_config('sm.company_switch', 'on', true);
      update public.users set data = v_data where id = u.id;
      perform set_config('sm.company_switch', 'off', true);
      update public.professionals set user_id = u.id where id = v_new_id;
    end if;

    if not coalesce(p_keep_origin, true) then
      update public.professionals set status = 'inativo', data = coalesce(data, '{}'::jsonb) || jsonb_build_object('status', 'inativo')
       where id = p.id;
    end if;
  end loop;

  return jsonb_build_object('copied', v_copied, 'skipped', v_skipped);
end;
$$;

revoke all on function public.platform_company_people(text) from public, anon;
revoke all on function public.platform_set_company_role(text, text, text) from public, anon;
revoke all on function public.platform_transfer_professionals(text[], text, text[], boolean) from public, anon;
grant execute on function public.platform_company_people(text) to authenticated;
grant execute on function public.platform_set_company_role(text, text, text) to authenticated;
grant execute on function public.platform_transfer_professionals(text[], text, text[], boolean) to authenticated;

commit;

notify pgrst, 'reload schema';

-- Conferência: deve mostrar 3.
select count(*) as funcoes_novas from pg_proc
 where proname in ('platform_company_people', 'platform_set_company_role', 'platform_transfer_professionals');
