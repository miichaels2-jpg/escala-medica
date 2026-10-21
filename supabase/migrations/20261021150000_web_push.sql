-- Notificação push real (V0.2.8): o aviso chega no celular mesmo com o app fechado.
-- Cada aparelho que ativa os avisos fica em push_subscriptions. Toda notificação
-- nova (tabela notifications) dispara a Edge Function send-push via pg_net, já
-- levando os aparelhos da pessoa. O segredo do webhook e a URL ficam em
-- app_private_config, sem acesso pelo app.
begin;

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_id text,
  professional_id text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_subscriptions_professional_idx on public.push_subscriptions (professional_id);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

create table if not exists public.app_private_config (
  key text primary key,
  value text not null
);
alter table public.app_private_config enable row level security;
revoke all on public.app_private_config from anon, authenticated;

-- O app cadastra/atualiza o aparelho por função (sem ler a tabela).
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_id text, p_professional_id text, p_user_agent text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(p_endpoint, '') !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    return false;
  end if;
  insert into public.push_subscriptions (endpoint, p256dh, auth, user_id, professional_id, user_agent)
  values (p_endpoint, p_p256dh, p_auth, nullif(p_user_id, ''), nullif(p_professional_id, ''), left(p_user_agent, 300))
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
  with d as (delete from public.push_subscriptions where endpoint = p_endpoint returning 1)
  select exists(select 1 from d);
$$;

grant execute on function public.save_push_subscription(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.remove_push_subscription(text) to anon, authenticated;

-- Notificação nova → push para os aparelhos da pessoa.
create or replace function public.notifications_send_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_secret text;
  v_subs jsonb;
begin
  select value into v_url from public.app_private_config where key = 'push_function_url';
  select value into v_secret from public.app_private_config where key = 'push_webhook_secret';
  if v_url is null or v_secret is null then
    return new;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth))), '[]'::jsonb)
    into v_subs
  from public.push_subscriptions s
  where (new.professional_id is not null and s.professional_id = new.professional_id)
     or (new.user_id is not null and s.user_id = new.user_id);

  if jsonb_array_length(v_subs) = 0 then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body := jsonb_build_object(
      'title', new.title,
      'body', coalesce(new.message, ''),
      'tag', coalesce(new.type, 'geral') || ':' || coalesce(new.data ->> 'shift_id', new.data ->> 'swap_id', new.id::text),
      'url', case
        when new.type like 'troca%' or new.type like 'vaga%' then '/trocas'
        else '/minha-escala'
      end,
      'subscriptions', v_subs
    ),
    timeout_milliseconds := 8000
  );
  return new;
exception when others then
  -- O push nunca impede o aviso no sino.
  return new;
end;
$$;

drop trigger if exists notifications_send_push on public.notifications;
create trigger notifications_send_push after insert on public.notifications
  for each row execute function public.notifications_send_push();

commit;
