-- Troca direta entre colegas (V0.2.3).
-- A propõe trocar o plantão dele pelo plantão de B; B aceita; o gestor aprova e
-- a função approve_shift_swap troca os dois profissionais numa única transação.
begin;

alter table public.shift_swaps add column if not exists target_shift_id text;
alter table public.shift_swaps add column if not exists target_shift_date text;
alter table public.shift_swaps add column if not exists target_shift_time text;
alter table public.shift_swaps add column if not exists target_sector_name text;
alter table public.shift_swaps add column if not exists decided_by text;
alter table public.shift_swaps add column if not exists decided_at timestamptz;

create index if not exists shift_swaps_company_status_idx on public.shift_swaps (company_id, status, created_date desc);

-- Aprova e executa a troca: confere que cada plantão ainda é de quem era no pedido.
create or replace function public.approve_shift_swap(p_swap_id text, p_decided_by text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_swap public.shift_swaps%rowtype;
  v_a public.shifts%rowtype;
  v_b public.shifts%rowtype;
begin
  select * into v_swap from public.shift_swaps where id = p_swap_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Pedido de troca não encontrado.');
  end if;
  if v_swap.swap_type <> 'troca_direta' or v_swap.status <> 'aguardando_gestor' then
    return jsonb_build_object('ok', false, 'error', 'Este pedido não está aguardando aprovação.');
  end if;

  select * into v_a from public.shifts where id = v_swap.shift_id for update;
  select * into v_b from public.shifts where id = v_swap.target_shift_id for update;
  if v_a.id is null or v_b.id is null then
    return jsonb_build_object('ok', false, 'error', 'Um dos plantões não existe mais.');
  end if;
  if coalesce(v_a.professional_id, '') <> coalesce(v_swap.requester_professional_id, '')
     or coalesce(v_b.professional_id, '') <> coalesce(v_swap.target_professional_id, '') then
    return jsonb_build_object('ok', false, 'error', 'A escala mudou desde o pedido: um dos plantões já não é de quem pediu a troca.');
  end if;

  update public.shifts
     set professional_id = v_b.professional_id, professional_name = v_b.professional_name, updated_date = now()
   where id = v_a.id;
  update public.shifts
     set professional_id = v_a.professional_id, professional_name = v_a.professional_name, updated_date = now()
   where id = v_b.id;
  update public.shift_swaps
     set status = 'aprovada', decided_by = p_decided_by, decided_at = now(), updated_date = now()
   where id = v_swap.id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.approve_shift_swap(text, text) to anon, authenticated;

-- Atualização automática das telas e histórico de alterações também para as trocas.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shift_swaps') then
    alter publication supabase_realtime add table public.shift_swaps;
  end if;
end $$;

drop trigger if exists audit_log_capture on public.shift_swaps;
create trigger audit_log_capture after insert or update or delete on public.shift_swaps
  for each row execute function public.audit_log_capture();

commit;
