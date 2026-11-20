-- Formulário de credenciamento novo (V0.3.5).
-- - registration_company devolve também as especialidades que o hospital já usa (profissionais
--   e plantões), para o profissional escolher da lista e casar com a regra do Mural.
-- - submit_registration grava a UF do conselho (document_uf) e exige o aceite da LGPD, guardando
--   a data e hora do aceite na ficha.
begin;

create or replace function public.registration_company(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'name', c.name,
    'specialties', coalesce((
      select jsonb_agg(s.name order by s.name)
        from (
          select distinct trim(p.specialty) as name from public.professionals p
           where p.company_id = c.id and coalesce(p.status, '') <> 'pendente'
             and coalesce(trim(p.specialty), '') not in ('', 'Geral')
          union
          select distinct trim(sh.target_specialty) from public.shifts sh
           where sh.company_id = c.id and coalesce(trim(sh.target_specialty), '') not in ('', 'Geral')
        ) s
    ), '[]'::jsonb)
  )
    from public.companies c
   where c.registration_code = lower(trim(coalesce(p_code, '')))
$$;

create or replace function public.submit_registration(p_code text, p_payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company text;
  v_name text := left(trim(coalesce(p_payload ->> 'name', '')), 200);
  v_data jsonb := case when jsonb_typeof(p_payload -> 'data') = 'object' then p_payload -> 'data' else '{}'::jsonb end;
begin
  select id into v_company from public.companies where registration_code = lower(trim(coalesce(p_code, '')));
  if v_company is null then
    raise exception 'Código do hospital não encontrado. Confira o link enviado pela coordenação.';
  end if;
  if v_name = '' then
    raise exception 'Informe o nome completo.';
  end if;
  if coalesce(v_data ->> 'lgpd_consent', 'false') <> 'true' then
    raise exception 'É preciso aceitar o uso dos dados (LGPD) para enviar a ficha.';
  end if;
  if length(p_payload::text) > 20000 then
    raise exception 'Ficha grande demais.';
  end if;

  insert into public.professionals (company_id, name, category, specialty, rqe, cbo, cpf, birth_date, document,
                                    document_uf, document_expiry, phone, email, pix_type, pix_key, bank_info, status, data)
  values (
    v_company, v_name,
    coalesce(nullif(left(v_data ->> 'category', 40), ''), 'medico'),
    left(p_payload ->> 'specialty', 200), left(p_payload ->> 'rqe', 50), left(p_payload ->> 'cbo', 50),
    left(p_payload ->> 'cpf', 20), nullif(left(p_payload ->> 'birth_date', 10), '')::date, left(p_payload ->> 'document', 50),
    nullif(left(p_payload ->> 'document_uf', 2), ''), nullif(left(p_payload ->> 'document_expiry', 10), ''),
    left(p_payload ->> 'phone', 30), left(lower(p_payload ->> 'email'), 200),
    coalesce(nullif(left(v_data ->> 'pix_type', 20), ''), 'cpf'), left(v_data ->> 'pix_key', 200), left(v_data ->> 'bank_info', 300),
    'pendente',
    -- Ficha pública nunca traz permissões: o perfil é sempre plantonista até o gestor aprovar.
    (v_data - 'screen_access' - 'can_edit' - 'permissions' - 'company_id' - 'lgpd_consent')
      || jsonb_build_object('app_role', 'assistencial', 'lgpd_registration_accepted_at', now())
  );
  return true;
end;
$$;

revoke all on function public.registration_company(text) from public;
revoke all on function public.submit_registration(text, jsonb) from public;
grant execute on function public.registration_company(text) to anon, authenticated;
grant execute on function public.submit_registration(text, jsonb) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
