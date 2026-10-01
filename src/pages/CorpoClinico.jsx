import React, { useState, useMemo } from 'react';
import { useAppData } from '@/lib/useAppData';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Users, UserPlus, Search, CheckCircle2, 
  Clock, DollarSign, Edit3, KeyRound, Send, RefreshCw, Ban, 
  UserCheck, MessageSquare, Shield, UserCog, BadgeCheck, Eye, EyeOff,
  HeartPulse, Plus, CreditCard, Landmark, Calendar, AlertTriangle, Building2, Check, ToggleLeft, ToggleRight, Power, Trash2, Settings, Save, Lock, Hospital
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
  const { professionals, sectors, units, selectedUnitId, company, isManager, syncGlobalData } = useAppData();

  const [activeTab, setActiveTab] = useState('ativos'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todas');
  
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
    monthly_salary: 0,
    unit_rates: {}, // NOVO: Matriz de valores por unidade
    coop_tax_rate: 0, pix_type: 'CPF',
    pix_key: '', bank_info: '', password: '',
    document_expiry: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
    authorized_sectors: [],
    allowed_unit_ids: [] 
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
      name: '', username: '', category: allCategories[0]?.id || 'medico', document: '',
      registration_id: generatedMatricula, main_sector: sectors[0]?.name || 'UTI Geral',
      specialty: '', rqe: '', cbo: '', cpf: '', email: '', phone: '', birth_date: '',
      unit_id: selectedUnitId || (units[0]?.id || 'unit_h1'),
      status: 'ativo', app_role: 'assistencial', 
      remuneration_type: 'plantao', monthly_salary: 0, unit_rates: {},
      coop_tax_rate: 0, pix_type: 'CPF',
      pix_key: '', bank_info: '', password: '',
      document_expiry: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      authorized_sectors: (sectors || []).map(s => String(s.id)),
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
    const authSectors = meta.authorized_sectors || (sectors || []).map(s => String(s.id));
    const profStatus = prof.status || meta.status || 'ativo';

    const savedUnits = meta.allowed_unit_ids || prof.unit_ids || (prof.unit_id ? [String(prof.unit_id)] : [String(units[0]?.id || '')]);

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
      unit_id: prof.unit_id || selectedUnitId,
      status: profStatus,
      app_role: meta.app_role || prof.app_role || 'assistencial',
      remuneration_type: meta.remuneration_type || 'plantao',
      monthly_salary: safeNumber(meta.monthly_salary !== undefined ? meta.monthly_salary : prof.monthly_salary, 0),
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
      const current = prev.authorized_sectors || [];
      if (current.includes(secId)) {
        return { ...prev, authorized_sectors: current.filter(id => id !== secId) };
      } else {
        return { ...prev, authorized_sectors: [...current, secId] };
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
    const rawPhone = formData.phone;
    const cleanPhone = String(rawPhone || '').replace(/\D/g, '');
    if (!cleanPhone) { alert('Preencha o campo Telefone / WhatsApp para enviar a notificação.'); return; }

    const phoneWithDDI = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const loginUser = formData.username || formData.email || '';
    const pass = formData.password ? formData.password : '(sua senha cadastrada)';
    const siteUrl = window.location.origin;

    const message = `*ScaleMedic - Gestão Hospitalar* 🏥\n\nOlá, *${formData.name}*!\nSeu cadastro profissional foi atualizado.\n\nAcesse sua escala com as credenciais abaixo:\n🌐 *Link:* ${siteUrl}/login\n👤 *Usuário:* ${loginUser}\n🔑 *Senha:* ${pass}\n\n_Ao acessar, o sistema solicitará que cadastre uma senha segura e pessoal._`;
    window.open(`https://api.whatsapp.com/send?phone=${phoneWithDDI}&text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleSaveProfessional = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (formData.allowed_unit_ids.length === 0) {
      alert('Selecione pelo menos um hospital/unidade para o profissional.');
      return;
    }

    setSubmitting(true);
    try {
      const cleanUsername = (formData.username || formData.name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.');
      const finalEmail = formData.email.trim() ? formData.email.trim().toLowerCase() : `${cleanUsername}.${Date.now()}@scalemedic.local`;

      const richMeta = {
        username: cleanUsername, category: formData.category, app_role: formData.app_role,
        main_sector: formData.main_sector, specialty: formData.specialty, rqe: formData.rqe, cbo: formData.cbo,
        registration_id: formData.registration_id, coop_tax_rate: safeNumber(formData.coop_tax_rate),
        remuneration_type: formData.remuneration_type, 
        monthly_salary: safeNumber(formData.monthly_salary),
        unit_rates: formData.unit_rates, // MATRIZ SALVA!
        pix_type: formData.pix_type, bank_info: formData.bank_info.trim(), pix_key: formData.pix_key.trim(),
        document_expiry: formData.document_expiry, status: formData.status,
        authorized_sectors: formData.authorized_sectors, allowed_unit_ids: formData.allowed_unit_ids,
        birth_date: formData.birth_date, cpf: formData.cpf
      };

      const profPayload = {
        company_id: company?.id || 'cmp_principal', 
        unit_id: formData.allowed_unit_ids[0], 
        unit_ids: formData.allowed_unit_ids,
        name: formData.name.trim(), document: formData.document.trim(), 
        specialty: formData.specialty.trim() || formData.main_sector,
        rqe: formData.rqe.trim(), cbo: formData.cbo.trim(), cpf: formData.cpf.trim(), 
        email: finalEmail, phone: formData.phone.trim(), status: formData.status, 
        remuneration_type: formData.remuneration_type,
        monthly_salary: safeNumber(formData.monthly_salary),
        document_expiry: formData.document_expiry, birth_date: formData.birth_date,
        data: richMeta 
      };

      let savedProf = await autoHealingSave(editingProf?.id, profPayload);
      const savedProfId = savedProf?.id || editingProf?.id;

      if (savedProfId) {
        try { window.localStorage.setItem(`prof_meta_${savedProfId}`, JSON.stringify(richMeta)); } catch {}
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
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400"><Users className="w-4 h-4" /> Gestão de Pessoal & Matrícula</div>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black">Corpo Clínico & Matrículas</h2>
          <p className="text-xs text-slate-300">Cadastro de profissionais, matriz de valores por unidade e liberação de acessos.</p>
        </div>
        {isManager && (<Button onClick={handleOpenNew} className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-lg gap-1.5 shrink-0 cursor-pointer"><UserPlus className="w-4 h-4" /> Novo Profissional</Button>)}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button onClick={() => setActiveTab('ativos')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'ativos' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>Ativos ({counts.ativos})</button>
          <button onClick={() => setActiveTab('pendentes')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'pendentes' ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>Pendentes ({counts.pendentes})</button>
          <button onClick={() => setActiveTab('inativos')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'inativos' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>Inativos ({counts.inativos})</button>
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
          const profStatus = prof.status || meta.status || 'ativo';
          const authSectorsCount = (meta.authorized_sectors || (sectors || []).map(s => String(s.id))).length;
          const profUnits = meta.allowed_unit_ids || prof.unit_ids || (prof.unit_id ? [String(prof.unit_id)] : []);
          const profUnitsNames = units.filter(u => profUnits.includes(String(u.id))).map(u => u.name).join(', ') || 'Nenhuma unidade vinculada';

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
                  <Button size="sm" variant="outline" onClick={() => window.open(`https://wa.me/55${prof.phone.replace(/\D/g, '')}`, '_blank')} className="h-9 px-3 rounded-xl border-emerald-300 text-emerald-600 hover:bg-emerald-50 cursor-pointer">
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
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
                      onChange={(e) => {
                        const id = String(u.id);
                        if (e.target.checked) setFormData({ ...formData, allowed_unit_ids: [...formData.allowed_unit_ids, id] });
                        else setFormData({ ...formData, allowed_unit_ids: formData.allowed_unit_ids.filter(i => i !== id) });
                      }}
                      className="w-4 h-4 text-sky-600 rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{u.name}</span>
                  </label>
                ))}
              </div>
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
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold">Salário Fixo Mensal (R$)</Label>
                    <Input type="number" step="0.01" value={formData.monthly_salary} onChange={e => setFormData({...formData, monthly_salary: e.target.value})} className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
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
                <Send className="w-4 h-4" /> Enviar Credenciais via WhatsApp
              </Button>
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