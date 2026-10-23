import { supabase } from '@/lib/supabase';

// Login oficial do Supabase (fase 1): a conta oficial guarda em app_metadata o id
// do usuário do ScaleMedic (public.users.id), que é diferente do id da conta.
export function appUserIdFromSession(session) {
  return session?.user?.app_metadata?.app_user_id || null;
}

// Abre a sessão oficial depois que o login do ScaleMedic aceitou a senha. Na fase 1
// uma falha aqui não bloqueia o acesso (o banco ainda não exige a sessão).
export async function openOfficialSession(email, password) {
  if (!email || !password) return false;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password });
    if (error) {
      console.warn('[Login oficial] Sessão não aberta:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[Login oficial] Sessão não aberta:', error?.message || error);
    return false;
  }
}
