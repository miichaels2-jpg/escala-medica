import { supabase } from '@/lib/supabase';

// O login guarda o usuário no aparelho (scale_logged_user). Ao abrir o app, ele é
// relido do banco para que mudanças feitas pelo gestor (telas liberadas, perfil,
// unidades) valham sem precisar sair e entrar de novo.
export async function refreshStoredUser(localUser, columns) {
  if (!localUser?.id) return localUser;
  try {
    const { data, error } = await supabase.from('users').select(columns).eq('id', localUser.id).maybeSingle();
    if (error || !data) return localUser;
    const merged = { ...localUser, ...data, data: { ...(localUser.data || {}), ...(data.data || {}) } };
    window.localStorage.setItem('scale_logged_user', JSON.stringify(merged));
    return merged;
  } catch {
    return localUser;
  }
}
