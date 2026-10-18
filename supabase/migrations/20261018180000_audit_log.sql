-- Histórico de alterações (V0.2.1).
-- Um gatilho no banco registra toda inclusão, alteração e exclusão em plantões,
-- publicações de escala e status de pagamento — inclusive as feitas por versões
-- antigas do app. Quem fez vem do cabeçalho x-scalemedic-user-id que o app envia
-- em cada chamada (sem o cabeçalho, o autor fica em branco).
begin;

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  table_name text not null,
  record_id text,
  action text not null check (action in ('insert', 'update', 'delete')),
  company_id text,
  unit_id text,
  changed_by text,
  changed_fields text[],
  old_data jsonb,
  new_data jsonb
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_record_idx on public.audit_log (table_name, record_id, created_at desc);
create index if not exists audit_log_company_idx on public.audit_log (company_id, created_at desc);

create or replace function public.audit_log_capture()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_fields text[];
  v_headers json;
  v_user text;
begin
  if tg_op = 'UPDATE' then
    select array_agg(key order by key) into v_fields
    from jsonb_each(v_new) n
    where n.key not in ('updated_date', 'updated_at')
      and n.value is distinct from v_old -> n.key;
    -- Atualização sem mudança real (ex.: salvar sem alterar nada) não entra no histórico.
    if v_fields is null then
      return new;
    end if;
  end if;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
    v_user := nullif(v_headers ->> 'x-scalemedic-user-id', '');
  exception when others then
    v_user := null;
  end;

  insert into public.audit_log (table_name, record_id, action, company_id, unit_id, changed_by, changed_fields, old_data, new_data)
  values (
    tg_table_name,
    coalesce(v_row ->> 'id', concat_ws('|', v_row ->> 'unit_id', v_row ->> 'sector_id', v_row ->> 'professional_id', v_row ->> 'year', v_row ->> 'month')),
    lower(tg_op),
    v_row ->> 'company_id',
    v_row ->> 'unit_id',
    v_user,
    v_fields,
    v_old,
    v_new
  );

  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['shifts', 'published_schedules', 'payment_statuses'] loop
    execute format('drop trigger if exists audit_log_capture on public.%I', t);
    execute format('create trigger audit_log_capture after insert or update or delete on public.%I for each row execute function public.audit_log_capture()', t);
  end loop;
end $$;

-- O app só lê o histórico; quem grava é o gatilho (security definer).
alter table public.audit_log enable row level security;
drop policy if exists "Allow app read audit_log" on public.audit_log;
create policy "Allow app read audit_log" on public.audit_log for select using (true);
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to anon, authenticated;

commit;
