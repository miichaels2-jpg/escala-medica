-- Fase 2 do login oficial, etapa 3 (V0.3.1): fecha o acesso pela chave pública.
--
-- A chave pública (papel "anon") vai dentro do app para qualquer navegador. Daqui em diante ela só
-- serve para entrar (auth_fallback_login, login_lock_status) e para o formulário público
-- "Solicite seu credenciamento", que só cria ficha pendente e não lê nada. Todo o resto exige a
-- sessão oficial aberta no login (regras por empresa da etapa 1).
begin;

-- Regras antigas "libera tudo" da chave pública.
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
            where schemaname = 'public' and roles = '{anon}'::name[] loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- Nenhuma permissão de tabela para a chave pública...
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
-- ...nem para tabelas criadas no futuro.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- Cadastro público: só cria ficha pendente, sem vínculo de usuário, e não lê nada de volta.
grant insert (company_id, name, specialty, rqe, cbo, cpf, birth_date, document, document_expiry,
              phone, email, status, data) on public.professionals to anon;
drop policy if exists "Public registration creates pending professional" on public.professionals;
create policy "Public registration creates pending professional" on public.professionals
  for insert to anon
  with check (status = 'pendente' and user_id is null and company_id is not null);

-- Funções: a chave pública só entra.
revoke execute on function public.approve_shift_swap(text, text) from public, anon;
revoke execute on function public.save_push_subscription(text, text, text, text, text, text) from public, anon;
revoke execute on function public.remove_push_subscription(text) from public, anon;
grant execute on function public.approve_shift_swap(text, text) to authenticated;
grant execute on function public.save_push_subscription(text, text, text, text, text, text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;
grant execute on function public.auth_fallback_login(text, text) to anon, authenticated;
grant execute on function public.login_lock_status(text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
