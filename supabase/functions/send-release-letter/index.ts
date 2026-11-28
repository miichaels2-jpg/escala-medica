// Edge Function send-release-letter (V0.10.9): envia a carta de versão (PDF anexo) aos gestores
// escolhidos na tela Versões. Só o dono da plataforma pode enviar (conferido no banco com a sessão de
// quem chamou). O PDF é buscado no próprio site (scalemedic.com.br/cartas/...). Segredo: RESEND_API_KEY.
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

type Letter = { versao: string; titulo?: string; periodo?: string; arquivo: string; destaques?: string[] };
type Recipient = { email: string; name?: string; company?: string };

function letterEmail(letter: Letter, to: Recipient) {
  const first = String(to.name || '').trim().split(/\s+/)[0];
  const highlights = (letter.destaques || []).slice(0, 8);
  const subject = `Carta de Versão ${letter.versao} do ScaleMedic`;
  const html = `<div style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
    <div style="background:#0284c7;padding:18px 24px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="vertical-align:middle;background:#ffffff;border-radius:12px;padding:3px"><img src="${APP_URL}/icons/icon-192.png" width="40" height="40" alt="ScaleMedic" style="display:block;border-radius:10px;border:0"></td><td style="vertical-align:middle;padding-left:12px;color:#ffffff;font-size:20px;font-weight:bold">ScaleMedic<div style="font-size:12px;font-weight:normal;opacity:.85">Gestão de escalas</div></td></tr></table></div>
    <div style="padding:28px 28px 8px">
      <p style="margin:0 0 6px;font-size:12px;font-weight:bold;letter-spacing:.6px;text-transform:uppercase;color:#0284c7">Carta de Versão ${esc(letter.versao)}</p>
      <p style="margin:0 0 18px;font-size:18px;font-weight:bold">${esc(letter.titulo || `Novidades da versão ${letter.versao}`)}</p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#334155">Prezado(a) ${esc(first || 'gestor(a)')},</p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#334155">É com satisfação que apresentamos a <b>Carta de Versão ${esc(letter.versao)}</b> do ScaleMedic${letter.periodo ? `, que reúne as melhorias disponibilizadas ${esc(letter.periodo)}` : ''}${to.company ? ` e já disponíveis para ${esc(to.company)}` : ''}.</p>
      ${highlights.length ? `<p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#0f172a">Principais novidades</p>
      <ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.7;color:#334155">${highlights.map(h => `<li style="margin-bottom:4px">${esc(h)}</li>`).join('')}</ul>` : ''}
      <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#334155">O documento completo, com o detalhamento de cada novidade e orientações de uso, segue <b>em anexo</b>.</p>
      <p style="margin:0 0 22px;text-align:center"><a href="${APP_URL}/login" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 28px;border-radius:10px">Acessar o ScaleMedic</a></p>
      <p style="margin:0 0 4px;font-size:14px;line-height:1.7;color:#334155">Seguimos à disposição para apoiar a sua equipe.</p>
      <p style="margin:0 0 22px;font-size:14px;line-height:1.7;color:#334155">Atenciosamente,<br><b>Equipe ScaleMedic</b></p>
    </div>
    <div style="padding:14px 28px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">Mensagem enviada pelo ScaleMedic (scalemedic.com.br) aos gestores cadastrados. Não responda este e-mail.</div>
  </div>
</div>`;
  const text = `Carta de Versão ${letter.versao} do ScaleMedic\n\nPrezado(a) ${first || 'gestor(a)'},\n\nÉ com satisfação que apresentamos a Carta de Versão ${letter.versao} do ScaleMedic${letter.periodo ? `, que reúne as melhorias disponibilizadas ${letter.periodo}` : ''}.\n${highlights.length ? `\nPrincipais novidades:\n${highlights.map(h => `- ${h}`).join('\n')}\n` : ''}\nO documento completo segue em anexo.\n\nAtenciosamente,\nEquipe ScaleMedic`;
  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ sent: 0, reason: 'Método não permitido.' }, 405);
  if (!RESEND_API_KEY) return reply({ sent: 0, reason: 'Envio de e-mail não configurado (RESEND_API_KEY).' }, 500);
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return reply({ sent: 0, reason: 'Sem sessão.' }, 401);

  const owner = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sm_auth_is_platform_owner`, {
    method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: auth, 'Content-Type': 'application/json' }, body: '{}'
  }).then(r => r.json()).catch(() => false);
  if (owner !== true) return reply({ sent: 0, reason: 'Só o dono da plataforma envia cartas de versão.' }, 403);

  let body: { letter?: Letter; recipients?: Recipient[] };
  try { body = await req.json(); } catch { return reply({ sent: 0, reason: 'Pedido inválido.' }, 400); }
  const letter = body.letter;
  const recipients = (body.recipients || []).filter(r => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(r?.email || '')) && !String(r.email).endsWith('@scalemedic.local')).slice(0, 200);
  if (!letter?.versao || !/^cartas\/[\w.-]+\.pdf$/.test(String(letter.arquivo || ''))) return reply({ sent: 0, reason: 'Carta inválida.' }, 400);
  if (!recipients.length) return reply({ sent: 0, reason: 'Nenhum destinatário com e-mail.' }, 400);

  const pdf = await fetch(`${APP_URL}/${letter.arquivo}`);
  if (!pdf.ok) return reply({ sent: 0, reason: 'Não foi possível baixar o PDF da carta.' }, 502);
  const bytes = new Uint8Array(await pdf.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const attachment = { filename: `Carta de Versão ${letter.versao} - ScaleMedic.pdf`, content: btoa(binary) };

  let sent = 0;
  const failed: string[] = [];
  for (const to of recipients) {
    const { subject, html, text } = letterEmail(letter, to);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to.email], subject, html, text, attachments: [attachment] })
    });
    if (res.ok) sent += 1; else failed.push(to.email);
  }
  return reply({ sent, failed });
});
