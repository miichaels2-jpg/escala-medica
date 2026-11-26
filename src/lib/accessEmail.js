import { supabase } from '@/lib/supabase';
import { isRealEmail } from '@/lib/passwordRecovery';

// Manda por e-mail o usuário e a senha provisória (V0.8.8). Edge Function send-access-email; o banco
// confere se quem envia é da coordenação do estabelecimento. Nunca lança erro: devolve a frase
// para juntar ao aviso de "salvo com sucesso".
export async function sendAccessEmail({ userId, password, email, reason = 'novo' }) {
  if (!userId || !password) return '';
  if (email !== undefined && !isRealEmail(email)) return '';
  try {
    const { data, error } = await supabase.functions.invoke('send-access-email', { body: { user_id: String(userId), password, reason } });
    let result = data;
    if (error) result = await error.context?.json?.().catch(() => null);
    if (result?.sent) return `Usuário e senha provisória enviados para ${result.email}.`;
    return `O e-mail com o acesso não foi enviado${result?.reason ? ` (${result.reason})` : ''}. Passe usuário e senha à pessoa por outro meio.`;
  } catch {
    return 'O e-mail com o acesso não foi enviado. Passe usuário e senha à pessoa por outro meio.';
  }
}
