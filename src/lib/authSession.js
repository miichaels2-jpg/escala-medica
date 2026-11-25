import { supabase } from '@/lib/supabase';
import { refreshStoredUser } from '@/lib/storedUser';

// Login oficial do Supabase: a conta oficial guarda em app_metadata o id do usuário do
// ScaleMedic (public.users.id), que é diferente do id da conta.
export function appUserIdFromSession(session) {
  return session?.user?.app_metadata?.app_user_id || null;
}

// Cópias antigas guardadas no navegador, que hoje ficam só no banco: dados de cada profissional
// editado (CPF, PIX, banco, salário; até a V0.6.7), especialidade dos plantões e publicações e
// pagamentos das versões anteriores à V0.3 (até a V0.6.8).
const LEGACY_PREFIXES = ['prof_meta_', 'shift_spec_', 'scale_published_ranges_', 'scale_shared_state_uploaded_'];
const LEGACY_KEYS = ['scale_faturamento_pagos'];

export function purgeLegacyLocalData() {
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && (LEGACY_KEYS.includes(key) || LEGACY_PREFIXES.some(prefix => key.startsWith(prefix)))) keys.push(key);
    }
    keys.forEach(key => window.localStorage.removeItem(key));
  } catch {}
}

// Encerra a sessão neste navegador. Não usar localStorage.clear(): apagaria também as
// preferências (tema, unidade escolhida, ajuda já vista).
export function clearStoredSession() {
  try {
    window.localStorage.removeItem('scale_logged_user');
    window.localStorage.removeItem('escala_medica_session');
  } catch {}
  purgeLegacyLocalData();
}

// Abre a sessão oficial depois que o login do ScaleMedic aceitou a senha. Desde a V0.3.1 o
// banco só responde com essa sessão, então sem ela o login não termina.
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

// Usuário logado neste aparelho. Exige a sessão oficial: quem só tem o login antigo
// (versões anteriores à V0.3.1) é deslogado e volta para a tela de login uma vez.
// Uma falha de rede ao reler o cadastro não desloga: usa o que está guardado.
export async function resolveSignedInUser(columns) {
  let session = null;
  try {
    ({ data: { session } } = await supabase.auth.getSession());
  } catch {}
  const appUserId = appUserIdFromSession(session);
  let active = false;
  let stored = null;
  try {
    active = window.localStorage.getItem('escala_medica_session') === 'active';
    stored = JSON.parse(window.localStorage.getItem('scale_logged_user') || 'null');
  } catch {}

  if (!appUserId) {
    if (active) clearStoredSession();
    return null;
  }
  if (!active) return null;

  const base = stored && String(stored.id) === String(appUserId) ? stored : { id: appUserId };
  const user = await refreshStoredUser(base, columns);
  return user && Object.keys(user).length > 1 ? user : null;
}
