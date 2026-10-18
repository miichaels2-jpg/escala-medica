-- Alerta de furo iminente (V0.1.10).
-- Qualquer aparelho com o app aberto pode disparar o aviso "vaga urgente"; a
-- chave única garante que cada profissional receba um único aviso por vaga,
-- mesmo que dois aparelhos tentem enviar ao mesmo tempo. Avisos antigos e os
-- enviados por versões anteriores ficam com a chave vazia (permitido repetir).
begin;

alter table public.notifications add column if not exists dedupe_key text;
create unique index if not exists notifications_dedupe_key_uniq on public.notifications(dedupe_key);

commit;
