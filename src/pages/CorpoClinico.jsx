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
  Users, UserPlus, Search, CheckCircle2, 
  DollarSign, Edit3, KeyRound, RefreshCw, Ban, 
  UserCheck, MessageSquare, Shield, UserCog, Eye, EyeOff,
  HeartPulse, Plus, CreditCard, Landmark, Check, Send
} from 'lucide-react';

function safeNumber(val, fb = 0) {
  if (val === null || val === undefined || val === '') return fb;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : fb;
}

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeNumber(val));
}

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
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      if (id) return await base44.entities.Professional.update(id, payload);
      else return await base44.entities.Professional.create(payload);
    } catch (err) {
      const msg = err.message || '';
      const match = msg.match(/Could not find the '([^']+)' column/i);
      if (match && match[1]) { delete payload[match[1]]; continue; }
      throw err;
    }
  }
}

export default function CorpoClinico() {
  const { professionals = [], sectors = [], units = [], selectedUnitId, company, isManager, syncGlobalData } = useAppData();

  const [activeTab, setActiveTab] = useState('ativos'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todas');
  
  const [modalOpen, setModalOpen] = useState(false);
  const [newCatModalOpen, setNewCatModalOpen] = useState(false);
  const [editingProf, setEditingProf] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [customCategories, setCustomCategories] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem('scale_custom_cats') || '[]'); } catch { return []; }
  });
  const [newCatData, setNewCatData] = useState({ label: '', council: 'Registro' });

  const allCategories = useMemo(() => [...DEFAULT_CATEGORIES, ...customCategories], [customCategories]);

  const [formData, setFormData] = useState({
    name: '', username: '', category: 'medico', document: '',
    registration_id: '', specialty: '', cbo: '',
    cpf: '', email: '', phone: '', unit_id: '',
    status: 'ativo', app_role: 'assistencial', remuneration_type: 'mensal',
    hourly_rate: 120, daily_rate: 1500, monthly_salary: 5000,
    coop_tax_rate: 0, pix_type: 'CPF', pix_key: '', bank_info: '', password: ''
  });

  function getProfMeta(prof) {
    if (!prof) return {};
    try { 
      const stored = window.localStorage.getItem(`prof_meta_${prof.id}`); 
      if (stored) return JSON.parse(stored); 
    } catch {}
    if (prof.data && typeof prof.data === 'object') return prof.data;
    return {};
  }

  const resetForm = () => {
    const generatedMatricula = `MAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setFormData({
      name: '', username: '', category: 'medico', document: '',
      registration_id: generatedMatricula, specialty: '', cbo: '',
      cpf: '', email: '', phone: '', unit_id: selectedUnitId || (units[0]?.id || 'unit_h1'),
      status: 'ativo', app_role: 'assistencial', remuneration_type: 'mensal',
      hourly_rate: 120, daily_rate: 1500, monthly_salary: 5000,
      coop_tax_rate: 0, pix_type: 'CPF', pix_key: '', bank_info: '', password: ''
    });
    setEditingProf(null);
    setShowPassword(false);
  };

  const handleOpenNew = () => { resetForm(); setModalOpen(true); };

  const handleOpenEdit = (prof) => {
    setEditingProf(prof);
    const meta = getProfMeta(prof);

    const remunType = meta.remuneration_type || prof.remuneration_type || 'mensal';
    const sal = meta.monthly_salary !== undefined ? meta.monthly_salary : (prof.monthly_salary !== undefined ? prof.monthly_salary : 5000);
    const hourly = meta.hourly_rate !== undefined ? meta.hourly_rate : (prof.hourly_rate !== undefined ? prof.hourly_rate : 120);
    const daily = meta.daily_rate !== undefined ? meta.daily_rate : (prof.daily_rate !== undefined ? prof.daily_rate : 1500);

    const defaultUsername = (prof.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.');
    const generatedMatricula = prof.registration_id || meta.registration_id || `MAT-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    setFormData({
      name: prof.name || prof.full_name || '',
      username: prof.username || meta.username || defaultUsername,
      category: prof.category || meta.category || 'medico',
      document: prof.document || prof.registration_number || '',
      registration_id: generatedMatricula,
      specialty: prof.specialty || meta.specialty || '',
      cbo: prof.cbo || meta.cbo || '',
      cpf: prof.cpf || '',
      email: prof.email || '',
      phone: prof.phone || '',
      unit_id: prof.unit_id || selectedUnitId,
      status: prof.status || 'ativo',
      app_role: prof.app_role || meta.app_role || 'assistencial',
      remuneration_type: remunType,
      hourly_rate: safeNumber(hourly),
      daily_rate: safeNumber(daily),
      monthly_salary: safeNumber(sal),
      coop_tax_rate: safeNumber(prof.coop_tax_rate ?? meta.coop_tax_rate, 0),
      pix_type: prof.pix_type || meta.pix_type || 'CPF',
      pix_key: prof.pix_key || meta.pix_key || '',
      bank_info: prof.bank_info || meta.bank_info || '',
      password: ''
    });
    setModalOpen(true);
  };

  const handleToggleStatus = async (prof, nextStatus) => {
    const actionDesc = nextStatus === 'ativo' ? 'reativar' : 'inativar';
    if (!confirm(`Deseja realmente ${actionDesc} o profissional ${prof.name}?`)) return;

    try {
      await autoHealingSave(prof.id, { status: nextStatus });
      const meta = getProfMeta(prof);
      window.localStorage.setItem(`prof_meta_${prof.id}`, JSON.stringify({ ...meta, status: nextStatus }));
      await syncGlobalData();
      alert(`Profissional ${nextStatus === 'ativo' ? 'reativado' : 'inativado'} com sucesso!`);
    } catch (err) {
      alert('Erro ao alterar status: ' + err.message);
    }
  };

  const handleAddCustomCategory = (e) => {
    e.preventDefault();
    if (!newCatData.label.trim()) return;
    const newId = newCatData.label.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newCatObj = { id: newId, label: newCatData.label.trim(), council: newCatData.council || 'Registro' };
    const updated = [...customCategories, newCatObj];
    setCustomCategories(updated);
    try { window.localStorage.setItem('scale_custom_cats', JSON.stringify(updated)); } catch {}
    setFormData(prev => ({ ...prev, category: newId }));
    setNewCatData({ label: '', council: 'Registro' });
    setNewCatModalOpen(false);
  };

  const handleSendWhatsApp = () => {
    const rawPhone = formData.phone;
    const cleanPhone = String(rawPhone || '').replace(/\D/g, '');
    if (!cleanPhone) { alert('Preencha o campo Telefone / WhatsApp.'); return; }

    const phoneWithDDI = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const loginUser = formData.username || formData.email || '';
    const pass = formData.password ? formData.password : '(sua senha cadastrada)';
    const siteUrl = window.location.origin;

    const message = `*ScaleMedic - Gestão Hospitalar* 🏥\n\nOlá, *${formData.name}*!\nSeu cadastro profissional foi atualizado no sistema.\n\nAcesse sua escala com as credenciais abaixo:\n🌐 *Link:* ${siteUrl}/login\n👤 *Usuário:* ${loginUser}\n🔑 *Senha:* ${pass}\n\n_Ao acessar, verifique sua grade e fique atento às notificações._`;
    window.open(`https://api.whatsapp.com/send?phone=${phoneWithDDI}&text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleSaveProfessional = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmitting(true);
    try {
      const cleanUsername = (formData.username || formData.name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '.');

      const parsedSalary = safeNumber(formData.monthly_salary);
      const parsedHourly = safeNumber(formData.hourly_rate);
      const parsedDaily = safeNumber(formData.daily_rate);
      const parsedTax = safeNumber(formData.coop_tax_rate);

      const richMeta = {
        username: cleanUsername,
        category: formData.category,
        app_role: formData.app_role,
        specialty: formData.specialty,
        cbo: formData.cbo,
        registration_id: formData.registration_id,
        coop_tax_rate: parsedTax,
        daily_rate: parsedDaily,
        monthly_salary: parsedSalary,
        hourly_rate: parsedHourly,
        remuneration_type: formData.remuneration_type,
        pix_type: formData.pix_type,
        pix_key: formData.pix_key.trim(),
        bank_info: formData.bank_info.trim(),
        status: formData.status
      };

      const profPayload = {
        company_id: company?.id || 'cmp_principal', 
        unit_id: formData.unit_id || selectedUnitId || 'unit_h1',
        name: formData.name.trim(), 
        document: formData.document.trim(), 
        specialty: formData.specialty.trim(),
        cbo: formData.cbo.trim(), 
        cpf: formData.cpf.trim(), 
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(), 
        status: formData.status, 
        registration_id: formData.registration_id,
        remuneration_type: formData.remuneration_type,
        hourly_rate: parsedHourly,
        daily_rate: parsedDaily,
        monthly_salary: parsedSalary,
        coop_tax_rate: parsedTax,
        pix_type: formData.pix_type,
        pix_key: formData.pix_key.trim(),
        bank_info: formData.bank_info.trim(),
        data: richMeta
      };

      let savedProf = await autoHealingSave(editingProf?.id, profPayload);
      const savedProfId = savedProf?.id || editingProf?.id;

      if (savedProfId) {
        try { 
          window.localStorage.setItem(`prof_meta_${savedProfId}`, JSON.stringify(richMeta)); 
        } catch {}
      }

      setModalOpen(false); 
      resetForm(); 
      await syncGlobalData(); 
      alert('Cadastro e dados de remuneração atualizados com sucesso!');
    } catch (err) { 
      alert('Erro ao salvar: ' + err.message); 
    } finally { 
      setSubmitting(false); 
    }
  };

  const counts = useMemo(() => {
    let ativos = 0, pendentes = 0, inativos = 0;
    (professionals || []).forEach(p => {
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
    return (professionals || []).filter(p => {
      const meta = getProfMeta(p);
      const st = String(p.status || meta.status || 'ativo').toLowerCase();
      const cat = p.category || meta.category || 'medico';
      
      if (activeTab === 'pendentes' && st !== 'pendente' && st !== 'em_analise') return false;
      if (activeTab === 'inativos' && st !== 'inativo' && st !== 'recusado') return false;
      if (activeTab === 'ativos' && st !== 'ativo' && st !== 'aprovado') return false;
      if (categoryFilter !== 'todas' && cat !== categoryFilter) return false;

      if (term) {
        const matchesName = (p.name || '').toLowerCase().includes(term);
        const matchesDoc = (p.document || '').toLowerCase().includes(term);
        const matchesMat = (p.registration_id || meta.registration_id || '').toLowerCase().includes(term);
        if (!matchesName && !matchesDoc && !matchesMat) return false;
      }
      return true;
    });
  }, [professionals, activeTab, categoryFilter, searchQuery]);

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400"><Users className="w-4 h-4" /> Gestão de Pessoal & Matrícula ID</div>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black">Corpo Clínico & Faturamento</h2>
          <p className="text-xs text-slate-300">Cadastro de profissionais, repasse financeiro, PIX e geração de Matrícula.</p>
        </div>
        {isManager && (<Button onClick={handleOpenNew} className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-lg gap-1.5 shrink-0"><UserPlus className="w-4 h-4" /> Novo Profissional</Button>)}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button onClick={() => setActiveTab('ativos')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'ativos' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
            Ativos ({counts.ativos})
          </button>
          <button onClick={() => setActiveTab('pendentes')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'pendentes' ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
            Pendentes ({counts.pendentes})
          </button>
          <button onClick={() => setActiveTab('inativos')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'inativos' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
            Inativos ({counts.inativos})
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="h-9 w-44 text-xs font-semibold"><SelectValue placeholder="Categoria" /></SelectTrigger><SelectContent><SelectItem value="todas">Todas Categorias</SelectItem>{allCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent></Select>
          <div className="relative w-full sm:w-56"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input placeholder="Buscar nome ou matrícula..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9 text-xs" /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredList.map(prof => {
          const meta = getProfMeta(prof);
          const catId = prof.category || meta.category || 'medico';
          const catObj = allCategories.find(c => c.id === catId) || allCategories[0];
          
          const remunType = meta.remuneration_type || prof.remuneration_type || 'mensal';
          
          let remunValue = 0;
          let remunLabel = '';
          if (remunType === 'hora') {
            remunValue = meta.hourly_rate !== undefined ? meta.hourly_rate : (prof.hourly_rate ?? 120);
            remunLabel = '/ Hora';
          } else if (remunType === 'diaria') {
            remunValue = meta.daily_rate !== undefined ? meta.daily_rate : (prof.daily_rate ?? 1500);
            remunLabel = '/ Plantão';
          } else {
            remunValue = meta.monthly_salary !== undefined ? meta.monthly_salary : (prof.monthly_salary ?? 5000);
            remunLabel = '/ Mês Fixo';
          }

          const matriculaId = prof.registration_id || meta.registration_id || 'MAT-XXXX';
          const chavePix = meta.pix_key || prof.pix_key || 'Não cadastrado';
          const isInactive = (prof.status || meta.status) === 'inativo' || (prof.status || meta.status) === 'recusado';

          return (
            <Card key={prof.id} className={`p-5 rounded-3xl border bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between space-y-4 transition-colors ${isInactive ? 'border-slate-200 dark:border-slate-800 opacity-60' : 'border-slate-200 dark:border-slate-800'}`}>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase border bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/30">{catObj?.label}</span>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white mt-1.5">{prof.name}</h3>
                    <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">ID: {matriculaId}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${isInactive ? 'bg-rose-500/10 text-rose-600 border-rose-500/30' : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'}`}>
                    {isInactive ? 'Inativo' : (prof.status || 'Ativo')}
                  </span>
                </div>
                
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between"><span>Conselho:</span><strong>{prof.document || '—'}</strong></div>
                  <div className="flex justify-between"><span>Especialidade:</span><strong className="text-slate-900 dark:text-white truncate max-w-[140px]">{prof.specialty || meta.specialty || 'Geral'}</strong></div>
                  <div className="flex justify-between"><span>Chave PIX:</span><strong className="text-sky-600 font-mono truncate max-w-[140px]">{chavePix}</strong></div>
                </div>

                <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 flex items-center justify-between shadow-sm">
                  <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" /> Remuneração Base
                  </span>
                  <span className="font-black text-sm text-emerald-600 dark:text-emerald-300">
                    {formatCurrency(remunValue)} <span className="text-[9px] font-bold opacity-70">{remunLabel}</span>
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleOpenEdit(prof)} className="flex-1 text-xs h-9 font-bold gap-1 rounded-xl border-slate-200 dark:border-slate-700">
                  <Edit3 className="w-3.5 h-3.5 text-sky-600" /> Editar Perfil
                </Button>
                
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => handleToggleStatus(prof, isInactive ? 'ativo' : 'inativo')} 
                  title={isInactive ? 'Reativar profissional' : 'Inativar profissional'}
                  className={`h-9 px-3 rounded-xl ${isInactive ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' : 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30'}`}
                >
                  {isInactive ? <Check className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                </Button>

                {prof.phone && (
                  <Button size="sm" variant="outline" onClick={() => { setFormData(prev => ({...prev, ...prof, password: meta.password || ''})); handleSendWhatsApp(); }} className="h-9 px-3 rounded-xl border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-2xl">
          <DialogHeader><DialogTitle className="text-base font-black flex items-center gap-2 text-slate-900 dark:text-white"><UserCog className="w-5 h-5 text-sky-600" /> {editingProf ? 'Editar Perfil Profissional & Faturamento' : 'Cadastrar Novo Profissional'}</DialogTitle></DialogHeader>

          <form onSubmit={handleSaveProfessional} className="space-y-5 py-2 text-xs">
            <div className="space-y-2">
              <div className="flex items-center gap-2"><HeartPulse className="w-4 h-4 text-slate-400" /><Label className="text-xs font-black uppercase text-slate-500">Categoria Profissional *</Label></div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {allCategories.map(cat => (
                  <div key={cat.id} onClick={() => setFormData({ ...formData, category: cat.id })} className={`p-2 rounded-xl border cursor-pointer text-center transition-all ${formData.category === cat.id ? 'border-sky-600 bg-sky-50 dark:bg-sky-900/20 font-black shadow-sm ring-1 ring-sky-600 text-sky-700 dark:text-sky-400' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'}`}>
                    <span className="text-[11px] block truncate">{cat.label}</span>
                    <span className="text-[9px] opacity-60">Conselho: {cat.council}</span>
                  </div>
                ))}
                <div onClick={() => setNewCatModalOpen(true)} className="p-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 cursor-pointer flex items-center justify-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-900 font-bold">
                  <Plus className="w-3 h-3 text-rose-500" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-slate-400" /><Label className="text-xs font-black uppercase text-slate-500">Perfil de Permissão no Sistema *</Label></div>
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

            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">Nome Completo Oficial *</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">Especialidade / Atuação *</Label>
                  <Input value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})} placeholder="Ex: Cardiologista" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">Matrícula ID (Gerada Auto) *</Label>
                  <Input value={formData.registration_id} onChange={e => setFormData({...formData, registration_id: e.target.value})} className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono font-bold text-sky-600" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">CPF *</Label>
                  <Input value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} placeholder="000.000.000-00" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">Número de Registro no Conselho *</Label>
                  <Input value={formData.document} onChange={e => setFormData({...formData, document: e.target.value})} placeholder="Ex: 2155 - RJ" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">CBO (Código Brasileiro de Ocupações)</Label>
                  <Input value={formData.cbo} onChange={e => setFormData({...formData, cbo: e.target.value})} placeholder="Ex: 225125" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">Telefone / WhatsApp *</Label>
                  <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="21999999999" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">E-mail Profissional</Label>
                <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="email@exemplo.com" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/60 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-black text-xs text-sky-900 dark:text-sky-200 uppercase tracking-wider"><KeyRound className="w-4 h-4 text-sky-600" /> Credenciais de Login & Acesso</div>
                <div className="flex items-center gap-1.5">
                  <Button type="button" size="sm" variant="outline" onClick={() => setFormData(p => ({...p, password: 'Mudar@123'}))} className="h-7 text-[10px] font-bold border-amber-300 text-amber-700 hover:bg-amber-50">Resetar Senha</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setFormData(p => ({...p, password: 'S@ude'+Math.floor(1000+Math.random()*9000)}))} className="h-7 text-[10px] font-bold border-sky-300 text-sky-600 hover:bg-sky-50"><RefreshCw className="w-3 h-3 mr-1" /> Gerar Aleatória</Button>
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
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
              </div>
              <Button type="button" onClick={handleSendWhatsApp} className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md gap-2 rounded-xl mt-2">
                <Send className="w-4 h-4" /> Enviar Credenciais via WhatsApp
              </Button>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-3">
              <div className="flex items-center gap-2 font-black text-xs uppercase text-emerald-700 dark:text-emerald-400"><DollarSign className="w-4 h-4" /> Faturamento, PIX & Dados Bancários</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Regime Contratual</Label>
                  <Select value={formData.remuneration_type} onValueChange={v => setFormData({...formData, remuneration_type: v})}>
                    <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Fixo Mensal</SelectItem>
                      <SelectItem value="diaria">Plantonista (R$ / Diária)</SelectItem>
                      <SelectItem value="hora">Horista (R$ / Hora)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {formData.remuneration_type === 'hora' && (<div className="space-y-1"><Label className="text-[11px] font-bold">Valor da Hora (R$)</Label><Input type="number" step="0.01" value={formData.hourly_rate} onChange={e => setFormData({...formData, hourly_rate: e.target.value})} className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" /></div>)}
                {formData.remuneration_type === 'diaria' && (<div className="space-y-1"><Label className="text-[11px] font-bold">Valor do Plantão (R$)</Label><Input type="number" step="0.01" value={formData.daily_rate} onChange={e => setFormData({...formData, daily_rate: e.target.value})} className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" /></div>)}
                {formData.remuneration_type === 'mensal' && (<div className="space-y-1"><Label className="text-[11px] font-bold">Salário Base (R$)</Label><Input type="number" step="0.01" value={formData.monthly_salary} onChange={e => setFormData({...formData, monthly_salary: e.target.value})} className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" /></div>)}

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Retenção PJ/Coop (%)</Label>
                  <Input type="number" step="0.1" value={formData.coop_tax_rate} onChange={e => setFormData({...formData, coop_tax_rate: e.target.value})} placeholder="Ex: 5" className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Tipo Chave PIX</Label>
                  <Select value={formData.pix_type} onValueChange={v => setFormData({...formData, pix_type: v})}>
                    <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"><SelectValue /></SelectTrigger>
                    <SelectContent>
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
                  <Input value={formData.pix_key} onChange={e => setFormData({...formData, pix_key: e.target.value})} placeholder="Insira a chave..." className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono" />
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <Label className="text-[11px] font-bold flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-slate-500" /> Dados Bancários Físicos (Para TED/DOC)</Label>
                <Input value={formData.bank_info} onChange={e => setFormData({...formData, bank_info: e.target.value})} placeholder="Ex: Banco Itaú, Ag: 0000, CC: 00000-0" className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
              </div>
            </div>

            <DialogFooter className="pt-4 gap-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="text-xs h-10 border-slate-200 dark:border-slate-700">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="bg-sky-600 hover:bg-sky-500 text-white font-black text-xs h-10 px-8 rounded-xl shadow-md">Salvar Perfil Profissional</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}