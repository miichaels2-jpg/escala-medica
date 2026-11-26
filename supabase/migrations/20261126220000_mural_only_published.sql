-- Mural só com escala publicada (V0.8.7). Vaga de período ainda em rascunho não pode ser assumida
-- pelo plantonista nem gerar aviso de "vaga urgente"; a coordenação monta a escala com calma e as
-- vagas aparecem quando ela publica. Pode rodar de novo sem erro.
begin;

-- O dia do plantão está dentro de um período publicado do setor? Aceita o código antigo da unidade.
create or replace function public.sm_shift_published(p_company text, p_unit text, p_sector text, p_date text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.published_schedules ps
      cross join lateral jsonb_array_elements(case when jsonb_typeof(ps.ranges) = 'array' then ps.ranges else '[]'::jsonb end) rg
     where ps.company_id = p_company
       and ps.sector_id = p_sector
       and ps.year = substring(p_date from 1 for 4)::int
       and ps.month = substring(p_date from 6 for 2)::int
       and left(p_date, 10) between rg ->> 'start_date' and rg ->> 'end_date'
       and (ps.unit_id = p_unit or exists (
             select 1 from public.units un
              where un.company_id = p_company
                and p_unit in (un.id::text, un.legacy_id)
                and ps.unit_id in (un.id::text, un.legacy_id)))
  )
$$;
revoke all on function public.sm_shift_published(text, text, text, text) from public, anon;
grant execute on function public.sm_shift_published(text, text, text, text) to authenticated;

-- Mesma trava de 20261121120000_role_based_rules.sql, agora exigindo escala publicada para assumir vaga.
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
    if not public.sm_shift_published(old.company_id::text, old.unit_id::text, old.sector_id::text, old.date::text) then
      raise exception 'Esta vaga ainda não foi publicada pela coordenação.' using errcode = '42501';
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

-- Aviso de vaga urgente (servidor, a cada 5 min): só para vaga de escala publicada.
do $$
declare
  v_def text := pg_get_functiondef('public.run_shift_alerts()'::regprocedure);
  v_old text := 'where w.vacant and w.ends_at > v_now';
  v_new text := 'where w.vacant and public.sm_shift_published(w.company_id::text, w.unit_id, w.sector_id::text, w.date::text) and w.ends_at > v_now';
begin
  if position(v_new in v_def) > 0 then
    return;
  end if;
  if position(v_old in v_def) = 0 then
    raise exception 'run_shift_alerts mudou; ajuste esta migração.';
  end if;
  execute replace(v_def, v_old, v_new);
end $$;
revoke execute on function public.run_shift_alerts() from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';

-- Conferência: deve mostrar 1, true e true.
select count(*) as funcao_nova,
       position('sm_shift_published' in pg_get_functiondef('public.shifts_guard_professional_changes()'::regprocedure)) > 0 as trava_mural,
       position('sm_shift_published' in pg_get_functiondef('public.run_shift_alerts()'::regprocedure)) > 0 as aviso_urgente
  from pg_proc where proname = 'sm_shift_published';
