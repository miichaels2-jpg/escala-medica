import { supabase } from '@/lib/supabase';
import { isRealEmail } from '@/lib/passwordRecovery';
import { birthDatePassword, generateProvisionalPassword } from '@/lib/passwordPolicy';

// Manda por e-mail o usuário e a senha provisória (V0.8.8). Edge Function send-access-email; o banco
// confere se quem envia é da coordenação do estabelecimento. Nunca lança erro: devolve a frase
// para juntar ao aviso de "salvo com sucesso". reason 'lembrete' (V0.9.4) vai sem senha.
export async function sendAccessEmail({ userId, password, email, reason = 'novo' }) {
  const result = await requestAccessEmail({ userId, password, email, reason });
  if (result.skipped) return '';
  if (result.sent) return `Usuário e senha provisória enviados para ${result.email}.`;
  return `O e-mail com o acesso não foi enviado${result.reason ? ` (${result.reason})` : ''}. Passe usuário e senha à pessoa por outro meio.`;
}

async function requestAccessEmail({ userId, password, email, reason }) {
  if (!userId || (!password && reason !== 'lembrete')) return { skipped: true };
  if (email !== undefined && !isRealEmail(email)) return { skipped: true };
  try {
    const { data, error } = await supabase.functions.invoke('send-access-email', { body: { user_id: String(userId), password: password || '', reason } });
    let result = data;
    if (error) result = await error.context?.json?.().catch(() => null);
    return result?.sent ? { sent: true, email: result.email } : { sent: false, reason: result?.reason || '' };
  } catch {
    return { sent: false, reason: '' };
  }
}

// Login do profissional: pelo vínculo da ficha, pelo usuário guardado nela ou pelo e-mail.
export async function findProfessionalLogin(professional) {
  const columns = 'id, username, email, full_name, data';
  const tries = [
    professional?.user_id && ['id', String(professional.user_id)],
    professional?.data?.username && ['username', String(professional.data.username).toLowerCase()],
    isRealEmail(professional?.email) && ['email', String(professional.email).trim().toLowerCase()]
  ].filter(Boolean);
  for (const [column, value] of tries) {
    const { data } = await supabase.from('users').select(columns).eq(column, value).limit(1);
    if (data?.[0]) return data[0];
  }
  return null;
}

// Botão "Enviar acesso por e-mail" do Corpo Clínico (V0.9.4), um por um ou em lote.
// Quem ainda não entrou recebe senha provisória nova (data de nascimento + inicial, ou aleatória);
// quem já tem senha pessoal recebe só endereço e usuário, sem mexer na senha.
// Retorna { status: 'enviado' | 'sem_email' | 'sem_login' | 'falha', email?, reason?, firstAccess? }.
export async function sendAccessToProfessional(professional) {
  if (!isRealEmail(professional?.email)) return { status: 'sem_email' };
  const login = await findProfessionalLogin(professional);
  if (!login) return { status: 'sem_login' };
  const firstAccess = Boolean(login.data?.must_change_password);
  let password = '';
  if (firstAccess) {
    password = birthDatePassword(professional.name, professional.birth_date || professional.data?.birth_date) || generateProvisionalPassword();
    const { error } = await supabase.from('users').update({ password, data: { ...(login.data || {}), must_change_password: true } }).eq('id', login.id);
    if (error) return { status: 'falha', reason: 'não foi possível gerar a senha provisória' };
  }
  const result = await requestAccessEmail({ userId: login.id, password, reason: firstAccess ? 'novo' : 'lembrete' });
  return result.sent ? { status: 'enviado', email: result.email, firstAccess } : { status: 'falha', reason: result.reason };
}
