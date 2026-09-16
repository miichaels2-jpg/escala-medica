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
  HeartPulse, Plus, Building2, IdCard
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
    name: '',
    username: '', 
    category: 'medico',
    document: '',
    registration_id: '',
    main_sector: '',
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
    const generatedMatricula = `MAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setFormData({
      name: '',
      username: '',
      category: 'medico',
      document: '',
      registration_id: generatedMatricula,
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

    const generatedMatricula = meta.registration_id || prof.registration_id || `MAT-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    setFormData({
      name: prof.name || prof.full_name || '',
      username: meta.username || prof.username || defaultUsername,
      category: meta.category || prof.category || 'medico',
      document: prof.document || prof.registration_number || '',
      registration_id: generatedMatricula,
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
    try { window.localStorage.setItem('scale_custom_cats', JSON.stringify(updated)); } catch {}

    setFormData(prev => ({ ...prev, category: newId }));
    setNewCatData({ label: '', council: 'Registro' });
    setNewCatModalOpen(false);
  };

  const handleSaveProfessional = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmitting(true);
    try {
      const cleanUsername = (formData.username || formData.name)
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '.')
        .replace(/\.+/g, '.');

      const richMeta = {
        username: cleanUsername,
        category: formData.category,
        app_role: formData.app_role,
        main_sector: formData.main_sector,
        registration_id: formData.registration_id,
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
        specialty: formData.main_sector,
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
        try { window.localStorage.setItem(`prof_meta_${savedProfId}`, JSON.stringify(richMeta)); } catch {}
      }

      setModalOpen(false);
      resetForm();
      await syncGlobalData();
      alert('Profissional salvo com sucesso!');
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
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
        if (!matchesName && !matchesDoc) return false;
      }
      return true;
    });
  }, [professionals, activeTab, categoryFilter, searchQuery]);

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400"><Users className="w-4 h-4" /> Gestão de Pessoal & Matrícula ID</div>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black">Corpo Clínico & Matrículas</h2>
          <p className="text-xs text-slate-300">Cadastro com ID gerado automaticamente, dados de PIX e regras de remuneração.</p>
        </div>
        {isManager && (<Button onClick={handleOpenNew} className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-lg gap-1.5 shrink-0"><UserPlus className="w-4 h-4" /> Novo Profissional</Button>)}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button onClick={() => setActiveTab('ativos')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'ativos' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>Ativos ({counts.ativos})</button>
          <button onClick={() => setActiveTab('pendentes')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'pendentes' ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>Pendentes ({counts.pendentes})</button>
          <button onClick={() => setActiveTab('inativos')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'inativos' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>Inativos ({counts.inativos})</button>
        </div>
        <div className="flex items-center gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="h-9 w-44 text-xs font-semibold"><SelectValue placeholder="Categoria" /></SelectTrigger><SelectContent><SelectItem value="todas">Todas Categorias</SelectItem>{allCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent></Select>
          <div className="relative w-full sm:w-56"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input placeholder="Buscar nome..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9 text-xs" /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredList.map(prof => {
          const meta = getProfMeta(prof);
          const catId = meta.category || prof.category || 'medico';
          const catObj = allCategories.find(c => c.id === catId) || allCategories[0];
          const matricula = meta.registration_id || prof.registration_id || 'MAT-2026-XXXX';

          return (
            <Card key={prof.id} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase border bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30">{catObj?.label}</span>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white mt-1">{prof.name}</h3>
                    <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">ID: {matricula}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border bg-emerald-500/10 text-emerald-700 border-emerald-500/30">{prof.status || 'Ativo'}</span>
                </div>
                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between"><span>Conselho:</span><strong>{prof.document || '—'}</strong></div>
                  <div className="flex justify-between"><span>Setor Principal:</span><strong className="text-slate-900 dark:text-white">{meta.main_sector || prof.specialty || 'Geral'}</strong></div>
                  <div className="flex justify-between"><span>PIX:</span><strong className="text-sky-600 font-mono">{meta.pix_key || 'Não cadastrado'}</strong></div>
                  <div className="flex justify-between"><span>Base Remuneração:</span><strong className="text-emerald-600">{formatCurrency(prof.hourly_rate || meta.daily_rate || meta.monthly_salary || 120)}</strong></div>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleOpenEdit(prof)} className="flex-1 text-xs h-8 font-bold gap-1"><Edit3 className="w-3.5 h-3.5 text-sky-600" /> Editar Perfil</Button>
                {prof.phone && (<Button size="sm" variant="outline" onClick={() => handleSendWhatsApp(prof)} className="h-8 px-2.5 border-emerald-300 text-emerald-600"><MessageSquare className="w-4 h-4" /></Button>)}
              </div>
            </Card>
          );
        })}
      </div>

      {/* MODAL DE CADASTRO/EDIÇÃO */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-base font-black flex items-center gap-2"><UserCog className="w-5 h-5 text-sky-600" /> {editingProf ? 'Editar Perfil & Matrícula' : 'Novo Cadastro Profissional'}</DialogTitle></DialogHeader>

          <form onSubmit={handleSaveProfessional} className="space-y-4 py-2 text-xs">
            <div className="p-3.5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black uppercase text-sky-900 dark:text-sky-200 flex items-center gap-1.5"><HeartPulse className="w-4 h-4 text-sky-600" /> Categoria *</Label>
                <Button type="button" size="sm" onClick={() => setNewCatModalOpen(true)} className="h-7 text-[10px] font-black bg-sky-600 text-white px-2.5 rounded-xl gap-1"><Plus className="w-3 h-3" /> Adicionar Categoria</Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {allCategories.map(cat => (
                  <div key={cat.id} onClick={() => setFormData({ ...formData, category: cat.id })} className={`p-2 rounded-xl border cursor-pointer text-center transition-all ${formData.category === cat.id ? 'border-sky-600 bg-white dark:bg-slate-900 font-black ring-1 ring-sky-600 text-sky-600' : 'bg-slate-50 dark:bg-slate-950 text-slate-700'}`}>
                    <span className="text-[11px] block truncate">{cat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-2"><Label className="text-xs font-bold">Nome Completo *</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-9" /></div>
              <div className="space-y-1"><Label className="text-xs font-bold">Matrícula ID</Label><Input value={formData.registration_id} onChange={e => setFormData({...formData, registration_id: e.target.value})} className="h-9 font-mono font-bold" /></div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Setor de Atuação *</Label>
                <Select value={formData.main_sector} onValueChange={v => setFormData({ ...formData, main_sector: v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Setor..." /></SelectTrigger>
                  <SelectContent>{sectors.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}<SelectItem value="UTI Geral">UTI Geral</SelectItem></SelectContent>
                </Select>
              </div>

              <div className="space-y-1"><Label className="text-xs font-bold">Registro Conselho *</Label><Input value={formData.document} onChange={e => setFormData({...formData, document: e.target.value})} placeholder="Ex: 2155-RJ" className="h-9 font-mono" /></div>
              <div className="space-y-1"><Label className="text-xs font-bold">Telefone *</Label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="(21) 99999-9999" className="h-9" /></div>
            </div>

            {/* REPASSE PIX */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2 font-black text-xs uppercase text-slate-900 dark:text-white"><CreditCard className="w-4 h-4 text-sky-600" /> Dados para Repasse & PIX</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Tipo Chave PIX</Label>
                  <Select value={formData.pix_type} onValueChange={v => setFormData({...formData, pix_type: v})}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CPF">CPF</SelectItem><SelectItem value="CNPJ">CNPJ</SelectItem><SelectItem value="Email">E-mail</SelectItem><SelectItem value="Telefone">Telefone</SelectItem><SelectItem value="Aleatoria">Aleatória</SelectItem></SelectContent></Select>
                </div>
                <div className="space-y-1 sm:col-span-2"><Label className="text-[11px] font-bold">Chave PIX</Label><Input value={formData.pix_key} onChange={e => setFormData({...formData, pix_key: e.target.value})} placeholder="Insira a chave PIX..." className="h-9" /></div>
              </div>
            </div>

            {/* REMUNERAÇÃO */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2 font-black text-xs uppercase text-slate-900 dark:text-white"><DollarSign className="w-4 h-4 text-emerald-600" /> Remuneração & Faturamento</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Regime</Label>
                  <Select value={formData.remuneration_type} onValueChange={v => setFormData({...formData, remuneration_type: v})}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="hora">Horista (R$/hora)</SelectItem><SelectItem value="diaria">Plantonista (R$/plantão)</SelectItem><SelectItem value="mensal">Mensalista</SelectItem></SelectContent></Select>
                </div>
                {formData.remuneration_type === 'hora' && (<div className="space-y-1"><Label className="text-[11px] font-bold">Valor da Hora (R$)</Label><Input type="number" step="0.01" value={formData.hourly_rate} onChange={e => setFormData({...formData, hourly_rate: e.target.value})} className="h-9" /></div>)}
                {formData.remuneration_type === 'diaria' && (<div className="space-y-1"><Label className="text-[11px] font-bold">Valor do Plantão (R$)</Label><Input type="number" step="0.01" value={formData.daily_rate} onChange={e => setFormData({...formData, daily_rate: e.target.value})} className="h-9" /></div>)}
                {formData.remuneration_type === 'mensal' && (<div className="space-y-1"><Label className="text-[11px] font-bold">Salário (R$)</Label><Input type="number" step="0.01" value={formData.monthly_salary} onChange={e => setFormData({...formData, monthly_salary: e.target.value})} className="h-9" /></div>)}
                <div className="space-y-1"><Label className="text-[11px] font-bold">Retenção PJ/Coop (%)</Label><Input type="number" step="0.1" value={formData.coop_tax_rate} onChange={e => setFormData({...formData, coop_tax_rate: e.target.value})} placeholder="Ex: 5" className="h-9" /></div>
              </div>
            </div>

            <DialogFooter className="pt-3 gap-2"><Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="text-xs h-9">Cancelar</Button><Button type="submit" disabled={submitting} className="bg-sky-600 text-white font-bold text-xs h-9 px-5">Salvar Perfil</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}