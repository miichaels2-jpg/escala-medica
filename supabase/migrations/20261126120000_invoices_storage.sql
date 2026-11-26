-- Nota fiscal do profissional PJ (V0.7.5).
--
-- O profissional anexa a nota do mês (PDF ou foto) pelo app; o faturamento/gestão vê quem
-- já mandou, aceita ou devolve, e só então marca o pagamento.
-- - Tabela invoices: uma nota por unidade + profissional + mês (reenviar substitui).
-- - Arquivos no Storage, pasta privada "notas-fiscais": <empresa>/<profissional>/<AAAA-MM>/<arquivo>.
-- - Quem vê: o próprio profissional e, na empresa dele, gestão e faturamento. Ninguém de fora.
-- Pode rodar de novo sem erro (tudo com "if not exists" / "drop ... if exists").
begin;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  unit_id text not null,
  professional_id text not null,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  file_path text not null,
  file_name text,
  file_size integer,
  amount numeric(12, 2),
  invoice_number text,
  status text not null default 'enviada' check (status in ('enviada', 'aceita', 'devolvida')),
  review_note text,
  uploaded_by text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (company_id, unit_id, professional_id, month)
);

create index if not exists invoices_company_month_idx on public.invoices (company_id, month);

alter table public.invoices enable row level security;
revoke all on public.invoices from anon;
grant select, insert, update, delete on public.invoices to authenticated;

drop policy if exists "Invoices read" on public.invoices;
drop policy if exists "Invoices insert" on public.invoices;
drop policy if exists "Invoices update" on public.invoices;
drop policy if exists "Invoices delete" on public.invoices;

-- Ler: o dono da nota ou gestão/faturamento da mesma empresa.
create policy "Invoices read" on public.invoices for select to authenticated
  using (company_id = (select public.sm_auth_company())
    and ((select public.sm_auth_can_bill()) or professional_id = any ((select public.sm_auth_professional_ids())::text[])));

-- Enviar: o profissional manda a própria nota (sempre como "enviada"); faturamento pode lançar por ele.
create policy "Invoices insert" on public.invoices for insert to authenticated
  with check (company_id = (select public.sm_auth_company())
    and ((select public.sm_auth_can_bill())
      or (professional_id = any ((select public.sm_auth_professional_ids())::text[]) and status = 'enviada' and reviewed_by is null)));

-- Alterar: faturamento aceita/devolve; o profissional só reenvia enquanto a nota não foi aceita.
create policy "Invoices update" on public.invoices for update to authenticated
  using (company_id = (select public.sm_auth_company())
    and ((select public.sm_auth_can_bill())
      or (professional_id = any ((select public.sm_auth_professional_ids())::text[]) and status <> 'aceita')))
  with check (company_id = (select public.sm_auth_company())
    and ((select public.sm_auth_can_bill())
      or (professional_id = any ((select public.sm_auth_professional_ids())::text[]) and status = 'enviada' and reviewed_by is null)));

create policy "Invoices delete" on public.invoices for delete to authenticated
  using (company_id = (select public.sm_auth_company())
    and ((select public.sm_auth_can_bill())
      or (professional_id = any ((select public.sm_auth_professional_ids())::text[]) and status <> 'aceita')));

-- Entra no Histórico como as outras tabelas de pagamento.
drop trigger if exists audit_log_capture on public.invoices;
create trigger audit_log_capture after insert or update or delete on public.invoices
  for each row execute function public.audit_log_capture();

-- Pasta privada de arquivos: até 10 MB, só PDF, JPG e PNG.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notas-fiscais', 'notas-fiscais', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Notas fiscais read" on storage.objects;
drop policy if exists "Notas fiscais insert" on storage.objects;
drop policy if exists "Notas fiscais update" on storage.objects;
drop policy if exists "Notas fiscais delete" on storage.objects;

-- Caminho <empresa>/<profissional>/<AAAA-MM>/<arquivo>: a 1ª pasta é a empresa, a 2ª o profissional.
create policy "Notas fiscais read" on storage.objects for select to authenticated
  using (bucket_id = 'notas-fiscais'
    and (storage.foldername(name))[1] = (select public.sm_auth_company())
    and ((select public.sm_auth_can_bill()) or (storage.foldername(name))[2] = any ((select public.sm_auth_professional_ids())::text[])));

create policy "Notas fiscais insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'notas-fiscais'
    and (storage.foldername(name))[1] = (select public.sm_auth_company())
    and ((select public.sm_auth_can_bill()) or (storage.foldername(name))[2] = any ((select public.sm_auth_professional_ids())::text[])));

create policy "Notas fiscais update" on storage.objects for update to authenticated
  using (bucket_id = 'notas-fiscais'
    and (storage.foldername(name))[1] = (select public.sm_auth_company())
    and ((select public.sm_auth_can_bill()) or (storage.foldername(name))[2] = any ((select public.sm_auth_professional_ids())::text[])));

create policy "Notas fiscais delete" on storage.objects for delete to authenticated
  using (bucket_id = 'notas-fiscais'
    and (storage.foldername(name))[1] = (select public.sm_auth_company())
    and ((select public.sm_auth_can_bill()) or (storage.foldername(name))[2] = any ((select public.sm_auth_professional_ids())::text[])));

commit;

-- Conferência: tabela 1, pasta 1, regras da pasta 4, regras da tabela 4.
select 'tabela' as item, count(*) from information_schema.tables where table_schema = 'public' and table_name = 'invoices'
union all
select 'pasta', count(*) from storage.buckets where id = 'notas-fiscais'
union all
select 'regras da pasta', count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'Notas fiscais%'
union all
select 'regras da tabela', count(*) from pg_policies where schemaname = 'public' and tablename = 'invoices';
