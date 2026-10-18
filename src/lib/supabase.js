import { createClient } from '@supabase/supabase-js';

// Coloque a sua URL e a sua Chave Pública (anon key) do Supabase aqui:
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ryoweamemzwnwqgbrpcr.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_aJYPYrAxzbYEU23ckNDpyg_H5nbZoX_';

// Histórico de alterações: cada chamada leva o id do usuário logado, que o
// gatilho do banco grava em audit_log.changed_by. Só o id (texto ASCII) vai no cabeçalho.
function currentUserId() {
  try {
    if (window.localStorage.getItem('escala_medica_session') !== 'active') return '';
    const user = JSON.parse(window.localStorage.getItem('scale_logged_user') || 'null');
    const id = String(user?.id || '');
    return /^[\x20-\x7E]{1,128}$/.test(id) ? id : '';
  } catch {
    return '';
  }
}

function fetchWithUser(input, init = {}) {
  const userId = currentUserId();
  if (!userId) return fetch(input, init);
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  headers.set('x-scalemedic-user-id', userId);
  return fetch(input, { ...init, headers });
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { fetch: fetchWithUser }
});
