// Importação do Corpo Clínico por planilha: aceita a planilha do próprio hospital (cabeçalhos
// com nomes comuns), corrige o que dá para corrigir e só deixa de fora o que não tem como entrar
// (sem nome, repetido na planilha ou já cadastrado). O resto entra com aviso para ajustar depois.
import { blockedSectorsFrom } from './sectorAccess.js';
import { safeNumber } from './format.js';

export function normalizeKey(value) {
  return String(value ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

const loose = value => normalizeKey(value).replace(/_/g, ' ').trim();

// Cabeçalho da planilha (já normalizado) → campo do sistema.
const HEADER_ALIASES = {
  nome_completo: ['nome_completo', 'nome', 'profissional', 'nome_do_profissional', 'nome_profissional', 'medico', 'colaborador', 'prestador'],
  categoria: ['categoria', 'profissao', 'cargo', 'funcao', 'categoria_profissional', 'tipo_profissional'],
  conselho: ['conselho', 'crm', 'coren', 'registro', 'registro_profissional', 'numero_conselho', 'crm_uf', 'n_conselho', 'conselho_de_classe', 'crefito', 'crf', 'crn', 'crp'],
  matricula: ['matricula', 'codigo', 'id_funcional', 'cod'],
  setor_principal: ['setor_principal', 'setor', 'lotacao', 'area'],
  especialidade: ['especialidade', 'especialidades', 'especializacao', 'area_de_atuacao', 'especialidade_principal'],
  rqe: ['rqe'],
  cbo: ['cbo'],
  cpf: ['cpf', 'cpf_do_profissional', 'documento'],
  email: ['email', 'e_mail', 'mail', 'correio_eletronico'],
  telefone: ['telefone', 'celular', 'whatsapp', 'fone', 'contato', 'telefone_celular', 'tel'],
  data_nascimento: ['data_nascimento', 'data_de_nascimento', 'nascimento', 'dt_nascimento', 'dn', 'aniversario', 'data_nasc', 'nasc'],
  status: ['status', 'situacao'],
  perfil_acesso: ['perfil_acesso', 'perfil', 'acesso', 'perfil_de_acesso'],
  regime_remuneracao: ['regime_remuneracao', 'regime', 'remuneracao', 'forma_de_pagamento', 'tipo_de_remuneracao', 'vinculo'],
  salario_mensal: ['salario_mensal', 'salario', 'valor_mensal', 'fixo_mensal', 'mensal'],
  valor_plantao: ['valor_plantao', 'valor_do_plantao', 'valor', 'valor_12h', 'valor_hora_plantao'],
  valor_diurno: ['valor_diurno', 'diurno', 'plantao_diurno'],
  valor_noturno: ['valor_noturno', 'noturno', 'plantao_noturno'],
  valor_fds: ['valor_fds', 'fds', 'fim_de_semana', 'valor_fim_de_semana', 'plantao_fds'],
  retencao_percentual: ['retencao_percentual', 'retencao', 'desconto', 'taxa_cooperativa', 'percentual_retencao'],
  tipo_pix: ['tipo_pix', 'tipo_chave_pix', 'tipo_de_chave'],
  chave_pix: ['chave_pix', 'pix', 'chave'],
  dados_bancarios: ['dados_bancarios', 'banco', 'conta', 'conta_bancaria', 'dados_banco'],
  validade_credencial: ['validade_credencial', 'validade', 'vencimento', 'validade_registro'],
  unidades_permitidas: ['unidades_permitidas', 'unidade', 'unidades', 'hospital', 'hospitais'],
  setores_autorizados: ['setores_autorizados', 'setores'],
  valores_por_unidade_json: ['valores_por_unidade_json'],
  tipo_recibo: ['tipo_recibo', 'pf_pj', 'pessoa', 'tipo_pessoa'],
  cnpj: ['cnpj', 'cnpj_empresa'],
  razao_social: ['razao_social', 'empresa', 'nome_empresa', 'pj']
};
const HEADER_LOOKUP = new Map(Object.entries(HEADER_ALIASES).flatMap(([field, list]) => list.map(alias => [alias, field])));

// Converte uma linha da planilha (cabeçalho → valor) para os campos do sistema.
export function mapRow(rawRow) {
  const row = {};
  const unknown = [];
  Object.entries(rawRow).forEach(([header, value]) => {
    if (header.startsWith('_')) return;
    const key = normalizeKey(header);
    const field = HEADER_LOOKUP.get(key);
    const text = String(value ?? '').trim();
    if (field) { if (!row[field] && text) row[field] = text; else if (!(field in row)) row[field] = text; }
    else if (key && text) unknown.push(header);
  });
  return { row, unknown };
}

// Datas: AAAA-MM-DD, DD/MM/AAAA, DD-MM-AAAA, DD.MM.AAAA, DD/MM/AA e número de série do Excel.
export function parseFlexibleDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  let y; let m; let d;
  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) [, y, m, d] = match.map(Number);
  if (!match) {
    match = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
    if (match) {
      [, d, m, y] = match.map(Number);
      if (match[3].length === 2) y += y > 30 ? 1900 : 2000;
    }
  }
  if (!match && /^\d{4,6}(\.\d+)?$/.test(raw)) {
    const serial = Math.floor(Number(raw));
    if (serial > 1000 && serial < 80000) {
      const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
      match = true;
    }
  }
  if (!match) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Categoria pelo nome exato ou por palavra-chave (médico, enfermeiro, técnico…).
export function resolveCategory(input, categories) {
  const text = loose(input);
  if (!text) return { id: 'medico', guessed: false };
  const exact = categories.find(c => loose(c.id) === text || loose(c.label) === text || loose(c.label.replace(/\(.*?\)/g, '')) === text);
  if (exact) return { id: exact.id, guessed: false };
  const rules = [
    [/tecnic|auxiliar de enf|aux enf/, 'tecnico_enfermagem'],
    [/enferm/, 'enfermeiro'],
    [/fisio/, 'fisioterapeuta'],
    [/farmac/, 'farmaceutico'],
    [/nutri/, 'nutricionista'],
    [/psic/, 'psicologo'],
    [/biomed/, 'biomedico'],
    [/medic|^dr|plantonista|cirurg|pediatr|clinic|anestes|obstet|ortoped|cardio|intensiv/, 'medico']
  ];
  const hit = rules.find(([re]) => re.test(text));
  if (hit && categories.some(c => c.id === hit[1])) return { id: hit[1], guessed: true };
  return { id: 'medico', guessed: true, unknown: true };
}

// TUDO MAIÚSCULO ou tudo minúsculo vira "Nome Próprio" (de/da/do ficam minúsculos).
export function properCase(value) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text || (text !== text.toUpperCase() && text !== text.toLowerCase())) return text;
  const small = new Set(['e', 'de', 'da', 'do', 'das', 'dos']);
  return text.toLowerCase().split(' ').map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

// Mesma especialidade escrita de outro jeito ("clinica medica") usa a grafia já cadastrada.
export function resolveSpecialty(input, existing = []) {
  const text = String(input || '').trim().replace(/\s+/g, ' ');
  if (!text) return '';
  const found = existing.find(name => loose(name) === loose(text));
  return found || properCase(text);
}

// Tipo da chave PIX: o declarado, se for válido; senão, deduzido da própria chave
// (igual ao CPF ou ao telefone da linha, e-mail, CNPJ, chave aleatória).
export function inferPixType(key, declared, { cpf = '', phone = '' } = {}) {
  const types = ['CPF', 'CNPJ', 'Email', 'Telefone', 'Aleatoria'];
  const declaredKey = normalizeKey(declared);
  const fromDeclared = types.find(t => normalizeKey(t) === declaredKey) ||
    (declaredKey === 'aleatorio' || declaredKey === 'chave_aleatoria' ? 'Aleatoria' : declaredKey === 'celular' ? 'Telefone' : declaredKey === 'e_mail' ? 'Email' : null);
  if (fromDeclared) return fromDeclared;
  const text = String(key || '').trim();
  if (!text) return 'CPF';
  if (text.includes('@')) return 'Email';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(text)) return 'Aleatoria';
  const digits = text.replace(/\D/g, '');
  if (digits && digits === String(cpf).replace(/\D/g, '')) return 'CPF';
  if (digits && digits === String(phone).replace(/\D/g, '')) return 'Telefone';
  if (digits.length === 14) return 'CNPJ';
  if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(text)) return 'CPF';
  if (digits.length >= 10 && digits.length <= 13) return 'Telefone';
  if (digits.length === 11) return 'CPF';
  return 'Aleatoria';
}

// Vários nomes separados por | , ou ; ; aceita nome exato, ID ou nome parecido (sem acento/maiúscula).
function resolveList(input, list) {
  const ids = [];
  const missing = [];
  String(input || '').split(/[|;,]/).map(v => v.trim()).filter(Boolean).forEach(value => {
    const key = loose(value);
    const match = list.find(item => String(item.id) === value) ||
      list.find(item => loose(item.name) === key) ||
      list.find(item => loose(item.name).includes(key) || key.includes(loose(item.name)));
    if (match && !ids.includes(String(match.id))) ids.push(String(match.id));
    else if (!match) missing.push(value);
  });
  return { ids, missing };
}

const STATUS = { ativo: 'ativo', ativa: 'ativo', sim: 'ativo', inativo: 'inativo', inativa: 'inativo', desligado: 'inativo', afastado: 'inativo', pendente: 'pendente', em_analise: 'em_analise', analise: 'em_analise', recusado: 'recusado' };
const REGIME = { plantao: 'plantao', por_plantao: 'plantao', plantonista: 'plantao', pj: 'plantao', cooperado: 'plantao', avulso: 'plantao', mensal: 'mensal', mensalista: 'mensal', fixo: 'mensal', fixo_mensal: 'mensal', salario: 'mensal', clt: 'mensal', produtividade: 'produtividade', producao: 'produtividade', produtividade_comissao: 'produtividade' };

const simpleName = value => loose(value).replace(/\s+/g, ' ');

/**
 * Prepara uma linha para gravar.
 * @param {object} rawRow cabeçalho original → valor
 * @param {object} ctx { lineNumber, seenKeys:Set, categories, roles, units, sectors, selectedUnitId, companyId, existing:[profissionais], existingSpecialties:[nomes] }
 * @returns {{ lineNumber, name, errors, warnings, existingMatch, payload }}
 */
export function prepareProfessionalRow(rawRow, ctx) {
  const { lineNumber, seenKeys, categories = [], roles = [], units = [], sectors = [], selectedUnitId = '', companyId = 'cmp_principal', existing = [], existingSpecialties = [] } = ctx;
  const { row } = mapRow(rawRow);
  const errors = [];
  const warnings = [];
  const get = field => String(row[field] ?? '').trim();

  const name = properCase(get('nome_completo'));
  if (!name) errors.push('linha sem nome');
  if (rawRow._formula_without_value) warnings.push('fórmula sem resultado: confira os valores');

  const category = resolveCategory(get('categoria'), categories);
  if (category.unknown && get('categoria')) warnings.push(`categoria "${get('categoria')}" não reconhecida: entrou como Médico(a)`);

  const statusKey = normalizeKey(get('status') || 'ativo');
  const status = STATUS[statusKey] || 'ativo';
  if (!STATUS[statusKey]) warnings.push(`status "${get('status')}" não reconhecido: entrou como ativo`);

  const roleText = loose(get('perfil_acesso') || 'assistencial');
  const role = roles.find(r => loose(r.id) === roleText || loose(r.label) === roleText) ||
    (/gestor|admin/.test(roleText) ? roles.find(r => r.id === 'gestor') : /coord/.test(roleText) ? roles.find(r => r.id === 'coordenador') : /fatur|financ/.test(roleText) ? roles.find(r => r.id === 'faturamento') : null);
  if (!role && get('perfil_acesso')) warnings.push(`perfil "${get('perfil_acesso')}" não reconhecido: entrou como Profissional Assistencial`);

  const regimeKey = normalizeKey(get('regime_remuneracao') || 'plantao');
  const regime = REGIME[regimeKey] || 'plantao';
  if (!REGIME[regimeKey]) warnings.push(`regime "${get('regime_remuneracao')}" não reconhecido: entrou como por plantão`);

  // Unidades e setores: sem coluna, a unidade escolhida no topo e todos os setores.
  const fallbackUnits = [String(selectedUnitId || units[0]?.id || '')].filter(Boolean);
  let allowedUnitIds = fallbackUnits;
  if (get('unidades_permitidas')) {
    const r = resolveList(get('unidades_permitidas'), units);
    if (r.missing.length) warnings.push(`hospital não encontrado: ${r.missing.join(', ')}`);
    allowedUnitIds = r.ids.length ? r.ids : fallbackUnits;
  }
  if (!allowedUnitIds.length) errors.push('nenhum hospital cadastrado para vincular');
  let authorizedSectors = sectors.map(s => String(s.id));
  let sectorsChosen = false;
  if (get('setores_autorizados')) {
    const r = resolveList(get('setores_autorizados'), sectors);
    if (r.missing.length) warnings.push(`setor não encontrado: ${r.missing.join(', ')}`);
    if (r.ids.length) { authorizedSectors = r.ids; sectorsChosen = true; }
  }
  const mainSectorMatch = get('setor_principal') ? resolveList(get('setor_principal'), sectors) : { ids: [] };
  const mainSector = mainSectorMatch.ids.length ? sectors.find(s => String(s.id) === mainSectorMatch.ids[0])?.name : get('setor_principal');

  const birthDate = parseFlexibleDate(get('data_nascimento'));
  if (birthDate === null) warnings.push(`data de nascimento "${get('data_nascimento')}" não entendida: ficou em branco`);
  const expiry = parseFlexibleDate(get('validade_credencial'));
  if (expiry === null) warnings.push(`validade "${get('validade_credencial')}" não entendida: ficou em branco`);

  let email = get('email').toLowerCase().replace(/\s+/g, '');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { warnings.push(`e-mail "${get('email')}" inválido: ficou em branco`); email = ''; }

  const money = (field, label) => {
    const raw = get(field);
    if (!raw) return null;
    const n = safeNumber(raw.replace(/[^\d,.-]/g, ''), NaN);
    if (!Number.isFinite(n) || n < 0) { warnings.push(`${label} "${raw}" não é um número: ficou em branco`); return null; }
    return n;
  };
  const monthly = money('salario_mensal', 'salário mensal');
  const retention = money('retencao_percentual', 'retenção') ?? 0;
  const anyRate = money('valor_plantao', 'valor do plantão');
  const day = money('valor_diurno', 'valor diurno') ?? anyRate;
  const night = money('valor_noturno', 'valor noturno') ?? anyRate;
  const weekend = money('valor_fds', 'valor de fim de semana') ?? anyRate;

  const unitRates = {};
  const unitMonthlySalaries = {};
  allowedUnitIds.forEach(unitId => {
    const rates = {};
    if (day !== null) rates.diurno = day;
    if (night !== null) rates.noturno = night;
    if (weekend !== null) rates.fds = weekend;
    if (Object.keys(rates).length) unitRates[unitId] = rates;
    if (monthly !== null) unitMonthlySalaries[unitId] = monthly;
  });
  if (get('valores_por_unidade_json')) {
    try {
      const parsed = JSON.parse(get('valores_por_unidade_json'));
      Object.entries(parsed || {}).forEach(([unitId, values]) => {
        if (!allowedUnitIds.includes(String(unitId)) || !values || typeof values !== 'object') return;
        ['diurno', 'noturno', 'fds'].forEach(f => { if (Number.isFinite(Number(values[f])) && values[f] !== '') unitRates[unitId] = { ...(unitRates[unitId] || {}), [f]: Number(values[f]) }; });
        if (Number.isFinite(Number(values.mensal)) && values.mensal !== '') unitMonthlySalaries[unitId] = Number(values.mensal);
      });
    } catch {
      warnings.push('valores_por_unidade_json inválido: valores por hospital ignorados');
    }
  }
  if (regime === 'mensal' && !Object.keys(unitMonthlySalaries).length) warnings.push('mensalista sem salário: informe depois no cadastro');
  if (regime === 'plantao' && !Object.keys(unitRates).length) warnings.push('sem valor de plantão: informe depois no cadastro');

  const pixKey = get('chave_pix');
  const specialty = resolveSpecialty(get('especialidade') || mainSector || '', existingSpecialties);
  const cpf = get('cpf');
  const cpfDigits = cpf.replace(/\D/g, '');
  const pixType = inferPixType(pixKey, get('tipo_pix'), { cpf, phone: get('telefone') });
  const receiptType = /pj|juridica|cnpj/.test(normalizeKey(get('tipo_recibo'))) || get('cnpj') ? 'pj' : 'pf';

  // Repetido na planilha e já cadastrado.
  const nameKey = simpleName(name);
  const phoneDigits = get('telefone').replace(/\D/g, '');
  const keys = [cpfDigits && `cpf:${cpfDigits}`, email && `email:${email}`, get('matricula') && `mat:${normalizeKey(get('matricula'))}`].filter(Boolean);
  if (!keys.length && nameKey) keys.push(`nome:${nameKey}${phoneDigits ? `:${phoneDigits}` : ''}`);
  if (keys.some(k => seenKeys?.has(k))) errors.push('repetido nesta planilha');
  keys.forEach(k => seenKeys?.add(k));
  const existingMatch = existing.find(p => {
    const meta = p?.data || {};
    const pCpf = String(p.cpf || meta.cpf || '').replace(/\D/g, '');
    const pEmail = String(p.email || '').toLowerCase();
    const pMat = normalizeKey(meta.registration_id || p.registration_id || '');
    return (cpfDigits && pCpf === cpfDigits) || (email && pEmail === email) ||
      (get('matricula') && pMat === normalizeKey(get('matricula'))) ||
      (!cpfDigits && !email && nameKey && simpleName(p.name) === nameKey);
  }) || null;

  const username = (email ? email.split('@')[0] : name || `profissional${lineNumber}`)
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
  const finalEmail = email || `${username || 'profissional'}.${Date.now()}${lineNumber}@scalemedic.local`;
  const registrationId = get('matricula') || `MAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const primaryMonthly = unitMonthlySalaries[allowedUnitIds[0]] ?? monthly ?? 0;

  const data = {
    username,
    category: category.id,
    app_role: role?.id || 'assistencial',
    main_sector: mainSector || '',
    specialty,
    rqe: get('rqe'),
    cbo: get('cbo'),
    registration_id: registrationId,
    coop_tax_rate: retention,
    remuneration_type: regime,
    monthly_salary: primaryMonthly,
    unit_monthly_salaries: unitMonthlySalaries,
    unit_rates: unitRates,
    pix_type: pixType,
    bank_info: get('dados_bancarios'),
    pix_key: pixKey,
    receipt_type: receiptType,
    cnpj: receiptType === 'pj' ? get('cnpj') : '',
    legal_name: receiptType === 'pj' ? get('razao_social') : '',
    document_expiry: expiry || '',
    status,
    authorized_sectors: authorizedSectors,
    allowed_unit_ids: allowedUnitIds,
    blocked_sectors: sectorsChosen ? blockedSectorsFrom(authorizedSectors, sectors, allowedUnitIds) : [],
    birth_date: birthDate || '',
    cpf
  };
  const payload = {
    company_id: companyId,
    unit_id: allowedUnitIds[0] || '',
    unit_ids: allowedUnitIds,
    name,
    document: get('conselho'),
    specialty,
    rqe: get('rqe'),
    cbo: get('cbo'),
    cpf,
    email: finalEmail,
    phone: get('telefone'),
    status,
    remuneration_type: regime,
    monthly_salary: primaryMonthly,
    document_expiry: expiry || '',
    birth_date: birthDate || '',
    data
  };
  return { lineNumber, name: name || `Linha ${lineNumber}`, errors, warnings, existingMatch, payload };
}

// CSV com ; ou , (o que aparecer mais na primeira linha) e aspas.
export function parseCsv(text) {
  const clean = String(text || '').replace(new RegExp('^' + String.fromCharCode(0xfeff)), '');
  const firstLine = clean.split(/\r?\n/)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim()));
}
