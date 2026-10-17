import { supabase } from '@/lib/supabase';

// Avisos ao profissional ficam na tabela notifications e aparecem no sino
// (topo da tela) de quem recebeu, em qualquer aparelho.

export function recipientFor(professional) {
  if (!professional?.id) return null;
  return {
    professional_id: String(professional.id),
    user_id: professional.user_id ? String(professional.user_id) : null
  };
}

// Envia vários avisos de uma vez. Nunca interrompe a operação principal:
// se o envio falhar, registra no console e devolve false.
export async function sendNotifications(items) {
  const rows = (items || [])
    .filter(item => item && (item.professional_id || item.user_id) && item.title)
    .map(item => ({
      company_id: item.company_id ? String(item.company_id) : null,
      unit_id: item.unit_id ? String(item.unit_id) : null,
      professional_id: item.professional_id ? String(item.professional_id) : null,
      user_id: item.user_id ? String(item.user_id) : null,
      type: item.type || 'geral',
      category: item.category || null,
      title: String(item.title),
      message: item.message ? String(item.message) : null,
      data: item.data || {}
    }));
  if (rows.length === 0) return true;
  try {
    const { error } = await supabase.from('notifications').insert(rows);
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('Não foi possível enviar as notificações:', error?.message || error);
    return false;
  }
}

export async function fetchMyNotifications({ professionalId, userId, limit = 30 }) {
  const filters = [];
  if (professionalId) filters.push(`professional_id.eq.${professionalId}`);
  if (userId) filters.push(`user_id.eq.${userId}`);
  if (filters.length === 0) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('id,type,category,title,message,read,data,created_date')
    .or(filters.join(','))
    .order('created_date', { ascending: false })
    .limit(limit);
  if (error) {
    if (error.code !== 'PGRST205') console.warn('Não foi possível carregar as notificações:', error.message);
    return [];
  }
  return data || [];
}

export async function markNotificationsRead(ids) {
  const list = (ids || []).filter(Boolean).map(String);
  if (list.length === 0) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString(), updated_date: new Date().toISOString() })
    .in('id', list);
  if (error) console.warn('Não foi possível marcar as notificações como lidas:', error.message);
}
