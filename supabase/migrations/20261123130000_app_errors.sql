-- Aviso de erro em produção (V0.4.9).
-- Quando o app mostra "Instabilidade no módulo" (ou o navegador acusa um erro solto), ele registra
-- aqui: tela, mensagem, versão, quem e qual empresa. Só o dono da plataforma lê (tela Plataforma).
-- O registro passa por report_app_error: o banco descobre quem é a pessoa pelo login, corta textos
-- longos, ignora o mesmo erro repetido em 10 minutos e tem um teto por hora contra abuso.
begin;

create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  company_id text,
  user_id text,
  kind text,
  path text,
  message text,
  stack text,
  app_version text,
  user_agent text
);
create index if not exists app_errors_created_idx on public.app_errors (created_at desc);

alter table public.app_errors enable row level security;
revoke all on public.app_errors from anon, authenticated;

create or replace function public.report_app_error(
  p_kind text, p_path text, p_message text, p_stack text, p_version text, p_agent text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user text := case when auth.uid() is null then null else public.sm_auth_user_id() end;
  v_company text := case when auth.uid() is null then null else public.sm_auth_company() end;
  v_message text := left(coalesce(p_message, ''), 500);
begin
  if v_message = '' then return; end if;
  -- teto geral: no máximo 300 registros por hora
  if (select count(*) from public.app_errors where created_at > now() - interval '1 hour') >= 300 then return; end if;
  -- mesmo erro, mesma pessoa e mesma tela em 10 minutos: não repete
  if exists (
    select 1 from public.app_errors
    where created_at > now() - interval '10 minutes'
      and message = v_message
      and coalesce(user_id, '') = coalesce(v_user, '')
      and coalesce(path, '') = coalesce(left(p_path, 200), '')
  ) then return; end if;

  insert into public.app_errors (company_id, user_id, kind, path, message, stack, app_version, user_agent)
  values (v_company, v_user, left(p_kind, 40), left(p_path, 200), v_message, left(p_stack, 4000), left(p_version, 20), left(p_agent, 300));
end;
$$;

revoke all on function public.report_app_error(text, text, text, text, text, text) from public;
grant execute on function public.report_app_error(text, text, text, text, text, text) to anon, authenticated;

-- Leitura: só o dono da plataforma, com o nome da empresa e da pessoa.
create or replace function public.platform_app_errors(p_limit int default 100)
returns table (id bigint, created_at timestamptz, company_name text, user_name text, kind text, path text, message text, stack text, app_version text, user_agent text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.sm_auth_is_platform_owner() then
    raise exception 'Somente o dono da plataforma.';
  end if;
  return query
    select e.id, e.created_at, c.name::text, u.full_name::text, e.kind, e.path, e.message, e.stack, e.app_version, e.user_agent
    from public.app_errors e
    left join public.companies c on c.id::text = e.company_id
    left join public.users u on u.id::text = e.user_id
    order by e.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

revoke all on function public.platform_app_errors(int) from public, anon;
grant execute on function public.platform_app_errors(int) to authenticated;

commit;
