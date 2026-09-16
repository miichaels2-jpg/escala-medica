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
  KeyRound, Send, RefreshCw, Ban, UserCheck, MessageSquare
} from 'lucide-react';

function safeNumber(val, fb = 0) {
  if (val === null || val === undefined || val === '') return fb;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : fb;
}

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeNumber(val));
}

export default function CorpoClinico() {
  const { 
    professionals, 
    units, 
    selectedUnitId, 
    companyId, 
    isManager, 
    syncGlobalData 
  } = useAppData();

  const [activeTab, setActiveTab] = useState('ativos'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('todas');
  
  // Modal de Edição / Criação
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProf, setEditingProf] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Formulário do Profissional
  const [formData, setFormData] = useState({
    name: '',
    document: '',
    specialty: '',
    cbo: '',
    cpf: '',
    email: '',
    phone: '',
    unit_id: '',
    status: 'ativo',
    remuneration_type: 'hora',
    hourly_rate: 120,
    daily_rate: 1500,
    monthly_salary: 18000,
    monthly_work_hours: 220,
    coop_tax_rate: 0,
    pix_type: 'CPF',
    pix_key: '',
    bank_info: '',
    // Campos de Acesso e Senha
    password: ''
  });

  const resetForm = () => {
    setFormData({
      name: '',
      document: '',
      specialty: '',
      cbo: '',
      cpf: '',
      email: '',
      phone: '',
      unit_id: selectedUnitId || (units[0]?.id || 'unit_h1'),
      status: 'ativo',
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
  };

  const handleOpenNew = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleOpenEdit = (prof) => {
    setEditingProf(prof);

    // Extrai notas auxiliares salvas anteriormente
    let cboExtracted = '';
    let bankExtracted = '';
    if (prof.notes) {
      const cboMatch = prof.notes.match(/CBO:\s*([^|]+)/i);
      if (cboMatch) cboExtracted = cboMatch[1].trim();
      const bankMatch = prof.notes.match(/Banco:\s*([^|]+)/i);
      if (bankMatch) bankExtracted = bankMatch[1].trim();
    }

    setFormData({
      name: prof.name || prof.full_name || '',
      document: prof.document || prof.registration_number || '',
      specialty: prof.specialty || '',
      cbo: cboExtracted,
      cpf: prof.cpf || '',
      email: prof.email || '',
      phone: prof.phone || '',
      unit_id: prof.unit_id || selectedUnitId,
      status: prof.status || 'ativo',
      remuneration_type: prof.remuneration_type || 'hora',
      hourly_rate: safeNumber(prof.hourly_rate, 120),
      daily_rate: safeNumber(prof.daily_rate, 1500),
      monthly_salary: safeNumber(prof.monthly_salary, 18000),
      monthly_work_hours: safeNumber(prof.monthly_work_hours, 220),
      coop_tax_rate: safeNumber(prof.coop_tax_rate, 0),
      pix_type: prof.pix_type || 'CPF',
      pix_key: prof.pix_key || '',
      bank_info: bankExtracted,
      password: '' // Inicializa em branco; preenche apenas se for alterar
    });
    setModalOpen(true);
  };

  // Gerar Senha Rápida Temporária
  const handleGeneratePassword = () => {
    const randomPass = 'Med@' + Math.floor(1000 + Math.random() * 9000);
    setFormData(prev => ({ ...prev, password: randomPass }));
  };

  // Enviar Acesso via WhatsApp
  const handleSendWhatsApp = (prof, customPassword = '') => {
    const rawPhone = prof.phone || formData.phone;
    const cleanPhone = String(rawPhone || '').replace(/\D/g, '');
    
    if (!cleanPhone) {
      alert('O profissional não possui telefone/WhatsApp cadastrado.');
      return;
    }

    const phoneWithDDI = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const loginUser = prof.email || formData.email || prof.cpf || formData.cpf;
    const pass = customPassword || formData.password || '(senha previamente cadastrada)';
    const siteUrl = window.location.origin;

    const message = [
      `*ScaleMedic - Plataforma de Gestão Hospitalar* 🏥\n`,
      `Olá, Dr(a). *${prof.name || formData.name}*!`,
      `Seu acesso à plataforma de escalas e plantões está ativo:\n`,
      `🌐 *Acesso:* ${siteUrl}/login`,
      `👤 *Usuário:* ${loginUser}`,
      `🔑 *Senha:* ${pass}\n`,
      `Por favor, acesse o sistema para visualizar sua escala e confirmar seus plantões.`
    ].join('\n');

    const waUrl = `https://api.whatsapp.com/send?phone=${phoneWithDDI}&text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  // Aprovar Cadastro Pendente
  const handleApprove = async (prof) => {
    if (!confirm(`Aprovar o credenciamento de Dr(a). ${prof.name}? O profissional será liberado para a escala.`)) return;

    try {
      await base44.entities.Professional.update(prof.id, {
        status: 'ativo'
      });

      if (prof.user_id && base44.entities.User?.update) {
        await base44.entities.User.update(prof.user_id, {
          data: { status: 'aprovado' }
        }).catch(() => {});
      }

      await syncGlobalData();
      alert(`Dr(a). ${prof.name} aprovado(a) com sucesso!`);
    } catch (err) {
      alert('Erro ao aprovar profissional: ' + err.message);
    }
  };

  // Recusar ou Inativar
  const handleToggleStatus = async (prof, nextStatus) => {
    const actionText = nextStatus === 'ativo' ? 'ativar' : (nextStatus === 'recusado' ? 'recusar' : 'inativar');
    if (!confirm(`Deseja realmente ${actionText} o profissional ${prof.name}?`)) return;

    try {
      await base44.entities.Professional.update(prof.id, { status: nextStatus });
      
      if (prof.user_id && base44.entities.User?.update) {
        await base44.entities.User.update(prof.user_id, {
          data: { status: nextStatus }
        }).catch(() => {});
      }

      await syncGlobalData();
    } catch (err) {
      alert('Erro ao alterar status: ' + err.message);
    }
  };

  // Salvar Alterações (Protegido contra colunas inexistentes)
  const handleSaveProfessional = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Preencha o nome do profissional.');
      return;
    }

    setSubmitting(true);
    try {
      // Notas auxiliares para preservar CBO e Banco sem quebrar o esquema
      const notesArray = [];
      if (formData.cbo.trim()) notesArray.push(`CBO: ${formData.cbo.trim()}`);
      if (formData.bank_info.trim()) notesArray.push(`Banco: ${formData.bank_info.trim()}`);

      // Payload contendo apenas colunas oficiais confirmadas
      const payload = {
        company_id: companyId || 'cmp_principal',
        unit_id: formData.unit_id || selectedUnitId || 'unit_h1',
        name: formData.name.trim(),
        document: formData.document.trim(),
        specialty: formData.specialty.trim(),
        cpf: formData.cpf.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        status: formData.status,
        remuneration_type: formData.remuneration_type,
        hourly_rate: safeNumber(formData.hourly_rate),
        daily_rate: safeNumber(formData.daily_rate),
        monthly_salary: safeNumber(formData.monthly_salary),
        monthly_work_hours: safeNumber(formData.monthly_work_hours),
        coop_tax_rate: safeNumber(formData.coop_tax_rate),
        pix_type: formData.pix_type,
        pix_key: formData.pix_key.trim(),
        notes: notesArray.join(' | ')
      };

      let savedProfId = editingProf?.id;

      if (editingProf?.id) {
        await base44.entities.Professional.update(editingProf.id, payload);
      } else {
        const created = await base44.entities.Professional.create(payload);
        savedProfId = created?.id;
      }

      // Se informou nova senha ou se precisa criar/atualizar conta de usuário
      if (formData.password.trim() || !editingProf?.user_id) {
        const userEmail = formData.email.trim().toLowerCase();
        
        if (userEmail) {
          // Busca se o usuário já existe na tabela User
          const existingUsers = await base44.entities.User.filter({ email: userEmail }).catch(() => []);
          
          if (existingUsers && existingUsers.length > 0) {
            const userToUpdate = existingUsers[0];
            const userUpdatePayload = {
              full_name: formData.name.trim(),
              data: {
                ...(userToUpdate.data || {}),
                status: formData.status === 'ativo' ? 'aprovado' : formData.status,
                phone: formData.phone.trim(),
                professional_id: savedProfId
              }
            };
            if (formData.password.trim()) {
              userUpdatePayload.password = formData.password.trim();
            }
            await base44.entities.User.update(userToUpdate.id, userUpdatePayload).catch(() => {});
          } else if (formData.password.trim()) {
            // Cria a conta do usuário se não existir
            const newUser = await base44.entities.User.create({
              email: userEmail,
              username: userEmail.split('@')[0],
              password: formData.password.trim(),
              full_name: formData.name.trim(),
              role: 'user',
              data: {
                company_id: companyId || 'cmp_principal',
                selected_unit_id: formData.unit_id || selectedUnitId || 'unit_h1',
                status: formData.status === 'ativo' ? 'aprovado' : 'pendente',
                phone: formData.phone.trim(),
                professional_id: savedProfId
              }
            }).catch(() => null);

            if (newUser && savedProfId) {
              await base44.entities.Professional.update(savedProfId, { user_id: newUser.id }).catch(() => {});
            }
          }
        }
      }

      setModalOpen(false);
      resetForm();
      await syncGlobalData();
      alert('Dados do profissional atualizados com sucesso!');
    } catch (err) {
      alert('Erro ao salvar profissional: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const allSpecialties = useMemo(() => {
    const set = new Set();
    professionals.forEach(p => { if (p.specialty) set.add(p.specialty.trim()); });
    return Array.from(set).sort();
  }, [professionals]);

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
      
      if (activeTab === 'pendentes' && st !== 'pendente' && st !== 'em_analise') return false;
      if (activeTab === 'inativos' && st !== 'inativo' && st !== 'recusado') return false;
      if (activeTab === 'ativos' && (st === 'pendente' || st === 'em_analise' || st === 'inativo' || st === 'recusado')) return false;

      if (specialtyFilter !== 'todas' && p.specialty !== specialtyFilter) return false;

      if (term) {
        const matchesName = (p.name || '').toLowerCase().includes(term);
        const matchesDoc = (p.document || '').toLowerCase().includes(term);
        const matchesCpf = (p.cpf || '').toLowerCase().includes(term);
        const matchesSpec = (p.specialty || '').toLowerCase().includes(term);
        if (!matchesName && !matchesDoc && !matchesCpf && !matchesSpec) return false;
      }

      return true;
    });
  }, [professionals, activeTab, specialtyFilter, searchQuery]);

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans">
      
      {/* BANNER PRINCIPAL */}
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
            <Users className="w-4 h-4" /> Gestão de Pessoas & Honorários
          </div>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black">Corpo Clínico & Credenciamento</h2>
          <p className="text-xs text-slate-300">
            Aprovação de cadastros, envio de acessos via WhatsApp e parametrização financeira.
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
            <span>Inativos / Recusados</span>
            <span className="text-[10px] opacity-70">({counts.inativos})</span>
          </button>
        </div>

        {/* BUSCA E FILTRO DE ESPECIALIDADE */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
            <SelectTrigger className="h-9 w-44 text-xs font-semibold">
              <SelectValue placeholder="Especialidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas especialidades</SelectItem>
              {allSpecialties.map(spec => (
                <SelectItem key={spec} value={spec}>{spec}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="Buscar por nome, CRM ou CPF..." 
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
          <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">Nenhum profissional localizado</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {activeTab === 'pendentes' && 'Não há novos cadastros aguardando aprovação.'}
            {activeTab === 'ativos' && 'Nenhum profissional ativo encontrado com os filtros informados.'}
            {activeTab === 'inativos' && 'Nenhum profissional inativo registrado.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map(prof => {
            const isPending = prof.status === 'pendente' || prof.status === 'em_analise';
            const isInactive = prof.status === 'inativo' || prof.status === 'recusado';

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
                  
                  {/* CABEÇALHO */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">
                        {prof.name}
                      </h3>
                      <span className="text-xs text-sky-600 font-bold block mt-0.5">
                        {prof.specialty || 'Clínica Médica'}
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

                  {/* IDENTIFICAÇÃO */}
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between">
                      <span>CRM / Registro:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{prof.document || '—'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>CPF:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{prof.cpf || '—'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Telefone:</span>
                      <span className="text-slate-800 dark:text-slate-200 font-medium">{prof.phone || '—'}</span>
                    </div>
                  </div>

                  {/* FINANCEIRO */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-1 text-xs">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                      <span>Modelo</span>
                      <span className="text-sky-600 font-black">{(prof.remuneration_type || 'hora').toUpperCase()}</span>
                    </div>

                    <div className="flex justify-between items-center font-bold text-slate-800 dark:text-slate-200">
                      <span>Base:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-black">
                        {prof.remuneration_type === 'diaria' 
                          ? `${formatCurrency(prof.daily_rate)} / plantão`
                          : prof.remuneration_type === 'mensal'
                          ? `${formatCurrency(prof.monthly_salary)} / mês`
                          : `${formatCurrency(prof.hourly_rate || 120)} / hora`}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px]">
                      <span>Retenção Coop:</span>
                      <span className={safeNumber(prof.coop_tax_rate) > 0 ? 'font-bold text-amber-600' : 'text-slate-400'}>
                        {safeNumber(prof.coop_tax_rate)}%
                      </span>
                    </div>

                    {prof.pix_key && (
                      <div className="pt-1.5 mt-1.5 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-[10px]">
                        <span className="text-slate-400">PIX ({prof.pix_type || 'CPF'}):</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{prof.pix_key}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* AÇÕES */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  {isPending ? (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => handleApprove(prof)} 
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 gap-1 shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
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

      {/* MODAL: CRIAR OU EDITAR PROFISSIONAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-600" />
              {editingProf ? 'Editar Perfil & Parâmetros do Médico' : 'Cadastrar Novo Profissional'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveProfessional} className="space-y-4 py-2 text-xs">
            
            {/* DADOS CADASTRAIS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-bold">Nome Completo *</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Dr(a)..." className="h-9" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Especialidade Principal *</Label>
                <Input value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})} placeholder="Ex: Clínica Médica" className="h-9" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Registro Conselho (CRM/COREN) *</Label>
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
                <Label className="text-xs font-bold">E-mail Profissional (Login) *</Label>
                <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="medico@hospital.com" className="h-9" />
              </div>
            </div>

            {/* SEÇÃO DE ACESSO, SENHA E WHATSAPP */}
            <div className="p-4 rounded-2xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-xs text-sky-900 dark:text-sky-200 uppercase tracking-wider">
                  <KeyRound className="w-4 h-4 text-sky-600" />
                  Credenciais de Acesso & Notificação
                </div>

                <Button 
                  type="button" 
                  size="sm" 
                  variant="outline" 
                  onClick={handleGeneratePassword} 
                  className="h-7 text-[11px] gap-1 font-bold border-sky-300 text-sky-600 hover:bg-sky-100 dark:hover:bg-sky-900/40"
                >
                  <RefreshCw className="w-3 h-3" /> Gerar Nova Senha
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    {editingProf ? 'Redefinir Senha (opcional)' : 'Definir Senha de Acesso *'}
                  </Label>
                  <Input 
                    type="text" 
                    value={formData.password} 
                    onChange={e => setFormData({...formData, password: e.target.value})} 
                    placeholder={editingProf ? 'Deixe em branco para não alterar' : 'Digite a senha inicial'} 
                    className="h-9 bg-white dark:bg-slate-900 font-mono" 
                  />
                </div>

                <div>
                  <Button 
                    type="button" 
                    onClick={() => handleSendWhatsApp(editingProf || formData, formData.password)}
                    className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" /> Enviar Acesso via WhatsApp
                  </Button>
                </div>
              </div>
            </div>

            {/* SEÇÃO CONTRATUAL E FINANCEIRA */}
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
                      <SelectItem value="diaria">Diarista (R$/plantão)</SelectItem>
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
                  <Label className="text-[11px] font-bold">Retenção Cooperativa (%)</Label>
                  <Input type="number" step="0.1" value={formData.coop_tax_rate} onChange={e => setFormData({...formData, coop_tax_rate: e.target.value})} placeholder="Ex: 5" className="h-9" />
                </div>
              </div>
            </div>

            {/* SEÇÃO DADOS BANCÁRIOS / PIX */}
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