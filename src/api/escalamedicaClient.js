import { appParams } from '@/lib/app-params';

const STORAGE_KEY = 'medscale_demo_store';

const defaultState = {
  currentUser: null,
  token: null,
  pendingOtp: null,
  companies: [
    {
      id: 'cmp_demo_1',
      name: 'Hospital Vida & Saúde',
      app_name: 'ScaleMedic CGT',
      cnpj: '12.345.678/0001-90',
      phone: '(11) 3456-7890',
      address: 'Rua das Flores, 120, São Paulo/SP',
      primary_contact: 'Dra. Helena Costa',
      logo_url: '',
      accent_color: '#0ea5e9',
      selected_unit_id: 'unit_h1',
      units: [
        { id: 'unit_h1', name: 'Hospital Santa Clara', address: 'Rua das Flores, 120, São Paulo/SP', phone: '(11) 3456-7890' },
        { id: 'unit_h2', name: 'Hospital Vida & Saúde Dois', address: 'Av. Morumbi, 500, São Paulo/SP', phone: '(11) 3312-7700' }
      ],
      plan: 'trial'
    }
  ],
  users: [
    {
      id: 'usr_admin',
      username: 'mdevils',
      email: 'mdevils@admin.local',
      password: 'Bomberman12.',
      full_name: 'Michael Deivid',
      role: 'admin',
      data: { company_id: 'cmp_demo_1', selected_unit_id: 'unit_h1', app_role: 'manager' }
    }
  ],
  professionals: [
    {
      id: 'prof_1',
      name: 'Michael Deivid',
      category: 'medico',
      specialty: 'Gestão Clínica',
      role: 'Diretor Médico / Gestor',
      email: 'mdevils@admin.local',
      phone: '(11) 98888-1111',
      document: 'CRM-SP 100001',
      status: 'ativo',
      company_id: 'cmp_demo_1',
      user_id: 'usr_admin',
      unit_id: 'unit_h1',
      daily_rate: 950,
      hourly_rate: 79.17
    },
    {
      id: 'prof_2',
      name: 'Dr. Carlos Mendes',
      category: 'medico',
      specialty: 'Cardiologia',
      email: 'carlos@medscale.com',
      phone: '(11) 98888-1111',
      document: 'CRM-SP 123456',
      status: 'ativo',
      company_id: 'cmp_demo_1',
      unit_id: 'unit_h1',
      daily_rate: 820,
      hourly_rate: 68.33
    },
    {
      id: 'prof_3',
      name: 'Dr. Aline Ribeiro',
      category: 'medico',
      specialty: 'Clínica Médica',
      email: 'aline@medscale.com',
      phone: '(11) 98888-2222',
      document: 'CRM-SP 654321',
      status: 'ativo',
      company_id: 'cmp_demo_1',
      unit_id: 'unit_h1',
      daily_rate: 700,
      hourly_rate: 58.33
    },
    {
      id: 'prof_4',
      name: 'Enf. Mariana Nogueira',
      category: 'enfermeiro',
      specialty: 'UTI',
      email: 'mariana@medscale.com',
      phone: '(11) 98888-3333',
      document: 'COREN-SP 654321',
      status: 'ativo',
      company_id: 'cmp_demo_1',
      unit_id: 'unit_h1'
    },
    {
      id: 'prof_5',
      name: 'Enf. Ricardo Lima',
      category: 'enfermeiro',
      specialty: 'Emergência',
      email: 'ricardo@medscale.com',
      phone: '(11) 98888-4444',
      document: 'COREN-SP 221144',
      status: 'ativo',
      company_id: 'cmp_demo_1',
      unit_id: 'unit_h1'
    },
    {
      id: 'prof_6',
      name: 'Téc. Lúcia Martins',
      category: 'tecnico',
      specialty: 'Enfermagem',
      email: 'lucia@medscale.com',
      phone: '(11) 98888-5555',
      document: 'TECNICO-ENF 8844',
      status: 'ativo',
      company_id: 'cmp_demo_1',
      unit_id: 'unit_h1'
    },
    {
      id: 'prof_7',
      name: 'Dr. Eduardo Costa',
      category: 'medico',
      specialty: 'Cardiologia',
      email: 'eduardo@medscale.com',
      phone: '(11) 98888-6666',
      document: 'CRM-SP 998877',
      status: 'ativo',
      company_id: 'cmp_demo_1',
      unit_id: 'unit_h2'
    },
    {
      id: 'prof_8',
      name: 'Enf. Paula Rocha',
      category: 'enfermeiro',
      specialty: 'UTI',
      email: 'paula@medscale.com',
      phone: '(11) 98888-7777',
      document: 'COREN-SP 112233',
      status: 'ativo',
      company_id: 'cmp_demo_1',
      unit_id: 'unit_h2'
    },
    {
      id: 'prof_9',
      name: 'Téc. Bruno Silva',
      category: 'tecnico',
      specialty: 'Enfermagem',
      email: 'bruno@medscale.com',
      phone: '(11) 98888-8888',
      document: 'TECNICO-ENF 5544',
      status: 'ativo',
      company_id: 'cmp_demo_1',
      unit_id: 'unit_h2'
    }
  ],
  sectors: [
    { id: 'sec_1', name: 'Cardiologia', specialty: 'Cardiologia', color: '#0ea5e9', active: true, min_staff: 2, company_id: 'cmp_demo_1' },
    { id: 'sec_2', name: 'UTI', specialty: 'Emergência', color: '#7c3aed', active: true, min_staff: 3, company_id: 'cmp_demo_1' },
    { id: 'sec_3', name: 'Clínica Médica', specialty: 'Atendimento ambulatorial', color: '#10b981', active: true, min_staff: 2, company_id: 'cmp_demo_1' }
  ],
  shifts: [
    { id: 'shift_1', date: '2026-08-03', start_time: '07:00', end_time: '19:00', shift_type: 'diurno', sector_id: 'sec_1', sector_name: 'Cardiologia', professional_id: 'prof_2', professional_name: 'Dr. Carlos Mendes', status: 'confirmado', company_id: 'cmp_demo_1', unit_id: 'unit_h1', duration_hours: 12 },
    { id: 'shift_2', date: '2026-08-04', start_time: '19:00', end_time: '07:00', shift_type: 'noturno', sector_id: 'sec_2', sector_name: 'UTI', professional_id: 'prof_4', professional_name: 'Enf. Mariana Nogueira', status: 'confirmado', company_id: 'cmp_demo_1', unit_id: 'unit_h1', duration_hours: 12 },
    { id: 'shift_3', date: '2026-08-05', start_time: '08:00', end_time: '17:00', shift_type: 'diurno', sector_id: 'sec_3', sector_name: 'Clínica Médica', professional_id: 'prof_3', professional_name: 'Dr. Aline Ribeiro', status: 'confirmado', company_id: 'cmp_demo_1', unit_id: 'unit_h1', duration_hours: 9 },
    { id: 'shift_4', date: '2026-08-07', start_time: '07:00', end_time: '19:00', shift_type: 'diurno', sector_id: 'sec_1', sector_name: 'Cardiologia', professional_id: 'prof_7', professional_name: 'Dr. Eduardo Costa', status: 'confirmado', company_id: 'cmp_demo_1', unit_id: 'unit_h2', duration_hours: 12 },
    { id: 'shift_5', date: '2026-08-09', start_time: '19:00', end_time: '07:00', shift_type: 'noturno', sector_id: 'sec_2', sector_name: 'UTI', professional_id: 'prof_8', professional_name: 'Enf. Paula Rocha', status: 'confirmado', company_id: 'cmp_demo_1', unit_id: 'unit_h2', duration_hours: 12 },
    { id: 'shift_6', date: '2026-08-12', start_time: '08:00', end_time: '16:00', shift_type: 'diurno', sector_id: 'sec_3', sector_name: 'Clínica Médica', professional_id: 'prof_9', professional_name: 'Téc. Bruno Silva', status: 'confirmado', company_id: 'cmp_demo_1', unit_id: 'unit_h2', duration_hours: 8 },
    { id: 'shift_7', date: '2026-08-15', start_time: '07:00', end_time: '19:00', shift_type: 'diurno', sector_id: 'sec_1', sector_name: 'Cardiologia', professional_id: 'prof_2', professional_name: 'Dr. Carlos Mendes', status: 'confirmado', company_id: 'cmp_demo_1', unit_id: 'unit_h1', duration_hours: 12 },
    { id: 'shift_8', date: '2026-08-18', start_time: '08:00', end_time: '17:00', shift_type: 'diurno', sector_id: 'sec_3', sector_name: 'Clínica Médica', professional_id: 'prof_3', professional_name: 'Dr. Aline Ribeiro', status: 'confirmado', company_id: 'cmp_demo_1', unit_id: 'unit_h1', duration_hours: 9 },
    { id: 'shift_9', date: '2026-08-22', start_time: '07:00', end_time: '19:00', shift_type: 'diurno', sector_id: 'sec_1', sector_name: 'Cardiologia', professional_id: 'prof_7', professional_name: 'Dr. Eduardo Costa', status: 'confirmado', company_id: 'cmp_demo_1', unit_id: 'unit_h2', duration_hours: 12 },
    { id: 'shift_10', date: '2026-08-26', start_time: '19:00', end_time: '07:00', shift_type: 'noturno', sector_id: 'sec_2', sector_name: 'UTI', professional_id: 'prof_8', professional_name: 'Enf. Paula Rocha', status: 'confirmado', company_id: 'cmp_demo_1', unit_id: 'unit_h2', duration_hours: 12 },
    { id: 'shift_11', date: '2026-08-28', start_time: '08:00', end_time: '16:00', shift_type: 'diurno', sector_id: 'sec_3', sector_name: 'Clínica Médica', professional_id: 'prof_3', professional_name: 'Dr. Aline Ribeiro', status: 'pendente', company_id: 'cmp_demo_1', unit_id: 'unit_h1', duration_hours: 8 },
    { id: 'shift_12', date: '2026-09-02', start_time: '07:00', end_time: '19:00', shift_type: 'diurno', sector_id: 'sec_1', sector_name: 'Cardiologia', professional_id: 'prof_2', professional_name: 'Dr. Carlos Mendes', status: 'confirmado', company_id: 'cmp_demo_1', unit_id: 'unit_h1', duration_hours: 12 },
    { id: 'shift_13', date: '2026-09-02', start_time: '19:00', end_time: '07:00', shift_type: 'noturno', sector_id: 'sec_2', sector_name: 'UTI', professional_id: 'prof_4', professional_name: 'Enf. Mariana Nogueira', status: 'confirmado', company_id: 'cmp_demo_1', unit_id: 'unit_h1', duration_hours: 12 },
    { id: 'shift_14', date: '2026-09-03', start_time: '08:00', end_time: '17:00', shift_type: 'diurno', sector_id: 'sec_3', sector_name: 'Clínica Médica', professional_id: 'prof_3', professional_name: 'Dr. Aline Ribeiro', status: 'confirmado', company_id: 'cmp_demo_1', unit_id: 'unit_h1', duration_hours: 9 },
    { id: 'shift_15', date: '2026-09-03', start_time: '07:00', end_time: '19:00', shift_type: 'diurno', sector_id: 'sec_1', sector_name: 'Cardiologia', professional_id: 'prof_7', professional_name: 'Dr. Eduardo Costa', status: 'confirmado', company_id: 'cmp_demo_1', unit_id: 'unit_h2', duration_hours: 12 },
    { id: 'shift_16', date: '2026-09-04', start_time: '19:00', end_time: '07:00', shift_type: 'noturno', sector_id: 'sec_2', sector_name: 'UTI', professional_id: 'prof_8', professional_name: 'Enf. Paula Rocha', status: 'confirmado', company_id: 'cmp_demo_1', unit_id: 'unit_h2', duration_hours: 12 },
    { id: 'shift_17', date: '2026-09-05', start_time: '08:00', end_time: '16:00', shift_type: 'diurno', sector_id: 'sec_3', sector_name: 'Clínica Médica', professional_id: 'prof_9', professional_name: 'Téc. Bruno Silva', status: 'confirmado', company_id: 'cmp_demo_1', unit_id: 'unit_h2', duration_hours: 8 }
  ],
  shiftSwaps: [
    {
      id: 'swap_1',
      shift_id: 'shift_3',
      shift_date: '2026-09-03',
      requester_id: 'prof_1',
      requester_name: 'Dr. Carlos Mendes',
      target_id: 'prof_2',
      target_name: 'Enf. Mariana Nogueira',
      reason: 'Possibilidade de auxílio no mesmo turno',
      status: 'pendente',
      company_id: 'cmp_demo_1'
    }
  ],
  billingRecords: [
    { id: 'bill_aug_1', professional_id: 'prof_2', professional_name: 'Dr. Carlos Mendes', date: '2026-08-03', hours: 12, value: 820, company_id: 'cmp_demo_1', shift_id: 'shift_1', status: 'pago' },
    { id: 'bill_aug_2', professional_id: 'prof_4', professional_name: 'Enf. Mariana Nogueira', date: '2026-08-04', hours: 12, value: 0, company_id: 'cmp_demo_1', shift_id: 'shift_2', status: 'pendente' },
    { id: 'bill_aug_3', professional_id: 'prof_3', professional_name: 'Dr. Aline Ribeiro', date: '2026-08-05', hours: 9, value: 700, company_id: 'cmp_demo_1', shift_id: 'shift_3', status: 'pago' },
    { id: 'bill_aug_4', professional_id: 'prof_7', professional_name: 'Dr. Eduardo Costa', date: '2026-08-07', hours: 12, value: 0, company_id: 'cmp_demo_1', shift_id: 'shift_4', status: 'pendente' },
    { id: 'bill_aug_5', professional_id: 'prof_8', professional_name: 'Enf. Paula Rocha', date: '2026-08-09', hours: 12, value: 0, company_id: 'cmp_demo_1', shift_id: 'shift_5', status: 'pendente' },
    { id: 'bill_aug_6', professional_id: 'prof_9', professional_name: 'Téc. Bruno Silva', date: '2026-08-12', hours: 8, value: 0, company_id: 'cmp_demo_1', shift_id: 'shift_6', status: 'pendente' },
    { id: 'bill_aug_7', professional_id: 'prof_2', professional_name: 'Dr. Carlos Mendes', date: '2026-08-15', hours: 12, value: 820, company_id: 'cmp_demo_1', shift_id: 'shift_7', status: 'pendente' },
    { id: 'bill_aug_8', professional_id: 'prof_3', professional_name: 'Dr. Aline Ribeiro', date: '2026-08-18', hours: 9, value: 700, company_id: 'cmp_demo_1', shift_id: 'shift_8', status: 'pago' },
    { id: 'bill_aug_9', professional_id: 'prof_7', professional_name: 'Dr. Eduardo Costa', date: '2026-08-22', hours: 12, value: 0, company_id: 'cmp_demo_1', shift_id: 'shift_9', status: 'pendente' },
    { id: 'bill_aug_10', professional_id: 'prof_8', professional_name: 'Enf. Paula Rocha', date: '2026-08-26', hours: 12, value: 0, company_id: 'cmp_demo_1', shift_id: 'shift_10', status: 'pendente' },
    { id: 'bill_aug_11', professional_id: 'prof_3', professional_name: 'Dr. Aline Ribeiro', date: '2026-08-28', hours: 8, value: 700, company_id: 'cmp_demo_1', shift_id: 'shift_11', status: 'pendente' },
    { id: 'bill_1', date: '2026-09-01', value: 15000, company_id: 'cmp_demo_1' },
    { id: 'bill_2', date: '2026-09-02', value: 18250, company_id: 'cmp_demo_1' },
    { id: 'bill_3', date: '2026-09-03', value: 21000, company_id: 'cmp_demo_1' }
  ],
  notifications: [
    { id: 'ntf_1', professional_id: 'prof_1', title: 'Novo plantão', message: 'Você recebeu um novo plantão para o dia 02/09.', read: false, company_id: 'cmp_demo_1' }
  ],
  pricingGroups: [
    { id: 'sale_venda', name: 'Vendas', type: 'venda', monthly: 1490, quarterly: 3970, annual: 14900, active: true },
    { id: 'sale_aluguel', name: 'Aluguel', type: 'aluguel', monthly: 890, quarterly: 2390, annual: 9600, active: true },
    { id: 'sale_pacote', name: 'Pacote Mensal', type: 'pacote', monthly: 2490, quarterly: 6700, annual: 25000, active: true },
    { id: 'sale_premium', name: 'Plano Premium', type: 'premium', monthly: 3990, quarterly: 10700, annual: 42000, active: true }
  ]
};

const readStore = () => {
  if (typeof window === 'undefined') return defaultState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState));
      return defaultState;
    }
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      currentUser: parsed.currentUser || null,
      token: parsed.token || null,
      pendingOtp: parsed.pendingOtp || null,
      companies: parsed.companies || [],
      users: parsed.users || [],
      professionals: parsed.professionals || [],
      sectors: parsed.sectors || [],
      shifts: parsed.shifts || [],
      shiftSwaps: parsed.shiftSwaps || [],
      billingRecords: parsed.billingRecords || [],
      notifications: parsed.notifications || [],
      pricingGroups: parsed.pricingGroups || defaultState.pricingGroups
    };
  } catch (error) {
    return defaultState;
  }
};

const saveStore = (nextState) => {
  if (typeof window === 'undefined') return nextState;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  return nextState;
};

const getDemoState = () => {
  const state = readStore();
  if (!state.users || state.users.length === 0) {
    state.users = [...defaultState.users];
  }
  if (!state.companies || state.companies.length === 0) {
    state.companies = [...defaultState.companies];
  }
  if (!state.professionals || state.professionals.length === 0) {
    state.professionals = [...defaultState.professionals];
  }
  if (!state.sectors || state.sectors.length === 0) {
    state.sectors = [...defaultState.sectors];
  }
  if (!state.shifts || state.shifts.length === 0) {
    state.shifts = [...defaultState.shifts];
  }
  if (!state.shiftSwaps || state.shiftSwaps.length === 0) {
    state.shiftSwaps = [...defaultState.shiftSwaps];
  }
  if (!state.billingRecords || state.billingRecords.length === 0) {
    state.billingRecords = [...defaultState.billingRecords];
  }
  if (!state.notifications || state.notifications.length === 0) {
    state.notifications = [...defaultState.notifications];
  }
  if (!state.pricingGroups || state.pricingGroups.length === 0) {
    state.pricingGroups = [...defaultState.pricingGroups];
  }
  if (!state._unitDataMigrated) {
    const legacySectors = state.sectors.filter((sector) => !sector.unit_id);
    const unitTwoSectors = legacySectors.map((sector) => ({ ...sector, id: `${sector.id}_h2`, unit_id: 'unit_h2' }));
    state.sectors = state.sectors.map((sector) => ({ ...sector, unit_id: sector.unit_id || 'unit_h1' })).concat(unitTwoSectors);
    const sectorMap = Object.fromEntries(legacySectors.map((sector) => [sector.id, `${sector.id}_h2`]));
    state.shifts = state.shifts.map((shift) => shift.unit_id === 'unit_h2' ? { ...shift, sector_id: sectorMap[shift.sector_id] || shift.sector_id } : shift);
    state.billingRecords = state.billingRecords.map((record) => {
      const professional = state.professionals.find((item) => item.id === record.professional_id);
      return { ...record, unit_id: record.unit_id || professional?.unit_id || 'unit_h1' };
    });
    state.shiftSwaps = state.shiftSwaps.map((swap) => ({ ...swap, unit_id: swap.unit_id || 'unit_h1' }));
    state._unitDataMigrated = true;
    saveStore(state);
  }
  return state;
};

const sortByCreatedDate = (items, direction = 'desc') => {
  return [...items].sort((a, b) => {
    const aT = new Date(a.created_date || 0).getTime();
    const bT = new Date(b.created_date || 0).getTime();
    return direction === 'asc' ? aT - bT : bT - aT;
  });
};

const buildEntityApi = (entityKey, itemKey = entityKey.toLowerCase()) => ({
  list: async (sort = '-created_date', limit = 200) => {
    const state = getDemoState();
    const items = sortByCreatedDate(state[itemKey] || [], sort.startsWith('-') ? 'desc' : 'asc');
    return items.slice(0, limit || items.length);
  },
  filter: async (filters = {}, sort = '-created_date', limit = 200) => {
    const state = getDemoState();
    const items = (state[itemKey] || []).filter((item) => {
      return Object.entries(filters).every(([key, value]) => {
        if (value === undefined || value === null || value === '') return true;
        if (typeof value === 'string' && value.startsWith('!')) {
          return item[key] !== value.slice(1);
        }
        return item[key] === value;
      });
    });
    const ordered = sortByCreatedDate(items, sort.startsWith('-') ? 'desc' : 'asc');
    return ordered.slice(0, limit || ordered.length);
  },
  get: async (id) => {
    const state = getDemoState();
    return (state[itemKey] || []).find((item) => item.id === id) || null;
  },
  create: async (payload) => {
    const state = getDemoState();
    const nextItem = {
      ...payload,
      id: payload.id || `${itemKey}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString()
    };
    state[itemKey] = [...(state[itemKey] || []), nextItem];
    saveStore(state);
    return nextItem;
  },
  bulkCreate: async (payloads = []) => {
    const state = getDemoState();
    const nextItems = (payloads || []).map((payload) => ({
      ...payload,
      id: payload.id || `${itemKey}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString()
    }));
    state[itemKey] = [...(state[itemKey] || []), ...nextItems];
    saveStore(state);
    return nextItems;
  },
  update: async (id, payload) => {
    const state = getDemoState();
    const list = state[itemKey] || [];
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) throw new Error(`${entityKey} not found`);
    const nextItem = { ...list[index], ...payload, updated_date: new Date().toISOString() };
    list[index] = nextItem;
    state[itemKey] = list;
    saveStore(state);
    return nextItem;
  },
  delete: async (id) => {
    const state = getDemoState();
    state[itemKey] = (state[itemKey] || []).filter((item) => item.id !== id);
    saveStore(state);
    return true;
  }
});

const makeAuth = () => ({
  me: async () => {
    const state = getDemoState();
    if (!state.currentUser) return null;

    const linkedProfessional = (state.professionals || []).find((professional) => {
      return professional.user_id === state.currentUser.id || professional.email?.toLowerCase() === state.currentUser.email?.toLowerCase();
    });

    if (linkedProfessional && linkedProfessional.name) {
      return {
        ...state.currentUser,
        full_name: linkedProfessional.name,
        data: {
          ...(state.currentUser.data || {}),
          professional_id: linkedProfessional.id,
          professional_role: linkedProfessional.role || linkedProfessional.specialty || linkedProfessional.category || 'Profissional'
        }
      };
    }

    return state.currentUser;
  },
  loginViaEmailPassword: async (identifier, password) => {
    const state = getDemoState();
    const normalized = String(identifier || '').trim();
    const user = (state.users || []).find((u) => {
      const username = String(u.username || '').trim().toLowerCase();
      const email = String(u.email || '').trim().toLowerCase();
      return (username === normalized.toLowerCase() || email === normalized.toLowerCase()) && String(u.password) === String(password);
    });
    if (!user) {
      throw new Error('Usuário ou senha inválidos.');
    }
    const linkedProfessional = (state.professionals || []).find((professional) => {
      return professional.user_id === user.id || professional.email?.toLowerCase() === user.email?.toLowerCase();
    });

    state.currentUser = {
      ...user,
      full_name: linkedProfessional?.name || user.full_name || user.email,
      data: {
        ...(user.data || {}),
        professional_id: linkedProfessional?.id || user.data?.professional_id,
        professional_role: linkedProfessional?.role || linkedProfessional?.specialty || linkedProfessional?.category || user.data?.professional_role || 'Profissional',
        selected_unit_id: user.data?.selected_unit_id || linkedProfessional?.unit_id || user.data?.unit_id || 'unit_h1'
      }
    };
    state.token = `demo-token-${user.id}`;
    saveStore(state);
    return { user: state.currentUser, token: state.token };
  },
  loginViaUsernamePassword: async (username, password) => {
    return makeAuth().loginViaEmailPassword(username, password);
  },
  loginWithProvider: async (provider, returnTo) => {
    const state = getDemoState();
    const demoUser = (state.users || []).find((u) => u.role === 'admin') || (state.users || [])[0];
    if (!demoUser) {
      throw new Error('Nenhum usuário de demonstração disponível.');
    }
    state.currentUser = { ...demoUser, data: demoUser.data || {} };
    state.token = `demo-provider-token-${demoUser.id}`;
    saveStore(state);
    if (typeof window !== 'undefined') {
      const url = returnTo || '/';
      window.location.href = url;
    }
    return { user: state.currentUser, token: state.token };
  },
  logout: async (redirectTo = '/login') => {
    const state = getDemoState();
    state.currentUser = null;
    state.token = null;
    saveStore(state);
    if (typeof window !== 'undefined' && redirectTo) {
      window.location.href = redirectTo;
    }
    return true;
  },
  redirectToLogin: (redirectTo = '/login') => {
    if (typeof window !== 'undefined') {
      window.location.href = redirectTo;
    }
  },
  register: async ({ email, password, full_name, role = 'Gestor', accountRole, cpf, idade, cbo }) => {
    const state = getDemoState();
    const normalizedEmail = String(email).trim().toLowerCase();
    const userExists = (state.users || []).some((u) => u.email.toLowerCase() === normalizedEmail);
    if (userExists) {
      throw new Error('Este e-mail já está cadastrado.');
    }
    const resolvedName = String(full_name || normalizedEmail.split('@')[0]).trim();
    const selectedRole = String(accountRole || role || 'Gestor').trim();
    const isManager = selectedRole === 'Gestor' || selectedRole === 'Diretor Médico' || selectedRole === 'manager';
    state.pendingOtp = { email: normalizedEmail, otp: '123456' };
    const newUser = {
      id: `usr_${Date.now()}`,
      email: normalizedEmail,
      password: String(password),
      full_name: resolvedName,
      role: isManager ? 'admin' : 'user',
      data: {
        company_id: '',
        app_role: isManager ? 'manager' : 'professional',
        professional_role: selectedRole,
        cpf: cpf || '',
        idade: idade ? Number(idade) : null,
        cbo: cbo || ''
      }
    };
    state.users = [...(state.users || []), newUser];
    saveStore(state);
    return { ok: true, email: normalizedEmail };
  },
  verifyOtp: async ({ email, otpCode }) => {
    const state = getDemoState();
    const expected = state.pendingOtp;
    if (!expected || expected.email !== String(email).trim().toLowerCase()) {
      throw new Error('Código de verificação inválido.');
    }
    if (String(otpCode) !== String(expected.otp)) {
      throw new Error('Código de verificação inválido.');
    }
    const user = (state.users || []).find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
    if (!user) throw new Error('Usuário não encontrado.');
    state.currentUser = { ...user, data: user.data || {} };
    state.token = `demo-token-${user.id}`;
    state.pendingOtp = null;
    saveStore(state);
    return { access_token: state.token, user: state.currentUser };
  },
  resendOtp: async (email) => {
    const state = getDemoState();
    state.pendingOtp = { email: String(email).trim().toLowerCase(), otp: '123456' };
    saveStore(state);
    return { ok: true };
  },
  resetPasswordRequest: async (email) => {
    return { ok: true, email };
  },
  setToken: (token) => {
    const state = getDemoState();
    state.token = token;
    saveStore(state);
  },
  updateMe: async (payload) => {
    const state = getDemoState();
    if (!state.currentUser) return null;
    state.currentUser = {
      ...state.currentUser,
      ...payload,
      data: { ...(state.currentUser.data || {}), ...(payload.data || {}) }
    };
    saveStore(state);
    return state.currentUser;
  }
});

const entityApis = {
  Company: buildEntityApi('Company', 'companies'),
  User: buildEntityApi('User', 'users'),
  Professional: buildEntityApi('Professional', 'professionals'),
  Sector: buildEntityApi('Sector', 'sectors'),
  Shift: buildEntityApi('Shift', 'shifts'),
  ShiftSwap: buildEntityApi('ShiftSwap', 'shiftSwaps'),
  BillingRecord: buildEntityApi('BillingRecord', 'billingRecords'),
  Notification: buildEntityApi('Notification', 'notifications')
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const matchingOpenShiftProfessionals = (state, shift) => {
  const sector = (state.sectors || []).find((item) => item.id === shift.sector_id) || {};
  const sectorName = normalizeText(shift.sector_name || sector.name || '');
  const sectorSpecialty = normalizeText(sector.specialty || '');

  return (state.professionals || []).filter((professional) => {
    if (!professional || professional.status === 'inativo') return false;
    if (professional.company_id && professional.company_id !== shift.company_id) return false;
    if (professional.unit_id && shift.unit_id && professional.unit_id !== shift.unit_id) return false;

    const specialty = normalizeText(professional.specialty || '');
    const category = normalizeText(professional.category || '');
    const terms = [specialty, category, sectorName, sectorSpecialty].filter(Boolean);

    const matchesSpecialty = terms.some((term) => {
      return term && (
        specialty.includes(term) ||
        term.includes(specialty) ||
        category.includes(term) ||
        term.includes(category) ||
        sectorName.includes(term) ||
        term.includes(sectorName)
      );
    });

    if (!matchesSpecialty) return false;

    const alreadyAssigned = (state.shifts || []).some((existingShift) => {
      if (!existingShift || existingShift.id === shift.id) return false;
      if (existingShift.professional_id !== professional.id) return false;
      if (existingShift.status === 'cancelado') return false;
      if (existingShift.date !== shift.date) return false;
      return true;
    });

    return !alreadyAssigned;
  });
};

const createOpenShiftNotifications = (state, shift) => {
  if (!shift || shift.status !== 'vago') return [];

  const matchingProfessionals = matchingOpenShiftProfessionals(state, shift);
  const createdNotifications = [];

  for (const professional of matchingProfessionals) {
    const alreadyNotified = (state.notifications || []).some((notification) => {
      return notification.shift_id === shift.id && notification.professional_id === professional.id;
    });

    if (alreadyNotified) continue;

    const notification = {
      id: `ntf_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      professional_id: professional.id,
      title: 'Vaga disponível para cobertura',
      message: `Há uma vaga para ${shift.sector_name || 'sua especialidade'} no dia ${shift.date} (${shift.start_time} às ${shift.end_time}). Aceite para assumir este plantão.`,
      read: false,
      shift_id: shift.id,
      company_id: shift.company_id,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString()
    };

    state.notifications = [...(state.notifications || []), notification];
    createdNotifications.push(notification);
  }

  return createdNotifications;
};

const functionsApi = {
  invoke: async (name, payload = {}) => {
    if (name === 'saveShift') {
      const state = getDemoState();
      const { action, shiftData, shiftId } = payload;

      if (action === 'create') {
        const nextShift = {
          ...(shiftData || {}),
          id: shiftData?.id || `shift_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
          status: shiftData?.professional_id ? (shiftData?.status || 'pendente') : 'vago',
        };

        if (nextShift.professional_id) {
          const professional = (state.professionals || []).find((item) => item.id === nextShift.professional_id);
          nextShift.professional_name = nextShift.professional_name || professional?.name || '';
        }

        if (nextShift.sector_id) {
          const sector = (state.sectors || []).find((item) => item.id === nextShift.sector_id);
          nextShift.sector_name = nextShift.sector_name || sector?.name || '';
        }

        state.shifts = [...(state.shifts || []), nextShift];
        if (nextShift.status === 'vago') {
          createOpenShiftNotifications(state, nextShift);
        }
        saveStore(state);
        return { ok: true, shift: nextShift };
      }

      if (action === 'update') {
        const list = state.shifts || [];
        const index = list.findIndex((item) => item.id === shiftId);
        if (index === -1) throw new Error('Plantão não encontrado.');

        const current = list[index];
        const nextShift = {
          ...current,
          ...(shiftData || {}),
          updated_date: new Date().toISOString(),
          status: shiftData?.professional_id ? (shiftData?.status || current.status || 'pendente') : 'vago',
        };

        if (nextShift.professional_id) {
          const professional = (state.professionals || []).find((item) => item.id === nextShift.professional_id);
          nextShift.professional_name = nextShift.professional_name || professional?.name || current.professional_name || '';
        } else {
          nextShift.professional_name = '';
        }

        if (nextShift.sector_id) {
          const sector = (state.sectors || []).find((item) => item.id === nextShift.sector_id);
          nextShift.sector_name = nextShift.sector_name || sector?.name || current.sector_name || '';
        }

        list[index] = nextShift;
        state.shifts = list;
        if (nextShift.status === 'vago') {
          createOpenShiftNotifications(state, nextShift);
        }
        saveStore(state);
        return { ok: true, shift: nextShift };
      }
    }

    if (name === 'manageShiftSwap') {
      const state = getDemoState();
      if (payload.action === 'request') {
        const swap = {
          id: payload.swapId || `swap_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
          shift_id: payload.shiftId,
          shift_date: payload.shiftDate,
          requester_id: payload.requesterId,
          requester_name: payload.requesterName || 'Solicitante',
          target_id: payload.targetId || '',
          target_name: payload.targetName || '',
          reason: payload.reason || '',
          status: 'pendente',
          company_id: payload.companyId,
          unit_id: payload.unitId || 'unit_h1',
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString()
        };
        state.shiftSwaps = [...(state.shiftSwaps || []), swap];
        saveStore(state);
        return { ok: true, swapId: swap.id };
      }

      const swap = (state.shiftSwaps || []).find((item) => item.id === payload.swapId);
      if (!swap) throw new Error('Solicitação não encontrada.');
      if (payload.action === 'approve') {
        swap.status = 'aprovada';
        const shift = (state.shifts || []).find((item) => item.id === swap.shift_id);
        if (shift) {
          if (swap.target_id) {
            shift.professional_id = swap.target_id;
            shift.professional_name = swap.target_name || shift.professional_name;
            shift.status = 'confirmado';
          } else {
            shift.professional_id = '';
            shift.professional_name = '';
            shift.status = 'vago';
          }
        }
      }
      if (payload.action === 'reject') {
        swap.status = 'rejeitada';
      }
      saveStore(state);
      return { ok: true };
    }
    return { ok: true };
  }
};

const usersApi = {
  inviteUser: async (email, role = 'user') => {
    const state = getDemoState();
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = (state.users || []).find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!existing) {
      state.users = [
        ...(state.users || []),
        {
          id: `usr_invite_${Date.now()}`,
          email: normalizedEmail,
          password: '123456',
          full_name: normalizedEmail.split('@')[0],
          role: role === 'admin' ? 'admin' : 'user',
          data: { company_id: state.currentUser?.data?.company_id || '', app_role: role === 'admin' ? 'manager' : 'professional' }
        }
      ];
      saveStore(state);
    }
    return { ok: true };
  }
};

const mockBase44 = {
  auth: makeAuth(),
  entities: entityApis,
  functions: functionsApi,
  users: usersApi,
  asServiceRole: {
    entities: entityApis,
    integrations: {
      Core: { SendEmail: async () => ({ ok: true }) }
    }
  }
};

// REMOVIDO: Login automático que estava causando o problema
// O site agora sobe na página de login sem carregar usuário automaticamente

const appId = appParams?.appId || 'demo-app-local';
const token = appParams?.token || 'demo-token-local';
const base44 = mockBase44;

export { base44 };