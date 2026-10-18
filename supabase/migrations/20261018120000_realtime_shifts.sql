-- Atualização automática das telas (V0.1.7).
-- Inclui no Realtime do Supabase as tabelas que mudam enquanto outra pessoa
-- está com o app aberto: plantões (vaga assumida, troca, alocação), escalas
-- publicadas e status de pagamento. O app usa o aviso só como sinal para
-- recarregar os dados; nenhuma permissão de leitura nova é criada (o Realtime
-- respeita as mesmas políticas RLS da API).
begin;

do $$
declare
  t text;
begin
  foreach t in array array['shifts', 'published_schedules', 'payment_statuses'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;
