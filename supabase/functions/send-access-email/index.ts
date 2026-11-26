// Edge Function send-access-email (V0.8.8): manda por e-mail o usuário e a senha provisória de quem
// acabou de ganhar login (ou senha nova). Chamada pelo app da coordenação com a sessão dela; quem
// pode enviar e para qual e-mail é decidido pelo banco (RPC access_email_target), com a mesma sessão.
// Envio pelo Resend, com o domínio scalemedic.com.br. Segredo: RESEND_API_KEY.
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const APP_URL = 'https://scalemedic.com.br';
const FROM = 'ScaleMedic <naoresponda@scalemedic.com.br>';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));

function accessEmail(target: { full_name?: string; username: string; company_name?: string }, password: string, reason: string) {
  const first = String(target.full_name || '').trim().split(/\s+/)[0] || 'Olá';
  const isNew = reason !== 'nova_senha';
  const company = target.company_name ? ` da ${esc(target.company_name)}` : '';
  const subject = isNew ? 'Seu acesso ao ScaleMedic' : 'Sua nova senha provisória do ScaleMedic';
  const intro = isNew
    ? `A coordenação${company} cadastrou você no ScaleMedic, o sistema das escalas de plantão. Estes são os seus dados para entrar:`
    : `A coordenação${company} definiu uma senha provisória nova para o seu acesso ao ScaleMedic:`;
  const row = (label: string, value: string) =>
    `<tr><td style="padding:10px 14px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;width:38%">${label}</td><td style="padding:10px 14px;font-size:15px;font-weight:bold;color:#0f172a;border-bottom:1px solid #e2e8f0;font-family:Consolas,Menlo,monospace">${value}</td></tr>`;
  const html = `<div style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
    <div style="background:#0284c7;padding:18px 24px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="vertical-align:middle;background:#ffffff;border-radius:12px;padding:3px"><img src="${APP_URL}/icons/icon-192.png" width="40" height="40" alt="ScaleMedic" style="display:block;border-radius:10px;border:0"></td><td style="vertical-align:middle;padding-left:12px;color:#ffffff;font-size:20px;font-weight:bold">ScaleMedic<div style="font-size:12px;font-weight:normal;opacity:.85">Gestão de escalas médicas</div></td></tr></table></div>
    <div style="padding:24px">
      <p style="margin:0 0 12px;font-size:16px;font-weight:bold">${isNew ? 'Bem-vindo(a)' : 'Senha nova'}, ${esc(first)}!</p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#334155">${intro}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #e2e8f0;border-radius:10px;border-collapse:separate;margin:0 0 20px">
        ${row('Endereço', 'scalemedic.com.br')}${row('Usuário', esc(target.username))}${row('Senha provisória', esc(password))}
      </table>
      <p style="margin:0 0 24px;text-align:center"><a href="${APP_URL}/login" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 28px;border-radius:10px">Entrar no ScaleMedic</a></p>
      <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#475569">No primeiro acesso, o sistema pede para você criar a sua senha pessoal (8 ou mais caracteres, com letras e números). A senha provisória deixa de valer depois disso.</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#475569">No celular, dá para instalar o ScaleMedic como aplicativo: na tela de entrada, toque em "Instalar o app no celular".</p>
    </div>
    <div style="padding:14px 24px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">Mensagem automática do ScaleMedic (scalemedic.com.br). Não responda este e-mail; dúvidas, fale com a coordenação.</div>
  </div>
</div>`;
  const text = `${isNew ? 'Bem-vindo(a)' : 'Senha nova'}, ${first}!\n\n${intro.replace(/<[^>]+>/g, '')}\n\nEndereço: scalemedic.com.br\nUsuário: ${target.username}\nSenha provisória: ${password}\n\nNo primeiro acesso, o sistema pede para você criar a sua senha pessoal.\n\nMensagem automática do ScaleMedic. Dúvidas, fale com a coordenação.`;
  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ sent: false, reason: 'Método não permitido.' }, 405);
  if (!RESEND_API_KEY) return reply({ sent: false, reason: 'Envio de e-mail não configurado (RESEND_API_KEY).' }, 500);
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return reply({ sent: false, reason: 'Sem sessão.' }, 401);

  let body: { user_id?: string; password?: string; reason?: string };
  try { body = await req.json(); } catch { return reply({ sent: false, reason: 'Pedido inválido.' }, 400); }
  const password = String(body.password ?? '');
  if (!body.user_id || !password) return reply({ sent: false, reason: 'Faltou o login ou a senha.' }, 400);

  // O banco confere se quem chamou é da coordenação do mesmo estabelecimento.
  const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/access_email_target`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_user_id: String(body.user_id) })
  });
  const target = await rpc.json().catch(() => null);
  if (!rpc.ok || !target) return reply({ sent: false, reason: target?.message || 'Sem permissão para enviar.' }, 403);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target.email) || target.email.endsWith('@scalemedic.local')) {
    return reply({ sent: false, reason: 'Sem e-mail no cadastro.' });
  }

  const { subject, html, text } = accessEmail(target, password, String(body.reason ?? 'novo'));
  const sent = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [target.email], subject, html, text })
  });
  if (!sent.ok) {
    const detail = await sent.text().catch(() => '');
    return reply({ sent: false, reason: `O serviço de e-mail recusou o envio (${sent.status}). ${detail.slice(0, 200)}` }, 502);
  }
  return reply({ sent: true, email: target.email });
});
