import { supabase } from '@/lib/supabase';

// Um login para vários estabelecimentos (V0.8.1). O banco guarda a empresa ativa no cadastro;
// trocar de estabelecimento troca também o perfil (papel, hospitais liberados) daquela empresa.

// Estabelecimentos que o login abre, o atual primeiro. Sem a migração no banco, devolve [] e o
// app segue só com a empresa do cadastro.
export async function listMyCompanies() {
  try {
    const { data, error } = await supabase.rpc('my_companies');
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Ativa outro estabelecimento e devolve o usuário com o cadastro já trocado.
export async function switchCompany(user, companyId) {
  const { data, error } = await supabase.rpc('switch_company', { p_company_id: String(companyId) });
  if (error) throw new Error(error.message || 'Não foi possível trocar de estabelecimento.');
  const { password: _password, password_hash: _passwordHash, ...safeUser } = user || {};
  const nextUser = { ...safeUser, data: data || safeUser.data };
  try {
    window.localStorage.setItem('scale_logged_user', JSON.stringify(nextUser));
    if (nextUser.data?.selected_unit_id) window.localStorage.setItem('scale_selected_unit', String(nextUser.data.selected_unit_id));
    else window.localStorage.removeItem('scale_selected_unit');
  } catch { /* sem armazenamento: o cadastro no banco já foi trocado */ }
  return nextUser;
}
