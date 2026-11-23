-- Histórico de alterações: o autor passa a vir do login oficial (V0.4.9).
-- Antes, o "quem fez" vinha do cabeçalho x-scalemedic-user-id mandado pelo navegador, que
-- qualquer pessoa logada poderia trocar. Agora o próprio banco descobre quem está logado
-- (sm_auth_user_id, a mesma função das regras de acesso). Ações sem login — rotinas
-- automáticas do servidor, como o alerta de furo a cada 5 min — ficam como 'sistema'.
-- Registros antigos não mudam.
begin;

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

  if auth.uid() is null then
    v_user := 'sistema';
  else
    v_user := public.sm_auth_user_id();
  end if;

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

commit;
