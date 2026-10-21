-- Alertas pelo servidor (V0.2.9): vaga urgente e lembretes de plantão saem a cada
-- 5 minutos pelo pg_cron, mesmo sem ninguém com o app aberto. Mesmas regras e as
-- mesmas chaves únicas (dedupe_key) do app: quem já recebeu não recebe de novo,
-- venha o aviso do servidor ou de um aparelho aberto. Cada aviso inserido em
-- notifications também vira push (gatilho notifications_send_push).
begin;

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_cron;

create or replace function public.sm_norm(p text)
returns text language sql stable set search_path = public, extensions as $$
  select lower(trim(extensions.unaccent(coalesce(p, ''))));
$$;

-- Mesma regra de src/lib/shiftLiveStatus.js (isShiftVacant).
create or replace function public.sm_is_vacant(p_professional_id text, p_professional_name text, p_status text)
returns boolean language plpgsql stable set search_path = public, extensions as $$
declare
  v_name text := public.sm_norm(p_professional_name);
  v_id text := public.sm_norm(p_professional_id);
begin
  if v_name like '%vaga%' or v_name like '%aberto%' or v_name like '%descoberto%' or v_name like '%sem profissional%' then
    return true;
  end if;
  if (v_id <> '' and v_id not in ('vago', 'vaga', 'null', 'undefined')) or v_name <> '' then
    return false;
  end if;
  return true;
end;
$$;

-- Início e fim reais do plantão (horário de Brasília; noturno termina no dia seguinte).
create or replace function public.sm_shift_range(p_date text, p_start text, p_end text, out starts_at timestamptz, out ends_at timestamptz)
language plpgsql stable as $$
declare
  v_start text := coalesce(nullif(p_start, ''), '07:00');
  v_end text := coalesce(nullif(p_end, ''), '19:00');
begin
  if coalesce(p_date, '') !~ '^\d{4}-\d{2}-\d{2}' or v_start !~ '^\d{1,2}:\d{2}' or v_end !~ '^\d{1,2}:\d{2}' then
    return;
  end if;
  starts_at := ((left(p_date, 10) || ' ' || left(v_start, 5))::timestamp) at time zone 'America/Sao_Paulo';
  ends_at := ((left(p_date, 10) || ' ' || left(v_end, 5))::timestamp) at time zone 'America/Sao_Paulo';
  if ends_at <= starts_at then ends_at := ends_at + interval '1 day'; end if;
end;
$$;

-- Unidades do profissional (mesma ordem de src/lib/sectorAccess.js getProfessionalUnitIds).
create or replace function public.sm_professional_units(p public.professionals)
returns text[] language sql stable as $$
  select case
    when jsonb_typeof(p.data -> 'allowed_unit_ids') = 'array' and jsonb_array_length(p.data -> 'allowed_unit_ids') > 0
      then array(select jsonb_array_elements_text(p.data -> 'allowed_unit_ids'))
    when jsonb_typeof(p.unit_ids) = 'array' and jsonb_array_length(p.unit_ids) > 0
      then array(select jsonb_array_elements_text(p.unit_ids))
    when p.unit_id is not null then array[p.unit_id::text]
    else array[]::text[]
  end;
$$;

-- Setor autorizado (setores vetados; formato antigo = lista de liberados).
create or replace function public.sm_sector_allowed(p public.professionals, p_sector_id text)
returns boolean language sql stable as $$
  select case
    when p_sector_id is null then true
    when jsonb_typeof(p.data -> 'blocked_sectors') = 'array' then not (p.data -> 'blocked_sectors') ? p_sector_id
    when jsonb_typeof(p.data -> 'authorized_sectors') = 'array' then (p.data -> 'authorized_sectors') ? p_sector_id
    else true
  end;
$$;

-- Especialidade compatível (regra rígida do Mural, como isVacancyRelevantFor).
create or replace function public.sm_specialty_ok(p_target text, p_notes text, p_mine text)
returns boolean language plpgsql stable set search_path = public, extensions as $$
declare
  v_required text := public.sm_norm(coalesce(nullif(p_target, ''), substring(coalesce(p_notes, '') from '\[ESP:([^\]]*)\]')));
  v_mine text := public.sm_norm(p_mine);
begin
  return v_required = '' or v_required = 'geral' or v_mine = '' or v_required = v_mine
    or position(v_mine in v_required) > 0 or position(v_required in v_mine) > 0;
end;
$$;

create or replace function public.sm_unavailable(p public.professionals, p_date text)
returns boolean language sql stable as $$
  select exists (
    select 1 from jsonb_array_elements(case when jsonb_typeof(p.data -> 'unavailability') = 'array' then p.data -> 'unavailability' else '[]'::jsonb end) u
    where left(p_date, 10) between least(u ->> 'start', u ->> 'end') and greatest(u ->> 'start', u ->> 'end')
  );
$$;

create or replace function public.run_shift_alerts()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_now timestamptz := now();
  v_urgent integer := 0;
  v_reminders integer := 0;
begin
  -- Plantões da janela (ontem até depois de amanhã), com início/fim reais.
  drop table if exists sm_window;
  create temporary table sm_window on commit drop as
  select s.id, s.company_id, s.unit_id::text as unit_id, s.sector_id, s.date, s.start_time, s.end_time,
         s.professional_id, s.target_specialty, s.notes,
         public.sm_is_vacant(s.professional_id, s.professional_name, s.status) as vacant,
         r.starts_at, r.ends_at
  from public.shifts s
  cross join lateral public.sm_shift_range(s.date, s.start_time, s.end_time) r
  where s.date between to_char((v_now at time zone 'America/Sao_Paulo')::date - 1, 'YYYY-MM-DD')
                   and to_char((v_now at time zone 'America/Sao_Paulo')::date + 2, 'YYYY-MM-DD')
    and public.sm_norm(s.status) not like '%cancel%'
    and r.starts_at is not null;

  -- 1) Vaga urgente: sem profissional, começa em até 24 h (ou já começou e não terminou).
  with urgent as (
    select w.* from sm_window w
    where w.vacant and w.ends_at > v_now and w.starts_at <= v_now + interval '24 hours'
  ),
  candidates as (
    select u.*, p.id as prof_id, p.user_id
    from urgent u
    join public.professionals p on coalesce(nullif(p.status, ''), p.data ->> 'status', 'ativo') = 'ativo'
    where (cardinality(public.sm_professional_units(p)) = 0 or u.unit_id = any (public.sm_professional_units(p)))
      and public.sm_sector_allowed(p, u.sector_id)
      and public.sm_specialty_ok(u.target_specialty, u.notes, p.specialty)
      and not public.sm_unavailable(p, u.date)
      and not exists (
        select 1 from sm_window o
        where o.professional_id = p.id and not o.vacant
          and o.starts_at < u.ends_at and u.starts_at < o.ends_at
      )
  ),
  inserted as (
    insert into public.notifications (company_id, unit_id, professional_id, user_id, type, category, title, message, data, dedupe_key)
    select c.company_id, c.unit_id, c.prof_id, c.user_id, 'vaga_urgente', 'vaga',
      'Vaga urgente: ' || coalesce(sec.name, 'Setor') || ' ' || to_char(left(c.date, 10)::date, 'DD/MM') || ' ' || left(coalesce(c.start_time, '07:00'), 5),
      coalesce(un.name || ' · ', '') || left(coalesce(c.start_time, '07:00'), 5) || '–' || left(coalesce(c.end_time, '19:00'), 5) || ' · ' ||
        case
          when c.starts_at <= v_now then 'já começou'
          when c.starts_at - v_now < interval '1 hour' then 'começa em ' || ceil(extract(epoch from c.starts_at - v_now) / 60)::int || ' min'
          else 'começa em ' || round(extract(epoch from c.starts_at - v_now) / 3600)::int || ' h'
        end || '. Abra o Mural para assumir.',
      jsonb_build_object('shift_id', c.id, 'date', c.date, 'origem', 'servidor'),
      'vaga_urgente:' || c.id || ':' || c.prof_id
    from candidates c
    left join public.sectors sec on sec.id = c.sector_id
    left join public.units un on un.id::text = c.unit_id
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*) into v_urgent from inserted;

  -- 2) Lembretes do próprio plantão (12 h e 1 h antes), só de escala publicada.
  with due as (
    select w.*, case when w.starts_at - v_now <= interval '1 hour' then '1h' else '12h' end as kind
    from sm_window w
    where not w.vacant and w.professional_id is not null
      and w.starts_at > v_now and w.starts_at <= v_now + interval '12 hours'
      and exists (
        select 1 from public.published_schedules ps
        cross join lateral jsonb_array_elements(case when jsonb_typeof(ps.ranges) = 'array' then ps.ranges else '[]'::jsonb end) rg
        where ps.unit_id = w.unit_id and ps.sector_id = w.sector_id
          and ps.year = substring(w.date from 1 for 4)::int and ps.month = substring(w.date from 6 for 2)::int
          and left(w.date, 10) between rg ->> 'start_date' and rg ->> 'end_date'
      )
  ),
  inserted as (
    insert into public.notifications (company_id, unit_id, professional_id, user_id, type, category, title, message, data, dedupe_key)
    select d.company_id, d.unit_id, d.professional_id, p.user_id, 'lembrete_plantao', 'escala',
      case when d.kind = '1h' then 'Seu plantão começa em 1 hora' else 'Lembrete: plantão nas próximas 12 h' end,
      coalesce(sec.name, 'Setor') || coalesce(' · ' || un.name, '') || ' · ' || to_char(left(d.date, 10)::date, 'DD/MM') || ' ' ||
        left(coalesce(d.start_time, '07:00'), 5) || '–' || left(coalesce(d.end_time, '19:00'), 5),
      jsonb_build_object('shift_id', d.id, 'date', d.date, 'origem', 'servidor'),
      'lembrete_' || d.kind || ':' || d.id || ':' || d.professional_id
    from due d
    left join public.professionals p on p.id = d.professional_id
    left join public.sectors sec on sec.id = d.sector_id
    left join public.units un on un.id::text = d.unit_id
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*) into v_reminders from inserted;

  return jsonb_build_object('vagas_urgentes', v_urgent, 'lembretes', v_reminders);
end;
$$;

revoke all on function public.run_shift_alerts() from anon, authenticated;

-- A cada 5 minutos.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'scalemedic-shift-alerts') then
    perform cron.unschedule('scalemedic-shift-alerts');
  end if;
  perform cron.schedule('scalemedic-shift-alerts', '*/5 * * * *', 'select public.run_shift_alerts()');
end $$;

commit;
