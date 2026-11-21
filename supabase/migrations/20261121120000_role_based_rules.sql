-- Regras por perfil dentro da empresa (V0.3.9).
--
-- Até aqui o banco separava as empresas, mas dentro da mesma empresa qualquer pessoa logada podia
-- alterar tudo chamando o banco por fora do app. Agora:
-- - gestor (ou quem tem "pode editar", ver sm_auth_is_manager): tudo dentro da empresa;
-- - faturamento: também lança pagamentos, faturamento e produtividade;
-- - profissional: só o que é dele — assumir vaga sem ninguém, pedir/cancelar liberação do próprio
--   plantão, registrar entrada/saída no próprio plantão, propor/aceitar/recusar/cancelar troca
--   (aprovar não), marcar a própria indisponibilidade, mandar notificação e ler só as suas.
begin;

-- Quem está chamando --------------------------------------------------------------------------
create or replace function public.sm_auth_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(u.data ->> 'app_role', case when u.role = 'admin' then 'gestor' else 'assistencial' end)
    from public.users u where u.auth_user_id = auth.uid() limit 1
$$;

create or replace function public.sm_auth_can_bill()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sm_auth_is_manager() or coalesce(public.sm_auth_app_role(), '') = 'faturamento'
$$;

-- Fichas de profissional ligadas a quem está logado (pelo user_id da ficha ou pelo vínculo no cadastro).
create or replace function public.sm_auth_professional_ids()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct x) filter (where x is not null), '{}')
    from (
      select p.id
        from public.users u
        join public.professionals p on p.company_id = coalesce(u.data ->> 'company_id', 'cmp_principal')
       where u.auth_user_id = auth.uid()
         and (p.user_id = u.id or p.id = u.data ->> 'professional_id' or p.id = u.id)
      union
      select u.data ->> 'professional_id' from public.users u where u.auth_user_id = auth.uid()
    ) s(x)
$$;

revoke all on function public.sm_auth_app_role() from public, anon;
revoke all on function public.sm_auth_can_bill() from public, anon;
revoke all on function public.sm_auth_professional_ids() from public, anon;
grant execute on function public.sm_auth_app_role() to authenticated;
grant execute on function public.sm_auth_can_bill() to authenticated;
grant execute on function public.sm_auth_professional_ids() to authenticated;

-- Troca a regra única "tudo dentro da empresa" por regras por ação -------------------------------
do $$
declare t text;
begin
  foreach t in array array['billing_records', 'notifications', 'payment_statuses', 'professionals',
                           'published_schedules', 'sectors', 'shift_swaps', 'shifts', 'units'] loop
    execute format('drop policy if exists %I on public.%I', 'Company access ' || t, t);
  end loop;
end $$;
drop policy if exists "Company members access specialties" on public.specialties;

-- Cadastros que só a gestão altera; todos da empresa leem.
do $$
declare t text; v_rule text;
begin
  foreach t in array array['sectors', 'units', 'published_schedules', 'specialties', 'payment_statuses', 'billing_records'] loop
    v_rule := case when t in ('payment_statuses', 'billing_records') then 'public.sm_auth_can_bill()' else 'public.sm_auth_is_manager()' end;
    execute format('drop policy if exists %I on public.%I', 'Company read ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'Company staff insert ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'Company staff update ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'Company staff delete ' || t, t);
    execute format('create policy %I on public.%I for select to authenticated using (company_id = (select public.sm_auth_company()))', 'Company read ' || t, t);
    execute format('create policy %I on public.%I for insert to authenticated with check (company_id = (select public.sm_auth_company()) and (select %s))', 'Company staff insert ' || t, t, v_rule);
    execute format('create policy %I on public.%I for update to authenticated using (company_id = (select public.sm_auth_company()) and (select %s)) with check (company_id = (select public.sm_auth_company()) and (select %s))', 'Company staff update ' || t, t, v_rule, v_rule);
    execute format('create policy %I on public.%I for delete to authenticated using (company_id = (select public.sm_auth_company()) and (select %s))', 'Company staff delete ' || t, t, v_rule);
  end loop;
end $$;
grant select, insert, update, delete on public.specialties to authenticated;

-- Empresa: o faturamento também grava a regra de produtividade (companies.data).
drop policy if exists "Company managers update companies" on public.companies;
create policy "Company managers update companies" on public.companies for update to authenticated
  using (id = (select public.sm_auth_company()) and (select public.sm_auth_can_bill()))
  with check (id = (select public.sm_auth_company()) and (select public.sm_auth_can_bill()));

-- Histórico de alterações: só a gestão.
drop policy if exists "Company read audit_log" on public.audit_log;
create policy "Company read audit_log" on public.audit_log for select to authenticated
  using (company_id = (select public.sm_auth_company()) and (select public.sm_auth_is_manager()));

-- Profissionais ----------------------------------------------------------------------------------
drop policy if exists "Company read professionals" on public.professionals;
drop policy if exists "Company managers insert professionals" on public.professionals;
drop policy if exists "Company update professionals" on public.professionals;
drop policy if exists "Company managers delete professionals" on public.professionals;
create policy "Company read professionals" on public.professionals for select to authenticated
  using (company_id = (select public.sm_auth_company()));
create policy "Company managers insert professionals" on public.professionals for insert to authenticated
  with check (company_id = (select public.sm_auth_company()) and (select public.sm_auth_is_manager()));
create policy "Company update professionals" on public.professionals for update to authenticated
  using (company_id = (select public.sm_auth_company())
         and ((select public.sm_auth_can_bill()) or id = any ((select public.sm_auth_professional_ids())::text[])))
  with check (company_id = (select public.sm_auth_company()));
create policy "Company managers delete professionals" on public.professionals for delete to authenticated
  using (company_id = (select public.sm_auth_company()) and (select public.sm_auth_is_manager()));

-- Na própria ficha, o profissional só marca indisponibilidade.
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
     or (coalesce(new.data, '{}'::jsonb) - 'unavailability') is distinct from (coalesce(old.data, '{}'::jsonb) - 'unavailability') then
    raise exception 'Na sua ficha você só pode marcar indisponibilidade. O restante é com a coordenação.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists professionals_guard_own_changes on public.professionals;
create trigger professionals_guard_own_changes before update on public.professionals
  for each row execute function public.professionals_guard_own_changes();

-- Plantões ---------------------------------------------------------------------------------------
drop policy if exists "Company read shifts" on public.shifts;
drop policy if exists "Company managers insert shifts" on public.shifts;
drop policy if exists "Company update shifts" on public.shifts;
drop policy if exists "Company managers delete shifts" on public.shifts;
create policy "Company read shifts" on public.shifts for select to authenticated
  using (company_id = (select public.sm_auth_company()));
create policy "Company managers insert shifts" on public.shifts for insert to authenticated
  with check (company_id = (select public.sm_auth_company()) and (select public.sm_auth_is_manager()));
create policy "Company update shifts" on public.shifts for update to authenticated
  using (company_id = (select public.sm_auth_company())
         and ((select public.sm_auth_is_manager())
              or professional_id = any ((select public.sm_auth_professional_ids())::text[])
              or coalesce(professional_id, '') = '' or status = 'vago'))
  with check (company_id = (select public.sm_auth_company()));
create policy "Company managers delete shifts" on public.shifts for delete to authenticated
  using (company_id = (select public.sm_auth_company()) and (select public.sm_auth_is_manager()));

-- O profissional assume vaga sem ninguém, e no próprio plantão só mexe em status e observações
-- (pedir/cancelar liberação no Mural, registrar entrada e saída).
create or replace function public.shifts_guard_professional_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mine text[];
  v_was_vacant boolean := coalesce(old.professional_id, '') = '' or old.status = 'vago';
begin
  if coalesce(auth.role(), '') <> 'authenticated' or public.sm_auth_is_manager() then
    return new;
  end if;
  if (to_jsonb(new) - 'status' - 'notes' - 'professional_id' - 'professional_name' - 'updated_date')
     is distinct from (to_jsonb(old) - 'status' - 'notes' - 'professional_id' - 'professional_name' - 'updated_date') then
    raise exception 'Só a coordenação altera data, horário, setor ou valores do plantão.' using errcode = '42501';
  end if;
  v_mine := public.sm_auth_professional_ids();
  if v_was_vacant then
    if not (new.professional_id = any (v_mine)) or new.status is distinct from 'confirmado' then
      raise exception 'Uma vaga só pode ser assumida em seu próprio nome.' using errcode = '42501';
    end if;
  elsif old.professional_id = any (v_mine) then
    if new.professional_id is distinct from old.professional_id or new.professional_name is distinct from old.professional_name
       or new.status not in (old.status, 'aguardando_aprovacao_gestor', 'confirmado') then
      raise exception 'Para passar seu plantão adiante, peça a liberação no Mural ou proponha uma troca.' using errcode = '42501';
    end if;
  else
    raise exception 'Este plantão não é seu.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists shifts_guard_professional_changes on public.shifts;
create trigger shifts_guard_professional_changes before update on public.shifts
  for each row execute function public.shifts_guard_professional_changes();

-- Trocas diretas ---------------------------------------------------------------------------------
drop policy if exists "Company read shift_swaps" on public.shift_swaps;
drop policy if exists "Company insert shift_swaps" on public.shift_swaps;
drop policy if exists "Company update shift_swaps" on public.shift_swaps;
drop policy if exists "Company managers delete shift_swaps" on public.shift_swaps;
create policy "Company read shift_swaps" on public.shift_swaps for select to authenticated
  using (company_id = (select public.sm_auth_company()));
create policy "Company insert shift_swaps" on public.shift_swaps for insert to authenticated
  with check (company_id = (select public.sm_auth_company())
              and ((select public.sm_auth_is_manager())
                   or (requester_professional_id = any ((select public.sm_auth_professional_ids())::text[]) and status = 'aguardando_colega')));
create policy "Company update shift_swaps" on public.shift_swaps for update to authenticated
  using (company_id = (select public.sm_auth_company())
         and ((select public.sm_auth_is_manager())
              or requester_professional_id = any ((select public.sm_auth_professional_ids())::text[])
              or target_professional_id = any ((select public.sm_auth_professional_ids())::text[])))
  with check (company_id = (select public.sm_auth_company()));
create policy "Company managers delete shift_swaps" on public.shift_swaps for delete to authenticated
  using (company_id = (select public.sm_auth_company()) and (select public.sm_auth_is_manager()));

-- Quem pediu pode cancelar; o colega aceita ou recusa. Aprovar é só com a gestão.
create or replace function public.shift_swaps_guard_professional_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mine text[];
begin
  if coalesce(auth.role(), '') <> 'authenticated' or public.sm_auth_is_manager() then
    return new;
  end if;
  if (to_jsonb(new) - 'status' - 'updated_date') is distinct from (to_jsonb(old) - 'status' - 'updated_date') then
    raise exception 'Na troca você só pode aceitar, recusar ou cancelar.' using errcode = '42501';
  end if;
  v_mine := public.sm_auth_professional_ids();
  if new.status = 'cancelada' and old.requester_professional_id = any (v_mine)
     and old.status in ('aguardando_colega', 'aguardando_gestor') then
    return new;
  end if;
  if new.status in ('aguardando_gestor', 'recusada_colega') and old.target_professional_id = any (v_mine)
     and old.status = 'aguardando_colega' then
    return new;
  end if;
  raise exception 'Esta mudança na troca é com a coordenação.' using errcode = '42501';
end;
$$;
drop trigger if exists shift_swaps_guard_professional_changes on public.shift_swaps;
create trigger shift_swaps_guard_professional_changes before update on public.shift_swaps
  for each row execute function public.shift_swaps_guard_professional_changes();

-- Notificações: qualquer pessoa da empresa envia; cada um lê e marca como lidas só as suas.
drop policy if exists "Own read notifications" on public.notifications;
drop policy if exists "Company insert notifications" on public.notifications;
drop policy if exists "Own update notifications" on public.notifications;
drop policy if exists "Own delete notifications" on public.notifications;
create policy "Own read notifications" on public.notifications for select to authenticated
  using (company_id = (select public.sm_auth_company())
         and (user_id = (select public.sm_auth_user_id()) or professional_id = any ((select public.sm_auth_professional_ids())::text[])));
create policy "Company insert notifications" on public.notifications for insert to authenticated
  with check (company_id = (select public.sm_auth_company()));
create policy "Own update notifications" on public.notifications for update to authenticated
  using (company_id = (select public.sm_auth_company())
         and (user_id = (select public.sm_auth_user_id()) or professional_id = any ((select public.sm_auth_professional_ids())::text[])))
  with check (company_id = (select public.sm_auth_company()));
create policy "Own delete notifications" on public.notifications for delete to authenticated
  using (company_id = (select public.sm_auth_company())
         and (user_id = (select public.sm_auth_user_id()) or professional_id = any ((select public.sm_auth_professional_ids())::text[])));

-- Gatilhos de proteção não são chamados direto.
revoke execute on function public.professionals_guard_own_changes() from public, anon, authenticated;
revoke execute on function public.shifts_guard_professional_changes() from public, anon, authenticated;
revoke execute on function public.shift_swaps_guard_professional_changes() from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';
