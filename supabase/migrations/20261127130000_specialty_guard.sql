-- Especialidade (V0.9.8): o profissional nunca assume vaga de outra especialidade; só a coordenação
-- pode escalá-lo fora dela (o app pede confirmação ao gestor). Quem não tem especialidade no cadastro
-- só é compatível com vaga geral ou sem especialidade (antes, valia para qualquer vaga, inclusive no
-- aviso de vaga urgente). Depende de 20261127120000_extra_vacancies.sql. Pode rodar de novo sem erro.
begin;

create or replace function public.sm_specialty_ok(p_target text, p_notes text, p_mine text)
returns boolean language plpgsql stable set search_path = public, extensions as $$
declare
  v_required text := public.sm_norm(coalesce(nullif(p_target, ''), substring(coalesce(p_notes, '') from '\[ESP:([^\]]*)\]')));
  v_mine text := public.sm_norm(p_mine);
begin
  if v_required = '' or v_required = 'geral' then
    return true;
  end if;
  return v_mine <> '' and (v_required = v_mine or position(v_mine in v_required) > 0 or position(v_required in v_mine) > 0);
end;
$$;

-- Mesma trava de 20261127120000, agora conferindo a especialidade de quem assume a vaga.
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
    if not public.sm_specialty_ok(old.target_specialty, old.notes, (select p.specialty from public.professionals p where p.id = new.professional_id)) then
      raise exception 'Esta vaga é de outra especialidade. Só a coordenação pode escalar você nela.' using errcode = '42501';
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

commit;

notify pgrst, 'reload schema';

-- Conferência: deve mostrar true, false e true.
select position('sm_specialty_ok' in pg_get_functiondef('public.shifts_guard_professional_changes()'::regprocedure)) > 0 as trava_especialidade,
       public.sm_specialty_ok('Cardiologia', '', '') as sem_especialidade_ve_cardiologia,
       public.sm_specialty_ok('Geral', '', '') as sem_especialidade_ve_geral;
