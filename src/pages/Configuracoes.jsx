import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Building2, Save, UserPlus, Trash2, 
  Settings, Hospital, ShieldCheck, FileText,
  Mail, MapPin, Edit, Plus, RotateCcw, Activity
} from 'lucide-react';

function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Configuracoes() {
  const { user, company, units = [], selectedUnitId, loading, refreshAllData } = useAppData();
  
  const [activeTab, setActiveTab] = useState('unidade_atual');
  const [companies, setCompanies] = useState([]);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  
  const activeUnits = units?.length > 0 ? units : (company?.data?.units || []);
  const currentUnit = activeUnits.find(u => String(u.id) === String(selectedUnitId));

  const [unitForm, setUnitForm] = useState({ name: '', address: '', phone: '', primary_contact: '', status: 'ativo' });
  const [contractForm, setContractForm] = useState({ name: '', cnpj: '', billing_cycle: 'mensal', contract_start: '', contract_end: '' });
  
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');

  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [newUnitForm, setNewUnitForm] = useState({ name: '', address: '', status: 'ativo' });

  const isAdmin = user?.role === 'admin' || user?.app_role === 'gestor';
  const companyId = user?.data?.company_id || user?.company_id || company?.id;

  const loadCompanies = async () => {
    try {
      const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
      setCompanies(data || []);
    } catch (e) {}
  };

  const loadUsers = async () => {
    if (!companyId) return;
    try {
      // Busca todos e a gente frita localmente para não dar erro de schema
      const { data } = await supabase.from('users').select('*');
      const filtered = (data || []).filter(u => u.data?.company_id === companyId || u.company_id === companyId);
      setCompanyUsers(filtered);
    } catch (e) {}
  };

  useEffect(() => {
    if (loading) return;
    if (isAdmin) loadCompanies();
    loadUsers();
    
    if (company) {
      setContractForm({ 
        name: company.name || '', 
        cnpj: company.cnpj || '', 
        billing_cycle: company.data?.billing_cycle || 'mensal',
        contract_start: company.data?.contract_start || '',
        contract_end: company.data?.contract_end || ''
      });
    }
  }, [loading, company, isAdmin]);

  useEffect(() => {
    if (currentUnit) {
      setUnitForm({
        name: currentUnit.name || '',
        address: currentUnit.address || '',
        phone: currentUnit.phone || '',
        primary_contact: currentUnit.primary_contact || '',
        status: currentUnit.status || 'ativo'
      });
    }
  }, [currentUnit, selectedUnitId]);

  const visibleUsers = useMemo(() => {
    return companyUsers.filter(u => {
      if (isAdmin || u.role === 'admin') return true;
      const userUnit = u.unit_id || u.data?.unit_id || u.selected_unit_id || u.data?.selected_unit_id;
      return !userUnit || String(userUnit) === String(selectedUnitId);
    });
  }, [companyUsers, selectedUnitId, isAdmin]);

  const handleSaveCurrentUnit = async (e) => {
    e.preventDefault();
    if (!currentUnit) return;
    setSaving(true);
    try {
      let updatedUnits = activeUnits.map(u => String(u.id) === String(currentUnit.id) ? { ...u, ...unitForm } : u);
      
      const { error } = await supabase.from('companies').update({
        data: { ...(company?.data || {}), units: updatedUnits }
      }).eq('id', companyId);

      if (error) throw error;
      
      refreshAllData();
      alert(`Dados do hospital "${unitForm.name}" atualizados com sucesso!`);
    } catch (err) {
      alert(err.message || 'Erro ao salvar unidade');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContract = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: contractForm.name,
        cnpj: contractForm.cnpj,
        data: {
          ...(company?.data || {}),
          billing_cycle: contractForm.billing_cycle,
          contract_start: contractForm.contract_start,
          contract_end: contractForm.contract_end
        }
      };

      if (company?.id) {
        await supabase.from('companies').update(payload).eq('id', company.id);
      } else {
        const { data: newCompany } = await supabase.from('companies').insert(payload).select().single();
        if (newCompany && user?.id) {
          await supabase.from('users').update({ data: { ...(user.data||{}), company_id: newCompany.id }, role: 'admin' }).eq('id', user.id);
        }
      }
      refreshAllData();
      alert('Contrato matriz atualizado com sucesso!');
    } catch (err) { alert(err.message || 'Erro ao salvar contrato'); } 
    finally { setSaving(false); }
  };

  const handleRenewContract = async () => {
    if (!company || !contractForm.contract_end) {
      alert('Defina uma Data de Vencimento atual antes de renovar.');
      return;
    }
    
    setSaving(true);
    try {
      const end = new Date(contractForm.contract_end + 'T12:00:00');
      if (contractForm.billing_cycle === 'mensal') end.setMonth(end.getMonth() + 1);
      else if (contractForm.billing_cycle === 'trimestral') end.setMonth(end.getMonth() + 3);
      else if (contractForm.billing_cycle === 'semestral') end.setMonth(end.getMonth() + 6);
      else if (contractForm.billing_cycle === 'anual') end.setFullYear(end.getFullYear() + 1);

      const newEnd = getLocalDateString(end);
      
      const payload = { data: { ...(company?.data || {}), contract_end: newEnd } };
      await supabase.from('companies').update(payload).eq('id', company.id);
      
      setContractForm(prev => ({ ...prev, contract_end: newEnd }));
      refreshAllData();
      alert(`Contrato renovado com sucesso! Novo vencimento: ${newEnd.split('-').reverse().join('/')}`);
    } catch (err) { alert(err.message); } 
    finally { setSaving(false); }
  };

  const openUnitModal = (unit = null) => {
    if (unit) {
      setEditingUnit(unit);
      setNewUnitForm({ name: unit.name || '', address: unit.address || '', status: unit.status || 'ativo' });
    } else {
      setEditingUnit(null);
      setNewUnitForm({ name: '', address: '', status: 'ativo' });
    }
    setUnitModalOpen(true);
  };

  const handleSaveNewUnit = async (e) => {
    e.preventDefault();
    if (!newUnitForm.name.trim()) return alert('O nome do hospital é obrigatório.');
    setSaving(true);
    try {
      const payload = { name: newUnitForm.name.trim(), address: newUnitForm.address, status: newUnitForm.status };
      
      let updatedUnits = [...activeUnits];
      if (editingUnit?.id) {
        updatedUnits = updatedUnits.map(u => String(u.id) === String(editingUnit.id) ? { ...u, ...payload } : u);
      } else {
        updatedUnits.push({ id: 'unit_' + Date.now(), ...payload });
      }
      
      await supabase.from('companies').update({ 
        data: { ...(company?.data || {}), units: updatedUnits }
      }).eq('id', companyId);
      
      setUnitModalOpen(false);
      refreshAllData();
    } catch (err) { alert('Erro ao salvar hospital: ' + err.message); } 
    finally { setSaving(false); }
  };

  const handleDeleteUnit = async (id, name) => {
    if (!confirm(`Deseja remover o hospital "${name}"? Suas escalas ficarão órfãs.`)) return;
    try { 
      const updatedUnits = activeUnits.filter(u => String(u.id) !== String(id));
      await supabase.from('companies').update({ 
        data: { ...(company?.data || {}), units: updatedUnits }
      }).eq('id', companyId);
      
      refreshAllData(); 
    } catch (err) { alert('Erro ao excluir: ' + err.message); }
  };

  // AQUI FOI CORRIGIDO O ERRO DE SCHEMA DO USUÁRIO
  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSaving(true);
    try {
      const payload = {
        email: inviteEmail,
        username: inviteEmail.split('@')[0],
        password: 'changeme123',
        full_name: 'Usuário Convidado',
        role: inviteRole === 'admin' ? 'admin' : 'user',
        is_active: true,
        data: { 
          company_id: companyId,
          unit_id: selectedUnitId,
          allowed_unit_ids: [selectedUnitId],
          status: 'pendente',
          app_role: inviteRole === 'admin' ? 'gestor' : 'assistencial'
        }
      };

      const { error } = await supabase.from('users').insert([payload]);
      if (error && error.code !== '23505') throw error; 

      setInviteEmail('');
      loadUsers();
      alert(`Acesso liberado! O profissional ${inviteEmail} já pode fazer login na unidade ${currentUnit?.name || 'Hospital Atual'}.`);
    } catch (err) { alert(err.message || 'Erro ao liberar acesso'); } 
    finally { setSaving(false); }
  };

  const handleSelectCompany = async (id) => {
    if (!user?.id) return;
    await supabase.from('users').update({ data: { ...(user.data||{}), company_id: id } }).eq('id', user.id);
    refreshAllData();
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B1120]">
        <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 p-4 md:p-8 space-y-6 font-sans transition-colors duration-300">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] p-6 md:p-8 shadow-xl flex flex-col xl:flex-row xl:items-center justify-between gap-6 transition-colors duration-300">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-sky-600 dark:text-cyan-400">
            <Settings className="w-4 h-4 text-sky-600 dark:text-cyan-400 animate-spin-slow" /> Ajustes Globais
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Painel de Configurações
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-2xl">
            Gerencie o contrato da sua empresa com o ScaleMedic, edite os dados do Hospital selecionado ou convide sua equipe.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: 'unidade_atual', label: 'Hospital Atual', icon: Hospital },
          { id: 'contrato', label: 'Contrato Matriz', icon: FileText },
          { id: 'unidades', label: 'Gerenciar Hospitais', icon: Building2 },
          { id: 'usuarios', label: 'Equipe & Acessos', icon: ShieldCheck },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              className={`px-6 py-4 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2.5 shrink-0 border ${
                isActive 
                  ? 'bg-sky-600 dark:bg-cyan-600 text-white border-sky-600 dark:border-cyan-500 shadow-md shadow-sky-600/20 dark:shadow-cyan-900/50' 
                  : 'bg-white dark:bg-[#1e293b] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
        {activeTab === 'unidade_atual' && (
          <div className="max-w-4xl">
            <Card className="p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] shadow-sm">
              <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4 flex items-start justify-between">
                <div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <Hospital className="w-5 h-5 text-sky-600 dark:text-cyan-400" /> Dados do Hospital Selecionado
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Você está editando as informações da unidade ativada no menu superior. Elas aparecerão nos relatórios deste hospital.
                  </p>
                </div>
                {currentUnit && (
                  <span className="text-[10px] font-black uppercase px-3 py-1 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    Sincronizado
                  </span>
                )}
              </div>

              {!currentUnit ? (
                <div className="py-12 text-center text-sm font-bold text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
                  Nenhum hospital selecionado no topo da tela.
                </div>
              ) : (
                <form onSubmit={handleSaveCurrentUnit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome Oficial do Hospital *</Label>
                      <Input value={unitForm.name} onChange={(e) => setUnitForm(p => ({...p, name: e.target.value}))} required className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Endereço Completo</Label>
                      <Input value={unitForm.address} onChange={(e) => setUnitForm(p => ({...p, address: e.target.value}))} placeholder="Ex: Av. Paulista, 1000 - Bela Vista" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Telefone da Recepção / Posto</Label>
                      <Input value={unitForm.phone} onChange={(e) => setUnitForm(p => ({...p, phone: e.target.value}))} placeholder="(00) 0000-0000" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Coordenador/Responsável Local</Label>
                      <Input value={unitForm.primary_contact} onChange={(e) => setUnitForm(p => ({...p, primary_contact: e.target.value}))} placeholder="Nome do médico chefe" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <Button type="submit" disabled={saving} className="h-11 bg-sky-600 hover:bg-sky-700 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-black text-xs px-8 rounded-xl shadow-md cursor-pointer transition-all">
                      {saving ? 'Processando...' : <><Save className="w-4 h-4 mr-1.5" /> Salvar Hospital</>}
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'contrato' && (
          <div className="max-w-4xl">
            <Card className="p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] shadow-sm">
              <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Gestão de Contrato & Matriz
                </h3>
                <p className="text-xs text-slate-500 mt-1">Dados de faturamento e vigência do seu contrato com a ScaleMedic. Esta empresa pode gerenciar quantos hospitais quiser.</p>
              </div>

              <form onSubmit={handleSaveContract} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Razão Social (Empresa Pagadora) *</Label>
                    <Input value={contractForm.name} onChange={(e) => setContractForm(p => ({...p, name: e.target.value}))} required className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-bold" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">CNPJ</Label>
                    <Input value={contractForm.cnpj} onChange={(e) => setContractForm(p => ({...p, cnpj: e.target.value}))} placeholder="00.000.000/0000-00" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Ciclo de Faturamento</Label>
                    <Select value={contractForm.billing_cycle} onValueChange={v => setContractForm(p => ({...p, billing_cycle: v}))}>
                      <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="trimestral">Trimestral</SelectItem>
                        <SelectItem value="semestral">Semestral</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-indigo-800 dark:text-indigo-300">Início do Contrato</Label>
                      <Input type="date" value={contractForm.contract_start} onChange={(e) => setContractForm(p => ({...p, contract_start: e.target.value}))} className="h-10 bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 text-slate-900 dark:text-white rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-indigo-800 dark:text-indigo-300">Vencimento do Contrato</Label>
                      <Input type="date" value={contractForm.contract_end} onChange={(e) => setContractForm(p => ({...p, contract_end: e.target.value}))} className="h-10 bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 text-slate-900 dark:text-white rounded-xl font-bold" />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between gap-3">
                  <Button type="button" onClick={handleRenewContract} disabled={saving} variant="outline" className="h-11 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200 font-black text-xs px-6 rounded-xl cursor-pointer">
                    <RotateCcw className="w-4 h-4 mr-1.5" /> Renovar Automaticamente
                  </Button>
                  <Button type="submit" disabled={saving} className="h-11 bg-slate-900 hover:bg-slate-800 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 font-black text-xs px-8 rounded-xl shadow-md cursor-pointer transition-all">
                    {saving ? 'Processando...' : <><Save className="w-4 h-4 mr-1.5" /> Salvar Contrato</>}
                  </Button>
                </div>
              </form>
            </Card>

            {isAdmin && (
              <div className="space-y-4 mt-6">
                <Card className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] shadow-sm">
                  <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-rose-500" /> Modo Super Admin
                  </h3>
                  <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">
                    Você tem privilégios totais. Abaixo estão todas as empresas/contratos isolados no sistema. Selecione para "entrar" na visão de cada um.
                  </p>
                  
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {companies.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">Nenhuma empresa mapeada.</p>
                    ) : (
                      companies.map((c) => (
                        <div key={c.id} className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-black text-slate-900 dark:text-white truncate">{c.name}</div>
                            <div className="text-[9px] text-slate-500 font-mono mt-0.5">{c.cnpj || 'Sem CNPJ'}</div>
                          </div>
                          <Button 
                            variant={company?.id === c.id ? 'default' : 'outline'} 
                            size="sm" 
                            onClick={() => handleSelectCompany(c.id)}
                            className={`h-7 text-[10px] font-black rounded-lg shrink-0 cursor-pointer ${company?.id === c.id ? 'bg-sky-600 text-white border-transparent' : 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300'}`}
                          >
                            {company?.id === c.id ? 'Em Uso' : 'Acessar'}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}

        {activeTab === 'unidades' && (
          <Card className="p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6 gap-4">
              <div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-sky-600 dark:text-cyan-400" /> Cadastrar Múltiplos Hospitais
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Adicione novos hospitais que pertencem a este contrato. Eles aparecerão no seletor de "Unidade" no topo da tela.
                </p>
              </div>
              <Button onClick={() => openUnitModal()} className="shrink-0 h-10 bg-sky-600 hover:bg-sky-700 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-black text-xs px-5 rounded-xl shadow-md cursor-pointer">
                <Plus className="w-4 h-4 mr-1.5" /> Adicionar Hospital
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeUnits.length === 0 ? (
                <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50 dark:bg-slate-900/50">
                  <Hospital className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <h4 className="text-sm font-black text-slate-600 dark:text-slate-400">Nenhum hospital cadastrado</h4>
                </div>
              ) : (
                activeUnits.map(u => (
                  <div key={u.id} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-sky-300 dark:hover:border-sky-700 transition-all flex flex-col justify-between h-full">
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400">
                          <Hospital className="w-5 h-5" />
                        </div>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                          u.status === 'inativo' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        }`}>
                          {u.status || 'Ativo'}
                        </span>
                      </div>
                      <h4 className="text-base font-black text-slate-900 dark:text-white leading-tight mb-1">{u.name}</h4>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-2">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{u.address || 'Endereço não informado'}</span>
                      </div>
                    </div>
                    <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => handleDeleteUnit(u.id, u.name)} className="h-8 text-[10px] font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg px-2.5 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
                      </Button>
                      <Button variant="outline" onClick={() => openUnitModal(u)} className="h-8 text-[10px] font-bold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg px-3 cursor-pointer">
                        <Edit className="w-3.5 h-3.5 mr-1" /> Editar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Dialog open={unitModalOpen} onOpenChange={setUnitModalOpen}>
              <DialogContent className="w-[95vw] sm:max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-2xl rounded-3xl p-6">
                <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <DialogTitle className="text-base font-black flex items-center gap-2 text-sky-600 dark:text-sky-400">
                    <Hospital className="w-5 h-5" /> {editingUnit ? 'Editar Hospital' : 'Adicionar Novo Hospital'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSaveNewUnit} className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome do Hospital / Unidade *</Label>
                    <Input value={newUnitForm.name} onChange={e => setNewUnitForm({...newUnitForm, name: e.target.value})} placeholder="Ex: Hospital Municipal Central" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl font-bold" required autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Endereço de Localização</Label>
                    <Input value={newUnitForm.address} onChange={e => setNewUnitForm({...newUnitForm, address: e.target.value})} placeholder="Rua, Número, Bairro, Cidade" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Status Operacional</Label>
                    <Select value={newUnitForm.status} onValueChange={v => setNewUnitForm({...newUnitForm, status: v})}>
                      <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
                        <SelectItem value="ativo" className="text-emerald-600 font-bold">Ativo (Permite Escalas)</SelectItem>
                        <SelectItem value="inativo" className="text-rose-500 font-bold">Inativo (Apenas Histórico)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800 gap-2 sm:gap-0 mt-2">
                    <Button type="button" variant="outline" onClick={() => setUnitModalOpen(false)} className="h-10 text-xs font-bold rounded-xl px-4 cursor-pointer border-slate-200 dark:border-slate-700">Cancelar</Button>
                    <Button type="submit" disabled={saving} className="h-10 bg-sky-600 hover:bg-sky-700 text-white font-black text-xs px-6 rounded-xl cursor-pointer">Salvar Hospital</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </Card>
        )}

        {activeTab === 'usuarios' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-1 space-y-6">
              <Card className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] shadow-sm">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                  <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-emerald-500" /> Liberar Acesso
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Libere acesso ao hospital <strong className="text-slate-700 dark:text-slate-300">{currentUnit?.name || 'selecionado'}</strong> para sua equipe.
                  </p>
                </div>
                
                <form onSubmit={handleInvite} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">E-mail do Profissional</Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input type="email" placeholder="medico@hospital.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required className="pl-9 h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nível de Acesso</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-bold text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
                        <SelectItem value="user">Usuário Comum (Médico / Visualizador)</SelectItem>
                        <SelectItem value="admin">Administrador (Gestor / Acesso Total)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" disabled={saving || !inviteEmail} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-colors">
                    {saving ? 'Liberando...' : 'Liberar Acesso Exclusivo'}
                  </Button>
                </form>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                  <div>
                    <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-cyan-400" /> Controle de Acessos
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Visão consolidada dos usuários com acesso ao hospital <b>{currentUnit?.name || 'selecionado'}</b>.</p>
                  </div>
                  <span className="text-xs font-black px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl">
                    {visibleUsers.length} Logins
                  </span>
                </div>
                
                {visibleUsers.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    Nenhum usuário mapeado para este hospital.
                  </div>
                ) : (
                  <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2">
                    {visibleUsers.map((u) => (
                      <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/40 hover:border-sky-200 dark:hover:border-sky-900/50 transition-colors gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-black text-slate-500 dark:text-slate-400 text-xs shrink-0 ring-1 ring-slate-300 dark:ring-slate-700">
                            {(u.full_name || u.email || 'U').substring(0, 2).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                              {u.full_name || 'Usuário Pendente'}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {u.email}
                            </div>
                          </div>
                        </div>
                        <span className={`shrink-0 text-[10px] font-black uppercase px-2.5 py-1 rounded-lg text-center ${
                          u.role === 'admin' 
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800' 
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                        }`}>
                          {u.role === 'admin' ? 'Administrador' : 'Acesso Comum'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}