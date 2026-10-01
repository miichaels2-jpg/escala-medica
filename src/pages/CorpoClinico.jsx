import { useState, useMemo, useRef } from 'react';
import { useAppData } from '@/lib/useAppData';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Users, UserPlus, Search, CheckCircle2, DollarSign, Edit3, KeyRound, Send, RefreshCw,
  MessageSquare, Shield, UserCog, Eye, EyeOff, HeartPulse, Plus, Landmark, Building2,
  Power, Trash2, Settings, Save, Lock, Hospital, List, LayoutGrid, FileSpreadsheet,
  Download, Upload
} from 'lucide-react';

function safeNumber(val, fb = 0) {
  if (val === null || val === undefined || val === '') return fb;
  if (typeof val === 'number') return Number.isFinite(val) ? val : fb;
  let normalized = String(val).replace(/[R$\s]/g, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else {
    normalized = normalized.replace(',', '.');
  }
  if (!normalized) return fb;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fb;
}

const DEFAULT_CATEGORIES = [
  { id: 'medico', label: 'Médico(a)', council: 'CRM', isDefault: true },
  { id: 'enfermeiro', label: 'Enfermeiro(a)', council: 'COREN', isDefault: true },
  { id: 'fisioterapeuta', label: 'Fisioterapeuta', council: 'CREFITO', isDefault: true },
  { id: 'tecnico_enfermagem', label: 'Téc. Enfermagem', council: 'COREN', isDefault: true },
  { id: 'farmaceutico', label: 'Farmacêutico(a)', council: 'CRF', isDefault: true },
  { id: 'nutricionista', label: 'Nutricionista', council: 'CRN', isDefault: true },
  { id: 'psicologo', label: 'Psicólogo(a)', council: 'CRP', isDefault: true },
  { id: 'biomedico', label: 'Biomédico(a)', council: 'CRBM', isDefault: true }
];

const ACCESS_ROLES = [
  { id: 'assistencial', label: 'Profissional Assistencial', desc: 'Acesso à Minha Escala, Mural, Trocas e Repasses' },
  { id: 'coordenador', label: 'Coordenador de Escala', desc: 'Montagem de escalas, setores e homologação' },
  { id: 'faturamento', label: 'Faturamento / Financeiro', desc: 'Fechamento de honorários, conciliação e repasses' },
  { id: 'gestor', label: 'Gestor Geral / Administrador', desc: 'Acesso pleno a todos os módulos e configurações' },
];

const PROFESSIONAL_IMPORT_COLUMNS = [
  'nome_completo', 'categoria', 'conselho', 'matricula', 'setor_principal',
  'especialidade', 'rqe', 'cbo', 'cpf', 'email', 'telefone',
  'data_nascimento', 'status', 'perfil_acesso', 'regime_remuneracao',
  'salario_mensal', 'retencao_percentual', 'tipo_pix', 'chave_pix',
  'dados_bancarios', 'validade_credencial', 'unidades_permitidas',
  'setores_autorizados', 'valores_por_unidade_json'
];

function normalizeImportHeader(value) {
  return String(value || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function normalizeWhatsAppPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return '';
}

function parseImportDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let normalized = '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) normalized = raw;
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) normalized = `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  if (!normalized) return null;
  const [year, month, day] = normalized.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? normalized
    : null;
}

async function autoHealingSave(id, initialPayload) {
  let payload = { ...initialPayload };
  try {
    if (id) {
      const { data, error } = await supabase.from('professionals').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase.from('professionals').insert([payload]).select().single();
      if (error) throw error;
      return data;
    }
  } catch (err) {
    throw err;
  }
}

export default function CorpoClinico() {
  const {
    professionals,
    sectors,
    allCompanySectors,
    units,
    selectedUnitId,
    company,
    isManager,
    syncGlobalData
  } = useAppData();

  const [activeTab, setActiveTab] = useState('ativos'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todas');
  const [viewMode, setViewMode] = useState('list');
  const importInputRef = useRef(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [manageCatModalOpen, setManageCatModalOpen] = useState(false);
  const [editingProf, setEditingProf] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [customCategories, setCustomCategories] = useState(() => {
    try { 
      const stored = window.localStorage.getItem('scale_custom_cats');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });

  const allCategories = useMemo(() => [...DEFAULT_CATEGORIES, ...customCategories], [customCategories]);

  const [editingCatId, setEditingCatId] = useState(null);
  const [newCatData, setNewCatData] = useState({ label: '', council: 'Registro' });

  const saveCustomCategories = (cats) => {
    setCustomCategories(cats);
    try { window.localStorage.setItem('scale_custom_cats', JSON.stringify(cats)); } catch {}
  };

  const [formData, setFormData] = useState({
    name: '', username: '', category: 'medico', document: '',
    registration_id: '', main_sector: '', specialty: '', rqe: '', cbo: '',
    cpf: '', email: '', phone: '', unit_id: '', birth_date: '',
    status: 'ativo', app_role: 'assistencial', 
    remuneration_type: 'plantao', // NOVO: plantao, mensal ou produtividade
    monthly_salary: '',
    unit_monthly_salaries: {},
    unit_rates: {}, // NOVO: Matriz de valores por unidade
    coop_tax_rate: 0, pix_type: 'CPF',
    pix_key: '', bank_info: '', password: '',
    document_expiry: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
    authorized_sectors: [],
    allowed_unit_ids: [] 
  });

  function getProfMeta(prof) {
    if (!prof) return {};
    let localMeta = {};
    try {
      const stored = window.localStorage.getItem(`prof_meta_${prof.id}`);
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) localMeta = parsed;
    } catch (error) {
      console.warn(`Não foi possível carregar os dados locais do profissional ${prof.id}:`, error);
    }
    const serverMeta = [prof.data, prof.metadata]
      .filter(source => source && typeof source === 'object' && !Array.isArray(source));
    return Object.assign({}, localMeta, ...serverMeta);
  }

  const resetForm = () => {
    const generatedMatricula = `MAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setFormData({
      name: '', username: '', category: allCategories[0]?.id || 'medico', document: '',
      registration_id: generatedMatricula,       main_sector: allCompanySectors[0]?.name || 'UTI Geral',
      specialty: '', rqe: '', cbo: '', cpf: '', email: '', phone: '', birth_date: '',
      unit_id: selectedUnitId || (units[0]?.id || 'unit_h1'),
      status: 'ativo', app_role: 'assistencial', 
      remuneration_type: 'plantao', monthly_salary: '', unit_monthly_salaries: {}, unit_rates: {},
      coop_tax_rate: 0, pix_type: 'CPF',
      pix_key: '', bank_info: '', password: '',
      document_expiry: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      authorized_sectors: (allCompanySectors || []).map(s => String(s.id)),
      allowed_unit_ids: [String(selectedUnitId || units[0]?.id || 'unit_h1')] 
    });
    setEditingProf(null);
    setShowPassword(false);
  };

  const handleOpenNew = () => { resetForm(); setModalOpen(true); };

  const handleOpenEdit = (prof) => {
    setEditingProf(prof);
    const meta = getProfMeta(prof);
    const generatedMatricula = meta.registration_id || prof.registration_id || `MAT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const expiry = prof.document_expiry || meta.document_expiry || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];
    const authSectors = Array.isArray(meta.authorized_sectors)
      ? meta.authorized_sectors.map(String)
      : (allCompanySectors || []).map(s => String(s.id));
    const profStatus = prof.status || meta.status || 'ativo';

    const savedUnits = meta.allowed_unit_ids || prof.unit_ids || (prof.unit_id ? [String(prof.unit_id)] : [String(units[0]?.id || '')]);
    const primaryUnitId = String(
      savedUnits.some(unitId => String(unitId) === String(prof.unit_id))
        ? prof.unit_id
        : savedUnits[0] || ''
    );
    const legacyMonthlySalary = meta.monthly_salary !== undefined ? meta.monthly_salary : prof.monthly_salary;
    const savedMonthlySalaries = meta.unit_monthly_salaries || (
      primaryUnitId && legacyMonthlySalary !== undefined
        ? { [primaryUnitId]: safeNumber(legacyMonthlySalary, 0) }
        : {}
    );

    setFormData({
      name: prof.name || prof.full_name || '',
      username: meta.username || prof.username || '',
      category: meta.category || prof.category || 'medico',
      document: prof.document || prof.registration_number || '',
      registration_id: generatedMatricula,
      main_sector: meta.main_sector || prof.specialty || sectors[0]?.name || 'UTI Geral',
      specialty: prof.specialty || meta.specialty || '',
      rqe: prof.rqe || meta.rqe || '',
      cbo: meta.cbo || prof.cbo || '',
      cpf: prof.cpf || meta.cpf || '',
      email: prof.email || '',
      phone: prof.phone || '',
      birth_date: meta.birth_date || prof.birth_date || '',
      unit_id: primaryUnitId || selectedUnitId,
      status: profStatus,
      app_role: meta.app_role || prof.app_role || 'assistencial',
      remuneration_type: meta.remuneration_type || 'plantao',
      monthly_salary: String(safeNumber(legacyMonthlySalary, 0)),
      unit_monthly_salaries: savedMonthlySalaries,
      unit_rates: meta.unit_rates || {},
      coop_tax_rate: safeNumber(meta.coop_tax_rate ?? prof.coop_tax_rate, 0),
      pix_type: meta.pix_type || 'CPF',
      pix_key: meta.pix_key || '',
      bank_info: meta.bank_info || '',
      password: '',
      document_expiry: expiry,
      authorized_sectors: authSectors,
      allowed_unit_ids: savedUnits 
    });
    setModalOpen(true);
  };

  const handleUnitRateChange = (uid, field, val) => {
    setFormData(prev => ({
      ...prev,
      unit_rates: {
        ...prev.unit_rates,
        [uid]: { ...(prev.unit_rates[uid] || {}), [field]: val }
      }
    }));
  };

  const handleUnitMonthlySalaryChange = (uid, val) => {
    setFormData(prev => ({
      ...prev,
      unit_monthly_salaries: {
        ...prev.unit_monthly_salaries,
        [uid]: val
      },
      monthly_salary: String(uid) === String(
        prev.allowed_unit_ids.some(unitId => String(unitId) === String(prev.unit_id))
          ? prev.unit_id
          : prev.allowed_unit_ids[0]
      )
        ? val
        : prev.monthly_salary
    }));
  };

  const handleAllowedUnitToggle = (unitId, checked) => {
    setFormData(prev => {
      const nextAllowedUnits = checked
        ? [...new Set([...prev.allowed_unit_ids.map(String), String(unitId)])]
        : prev.allowed_unit_ids.filter(id => String(id) !== String(unitId)).map(String);
      const keepsPrimary = nextAllowedUnits.some(id => String(id) === String(prev.unit_id));
      const nextPrimary = keepsPrimary ? String(prev.unit_id) : nextAllowedUnits[0] || '';
      const nextLegacySalary = Object.prototype.hasOwnProperty.call(prev.unit_monthly_salaries, nextPrimary)
        ? prev.unit_monthly_salaries[nextPrimary]
        : '';
      return {
        ...prev,
        allowed_unit_ids: nextAllowedUnits,
        unit_id: nextPrimary,
        monthly_salary: nextPrimary === String(prev.unit_id) ? prev.monthly_salary : nextLegacySalary
      };
    });
  };

  const handleToggleStatusQuick = async (prof) => {
    const meta = getProfMeta(prof);
    const currentStatus = prof.status || meta.status || 'ativo';
    const nextStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo';

    try {
      const payload = { status: nextStatus };
      await autoHealingSave(prof.id, payload);
      
      const updatedMeta = { ...meta, status: nextStatus };
      try { window.localStorage.setItem(`prof_meta_${prof.id}`, JSON.stringify(updatedMeta)); } catch {}

      await syncGlobalData();
    } catch (err) {
      alert('Erro ao alterar status: ' + err.message);
    }
  };

  const handleToggleSectorAuth = (secId) => {
    setFormData(prev => {
      const normalizedSectorId = String(secId);
      const current = (prev.authorized_sectors || []).map(String);
      if (current.includes(normalizedSectorId)) {
        return { ...prev, authorized_sectors: current.filter(id => id !== normalizedSectorId) };
      } else {
        return { ...prev, authorized_sectors: [...current, normalizedSectorId] };
      }
    });
  };

  const handleSaveCategory = (e) => {
    e.preventDefault();
    if (!newCatData.label.trim()) return;

    if (editingCatId) {
      const updated = customCategories.map(c => c.id === editingCatId ? { ...c, label: newCatData.label.trim(), council: newCatData.council || 'Registro' } : c);
      saveCustomCategories(updated);
      setEditingCatId(null);
    } else {
      const newId = newCatData.label.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
      const newCatObj = { id: newId, label: newCatData.label.trim(), council: newCatData.council || 'Registro', isDefault: false };
      saveCustomCategories([...customCategories, newCatObj]);
    }
    setNewCatData({ label: '', council: 'Registro' });
  };

  const handleEditCatClick = (cat) => {
    if(cat.isDefault) return;
    setEditingCatId(cat.id);
    setNewCatData({ label: cat.label, council: cat.council });
  };

  const handleDeleteCatClick = (id) => {
    if(!confirm("Tem certeza que deseja excluir esta categoria?")) return;
    const updated = customCategories.filter(c => c.id !== id);
    saveCustomCategories(updated);
    if (formData.category === id) {
      setFormData(prev => ({ ...prev, category: allCategories[0]?.id || 'medico' }));
    }
  };

  const handleGenerateDefaultPassword = () => {
    if (!formData.birth_date || !formData.name) {
      alert('⚠️ Preencha o Nome e a Data de Nascimento para gerar a senha padrão!');
      return;
    }
    const [y, m, d] = formData.birth_date.split('-');
    const firstLetter = formData.name.charAt(0).toLowerCase();
    const defaultPass = `${d}${m}${y}${firstLetter}`;
    setFormData(p => ({ ...p, password: defaultPass }));
  };

  const handleSendWhatsApp = () => {
    const phoneWithDDI = normalizeWhatsAppPhone(formData.phone);
    if (!phoneWithDDI) {
      alert('Informe um telefone brasileiro válido com DDD para abrir o WhatsApp.');
      return;
    }
    const siteUrl = window.location.origin;
    const message = `*ScaleMedic - Gestão Hospitalar* 🏥\n\nOlá, *${formData.name || 'profissional'}*!\nSeu cadastro profissional está sendo atualizado.\n\nAcesse o sistema pelo link: ${siteUrl}/login\n\nPor segurança, suas credenciais não são enviadas por esta mensagem. Caso precise de acesso, fale com a coordenação.`;
    window.open(`https://wa.me/${phoneWithDDI}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const handleOpenProfessionalWhatsApp = (prof) => {
    const phone = normalizeWhatsAppPhone(prof.phone);
    if (!phone) {
      alert('Telefone inválido. Cadastre um número brasileiro com DDD no perfil do profissional.');
      return;
    }
    const message = `Olá, ${prof.name || 'profissional'}! Estou entrando em contato pela equipe do ScaleMedic.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadImportTemplate = async () => {
    try {
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const template = workbook.addWorksheet('Profissionais');
      template.addRow(PROFESSIONAL_IMPORT_COLUMNS);
      template.views = [{ state: 'frozen', ySplit: 1 }];
      template.autoFilter = 'A1:X1';
      template.columns = PROFESSIONAL_IMPORT_COLUMNS.map(column => ({ header: column, key: column, width: Math.max(18, column.length + 3) }));

      const instructions = [
        ['Campo', 'Como preencher'],
        ['nome_completo', 'Obrigatório. Nome completo do profissional.'],
        ['categoria', `Obrigatório. ID ou nome de uma categoria: ${allCategories.map(category => `${category.id} (${category.label})`).join('; ')}`],
        ['unidades_permitidas', `IDs ou nomes exatos das unidades, separados por |. Unidades disponíveis: ${(units || []).map(unit => `${unit.id} (${unit.name})`).join('; ')}`],
        ['setores_autorizados', `IDs ou nomes exatos dos setores, separados por |. Deixe vazio para autorizar todos: ${(sectors || []).map(sector => `${sector.id} (${sector.name})`).join('; ')}`],
        ['status', 'ativo, inativo, pendente, em_analise ou recusado. Padrão: ativo.'],
        ['perfil_acesso', `ID ou nome do perfil: ${ACCESS_ROLES.map(role => `${role.id} (${role.label})`).join('; ')}. Padrão: assistencial.`],
        ['regime_remuneracao', 'plantao, mensal ou produtividade. Padrão: plantao.'],
        ['salario_mensal / retencao_percentual', 'Use números, sem símbolo de moeda. salario_mensal é compatível com a unidade principal; para regime mensal em várias unidades, informe mensal em valores_por_unidade_json. Exemplo: 12500,50.'],
        ['tipo_pix', 'CPF, CNPJ, Email, Telefone ou Aleatoria.'],
        ['data_nascimento / validade_credencial', 'Formato recomendado: AAAA-MM-DD; também aceita DD/MM/AAAA.'],
        ['valores_por_unidade_json', 'Opcional. JSON por ID de unidade. Para plantão: diurno/noturno/fds. Para mensal: mensal. Exemplo: {"ID_UNIDADE":{"diurno":1200,"noturno":1400,"fds":1800,"mensal":5000}}.'],
        ['Importante', 'Não inclua senhas. A importação cadastra os perfis, mas não cria contas de acesso. Revise a prévia antes de importar.']
      ];
      const guide = workbook.addWorksheet('Orientações');
      guide.addRows(instructions);
      guide.columns = [{ width: 34 }, { width: 110 }];
      guide.getRow(1).font = { bold: true };
      const buffer = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'modelo_importacao_corpo_clinico.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Não foi possível gerar o modelo Excel:', error);
      alert(`Não foi possível gerar o modelo Excel: ${error.message}`);
    }
  };

  const prepareImportPayload = (rawRow, lineNumber, seenKeys) => {
    const row = {};
    Object.entries(rawRow).forEach(([key, value]) => { row[normalizeImportHeader(key)] = String(value ?? '').trim(); });
    const errors = [];
    if (rawRow._formula_error || row.formula_error) errors.push('fórmulas não são aceitas; substitua pelo valor final');
    const name = row.nome_completo || row.nome || '';
    if (!name) errors.push('nome_completo é obrigatório');

    const categoryInput = row.categoria || 'medico';
    const category = allCategories.find(item =>
      item.id.toLowerCase() === categoryInput.toLowerCase() ||
      item.label.toLowerCase() === categoryInput.toLowerCase()
    );
    if (!category) errors.push(`categoria desconhecida: ${categoryInput}`);

    const statusAliases = { ativo: 'ativo', inativo: 'inativo', pendente: 'pendente', em_analise: 'em_analise', recusado: 'recusado' };
    const statusInput = normalizeImportHeader(row.status || 'ativo');
    if (!statusAliases[statusInput]) errors.push(`status inválido: ${row.status}`);
    const roleInput = row.perfil_acesso || 'assistencial';
    const role = ACCESS_ROLES.find(item =>
      item.id.toLowerCase() === roleInput.toLowerCase() ||
      item.label.toLowerCase() === roleInput.toLowerCase()
    );
    if (!role) errors.push(`perfil_acesso desconhecido: ${roleInput}`);

    const remunerationAliases = {
      plantao: 'plantao', 'por_plantao': 'plantao', mensal: 'mensal',
      produtividade: 'produtividade', 'produtividade_comissao': 'produtividade'
    };
    const remunerationInput = normalizeImportHeader(row.regime_remuneracao || 'plantao');
    if (!remunerationAliases[remunerationInput]) errors.push(`regime_remuneracao inválido: ${row.regime_remuneracao}`);

    const resolveByNameOrId = (input, list, label) => {
      if (!input) return [];
      const requested = input.split('|').map(value => value.trim()).filter(Boolean);
      const ids = [];
      requested.forEach(value => {
        const matches = list.filter(item =>
          String(item.id) === value || String(item.name || '').toLowerCase() === value.toLowerCase()
        );
        if (matches.length !== 1) errors.push(`${label} não encontrado ou ambíguo: ${value}`);
        else if (!ids.includes(String(matches[0].id))) ids.push(String(matches[0].id));
      });
      return ids;
    };

    const fallbackUnits = [String(selectedUnitId || units?.[0]?.id || '')].filter(Boolean);
    const allowedUnitIds = row.unidades_permitidas
      ? resolveByNameOrId(row.unidades_permitidas, units || [], 'unidades_permitidas')
      : fallbackUnits;
    if (allowedUnitIds.length === 0) errors.push('selecione ao menos uma unidade válida');
    const authorizedSectors = row.setores_autorizados
      ? resolveByNameOrId(row.setores_autorizados, sectors || [], 'setores_autorizados')
      : (sectors || []).map(sector => String(sector.id));
    const pixTypes = ['CPF', 'CNPJ', 'Email', 'Telefone', 'Aleatoria'];
    const pixType = pixTypes.find(value => normalizeImportHeader(value) === normalizeImportHeader(row.tipo_pix || 'CPF'));
    if (!pixType) errors.push(`tipo_pix inválido: ${row.tipo_pix}`);

    const birthDate = parseImportDate(row.data_nascimento);
    const expiryDate = parseImportDate(row.validade_credencial);
    if (row.data_nascimento && birthDate === null) errors.push('data_nascimento deve ser AAAA-MM-DD ou DD/MM/AAAA');
    if (row.validade_credencial && expiryDate === null) errors.push('validade_credencial deve ser AAAA-MM-DD ou DD/MM/AAAA');
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push('email inválido');

    const parseNonNegative = (value, label) => {
      if (!value) return 0;
      const parsed = safeNumber(value, NaN);
      if (!Number.isFinite(parsed) || parsed < 0) {
        errors.push(`${label} deve ser um número igual ou maior que zero`);
        return 0;
      }
      return parsed;
    };
    const monthlySalary = parseNonNegative(row.salario_mensal, 'salario_mensal');
    const coopTaxRate = parseNonNegative(row.retencao_percentual, 'retencao_percentual');

    let unitRates = {};
    let unitMonthlySalaries = {};
    if (row.salario_mensal !== '' && allowedUnitIds[0]) {
      unitMonthlySalaries[allowedUnitIds[0]] = monthlySalary;
    }
    if (row.valores_por_unidade_json) {
      try {
        const parsed = JSON.parse(row.valores_por_unidade_json);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON precisa ser um objeto');
        Object.entries(parsed).forEach(([unitId, values]) => {
          if (!(units || []).some(unit => String(unit.id) === String(unitId))) {
            errors.push(`valores_por_unidade_json usa ID de unidade desconhecido: ${unitId}`);
            return;
          }
          if (!allowedUnitIds.includes(String(unitId))) {
            errors.push(`valores_por_unidade_json inclui unidade não autorizada: ${unitId}`);
            return;
          }
          if (!values || typeof values !== 'object' || Array.isArray(values)) {
            errors.push(`tabela de valores inválida para a unidade ${unitId}`);
            return;
          }
          unitRates[unitId] = {};
          ['diurno', 'noturno', 'fds'].forEach(field => {
            const value = values[field];
            if (value === '' || value === null || value === undefined) return;
            const amount = Number(value);
            if (!Number.isFinite(amount) || amount < 0) errors.push(`${field} inválido na unidade ${unitId}`);
            else unitRates[unitId][field] = amount;
          });
          if (values.mensal !== '' && values.mensal !== null && values.mensal !== undefined) {
            const amount = Number(values.mensal);
            if (!Number.isFinite(amount) || amount < 0) errors.push(`mensal inválido na unidade ${unitId}`);
            else unitMonthlySalaries[unitId] = amount;
          }
        });
      } catch (error) {
        errors.push(`valores_por_unidade_json inválido: ${error.message}`);
      }
    }
    if (remunerationAliases[remunerationInput] === 'mensal') {
      allowedUnitIds.forEach(unitId => {
        if (!Object.prototype.hasOwnProperty.call(unitMonthlySalaries, unitId)) {
          errors.push(`informe o valor mensal da unidade ${unitId} em salario_mensal ou valores_por_unidade_json`);
        }
      });
    }
    const primaryMonthlySalary = unitMonthlySalaries[allowedUnitIds[0]] !== undefined
      ? safeNumber(unitMonthlySalaries[allowedUnitIds[0]], monthlySalary)
      : monthlySalary;

    const cpf = row.cpf || '';
    const email = row.email.toLowerCase();
    const cleanUsername = (email ? email.split('@')[0] : name || `profissional${lineNumber}`)
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
    const finalEmail = email || `${cleanUsername || 'profissional'}.${Date.now()}${lineNumber}@scalemedic.local`;
    const registrationId = row.matricula || `MAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const keys = [
      cpf.replace(/\D/g, '') ? `cpf:${cpf.replace(/\D/g, '')}` : '',
      email ? `email:${email}` : '',
      row.matricula ? `matricula:${row.matricula.toLowerCase()}` : ''
    ].filter(Boolean);
    const normalizedName = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
    const normalizedPhone = String(row.telefone || '').replace(/\D/g, '');
    if (keys.length === 0 && normalizedName && normalizedPhone) {
      keys.push(`nome_telefone:${normalizedName}:${normalizedPhone}`);
    }
    if (keys.some(key => seenKeys.has(key))) errors.push('profissional duplicado nesta planilha');
    keys.forEach(key => seenKeys.add(key));
    const existing = (professionals || []).find(prof => {
      const meta = getProfMeta(prof);
      const existingCpf = String(prof.cpf || meta.cpf || '').replace(/\D/g, '');
      const existingEmail = String(prof.email || '').toLowerCase();
      const existingRegistration = String(meta.registration_id || prof.registration_id || '').toLowerCase();
      const existingName = String(prof.name || prof.full_name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
      const existingPhone = String(prof.phone || '').replace(/\D/g, '');
      return (cpf.replace(/\D/g, '') && existingCpf === cpf.replace(/\D/g, '')) ||
        (email && existingEmail === email) ||
        (row.matricula && existingRegistration === row.matricula.toLowerCase()) ||
        (normalizedName && normalizedPhone && existingName === normalizedName && existingPhone === normalizedPhone);
    });
    if (existing) errors.push(`já existe cadastro compatível: ${existing.name || existing.email}; revise ou edite manualmente`);

    const mainSector = row.setor_principal || sectors?.[0]?.name || '';
    const specialty = row.especialidade || mainSector;
    const richMeta = {
      username: cleanUsername,
      category: category?.id || 'medico',
      app_role: role?.id || 'assistencial',
      main_sector: mainSector,
      specialty,
      rqe: row.rqe || '',
      cbo: row.cbo || '',
      registration_id: registrationId,
      coop_tax_rate: coopTaxRate,
      remuneration_type: remunerationAliases[remunerationInput] || 'plantao',
      monthly_salary: primaryMonthlySalary,
      unit_monthly_salaries: unitMonthlySalaries,
      unit_rates: unitRates,
      pix_type: pixType || 'CPF',
      bank_info: row.dados_bancarios || '',
      pix_key: row.chave_pix || '',
      document_expiry: expiryDate || '',
      status: statusAliases[statusInput] || 'ativo',
      authorized_sectors: authorizedSectors,
      allowed_unit_ids: allowedUnitIds,
      birth_date: birthDate || '',
      cpf
    };
    const payload = {
      company_id: company?.id || 'cmp_principal',
      unit_id: allowedUnitIds[0] || '',
      unit_ids: allowedUnitIds,
      name: name.trim(),
      document: row.conselho || '',
      specialty,
      rqe: row.rqe || '',
      cbo: row.cbo || '',
      cpf,
      email: finalEmail,
      phone: row.telefone || '',
      status: statusAliases[statusInput] || 'ativo',
      remuneration_type: remunerationAliases[remunerationInput] || 'plantao',
      monthly_salary: primaryMonthlySalary,
      document_expiry: expiryDate || '',
      birth_date: birthDate || '',
      data: richMeta
    };
    return { lineNumber, name: name || `Linha ${lineNumber}`, errors, payload, richMeta };
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportError('');
    setImportRows([]);
    setImportFileName(file.name);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('O arquivo ultrapassa o limite de 10 MB.');
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        throw new Error('Envie um arquivo Excel no formato .xlsx. Baixe o modelo disponibilizado nesta tela.');
      }
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error('O arquivo não contém uma planilha para importar.');
      const headers = sheet.getRow(1).values.slice(1).map(value => String(value ?? '').trim());
      const sourceRows = [];
      sheet.eachRow((sheetRow, rowNumber) => {
        if (rowNumber === 1) return;
        const row = { _line_number: rowNumber };
        let hasValue = false;
        let hasFormula = false;
        headers.forEach((header, index) => {
          if (!header) return;
          const cell = sheetRow.getCell(index + 1);
          if (cell.value && typeof cell.value === 'object' &&
              ('formula' in cell.value || 'sharedFormula' in cell.value)) hasFormula = true;
          const value = cell.value instanceof Date
            ? `${cell.value.getUTCFullYear()}-${String(cell.value.getUTCMonth() + 1).padStart(2, '0')}-${String(cell.value.getUTCDate()).padStart(2, '0')}`
            : cell.text;
          row[header] = value;
          if (String(value || '').trim()) hasValue = true;
        });
        if (hasValue) {
          if (hasFormula) row._formula_error = 'true';
          sourceRows.push(row);
        }
      });
      if (sourceRows.length === 0) throw new Error('A planilha está vazia ou contém apenas o cabeçalho.');
      const seenKeys = new Set();
      const prepared = sourceRows.map((row, index) =>
        prepareImportPayload(row, Number(row._line_number) || index + 2, seenKeys)
      );
      setImportRows(prepared);
      setImportOpen(true);
    } catch (error) {
      setImportError(`Não foi possível ler o arquivo: ${error.message}`);
      setImportOpen(true);
    }
  };

  const handleImportProfessionals = async () => {
    if (!isManager) {
      alert('Somente gestores podem importar profissionais.');
      return;
    }
    const readyRows = importRows.filter(row => row.errors.length === 0 && !row.imported);
    if (readyRows.length === 0) return;
    setImporting(true);
    try {
      let updatedRows = [...importRows];
      for (const row of readyRows) {
        try {
          const saved = await autoHealingSave(null, row.payload);
          if (saved?.id) {
            try {
              window.localStorage.setItem(`prof_meta_${saved.id}`, JSON.stringify(row.richMeta));
            } catch (error) {
              console.warn('Não foi possível salvar os metadados locais do profissional importado:', error);
            }
          }
          updatedRows = updatedRows.map(item => item.lineNumber === row.lineNumber ? { ...item, imported: true, importError: '' } : item);
          setImportRows(updatedRows);
        } catch (error) {
          updatedRows = updatedRows.map(item => item.lineNumber === row.lineNumber ? { ...item, importError: error.message || 'Falha ao salvar' } : item);
          setImportRows(updatedRows);
        }
      }
      const importedBefore = importRows.filter(row => row.imported).length;
      const importedNow = updatedRows.filter(row => row.imported).length - importedBefore;
      const failedCount = readyRows.length - importedNow;
      let refreshError = '';
      if (importedNow > 0) {
        try {
          await syncGlobalData();
        } catch (error) {
          console.error('Os perfis foram salvos, mas a lista não pôde ser atualizada:', error);
          refreshError = ' A lista não atualizou; recarregue os dados para conferir os cadastros salvos.';
        }
      }
      alert(`${importedNow} profissional(is) importado(s).${failedCount > 0 ? ` ${failedCount} falha(s); confira os detalhes na prévia.` : ''}${refreshError}`);
    } finally {
      setImporting(false);
    }
  };

  const handleSaveProfessional = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (formData.allowed_unit_ids.length === 0) {
      alert('Selecione pelo menos um hospital/unidade para o profissional.');
      return;
    }
    if (formData.remuneration_type === 'mensal') {
      const missingMonthlyUnits = formData.allowed_unit_ids.filter(unitId => {
        const hasUnitValue = Object.prototype.hasOwnProperty.call(formData.unit_monthly_salaries, unitId);
        const isPrimaryUnit = String(unitId) === String(
          formData.allowed_unit_ids.some(id => String(id) === String(formData.unit_id))
            ? formData.unit_id
            : formData.allowed_unit_ids[0]
        );
        const value = hasUnitValue
          ? formData.unit_monthly_salaries[unitId]
          : isPrimaryUnit ? formData.monthly_salary : '';
        return value === '' || value === null || value === undefined || !Number.isFinite(safeNumber(value, NaN)) || safeNumber(value, -1) < 0;
      });
      if (missingMonthlyUnits.length > 0) {
        const names = missingMonthlyUnits.map(unitId => units.find(unit => String(unit.id) === String(unitId))?.name || unitId);
        alert(`Informe um valor fixo mensal válido para cada unidade permitida: ${names.join(', ')}.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const cleanUsername = (formData.username || formData.name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.');
      const finalEmail = formData.email.trim() ? formData.email.trim().toLowerCase() : `${cleanUsername}.${Date.now()}@scalemedic.local`;
      const primaryUnitId = String(
        formData.allowed_unit_ids.some(unitId => String(unitId) === String(formData.unit_id))
          ? formData.unit_id
          : formData.allowed_unit_ids[0] || ''
      );
      const unitMonthlySalaries = { ...formData.unit_monthly_salaries };
      const hasPrimaryMonthlySalary = primaryUnitId && Object.prototype.hasOwnProperty.call(unitMonthlySalaries, primaryUnitId);
      const monthlySalary = safeNumber(
        hasPrimaryMonthlySalary ? unitMonthlySalaries[primaryUnitId] : formData.monthly_salary,
        0
      );
      const authorizedSectors = (formData.authorized_sectors || []).map(String);
      const existingMeta = editingProf ? getProfMeta(editingProf) : {};

      const richMeta = {
        ...existingMeta,
        username: cleanUsername, category: formData.category, app_role: formData.app_role,
        main_sector: formData.main_sector, specialty: formData.specialty, rqe: formData.rqe, cbo: formData.cbo,
        registration_id: formData.registration_id, coop_tax_rate: safeNumber(formData.coop_tax_rate),
        remuneration_type: formData.remuneration_type, 
        monthly_salary: monthlySalary,
        unit_monthly_salaries: unitMonthlySalaries,
        unit_rates: formData.unit_rates, // MATRIZ SALVA!
        pix_type: formData.pix_type, bank_info: formData.bank_info.trim(), pix_key: formData.pix_key.trim(),
        document_expiry: formData.document_expiry, status: formData.status,
        authorized_sectors: authorizedSectors, allowed_unit_ids: formData.allowed_unit_ids,
        birth_date: formData.birth_date, cpf: formData.cpf
      };

      const profPayload = {
        company_id: company?.id || 'cmp_principal', 
        unit_id: primaryUnitId,
        unit_ids: formData.allowed_unit_ids,
        name: formData.name.trim(), document: formData.document.trim(), 
        specialty: formData.specialty.trim() || formData.main_sector,
        rqe: formData.rqe.trim(), cbo: formData.cbo.trim(), cpf: formData.cpf.trim(), 
        email: finalEmail, phone: formData.phone.trim(), status: formData.status, 
        remuneration_type: formData.remuneration_type,
        monthly_salary: monthlySalary,
        document_expiry: formData.document_expiry, birth_date: formData.birth_date,
        data: richMeta 
      };

      let savedProf = await autoHealingSave(editingProf?.id, profPayload);
      const savedProfId = savedProf?.id || editingProf?.id;

      if (savedProfId) {
        try {
          window.localStorage.setItem(`prof_meta_${savedProfId}`, JSON.stringify(richMeta));
        } catch (error) {
          console.warn('Não foi possível salvar os metadados locais do profissional:', error);
        }
      }

      const userDataPayload = {
        company_id: company?.id || 'cmp_principal',
        selected_unit_id: formData.allowed_unit_ids[0],
        allowed_unit_ids: formData.allowed_unit_ids, 
        app_role: formData.app_role,
        registration_code: formData.registration_id,
        status: formData.status,
        must_change_password: !!formData.password 
      };

      try {
        const { data: existingUsers } = await supabase.from('users').select('*').eq('email', finalEmail);
        if (existingUsers && existingUsers.length > 0) {
          let updatePayload = {
            username: cleanUsername,
            full_name: formData.name,
            data: { ...(existingUsers[0].data || {}), ...userDataPayload, is_active: formData.status === 'ativo' }
          };
          if (formData.password) updatePayload.password = formData.password;
          await supabase.from('users').update(updatePayload).eq('id', existingUsers[0].id);
        } else {
          const finalPass = formData.password || '123456';
          await supabase.from('users').insert([{
            email: finalEmail, username: cleanUsername, password: finalPass,
            full_name: formData.name, data: { ...userDataPayload, is_active: formData.status === 'ativo' }
          }]);
        }
      } catch (uErr) { console.warn('Aviso na sincronização de usuário:', uErr); }

      setModalOpen(false); resetForm(); await syncGlobalData(); alert('Profissional salvo com sucesso!');
    } catch (err) { alert('Erro ao salvar: ' + err.message); } finally { setSubmitting(false); }
  };

  const counts = useMemo(() => {
    let ativos = 0, pendentes = 0, inativos = 0;
    professionals.forEach(p => {
      const meta = getProfMeta(p);
      const st = String(p.status || meta.status || 'ativo').toLowerCase();
      if (st === 'pendente' || st === 'em_analise') pendentes++;
      else if (st === 'inativo' || st === 'recusado') inativos++;
      else ativos++;
    });
    return { ativos, pendentes, inativos };
  }, [professionals]);

  const filteredList = useMemo(() => {
    const term = searchQuery.toLowerCase().trim();
    return professionals.filter(p => {
      const meta = getProfMeta(p);
      const st = String(p.status || meta.status || 'ativo').toLowerCase();
      const cat = meta.category || p.category || 'medico';
      
      if (activeTab === 'pendentes' && st !== 'pendente' && st !== 'em_analise') return false;
      if (activeTab === 'inativos' && st !== 'inativo' && st !== 'recusado') return false;
      if (activeTab === 'ativos' && (st === 'pendente' || st === 'em_analise' || st === 'inativo' || st === 'recusado')) return false;
      if (categoryFilter !== 'todas' && cat !== categoryFilter) return false;

      if (term) {
        const searchable = [
          p.name, p.document, p.cpf, p.email, p.phone, p.specialty,
          meta.rqe, meta.registration_id || p.registration_id
        ].join(' ').toLowerCase();
        if (!searchable.includes(term)) return false;
      }
      return true;
    });
  }, [professionals, activeTab, categoryFilter, searchQuery]);
  const sortedFilteredList = useMemo(() =>
    [...filteredList].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')),
  [filteredList]);

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400"><Users className="w-4 h-4" /> Gestão de Pessoal & Matrícula</div>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black">Corpo Clínico & Matrículas</h2>
          <p className="text-xs text-slate-300">Cadastro de profissionais, matriz de valores por unidade e liberação de acessos.</p>
        </div>
        {isManager && (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleDownloadImportTemplate} variant="outline" className="h-10 border-white/25 bg-white/10 text-white hover:bg-white/20 font-bold text-xs rounded-xl gap-2 cursor-pointer">
              <Download className="w-4 h-4" /> Baixar modelo Excel
            </Button>
            <Button onClick={() => importInputRef.current?.click()} variant="outline" className="h-10 border-emerald-400/50 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25 font-bold text-xs rounded-xl gap-2 cursor-pointer">
              <Upload className="w-4 h-4" /> Importar planilha
            </Button>
            <Button onClick={handleOpenNew} className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-lg gap-1.5 shrink-0 cursor-pointer">
              <UserPlus className="w-4 h-4" /> Novo Profissional
            </Button>
          </div>
        )}
      </div>

      <input ref={importInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleImportFile} />

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setActiveTab('ativos')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'ativos' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>Ativos ({counts.ativos})</button>
          <button onClick={() => setActiveTab('pendentes')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'pendentes' ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>Pendentes ({counts.pendentes})</button>
          <button onClick={() => setActiveTab('inativos')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'inativos' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>Inativos ({counts.inativos})</button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="h-9 w-full sm:w-44 text-xs font-semibold"><SelectValue placeholder="Categoria" /></SelectTrigger><SelectContent><SelectItem value="todas">Todas Categorias</SelectItem>{allCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent></Select>
            <div className="relative w-full sm:w-72"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input placeholder="Nome, CPF, conselho, e-mail..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9 text-xs" /></div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <span className="text-[11px] font-semibold text-slate-500">{sortedFilteredList.length} profissional(is)</span>
            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-950" role="group" aria-label="Modo de visualização">
              <button type="button" onClick={() => setViewMode('list')} aria-label="Visualizar em lista" aria-pressed={viewMode === 'list'} className={`h-8 w-9 grid place-items-center rounded-lg cursor-pointer ${viewMode === 'list' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-white dark:hover:bg-slate-800'}`}>
                <List className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setViewMode('cards')} aria-label="Visualizar em cartões" aria-pressed={viewMode === 'cards'} className={`h-8 w-9 grid place-items-center rounded-lg cursor-pointer ${viewMode === 'cards' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-white dark:hover:bg-slate-800'}`}>
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={viewMode === 'list' ? 'space-y-2' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
        {sortedFilteredList.map(prof => {
          const meta = getProfMeta(prof);
          const catId = meta.category || prof.category || 'medico';
          const catObj = allCategories.find(c => c.id === catId) || allCategories[0];
          const profStatus = prof.status || meta.status || 'ativo';
          const authSectorsCount = (meta.authorized_sectors || (sectors || []).map(s => String(s.id))).length;
          const profUnits = meta.allowed_unit_ids || prof.unit_ids || (prof.unit_id ? [String(prof.unit_id)] : []);
          const profUnitsNames = units.filter(u => profUnits.includes(String(u.id))).map(u => u.name).join(', ') || 'Nenhuma unidade vinculada';
          const displayEmail = String(prof.email || '').endsWith('@scalemedic.local') ? 'Não informado' : (prof.email || '—');

          const regimeType = meta.remuneration_type || 'plantao';
          let regimeLabel = 'Por Plantão Dinâmico';
          if (regimeType === 'mensal') regimeLabel = 'Fixo Mensal';
          if (regimeType === 'produtividade') regimeLabel = 'Produtividade / Comissão';

          const expiry = prof.document_expiry || meta.document_expiry || '';
          let diffDays = null;
          let isExpired = false;
          let isNearExpiry = false;

          if (expiry) {
            const todayObj = new Date(); todayObj.setHours(0, 0, 0, 0);
            const [exY, exM, exD] = expiry.split('-').map(Number);
            const expiryObj = new Date(exY, exM - 1, exD); expiryObj.setHours(0, 0, 0, 0);
            diffDays = Math.round((expiryObj.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24));
            isExpired = diffDays < 0;
            isNearExpiry = diffDays >= 0 && diffDays <= 30;
          }

          if (viewMode === 'list') {
            return (
              <Card key={prof.id} className={`p-4 rounded-2xl border transition-colors bg-white dark:bg-slate-900 ${
                isExpired ? 'border-rose-300 dark:border-rose-900/70' : isNearExpiry ? 'border-amber-300 dark:border-amber-900/70' : 'border-slate-200 dark:border-slate-800'
              }`}>
                <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black text-sm text-slate-900 dark:text-white">{prof.name || prof.full_name || 'Sem nome'}</h3>
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-black uppercase border bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/30">{catObj?.label}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                        profStatus === 'ativo' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' :
                        profStatus === 'pendente' || profStatus === 'em_analise' ? 'bg-amber-500/10 text-amber-700 border-amber-500/30' :
                        'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}>{profStatus.replace('_', ' ')}</span>
                      <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">{meta.registration_id || prof.registration_id || 'Matrícula não informada'}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-5 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                      <span className="truncate" title={prof.specialty || meta.specialty || 'Geral'}><b className="text-slate-500">Especialidade:</b> {prof.specialty || meta.specialty || 'Geral'}{meta.rqe ? ` · RQE ${meta.rqe}` : ''}</span>
                      <span className="truncate"><b className="text-slate-500">Conselho:</b> {prof.document || '—'}</span>
                      <span className="truncate" title={profUnitsNames}><b className="text-slate-500">Unidades:</b> {profUnitsNames}</span>
                      <span className="truncate"><b className="text-slate-500">Telefone:</b> {prof.phone || '—'}</span>
                      <span className="truncate"><b className="text-slate-500">E-mail:</b> {displayEmail}</span>
                      <span className={`truncate ${isExpired ? 'text-rose-600 font-bold' : isNearExpiry ? 'text-amber-600 font-bold' : ''}`}>
                        <b>Credencial:</b> {expiry ? expiry.split('-').reverse().join('/') : 'Não informada'}
                        {isExpired ? ' · Vencida' : isNearExpiry ? ` · Vence em ${diffDays}d` : ''}
                      </span>
                      <span className="truncate"><b className="text-slate-500">Regime:</b> {regimeLabel}</span>
                      <span className="truncate"><b className="text-slate-500">Setores autorizados:</b> {authSectorsCount}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 xl:shrink-0">
                    <Button size="sm" variant="outline" onClick={() => handleOpenEdit(prof)} className="flex-1 xl:flex-none text-xs h-9 font-bold gap-1 rounded-xl cursor-pointer">
                      <Edit3 className="w-3.5 h-3.5 text-sky-600" /> Editar
                    </Button>
                    {isManager && (
                      <Button size="sm" variant="outline" onClick={() => handleToggleStatusQuick(prof)} title={profStatus === 'ativo' ? 'Desativar profissional' : 'Ativar profissional'} className={`h-9 px-3 text-xs font-bold rounded-xl cursor-pointer gap-1 ${profStatus === 'ativo' ? 'border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' : 'border-slate-300 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <Power className="w-3.5 h-3.5" /> {profStatus === 'ativo' ? 'Desativar' : 'Ativar'}
                      </Button>
                    )}
                    {prof.phone && (
                      <Button size="sm" variant="outline" onClick={() => handleOpenProfessionalWhatsApp(prof)} aria-label={`Abrir WhatsApp de ${prof.name}`} title="Enviar mensagem pelo WhatsApp" className="h-9 px-3 rounded-xl border-emerald-300 text-emerald-600 hover:bg-emerald-50 cursor-pointer">
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          }

          return (
            <Card key={prof.id} className={`p-5 rounded-3xl border-2 transition-all flex flex-col justify-between space-y-4 shadow-sm bg-white dark:bg-slate-900 ${
              isExpired ? 'border-rose-400 bg-rose-50/40 dark:bg-rose-950/20' : isNearExpiry ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20' : 'border-slate-200 dark:border-slate-800'
            }`}>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase border bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/30">{catObj?.label}</span>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white mt-1.5">{prof.name}</h3>
                    <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">ID: {meta.registration_id || prof.registration_id || 'MAT-XXXX'}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${profStatus === 'ativo' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' : 'bg-slate-200 text-slate-600'}`}>{profStatus}</span>
                </div>
                
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between"><span>Conselho:</span><strong>{prof.document || '—'}</strong></div>
                  <div className="flex justify-between"><span>Especialidade:</span><strong className="text-slate-900 dark:text-white truncate max-w-[140px]">{prof.specialty || meta.specialty || 'Geral'} {meta.rqe ? `(RQE ${meta.rqe})` : ''}</strong></div>
                  
                  <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800 mt-2">
                    <span>Hospitais de Acesso:</span>
                    <strong className="text-[10px] text-sky-600 dark:text-sky-400 truncate max-w-[140px]" title={profUnitsNames}>{profUnitsNames}</strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Validade Credencial:</span>
                    <div className="flex items-center gap-1.5">
                      <strong className={`font-mono ${isExpired ? 'text-rose-600 font-black' : isNearExpiry ? 'text-amber-600 dark:text-amber-400 font-black' : 'text-slate-700 dark:text-slate-300'}`}>
                        {expiry ? expiry.split('-').reverse().join('/') : 'Não informada'}
                      </strong>
                      {isExpired && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-600 text-white animate-pulse">VENCIDO</span>}
                      {isNearExpiry && !isExpired && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-white animate-pulse">{diffDays === 0 ? 'VENCE HOJE' : `VENCE EM ${diffDays}D`}</span>}
                    </div>
                  </div>
                </div>

                <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" /> Remuneração
                  </span>
                  <span className="font-black text-sm text-emerald-600 dark:text-emerald-300 uppercase">
                    {regimeLabel}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleOpenEdit(prof)} className="flex-1 text-xs h-9 font-bold gap-1 rounded-xl cursor-pointer">
                  <Edit3 className="w-3.5 h-3.5 text-sky-600" /> Editar Perfil
                </Button>

                {isManager && (
                  <Button size="sm" variant="outline" onClick={() => handleToggleStatusQuick(prof)} title={profStatus === 'ativo' ? 'Desativar profissional' : 'Ativar profissional'} className={`h-9 px-3 text-xs font-bold rounded-xl cursor-pointer gap-1 ${profStatus === 'ativo' ? 'border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' : 'border-slate-300 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    <Power className="w-3.5 h-3.5" /> {profStatus === 'ativo' ? 'Desativar' : 'Ativar'}
                  </Button>
                )}

                {prof.phone && (
                  <Button size="sm" variant="outline" onClick={() => handleOpenProfessionalWhatsApp(prof)} aria-label={`Abrir WhatsApp de ${prof.name}`} title="Enviar mensagem pelo WhatsApp" className="h-9 px-3 rounded-xl border-emerald-300 text-emerald-600 hover:bg-emerald-50 cursor-pointer">
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
        {sortedFilteredList.length === 0 && (
          <div className={viewMode === 'list' ? 'py-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700' : 'col-span-full py-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700'}>
            <Users className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Nenhum profissional encontrado</p>
            <p className="text-xs text-slate-500 mt-1">Tente ajustar a busca ou os filtros selecionados.</p>
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
          <DialogHeader><DialogTitle className="text-base font-black flex items-center gap-2 text-slate-900 dark:text-white"><UserCog className="w-5 h-5 text-sky-600" /> {editingProf ? 'Editar Perfil Profissional & Acesso' : 'Cadastrar Novo Profissional'}</DialogTitle></DialogHeader>

          <form onSubmit={handleSaveProfessional} className="space-y-5 py-2 text-xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-slate-400" />
                  <Label className="text-xs font-black uppercase text-slate-500">Categoria Profissional *</Label>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingCatId(null); setNewCatData({label: '', council: 'Registro'}); setManageCatModalOpen(true); }} className="h-7 text-[10px] text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950 cursor-pointer font-bold">
                  <Settings className="w-3.5 h-3.5 mr-1" /> Gerenciar Categorias
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {allCategories.map(cat => (
                  <div key={cat.id} onClick={() => setFormData({ ...formData, category: cat.id })} className={`p-2 rounded-xl border cursor-pointer text-center transition-all flex flex-col justify-center ${formData.category === cat.id ? 'border-sky-600 bg-sky-50 dark:bg-sky-900/20 font-black shadow-sm ring-1 ring-sky-600 text-sky-700 dark:text-sky-400' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-white'}`}>
                    <span className="text-[11px] block truncate px-1">{cat.label}</span>
                    <span className="text-[9px] opacity-60 px-1 truncate">Conselho: {cat.council}</span>
                  </div>
                ))}
                <div onClick={() => { setEditingCatId(null); setNewCatData({label: '', council: 'Registro'}); setManageCatModalOpen(true); }} className="p-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 cursor-pointer flex items-center justify-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-900 font-bold min-h-[50px]">
                  <Plus className="w-3 h-3 text-rose-500" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-400" />
                <Label className="text-xs font-black uppercase text-slate-500">Perfil de Permissão no Sistema *</Label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ACCESS_ROLES.map(role => (
                  <div key={role.id} onClick={() => setFormData({ ...formData, app_role: role.id })} className={`p-3 rounded-xl border cursor-pointer transition-all ${formData.app_role === role.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm ring-1 ring-indigo-500' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-black text-xs ${formData.app_role === role.id ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>{role.label}</span>
                      {formData.app_role === role.id && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">{role.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div>
                <Label className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-sky-600" /> Hospitais Liberados (Múltiplas Unidades)
                </Label>
                <p className="text-[11px] text-slate-500 mt-1">Selecione em quais unidades este profissional pode atuar. A matriz de valores aparecerá para cada unidade selecionada.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {units.map(u => (
                  <label key={u.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    formData.allowed_unit_ids.includes(String(u.id)) ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/30' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:border-sky-300'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formData.allowed_unit_ids.includes(String(u.id))}
                      onChange={e => handleAllowedUnitToggle(u.id, e.target.checked)}
                      className="w-4 h-4 text-sky-600 rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{u.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div>
                <Label className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  Setores autorizados para alocação
                </Label>
                <p className="text-[11px] text-slate-500 mt-1">
                  O profissional só poderá ser selecionado em plantões dos setores marcados.
                </p>
              </div>
              {(allCompanySectors || []).length === 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
                  Cadastre os setores da unidade antes de definir as permissões por setor.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(allCompanySectors || []).map(sector => {
                    const isAuthorized = (formData.authorized_sectors || [])
                      .some(sectorId => String(sectorId) === String(sector.id));
                    return (
                      <label key={sector.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isAuthorized
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:border-indigo-300'
                      }`}>
                        <input
                          type="checkbox"
                          checked={isAuthorized}
                          onChange={() => handleToggleSectorAuth(sector.id)}
                          className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{sector.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-4">
              <div className="flex items-center gap-2 font-black text-xs uppercase text-emerald-700 dark:text-emerald-400 border-b border-slate-200 dark:border-slate-800 pb-2">
                <DollarSign className="w-4 h-4" /> Regime Contratual & Matriz de Valores
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Regime Contratual</Label>
                  <Select value={formData.remuneration_type} onValueChange={v => setFormData({...formData, remuneration_type: v})}>
                    <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="plantao">Por Plantão (Tabela Dinâmica por Unidade)</SelectItem>
                      <SelectItem value="mensal">Fixo Mensal</SelectItem>
                      <SelectItem value="produtividade">Produtividade / Comissão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.remuneration_type === 'mensal' && (
                  <div className="space-y-3 sm:col-span-2">
                    <div>
                      <Label className="text-[11px] font-bold">Valor Fixo Mensal por Unidade</Label>
                      <p className="mt-1 text-[10px] text-slate-500">O faturamento de cada unidade usa somente o valor informado para ela.</p>
                    </div>
                    {formData.allowed_unit_ids.map(uid => {
                      const unitName = units.find(unit => String(unit.id) === String(uid))?.name || 'Unidade';
                      const primaryUnitId = formData.allowed_unit_ids.some(id => String(id) === String(formData.unit_id))
                        ? formData.unit_id
                        : formData.allowed_unit_ids[0];
                      const monthlyValue = Object.prototype.hasOwnProperty.call(formData.unit_monthly_salaries, uid)
                        ? formData.unit_monthly_salaries[uid]
                        : String(uid) === String(primaryUnitId) ? formData.monthly_salary : '';
                      return (
                        <div key={uid} className="grid grid-cols-1 items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-[minmax(0,1fr)_220px]">
                          <Label htmlFor={`monthly-salary-${uid}`} className="text-xs font-bold text-slate-700 dark:text-slate-300">{unitName}</Label>
                          <Input
                            id={`monthly-salary-${uid}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={monthlyValue}
                            onChange={e => handleUnitMonthlySalaryChange(uid, e.target.value)}
                            placeholder="Valor mensal (R$)"
                            className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
                
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Retenção PJ/Coop (%) - Opcional</Label>
                  <Input type="number" step="0.1" value={formData.coop_tax_rate} onChange={e => setFormData({...formData, coop_tax_rate: e.target.value})} placeholder="Ex: 5" className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                </div>
              </div>

              {formData.remuneration_type === 'plantao' && (
                <div className="space-y-3 pt-2">
                  <Label className="text-[11px] font-bold uppercase text-slate-500">Tabela de Preços por Hospital Permitido</Label>
                  {formData.allowed_unit_ids.map(uid => {
                    const uName = units.find(x => String(x.id) === String(uid))?.name || 'Unidade';
                    return (
                      <div key={uid} className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 shadow-sm">
                        <Label className="text-xs font-black text-sky-600 dark:text-sky-400 flex items-center gap-1.5"><Hospital className="w-3.5 h-3.5"/> {uName}</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px] text-slate-500">Plantão Diurno (R$)</Label>
                            <Input type="number" step="0.01" placeholder="Ex: 1200" value={formData.unit_rates[uid]?.diurno || ''} onChange={e => handleUnitRateChange(uid, 'diurno', e.target.value)} className="h-8 text-xs border-slate-200 dark:border-slate-800" />
                          </div>
                          <div>
                            <Label className="text-[10px] text-slate-500">Plantão Noturno (R$)</Label>
                            <Input type="number" step="0.01" placeholder="Ex: 1400" value={formData.unit_rates[uid]?.noturno || ''} onChange={e => handleUnitRateChange(uid, 'noturno', e.target.value)} className="h-8 text-xs border-slate-200 dark:border-slate-800" />
                          </div>
                          <div>
                            <Label className="text-[10px] text-slate-500">Fim de Semana (R$)</Label>
                            <Input type="number" step="0.01" placeholder="Ex: 1800" value={formData.unit_rates[uid]?.fds || ''} onChange={e => handleUnitRateChange(uid, 'fds', e.target.value)} className="h-8 text-xs border-slate-200 dark:border-slate-800" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">Nome Completo Oficial *</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" required />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">Especialidade / Atuação *</Label>
                  <Input value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})} placeholder="Ex: Cirurgião Geral" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">RQE</Label>
                  <Input value={formData.rqe} onChange={e => setFormData({...formData, rqe: e.target.value})} placeholder="Ex: 12345" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">Matrícula ID (Gerada Auto) *</Label>
                  <Input value={formData.registration_id} onChange={e => setFormData({...formData, registration_id: e.target.value})} className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono font-bold text-sky-600" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-900 dark:text-slate-200">CPF *</Label>
                  <Input value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} placeholder="000.000.000-00" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-900 dark:text-slate-200">Data Nasc. *</Label>
                  <Input type="date" value={formData.birth_date} onChange={e => setFormData({...formData, birth_date: e.target.value})} className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono cursor-pointer" required />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-900 dark:text-slate-200">Conselho *</Label>
                  <Input value={formData.document} onChange={e => setFormData({...formData, document: e.target.value})} placeholder="Ex: 2155 - RJ" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-900 dark:text-slate-200">Validade Cred.</Label>
                  <Input type="date" value={formData.document_expiry} onChange={e => setFormData({...formData, document_expiry: e.target.value})} className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono cursor-pointer" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">CBO</Label>
                  <Input value={formData.cbo} onChange={e => setFormData({...formData, cbo: e.target.value})} placeholder="Ex: 225125" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">Telefone / WhatsApp *</Label>
                  <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="21999999999" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">Status Cadastral</Label>
                  <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                    <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">E-mail Profissional</Label>
                <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="email@exemplo.com (Opcional)" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/60 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-black text-xs text-sky-900 dark:text-sky-200 uppercase tracking-wider">
                  <KeyRound className="w-4 h-4 text-sky-600" /> Credenciais de Login & Acesso
                </div>
                <div className="flex items-center gap-1.5">
                  <Button type="button" size="sm" variant="outline" onClick={handleGenerateDefaultPassword} className="h-7 text-[10px] font-bold border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950 cursor-pointer shadow-sm">
                    <RefreshCw className="w-3 h-3 mr-1" /> Senha (Data Nasc)
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setFormData(p => ({...p, password: 'S@ude'+Math.floor(1000+Math.random()*9000)}))} className="h-7 text-[10px] font-bold border-sky-300 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950 cursor-pointer">
                    <RefreshCw className="w-3 h-3 mr-1" /> Gerar Aleatória
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Usuário (Login por Nome) *</Label>
                  <Input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="Ex: dr.carlos" className="h-10 bg-white dark:bg-slate-900 font-mono font-bold text-sky-600 border-slate-200 dark:border-slate-800" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{editingProf ? 'Nova Senha (deixe vazio para manter)' : 'Senha de Acesso *'}</Label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder={editingProf ? '••••••••' : 'Senha'} className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono pr-8" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
              </div>
              <Button type="button" onClick={handleSendWhatsApp} className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md gap-2 rounded-xl mt-2 cursor-pointer">
                <Send className="w-4 h-4" /> Enviar link de acesso via WhatsApp
              </Button>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Por segurança, a mensagem não inclui usuário ou senha.
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-3">
              <div className="flex items-center gap-2 font-black text-xs uppercase text-emerald-700 dark:text-emerald-400 border-b border-slate-200 dark:border-slate-800 pb-2">
                <DollarSign className="w-4 h-4" /> Dados para Recebimento / PIX
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Tipo Chave PIX</Label>
                  <Select value={formData.pix_type} onValueChange={v => setFormData({...formData, pix_type: v})}>
                    <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="CPF">CPF</SelectItem>
                      <SelectItem value="CNPJ">CNPJ</SelectItem>
                      <SelectItem value="Email">E-mail</SelectItem>
                      <SelectItem value="Telefone">Telefone</SelectItem>
                      <SelectItem value="Aleatoria">Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px] font-bold">Chave PIX para Repasse</Label>
                  <Input value={formData.pix_key} onChange={e => setFormData({...formData, pix_key: e.target.value})} className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono" />
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <Label className="text-[11px] font-bold flex items-center gap-1.5"><Landmark className="w-3.5 h-3.5 text-slate-500" /> Dados Bancários (Caso não receba via PIX)</Label>
                <Input value={formData.bank_info} onChange={e => setFormData({...formData, bank_info: e.target.value})} placeholder="Ex: Banco Itaú, Agência 0000, Conta Corrente 00000-0" className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
              </div>
            </div>

            <DialogFooter className="pt-4 gap-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="text-xs h-10 border-slate-200 dark:border-slate-700 cursor-pointer">Cancelar </Button>
              <Button type="submit" disabled={submitting || formData.allowed_unit_ids.length === 0} className="bg-sky-600 hover:bg-sky-500 text-white font-black text-xs h-10 px-8 rounded-xl shadow-md cursor-pointer transition-all">Salvar Perfil Profissional</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-slate-900 dark:text-white">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> Importar corpo clínico
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {importError ? (
              <div role="alert" className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-xs font-semibold text-rose-700">
                {importError}
              </div>
            ) : (
              <>
                <div className="p-3 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/70 dark:bg-sky-950/30 text-xs text-sky-900 dark:text-sky-100 space-y-1">
                  <p className="font-black">{importFileName || 'Planilha pronta para revisão'}</p>
                  <p>Confira a prévia. Linhas com erro não serão importadas; duplicidades existentes precisam ser revisadas manualmente.</p>
                  <p className="font-bold">A planilha não cria contas de acesso nem importa senhas. Configure o acesso de cada profissional depois, no cadastro.</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
                    <span className="block text-lg font-black text-emerald-700 dark:text-emerald-300">{importRows.filter(row => !row.errors.length && !row.imported).length}</span>
                    <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">Prontos</span>
                  </div>
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 p-3 text-center">
                    <span className="block text-lg font-black text-rose-700 dark:text-rose-300">{importRows.filter(row => row.errors.length || row.importError).length}</span>
                    <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-300">Com erro</span>
                  </div>
                  <div className="rounded-xl bg-sky-50 dark:bg-sky-950/30 p-3 text-center">
                    <span className="block text-lg font-black text-sky-700 dark:text-sky-300">{importRows.filter(row => row.imported).length}</span>
                    <span className="text-[10px] font-bold uppercase text-sky-700 dark:text-sky-300">Importados</span>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1" aria-label="Prévia de linhas da planilha">
                  {importRows.map(row => (
                    <div key={row.lineNumber} className={`p-3 rounded-xl border ${
                      row.imported ? 'border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20' :
                      row.errors.length || row.importError ? 'border-rose-200 bg-rose-50/60 dark:bg-rose-950/20' :
                      'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                    }`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-black text-slate-900 dark:text-white">Linha {row.lineNumber}: {row.name}</span>
                        <span className={`text-[9px] font-black uppercase ${
                          row.imported ? 'text-emerald-700 dark:text-emerald-300' :
                          row.errors.length || row.importError ? 'text-rose-700 dark:text-rose-300' :
                          'text-sky-700 dark:text-sky-300'
                        }`}>{row.imported ? 'Importado' : row.errors.length || row.importError ? 'Revisar' : 'Pronto'}</span>
                      </div>
                      {(row.errors.length > 0 || row.importError) && (
                        <p className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">{[...row.errors, row.importError].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)} disabled={importing} className="text-xs h-10 cursor-pointer">Fechar</Button>
            <Button type="button" onClick={handleImportProfessionals} disabled={importing || !importRows.some(row => !row.errors.length && !row.imported)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs h-10 px-5 rounded-xl gap-2 cursor-pointer">
              {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Importar profissionais válidos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageCatModalOpen} onOpenChange={setManageCatModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Settings className="w-5 h-5 text-sky-600" /> Gerenciar Categorias Profissionais
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-4">
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              <Label className="text-[10px] font-black uppercase text-slate-500">Categorias Existentes</Label>
              {allCategories.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhuma categoria encontrada.</p>
              ) : (
                allCategories.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        {c.label}
                        {c.isDefault && <span className="text-[8px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded flex items-center gap-1"><Lock className="w-2 h-2"/> Padrão</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Conselho: {c.council}</div>
                    </div>
                    {!c.isDefault && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditCatClick(c)} className="h-8 w-8 p-0 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950 cursor-pointer">
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteCatClick(c.id)} className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase text-slate-500">{editingCatId ? 'Editar Categoria Customizada' : 'Adicionar Nova Categoria'}</Label>
                {editingCatId && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingCatId(null); setNewCatData({label: '', council: 'Registro'}); }} className="h-5 text-[9px] text-slate-400 hover:text-slate-600 cursor-pointer">Cancelar Edição</Button>
                )}
              </div>
              <div className="space-y-1.5">
                <Input value={newCatData.label} onChange={e => setNewCatData({...newCatData, label: e.target.value})} placeholder="Nome da Profissão (Ex: Fonoaudiólogo)" className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-xs" required />
              </div>
              <div className="flex gap-2">
                <Input value={newCatData.council} onChange={e => setNewCatData({...newCatData, council: e.target.value})} placeholder="Conselho (Ex: CREFONO)" className="h-10 flex-1 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-xs" />
                <Button type="submit" className="h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer shrink-0">
                  {editingCatId ? <Save className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />} {editingCatId ? 'Salvar' : 'Adicionar'}
                </Button>
              </div>
            </form>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setManageCatModalOpen(false)} className="text-xs h-10 w-full rounded-xl cursor-pointer border-slate-200 dark:border-slate-700 font-bold">
              Fechar Janela
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
    </div>
  );
}