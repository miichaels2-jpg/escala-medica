-- Hospital novo cadastrado na empresa já fica liberado para os gestores gerais dela (V0.3.3).
-- Sem isso, o gestor criado pela tela Plataforma só via as unidades que existiam quando foi
-- criado e não enxergava o segundo hospital que ele mesmo cadastrasse em Configurações.
begin;

create or replace function public.units_grant_company_managers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users u
     set data = jsonb_set(
           coalesce(u.data, '{}'::jsonb),
           '{allowed_unit_ids}',
           case when jsonb_typeof(u.data -> 'allowed_unit_ids') = 'array' then u.data -> 'allowed_unit_ids' else '[]'::jsonb end
             || to_jsonb(new.id::text))
   where coalesce(u.data ->> 'company_id', 'cmp_principal') = new.company_id
     and coalesce(u.data ->> 'app_role', '') in ('gestor', 'manager')
     and not coalesce(u.data -> 'allowed_unit_ids', '[]'::jsonb) ? new.id::text;
  return new;
end;
$$;

revoke execute on function public.units_grant_company_managers() from public, anon, authenticated;

drop trigger if exists units_grant_company_managers on public.units;
create trigger units_grant_company_managers after insert on public.units
  for each row execute function public.units_grant_company_managers();

commit;
