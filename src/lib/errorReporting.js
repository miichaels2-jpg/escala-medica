import { supabase } from '@/lib/supabase';
import { APP_VERSION } from '@/lib/version';

// Aviso de erro em produção: manda para o banco (report_app_error) os erros que a pessoa vê,
// para o dono da plataforma enxergar na tela Plataforma antes de o cliente ligar.
// No máximo 10 avisos por visita, sem repetir o mesmo erro na mesma tela.

const MAX_PER_VISIT = 10;
const sent = new Set();

// Ruído conhecido do navegador que não é erro do app.
const IGNORE = [/ResizeObserver loop/i, /Script error\.?$/i, /Load failed$/i];

export function reportAppError(kind, error, extra = '') {
  try {
    const message = String(error?.message || error || '').slice(0, 500);
    if (!message || IGNORE.some(re => re.test(message))) return;
    const path = window.location.pathname;
    const key = `${kind}|${path}|${message}`;
    if (sent.has(key) || sent.size >= MAX_PER_VISIT) return;
    sent.add(key);
    const stack = [error?.stack, extra].filter(Boolean).join('\n').slice(0, 4000);
    supabase.rpc('report_app_error', {
      p_kind: kind,
      p_path: path,
      p_message: message,
      p_stack: stack || null,
      p_version: APP_VERSION,
      p_agent: navigator.userAgent
    }).then(() => {}, () => {});
  } catch { /* o aviso de erro nunca pode quebrar o app */ }
}

export function installGlobalErrorReporting() {
  window.addEventListener('error', (event) => reportAppError('navegador', event.error || event.message));
  window.addEventListener('unhandledrejection', (event) => reportAppError('promessa', event.reason));
}
