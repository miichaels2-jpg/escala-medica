import { createClient } from '@supabase/supabase-js';

// Coloque a sua URL e a sua Chave Pública (anon key) do Supabase aqui:
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ryoweamemzwnwqgbrpcr.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_aJYPYrAxzbYEU23ckNDpyg_H5nbZoX_';

export const supabase = createClient(supabaseUrl, supabaseKey);