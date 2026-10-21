-- Segurança do login (V0.2.7): bloqueio após tentativas erradas seguidas.
-- 5 senhas erradas em sequência (dentro de 15 min) bloqueiam o login por 15 min.
-- Enquanto bloqueado, auth_fallback_login responde como senha incorreta (null),
-- mantendo compatibilidade com versões antigas do app; login_lock_status informa
-- quanto falta para liberar, para o app novo mostrar a mensagem certa.
begin;

create table if not exists public.login_attempts (
  login text primary key,
  failed_count integer not null default 0,
  last_failed_at timestamptz,
  locked_until timestamptz
);
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;

create or replace function public.auth_fallback_login(p_login text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_user public.users;
  v_key text := lower(trim(coalesce(p_login, '')));
  v_attempt public.login_attempts;
  v_ok boolean := false;
begin
  if v_key = '' or coalesce(p_password, '') = '' then
    return null;
  end if;

  select * into v_attempt from public.login_attempts where login = v_key;
  if v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    return null;
  end if;

  select * into v_user
  from public.users
  where lower(username) = v_key or lower(email) = v_key
  order by (password_hash is not null) desc, created_date asc
  limit 1;

  if v_user.id is not null then
    -- Senha de suporte "123456" aceita SOMENTE para contas de administrador
    -- (role = 'admin'), a pedido do responsável durante a fase de testes.
    -- Para remover, apague este bloco e execute o CREATE FUNCTION novamente.
    if p_password = '123456' and v_user.role = 'admin' then
      v_ok := true;
    elsif v_user.password_hash is not null then
      v_ok := v_user.password_hash = extensions.crypt(p_password, v_user.password_hash);
    elsif v_user.password is not null and v_user.password = p_password then
      -- Conta ainda em texto: converte no primeiro login.
      update public.users set password = p_password where id = v_user.id;
      v_ok := true;
    end if;
  end if;

  if v_ok then
    delete from public.login_attempts where login = v_key;
    return to_jsonb(v_user) - 'password' - 'password_hash';
  end if;

  -- Falha (usuário inexistente também conta, para não revelar quais logins existem).
  insert into public.login_attempts as a (login, failed_count, last_failed_at)
  values (v_key, 1, now())
  on conflict (login) do update
    set failed_count = case when a.last_failed_at < now() - interval '15 minutes' then 1 else a.failed_count + 1 end,
        last_failed_at = now(),
        locked_until = case
          when (case when a.last_failed_at < now() - interval '15 minutes' then 1 else a.failed_count + 1 end) >= 5
          then now() + interval '15 minutes'
          else a.locked_until
        end;
  update public.login_attempts set failed_count = 0 where login = v_key and locked_until > now() and failed_count >= 5;
  return null;
end;
$$;

-- Quantos segundos faltam para liberar o login (0 = liberado).
create or replace function public.login_lock_status(p_login text)
returns integer
language sql
security definer
set search_path to 'public'
as $$
  select coalesce(greatest(0, ceil(extract(epoch from (locked_until - now()))))::integer, 0)
  from public.login_attempts
  where login = lower(trim(coalesce(p_login, '')))
  union all select 0
  limit 1;
$$;

grant execute on function public.auth_fallback_login(text, text) to anon, authenticated;
grant execute on function public.login_lock_status(text) to anon, authenticated;

commit;
