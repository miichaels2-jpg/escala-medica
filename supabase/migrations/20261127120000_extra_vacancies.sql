-- Vagas extras (V0.9.3): ficam na escala depois de publicar, para a coordenação encaixar alguém.
-- Vazias, não geram aviso de "vaga urgente"; e o plantonista não assume vaga extra (não vai para o Mural).
-- Depende de 20261126220000_mural_only_published.sql. Pode rodar de novo sem erro.
begin;

-- Mesma trava de 20261126220000, agora recusando vaga extra.
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
    if coalesce(old.notes, '') like '%[VAGA_EXTRA]%' then
      raise exception 'Vaga extra é preenchida pela coordenação.' using errcode = '42501';
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

-- Aviso de vaga urgente (servidor, a cada 5 min): ignora vaga extra.
do $$
declare
  v_def text := pg_get_functiondef('public.run_shift_alerts()'::regprocedure);
  v_old text := 'where w.vacant and public.sm_shift_published(';
  v_new text := 'where w.vacant and coalesce(w.notes, '''') not like ''%[VAGA_EXTRA]%'' and public.sm_shift_published(';
begin
  if position('[VAGA_EXTRA]' in v_def) > 0 then
    return;
  end if;
  if position(v_old in v_def) = 0 then
    raise exception 'run_shift_alerts mudou; ajuste esta migração (rode antes a 20261126220000).';
  end if;
  execute replace(v_def, v_old, v_new);
end $$;
revoke execute on function public.run_shift_alerts() from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';

-- Conferência: deve mostrar true e true.
select position('[VAGA_EXTRA]' in pg_get_functiondef('public.shifts_guard_professional_changes()'::regprocedure)) > 0 as trava_extra,
       position('[VAGA_EXTRA]' in pg_get_functiondef('public.run_shift_alerts()'::regprocedure)) > 0 as aviso_sem_extra;
