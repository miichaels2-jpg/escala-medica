-- LGPD na prática (V0.4.10).
-- 1) Aceite dos termos gravado pelo banco: data do servidor e versão dos termos (accept_terms).
-- 2) Pedido de exclusão de dados pelo próprio profissional (request_data_deletion): fica registrado,
--    avisa os gestores da empresa e aparece no Corpo Clínico até ser atendido (resolve_privacy_request).
-- Tudo fica em privacy_events: a pessoa vê os próprios registros; gestores veem os da empresa.
begin;

create table if not exists public.privacy_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  company_id text,
  user_id text,
  user_name text,
  kind text not null check (kind in ('aceite_termos', 'exclusao_pedida')),
  terms_version text,
  note text,
  status text check (status in ('aberto', 'atendido')),
  handled_by text,
  handled_at timestamptz,
  handled_note text
);
create index if not exists privacy_events_company_idx on public.privacy_events (company_id, created_at desc);
create index if not exists privacy_events_user_idx on public.privacy_events (user_id, created_at desc);

alter table public.privacy_events enable row level security;
revoke all on public.privacy_events from anon, authenticated;
grant select on public.privacy_events to authenticated;
drop policy if exists privacy_events_read on public.privacy_events;
create policy privacy_events_read on public.privacy_events for select to authenticated
  using (
    user_id = (select public.sm_auth_user_id())
    or ((select public.sm_auth_is_manager()) and company_id = (select public.sm_auth_company()))
  );

-- Aceite dos termos: o banco grava a data e a versão (o relógio do celular não conta).
create or replace function public.accept_terms(p_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user text := public.sm_auth_user_id();
  v_data jsonb;
begin
  if v_user is null then raise exception 'Faça login para aceitar os termos.'; end if;
  update public.users
     set data = coalesce(data, '{}'::jsonb) || jsonb_build_object(
           'lgpd_accepted', true,
           'lgpd_accepted_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
           'lgpd_terms_version', left(coalesce(p_version, '1'), 20))
   where id = v_user
  returning data into v_data;
  insert into public.privacy_events (company_id, user_id, user_name, kind, terms_version)
  select coalesce(u.data ->> 'company_id', 'cmp_principal'), u.id, u.full_name, 'aceite_termos', left(coalesce(p_version, '1'), 20)
    from public.users u where u.id = v_user;
  return v_data;
end;
$$;

-- Pedido de exclusão: um pedido aberto por pessoa; avisa os gestores ativos da empresa no sino.
create or replace function public.request_data_deletion(p_note text default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_company text;
  v_id bigint;
begin
  select * into v_user from public.users where auth_user_id = auth.uid() limit 1;
  if v_user.id is null then raise exception 'Faça login para pedir a exclusão.'; end if;
  v_company := coalesce(v_user.data ->> 'company_id', 'cmp_principal');

  select id into v_id from public.privacy_events
   where user_id = v_user.id and kind = 'exclusao_pedida' and status = 'aberto' limit 1;
  if v_id is not null then return v_id; end if;

  insert into public.privacy_events (company_id, user_id, user_name, kind, note, status)
  values (v_company, v_user.id, v_user.full_name, 'exclusao_pedida', left(p_note, 1000), 'aberto')
  returning id into v_id;

  insert into public.notifications (company_id, user_id, type, category, title, message, read, data, dedupe_key, created_date)
  select v_company, m.id, 'lgpd_exclusao', 'sistema', 'Pedido de exclusão de dados (LGPD)',
         coalesce(v_user.full_name, 'Um profissional') || ' pediu a exclusão dos dados pessoais. Veja em Corpo Clínico; a resposta é devida em até 15 dias.',
         false, jsonb_build_object('privacy_event_id', v_id), 'lgpd_exclusao_' || v_id || '_' || m.id, now()
    from public.users m
   where coalesce(m.data ->> 'company_id', 'cmp_principal') = v_company
     and coalesce(m.data ->> 'is_active', 'true') <> 'false'
     and (m.role = 'admin' or coalesce(m.data ->> 'app_role', '') in ('gestor', 'manager', 'coordenador'))
  on conflict (dedupe_key) do nothing;

  return v_id;
end;
$$;

-- Gestor marca o pedido como atendido (depois de excluir ou anonimizar o cadastro).
create or replace function public.resolve_privacy_request(p_id bigint, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sm_auth_is_manager() then raise exception 'Somente gestores.'; end if;
  update public.privacy_events
     set status = 'atendido', handled_by = public.sm_auth_user_id(), handled_at = now(), handled_note = left(p_note, 1000)
   where id = p_id and kind = 'exclusao_pedida' and company_id = public.sm_auth_company();
  if not found then raise exception 'Pedido não encontrado nesta empresa.'; end if;
end;
$$;

revoke all on function public.accept_terms(text) from public, anon;
revoke all on function public.request_data_deletion(text) from public, anon;
revoke all on function public.resolve_privacy_request(bigint, text) from public, anon;
grant execute on function public.accept_terms(text) to authenticated;
grant execute on function public.request_data_deletion(text) to authenticated;
grant execute on function public.resolve_privacy_request(bigint, text) to authenticated;

commit;
