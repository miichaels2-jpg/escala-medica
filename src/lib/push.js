// Avisos no celular com o app fechado (Web Push).
// O aparelho se inscreve com a chave pública VAPID e é guardado no banco por
// save_push_subscription; a função send-push assina os envios com a chave privada.
import { supabase } from '@/lib/supabase';
import { getMobilePlatform, isRunningAsInstalledApp } from '@/lib/pwa';

export const VAPID_PUBLIC_KEY = 'BL1zQRmaWSGGjFa4eA-dQqRtwXAEcGvMEdhz9rsnKA8ivolhk_r6nWsQX_bj1fncFvgdpz6UHoWYHhBhk35L9dM';

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// No iPhone, o push só funciona com o app instalado na tela de início (iOS 16.4+).
export function pushNeedsInstall() {
  return getMobilePlatform() === 'ios' && !isRunningAsInstalledApp();
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration();
  return existing || navigator.serviceWorker.register('/sw.js');
}

// 'ativo' | 'desativado' | 'bloqueado' | 'indisponivel' | 'instalar'
export async function getPushState() {
  if (pushNeedsInstall()) return 'instalar';
  if (!isPushSupported()) return 'indisponivel';
  if (Notification.permission === 'denied') return 'bloqueado';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub && Notification.permission === 'granted' ? 'ativo' : 'desativado';
  } catch {
    return 'desativado';
  }
}

export async function enablePush({ userId, professionalId }) {
  if (!isPushSupported()) throw new Error('Este navegador não aceita avisos.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Os avisos foram bloqueados neste aparelho. Libere nas configurações do navegador.');
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ||
    await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  const json = sub.toJSON();
  const { data, error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh || '',
    p_auth: json.keys?.auth || '',
    p_user_id: userId ? String(userId) : '',
    p_professional_id: professionalId ? String(professionalId) : '',
    p_user_agent: navigator.userAgent
  });
  if (error || data !== true) throw new Error(error?.message || 'Não foi possível ativar os avisos.');
  return true;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;
  await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint });
  await sub.unsubscribe();
}

// Mantém o vínculo do aparelho com o usuário atual (ex.: outra pessoa entrou no mesmo celular).
export async function refreshPushOwner({ userId, professionalId }) {
  try {
    if ((await getPushState()) !== 'ativo') return;
    await enablePush({ userId, professionalId });
  } catch {
    /* sem efeito: o usuário pode reativar pelo sino */
  }
}
