-- Demonstração que se monta sozinha (V0.10.8). A página pública /demonstracao chama create_demo_company:
-- cria um hospital fictício já com setores, turnos, valores, 12 profissionais e a escala do mês
-- publicada, mais dois acessos (coordenação e plantonista). Tudo some em 7 dias (pg_cron, todo dia).
-- Limites: uma demonstração por e-mail a cada 24 h e no máximo 20 por hora no total.
-- Pode rodar de novo sem erro.
begin;

create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  phone text,
  company_name text,
  company_id text,
  created_at timestamptz not null default now()
);
alter table public.demo_requests enable row level security;
revoke all on public.demo_requests from anon, authenticated;

create or replace function public.create_demo_company(p_name text, p_email text, p_company text default '', p_phone text default '')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := left(trim(coalesce(p_name, '')), 80);
  v_company_name text := left(coalesce(nullif(trim(p_company), ''), 'Hospital Demonstração'), 80);
  v_company public.companies;
  v_unit uuid;
  v_month_start date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
  v_month_end date := (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) + interval '1 month - 1 day')::date;
  v_tag text := substr(md5(random()::text || clock_timestamp()::text), 1, 6);
  v_sec_ps text := 'sec_' || gen_random_uuid();
  v_sec_ped text := 'sec_' || gen_random_uuid();
  v_sec_cc text := 'sec_' || gen_random_uuid();
  v_names text[] := array['Ana Beatriz Rocha', 'Carlos Eduardo Lima', 'Fernanda Alves Costa', 'Rafael Mendes Duarte', 'Juliana Prado Nunes', 'Marcos Vinícius Teixeira',
                          'Patrícia Gomes Freitas', 'Lucas Ferreira Barros', 'Camila Ribeiro Santos', 'Bruno Cardoso Melo', 'Larissa Martins Pires', 'Thiago Azevedo Reis'];
  v_specs text[] := array['Clínica Médica', 'Clínica Médica', 'Clínica Médica', 'Clínica Médica', 'Clínica Médica', 'Clínica Médica',
                          'Pediatria', 'Pediatria', 'Pediatria', 'Cirurgia Geral', 'Cirurgia Geral', 'Cirurgia Geral'];
  v_prof_ids text[] := array[]::text[];
  v_prof text;
  v_sector text;
  i int;
  d date;
  v_pos int;
  v_slot record;
  v_pool text[];
  v_pick text;
  v_manager_pass text := 'Demo' || (1000 + floor(random() * 9000))::int || substr(md5(random()::text), 1, 3);
  v_plant_pass text := 'Plantao' || (1000 + floor(random() * 9000))::int;
  v_manager_user text := 'demo.' || v_tag;
  v_plant_user text := 'demo.' || v_tag || '.plantao';
  v_manager_id text;
  v_plant_id text;
  v_expires timestamptz := now() + interval '7 days';
begin
  if v_name = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Informe seu nome e um e-mail válido.';
  end if;
  if exists (select 1 from public.demo_requests where email = v_email and created_at > now() - interval '24 hours') then
    raise exception 'Já existe uma demonstração para este e-mail nas últimas 24 horas. Use o acesso que apareceu na tela ou fale com o ScaleMedic.';
  end if;
  if (select count(*) from public.demo_requests where created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Muitas demonstrações criadas agora. Tente de novo em alguns minutos.';
  end if;

  -- Empresa, unidade e regras (turnos padrão, valores, retenção).
  insert into public.companies (name, app_name, plan, data)
  values (v_company_name, 'ScaleMedic', 'demo', jsonb_build_object(
    'created_by', 'demonstracao', 'demo_expires_at', v_expires,
    'demo_contact', jsonb_build_object('name', v_name, 'email', v_email, 'phone', left(coalesce(p_phone, ''), 30)),
    'default_retention_rate', 11,
    'sector_shift_templates', jsonb_build_object(
      v_sec_ps, jsonb_build_array(jsonb_build_object('specialty', 'Clínica Médica', 'start_time', '07:00', 'end_time', '19:00', 'quantity', 2),
                                  jsonb_build_object('specialty', 'Clínica Médica', 'start_time', '19:00', 'end_time', '07:00', 'quantity', 1)),
      v_sec_ped, jsonb_build_array(jsonb_build_object('specialty', 'Pediatria', 'start_time', '07:00', 'end_time', '19:00', 'quantity', 1),
                                   jsonb_build_object('specialty', 'Pediatria', 'start_time', '19:00', 'end_time', '07:00', 'quantity', 1)),
      v_sec_cc, jsonb_build_array(jsonb_build_object('specialty', 'Cirurgia Geral', 'start_time', '07:00', 'end_time', '19:00', 'quantity', 1))),
    'sector_rates', jsonb_build_object(
      v_sec_ps, jsonb_build_object('semana_dia', 1200, 'semana_noite', 1400, 'fds_dia', 1500, 'fds_noite', 1700),
      v_sec_ped, jsonb_build_object('semana_dia', 1300, 'semana_noite', 1500, 'fds_dia', 1600, 'fds_noite', 1800),
      v_sec_cc, jsonb_build_object('semana_dia', 1600, 'semana_noite', 1800, 'fds_dia', 2000, 'fds_noite', 2200))))
  returning * into v_company;

  insert into public.units (company_id, legacy_id, name)
  values (v_company.id, 'unit_demo_' || v_tag, v_company_name || ' · Unidade Central')
  returning id into v_unit;

  insert into public.sectors (id, company_id, unit_id, name, specialty, active) values
    (v_sec_ps, v_company.id, v_unit::text, 'Pronto-Socorro', 'Geral', true),
    (v_sec_ped, v_company.id, v_unit::text, 'Pediatria', 'Geral', true),
    (v_sec_cc, v_company.id, v_unit::text, 'Centro Cirúrgico', 'Geral', true);

  -- Profissionais fictícios (dados inventados), cada um liberado nos setores da sua especialidade.
  for i in 1..array_length(v_names, 1) loop
    v_prof := 'prof_' || gen_random_uuid();
    v_sector := case v_specs[i] when 'Clínica Médica' then v_sec_ps when 'Pediatria' then v_sec_ped else v_sec_cc end;
    insert into public.professionals (id, company_id, unit_id, unit_ids, name, category, specialty, status, remuneration_type, data)
    values (v_prof, v_company.id, v_unit::text, jsonb_build_array(v_unit::text), v_names[i], 'medico', v_specs[i], 'ativo', 'plantao',
      jsonb_build_object('status', 'ativo', 'category', 'medico', 'specialty', v_specs[i], 'remuneration_type', 'plantao',
        'allowed_unit_ids', jsonb_build_array(v_unit::text), 'authorized_sectors', jsonb_build_array(v_sector),
        'registration_id', 'MAT-DEMO-' || lpad(i::text, 2, '0'), 'demo', true));
    v_prof_ids := v_prof_ids || v_prof;
  end loop;

  -- Escala do mês: turnos padrão de cada setor; cerca de 1 em 5 fica como vaga aberta.
  for v_slot in
    select * from (values
      (v_sec_ps, 'Pronto-Socorro', 'Clínica Médica', '07:00', '19:00', 2, 1, 6),
      (v_sec_ps, 'Pronto-Socorro', 'Clínica Médica', '19:00', '07:00', 1, 1, 6),
      (v_sec_ped, 'Pediatria', 'Pediatria', '07:00', '19:00', 1, 7, 3),
      (v_sec_ped, 'Pediatria', 'Pediatria', '19:00', '07:00', 1, 7, 3),
      (v_sec_cc, 'Centro Cirúrgico', 'Cirurgia Geral', '07:00', '19:00', 1, 10, 3)
    ) as t(sector_id, sector_name, specialty, start_time, end_time, quantity, first_idx, pool_size)
  loop
    v_pool := v_prof_ids[v_slot.first_idx:v_slot.first_idx + v_slot.pool_size - 1];
    for d in select generate_series(v_month_start, v_month_end, interval '1 day')::date loop
      for i in 0..v_slot.quantity - 1 loop
        v_pos := (extract(day from d)::int * 3 + case when v_slot.start_time = '19:00' then 2 else i end) % v_slot.pool_size;
        v_pick := case when (extract(day from d)::int + i + case when v_slot.start_time = '19:00' then 2 else 0 end) % 5 = 0 then null else v_pool[v_pos + 1] end;
        insert into public.shifts (id, company_id, unit_id, sector_id, sector_name, professional_id, professional_name, date, start_time, end_time,
                                   shift_type, status, duration_hours, notes, target_specialty)
        values ('shift_' || gen_random_uuid(), v_company.id, v_unit::text, v_slot.sector_id, v_slot.sector_name, v_pick,
                (select name from public.professionals where id = v_pick), to_char(d, 'YYYY-MM-DD'), v_slot.start_time, v_slot.end_time,
                case when v_slot.start_time = '19:00' then 'noturno' else 'diurno' end,
                case when v_pick is null then 'vago' when d < (now() at time zone 'America/Sao_Paulo')::date then 'realizado' else 'confirmado' end,
                12, '[ESP:' || v_slot.specialty || '] [GERADO_ESCALA_MASSA] [ESCALA_PUBLICADA]', v_slot.specialty);
      end loop;
    end loop;
  end loop;

  insert into public.published_schedules (company_id, unit_id, sector_id, year, month, ranges, updated_by)
  select v_company.id, v_unit::text, s, extract(year from v_month_start)::int, extract(month from v_month_start)::int,
         jsonb_build_array(jsonb_build_object('start_date', to_char(v_month_start, 'YYYY-MM-DD'), 'end_date', to_char(v_month_end, 'YYYY-MM-DD'), 'published_at', now())),
         'Demonstração'
    from unnest(array[v_sec_ps, v_sec_ped, v_sec_cc]) s;

  -- Acessos: coordenação e um plantonista (a Ana, de Clínica Médica). Sem troca de senha obrigatória.
  insert into public.users (username, email, full_name, role, password, data)
  values (v_manager_user, v_manager_user || '@scalemedic.local', v_name, 'user', v_manager_pass, jsonb_build_object(
    'company_id', v_company.id, 'app_role', 'gestor', 'allowed_unit_ids', jsonb_build_array(v_unit::text),
    'selected_unit_id', v_unit::text, 'must_change_password', false, 'is_active', true, 'demo', true))
  returning id into v_manager_id;

  insert into public.users (username, email, full_name, role, password, data)
  values (v_plant_user, v_plant_user || '@scalemedic.local', v_names[1], 'user', v_plant_pass, jsonb_build_object(
    'company_id', v_company.id, 'app_role', 'assistencial', 'allowed_unit_ids', jsonb_build_array(v_unit::text),
    'selected_unit_id', v_unit::text, 'must_change_password', false, 'is_active', true, 'professional_id', v_prof_ids[1], 'demo', true))
  returning id into v_plant_id;
  update public.professionals set user_id = v_plant_id, data = data || jsonb_build_object('username', v_plant_user) where id = v_prof_ids[1];

  insert into public.demo_requests (email, name, phone, company_name, company_id)
  values (v_email, v_name, left(coalesce(p_phone, ''), 30), v_company_name, v_company.id);

  return jsonb_build_object(
    'company_name', v_company_name, 'expires_at', v_expires,
    'manager', jsonb_build_object('username', v_manager_user, 'password', v_manager_pass),
    'professional', jsonb_build_object('username', v_plant_user, 'password', v_plant_pass, 'name', v_names[1]));
end;
$$;
revoke all on function public.create_demo_company(text, text, text, text) from public;
grant execute on function public.create_demo_company(text, text, text, text) to anon, authenticated;

-- Apaga as demonstrações vencidas: todas as tabelas com company_id, os logins da empresa e a empresa.
create or replace function public.purge_expired_demos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  t record;
  v_count integer := 0;
begin
  for c in select id from public.companies
            where plan = 'demo' and coalesce((data ->> 'demo_expires_at')::timestamptz, created_date + interval '7 days') < now() loop
    if to_regclass('public.announcement_reads') is not null then delete from public.announcement_reads where company_id = c.id; end if;
    for t in select table_name from information_schema.columns
              where table_schema = 'public' and column_name = 'company_id'
                and table_name not in ('companies', 'demo_requests', 'audit_log', 'announcement_reads')
                and table_name in (select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE') loop
      execute format('delete from public.%I where company_id = $1', t.table_name) using c.id;
    end loop;
    delete from public.users where coalesce(data ->> 'company_id', '') = c.id and coalesce(data ->> 'demo', 'false') = 'true';
    if to_regclass('public.audit_log') is not null then delete from public.audit_log where company_id = c.id; end if;
    delete from public.companies where id = c.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.purge_expired_demos() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'scalemedic-demo-cleanup') then
    perform cron.unschedule('scalemedic-demo-cleanup');
  end if;
  perform cron.schedule('scalemedic-demo-cleanup', '15 6 * * *', 'select public.purge_expired_demos()');
end $$;

commit;

notify pgrst, 'reload schema';

-- Conferência: deve mostrar 2 e 1.
select (select count(*) from pg_proc where proname in ('create_demo_company', 'purge_expired_demos')) as funcoes_novas,
       (select count(*) from cron.job where jobname = 'scalemedic-demo-cleanup') as limpeza_agendada;
