import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  ShieldCheck, 
  Building2, 
  Plus, 
  Edit3, 
  Loader2, 
  Clock, 
  Mail, 
  Phone, 
  User, 
  CheckCircle2, 
  PlusCircle,
  Share2,
  RotateCcw,
  DollarSign,
  Landmark,
  CreditCard,
  LayoutGrid,
  List,
  MessageCircle,
  Search,
  X,
  UserCheck
} from 'lucide-react';

const SYSTEM_MODULES = [
  { id: 'minha_escala', label: 'Minha Escala / Agenda' },
  { id: 'trocas_plantao', label: 'Trocas e Doações' },
  { id: 'mural_oportunidades', label: 'Mural de Oportunidades' },
  { id: 'meus_repasses', label: 'Meus Repasses (Extrato Financeiro)' },
  { id: 'escalas_geral', label: 'Visualizar Escala Geral' },
  { id: 'relatorios_basicos', label: 'Relatórios Operacionais' }
];

const DEFAULT_SECTORS = [
  { id: 'sec_uti_adulto', name: 'UTI Adulto', specialty: 'Medicina Intensiva' },
  { id: 'sec_emergencia', name: 'Emergência / Pronto-Socorro', specialty: 'Emergência' },
  { id: 'sec_bloco_cirurgico', name: 'Bloco Cirúrgico', specialty: 'Cirurgia Geral' },
  { id: 'sec_cardiologia', name: 'Cardiologia / UCO', specialty: 'Cardiologia' },
  { id: 'sec_pediatria', name: 'Pediatria e Pronto Atendimento', specialty: 'Pediatria' },
  { id: 'sec_clinica_medica', name: 'Enfermaria / Clínica Médica', specialty: 'Clínica Médica' }
];

function computeDefaultPassword(birthDateStr, fullName) {
  if (!birthDateStr) return '123456';
  const parts = birthDateStr.split('-');
  if (parts.length !== 3) return '123456';
  const [yyyy, mm, dd] = parts;
  const initial = (fullName || 'p').trim().charAt(0).toLowerCase();
  return `${dd}${mm}${yyyy}${initial}`;
}

export default function CorpoClinico() {
  const { user, company } = useAppData();
  const [professionals, setProfessionals] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [activeTab, setActiveTab] = useState('ativos');
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const [newSpecialtyModal, setNewSpecialtyModal] = useState(false);
  const [newSpecialtyName, setNewSpecialtyName] = useState('');
  const [savingSpecialty, setSavingSpecialty] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [section, setSection] = useState('');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [unitId, setUnitId] = useState('');
  
  // Remuneração
  const [remunerationType, setRemunerationType] = useState('hora');
  const [hourlyRate, setHourlyRate] = useState('120');
  const [dailyRate, setDailyRate] = useState('1500');
  const [monthlySalary, setMonthlySalary] = useState('18000');

  // Dados Bancários / PIX
  const [pixType, setPixType] = useState('cpf'); 
  const [pixKey, setPixKey] = useState('');
  const [bankInfo, setBankInfo] = useState('');

  // Acesso e Permissões (RBAC)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('medico');
  const [allowedModules, setAllowedModules] = useState(['minha_escala', 'trocas_plantao', 'mural_oportunidades', 'meus_repasses']);

  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const units = useMemo(() => {
    return company?.units && company.units.length > 0
      ? company.units
      : [
          { id: 'unit_h1', name: 'Hospital Santa Clara' },
          { id: 'unit_h2', name: 'Hospital Vida & Saúde Dois' }
        ];
  }, [company]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profs, secs, specs] = await Promise.all([
        base44.entities.Professional.filter({ company_id: companyId }, '-created_date', 800).catch(() => []),
        base44.entities.Sector.filter({ company_id: companyId }, 'name', 100).catch(() => []),
        base44.entities.Specialty ? base44.entities.Specialty.filter({ company_id: companyId }, 'name', 100).catch(() => []) : Promise.resolve([])
      ]);
      setProfessionals(profs || []);
      setSectors((secs && secs.length > 0) ? secs : DEFAULT_SECTORS);
      setSpecialties(specs || []);
    } catch (e) {
      console.error('Erro ao buscar dados:', e);
      setSectors(DEFAULT_SECTORS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId]);

  const pendingList = useMemo(() => {
    return professionals.filter(p => p.status === 'pendente');
  }, [professionals]);

  const activeList = useMemo(() => {
    return professionals.filter(p => p.status !== 'pendente' && p.status !== 'rejeitado');
  }, [professionals]);

  const filteredProfessionals = useMemo(() => {
    const listToFilter = activeTab === 'pendentes' ? pendingList : activeList;
    if (!searchQuery.trim()) return listToFilter;
    const query = searchQuery.toLowerCase().trim();
    return listToFilter.filter((p) => {
      const pName = (p.name || '').toLowerCase();
      const pDoc = (p.document || '').toLowerCase();
      const pSpec = (p.specialty || p.category || '').toLowerCase();
      const pEmail = (p.email || '').toLowerCase();
      return pName.includes(query) || pDoc.includes(query) || pSpec.includes(query) || pEmail.includes(query);
    });
  }, [activeTab, activeList, pendingList, searchQuery]);

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    if (newRole === 'gestor') {
      setAllowedModules(SYSTEM_MODULES.map(m => m.id));
    } else if (newRole === 'coordenador') {
      setAllowedModules(['minha_escala', 'trocas_plantao', 'mural_oportunidades', 'meus_repasses', 'escalas_geral']);
    } else {
      setAllowedModules(['minha_escala', 'trocas_plantao', 'mural_oportunidades', 'meus_repasses']);
    }
  };

  const handleBirthDateChange = (newDate) => {
    setBirthDate(newDate);
    if (!editingId) {
      setPassword(computeDefaultPassword(newDate, name));
    }
  };

  const handleNameChange = (newName) => {
    setName(newName);
    if (!editingId && birthDate) {
      setPassword(computeDefaultPassword(birthDate, newName));
    }
  };

  const handleWhatsApp = (prof) => {
    let rawPhone = prof.phone ? String(prof.phone).replace(/\D/g, '') : '';
    if (!rawPhone) {
      alert('Este profissional não possui telefone cadastrado.');
      return;
    }
    if (rawPhone.length === 10 || rawPhone.length === 11) rawPhone = `55${rawPhone}`;
    
    const text = encodeURIComponent(`Olá, Dr(a). ${prof.name}!\n\nSeu cadastro no sistema ScaleMedic foi atualizado com sucesso. Você já pode acessar seu painel de escalas e repasses.\n\nQualquer dúvida, estamos à disposição!`);
    window.open(`https://wa.me/${rawPhone}?text=${text}`, '_blank');
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/cadastro-medico`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setToastMessage('Link de auto-cadastro copiado!');
      setTimeout(() => setToastMessage(''), 3000);
    } else {
      alert(`Envie o link para o profissional: ${url}`);
    }
  };

  const handleApprove = async (prof) => {
    if (!confirm(`Aprovar o credenciamento do Dr(a). ${prof.name}?`)) return;
    try {
      await base44.entities.Professional.update(prof.id, {
        status: 'ativo',
        approved_at: new Date().toISOString()
      });
      setToastMessage('Profissional aprovado com sucesso!');
      setTimeout(() => setToastMessage(''), 3000);
      loadData();
    } catch (e) {
      alert('Erro ao aprovar: ' + e.message);
    }
  };

  const handleReject = async (prof) => {
    const reason = prompt('Informe o motivo da recusa (opcional):');
    if (reason === null) return;
    try {
      await base44.entities.Professional.update(prof.id, {
        status: 'rejeitado',
        rejection_reason: reason
      });
      loadData();
    } catch (e) {
      alert('Erro ao rejeitar: ' + e.message);
    }
  };

  const handleResetPassword = async (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!birthDate) {
      alert('Preencha a Data de Nascimento para gerar a senha padrão!');
      return;
    }

    const defaultPass = computeDefaultPassword(birthDate, name);
    setPassword(defaultPass);

    if (editingId && email) {
      try {
        const userEmail = email.toLowerCase().trim();
        const existingUsers = await base44.entities.User.filter({ email: userEmail });
        if (existingUsers.length > 0) {
          await base44.entities.User.update(existingUsers[0].id, {
            password: defaultPass,
            data: { ...(existingUsers[0].data || {}), must_change_password: true }
          });
        }
      } catch (err) {
        console.error('Erro ao resetar senha:', err);
      }
    }

    setToastMessage(`Senha reiniciada para: ${defaultPass}`);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const openNewModal = () => {
    setEditingId(null);
    setName('');
    setCpf('');
    setBirthDate('');
    setSpecialty(specialties[0]?.name || 'Clínica Médica');
    setSection('');
    setDocument('');
    setEmail('');
    setPhone('');
    setUsername('');
    setPassword('123456');
    setUnitId(String(units[0]?.id || 'unit_h1'));
    
    setRole('medico');
    setAllowedModules(['minha_escala', 'trocas_plantao', 'mural_oportunidades', 'meus_repasses']);
    
    setRemunerationType('hora');
    setHourlyRate('120');
    setDailyRate('1500');
    setMonthlySalary('18000');

    setPixType('cpf');
    setPixKey('');
    setBankInfo('');

    setDialogOpen(true);
  };

  const handleEditProfessional = async (prof) => {
    setEditingId(prof.id);
    setName(prof.name || '');
    setCpf(prof.cpf || '');
    setBirthDate(prof.birth_date || '');
    setSpecialty(prof.specialty || prof.category || 'Clínica Médica');
    setSection(prof.section || '');
    setDocument(prof.document || '');
    setEmail(prof.email || '');
    setPhone(prof.phone || '');
    setUnitId(String(prof.unit_id || units[0]?.id || 'unit_h1'));

    setRemunerationType(prof.remuneration_type || 'hora');
    setHourlyRate(String(prof.hourly_rate || '120'));
    setDailyRate(String(prof.daily_rate || '1500'));
    setMonthlySalary(String(prof.monthly_salary || '18000'));

    setPixType(prof.pix_type || 'cpf');
    setPixKey(prof.pix_key || '');
    setBankInfo(prof.bank_info || '');

    const userRole = prof.role === 'gestor' || prof.is_manager ? 'gestor' : prof.role === 'coordenador' ? 'coordenador' : 'medico';
    setRole(userRole);

    try {
      const usersFound = await base44.entities.User.filter({ email: (prof.email || '').toLowerCase().trim() });
      if (usersFound.length > 0) {
        setUsername(usersFound[0].username || '');
        setPassword(usersFound[0].password || '123456');
        if (usersFound[0]?.data?.allowed_modules) {
          setAllowedModules(usersFound[0].data.allowed_modules);
        } else {
          setAllowedModules(userRole === 'gestor' ? SYSTEM_MODULES.map(m => m.id) : ['minha_escala', 'trocas_plantao', 'mural_oportunidades', 'meus_repasses']);
        }
      } else {
        setUsername(prof.email ? prof.email.split('@')[0] : '');
        setPassword(prof.birth_date ? computeDefaultPassword(prof.birth_date, prof.name) : '123456');
        setAllowedModules(userRole === 'gestor' ? SYSTEM_MODULES.map(m => m.id) : ['minha_escala', 'trocas_plantao', 'mural_oportunidades', 'meus_repasses']);
      }
    } catch {
      setUsername(prof.email ? prof.email.split('@')[0] : '');
      setPassword(prof.birth_date ? computeDefaultPassword(prof.birth_date, prof.name) : '123456');
      setAllowedModules(['minha_escala', 'trocas_plantao', 'mural_oportunidades', 'meus_repasses']);
    }

    setDialogOpen(true);
  };

  const handleCreateSpecialty = async () => {
    if (!newSpecialtyName.trim()) return;
    setSavingSpecialty(true);
    try {
      const created = await base44.entities.Specialty.create({
        company_id: companyId,
        name: newSpecialtyName.trim()
      });
      setSpecialties((prev) => [...prev, created]);
      setSpecialty(created.name);
      setNewSpecialtyName('');
      setNewSpecialtyModal(false);
    } catch (e) {
      alert('Erro ao criar especialidade: ' + e.message);
    } finally {
      setSavingSpecialty(false);
    }
  };

  const handleCopyAccess = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const host = window.location.origin;
    const userDisplay = username || (email ? email.split('@')[0] : 'usuario');
    const passDisplay = password || (birthDate ? computeDefaultPassword(birthDate, name) : '123456');

    const textToCopy = `*ScaleMedic - Seus dados de acesso*\n\nOlá, ${name || 'Profissional'}!\nVocê foi cadastrado no sistema da escala hospitalar.\n\n👤 *Usuário:* ${userDisplay}\n🔑 *Senha Provisória:* ${passDisplay}\n🔗 *Acesso:* ${host}/login\n\n⚠️ *Atenção:* Ao acessar, troque sua senha no primeiro login.`;

    navigator.clipboard.writeText(textToCopy);
    setToastMessage('Dados de acesso copiados!');
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const numHourly = Number(hourlyRate) || 0;
      const numDaily = Number(dailyRate) || 0;
      const numMonthly = Number(monthlySalary) || 0;

      // PAYLOAD SANITIZADO: sem 'full_name' nem 'allowed_modules'
      const profPayload = {
        company_id: companyId,
        unit_id: unitId || units[0]?.id,
        name,
        specialty,
        category: specialty,
        role,
        document,
        email,
        phone,
        status: 'ativo',
        remuneration_type: remunerationType,
        hourly_rate: numHourly,
        daily_rate: numDaily,
        monthly_salary: numMonthly,
        pix_type: pixType,
        pix_key: pixKey.trim(),
        bank_info: bankInfo.trim()
      };

      if (cpf) profPayload.cpf = cpf;
      if (birthDate) profPayload.birth_date = birthDate;
      if (section) profPayload.section = section;

      // Auto-recuperação resiliente contra colunas ausentes no schema cache
      const payloadToSend = { ...profPayload };
      let saved = false;

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          if (editingId) {
            await base44.entities.Professional.update(editingId, payloadToSend);
          } else {
            await base44.entities.Professional.create(payloadToSend);
          }
          saved = true;
          break;
        } catch (dbErr) {
          const colMatch = dbErr.message?.match(/Could not find the '(\w+)' column/i);
          if (colMatch && colMatch[1]) {
            delete payloadToSend[colMatch[1]];
          } else {
            throw dbErr;
          }
        }
      }

      if (!saved) {
        throw new Error('Falha ao persistir dados do profissional no banco.');
      }

      // Sincronização de credenciais na tabela User
      const userNick = (username || (email ? email.split('@')[0] : name.toLowerCase().replace(/\s+/g, ''))).trim();
      const finalPass = password || (birthDate ? computeDefaultPassword(birthDate, name) : '123456');
      const userEmail = (email || `${userNick}@scalemedic.local`).toLowerCase().trim();

      const userData = {
        company_id: companyId,
        selected_unit_id: unitId,
        app_role: role,
        allowed_modules: allowedModules,
        permissions: allowedModules,
        must_change_password: !editingId || password === computeDefaultPassword(birthDate, name)
      };

      try {
        const existingUsers = await base44.entities.User.filter({ email: userEmail });
        if (existingUsers.length > 0) {
          await base44.entities.User.update(existingUsers[0].id, {
            username: userNick,
            password: finalPass,
            full_name: name,
            role: role === 'gestor' ? 'admin' : 'user',
            data: { ...(existingUsers[0].data || {}), ...userData }
          });
        } else {
          await base44.entities.User.create({
            email: userEmail,
            username: userNick,
            password: finalPass,
            full_name: name,
            role: role === 'gestor' ? 'admin' : 'user',
            data: userData
          });
        }
      } catch (userErr) {
        console.warn('Aviso na sincronização de usuário:', userErr);
      }

      setDialogOpen(false);
      setToastMessage('Profissional salvo com sucesso!');
      setTimeout(() => setToastMessage(''), 3000);
      await loadData();
    } catch (err) {
      alert('Erro ao salvar profissional: ' + (err.message || 'Verifique os dados e tente novamente.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 relative">
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[9999] flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 font-medium text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-100" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Corpo Clínico</h1>
          <p className="text-sm text-slate-500">
            Gerenciamento cadastral, parâmetros financeiros de contrato e aprovação de credenciamento.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-sky-700 dark:bg-slate-700 dark:text-sky-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
              <LayoutGrid className="w-4 h-4" /> Cartões
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-sky-700 dark:bg-slate-700 dark:text-sky-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
              <List className="w-4 h-4" /> Lista
            </button>
          </div>

          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

          <Button variant="outline" onClick={handleCopyLink} className="gap-2 border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-slate-700 dark:text-sky-400">
            <Share2 className="w-4 h-4 text-sky-600" /> Link de Auto-Cadastro
          </Button>
          
          <Button variant="outline" onClick={() => setNewSpecialtyModal(true)} className="gap-2">
            <PlusCircle className="w-4 h-4 text-sky-600" /> Nova Especialidade
          </Button>
          
          <Button onClick={openNewModal} className="bg-sky-600 hover:bg-sky-700 text-white gap-2 font-medium px-5">
            <Plus className="w-4 h-4" /> Novo Profissional
          </Button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('ativos')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'ativos'
              ? 'bg-sky-600 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Corpo Clínico Ativo ({activeList.length})
        </button>

        <button
          onClick={() => setActiveTab('pendentes')}
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-all ${
            activeTab === 'pendentes'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Aguardando Aprovação
          {pendingList.length > 0 && (
            <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black animate-pulse">
              {pendingList.length}
            </span>
          )}
        </button>
      </div>

      {/* Barra de Busca */}
      <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar por nome, CRM/COREN, especialidade ou e-mail..."
            className="pl-9 pr-8 h-10 text-xs border-0 bg-transparent focus-visible:ring-0"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="text-xs font-semibold text-slate-400 px-3 border-l border-slate-100 dark:border-slate-800 hidden sm:block">
          Mostrando {filteredProfessionals.length} profissionais
        </div>
      </div>

      {/* Cadastros Pendentes */}
      {activeTab === 'pendentes' && (
        <div className="space-y-3">
          {filteredProfessionals.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <Clock className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-50" />
              <p className="text-slate-400 text-sm">Nenhum cadastro aguardando aprovação no momento.</p>
              <p className="text-xs text-slate-500 mt-1">Quando os médicos utilizarem o Link de Auto-Cadastro, eles aparecerão aqui para validação.</p>
            </div>
          ) : (
            filteredProfessionals.map((prof) => (
              <div
                key={prof.id}
                className="p-5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-900/50 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="text-base text-slate-900 dark:text-white">{prof.name}</strong>
                    <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border border-amber-500/20">
                      CRM/Reg: {prof.document || '--'}
                    </span>
                    <span className="text-xs text-sky-600 font-semibold">{prof.specialty}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 space-x-2">
                    <span>Telefone: <b>{prof.phone || '—'}</b></span>
                    <span>•</span>
                    <span>E-mail: <b>{prof.email || '—'}</b></span>
                    <span>•</span>
                    <span>PIX: <b>{prof.pix_key || '—'} ({prof.pix_type?.toUpperCase() || 'CPF'})</b></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    onClick={() => handleReject(prof)}
                    className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30"
                  >
                    Recusar
                  </Button>
                  <Button
                    onClick={() => handleApprove(prof)}
                    className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  >
                    <UserCheck className="w-4 h-4" /> Aprovar e Liberar Acesso
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Profissionais Ativos */}
      {activeTab === 'ativos' && (
        loading ? (
          <div className="flex justify-center p-16">
            <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
          </div>
        ) : filteredProfessionals.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
            <p className="text-slate-400 text-sm">Nenhum profissional encontrado com o termo "{searchQuery}".</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProfessionals.map((prof) => {
              const unitName = units.find((u) => String(u.id) === String(prof.unit_id))?.name || 'Hospital Santa Clara';
              const isGestor = prof.role === 'gestor';
              const isCoord = prof.role === 'coordenador';

              const remType = prof.remuneration_type || 'hora';
              const remLabel = 
                remType === 'hora' ? `R$ ${Number(prof.hourly_rate || 0).toLocaleString('pt-BR')}/hora` :
                remType === 'diaria' ? `R$ ${Number(prof.daily_rate || 0).toLocaleString('pt-BR')}/plantão` :
                `R$ ${Number(prof.monthly_salary || 0).toLocaleString('pt-BR')}/mês (Fixo)`;

              return (
                <Card
                  key={prof.id}
                  className="p-5 border-slate-200 dark:border-slate-800 hover:border-sky-300 transition-all flex flex-col justify-between space-y-4 shadow-sm bg-white dark:bg-slate-900"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-white">{prof.name}</h3>
                        <p className="text-xs text-sky-600 font-semibold uppercase tracking-wide">
                          {prof.specialty || prof.category || 'Clínica Geral'} {prof.document ? `• CRM/Reg: ${prof.document}` : ''}
                        </p>
                      </div>
                      {isGestor ? (
                        <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[11px] font-bold px-2.5 py-1 rounded-full uppercase flex items-center gap-1 shrink-0 border border-emerald-200 dark:border-emerald-800">
                          <ShieldCheck className="w-3.5 h-3.5" /> Gestor
                        </span>
                      ) : isCoord ? (
                        <span className="bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 text-[11px] font-bold px-2.5 py-1 rounded-full uppercase flex items-center gap-1 shrink-0 border border-sky-200 dark:border-sky-800">
                          Coordenador
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[11px] font-bold px-2.5 py-1 rounded-full uppercase shrink-0">
                          Plantonista
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 space-y-1.5 pt-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-700 dark:text-slate-300">{unitName}</span>
                      </div>

                      <div className="flex items-center gap-2 py-1 px-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-200/60">
                        <DollarSign className="w-3.5 h-3.5 shrink-0" />
                        <span>Contrato: {remLabel}</span>
                      </div>

                      <div className="flex items-center gap-2 py-1 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        <CreditCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          PIX: <b>{prof.pix_key || 'Não cadastrada'}</b> {prof.pix_key && `(${prof.pix_type?.toUpperCase()})`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleWhatsApp(prof)}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1.5 px-2"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditProfessional(prof)}
                      className="text-xs font-semibold gap-1.5 text-slate-700 hover:text-sky-600 hover:border-sky-400"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Editar Cadastro
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-sm">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="p-4 font-semibold">Profissional / CRM</th>
                  <th className="p-4 font-semibold">Contato</th>
                  <th className="p-4 font-semibold">Contrato / Repasse</th>
                  <th className="p-4 font-semibold">PIX Oficial</th>
                  <th className="p-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredProfessionals.map((prof) => {
                  const isGestor = prof.role === 'gestor';
                  const remType = prof.remuneration_type || 'hora';
                  const remLabel = 
                    remType === 'hora' ? `R$ ${Number(prof.hourly_rate || 0).toLocaleString('pt-BR')}/h` :
                    remType === 'diaria' ? `R$ ${Number(prof.daily_rate || 0).toLocaleString('pt-BR')}/plantão` :
                    `R$ ${Number(prof.monthly_salary || 0).toLocaleString('pt-BR')}/mês`;

                  return (
                    <tr key={prof.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          {prof.name} {isGestor && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" title="Gestor" />}
                        </div>
                        <div className="text-xs text-sky-600 font-semibold uppercase mt-0.5">
                          {prof.specialty || prof.category || 'Clínica Geral'} {prof.document ? `• ${prof.document}` : ''}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-slate-700 dark:text-slate-300 font-medium">{prof.phone || 'Sem telefone'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{prof.email || 'Sem e-mail'}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-emerald-700 dark:text-emerald-400 font-bold">{remLabel}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-xs text-slate-700 dark:text-slate-300 font-mono">{prof.pix_key || 'Não cadastrada'}</div>
                        <div className="text-[10px] text-slate-400 uppercase">{prof.pix_type || 'CPF'}</div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" onClick={() => handleWhatsApp(prof)} title="Chamar WhatsApp">
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:bg-slate-100" onClick={() => handleEditProfessional(prof)} title="Editar">
                            <Edit3 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Modal de Cadastro & Edição (Perfil Mestre) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editingId ? `Editar Perfil Mestre: ${name}` : 'Cadastrar Novo Profissional'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-5 py-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold">Nome completo *</Label>
                <Input required value={name} onChange={(e) => handleNameChange(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold">CPF *</Label>
                <Input required placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold">Data de Nascimento *</Label>
                <Input 
                  type="date" 
                  required 
                  value={birthDate} 
                  onChange={(e) => handleBirthDateChange(e.target.value)} 
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs font-semibold">Especialidade Principal *</Label>
                  <button
                    type="button"
                    onClick={() => setNewSpecialtyModal(true)}
                    className="text-[11px] text-sky-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    <PlusCircle className="w-3 h-3" /> Criar nova
                  </button>
                </div>
                <Select value={String(specialty || '')} onValueChange={setSpecialty}>
                  <SelectTrigger><SelectValue placeholder="Selecione a especialidade..." /></SelectTrigger>
                  <SelectContent>
                    {specialties.map((esp) => (
                      <SelectItem key={esp.id || esp.name} value={String(esp.name)}>{esp.name}</SelectItem>
                    ))}
                    {specialties.length === 0 && (
                      <SelectItem value="Clínica Médica">Clínica Médica</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Seção / Setor Habilitado</Label>
                <Input placeholder="Ex: UTI Adulto, Bloco Cirúrgico, PA" value={section} onChange={(e) => setSection(e.target.value)} />
              </div>

              <div>
                <Label className="text-xs font-semibold">CRM / COREN (com UF) *</Label>
                <Input required placeholder="Ex: CRM-SP 123456" value={document} onChange={(e) => setDocument(e.target.value)} />
              </div>

              <div className="md:col-span-2">
                <Label className="text-xs font-semibold">E-mail Profissional</Label>
                <Input type="email" placeholder="medico@hospital.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div>
                <Label className="text-xs font-semibold">WhatsApp / Telefone *</Label>
                <Input required placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>

            {/* SEÇÃO 1: CONTRATO & REPASSE FINANCEIRO */}
            <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-3">
              <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" /> Parâmetros Financeiros do Contrato (Repasse Automático)
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Modelo de Remuneração</Label>
                  <Select value={String(remunerationType || 'hora')} onValueChange={setRemunerationType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hora">Horista (Valor por Hora Trabalhada)</SelectItem>
                      <SelectItem value="diaria">Diarista (Valor Fixo por Plantão)</SelectItem>
                      <SelectItem value="mensal">Salário Fixo Mensal (Contrato Fechado)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {remunerationType === 'hora' && (
                  <div>
                    <Label className="text-xs font-semibold">Valor da Hora (R$)</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 120.00"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                    />
                  </div>
                )}

                {remunerationType === 'diaria' && (
                  <div>
                    <Label className="text-xs font-semibold">Valor por Plantão / Diária (R$)</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 1500.00"
                      value={dailyRate}
                      onChange={(e) => setDailyRate(e.target.value)}
                    />
                  </div>
                )}

                {remunerationType === 'mensal' && (
                  <div>
                    <Label className="text-xs font-semibold">Salário Fixo Mensal (R$)</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 18000.00"
                      value={monthlySalary}
                      onChange={(e) => setMonthlySalary(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* SEÇÃO 2: DADOS BANCÁRIOS & CHAVE PIX */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-emerald-600" /> Dados para Pagamento & Chave PIX
                </h4>
                <span className="text-[11px] text-slate-400">Utilizado no fechamento do faturamento</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Tipo da Chave PIX</Label>
                  <Select value={String(pixType || 'cpf')} onValueChange={setPixType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ (PJ)</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="telefone">Telefone</SelectItem>
                      <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold">Chave PIX Oficial</Label>
                  <Input
                    placeholder="Digite a chave PIX exata para recebimento..."
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                  />
                </div>

                <div className="sm:col-span-3">
                  <Label className="text-xs font-semibold">Dados Bancários Complementares (Banco / Agência / Conta)</Label>
                  <Input
                    placeholder="Ex: Banco Itaú (341) - Agência: 0123 - CC: 45678-9"
                    value={bankInfo}
                    onChange={(e) => setBankInfo(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 3: CONTROLE DE ACESSO & PERMISSÕES (RBAC) */}
            <div className="p-4 bg-sky-50/50 dark:bg-sky-950/20 rounded-xl border border-sky-200 dark:border-sky-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <User className="w-4 h-4 text-sky-600" /> Acesso ao Sistema & Perfil de Permissões
                  </h4>
                  <p className="text-xs text-slate-500">
                    Defina o papel do profissional e as telas que ele poderá acessar.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetPassword}
                    className="text-xs font-medium gap-1.5 bg-amber-50 dark:bg-slate-900 border-amber-300 text-amber-800 hover:bg-amber-100"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                    Resetar Senha
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyAccess}
                    className="text-xs font-medium gap-1.5 bg-white dark:bg-slate-900 border-sky-300 text-sky-700 hover:bg-sky-50"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Copiar Acesso
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Perfil de Acesso (Papel)</Label>
                  <Select value={role} onValueChange={handleRoleChange}>
                    <SelectTrigger className="h-10 text-xs font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medico">Plantonista (Acesso Próprio & Trocas)</SelectItem>
                      <SelectItem value="coordenador">Coordenador de Setor (Gestão Local)</SelectItem>
                      <SelectItem value="gestor">Diretor / Gestor Geral (Acesso Total)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Usuário / Apelido</Label>
                  <Input required value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Senha Inicial</Label>
                  <Input required type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>

              <div className="pt-3 border-t border-sky-200/60 dark:border-sky-800/60 space-y-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Telas e Módulos Liberados para este Profissional:
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {SYSTEM_MODULES.map((mod) => (
                    <label key={mod.id} className="flex items-center gap-2 text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowedModules.includes(mod.id) || role === 'gestor'}
                        disabled={role === 'gestor'}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...allowedModules, mod.id]
                            : allowedModules.filter(m => m !== mod.id);
                          setAllowedModules(next);
                        }}
                        className="rounded border-slate-300 text-sky-600 focus:ring-0"
                      />
                      <span>{mod.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Unidade Hospitalar */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <Label className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-sky-600" /> Unidade Hospitalar Vinculada
              </Label>
              <Select value={String(unitId || '')} onValueChange={setUnitId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-sky-600 hover:bg-sky-700 text-white px-6">
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gravando...</> : (editingId ? 'Salvar Alterações' : 'Concluir Cadastro')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Criar Nova Especialidade */}
      <Dialog open={newSpecialtyModal} onOpenChange={setNewSpecialtyModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Especialidade Médica</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs font-semibold">Nome da Especialidade</Label>
            <Input
              autoFocus
              placeholder="Ex: Neurocirurgia, Radiologia, Nefrologia"
              value={newSpecialtyName}
              onChange={(e) => setNewSpecialtyName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSpecialtyModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateSpecialty} disabled={savingSpecialty} className="bg-sky-600 text-white">
              {savingSpecialty ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Especialidade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}