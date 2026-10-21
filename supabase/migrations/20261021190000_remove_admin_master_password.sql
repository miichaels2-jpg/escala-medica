-- Segurança do login (V0.2.9): remove a senha de suporte "123456" que valia para
-- qualquer conta de administrador. Cada conta (inclusive "admin") entra só com a
-- própria senha; o bloqueio após 5 tentativas erradas continua igual.
begin;

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
    if v_user.password_hash is not null then
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

grant execute on function public.auth_fallback_login(text, text) to anon, authenticated;

commit;
