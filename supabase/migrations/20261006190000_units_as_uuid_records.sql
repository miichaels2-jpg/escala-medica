begin;

create table if not exists public.units (
  id uuid primary key default uuid_generate_v4(),
  company_id text not null references public.companies(id) on delete cascade,
  legacy_id text not null,
  name text not null,
  cnpj text,
  address text,
  phone text,
  email text,
  primary_contact text,
  logo_url text,
  status text not null default 'ativo',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint units_company_legacy_id_key unique (company_id, legacy_id),
  constraint units_company_id_pair_key unique (company_id, id)
);

create index if not exists units_company_id_idx on public.units(company_id);

insert into public.units (
  company_id,
  legacy_id,
  name,
  cnpj,
  address,
  phone,
  email,
  primary_contact,
  logo_url,
  status
)
select
  company.id,
  unit.value ->> 'id',
  coalesce(nullif(unit.value ->> 'name', ''), 'Unidade sem nome'),
  unit.value ->> 'cnpj',
  unit.value ->> 'address',
  unit.value ->> 'phone',
  unit.value ->> 'email',
  unit.value ->> 'primary_contact',
  unit.value ->> 'logo_url',
  coalesce(nullif(unit.value ->> 'status', ''), 'ativo')
from public.companies as company
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(company.units) = 'array' and jsonb_array_length(company.units) > 0
      then company.units
    when jsonb_typeof(company.data -> 'units') = 'array'
      then company.data -> 'units'
    else '[]'::jsonb
  end
) as unit(value)
where nullif(unit.value ->> 'id', '') is not null
on conflict (company_id, legacy_id) do update set
  name = excluded.name,
  cnpj = excluded.cnpj,
  address = excluded.address,
  phone = excluded.phone,
  email = excluded.email,
  primary_contact = excluded.primary_contact,
  logo_url = excluded.logo_url,
  status = excluded.status,
  updated_date = now();

do $$
begin
  if exists (
    select 1
    from public.companies as company
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(company.units) = 'array' and jsonb_array_length(company.units) > 0
          then company.units
        when jsonb_typeof(company.data -> 'units') = 'array'
          then company.data -> 'units'
        else '[]'::jsonb
      end
    ) as unit(value)
    where nullif(unit.value ->> 'id', '') is null
  ) then
    raise exception 'Migration aborted: at least one embedded hospital unit has no id.';
  end if;
end $$;

create schema units_uuid_migration_20261006;
revoke all on schema units_uuid_migration_20261006 from public, anon, authenticated;

create or replace function units_uuid_migration_20261006.map_unit_id(p_company_id text, p_unit_id text)
returns text
language sql
stable
as $$
  select coalesce(
    (
      select unit.id::text
      from public.units as unit
      where unit.company_id = p_company_id
        and (unit.legacy_id = p_unit_id or unit.id::text = p_unit_id)
      order by (unit.id::text = p_unit_id) desc
      limit 1
    ),
    p_unit_id
  );
$$;

create or replace function units_uuid_migration_20261006.map_unit_array(p_company_id text, p_values jsonb)
returns jsonb
language sql
stable
as $$
  select coalesce(
    jsonb_agg(
      to_jsonb(units_uuid_migration_20261006.map_unit_id(p_company_id, item.value #>> '{}'))
      order by item.ordinality
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(p_values) with ordinality as item(value, ordinality);
$$;

create or replace function units_uuid_migration_20261006.map_unit_object(p_company_id text, p_values jsonb)
returns jsonb
language sql
stable
as $$
  with mapped as (
    select
      entry.key,
      entry.value,
      units_uuid_migration_20261006.map_unit_id(p_company_id, entry.key) as mapped_key,
      exists (
        select 1
        from public.units as unit
        where unit.company_id = p_company_id
          and unit.id::text = entry.key
      ) as is_already_uuid
    from jsonb_each(p_values) as entry
  ),
  preferred as (
    select distinct on (mapped_key) mapped_key, value
    from mapped
    order by mapped_key, is_already_uuid desc, key
  )
  select coalesce(jsonb_object_agg(mapped_key, value), '{}'::jsonb)
  from preferred;
$$;

create or replace function units_uuid_migration_20261006.unit_id_exists(p_company_id text, p_unit_id text)
returns boolean
language sql
stable
as $$
  select p_unit_id is null or exists (
    select 1
    from public.units as unit
    where unit.company_id = p_company_id
      and (unit.legacy_id = p_unit_id or unit.id::text = p_unit_id)
  );
$$;

create or replace function units_uuid_migration_20261006.unit_array_is_mapped(p_company_id text, p_values jsonb)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1
    from jsonb_array_elements(p_values) as item(value)
    where not units_uuid_migration_20261006.unit_id_exists(p_company_id, item.value #>> '{}')
  );
$$;

create or replace function units_uuid_migration_20261006.unit_object_keys_are_mapped(p_company_id text, p_values jsonb)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1
    from jsonb_object_keys(p_values) as item(key)
    where not units_uuid_migration_20261006.unit_id_exists(p_company_id, item.key)
  );
$$;

create or replace function units_uuid_migration_20261006.map_professional_unit_data(p_company_id text, p_data jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  mapped jsonb := p_data;
begin
  if jsonb_typeof(mapped -> 'allowed_unit_ids') = 'array' then
    mapped := jsonb_set(
      mapped,
      '{allowed_unit_ids}',
      units_uuid_migration_20261006.map_unit_array(p_company_id, mapped -> 'allowed_unit_ids')
    );
  end if;
  if jsonb_typeof(mapped -> 'unit_monthly_salaries') = 'object' then
    mapped := jsonb_set(
      mapped,
      '{unit_monthly_salaries}',
      units_uuid_migration_20261006.map_unit_object(p_company_id, mapped -> 'unit_monthly_salaries')
    );
  end if;
  if jsonb_typeof(mapped -> 'unit_rates') = 'object' then
    mapped := jsonb_set(
      mapped,
      '{unit_rates}',
      units_uuid_migration_20261006.map_unit_object(p_company_id, mapped -> 'unit_rates')
    );
  end if;
  if jsonb_typeof(mapped -> 'daily_productivity_attendance') = 'object' then
    mapped := jsonb_set(
      mapped,
      '{daily_productivity_attendance}',
      units_uuid_migration_20261006.map_unit_object(p_company_id, mapped -> 'daily_productivity_attendance')
    );
  end if;
  if mapped ? 'unit_id' then
    mapped := jsonb_set(
      mapped,
      '{unit_id}',
      to_jsonb(units_uuid_migration_20261006.map_unit_id(p_company_id, mapped ->> 'unit_id'))
    );
  end if;
  return mapped;
end;
$$;

create or replace function units_uuid_migration_20261006.map_user_unit_data(p_company_id text, p_data jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  mapped jsonb := p_data;
begin
  if jsonb_typeof(mapped -> 'allowed_unit_ids') = 'array' then
    mapped := jsonb_set(
      mapped,
      '{allowed_unit_ids}',
      units_uuid_migration_20261006.map_unit_array(p_company_id, mapped -> 'allowed_unit_ids')
    );
  end if;
  if mapped ? 'selected_unit_id' then
    mapped := jsonb_set(
      mapped,
      '{selected_unit_id}',
      to_jsonb(units_uuid_migration_20261006.map_unit_id(p_company_id, mapped ->> 'selected_unit_id'))
    );
  end if;
  if mapped ? 'unit_id' then
    mapped := jsonb_set(
      mapped,
      '{unit_id}',
      to_jsonb(units_uuid_migration_20261006.map_unit_id(p_company_id, mapped ->> 'unit_id'))
    );
  end if;
  return mapped;
end;
$$;

create or replace function units_uuid_migration_20261006.map_company_unit_data(p_company_id text, p_data jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  mapped jsonb := p_data;
begin
  if jsonb_typeof(mapped -> 'units') = 'array' then
    mapped := jsonb_set(
      mapped,
      '{units}',
      (
        select coalesce(
          jsonb_agg(
            unit.value || jsonb_build_object(
              'id',
              units_uuid_migration_20261006.map_unit_id(p_company_id, unit.value ->> 'id'),
              'legacy_id',
              coalesce(unit.value ->> 'legacy_id', unit.value ->> 'id')
            )
            order by unit.ordinality
          ),
          '[]'::jsonb
        )
        from jsonb_array_elements(mapped -> 'units') with ordinality as unit(value, ordinality)
      )
    );
  end if;
  if jsonb_typeof(mapped -> 'productivity_pool_rule') = 'object'
     and mapped -> 'productivity_pool_rule' ? 'unit_id' then
    mapped := jsonb_set(
      mapped,
      '{productivity_pool_rule,unit_id}',
      to_jsonb(units_uuid_migration_20261006.map_unit_id(
        p_company_id,
        mapped -> 'productivity_pool_rule' ->> 'unit_id'
      ))
    );
  end if;
  if mapped ? 'selected_unit_id' then
    mapped := jsonb_set(
      mapped,
      '{selected_unit_id}',
      to_jsonb(units_uuid_migration_20261006.map_unit_id(p_company_id, mapped ->> 'selected_unit_id'))
    );
  end if;
  return mapped;
end;
$$;

update public.sectors as sector
set unit_id = units_uuid_migration_20261006.map_unit_id(sector.company_id, sector.unit_id)
where sector.unit_id is not null;

update public.shifts as shift
set unit_id = units_uuid_migration_20261006.map_unit_id(shift.company_id, shift.unit_id)
where shift.unit_id is not null;

update public.shift_swaps as swap
set unit_id = units_uuid_migration_20261006.map_unit_id(swap.company_id, swap.unit_id)
where swap.unit_id is not null;

update public.billing_records as billing
set unit_id = units_uuid_migration_20261006.map_unit_id(billing.company_id, billing.unit_id)
where billing.unit_id is not null;

update public.professionals as professional
set
  unit_id = units_uuid_migration_20261006.map_unit_id(professional.company_id, professional.unit_id),
  unit_ids = case
    when jsonb_typeof(professional.unit_ids) = 'array'
      then units_uuid_migration_20261006.map_unit_array(professional.company_id, professional.unit_ids)
    else professional.unit_ids
  end,
  data = case
    when jsonb_typeof(professional.data) = 'object'
      then units_uuid_migration_20261006.map_professional_unit_data(professional.company_id, professional.data)
    else professional.data
  end
where professional.unit_id is not null
   or (jsonb_typeof(professional.unit_ids) = 'array' and professional.unit_ids <> '[]'::jsonb)
   or jsonb_typeof(professional.data) = 'object';

update public.users as app_user
set data = case
  when jsonb_typeof(app_user.data) = 'object'
    then units_uuid_migration_20261006.map_user_unit_data(app_user.data ->> 'company_id', app_user.data)
  else app_user.data
end
where jsonb_typeof(app_user.data) = 'object';

update public.companies as company
set
  selected_unit_id = units_uuid_migration_20261006.map_unit_id(company.id, company.selected_unit_id),
  units = case
    when jsonb_typeof(company.units) = 'array' then (
      select coalesce(
        jsonb_agg(
          unit.value || jsonb_build_object(
            'id',
            units_uuid_migration_20261006.map_unit_id(company.id, unit.value ->> 'id'),
            'legacy_id',
            coalesce(unit.value ->> 'legacy_id', unit.value ->> 'id')
          )
          order by unit.ordinality
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(company.units) with ordinality as unit(value, ordinality)
    )
    else company.units
  end,
  data = case
    when jsonb_typeof(company.data) = 'object'
      then units_uuid_migration_20261006.map_company_unit_data(company.id, company.data)
    else company.data
  end;

do $$
begin
  if exists (
    select 1
    from public.sectors as row_data
    where nullif(row_data.unit_id, '') is not null
      and not exists (select 1 from public.units unit where unit.company_id = row_data.company_id and unit.id::text = row_data.unit_id)
  ) or exists (
    select 1
    from public.shifts as row_data
    where nullif(row_data.unit_id, '') is not null
      and not exists (select 1 from public.units unit where unit.company_id = row_data.company_id and unit.id::text = row_data.unit_id)
  ) or exists (
    select 1
    from public.shift_swaps as row_data
    where nullif(row_data.unit_id, '') is not null
      and not exists (select 1 from public.units unit where unit.company_id = row_data.company_id and unit.id::text = row_data.unit_id)
  ) or exists (
    select 1
    from public.billing_records as row_data
    where nullif(row_data.unit_id, '') is not null
      and not exists (select 1 from public.units unit where unit.company_id = row_data.company_id and unit.id::text = row_data.unit_id)
  ) or exists (
    select 1
    from public.professionals as row_data
    where nullif(row_data.unit_id, '') is not null
      and not exists (select 1 from public.units unit where unit.company_id = row_data.company_id and unit.id::text = row_data.unit_id)
  ) or exists (
    select 1
    from public.companies as row_data
    where nullif(row_data.selected_unit_id, '') is not null
      and not exists (select 1 from public.units unit where unit.company_id = row_data.id and unit.id::text = row_data.selected_unit_id)
  ) or exists (
    select 1
    from public.professionals as row_data
    where (jsonb_typeof(row_data.unit_ids) = 'array'
        and not units_uuid_migration_20261006.unit_array_is_mapped(row_data.company_id, row_data.unit_ids))
       or (jsonb_typeof(row_data.data -> 'allowed_unit_ids') = 'array'
        and not units_uuid_migration_20261006.unit_array_is_mapped(row_data.company_id, row_data.data -> 'allowed_unit_ids'))
       or (row_data.data ? 'unit_id'
        and not units_uuid_migration_20261006.unit_id_exists(row_data.company_id, row_data.data ->> 'unit_id'))
       or (jsonb_typeof(row_data.data -> 'unit_monthly_salaries') = 'object'
        and not units_uuid_migration_20261006.unit_object_keys_are_mapped(row_data.company_id, row_data.data -> 'unit_monthly_salaries'))
       or (jsonb_typeof(row_data.data -> 'unit_rates') = 'object'
        and not units_uuid_migration_20261006.unit_object_keys_are_mapped(row_data.company_id, row_data.data -> 'unit_rates'))
       or (jsonb_typeof(row_data.data -> 'daily_productivity_attendance') = 'object'
        and not units_uuid_migration_20261006.unit_object_keys_are_mapped(row_data.company_id, row_data.data -> 'daily_productivity_attendance'))
  ) or exists (
    select 1
    from public.users as row_data
    where (jsonb_typeof(row_data.data -> 'allowed_unit_ids') = 'array'
        and not units_uuid_migration_20261006.unit_array_is_mapped(row_data.data ->> 'company_id', row_data.data -> 'allowed_unit_ids'))
       or (row_data.data ? 'selected_unit_id'
        and not units_uuid_migration_20261006.unit_id_exists(row_data.data ->> 'company_id', row_data.data ->> 'selected_unit_id'))
       or (row_data.data ? 'unit_id'
        and not units_uuid_migration_20261006.unit_id_exists(row_data.data ->> 'company_id', row_data.data ->> 'unit_id'))
  ) or exists (
    select 1
    from public.companies as row_data
    where row_data.data ? 'selected_unit_id'
      and not units_uuid_migration_20261006.unit_id_exists(row_data.id, row_data.data ->> 'selected_unit_id')
  ) or exists (
    select 1
    from public.companies as row_data
    where jsonb_typeof(row_data.data -> 'productivity_pool_rule') = 'object'
      and row_data.data -> 'productivity_pool_rule' ? 'unit_id'
      and not units_uuid_migration_20261006.unit_id_exists(
        row_data.id,
        row_data.data -> 'productivity_pool_rule' ->> 'unit_id'
      )
  ) then
    raise exception 'Migration aborted: a unit reference does not match a migrated hospital. Resolve the legacy reference before retrying.';
  end if;
end $$;

alter table public.sectors
  alter column unit_id type uuid using nullif(unit_id, '')::uuid;
alter table public.shifts
  alter column unit_id type uuid using nullif(unit_id, '')::uuid;
alter table public.shift_swaps
  alter column unit_id type uuid using nullif(unit_id, '')::uuid;
alter table public.billing_records
  alter column unit_id type uuid using nullif(unit_id, '')::uuid;
alter table public.professionals
  alter column unit_id type uuid using nullif(unit_id, '')::uuid;
alter table public.companies
  alter column selected_unit_id type uuid using nullif(selected_unit_id, '')::uuid;

alter table public.sectors
  add constraint sectors_company_unit_id_fkey
  foreign key (company_id, unit_id) references public.units(company_id, id) on delete restrict;
alter table public.shifts
  add constraint shifts_company_unit_id_fkey
  foreign key (company_id, unit_id) references public.units(company_id, id) on delete restrict;
alter table public.shift_swaps
  add constraint shift_swaps_company_unit_id_fkey
  foreign key (company_id, unit_id) references public.units(company_id, id) on delete restrict;
alter table public.billing_records
  add constraint billing_records_company_unit_id_fkey
  foreign key (company_id, unit_id) references public.units(company_id, id) on delete restrict;
alter table public.professionals
  add constraint professionals_company_unit_id_fkey
  foreign key (company_id, unit_id) references public.units(company_id, id) on delete restrict;
alter table public.companies
  add constraint companies_selected_unit_id_fkey
  foreign key (id, selected_unit_id) references public.units(company_id, id) on delete restrict;

alter table public.units enable row level security;
drop policy if exists "Allow app access units" on public.units;
create policy "Allow app access units"
  on public.units
  for all
  using (true)
  with check (true);

grant select, insert, update, delete on public.units to anon, authenticated;

drop schema units_uuid_migration_20261006 cascade;

commit;
