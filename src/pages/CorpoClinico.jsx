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
  HeartPulse, Plus, CreditCard, Landmark, Calendar, AlertTriangle, Building2, Check, ToggleLeft, ToggleRight, Power
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
    registration_id: '', main_sector: '', specialty: '', cbo: '',
    cpf: '', email: '', phone: '', unit_id: '',
    status: 'ativo', app_role: 'assistencial', remuneration_type: 'mensal',
    hourly_rate: 120, daily_rate: 1500, monthly_salary: 1672,
    monthly_work_hours: 220, coop_tax_rate: 0, pix_type: 'CPF',
    pix_key: '', bank_info: '', password: '',
    document_expiry: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
    authorized_sectors: [],
    // NOVO: Array para armazenar as unidades permitidas
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
      name: '', username: '', category: 'medico', document: '',
      registration_id: generatedMatricula, main_sector: sectors[0]?.name || 'UTI Geral',
      specialty: '', cbo: '', cpf: '', email: '', phone: '',
      unit_id: selectedUnitId || (units[0]?.id || 'unit_h1'),
      status: 'ativo', app_role: 'assistencial', remuneration_type: 'mensal',
      hourly_rate: 120, daily_rate: 1500, monthly_salary: 1672,
      monthly_work_hours: 220, coop_tax_rate: 0, pix_type: 'CPF',
      pix_key: '', bank_info: '', password: '',
      document_expiry: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      authorized_sectors: (sectors || []).map(s => String(s.id)),
      // NOVO: Inicia com a unidade atual selecionada por padrão
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

    const remunType = meta.remuneration_type || prof.remuneration_type || 'mensal';
    const sal = meta.monthly_salary !== undefined ? meta.monthly_salary : (prof.monthly_salary !== undefined ? prof.monthly_salary : 1672);
    const hourly = meta.hourly_rate !== undefined ? meta.hourly_rate : (prof.hourly_rate !== undefined ? prof.hourly_rate : 120);
    const daily = meta.daily_rate !== undefined ? meta.daily_rate : (prof.daily_rate !== undefined ? prof.daily_rate : 1500);

    // NOVO: Puxa as unidades salvas ou define a padrão
    const savedUnits = meta.allowed_unit_ids || prof.unit_ids || (prof.unit_id ? [String(prof.unit_id)] : [String(units[0]?.id || '')]);

    setFormData({
      name: prof.name || prof.full_name || '',
      username: meta.username || prof.username || '',
      category: meta.category || prof.category || 'medico',
      document: prof.document || prof.registration_number || '',
      registration_id: generatedMatricula,
      main_sector: meta.main_sector || prof.specialty || sectors[0]?.name || 'UTI Geral',
      specialty: prof.specialty || meta.specialty || '',
      cbo: meta.cbo || prof.cbo || '',
      cpf: prof.cpf || '',
      email: prof.email || '',
      phone: prof.phone || '',
      unit_id: prof.unit_id || selectedUnitId,
      status: profStatus,
      app_role: meta.app_role || prof.app_role || 'assistencial',
      remuneration_type: remunType,
      hourly_rate: safeNumber(hourly, 120),
      daily_rate: safeNumber(daily, 1500),
      monthly_salary: safeNumber(sal, 1672),
      monthly_work_hours: safeNumber(meta.monthly_work_hours ?? prof.monthly_work_hours, 220),
      coop_tax_rate: safeNumber(meta.coop_tax_rate ?? prof.coop_tax_rate, 0),
      pix_type: meta.pix_type || 'CPF',
      pix_key: meta.pix_key || '',
      bank_info: meta.bank_info || '',
      password: '',
      document_expiry: expiry,
      authorized_sectors: authSectors,
      allowed_unit_ids: savedUnits // NOVO: Mapeia o estado
    });
    setModalOpen(true);
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
    if (!cleanPhone) { alert('Preencha o campo Telefone / WhatsApp para enviar a notificação.'); return; }

    const phoneWithDDI = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const loginUser = formData.username || formData.email || '';
    const pass = formData.password ? formData.password : '(sua senha cadastrada)';
    const siteUrl = window.location.origin;

    const message = `*ScaleMedic - Gestão Hospitalar* 🏥\n\nOlá, *${formData.name}*!\nSeu cadastro profissional foi atualizado.\n\nAcesse sua escala com as credenciais abaixo:\n🌐 *Link:* ${siteUrl}/login\n👤 *Usuário:* ${loginUser}\n🔑 *Senha:* ${pass}\n\n_Ao acessar, verifique sua grade e fique atento às notificações do Mural._`;
    window.open(`https://api.whatsapp.com/send?phone=${phoneWithDDI}&text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleSaveProfessional = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    // VALIDAÇÃO MÚLTIPLAS UNIDADES
    if (formData.allowed_unit_ids.length === 0) {
      alert('Selecione pelo menos um hospital/unidade para o profissional.');
      return;
    }

    setSubmitting(true);
    try {
      const cleanUsername = (formData.username || formData.name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.');

      const richMeta = {
        username: cleanUsername, category: formData.category, app_role: formData.app_role,
        main_sector: formData.main_sector, specialty: formData.specialty, cbo: formData.cbo,
        registration_id: formData.registration_id, coop_tax_rate: safeNumber(formData.coop_tax_rate),
        daily_rate: safeNumber(formData.daily_rate), monthly_salary: safeNumber(formData.monthly_salary),
        monthly_work_hours: safeNumber(formData.monthly_work_hours), pix_type: formData.pix_type,
        pix_key: formData.pix_key.trim(), bank_info: formData.bank_info.trim(),
        remuneration_type: formData.remuneration_type, hourly_rate: safeNumber(formData.hourly_rate),
        document_expiry: formData.document_expiry, status: formData.status,
        authorized_sectors: formData.authorized_sectors,
        allowed_unit_ids: formData.allowed_unit_ids // SALVANDO AS UNIDADES NO META
      };

      const profPayload = {
        company_id: company?.id || 'cmp_principal', 
        unit_id: formData.allowed_unit_ids[0], // A primeira unidade age como unidade padrão legacy
        unit_ids: formData.allowed_unit_ids, // SALVANDO AS UNIDADES NO BANCO
        name: formData.name.trim(), document: formData.document.trim(), specialty: formData.specialty.trim() || formData.main_sector,
        cbo: formData.cbo.trim(), cpf: formData.cpf.trim(), email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(), status: formData.status, remuneration_type: formData.remuneration_type,
        hourly_rate: safeNumber(formData.hourly_rate), monthly_salary: safeNumber(formData.monthly_salary),
        daily_rate: safeNumber(formData.daily_rate), document_expiry: formData.document_expiry
      };

      let savedProf = await autoHealingSave(editingProf?.id, profPayload);
      const savedProfId = savedProf?.id || editingProf?.id;

      if (savedProfId) {
        try { window.localStorage.setItem(`prof_meta_${savedProfId}`, JSON.stringify(richMeta)); } catch {}
      }

      // Sincronização Inteligente com a Tabela Users do Supabase para o Login Múltiplas Unidades
      const userEmail = (formData.email || `${cleanUsername}@scalemedic.local`).toLowerCase().trim();
      const userDataPayload = {
        company_id: company?.id || 'cmp_principal',
        selected_unit_id: formData.allowed_unit_ids[0],
        allowed_unit_ids: formData.allowed_unit_ids, // Garante o login nas múltiplas unidades
        app_role: formData.app_role,
        registration_code: formData.registration_id,
        is_active: formData.status === 'ativo',
        status: formData.status
      };

      try {
        const { data: existingUsers } = await supabase.from('users').select('*').eq('email', userEmail);
        if (existingUsers && existingUsers.length > 0) {
          await supabase.from('users').update({
            username: cleanUsername,
            full_name: formData.name,
            is_active: formData.status === 'ativo',
            data: { ...(existingUsers[0].data || {}), ...userDataPayload }
          }).eq('id', existingUsers[0].id);
        } else {
          // Só insere senha se for usuário novo (ou se digitar uma nova)
          const finalPass = formData.password || '123456';
          await supabase.from('users').insert([{
            email: userEmail,
            username: cleanUsername,
            password: finalPass,
            full_name: formData.name,
            is_active: formData.status === 'ativo',
            data: userDataPayload
          }]);
        }
      } catch (uErr) { console.warn('Aviso na sincronização de usuário:', uErr); }

      setModalOpen(false); resetForm(); await syncGlobalData(); alert('Profissional e matriz de permissões salvos com sucesso!');
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSubmitting(false);
    }
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
          <p className="text-xs text-slate-300">Cadastro de profissionais, validade de credenciais, repasse PIX e matriz de habilitação por setor.</p>
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
          
          const remunType = meta.remuneration_type || prof.remuneration_type || 'mensal';
          let remunValue = 1672;
          let remunLabel = '/ Mês Fixo';

          if (remunType === 'hora') {
            remunValue = safeNumber(meta.hourly_rate !== undefined ? meta.hourly_rate : prof.hourly_rate, 120);
            remunLabel = '/ Hora';
          } else if (remunType === 'diaria') {
            remunValue = safeNumber(meta.daily_rate !== undefined ? meta.daily_rate : prof.daily_rate, 1500);
            remunLabel = '/ Plantão';
          } else {
            remunValue = safeNumber(meta.monthly_salary !== undefined ? meta.monthly_salary : prof.monthly_salary, 1672);
            remunLabel = '/ Mês Fixo';
          }

          const expiry = prof.document_expiry || meta.document_expiry || '';
          
          let diffDays = null;
          let isExpired = false;
          let isNearExpiry = false;

          if (expiry) {
            const todayObj = new Date();
            todayObj.setHours(0, 0, 0, 0);

            const [exY, exM, exD] = expiry.split('-').map(Number);
            const expiryObj = new Date(exY, exM - 1, exD);
            expiryObj.setHours(0, 0, 0, 0);

            const diffTime = expiryObj.getTime() - todayObj.getTime();
            diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            isExpired = diffDays < 0;
            isNearExpiry = diffDays >= 0 && diffDays <= 30;
          }

          const profStatus = prof.status || meta.status || 'ativo';
          const authSectorsCount = (meta.authorized_sectors || (sectors || []).map(s => String(s.id))).length;

          // Exibição Limpa de Múltiplos Hospitais no Card
          const profUnits = meta.allowed_unit_ids || prof.unit_ids || (prof.unit_id ? [String(prof.unit_id)] : []);
          const profUnitsNames = units.filter(u => profUnits.includes(String(u.id))).map(u => u.name).join(', ') || 'Nenhuma unidade vinculada';

          return (
            <Card key={prof.id} className={`p-5 rounded-3xl border-2 transition-all flex flex-col justify-between space-y-4 shadow-sm bg-white dark:bg-slate-900 ${
              isExpired 
                ? 'border-rose-400 bg-rose-50/40 dark:bg-rose-950/20' 
                : isNearExpiry 
                ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20' 
                : 'border-slate-200 dark:border-slate-800'
            }`}>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase border bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/30">{catObj?.label}</span>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white mt-1.5">{prof.name}</h3>
                    <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">ID: {meta.registration_id || prof.registration_id || 'MAT-XXXX'}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                    profStatus === 'ativo' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {profStatus}
                  </span>
                </div>
                
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between"><span>Conselho:</span><strong>{prof.document || '—'}</strong></div>
                  <div className="flex justify-between"><span>Especialidade:</span><strong className="text-slate-900 dark:text-white truncate max-w-[140px]">{prof.specialty || meta.specialty || 'Geral'}</strong></div>
                  
                  {/* UNIDADES MULTIPLAS LISTADAS AQUI NO CARD */}
                  <div className="flex justify-between items-center pt-1">
                    <span>Hospitais de Acesso:</span>
                    <strong className="text-[10px] text-sky-600 dark:text-sky-400 truncate max-w-[140px]" title={profUnitsNames}>
                      {profUnitsNames}
                    </strong>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Habilitação Setores:</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {authSectorsCount} de {sectors.length} setor(es)
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Validade Credencial:</span>
                    <div className="flex items-center gap-1.5">
                      <strong className={`font-mono ${isExpired ? 'text-rose-600 font-black' : isNearExpiry ? 'text-amber-600 dark:text-amber-400 font-black' : 'text-slate-700 dark:text-slate-300'}`}>
                        {expiry ? expiry.split('-').reverse().join('/') : 'Não informada'}
                      </strong>
                      {isExpired && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-600 text-white animate-pulse">
                          VENCIDO
                        </span>
                      )}
                      {isNearExpiry && !isExpired && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-white animate-pulse">
                          {diffDays === 0 ? 'VENCE HOJE' : `VENCE EM ${diffDays}D`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" /> Remuneração
                  </span>
                  <span className="font-black text-sm text-emerald-600 dark:text-emerald-300 font-mono">
                    {formatCurrency(remunValue)} <span className="text-[9px] font-bold opacity-70">{remunLabel}</span>
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleOpenEdit(prof)} className="flex-1 text-xs h-9 font-bold gap-1 rounded-xl cursor-pointer">
                  <Edit3 className="w-3.5 h-3.5 text-sky-600" /> Editar Perfil
                </Button>

                {isManager && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleToggleStatusQuick(prof)}
                    title={profStatus === 'ativo' ? 'Desativar profissional' : 'Ativar profissional'}
                    className={`h-9 px-3 text-xs font-bold rounded-xl cursor-pointer gap-1 ${
                      profStatus === 'ativo' 
                        ? 'border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' 
                        : 'border-slate-300 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    {profStatus === 'ativo' ? 'Desativar' : 'Ativar'}
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

      {/* MODAL DE CADASTRO/EDIÇÃO COMPLETO */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
          <DialogHeader><DialogTitle className="text-base font-black flex items-center gap-2 text-slate-900 dark:text-white"><UserCog className="w-5 h-5 text-sky-600" /> {editingProf ? 'Editar Perfil Profissional & Acesso' : 'Cadastrar Novo Profissional'}</DialogTitle></DialogHeader>

          <form onSubmit={handleSaveProfessional} className="space-y-5 py-2 text-xs">
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-slate-400" />
                <Label className="text-xs font-black uppercase text-slate-500">Categoria Profissional *</Label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {allCategories.map(cat => (
                  <div key={cat.id} onClick={() => setFormData({ ...formData, category: cat.id })} className={`p-2 rounded-xl border cursor-pointer text-center transition-all ${formData.category === cat.id ? 'border-sky-600 bg-sky-50 dark:bg-sky-900/20 font-black shadow-sm ring-1 ring-sky-600 text-sky-700 dark:text-sky-400' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-white'}`}>
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

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-xs uppercase text-slate-700 dark:text-slate-300">
                  <Building2 className="w-4 h-4 text-sky-600" /> Matriz de Habilitação por Setor Hospitalar
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {formData.authorized_sectors.length} de {sectors.length} liberados
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Selecione em quais setores o profissional possui autorização e competência para atuar nas escalas:
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {(sectors || []).map(sec => {
                  const isAuth = formData.authorized_sectors.includes(String(sec.id));
                  return (
                    <div 
                      key={sec.id}
                      onClick={() => handleToggleSectorAuth(String(sec.id))}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isAuth 
                          ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-200 font-bold' 
                          : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="text-xs truncate">{sec.name}</span>
                      <div className={`w-5 h-5 rounded-lg flex items-center justify-center border ${isAuth ? 'bg-sky-600 border-sky-600 text-white' : 'border-slate-300'}`}>
                        {isAuth && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">Nome Completo Oficial *</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" required />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">Especialidade / Atuação *</Label>
                  <Input value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})} placeholder="Ex: Cirurgião Geral" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">Matrícula ID (Gerada Auto) *</Label>
                  <Input value={formData.registration_id} onChange={e => setFormData({...formData, registration_id: e.target.value})} className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono font-bold text-sky-600" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">CPF *</Label>
                  <Input value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} placeholder="000.000.000-00" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">Número de Registro no Conselho *</Label>
                  <Input value={formData.document} onChange={e => setFormData({...formData, document: e.target.value})} placeholder="Ex: 2155 - RJ" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-900 dark:text-slate-200">Validade Credencial *</Label>
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
                <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="email@exemplo.com" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/60 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-black text-xs text-sky-900 dark:text-sky-200 uppercase tracking-wider">
                  <KeyRound className="w-4 h-4 text-sky-600" /> Credenciais de Login & Acesso
                </div>
                <div className="flex items-center gap-1.5">
                  <Button type="button" size="sm" variant="outline" onClick={() => setFormData(p => ({...p, password: 'Mudar@123'}))} className="h-7 text-[10px] font-bold border-amber-300 text-amber-700 hover:bg-amber-50 cursor-pointer">Resetar Senha</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setFormData(p => ({...p, password: 'S@ude'+Math.floor(1000+Math.random()*9000)}))} className="h-7 text-[10px] font-bold border-sky-300 text-sky-600 hover:bg-sky-50 cursor-pointer"><RefreshCw className="w-3 h-3 mr-1" /> Gerar Aleatória</Button>
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

            {/* O CHECKBOX MAGNÍFICO DE MÚLTIPLOS HOSPITAIS (O SEGREDO ESTÁ AQUI!) */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div>
                <Label className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-sky-600" /> Hospitais Liberados (Múltiplas Unidades)
                </Label>
                <p className="text-[11px] text-slate-500 mt-1">Selecione em quais unidades este profissional pode ser escalado e ter acesso pelo aplicativo.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {units.map(u => (
                  <label key={u.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    formData.allowed_unit_ids.includes(String(u.id)) 
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/30' 
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:border-sky-300'
                  }`}>
                    <input
                      type="checkbox"
                      checked={formData.allowed_unit_ids.includes(String(u.id))}
                      onChange={(e) => {
                        const id = String(u.id);
                        if (e.target.checked) {
                          setFormData({ ...formData, allowed_unit_ids: [...formData.allowed_unit_ids, id] });
                        } else {
                          setFormData({ ...formData, allowed_unit_ids: formData.allowed_unit_ids.filter(i => i !== id) });
                        }
                      }}
                      className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{u.name}</span>
                  </label>
                ))}
              </div>
              {formData.allowed_unit_ids.length === 0 && (
                <p className="text-[10px] font-bold text-rose-500 animate-pulse">⚠️ Selecione pelo menos uma unidade.</p>
              )}
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-3">
              <div className="flex items-center gap-2 font-black text-xs uppercase text-emerald-700 dark:text-emerald-400">
                <DollarSign className="w-4 h-4" /> Faturamento, PIX & Conta Bancária
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold">Regime Contratual</Label>
                  <Select value={formData.remuneration_type} onValueChange={v => setFormData({...formData, remuneration_type: v})}>
                    <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[99999]">
                      <SelectItem value="hora">Horista (R$ / Hora)</SelectItem>
                      <SelectItem value="diaria">Plantonista (R$ / Diária)</SelectItem>
                      <SelectItem value="mensal">Fixo Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {formData.remuneration_type === 'hora' && (<div className="space-y-1"><Label className="text-[11px] font-bold">Valor da Hora (R$)</Label><Input type="number" step="0.01" value={formData.hourly_rate} onChange={e => setFormData({...formData, hourly_rate: e.target.value})} className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" /></div>)}
                {formData.remuneration_type === 'diaria' && (<div className="space-y-1"><Label className="text-[11px] font-bold">Valor do Plantão (R$)</Label><Input type="number" step="0.01" value={formData.daily_rate} onChange={e => setFormData({...formData, daily_rate: e.target.value})} className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" /></div>)}
                {formData.remuneration_type === 'mensal' && (<div className="space-y-1"><Label className="text-[11px] font-bold">Salário (R$)</Label><Input type="number" step="0.01" value={formData.monthly_salary} onChange={e => setFormData({...formData, monthly_salary: e.target.value})} className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" /></div>)}

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
    </div>
  );
}