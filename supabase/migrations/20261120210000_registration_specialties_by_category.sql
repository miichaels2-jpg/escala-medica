-- Credenciamento: especialidades do hospital separadas por categoria (V0.3.7).
-- Cada item vem com a categoria de quem já usa a especialidade (profissionais aprovados). As que só
-- aparecem em plantões vêm sem categoria; o formulário as encaixa pela lista padrão de cada
-- categoria (sem encaixe, ficam com médico, que é quem mais aparece nas vagas).
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
      select jsonb_agg(jsonb_build_object('name', s.name, 'category', s.category) order by s.name)
        from (
          select distinct on (lower(trim(p.specialty))) trim(p.specialty) as name,
                 coalesce(nullif(p.data ->> 'category', ''), nullif(p.category, ''), 'medico') as category
            from public.professionals p
           where p.company_id = c.id and coalesce(p.status, '') <> 'pendente'
             and coalesce(trim(p.specialty), '') not in ('', 'Geral')
          union
          select distinct trim(sh.target_specialty), null
            from public.shifts sh
           where sh.company_id = c.id and coalesce(trim(sh.target_specialty), '') not in ('', 'Geral')
             and not exists (select 1 from public.professionals p2
                              where p2.company_id = c.id and lower(trim(p2.specialty)) = lower(trim(sh.target_specialty)))
        ) s
    ), '[]'::jsonb)
  )
    from public.companies c
   where c.registration_code = lower(trim(coalesce(p_code, '')))
$$;

revoke all on function public.registration_company(text) from public;
grant execute on function public.registration_company(text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
