-- E-mail de acesso (V0.8.8): quando a coordenação cria um login ou define uma senha nova, a função
-- send-access-email manda usuário e senha provisória para o e-mail da pessoa. Esta função diz à
-- função de e-mail para quem enviar, e só responde para a coordenação do mesmo estabelecimento
-- (ou o dono da plataforma). Pode rodar de novo sem erro.
begin;

create or replace function public.access_email_target(p_user_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  u public.users;
  v_owner boolean := public.sm_auth_is_platform_owner();
  v_company text := public.sm_auth_company();
  v_target_company text;
begin
  if not (v_owner or public.sm_auth_is_manager()) then
    raise exception 'Só a coordenação envia o acesso por e-mail.' using errcode = '42501';
  end if;
  select * into u from public.users where id = p_user_id;
  if u.id is null then
    raise exception 'Login não encontrado.';
  end if;
  v_target_company := coalesce(u.data ->> 'company_id', 'cmp_principal');
  if not v_owner and v_target_company <> v_company
     and not (jsonb_typeof(u.data -> 'company_access') = 'object' and u.data -> 'company_access' ? v_company) then
    raise exception 'Este login não é do seu estabelecimento.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'email', lower(trim(coalesce(u.email, ''))),
    'username', u.username,
    'full_name', u.full_name,
    'company_name', (select name from public.companies where id = case when v_owner then v_target_company else v_company end)
  );
end;
$$;
revoke all on function public.access_email_target(text) from public, anon;
grant execute on function public.access_email_target(text) to authenticated;

commit;

notify pgrst, 'reload schema';

-- Conferência: deve mostrar 1.
select count(*) as funcao_nova from pg_proc where proname = 'access_email_target';
