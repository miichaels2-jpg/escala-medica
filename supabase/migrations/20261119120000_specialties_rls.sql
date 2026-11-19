-- Alerta do Supabase "rls_disabled_in_public" (14/11/2026): a tabela specialties estava sem
-- RLS, então qualquer um com a chave pública podia ler, alterar e apagar. O app não usa esta
-- tabela (as especialidades vêm dos setores/empresa), então ela fica restrita à sessão oficial,
-- e cada empresa só vê as próprias linhas.
begin;

alter table public.specialties enable row level security;

revoke all on public.specialties from anon;
grant select, insert, update, delete on public.specialties to authenticated;

drop policy if exists "Company members access specialties" on public.specialties;
create policy "Company members access specialties" on public.specialties
  for all to authenticated
  using (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id'))
  with check (company_id = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

commit;
