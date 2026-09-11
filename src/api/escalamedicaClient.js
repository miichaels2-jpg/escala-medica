import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ryoweamemzwnwqgbrpcr.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

const tableMap = {
  Company: 'companies',
  User: 'users',
  Professional: 'professionals',
  Specialty: 'specialties', // <--- adicione esta linha
  Sector: 'sectors',
  Shift: 'shifts',
  ShiftSwap: 'shift_swaps',
  Notification: 'notifications',
  BillingRecord: 'billing_records'
};

const buildSupabaseEntity = (tableName) => ({
  list: async (sort = '-created_date', limit = 300) => {
    const isDesc = sort.startsWith('-');
    const sortField = isDesc ? sort.slice(1) : sort;
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order(sortField || 'created_date', { ascending: !isDesc })
      .limit(limit);

    if (error) {
      console.error(`Erro ao listar ${tableName}:`, error);
      return [];
    }
    return data || [];
  },

  filter: async (filters = {}, sort = '-created_date', limit = 300) => {
    const isDesc = sort.startsWith('-');
    const sortField = isDesc ? sort.slice(1) : sort;
    let query = supabase.from(tableName).select('*');

    Object.entries(filters).forEach(([key, val]) => {
      if (val === undefined || val === null || val === '') return;
      if (typeof val === 'string' && val.startsWith('!')) {
        query = query.neq(key, val.slice(1));
      } else {
        query = query.eq(key, val);
      }
    });

    query = query.order(sortField || 'created_date', { ascending: !isDesc }).limit(limit);
    const { data, error } = await query;
    if (error) {
      console.error(`Erro ao filtrar ${tableName}:`, error);
      return [];
    }
    return data || [];
  },

  get: async (id) => {
    const { data, error } = await supabase.from(tableName).select('*').eq('id', id).maybeSingle();
    if (error) {
      console.error(`Erro ao buscar ${tableName}:`, error);
      return null;
    }
    return data;
  },

  create: async (payload) => {
    const { data, error } = await supabase
      .from(tableName)
      .insert([{ ...payload, created_date: new Date().toISOString(), updated_date: new Date().toISOString() }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  update: async (id, payload) => {
    const { data, error } = await supabase
      .from(tableName)
      .update({ ...payload, updated_date: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  delete: async (id) => {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }
});

const entityApis = {
  Company: buildSupabaseEntity(tableMap.Company),
  User: buildSupabaseEntity(tableMap.User),
  Professional: buildSupabaseEntity(tableMap.Professional),
  Specialty: buildSupabaseEntity(tableMap.Specialty), // <--- adicione esta linha
  Sector: buildSupabaseEntity(tableMap.Sector),
  Shift: buildSupabaseEntity(tableMap.Shift),
  ShiftSwap: buildSupabaseEntity(tableMap.ShiftSwap),
  Notification: buildSupabaseEntity(tableMap.Notification),
  BillingRecord: buildSupabaseEntity(tableMap.BillingRecord)
};

const makeAuth = () => ({
  me: async () => {
    try {
      const rawUser = localStorage.getItem('medscale_session_user');
      if (!rawUser) return null;
      const cached = JSON.parse(rawUser);

      const { data: dbUser } = await supabase.from('users').select('*').eq('id', cached.id).maybeSingle();
      if (!dbUser) return null;

      const { data: prof } = await supabase.from('professionals').select('*').eq('user_id', dbUser.id).maybeSingle();

      return {
        ...dbUser,
        full_name: prof?.name || dbUser.full_name || dbUser.email,
        data: {
          ...(dbUser.data || {}),
          professional_id: prof?.id,
          professional_role: prof?.role || prof?.specialty || 'Profissional'
        }
      };
    } catch {
      return null;
    }
  },

  loginViaUsernamePassword: async (identifier, password) => {
    const term = String(identifier || '').trim().toLowerCase();
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .or(`username.ilike.${term},email.ilike.${term}`)
      .eq('password', String(password));

    if (error || !users || users.length === 0) {
      throw new Error('Usuário ou senha inválidos.');
    }

    const user = users[0];
    const { data: prof } = await supabase.from('professionals').select('*').eq('user_id', user.id).maybeSingle();

    const sessionUser = {
      ...user,
      full_name: prof?.name || user.full_name,
      data: {
        ...(user.data || {}),
        professional_id: prof?.id,
        professional_role: prof?.role || 'Profissional'
      }
    };

    localStorage.setItem('medscale_session_user', JSON.stringify(sessionUser));
    return { user: sessionUser };
  },

  loginViaEmailPassword: async (email, password) => {
    return makeAuth().loginViaUsernamePassword(email, password);
  },

  loginWithProvider: async (provider, returnTo) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: returnTo || `${window.location.origin}/dashboard`,
          queryParams: { prompt: 'select_account' }
        }
      });
      if (error) throw error;
    } catch (err) {
      console.warn('OAuth não configurado, entrando com credencial de administrador padrão:', err.message);
      const { data: users } = await supabase.from('users').select('*').limit(1);
      const demoUser = users?.[0] || {
        id: 'usr_admin',
        email: 'admin@scalemedic.com',
        username: 'admin',
        full_name: 'Gestor Geral',
        role: 'admin',
        data: { company_id: 'cmp_principal', selected_unit_id: 'unit_h1', app_role: 'manager' }
      };

      const { data: prof } = await supabase.from('professionals').select('*').eq('user_id', demoUser.id).maybeSingle();

      const sessionUser = {
        ...demoUser,
        full_name: prof?.name || demoUser.full_name,
        data: {
          ...(demoUser.data || {}),
          professional_id: prof?.id,
          professional_role: prof?.role || 'Diretor Médico / Gestor'
        }
      };

      localStorage.setItem('medscale_session_user', JSON.stringify(sessionUser));
      if (typeof window !== 'undefined') {
        window.location.href = returnTo || '/dashboard';
      }
      return { user: sessionUser };
    }
  },

  logout: async (redirectTo = '/login') => {
    localStorage.removeItem('medscale_session_user');
    if (typeof window !== 'undefined' && redirectTo) {
      window.location.href = redirectTo;
    }
    return true;
  },

  updateMe: async (payload) => {
    const rawUser = localStorage.getItem('medscale_session_user');
    if (!rawUser) return null;
    const cached = JSON.parse(rawUser);

    const nextData = { ...(cached.data || {}), ...(payload.data || {}) };
    const { data: updated } = await supabase
      .from('users')
      .update({ ...payload, data: nextData, updated_date: new Date().toISOString() })
      .eq('id', cached.id)
      .select()
      .single();

    const merged = { ...cached, ...updated, data: nextData };
    localStorage.setItem('medscale_session_user', JSON.stringify(merged));
    return merged;
  }
});

export const base44 = {
  auth: makeAuth(),
  entities: entityApis
};

// Criação de vaga aberta com disparo automático de notificação para especialistas
export async function createOpenShiftWithAlert(shiftData) {
  const newShift = await base44.entities.Shift.create({
    ...shiftData,
    professional_id: null,
    professional_name: 'Vaga Aberta',
    status: 'vago'
  });

  const professionals = await base44.entities.Professional.filter({
    company_id: shiftData.company_id
  });

  const targetSpecialty = (shiftData.specialty || shiftData.sector_name || '').toLowerCase().trim();
  const matching = professionals.filter((p) => {
    if (p.status === 'inativo') return false;
    const pSpec = (p.specialty || '').toLowerCase().trim();
    const pCat = (p.category || '').toLowerCase().trim();
    return pSpec.includes(targetSpecialty) || targetSpecialty.includes(pSpec) || pCat.includes(targetSpecialty);
  });

  for (const prof of matching) {
    await base44.entities.Notification.create({
      company_id: shiftData.company_id,
      professional_id: prof.id,
      shift_id: newShift.id,
      title: 'Nova vaga disponível para cobertura!',
      message: `Vaga no setor ${shiftData.sector_name || 'Geral'} em ${shiftData.date} (${shiftData.start_time || '07:00'} às ${shiftData.end_time || '19:00'}). Seja o primeiro a aceitar para assumir.`,
      read: false
    });
  }

  return newShift;
}