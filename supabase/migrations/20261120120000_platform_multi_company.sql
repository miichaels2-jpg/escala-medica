-- Várias empresas no mesmo banco (V0.3.2).
--
-- - Dono da plataforma (Michael): cria empresas, o primeiro gestor de cada uma e redefine senhas
--   de gestores. Fica numa tabela que o app não consegue alterar; as ações passam por funções.
-- - Link de credenciamento por empresa (companies.registration_code): o formulário público só
--   envia ficha pelo código da empresa e não grava mais direto em professionals.
-- - Correções para mais de uma empresa: aprovação de troca só por gestor da mesma empresa; aviso
--   no celular só em nome de quem está logado; alertas de vaga urgente só para profissionais da
--   empresa da vaga.
begin;

-- Dono da plataforma ---------------------------------------------------------------------------
create table if not exists public.platform_owners (
  auth_user_id uuid primary key,
  note text,
  created_at timestamptz not null default now()
);
alter table public.platform_owners enable row level security;
revoke all on public.platform_owners from anon, authenticated;

insert into public.platform_owners (auth_user_id, note)
select auth_user_id, 'Conta admin do Michael (dono do ScaleMedic)'
  from public.users where id = 'usr_admin' and auth_user_id is not null
on conflict do nothing;

create or replace function public.sm_auth_is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_owners where auth_user_id = auth.uid())
$$;
revoke all on function public.sm_auth_is_platform_owner() from public, anon;
grant execute on function public.sm_auth_is_platform_owner() to authenticated;

-- Código do link de credenciamento --------------------------------------------------------------
alter table public.companies add column if not exists registration_code text;
update public.companies
   set registration_code = lower(substr(md5(random()::text || id), 1, 8))
 where registration_code is null;
alter table public.companies alter column registration_code set default lower(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
create unique index if not exists companies_registration_code_key on public.companies (registration_code);

-- Painel do dono -------------------------------------------------------------------------------
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
      'users_count', (select count(*) from public.users u where coalesce(u.data ->> 'company_id', 'cmp_principal') = c.id),
      'professionals_count', (select count(*) from public.professionals p where p.company_id = c.id),
      'shifts_count', (select count(*) from public.shifts s where s.company_id = c.id),
      'managers', (select coalesce(jsonb_agg(jsonb_build_object(
                      'id', u.id, 'full_name', u.full_name, 'username', u.username, 'email', u.email,
                      'is_active', coalesce(u.data ->> 'is_active', 'true') <> 'false',
                      'must_change_password', coalesce(u.data ->> 'must_change_password', 'false') = 'true'
                    ) order by u.full_name), '[]'::jsonb)
                     from public.users u
                    where coalesce(u.data ->> 'company_id', 'cmp_principal') = c.id
                      and (u.role = 'admin' or coalesce(u.data ->> 'app_role', '') in ('gestor', 'manager')))
    ) order by c.created_date)
    from public.companies c
  ), '[]'::jsonb);
end;
$$;

create or replace function public.platform_create_company(p_name text, p_unit_name text, p_plan text default 'trial')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company public.companies;
  v_unit_id uuid;
begin
  if not public.sm_auth_is_platform_owner() then
    raise exception 'Acesso restrito ao dono da plataforma.' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_unit_name), '') = '' then
    raise exception 'Informe o nome da empresa e da primeira unidade.';
  end if;

  insert into public.companies (name, app_name, plan, data)
  values (trim(p_name), 'ScaleMedic', coalesce(nullif(trim(p_plan), ''), 'trial'), jsonb_build_object('created_by', 'plataforma'))
  returning * into v_company;

  insert into public.units (company_id, legacy_id, name)
  values (v_company.id, 'unit_' || substr(md5(random()::text), 1, 8), trim(p_unit_name))
  returning id into v_unit_id;

  return jsonb_build_object('id', v_company.id, 'name', v_company.name,
                            'registration_code', v_company.registration_code, 'unit_id', v_unit_id);
end;
$$;

-- Gestor de uma empresa (o primeiro ou mais um). A senha do 1º acesso vem do app (padrão:
-- nascimento + inicial do nome) e a troca é obrigatória no primeiro login.
create or replace function public.platform_create_manager(
  p_company_id text, p_full_name text, p_username text, p_email text, p_password text)
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
begin
  if not public.sm_auth_is_platform_owner() then
    raise exception 'Acesso restrito ao dono da plataforma.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.companies where id = p_company_id) then
    raise exception 'Empresa não encontrada.';
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
  if exists (select 1 from public.users where lower(username) = v_username) then
    raise exception 'O usuário "%" já existe. Escolha outro.', v_username;
  end if;
  if exists (select 1 from public.users where lower(email) = v_email) then
    raise exception 'O e-mail % já está cadastrado.', v_email;
  end if;

  select coalesce(jsonb_agg(u.id::text order by u.name), '[]'::jsonb) into v_units
    from public.units u where u.company_id = p_company_id;

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

create or replace function public.platform_reset_password(p_user_id text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sm_auth_is_platform_owner() then
    raise exception 'Acesso restrito ao dono da plataforma.' using errcode = '42501';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'A senha provisória precisa ter pelo menos 8 caracteres.';
  end if;
  update public.users
     set password = p_password,
         data = coalesce(data, '{}'::jsonb) || jsonb_build_object('must_change_password', true)
   where id = p_user_id;
  if not found then
    raise exception 'Usuário não encontrado.';
  end if;
  delete from public.login_attempts
   where login in (select lower(username) from public.users where id = p_user_id
                   union select lower(email) from public.users where id = p_user_id);
  return true;
end;
$$;

revoke all on function public.platform_companies() from public, anon;
revoke all on function public.platform_create_company(text, text, text) from public, anon;
revoke all on function public.platform_create_manager(text, text, text, text, text) from public, anon;
revoke all on function public.platform_reset_password(text, text) from public, anon;
grant execute on function public.platform_companies() to authenticated;
grant execute on function public.platform_create_company(text, text, text) to authenticated;
grant execute on function public.platform_create_manager(text, text, text, text, text) to authenticated;
grant execute on function public.platform_reset_password(text, text) to authenticated;

-- Credenciamento público pelo link da empresa ---------------------------------------------------
create or replace function public.registration_company(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('name', c.name)
    from public.companies c
   where c.registration_code = lower(trim(coalesce(p_code, '')))
$$;

create or replace function public.submit_registration(p_code text, p_payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company text;
  v_name text := left(trim(coalesce(p_payload ->> 'name', '')), 200);
  v_data jsonb := case when jsonb_typeof(p_payload -> 'data') = 'object' then p_payload -> 'data' else '{}'::jsonb end;
begin
  select id into v_company from public.companies where registration_code = lower(trim(coalesce(p_code, '')));
  if v_company is null then
    raise exception 'Código do hospital não encontrado. Confira o link enviado pela coordenação.';
  end if;
  if v_name = '' then
    raise exception 'Informe o nome completo.';
  end if;
  if length(p_payload::text) > 20000 then
    raise exception 'Ficha grande demais.';
  end if;

  insert into public.professionals (company_id, name, specialty, rqe, cbo, cpf, birth_date, document,
                                    document_expiry, phone, email, status, data)
  values (
    v_company, v_name,
    left(p_payload ->> 'specialty', 200), left(p_payload ->> 'rqe', 50), left(p_payload ->> 'cbo', 50),
    left(p_payload ->> 'cpf', 20), nullif(left(p_payload ->> 'birth_date', 10), '')::date, left(p_payload ->> 'document', 50),
    nullif(left(p_payload ->> 'document_expiry', 10), ''), left(p_payload ->> 'phone', 30), left(lower(p_payload ->> 'email'), 200),
    'pendente',
    -- Ficha pública nunca traz permissões: o perfil é sempre plantonista até o gestor aprovar.
    (v_data - 'screen_access' - 'can_edit' - 'permissions' - 'company_id') || jsonb_build_object('app_role', 'assistencial')
  );
  return true;
end;
$$;

revoke all on function public.registration_company(text) from public;
revoke all on function public.submit_registration(text, jsonb) from public;
grant execute on function public.registration_company(text) to anon, authenticated;
grant execute on function public.submit_registration(text, jsonb) to anon, authenticated;

-- O formulário não grava mais direto na tabela.
drop policy if exists "Public registration creates pending professional" on public.professionals;
revoke insert on public.professionals from anon;

-- Correção: aprovação de troca só por gestor da mesma empresa -----------------------------------
create or replace function public.approve_shift_swap(p_swap_id text, p_decided_by text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_swap public.shift_swaps%rowtype;
  v_a public.shifts%rowtype;
  v_b public.shifts%rowtype;
  v_decided_by text := p_decided_by;
begin
  select * into v_swap from public.shift_swaps where id = p_swap_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Pedido de troca não encontrado.');
  end if;
  if coalesce(auth.role(), '') = 'authenticated' then
    if v_swap.company_id is distinct from public.sm_auth_company() or not public.sm_auth_is_manager() then
      return jsonb_build_object('ok', false, 'error', 'Somente a gestão da unidade pode aprovar esta troca.');
    end if;
    v_decided_by := coalesce(public.sm_auth_user_id(), p_decided_by);
  end if;
  if v_swap.swap_type <> 'troca_direta' or v_swap.status <> 'aguardando_gestor' then
    return jsonb_build_object('ok', false, 'error', 'Este pedido não está aguardando aprovação.');
  end if;

  select * into v_a from public.shifts where id = v_swap.shift_id for update;
  select * into v_b from public.shifts where id = v_swap.target_shift_id for update;
  if v_a.id is null or v_b.id is null then
    return jsonb_build_object('ok', false, 'error', 'Um dos plantões não existe mais.');
  end if;
  if coalesce(v_a.professional_id, '') <> coalesce(v_swap.requester_professional_id, '')
     or coalesce(v_b.professional_id, '') <> coalesce(v_swap.target_professional_id, '') then
    return jsonb_build_object('ok', false, 'error', 'A escala mudou desde o pedido: um dos plantões já não é de quem pediu a troca.');
  end if;

  update public.shifts
     set professional_id = v_b.professional_id, professional_name = v_b.professional_name, updated_date = now()
   where id = v_a.id;
  update public.shifts
     set professional_id = v_a.professional_id, professional_name = v_a.professional_name, updated_date = now()
   where id = v_b.id;
  update public.shift_swaps
     set status = 'aprovada', decided_by = v_decided_by, decided_at = now(), updated_date = now()
   where id = v_swap.id;

  return jsonb_build_object('ok', true);
end;
$$;

-- Correção: aviso no celular só em nome de quem está logado -------------------------------------
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_id text, p_professional_id text, p_user_agent text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me text := public.sm_auth_user_id();
  v_prof text;
begin
  if v_me is null then
    return false;
  end if;
  if coalesce(p_endpoint, '') !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    return false;
  end if;
  -- O profissional só vale se for o vínculo de quem está logado.
  select p.id into v_prof
    from public.professionals p
   where p.id = nullif(p_professional_id, '')
     and (p.user_id = v_me or p.id = (select u.data ->> 'professional_id' from public.users u where u.id = v_me))
   limit 1;

  insert into public.push_subscriptions (endpoint, p256dh, auth, user_id, professional_id, user_agent)
  values (p_endpoint, p_p256dh, p_auth, v_me, v_prof, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, user_id = excluded.user_id,
        professional_id = excluded.professional_id, user_agent = excluded.user_agent, last_seen_at = now();
  return true;
end;
$$;

create or replace function public.remove_push_subscription(p_endpoint text)
returns boolean
language sql
security definer
set search_path = public
as $$
  with d as (
    delete from public.push_subscriptions
     where endpoint = p_endpoint and (user_id is null or user_id = public.sm_auth_user_id())
    returning 1
  )
  select exists(select 1 from d);
$$;

revoke all on function public.save_push_subscription(text, text, text, text, text, text) from public, anon;
revoke all on function public.remove_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text, text, text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;

-- Correção: alerta de vaga urgente só para profissionais da empresa da vaga ---------------------
do $$
declare
  v_def text := pg_get_functiondef('public.run_shift_alerts()'::regprocedure);
  v_old text := 'join public.professionals p on coalesce(nullif(p.status, ''''), p.data ->> ''status'', ''ativo'') = ''ativo''';
  v_new text := 'join public.professionals p on p.company_id = u.company_id and coalesce(nullif(p.status, ''''), p.data ->> ''status'', ''ativo'') = ''ativo''';
begin
  if position(v_old in v_def) = 0 then
    raise exception 'run_shift_alerts mudou; ajuste esta migração.';
  end if;
  execute replace(v_def, v_old, v_new);
end $$;
revoke execute on function public.run_shift_alerts() from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';
