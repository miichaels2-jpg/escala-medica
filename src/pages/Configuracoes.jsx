import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Building2, Save, UserPlus, Users, Trash2, 
  Settings, Hospital, Activity, ShieldCheck, 
  Mail, MapPin, Edit, Plus, X, Phone
} from 'lucide-react';

export default function Configuracoes() {
  const { user, company, units = [], loading, refresh } = useAppData();
  
  const [activeTab, setActiveTab] = useState('instituicao');
  const [companies, setCompanies] = useState([]);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  
  // Form da Instituição Principal
  const [form, setForm] = useState({ name: '', app_name: '', cnpj: '', phone: '', address: '', primary_contact: '', logo_url: '', accent_color: '#0ea5e9' });
  
  // Form de Convites
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');

  // Controle de Modal de Hospitais (Unidades)
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [unitForm, setUnitForm] = useState({ name: '', address: '', status: 'ativo' });

  const isAdmin = user?.role === 'admin';
  const companyId = user?.data?.company_id || company?.id;

  const loadCompanies = async () => {
    try { setCompanies(await base44.entities.Company.list('-created_date', 100)); } catch (e) {}
  };

  const loadUsers = async () => {
    if (!companyId) return;
    try { setCompanyUsers(await base44.entities.User.list('-created_date', 100)); } catch (e) {}
  };

  useEffect(() => {
    if (loading) return;
    if (isAdmin) loadCompanies();
    loadUsers();
    if (company) {
      setForm({ 
        name: company.name || '', 
        app_name: company.app_name || '', 
        cnpj: company.cnpj || '', 
        phone: company.phone || '', 
        address: company.address || '', 
        primary_contact: company.primary_contact || '', 
        logo_url: company.logo_url || '', 
        accent_color: company.accent_color || '#0ea5e9' 
      });
    }
  }, [loading, company, isAdmin]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // =========================================================================
  // LOGICA: INSTITUIÇÃO
  // =========================================================================
  const handleSaveCompany = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (company) {
        await base44.entities.Company.update(company.id, form);
      } else {
        const created = await base44.entities.Company.create(form);
        await base44.auth.updateMe({ data: { company_id: created.id, app_role: 'manager' } });
      }
      refresh();
      alert('Dados da instituição salvos com sucesso!');
    } catch (err) {
      alert(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectCompany = async (id) => {
    await base44.auth.updateMe({ data: { company_id: id } });
    refresh();
  };

  // =========================================================================
  // LOGICA: HOSPITAIS / UNIDADES DE ATENDIMENTO
  // =========================================================================
  const openUnitModal = (unit = null) => {
    if (unit) {
      setEditingUnit(unit);
      setUnitForm({ name: unit.name || '', address: unit.address || '', status: unit.status || 'ativo' });
    } else {
      setEditingUnit(null);
      setUnitForm({ name: '', address: '', status: 'ativo' });
    }
    setUnitModalOpen(true);
  };

  const handleSaveUnit = async (e) => {
    e.preventDefault();
    if (!unitForm.name.trim()) return alert('O nome do hospital é obrigatório.');
    
    setSaving(true);
    try {
      const payload = { 
        company_id: companyId, 
        name: unitForm.name.trim(), 
        address: unitForm.address, 
        status: unitForm.status 
      };

      if (editingUnit?.id) {
        await base44.entities.Unit.update(editingUnit.id, payload);
      } else {
        await base44.entities.Unit.create(payload);
      }
      
      setUnitModalOpen(false);
      refresh();
    } catch (err) {
      alert('Erro ao salvar hospital: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUnit = async (id, name) => {
    if (!confirm(`Tem certeza que deseja remover o hospital "${name}"? Todas as escalas atreladas a ele ficarão órfãs.`)) return;
    try {
      await base44.entities.Unit.delete(id);
      refresh();
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  // =========================================================================
  // LOGICA: USUÁRIOS E CONVITES
  // =========================================================================
  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSaving(true);
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole);
      setInviteEmail('');
      loadUsers();
      alert('Convite enviado com sucesso para ' + inviteEmail);
    } catch (err) {
      alert(err.message || 'Erro ao convidar');
    } finally {
      setSaving(false);
    }
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
      
      {/* HEADER EXECUTIVO */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] p-6 md:p-8 shadow-xl flex flex-col xl:flex-row xl:items-center justify-between gap-6 transition-colors duration-300">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-sky-600 dark:text-cyan-400">
            <Settings className="w-4 h-4 text-sky-600 dark:text-cyan-400 animate-spin-slow" /> Ajustes Globais
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Painel de Configurações
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-2xl">
            Gerencie os dados da instituição matriz, cadastre múltiplos hospitais vinculados ao seu contrato e controle os acessos da equipe.
          </p>
        </div>
      </div>

      {/* ABAS DE NAVEGAÇÃO */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: 'instituicao', label: 'Dados da Instituição', icon: Building2 },
          { id: 'unidades', label: 'Hospitais (Unidades)', icon: Hospital },
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
        
        {/* ========================================================================= */}
        {/* ABA: DADOS DA INSTITUIÇÃO (MATRIZ) */}
        {/* ========================================================================= */}
        {activeTab === 'instituicao' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] shadow-sm">
                <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-sky-600 dark:text-cyan-400" /> Instituição / Contrato Matriz
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Estas informações representam a empresa principal (CNPJ matriz) que gerencia os hospitais.</p>
                </div>

                <form onSubmit={handleSaveCompany} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Razão Social (Nome da Empresa) *</Label>
                      <Input value={form.name} onChange={(e) => set('name', e.target.value)} required className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome de Exibição (Marca)</Label>
                      <Input value={form.app_name} onChange={(e) => set('app_name', e.target.value)} placeholder="Ex: ScaleMedic Hospitais" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">CNPJ Matriz</Label>
                      <Input value={form.cnpj} onChange={(e) => set('cnpj', e.target.value)} placeholder="00.000.000/0000-00" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Telefone Principal</Label>
                      <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(00) 0000-0000" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Responsável Legal (Contato)</Label>
                      <Input value={form.primary_contact} onChange={(e) => set('primary_contact', e.target.value)} placeholder="Nome do Gestor" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
                    </div>
                    
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Logomarca do Relatório</Label>
                      <div className="flex items-center gap-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
                        {form.logo_url ? (
                          <img src={form.logo_url} alt="Logo" className="h-16 w-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm shrink-0 bg-white" />
                        ) : (
                          <div className="h-16 w-16 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                            Sem Logo
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (e) => set('logo_url', e.target?.result || '');
                            reader.readAsDataURL(file);
                          }}
                          className="block w-full text-xs text-slate-600 dark:text-slate-400 file:mr-4 file:rounded-xl file:border-0 file:bg-sky-100 dark:file:bg-sky-900/30 file:px-4 file:py-2 file:text-xs file:font-black file:text-sky-700 dark:file:text-sky-400 hover:file:bg-sky-200 transition-colors cursor-pointer"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Endereço Sede</Label>
                      <Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Endereço fiscal completo" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <Button type="submit" disabled={saving} className="h-11 bg-sky-600 hover:bg-sky-700 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-black text-xs px-8 rounded-xl shadow-md cursor-pointer transition-all">
                      {saving ? 'Processando...' : <><Save className="w-4 h-4 mr-1.5" /> Salvar Configurações</>}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>

            {isAdmin && (
              <div className="space-y-4">
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

        {/* ========================================================================= */}
        {/* ABA: HOSPITAIS / UNIDADES DE ATENDIMENTO */}
        {/* ========================================================================= */}
        {activeTab === 'unidades' && (
          <Card className="p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6 gap-4">
              <div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Hospital className="w-5 h-5 text-sky-600 dark:text-cyan-400" /> Múltiplos Hospitais (Unidades)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Se você atende diferentes hospitais no mesmo contrato, cadastre-os aqui. Eles aparecerão no seletor de "Unidade" no topo da tela para organizar as escalas sem misturar dados.
                </p>
              </div>
              <Button onClick={() => openUnitModal()} className="shrink-0 h-10 bg-sky-600 hover:bg-sky-700 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-black text-xs px-5 rounded-xl shadow-md cursor-pointer">
                <Plus className="w-4 h-4 mr-1.5" /> Adicionar Hospital
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {units.length === 0 ? (
                <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50 dark:bg-slate-900/50">
                  <Hospital className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <h4 className="text-sm font-black text-slate-600 dark:text-slate-400">Nenhum hospital cadastrado</h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Clique no botão acima para adicionar sua primeira unidade de atendimento.</p>
                </div>
              ) : (
                units.map(u => (
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

            {/* MODAL DE HOSPITAL */}
            <Dialog open={unitModalOpen} onOpenChange={setUnitModalOpen}>
              <DialogContent className="w-[95vw] sm:max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-2xl rounded-3xl p-6">
                <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <DialogTitle className="text-base font-black flex items-center gap-2 text-sky-600 dark:text-sky-400">
                    <Hospital className="w-5 h-5" /> {editingUnit ? 'Editar Hospital' : 'Adicionar Novo Hospital'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSaveUnit} className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome do Hospital / Unidade *</Label>
                    <Input value={unitForm.name} onChange={e => setUnitForm({...unitForm, name: e.target.value})} placeholder="Ex: Hospital Municipal Central" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl font-bold" required autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Endereço de Localização</Label>
                    <Input value={unitForm.address} onChange={e => setUnitForm({...unitForm, address: e.target.value})} placeholder="Rua, Número, Bairro, Cidade" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Status Operacional</Label>
                    <Select value={unitForm.status} onValueChange={v => setUnitForm({...unitForm, status: v})}>
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

        {/* ========================================================================= */}
        {/* ABA: EQUIPE & ACESSOS */}
        {/* ========================================================================= */}
        {activeTab === 'usuarios' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            <div className="lg:col-span-1 space-y-6">
              <Card className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] shadow-sm">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                  <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-emerald-500" /> Enviar Convite
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Libere acesso ao sistema para médicos, coordenadores ou faturistas através do e-mail.
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
                    {saving ? 'Enviando...' : 'Enviar Convite Exclusivo'}
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
                    <p className="text-xs text-slate-500 mt-0.5">Visão consolidada de todos os usuários com login ativo no sistema.</p>
                  </div>
                  <span className="text-xs font-black px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl">
                    {companyUsers.length} Logins Ativos
                  </span>
                </div>
                
                {companyUsers.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    Nenhum usuário mapeado além de você.
                  </div>
                ) : (
                  <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2">
                    {companyUsers.map((u) => (
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