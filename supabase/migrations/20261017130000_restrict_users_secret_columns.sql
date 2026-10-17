-- ScaleMedic • Bloqueia a leitura de senha/hash pela chave pública do app.
--
-- APLICAR SOMENTE DEPOIS de publicar a versão do app que lê a tabela users por
-- colunas explícitas (commit "feat: dados compartilhados no Supabase..."). Versões
-- antigas usam select('*') em users e deixariam de listar usuários.
--
-- Depende de 20261017120000_shared_state_notifications_password_hash.sql.

begin;

revoke select on public.users from anon, authenticated;
grant select (id, username, email, full_name, role, data, created_date, updated_date)
  on public.users to anon, authenticated;

commit;
