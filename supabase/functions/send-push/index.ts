// Edge Function send-push (V0.2.8): envia a notificação do sino como push para os
// aparelhos da pessoa. Chamada pelo gatilho notifications_send_push (pg_net), que já
// manda os aparelhos no corpo. Protegida pelo segredo compartilhado x-push-secret.
import webpush from 'npm:web-push@3.6.7';

const PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'https://github.com/miichaels2-jpg/escala-medica';
const WEBHOOK_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);

type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };

async function removeExpired(endpoint: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/remove_push_subscription`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_endpoint: endpoint })
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método não permitido', { status: 405 });
  if (!WEBHOOK_SECRET || req.headers.get('x-push-secret') !== WEBHOOK_SECRET) {
    return new Response('Não autorizado', { status: 401 });
  }

  let body: { title?: string; body?: string; url?: string; tag?: string; subscriptions?: Subscription[] };
  try {
    body = await req.json();
  } catch {
    return new Response('Corpo inválido', { status: 400 });
  }

  const payload = JSON.stringify({
    title: body.title || 'ScaleMedic',
    body: body.body || '',
    url: body.url || '/',
    tag: body.tag || undefined
  });

  let sent = 0;
  let removed = 0;
  let failed = 0;
  await Promise.all((body.subscriptions || []).map(async (subscription) => {
    try {
      await webpush.sendNotification(subscription, payload, { TTL: 60 * 60 * 12, urgency: 'high' });
      sent += 1;
    } catch (error) {
      const status = (error as { statusCode?: number })?.statusCode;
      // 404/410: o aparelho desativou os avisos ou a inscrição expirou.
      if (status === 404 || status === 410) {
        removed += 1;
        await removeExpired(subscription.endpoint);
      } else {
        failed += 1;
        console.error('Falha no push', status, (error as Error)?.message);
      }
    }
  }));

  return new Response(JSON.stringify({ sent, removed, failed }), { headers: { 'Content-Type': 'application/json' } });
});
