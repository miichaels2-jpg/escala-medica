-- V0.10.2: preferências do plantonista e comunicados por setor com "li". Pode rodar de novo sem erro.
begin;

-- 1) Na própria ficha, o profissional marca indisponibilidade e as preferências (turno, dias que não
--    faz, setores de interesse). O resto continua só com a coordenação.
create or replace function public.professionals_guard_own_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' or public.sm_auth_can_bill() then
    return new;
  end if;
  if (to_jsonb(new) - 'data' - 'updated_date') is distinct from (to_jsonb(old) - 'data' - 'updated_date')
     or (coalesce(new.data, '{}'::jsonb) - 'unavailability' - 'preferences') is distinct from (coalesce(old.data, '{}'::jsonb) - 'unavailability' - 'preferences') then
    raise exception 'Na sua ficha você só pode marcar indisponibilidade e preferências. O restante é com a coordenação.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 2) Comunicados: aviso oficial da coordenação para a equipe de um setor (ou de toda a unidade).
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  unit_id text not null,
  sector_id text,
  title text not null,
  body text not null default '',
  created_by text,
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists announcements_company_idx on public.announcements (company_id, created_at desc);

-- Quem tocou em "Li".
create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  professional_id text not null,
  company_id text not null,
  read_at timestamptz not null default now(),
  primary key (announcement_id, professional_id)
);

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;
revoke all on public.announcements, public.announcement_reads from anon;
grant select, insert, delete on public.announcements to authenticated;
grant select, insert on public.announcement_reads to authenticated;

drop policy if exists "Company read announcements" on public.announcements;
drop policy if exists "Managers insert announcements" on public.announcements;
drop policy if exists "Managers delete announcements" on public.announcements;
create policy "Company read announcements" on public.announcements for select to authenticated
  using (company_id = (select public.sm_auth_company()));
create policy "Managers insert announcements" on public.announcements for insert to authenticated
  with check (company_id = (select public.sm_auth_company()) and (select public.sm_auth_is_manager()));
create policy "Managers delete announcements" on public.announcements for delete to authenticated
  using (company_id = (select public.sm_auth_company()) and (select public.sm_auth_is_manager()));

-- A coordenação vê todas as leituras; o profissional vê e registra só as dele.
drop policy if exists "Read announcement reads" on public.announcement_reads;
drop policy if exists "Professional marks read" on public.announcement_reads;
create policy "Read announcement reads" on public.announcement_reads for select to authenticated
  using (company_id = (select public.sm_auth_company())
         and ((select public.sm_auth_is_manager()) or professional_id = any ((select public.sm_auth_professional_ids())::text[])));
create policy "Professional marks read" on public.announcement_reads for insert to authenticated
  with check (company_id = (select public.sm_auth_company())
              and professional_id = any ((select public.sm_auth_professional_ids())::text[]));

commit;

notify pgrst, 'reload schema';

-- Conferência: deve mostrar 2 e true.
select (select count(*) from pg_tables where schemaname = 'public' and tablename in ('announcements', 'announcement_reads')) as tabelas_novas,
       position('preferences' in pg_get_functiondef('public.professionals_guard_own_changes()'::regprocedure)) > 0 as preferencias_liberadas;
