-- Correção da transferência (V0.8.4): a ficha do profissional nem sempre aponta para o login pelo id
-- (há fichas com o código da conta oficial no user_id, ou sem user_id). O vínculo confiável é o nome
-- de usuário guardado na ficha (data.username). Agora:
-- - o login é achado pelo id, pela conta oficial, pelo vínculo no cadastro ou pelo nome de usuário;
-- - transferir de novo quem já está no destino libera o login dele lá (antes só pulava).
-- Depende de 20261126200000_platform_people.sql. Pode rodar de novo sem erro.
begin;

create or replace function public.sm_professional_login(p_prof public.professionals)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.id
    from public.users u
   where u.id = p_prof.user_id
      or u.auth_user_id::text = p_prof.user_id
      or u.data ->> 'professional_id' = p_prof.id
      or (coalesce(p_prof.data ->> 'username', '') <> '' and lower(u.username) = lower(p_prof.data ->> 'username'))
   order by (u.id = p_prof.user_id) desc, (u.auth_user_id::text = p_prof.user_id) desc, (u.data ->> 'professional_id' = p_prof.id) desc
   limit 1
$$;
revoke all on function public.sm_professional_login(public.professionals) from public, anon, authenticated;

-- Libera o login no estabelecimento de destino, ligado à ficha de lá (mesmo papel da origem).
create or replace function public.sm_link_login_to_company(p_user_id text, p_origin text, p_target text, p_prof_id text, p_unit_ids text[])
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.users;
  v_active text;
  v_access jsonb;
  v_role text;
  v_profile jsonb;
  v_data jsonb;
begin
  select * into u from public.users where id = p_user_id;
  if u.id is null then return false; end if;
  v_active := coalesce(u.data ->> 'company_id', 'cmp_principal');
  v_access := case when jsonb_typeof(u.data -> 'company_access') = 'object' then u.data -> 'company_access' else '{}'::jsonb end;
  v_role := case when v_active = p_origin then u.data ->> 'app_role' else v_access -> p_origin ->> 'app_role' end;
  v_profile := jsonb_build_object('app_role', coalesce(v_role, 'assistencial'), 'professional_id', p_prof_id,
                                  'allowed_unit_ids', to_jsonb(p_unit_ids), 'selected_unit_id', p_unit_ids[1]);
  if v_active = p_target then
    v_data := u.data || jsonb_build_object('professional_id', p_prof_id);
  else
    v_data := jsonb_set(u.data, '{company_access}', v_access || jsonb_build_object(p_target, coalesce(v_access -> p_target, '{}'::jsonb) || v_profile));
  end if;
  perform set_config('sm.company_switch', 'on', true);
  update public.users set data = v_data where id = u.id;
  perform set_config('sm.company_switch', 'off', true);
  update public.professionals set user_id = u.id where id = p_prof_id and user_id is distinct from u.id;
  return true;
end;
$$;
revoke all on function public.sm_link_login_to_company(text, text, text, text, text[]) from public, anon, authenticated;

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
        'has_login', public.sm_professional_login(p) is not null
      ) order by p.name)
        from public.professionals p
       where p.company_id = p_company_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.platform_transfer_professionals(
  p_professional_ids text[], p_target_company text, p_unit_ids text[], p_keep_origin boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.professionals;
  t public.professionals;
  u public.users;
  v_login text;
  v_new_id text;
  v_units jsonb;
  v_copied integer := 0;
  v_linked integer := 0;
  v_skipped jsonb := '[]'::jsonb;
  v_access jsonb;
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
    v_login := public.sm_professional_login(p);

    select * into t from public.professionals x where x.company_id = p_target_company and (
                 (v_login is not null and x.user_id = v_login)
              or (coalesce(p.data ->> 'username', '') <> '' and lower(x.data ->> 'username') = lower(p.data ->> 'username'))
              or (coalesce(regexp_replace(p.cpf, '\D', '', 'g'), '') <> '' and regexp_replace(coalesce(x.cpf, ''), '\D', '', 'g') = regexp_replace(p.cpf, '\D', '', 'g'))
              or (coalesce(trim(p.email), '') <> '' and lower(trim(x.email)) = lower(trim(p.email))))
      order by x.status = 'ativo' desc limit 1;

    if t.id is not null then
      -- Já tem ficha no destino: só libera o login lá, se ainda não estiver.
      if v_login is not null and public.sm_link_login_to_company(v_login, p.company_id, p_target_company, t.id, p_unit_ids) then
        v_linked := v_linked + 1;
      else
        v_skipped := v_skipped || jsonb_build_object('name', p.name, 'reason', 'já está no destino');
      end if;
      continue;
    end if;

    v_new_id := 'prof_' || gen_random_uuid()::text;
    insert into public.professionals
    select (jsonb_populate_record(null::public.professionals, to_jsonb(p) || jsonb_build_object(
      'id', v_new_id,
      'company_id', p_target_company,
      'unit_id', p_unit_ids[1],
      'unit_ids', v_units,
      'user_id', v_login,
      'default_sector_id', null,
      'created_date', now(),
      'updated_date', now(),
      'data', coalesce(p.data, '{}'::jsonb) || jsonb_build_object(
        'allowed_unit_ids', v_units, 'authorized_sectors', '[]'::jsonb, 'blocked_sectors', '[]'::jsonb,
        'main_sector', '', 'unit_rates', '{}'::jsonb, 'unit_monthly_salaries', '{}'::jsonb,
        'transferred_from', p.company_id)
    ))).*;
    v_copied := v_copied + 1;

    if v_login is not null then
      perform public.sm_link_login_to_company(v_login, p.company_id, p_target_company, v_new_id, p_unit_ids);
      if not coalesce(p_keep_origin, true) then
        select * into u from public.users where id = v_login;
        v_access := case when jsonb_typeof(u.data -> 'company_access') = 'object' then u.data -> 'company_access' else '{}'::jsonb end;
        if coalesce(u.data ->> 'company_id', 'cmp_principal') = p.company_id then
          -- Mover: o destino vira o estabelecimento em uso e a origem sai.
          v_profile := coalesce(v_access -> p_target_company, '{}'::jsonb);
          v_data := u.data;
          foreach k in array public.sm_company_profile_keys() loop
            v_data := v_data - k;
          end loop;
          v_data := v_data || v_profile || jsonb_build_object('company_id', p_target_company, 'company_access', (v_access - p_target_company) - p.company_id);
        else
          v_data := jsonb_set(u.data, '{company_access}', v_access - p.company_id);
        end if;
        perform set_config('sm.company_switch', 'on', true);
        update public.users set data = v_data where id = u.id;
        perform set_config('sm.company_switch', 'off', true);
      end if;
    end if;

    if not coalesce(p_keep_origin, true) then
      update public.professionals set status = 'inativo', data = coalesce(data, '{}'::jsonb) || jsonb_build_object('status', 'inativo')
       where id = p.id;
    end if;
  end loop;

  return jsonb_build_object('copied', v_copied, 'linked', v_linked, 'skipped', v_skipped);
end;
$$;

commit;

notify pgrst, 'reload schema';

-- Conferência: deve mostrar 2.
select count(*) as funcoes_novas from pg_proc
 where proname in ('sm_professional_login', 'sm_link_login_to_company');
