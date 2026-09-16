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
  LayoutGrid, List, Stethoscope, HeartPulse, Plus, Building2
} from 'lucide-react';

function safeNumber(val, fb = 0) {
  if (val === null || val === undefined || val === '') return fb;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : fb;
}

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeNumber(val));
}

// Categorias Profissionais Padrão + Suporte a Customizadas
const DEFAULT_CATEGORIES = [
  { id: 'medico', label: 'Médico(a)', council: 'CRM' },
  { id: 'enfermeiro', label: 'Enfermeiro(a)', council: 'COREN' },
  { id: 'fisioterapeuta', label: 'Fisioterapeuta', council: 'CREFITO' },
  { id: 'tecnico_enfermagem', label: 'Téc. Enfermagem', council: 'COREN' },
  { id: 'farmaceutico', label: 'Farmacêutico(a)', council: 'CRF' },
  { id: 'nutricionista', label: 'Nutricionista', council: 'CRN' },
  { id: 'psicologo', label: 'Psicólogo(a)', council: 'CRP' },
  { id: 'biomedico', label: 'Biomédico(a)', council: 'CRBM' }
];

const ACCESS_ROLES = [
  { id: 'assistencial', label: 'Profissional Assistencial', desc: 'Acesso à Minha Escala, Mural, Trocas e Repasses' },
  { id: 'coordenador', label: 'Coordenador de Escala', desc: 'Montagem de escalas, setores e homologação' },
  { id: 'faturamento', label: 'Faturamento / Financeiro', desc: 'Fechamento de honorários, conciliação e repasses' },
  { id: 'gestor', label: 'Gestor Geral / Administrador', desc: 'Acesso pleno a todos os módulos e configurações' },
];

async function autoHealingSave(id, initialPayload) {
  let payload = { ...initialPayload };
  for (let attempt = 0; attempt < 8; attempt++) {
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
        delete payload[match[1]];
        continue;
      }
      throw err;
    }
  }
}

export default function CorpoClinico() {
  const { 
    professionals, 
    sectors,
    units, 
    selectedUnitId, 
    company, 
    isManager, 
    syncGlobalData 
  } = useAppData();

  const [activeTab, setActiveTab] = useState('ativos'); 
  const [viewMode, setViewMode] = useState('grid'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todas');
  
  // Modais e Formulário
  const [modalOpen, setModalOpen] = useState(false);
  const [newCatModalOpen, setNewCatModalOpen] = useState(false);
  const [editingProf, setEditingProf] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Lista dinâmica de categorias (permite adicionar novas com o botão "+")
  const [customCategories, setCustomCategories] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem('scale_custom_cats') || '[]');
    } catch {
      return [];
    }
  });

  const [newCatData, setNewCatData] = useState({ label: '', council: 'Registro' });

  const allCategories = useMemo(() => {
    return [...DEFAULT_CATEGORIES, ...customCategories];
  }, [customCategories]);

  const [formData, setFormData] = useState({
    name: '',
    username: '', 
    category: 'medico',
    document: '', // Registro no Conselho (ex: 2155 - RJ)
    specialty: '', // Mantido para compatibilidade, mas o foco visual é o Setor de Atuação
    main_sector: '', // Setor de Atuação Principal no Hospital
    cpf: '',
    email: '',
    phone: '',
    unit_id: '',
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

  const resetForm = () => {
    setFormData({
      name: '',
      username: '',
      category: 'medico',
      document: '',
      specialty: '',
      main_sector: sectors[0]?.name || 'UTI Geral',
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
      category: meta.category || prof.category || 'medico',
      document: prof.document || prof.registration_number || '',
      specialty: prof.specialty || '',
      main_sector: meta.main_sector || prof.specialty || sectors[0]?.name || 'UTI Geral',
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

  const handleAddCustomCategory = (e) => {
    e.preventDefault();
    if (!newCatData.label.trim()) return;

    const newId = newCatData.label.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newCatObj = { id: newId, label: newCatData.label.trim(), council: newCatData.council || 'Registro' };

    const updated = [...customCategories, newCatObj];
    setCustomCategories(updated);
    try {
      window.localStorage.setItem('scale_custom_cats', JSON.stringify(updated));
    } catch {}

    setFormData(prev => ({ ...prev, category: newId }));
    setNewCatData({ label: '', council: 'Registro' });
    setNewCatModalOpen(false);
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

    const message = [
      `*ScaleMedic - Gestão Hospitalar* 🏥\n`,
      `Olá, *${prof.name || formData.name}*!`,
      `Seu cadastro profissional está ativo no sistema.\n`,
      `Acesse seus plantões com as credenciais:`,
      `🌐 *Link:* ${siteUrl}/login`,
      `👤 *Usuário:* ${loginUser}`,
      `🔑 *Senha:* ${pass}\n`,
      `_Ao acessar, verifique sua grade de escalas e plantões._`
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
        main_sector: formData.main_sector,
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
        specialty: formData.main_sector, // Armazena o setor de atuação para o roll
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
      const cat = meta.category || p.category || 'medico';
      
      if (activeTab === 'pendentes' && st !== 'pendente' && st !== 'em_analise') return false;
      if (activeTab === 'inativos' && st !== 'inativo' && st !== 'recusado') return false;
      if (activeTab === 'ativos' && (st === 'pendente' || st === 'em_analise' || st === 'inativo' || st === 'recusado')) return false;

      if (categoryFilter !== 'todas' && cat !== categoryFilter) return false;

      if (term) {
        const matchesName = (p.name || '').toLowerCase().includes(term);
        const matchesDoc = (p.document || '').toLowerCase().includes(term);
        const matchesCpf = (p.cpf || '').toLowerCase().includes(term);
        const matchesSec = (meta.main_sector || p.specialty || '').toLowerCase().includes(term);
        if (!matchesName && !matchesDoc && !matchesCpf && !matchesSec) return false;
      }

      return true;
    });
  }, [professionals, activeTab, categoryFilter, searchQuery]);

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans">
      
      {/* BANNER PRINCIPAL */}
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
            <Users className="w-4 h-4" /> Gestão de Pessoal, Categorias & Honorários
          </div>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black">Corpo Clínico & Credenciais</h2>
          <p className="text-xs text-slate-300">
            Cadastro multiprofissional com categorias configuráveis e definição do setor principal de atuação.
          </p>
        </div>

        {isManager && (
          <Button onClick={handleOpenNew} className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-lg gap-1.5 shrink-0">
            <UserPlus className="w-4 h-4" /> Novo Profissional
          </Button>
        )}
      </div>

      {/* ABAS & FILTROS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
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
            <span>Ativos</span>
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
            <span>Aguardando Aprovação</span>
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
            <span>Inativos</span>
            <span className="text-[10px] opacity-70">({counts.inativos})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 w-44 text-xs font-semibold">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas Categorias</SelectItem>
              {allCategories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="Buscar nome, conselho..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="pl-9 h-9 text-xs" 
            />
          </div>
        </div>
      </div>

      {/* LISTAGEM DOS CARDS */}
      {filteredList.length === 0 ? (
        <Card className="p-16 text-center border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">Nenhum profissional encontrado</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">Nenhum registro com os filtros selecionados.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map(prof => {
            const meta = getProfMeta(prof);
            const isPending = prof.status === 'pendente' || prof.status === 'em_analise';
            const isInactive = prof.status === 'inativo' || prof.status === 'recusado';
            const catId = meta.category || prof.category || 'medico';
            const catObj = allCategories.find(c => c.id === catId) || allCategories[0];
            const sectorAtuacao = meta.main_sector || prof.specialty || 'UTI Geral';

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
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase border bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30">
                          {catObj?.label || 'Profissional'}
                        </span>
                      </div>
                      <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">
                        {prof.name}
                      </h3>
                      <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold block mt-0.5 truncate">
                        Setor: {sectorAtuacao}
                      </span>
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

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    {meta.username && (
                      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/40 px-2 py-1 rounded-lg">
                        <span className="font-bold text-sky-600">Usuário Login:</span>
                        <strong className="font-mono text-slate-900 dark:text-white font-black">{meta.username}</strong>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>{catObj?.council || 'Registro'}:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{prof.document || '—'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Telefone:</span>
                      <span className="text-slate-800 dark:text-slate-200 font-medium">{prof.phone || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  {isPending ? (
                    <>
                      <Button size="sm" onClick={() => handleApprove(prof)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleToggleStatus(prof, 'recusado')} className="flex-1 text-rose-600 border-rose-200 hover:bg-rose-50 text-xs h-8">
                        Recusar
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => handleOpenEdit(prof)} className="flex-1 text-xs h-8 font-bold gap-1">
                        <Edit3 className="w-3.5 h-3.5 text-sky-600" /> Editar
                      </Button>
                      {prof.phone && (
                        <Button size="sm" variant="outline" onClick={() => handleSendWhatsApp(prof)} className="h-8 px-2.5 border-emerald-300 text-emerald-600 hover:bg-emerald-50">
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleToggleStatus(prof, isInactive ? 'ativo' : 'inativo')} className="text-slate-400 hover:text-rose-600 text-xs h-8 px-2.5">
                        <Ban className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL: CRIAR OU EDITAR PROFISSIONAL (COM SETOR DE ATUAÇÃO E BOTÃO + DE CATEGORIA) */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <UserCog className="w-5 h-5 text-sky-600" />
              {editingProf ? 'Editar Perfil Profissional & Acesso' : 'Cadastrar Novo Profissional'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveProfessional} className="space-y-4 py-2 text-xs">
            
            {/* 1. SELEÇÃO DE CATEGORIA COM BOTÃO DE '+' PARA ADICIONAR NOVA */}
            <div className="p-3.5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black uppercase text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4 text-sky-600" /> Categoria Profissional *
                </Label>

                {/* BOTÃO + PARA CRIAR NOVA CATEGORIA NA HORA */}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setNewCatModalOpen(true)}
                  className="h-7 text-[10px] font-black bg-sky-600 hover:bg-sky-500 text-white px-2.5 rounded-xl gap-1 shadow-sm"
                >
                  <Plus className="w-3 h-3" /> Adicionar Categoria
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {allCategories.map(cat => {
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
                      <span className="text-[11px] block truncate">{cat.label}</span>
                      <span className="text-[9px] text-slate-400">Conselho: {cat.council}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. PERFIL DE ACESSO */}
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

            {/* 3. DADOS BÁSICOS (COM SETOR DE ATUAÇÃO E SEM DUPLICIDADE DE CBO) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-bold">Nome Completo Oficial *</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Nome completo" className="h-9" />
              </div>

              {/* SETOR DE ATUAÇÃO PRINCIPAL */}
              <div className="space-y-1">
                <Label className="text-xs font-bold">Setor de Atuação Principal *</Label>
                <Select value={formData.main_sector} onValueChange={v => setFormData({ ...formData, main_sector: v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o setor..." /></SelectTrigger>
                  <SelectContent>
                    {sectors.map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                    <SelectItem value="UTI Geral">UTI Geral</SelectItem>
                    <SelectItem value="Pronto Atendimento">Pronto Atendimento</SelectItem>
                    <SelectItem value="Centro Cirúrgico">Centro Cirúrgico</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-[10px] text-slate-400">Aparecerá no roll de profissionais na escala.</span>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Número de Registro no Conselho (CRM / COREN) *</Label>
                <Input value={formData.document} onChange={e => setFormData({...formData, document: e.target.value})} placeholder="Ex: 2155 - RJ" className="h-9 font-mono" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">CPF *</Label>
                <Input value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} placeholder="000.000.000-00" className="h-9" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Telefone / WhatsApp *</Label>
                <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="(21) 99999-9999" className="h-9" />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-bold">E-mail Profissional</Label>
                <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="profissional@hospital.com" className="h-9" />
              </div>
            </div>

            {/* 4. CREDENCIAIS DE LOGIN */}
            <div className="p-4 rounded-2xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-xs text-sky-900 dark:text-sky-200 uppercase tracking-wider">
                  <KeyRound className="w-4 h-4 text-sky-600" />
                  Credenciais de Login & Acesso
                </div>

                <div className="flex items-center gap-1.5">
                  <Button type="button" size="sm" variant="outline" onClick={handleResetDefaultPassword} className="h-7 text-[10px] font-bold border-amber-300 text-amber-700">
                    Resetar Senha
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={handleGeneratePassword} className="h-7 text-[10px] font-bold border-sky-300 text-sky-600">
                    <RefreshCw className="w-3 h-3 mr-1" /> Gerar Aleatória
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Usuário (Login por Nome) *</Label>
                  <Input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="Ex: dr.carlos" className="h-9 bg-white dark:bg-slate-900 font-mono font-bold text-sky-600" />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{editingProf ? 'Nova Senha (opcional)' : 'Senha de Acesso *'}</Label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder={editingProf ? '••••••••' : 'Senha'} className="h-9 bg-white dark:bg-slate-900 font-mono pr-8" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2 pt-1">
                  <Button type="button" onClick={() => handleSendWhatsApp(editingProf || formData, formData.password)} className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-sm">
                    <Send className="w-3.5 h-3.5" /> Enviar Dados de Acesso via WhatsApp
                  </Button>
                </div>
              </div>
            </div>

            {/* 5. CONTRATO & REPASSE FINANCEIRO */}
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

            <DialogFooter className="pt-3 gap-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="text-xs h-9">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-9 px-5">
                {submitting ? 'Salvando...' : 'Salvar Perfil'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: ADICIONAR NOVA CATEGORIA COM BOTÃO + */}
      <Dialog open={newCatModalOpen} onOpenChange={setNewCatModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Plus className="w-5 h-5 text-sky-600" /> Cadastrar Nova Categoria Profissional
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddCustomCategory} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Nome da Categoria *</Label>
              <Input 
                value={newCatData.label} 
                onChange={e => setNewCatData({ ...newCatData, label: e.target.value })} 
                placeholder="Ex: Fonoaudiólogo(a), Perfusionista..." 
                className="h-9" 
                required 
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Sigla do Conselho Profissional</Label>
              <Input 
                value={newCatData.council} 
                onChange={e => setNewCatData({ ...newCatData, council: e.target.value })} 
                placeholder="Ex: CREFONO, CRVM..." 
                className="h-9 font-mono uppercase" 
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button type="button" variant="outline" onClick={() => setNewCatModalOpen(false)} className="h-9 text-xs">Cancelar</Button>
              <Button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-9 px-5">Salvar Categoria</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}