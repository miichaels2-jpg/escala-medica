import { supabase } from '@/lib/supabase';

// Grava uma linha: com id atualiza, sem id cria. Devolve a linha salva; erro do banco sobe para quem chamou.
export async function saveRow(table, id, payload) {
  const query = id
    ? supabase.from(table).update(payload).eq('id', id)
    : supabase.from(table).insert([payload]);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}
