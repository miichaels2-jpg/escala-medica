import React, { useState, useMemo } from 'react';
import { useAppData } from '@/lib/useAppData';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Users, UserPlus, Search, CheckCircle2, XCircle, 
  Clock, DollarSign, Phone, Mail, CreditCard, Edit3, 
  KeyRound, Send, RefreshCw, Ban, UserCheck, MessageSquare,
  Shield, ShieldCheck, UserCog, BadgeCheck, Eye, EyeOff,
  LayoutGrid, List, Stethoscope, HeartPulse, Activity
} from 'lucide-react';

function safeNumber(val, fb = 0) {
  if (val === null || val === undefined || val === '') return fb;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : fb;
}

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeNumber(val));
}

// CATEGORIAS PROFISSIONAIS MULTIDISCIPLINARES
const PROFESSIONAL_CATEGORIES = [
  { id: 'medico', label: 'Médico', council: 'CRM', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' },
  { id: 'enfermeiro', label: 'Enfermeiro(a)', council: 'COREN', color: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30' },
  { id: 'fisioterapeuta', label: 'Fisioterapeuta', council: 'CREFITO', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  { id: 'tecnico_enfermagem', label: 'Técnico de Enfermagem', council: 'COREN', color: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30' },
  { id: 'farmaceutico', label: 'Farmacêutico(a)', council: 'CRF', color: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30' },
  { id: 'nutricionista', label: 'Nutricionista', council: 'CRN', color: 'bg-lime-500/10 text-lime-700 dark:text-lime-300 border-lime-500/30' },
  { id: 'psicologo', label: 'Psicólogo(a)', council: 'CRP', color: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30' },
  { id: 'biomedico', label: 'Biomédico(a)', council: 'CRBM', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  { id: 'fonoaudiologo', label: 'Fonoaudiólogo(a)', council: 'CREFONO', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30' },
  { id: 'outro', label: 'Outro Profissional', council: 'Registro', color: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30' },
];

// PERFIS DE ACESSO AO SISTEMA (PERMISSÕES DE LOGIN)
const ACCESS_ROLES = [
  { id: 'assistencial', label: 'Profissional Assistencial', desc: 'Acesso à Minha Escala, Mural de Plantões, Trocas e Repasses' },
  { id: 'coordenador', label: 'Coordenador de Escala', desc: 'Montagem de escalas, setores e homologação de trocas' },
  { id: 'faturamento', label: 'Faturamento / Financeiro', desc: 'Fechamento de honorários, conciliação e relatórios de repasse' },
  { id: 'gestor', label: 'Gestor Geral / Administrador', desc: 'Acesso pleno a todos os módulos, cadastros e configurações' },
];

// Salva com proteção contra colunas ausentes no banco
async function autoHealingSave(id, initialPayload) {
  let payload = { ...initialPayload };
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      if (id) {
        return await base44.entities.Professional.update(id, payload);
      } else {
        return await base44.entities.Professional.create(payload);
      }
    } catch (err) {
      const msg = err.message || '';
      const match = msg.match(/Could not find the '([^']+)' column of 'professionals'/i);
      if (match && match[1]) {
        const badCol = match[1];
        delete payload[badCol];
        continue;
      }
      throw err;
    }
  }
}

export default function CorpoClinico() {
  const { 
    professionals, 
    units, 
    selectedUnitId, 
    company, 
    isManager, 
    syncGlobalData 
  } = useAppData();

  const [activeTab, setActiveTab] = useState('ativos'); 
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todas');
  const [roleFilter, setRoleFilter] = useState('todos');
  
  // Modais e Formulário
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProf, setEditingProf] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    username: '', 
    category: 'medico', // Categoria Profissional
    document: '',
    specialty: '',
    cbo: '',
    cpf: '',
    email: '',
    phone: '',
    unit_id: '',
    status: 'ativo',
    app_role: 'assistencial', // Perfil de Acesso
    remuneration_type: 'hora', // 'hora', 'diaria', 'mensal'
    hourly_rate: 120,
    daily_rate: 1500,
    monthly_salary: 18000,
    monthly_work_hours: 220,
    coop_tax_rate: 0,
    pix_type: 'CPF',
    pix_key: '',
    bank_info: '',
    password: ''
  });

  const resetForm = () => {
    setFormData({
      name: '',
      username: '',
      category: 'medico',
      document: '',
      specialty: '',
      cbo: '',
      cpf: '',
      email: '',
      phone: '',
      unit_id: selectedUnitId || (units[0]?.id || 'unit_h1'),
      status: 'ativo',
      app_role: 'assistencial',
      remuneration_type: 'hora',
      hourly_rate: 120,
      daily_rate: 1500,
      monthly_salary: 18000,
      monthly_work_hours: 220,
      coop_tax_rate: 0,
      pix_type: 'CPF',
      pix_key: '',
      bank_info: '',
      password: ''
    });
    setEditingProf(null);
    setShowPassword(false);
  };

  const handleOpenNew = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleOpenEdit = (prof) => {
    setEditingProf(prof);
    const meta = getProfMeta(prof);

    const defaultUsername = (prof.name || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '.')
      .replace(/\.+/g, '.')
      .replace(/^\.|\.$/g, '');

    setFormData({
      name: prof.name || prof.full_name || '',
      username: meta.username || prof.username || defaultUsername,
      category: meta.category || prof.category || (prof.specialty?.toLowerCase().includes('enferm') ? 'enfermeiro' : 'medico'),
      document: prof.document || prof.registration_number || '',
      specialty: prof.specialty || '',
      cbo: meta.cbo || prof.cbo || '',
      cpf: prof.cpf || '',
      email: prof.email || '',
      phone: prof.phone || '',
      unit_id: prof.unit_id || selectedUnitId,
      status: prof.status || 'ativo',
      app_role: meta.app_role || prof.app_role || 'assistencial',
      remuneration_type: prof.remuneration_type || meta.remuneration_type || 'hora',
      hourly_rate: safeNumber(prof.hourly_rate ?? meta.hourly_rate, 120),
      daily_rate: safeNumber(meta.daily_rate ?? prof.daily_rate, 1500),
      monthly_salary: safeNumber(meta.monthly_salary ?? prof.monthly_salary, 18000),
      monthly_work_hours: safeNumber(meta.monthly_work_hours ?? prof.monthly_work_hours, 220),
      coop_tax_rate: safeNumber(meta.coop_tax_rate ?? prof.coop_tax_rate, 0),
      pix_type: meta.pix_type || 'CPF',
      pix_key: meta.pix_key || '',
      bank_info: meta.bank_info || '',
      password: ''
    });
    setModalOpen(true);
  };

  const handleGeneratePassword = () => {
    const randomPass = 'Saude@' + Math.floor(1000 + Math.random() * 9000);
    setFormData(prev => ({ ...prev, password: randomPass }));
  };

  const handleResetDefaultPassword = () => {
    setFormData(prev => ({ ...prev, password: 'Mudar@123' }));
    alert('Senha temporária definida como "Mudar@123". Clique em Salvar Perfil para confirmar.');
  };

  const handleSendWhatsApp = (prof, customPassword = '') => {
    const rawPhone = prof.phone || formData.phone;
    const cleanPhone = String(rawPhone || '').replace(/\D/g, '');
    
    if (!cleanPhone) {
      alert('Informe o telefone/WhatsApp do profissional para disparar a mensagem.');
      return;
    }

    const phoneWithDDI = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const loginUser = formData.username || prof.username || prof.email || formData.email;
    const pass = customPassword || formData.password || '(sua senha cadastrada)';
    const siteUrl = window.location.origin;

    const catObj = PROFESSIONAL_CATEGORIES.find(c => c.id === (formData.category || 'medico'));
    const roleObj = ACCESS_ROLES.find(r => r.id === (formData.app_role || 'assistencial'));

    const message = [
      `*ScaleMedic - Gestão Hospitalar* 🏥\n`,
      `Olá, *${prof.name || formData.name}*!`,
      `Seu cadastro profissional (*${catObj?.label || 'Profissional'}*) está ativo.`,
      `Perfil no Sistema: *${roleObj?.label || 'Assistencial'}*\n`,
      `Acesse seus plantões e escalas com as credenciais:`,
      `🌐 *Link de Acesso:* ${siteUrl}/login`,
      `👤 *Usuário:* ${loginUser}`,
      `🔑 *Senha:* ${pass}\n`,
      `_Ao acessar, confirme seus dados e confira suas escalas ativas._`
    ].join('\n');

    const waUrl = `https://api.whatsapp.com/send?phone=${phoneWithDDI}&text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const handleApprove = async (prof) => {
    if (!confirm(`Aprovar o credenciamento de ${prof.name}? O acesso será liberado imediatamente.`)) return;
    try {
      await autoHealingSave(prof.id, { status: 'ativo' });
      if (prof.user_id && base44.entities.User?.update) {
        await base44.entities.User.update(prof.user_id, { data: { status: 'aprovado' } }).catch(() => {});
      }
      await syncGlobalData();
      alert(`${prof.name} aprovado(a) com sucesso!`);
    } catch (err) {
      alert('Erro ao aprovar: ' + err.message);
    }
  };

  const handleToggleStatus = async (prof, nextStatus) => {
    const actionText = nextStatus === 'ativo' ? 'reativar' : (nextStatus === 'recusado' ? 'recusar' : 'inativar');
    if (!confirm(`Deseja realmente ${actionText} o cadastro de ${prof.name}?`)) return;
    try {
      await autoHealingSave(prof.id, { status: nextStatus });
      if (prof.user_id && base44.entities.User?.update) {
        await base44.entities.User.update(prof.user_id, { data: { status: nextStatus } }).catch(() => {});
      }
      await syncGlobalData();
    } catch (err) {
      alert('Erro ao alterar status: ' + err.message);
    }
  };

  const handleSaveProfessional = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Preencha o nome do profissional.');
      return;
    }

    setSubmitting(true);
    try {
      const cleanUsername = (formData.username || formData.name)
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '.')
        .replace(/\.+/g, '.')
        .replace(/^\.|\.$/g, '');

      const richMeta = {
        username: cleanUsername,
        category: formData.category,
        app_role: formData.app_role,
        cbo: formData.cbo.trim(),
        coop_tax_rate: safeNumber(formData.coop_tax_rate),
        daily_rate: safeNumber(formData.daily_rate),
        monthly_salary: safeNumber(formData.monthly_salary),
        monthly_work_hours: safeNumber(formData.monthly_work_hours),
        pix_type: formData.pix_type,
        pix_key: formData.pix_key.trim(),
        bank_info: formData.bank_info.trim(),
        remuneration_type: formData.remuneration_type,
        hourly_rate: safeNumber(formData.hourly_rate)
      };

      const profPayload = {
        company_id: company?.id || 'cmp_principal',
        unit_id: formData.unit_id || selectedUnitId || 'unit_h1',
        name: formData.name.trim(),
        document: formData.document.trim(),
        specialty: formData.specialty.trim(),
        cpf: formData.cpf.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        status: formData.status,
        remuneration_type: formData.remuneration_type,
        hourly_rate: safeNumber(formData.hourly_rate)
      };

      let savedProf = await autoHealingSave(editingProf?.id, profPayload);
      const savedProfId = savedProf?.id || editingProf?.id;

      if (savedProfId) {
        try {
          window.localStorage.setItem(`prof_meta_${savedProfId}`, JSON.stringify(richMeta));
        } catch {}
      }

      // Sincroniza usuário para login por username
      const userEmail = formData.email.trim().toLowerCase() || `${cleanUsername}@hospital.com`;
      const isMasterRole = formData.app_role === 'gestor';

      let userObj = null;
      const byUser = await base44.entities.User.filter({ username: cleanUsername }).catch(() => []);
      if (byUser && byUser.length > 0) userObj = byUser[0];

      if (!userObj && userEmail) {
        const byEmail = await base44.entities.User.filter({ email: userEmail }).catch(() => []);
        if (byEmail && byEmail.length > 0) userObj = byEmail[0];
      }

      const userDataPayload = {
        ...richMeta,
        status: formData.status === 'ativo' ? 'aprovado' : formData.status,
        phone: formData.phone.trim(),
        professional_id: savedProfId,
        company_id: company?.id || 'cmp_principal',
        selected_unit_id: formData.unit_id || selectedUnitId || 'unit_h1'
      };

      if (userObj) {
        const updateBody = {
          full_name: formData.name.trim(),
          username: cleanUsername,
          role: isMasterRole ? 'admin' : 'user',
          data: { ...(userObj.data || {}), ...userDataPayload }
        };
        if (formData.password.trim()) {
          updateBody.password = formData.password.trim();
        }
        await base44.entities.User.update(userObj.id, updateBody).catch(() => {});
      } else {
        const newUser = await base44.entities.User.create({
          username: cleanUsername,
          email: userEmail,
          password: formData.password.trim() || '123456',
          full_name: formData.name.trim(),
          role: isMasterRole ? 'admin' : 'user',
          data: userDataPayload
        }).catch(() => null);

        if (newUser && savedProfId) {
          await autoHealingSave(savedProfId, { user_id: newUser.id }).catch(() => {});
        }
      }

      setModalOpen(false);
      resetForm();
      await syncGlobalData();
      alert('Profissional salvo com sucesso!');
    } catch (err) {
      alert('Erro ao salvar profissional: ' + (err.message || 'Falha de conexão.'));
    } finally {
      setSubmitting(false);
    }
  };

  function getProfMeta(prof) {
    if (!prof) return {};
    try {
      const stored = window.localStorage.getItem(`prof_meta_${prof.id}`);
      if (stored) return JSON.parse(stored);
    } catch {}
    if (prof.data && typeof prof.data === 'object') return prof.data;
    return {};
  }

  const counts = useMemo(() => {
    let ativos = 0, pendentes = 0, inativos = 0;
    professionals.forEach(p => {
      const st = String(p.status || 'ativo').toLowerCase();
      if (st === 'pendente' || st === 'em_analise') pendentes++;
      else if (st === 'inativo' || st === 'recusado') inativos++;
      else ativos++;
    });
    return { ativos, pendentes, inativos };
  }, [professionals]);

  const filteredList = useMemo(() => {
    const term = searchQuery.toLowerCase().trim();

    return professionals.filter(p => {
      const st = String(p.status || 'ativo').toLowerCase();
      const meta = getProfMeta(p);
      const cat = meta.category || p.category || (p.specialty?.toLowerCase().includes('enferm') ? 'enfermeiro' : 'medico');
      const role = meta.app_role || p.app_role || 'assistencial';
      
      if (activeTab === 'pendentes' && st !== 'pendente' && st !== 'em_analise') return false;
      if (activeTab === 'inativos' && st !== 'inativo' && st !== 'recusado') return false;
      if (activeTab === 'ativos' && (st === 'pendente' || st === 'em_analise' || st === 'inativo' || st === 'recusado')) return false;

      if (categoryFilter !== 'todas' && cat !== categoryFilter) return false;
      if (roleFilter !== 'todos' && role !== roleFilter) return false;

      if (term) {
        const matchesName = (p.name || '').toLowerCase().includes(term);
        const matchesDoc = (p.document || '').toLowerCase().includes(term);
        const matchesCpf = (p.cpf || '').toLowerCase().includes(term);
        const matchesSpec = (p.specialty || '').toLowerCase().includes(term);
        const matchesUser = (meta.username || '').toLowerCase().includes(term);
        if (!matchesName && !matchesDoc && !matchesCpf && !matchesSpec && !matchesUser) return false;
      }

      return true;
    });
  }, [professionals, activeTab, categoryFilter, roleFilter, searchQuery]);

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans">
      
      {/* BANNER EXECUTIVO */}
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
            <Users className="w-4 h-4" /> Gestão de Pessoal, Multiprofissional & Honorários
          </div>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black">Corpo Clínico & Assistencial</h2>
          <p className="text-xs text-slate-300">
            Cadastro de médicos, enfermeiros, fisioterapeutas e equipe multiprofissional com regras contratuais e acessos.
          </p>
        </div>

        {isManager && (
          <Button onClick={handleOpenNew} className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-lg gap-1.5 shrink-0">
            <UserPlus className="w-4 h-4" /> Novo Profissional
          </Button>
        )}
      </div>

      {/* ABAS, MODOS DE VISUALIZAÇÃO E FILTROS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
        
        {/* ABAS DE STATUS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('ativos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'ativos'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Ativos na Escala</span>
            <span className="text-[10px] opacity-70">({counts.ativos})</span>
          </button>

          <button
            onClick={() => setActiveTab('pendentes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'pendentes'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Aguardando Homologação</span>
            {counts.pendentes > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center animate-pulse">
                {counts.pendentes}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('inativos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'inativos'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Inativos / Bloqueados</span>
            <span className="text-[10px] opacity-70">({counts.inativos})</span>
          </button>
        </div>

        {/* FILTROS E ALTERNADOR DE VISUALIZAÇÃO (CARDS / LISTA) */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* BOTÃO ALTERNADOR GRADE / LISTA */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/70 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('grid')}
              title="Visualização em Cards"
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'grid' 
                  ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="Visualização em Lista Rápida"
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'list' 
                  ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* FILTRO DE CATEGORIA (MÉDICO, ENFERMEIRO, FISIO...) */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 w-44 text-xs font-semibold">
              <SelectValue placeholder="Profissão / Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as Categorias</SelectItem>
              {PROFESSIONAL_CATEGORIES.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* FILTRO DE PERFIL DE ACESSO */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-9 w-36 text-xs font-semibold">
              <SelectValue placeholder="Perfil Acesso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Perfis</SelectItem>
              {ACCESS_ROLES.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* CAMPO DE BUSCA */}
          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="Buscar nome, conselho, usuário..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="pl-9 h-9 text-xs" 
            />
          </div>
        </div>
      </div>

      {/* RENDERIZAÇÃO: MODO LISTA OU MODO CARDS */}
      {filteredList.length === 0 ? (
        <Card className="p-16 text-center border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">Nenhum profissional encontrado</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {activeTab === 'pendentes' ? 'Não há cadastros aguardando homologação.' : 'Nenhum registro com os filtros selecionados.'}
          </p>
        </Card>
      ) : viewMode === 'list' ? (
        
        /* =================================================== */
        /* VISUALIZAÇÃO EM LISTA / TABELA RÁPIDA               */
        /* =================================================== */
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Profissional & Especialidade</th>
                  <th className="py-3 px-4">Categoria & Perfil</th>
                  <th className="py-3 px-4">Conselho / Doc</th>
                  <th className="py-3 px-4">Login (Usuário)</th>
                  <th className="py-3 px-4">Regime & Valor</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredList.map(prof => {
                  const meta = getProfMeta(prof);
                  const isPending = prof.status === 'pendente' || prof.status === 'em_analise';
                  const isInactive = prof.status === 'inativo' || prof.status === 'recusado';
                  const catId = meta.category || prof.category || (prof.specialty?.toLowerCase().includes('enferm') ? 'enfermeiro' : 'medico');
                  const catObj = PROFESSIONAL_CATEGORIES.find(c => c.id === catId) || PROFESSIONAL_CATEGORIES[0];
                  const roleObj = ACCESS_ROLES.find(r => r.id === (meta.app_role || prof.app_role || 'assistencial'));
                  const remType = prof.remuneration_type || meta.remuneration_type || 'hora';

                  return (
                    <tr key={prof.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-black text-slate-900 dark:text-white">{prof.name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{prof.specialty || 'Geral'}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase border ${catObj.color}`}>
                            {catObj.label}
                          </span>
                          {roleObj?.id === 'gestor' && (
                            <span className="text-[9px] font-black uppercase text-purple-600 dark:text-purple-400">
                              ★ Gestor Geral
                            </span>
                          )}
                          {roleObj?.id === 'coordenador' && (
                            <span className="text-[9px] font-black uppercase text-sky-600 dark:text-sky-400">
                              ★ Coordenador
                            </span>
                          )}
                          {roleObj?.id === 'faturamento' && (
                            <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                              ★ Faturamento
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        {prof.document || '—'}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-900">
                          {meta.username || '—'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">
                          {remType === 'diaria' 
                            ? `${formatCurrency(meta.daily_rate || 1500)} / plantão`
                            : remType === 'mensal'
                            ? `${formatCurrency(meta.monthly_salary || 18000)} / mês`
                            : `${formatCurrency(prof.hourly_rate || meta.hourly_rate || 120)} / hora`}
                        </div>
                        {safeNumber(meta.coop_tax_rate) > 0 && (
                          <div className="text-[10px] text-amber-600 font-bold">Retenção: {meta.coop_tax_rate}%</div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                          isPending 
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' 
                            : isInactive 
                            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30' 
                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                        }`}>
                          {prof.status || 'Ativo'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isPending ? (
                            <>
                              <Button size="sm" onClick={() => handleApprove(prof)} className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5">
                                Aprovar
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleToggleStatus(prof, 'recusado')} className="h-7 text-[11px] text-rose-600 border-rose-200 px-2.5">
                                Recusar
                              </Button>
                            </>
                          ) : (
                            <>
                              {prof.phone && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => handleSendWhatsApp(prof)} 
                                  title="Enviar dados via WhatsApp"
                                  className="h-7 w-7 p-0 border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => handleOpenEdit(prof)} 
                                className="h-7 text-[11px] font-bold px-2.5 gap-1 text-sky-600"
                              >
                                <Edit3 className="w-3 h-3" /> Editar
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (

        /* =================================================== */
        /* VISUALIZAÇÃO EM CARDS (GRADE)                       */
        /* =================================================== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map(prof => {
            const isPending = prof.status === 'pendente' || prof.status === 'em_analise';
            const isInactive = prof.status === 'inativo' || prof.status === 'recusado';
            const meta = getProfMeta(prof);
            const catId = meta.category || prof.category || (prof.specialty?.toLowerCase().includes('enferm') ? 'enfermeiro' : 'medico');
            const catObj = PROFESSIONAL_CATEGORIES.find(c => c.id === catId) || PROFESSIONAL_CATEGORIES[0];
            const roleObj = ACCESS_ROLES.find(r => r.id === (meta.app_role || prof.app_role || 'assistencial'));
            const remType = prof.remuneration_type || meta.remuneration_type || 'hora';

            return (
              <Card 
                key={prof.id} 
                className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-4 shadow-sm ${
                  isPending 
                    ? 'border-amber-300 bg-amber-50/20 dark:bg-amber-950/10' 
                    : isInactive 
                    ? 'border-slate-200 dark:border-slate-800 opacity-75' 
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="space-y-3">
                  
                  {/* CABEÇALHO DO CARD COM AS BADGES EM DESTAQUE NA FRENTE */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        {/* BADGE DA CATEGORIA PROFISSIONAL */}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase border ${catObj.color}`}>
                          {catObj.label}
                        </span>

                        {/* BADGE DO PERFIL DE GESTÃO (SE FOR GESTOR, COORD OU FATURAMENTO) */}
                        {roleObj?.id !== 'assistencial' && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase border ${
                            roleObj?.id === 'gestor' 
                              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                              : roleObj?.id === 'coordenador'
                              ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30'
                              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          }`}>
                            {roleObj?.label}
                          </span>
                        )}
                      </div>

                      <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">
                        {prof.name}
                      </h3>
                      {prof.specialty && (
                        <span className="text-xs text-sky-600 dark:text-sky-400 font-bold block mt-0.5 truncate">
                          {prof.specialty}
                        </span>
                      )}
                    </div>

                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border shrink-0 ${
                      isPending 
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' 
                        : isInactive 
                        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30' 
                        : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    }`}>
                      {prof.status || 'Ativo'}
                    </span>
                  </div>

                  {/* IDENTIFICAÇÃO E CREDENCIAIS */}
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    {meta.username && (
                      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/40 px-2 py-1 rounded-lg">
                        <span className="font-bold text-sky-600">Usuário de Login:</span>
                        <strong className="font-mono text-slate-900 dark:text-white font-black">{meta.username}</strong>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>{catObj.council} / Registro:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{prof.document || '—'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Telefone / WhatsApp:</span>
                      <span className="text-slate-800 dark:text-slate-200 font-medium">{prof.phone || '—'}</span>
                    </div>
                  </div>

                  {/* FINANCEIRO / REGRAS DE FATURAMENTO */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-1 text-xs">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                      <span>Regime Faturamento</span>
                      <span className="text-sky-600 font-black">
                        {remType === 'diaria' ? 'PLANTONISTA / DIARISTA' : remType.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center font-bold text-slate-800 dark:text-slate-200">
                      <span>Base de Cálculo:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-black">
                        {remType === 'diaria' 
                          ? `${formatCurrency(meta.daily_rate || 1500)} / plantão`
                          : remType === 'mensal'
                          ? `${formatCurrency(meta.monthly_salary || 18000)} / mês`
                          : `${formatCurrency(prof.hourly_rate || meta.hourly_rate || 120)} / hora`}
                      </span>
                    </div>

                    {safeNumber(meta.coop_tax_rate) > 0 && (
                      <div className="flex justify-between items-center text-[11px]">
                        <span>Retenção Cooperativa/PJ:</span>
                        <span className="font-bold text-amber-600">{meta.coop_tax_rate}%</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* BOTÕES DE AÇÃO */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  {isPending ? (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => handleApprove(prof)} 
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 gap-1 shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Homologar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleToggleStatus(prof, 'recusado')} 
                        className="flex-1 text-rose-600 border-rose-200 hover:bg-rose-50 text-xs h-8 gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Recusar
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleOpenEdit(prof)} 
                        className="flex-1 text-xs h-8 gap-1 font-bold"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-sky-600" /> Editar Perfil
                      </Button>

                      {prof.phone && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleSendWhatsApp(prof)}
                          title="Enviar dados de acesso via WhatsApp"
                          className="h-8 px-2.5 border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      )}

                      {isInactive ? (
                        <Button 
                          size="sm" 
                          onClick={() => handleToggleStatus(prof, 'ativo')} 
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 font-bold"
                        >
                          Reativar
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleToggleStatus(prof, 'inativo')} 
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs h-8 px-2.5"
                          title="Inativar profissional"
                        >
                          <Ban className="w-4 h-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL: CRIAR OU EDITAR CADASTRO */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <UserCog className="w-5 h-5 text-sky-600" />
              {editingProf ? 'Editar Perfil Profissional & Acesso' : 'Cadastrar Novo Profissional'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveProfessional} className="space-y-4 py-2 text-xs">
            
            {/* 1. SELEÇÃO DA CATEGORIA PROFISSIONAL */}
            <div className="p-3.5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60 space-y-2">
              <Label className="text-xs font-black uppercase text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-sky-600" /> Categoria Profissional *
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PROFESSIONAL_CATEGORIES.map(cat => {
                  const selected = formData.category === cat.id;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => setFormData({ ...formData, category: cat.id })}
                      className={`p-2 rounded-xl border cursor-pointer text-center transition-all ${
                        selected 
                          ? 'border-sky-600 bg-white dark:bg-slate-900 font-black shadow-sm ring-1 ring-sky-600 text-sky-600' 
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <span className="text-[11px] block">{cat.label}</span>
                      <span className="text-[9px] text-slate-400">Conselho: {cat.council}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. PERFIL DE ACESSO / PERMISSÕES DE LOGIN */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 space-y-2">
              <Label className="text-xs font-black uppercase text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-indigo-600" /> Perfil de Permissão no Sistema *
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ACCESS_ROLES.map(role => {
                  const selected = formData.app_role === role.id;
                  return (
                    <div
                      key={role.id}
                      onClick={() => setFormData({ ...formData, app_role: role.id })}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        selected 
                          ? 'border-indigo-600 bg-white dark:bg-slate-900 shadow-sm ring-1 ring-indigo-600' 
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-slate-900 dark:text-white">{role.label}</span>
                        {selected && <BadgeCheck className="w-4 h-4 text-indigo-600" />}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{role.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. DADOS CADASTRAIS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-bold">Nome Completo Oficial *</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Nome completo" className="h-9" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Especialidade / Atuação *</Label>
                <Input value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})} placeholder="Ex: UTI Adulto, Pediatria, Traumato" className="h-9" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Número de Registro no Conselho *</Label>
                <Input value={formData.document} onChange={e => setFormData({...formData, document: e.target.value})} placeholder="Ex: 123456 - RJ" className="h-9" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">CPF *</Label>
                <Input value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} placeholder="000.000.000-00" className="h-9" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Telefone / WhatsApp *</Label>
                <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="(21) 99999-9999" className="h-9" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">CBO (Código Brasileiro de Ocupações)</Label>
                <Input value={formData.cbo} onChange={e => setFormData({...formData, cbo: e.target.value})} placeholder="Ex: 225125" className="h-9" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">E-mail Profissional</Label>
                <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="profissional@hospital.com" className="h-9" />
              </div>
            </div>

            {/* 4. SEÇÃO DE CREDENCIAIS & LOGIN POR NOME */}
            <div className="p-4 rounded-2xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-xs text-sky-900 dark:text-sky-200 uppercase tracking-wider">
                  <KeyRound className="w-4 h-4 text-sky-600" />
                  Credenciais de Login & Acesso
                </div>

                <div className="flex items-center gap-1.5">
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="outline" 
                    onClick={handleResetDefaultPassword} 
                    className="h-7 text-[10px] font-bold border-amber-300 text-amber-700 dark:text-amber-300"
                  >
                    Resetar Senha
                  </Button>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="outline" 
                    onClick={handleGeneratePassword} 
                    className="h-7 text-[10px] font-bold border-sky-300 text-sky-600"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" /> Gerar Aleatória
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Usuário (Login por Nome) *
                  </Label>
                  <Input 
                    type="text" 
                    value={formData.username} 
                    onChange={e => setFormData({...formData, username: e.target.value})} 
                    placeholder="Ex: dr.carlos, enf.ana" 
                    className="h-9 bg-white dark:bg-slate-900 font-mono font-bold text-sky-600" 
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    {editingProf ? 'Nova Senha (deixe vazio para manter)' : 'Senha de Acesso *'}
                  </Label>
                  <div className="relative">
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      value={formData.password} 
                      onChange={e => setFormData({...formData, password: e.target.value})} 
                      placeholder={editingProf ? '••••••••' : 'Digite a senha'} 
                      className="h-9 bg-white dark:bg-slate-900 font-mono pr-8" 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2 pt-1">
                  <Button 
                    type="button" 
                    onClick={() => handleSendWhatsApp(editingProf || formData, formData.password)}
                    className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" /> Enviar Dados de Acesso via WhatsApp
                  </Button>
                </div>
              </div>
            </div>

            {/* 5. CONTRATO & REGRAS PARA O FATURAMENTO */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2 font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Contrato & Faturamento de Honorários
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Regime Contratual</Label>
                  <Select value={formData.remuneration_type} onValueChange={v => setFormData({...formData, remuneration_type: v})}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hora">Horista (R$/hora)</SelectItem>
                      <SelectItem value="diaria">Plantonista / Diarista (R$/plantão)</SelectItem>
                      <SelectItem value="mensal">Mensalista (Salário Fixo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.remuneration_type === 'hora' && (
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold">Valor da Hora (R$)</Label>
                    <Input type="number" step="0.01" value={formData.hourly_rate} onChange={e => setFormData({...formData, hourly_rate: e.target.value})} className="h-9" />
                  </div>
                )}

                {formData.remuneration_type === 'diaria' && (
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold">Valor do Plantão/Diária (R$)</Label>
                    <Input type="number" step="0.01" value={formData.daily_rate} onChange={e => setFormData({...formData, daily_rate: e.target.value})} className="h-9" />
                  </div>
                )}

                {formData.remuneration_type === 'mensal' && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold">Salário Mensal (R$)</Label>
                      <Input type="number" step="0.01" value={formData.monthly_salary} onChange={e => setFormData({...formData, monthly_salary: e.target.value})} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold">Horas Mensais</Label>
                      <Input type="number" value={formData.monthly_work_hours} onChange={e => setFormData({...formData, monthly_work_hours: e.target.value})} className="h-9" />
                    </div>
                  </>
                )}

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Retenção Cooperativa / PJ (%)</Label>
                  <Input type="number" step="0.1" value={formData.coop_tax_rate} onChange={e => setFormData({...formData, coop_tax_rate: e.target.value})} placeholder="Ex: 5" className="h-9" />
                </div>
              </div>
            </div>

            {/* 6. REPASSE FINANCEIRO / PIX */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2 font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                <CreditCard className="w-4 h-4 text-sky-600" />
                Dados para Repasse Financeiro
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Tipo Chave PIX</Label>
                  <Select value={formData.pix_type} onValueChange={v => setFormData({...formData, pix_type: v})}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CPF">CPF</SelectItem>
                      <SelectItem value="CNPJ">CNPJ</SelectItem>
                      <SelectItem value="Email">E-mail</SelectItem>
                      <SelectItem value="Telefone">Telefone</SelectItem>
                      <SelectItem value="Aleatoria">Chave Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px] font-bold">Chave PIX</Label>
                  <Input value={formData.pix_key} onChange={e => setFormData({...formData, pix_key: e.target.value})} placeholder="Insira a chave PIX..." className="h-9" />
                </div>

                <div className="space-y-1 sm:col-span-3">
                  <Label className="text-[11px] font-bold">Dados Bancários Opcionais</Label>
                  <Input value={formData.bank_info} onChange={e => setFormData({...formData, bank_info: e.target.value})} placeholder="Ex: Banco Itaú, Ag 1234, CC 56789-0" className="h-9" />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="text-xs h-9">
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting} className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-9 px-5">
                {submitting ? 'Salvando...' : 'Salvar Perfil'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}