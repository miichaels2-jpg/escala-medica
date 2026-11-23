import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PageHero from '@/components/PageHero';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import WorkloadRulesCard from '@/components/WorkloadRulesCard';
import { 
  Building2, Save, Trash2, 
  Settings, Hospital, FileText, MapPin, Edit, Plus, RotateCcw, AlertTriangle, Phone, Copy, Image as ImageIcon, UploadCloud
} from 'lucide-react';

function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getUnitStorageErrorMessage(error) {
  if (error?.code === 'PGRST205' || error?.code === '42P01') {
    return 'Aplique a migração de unidades no Supabase antes de gerenciar hospitais por UUID.';
  }
  if (error?.code === '23503') {
    return 'Não é possível remover o hospital enquanto houver escalas, setores, profissionais ou faturamentos vinculados a ele.';
  }
  return error?.message || 'Erro ao salvar unidade.';
}

const MAX_LOGO_FILE_BYTES = 2 * 1024 * 1024;
const LOGO_MAX_DIMENSION = 600;

// A tabela units exige legacy_id; hospitais novos usam o próprio UUID nos dois campos.
function generateUnitId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Lê a logomarca, confirma que o navegador consegue exibi-la (evita salvar
// arquivos que sairiam em branco nos impressos) e reduz imagens grandes para
// no máximo 600px, mantendo a transparência de PNGs.
function readLogoAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    reader.onload = () => {
      const original = String(reader.result || '');
      const img = new Image();
      img.onerror = () => reject(new Error('Este formato de imagem não pode ser exibido pelo navegador. Use PNG ou JPG.'));
      img.onload = () => {
        const largestSide = Math.max(img.naturalWidth, img.naturalHeight);
        if (file.type === 'image/svg+xml' || !largestSide || largestSide <= LOGO_MAX_DIMENSION) {
          resolve(original);
          return;
        }
        const scale = LOGO_MAX_DIMENSION / largestSide;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const optimized = file.type === 'image/jpeg'
          ? canvas.toDataURL('image/jpeg', 0.9)
          : canvas.toDataURL('image/png');
        resolve(optimized.length < original.length ? optimized : original);
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}

export default function Configuracoes() {
  const { user, company, units = [], selectedUnitId, loading, refreshAllData } = useAppData();
  
  const [activeTab, setActiveTab] = useState('unidade_atual');
  const [saving, setSaving] = useState(false);
  
  const activeUnits = units?.length > 0 ? units : (company?.data?.units || []);
  const currentUnit = activeUnits.find(u => String(u.id) === String(selectedUnitId));

  const [unitForm, setUnitForm] = useState({ name: '', address: '', phone: '', email: '', cnpj: '', primary_contact: '', logo_url: '', status: 'ativo' });
  const [contractForm, setContractForm] = useState({ name: '', cnpj: '', billing_cycle: 'mensal', contract_start: '', contract_end: '', logo_url: '' });
  

  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [newUnitForm, setNewUnitForm] = useState({ 
    name: '', cnpj: '', address: '', phone: '', email: '', primary_contact: '', logo_url: '', status: 'ativo' 
  });

  const companyId = user?.data?.company_id || user?.company_id || company?.id || 'cmp_principal';

  useEffect(() => {
    if (loading) return;
    
    if (company) {
      setContractForm({ 
        name: company.name || '', 
        cnpj: company.cnpj || company.data?.cnpj || '', 
        billing_cycle: company.data?.billing_cycle || 'mensal',
        contract_start: company.data?.contract_start || '',
        contract_end: company.data?.contract_end || '',
        logo_url: company.logo_url || company.data?.logo_url || ''
      });
    }
  }, [loading, company]);

  useEffect(() => {
    if (currentUnit) {
      setUnitForm({
        name: currentUnit.name || '',
        cnpj: currentUnit.cnpj || '',
        address: currentUnit.address || '',
        phone: currentUnit.phone || '',
        email: currentUnit.email || '',
        primary_contact: currentUnit.primary_contact || '',
        logo_url: currentUnit.logo_url || '',
        status: currentUnit.status || 'ativo'
      });
    }
  }, [currentUnit, selectedUnitId]);

  const daysToExpiration = useMemo(() => {
    if (!contractForm.contract_end) return null;
    const endDate = new Date(contractForm.contract_end + 'T23:59:59');
    const now = new Date();
    return Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
  }, [contractForm.contract_end]);

  // FUNÇÃO UNIVERSAL DE UPLOAD DE ARQUIVO (Imagem -> Base64)
  const handleImageUpload = async (e, setFormState) => {
    const input = e.target;
    const file = input.files?.[0];
    // Limpa o campo para que escolher o mesmo arquivo de novo (ex.: depois de
    // "Remover Imagem") volte a disparar o carregamento.
    input.value = '';
    if (!file) return;

    if (!String(file.type || '').startsWith('image/')) {
      alert('Selecione um arquivo de imagem (PNG ou JPG).');
      return;
    }
    if (file.size > MAX_LOGO_FILE_BYTES) {
      alert('A imagem é muito grande. Escolha uma logo com tamanho máximo de 2MB.');
      return;
    }

    try {
      const logoDataUrl = await readLogoAsDataUrl(file);
      setFormState(prev => ({ ...prev, logo_url: logoDataUrl }));
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSaveCurrentUnit = async (e) => {
    e.preventDefault();
    if (!currentUnit) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('units')
        .update(unitForm)
        .eq('id', currentUnit.id)
        .eq('company_id', companyId);
      if (error) throw error;
      
      await refreshAllData();
      alert(`Dados do hospital "${unitForm.name}" atualizados com sucesso!`);
    } catch (err) {
      alert(getUnitStorageErrorMessage(err));
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
        logo_url: contractForm.logo_url,
        data: {
          ...(company?.data || {}),
          billing_cycle: contractForm.billing_cycle,
          contract_start: contractForm.contract_start,
          contract_end: contractForm.contract_end,
          logo_url: contractForm.logo_url
        }
      };

      const { data: existingComp } = await supabase.from('companies').select('id').eq('id', companyId).maybeSingle();

      if (existingComp) {
        const { error } = await supabase.from('companies').update(payload).eq('id', companyId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('companies').insert([{ id: companyId, ...payload }]);
        if (error) throw error;
      }
      
      await refreshAllData();
      alert('Contrato matriz e logotipo atualizados com sucesso!');
    } catch (err) { 
      alert('Erro ao salvar contrato: ' + (err.message || 'Falha de comunicação com o banco.')); 
    } finally { 
      setSaving(false); 
    }
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
      
      const { error } = await supabase.from('companies').update(payload).eq('id', companyId);
      if (error) throw error;

      setContractForm(prev => ({ ...prev, contract_end: newEnd }));
      await refreshAllData();
      alert(`Contrato renovado com sucesso! Novo vencimento: ${newEnd.split('-').reverse().join('/')}`);
    } catch (err) { 
      alert('Erro ao renovar: ' + err.message); 
    } finally { 
      setSaving(false); 
    }
  };

  const openUnitModal = (unit = null) => {
    if (unit) {
      setEditingUnit(unit);
      setNewUnitForm({ 
        name: unit.name || '', cnpj: unit.cnpj || '', address: unit.address || '', 
        phone: unit.phone || '', email: unit.email || '', primary_contact: unit.primary_contact || '', 
        logo_url: unit.logo_url || '', status: unit.status || 'ativo' 
      });
    } else {
      setEditingUnit(null);
      setNewUnitForm({ name: '', cnpj: '', address: '', phone: '', email: '', primary_contact: '', logo_url: '', status: 'ativo' });
    }
    setUnitModalOpen(true);
  };

  const handleSaveNewUnit = async (e) => {
    e.preventDefault();
    if (!newUnitForm.name.trim()) return alert('O nome do hospital é obrigatório.');
    setSaving(true);
    try {
      let request;
      if (editingUnit?.id) {
        request = supabase
          .from('units')
          .update(newUnitForm)
          .eq('id', editingUnit.id)
          .eq('company_id', companyId);
      } else {
        const newUnitId = generateUnitId();
        request = supabase
          .from('units')
          .insert([{ ...newUnitForm, id: newUnitId, legacy_id: newUnitId, company_id: companyId }]);
      }
      const { error } = await request;
      if (error) throw error;
      
      setUnitModalOpen(false);
      await refreshAllData();
      alert('Hospital salvo com sucesso!');
    } catch (err) {
      alert('Erro ao salvar hospital: ' + getUnitStorageErrorMessage(err));
    } finally { 
      setSaving(false); 
    }
  };

  const handleDeleteUnit = async (id, name) => {
    if (!confirm(`Deseja remover o hospital "${name}"? A remoção só será permitida se nenhum dado ainda depender desta unidade.`)) return;
    try { 
      const [{ data: users, error: usersError }, { data: linkedProfessionals, error: professionalsError }] = await Promise.all([
        supabase.from('users').select('id,data'),
        supabase.from('professionals').select('id,unit_ids,data').eq('company_id', companyId)
      ]);
      if (usersError) throw usersError;
      if (professionalsError) throw professionalsError;

      const hasUserAccess = (users || []).some(appUser => {
        if (String(appUser.data?.company_id) !== String(companyId)) return false;
        const allowedIds = Array.isArray(appUser.data?.allowed_unit_ids)
          ? appUser.data.allowed_unit_ids.map(String)
          : [];
        return allowedIds.includes(String(id)) || String(appUser.data?.selected_unit_id) === String(id);
      });
      const hasProfessionalAccess = (linkedProfessionals || []).some(professional => {
        const allowedIds = Array.isArray(professional.data?.allowed_unit_ids)
          ? professional.data.allowed_unit_ids
          : Array.isArray(professional.unit_ids) ? professional.unit_ids : [];
        return allowedIds.map(String).includes(String(id));
      });
      if (hasUserAccess || hasProfessionalAccess) {
        alert('Reatribua primeiro o acesso de usuários e profissionais para outro hospital antes de remover esta unidade.');
        return;
      }

      const replacementUnitId = activeUnits.find(unit => String(unit.id) !== String(id))?.id || null;
      const companySelectedUnitId = company?.selected_unit_id || company?.data?.selected_unit_id;
      if (String(companySelectedUnitId) === String(id)) {
        const nextData = { ...(company.data || {}) };
        if (String(nextData.selected_unit_id) === String(id)) {
          nextData.selected_unit_id = replacementUnitId;
        }
        const { error: companyError } = await supabase
          .from('companies')
          .update({ selected_unit_id: replacementUnitId, data: nextData })
          .eq('id', companyId);
        if (companyError) throw companyError;
      }

      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);
      if (error) throw error;
      
      await refreshAllData(); 
    } catch (err) { alert('Erro ao excluir: ' + getUnitStorageErrorMessage(err)); }
  };

  const handleAutoFillFromContract = () => {
    setNewUnitForm(prev => ({
      ...prev,
      name: contractForm.name || prev.name,
      cnpj: contractForm.cnpj || prev.cnpj
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-8 space-y-6 font-sans transition-colors duration-300">
      <PageHero
        title="Configurações"
        subtitle="Contrato da empresa com o ScaleMedic, dados do hospital selecionado e acessos da equipe."
      />

      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: 'unidade_atual', label: 'Hospital Atual', icon: Hospital },
          { id: 'contrato', label: 'Contrato Matriz', icon: FileText },
          { id: 'unidades', label: 'Gerenciar Hospitais', icon: Building2 },
          { id: 'regras', label: 'Regras da escala', icon: Settings },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              className={`px-6 py-4 rounded-2xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2.5 shrink-0 border ${
                isActive 
                  ? 'bg-sky-600 dark:bg-cyan-600 text-white border-sky-600 dark:border-cyan-500 shadow-sm' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
        
        {/* ABA: HOSPITAL ATUAL */}
        {activeTab === 'unidade_atual' && (
          <div className="max-w-4xl">
            <Card className="p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <Hospital className="w-5 h-5 text-sky-600 dark:text-cyan-400" /> Dados do Hospital Selecionado
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Você está editando as informações da unidade ativada no menu superior. Elas aparecerão nos relatórios deste hospital.
                  </p>
                </div>
                {currentUnit && (
                  <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    Sincronizado
                  </span>
                )}
              </div>

              {!currentUnit ? (
                <div className="py-12 text-center text-sm font-semibold text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
                  Nenhum hospital selecionado no topo da tela.
                </div>
              ) : (
                <form onSubmit={handleSaveCurrentUnit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    
                    {/* NOVO: UPLOAD DE ARQUIVO DA UNIDADE */}
                    <div className="space-y-2 sm:col-span-2 border-b border-slate-100 dark:border-slate-800 pb-5 mb-1">
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><ImageIcon className="w-4 h-4 text-sky-500" /> Logomarca da Unidade</Label>
                      <p className="text-[10px] text-slate-500">Selecione uma imagem do seu computador (PNG ou JPG). Ela sairá impressa nos relatórios desta unidade específica.</p>
                      
                      <div className="flex items-center gap-4 mt-2">
                        <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-900 shrink-0">
                          {unitForm.logo_url ? (
                            <img src={unitForm.logo_url} alt="Logo Preview" className="w-full h-full object-contain p-1" />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <label className="flex items-center justify-center gap-2 w-full h-11 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <UploadCloud className="w-4 h-4 text-sky-600" />
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Procurar Imagem</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setUnitForm)} />
                          </label>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-slate-400">Tamanho máximo: 2MB</span>
                            {unitForm.logo_url && (
                              <button type="button" onClick={() => setUnitForm(prev => ({...prev, logo_url: ''}))} className="text-[10px] font-semibold text-rose-500 hover:underline">
                                Remover Imagem
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome Oficial do Hospital *</Label>
                      <Input value={unitForm.name} onChange={(e) => setUnitForm(p => ({...p, name: e.target.value}))} required className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">CNPJ do Hospital</Label>
                      <Input value={unitForm.cnpj} onChange={(e) => setUnitForm(p => ({...p, cnpj: e.target.value}))} placeholder="00.000.000/0000-00" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl tabular-nums" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Telefone da Recepção / Posto</Label>
                      <Input value={unitForm.phone} onChange={(e) => setUnitForm(p => ({...p, phone: e.target.value}))} placeholder="(00) 0000-0000" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Endereço Completo</Label>
                      <Input value={unitForm.address} onChange={(e) => setUnitForm(p => ({...p, address: e.target.value}))} placeholder="Ex: Av. Paulista, 1000 - Bela Vista" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">E-mail de Contato</Label>
                      <Input type="email" value={unitForm.email} onChange={(e) => setUnitForm(p => ({...p, email: e.target.value}))} placeholder="hospital@contato.com" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Coordenador / Responsável Local</Label>
                      <Input value={unitForm.primary_contact} onChange={(e) => setUnitForm(p => ({...p, primary_contact: e.target.value}))} placeholder="Nome do médico chefe / RT" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <Button type="submit" disabled={saving} className="h-11 bg-sky-600 hover:bg-sky-700 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-semibold text-xs px-8 rounded-xl shadow-sm cursor-pointer transition-all">
                      {saving ? 'Processando...' : <><Save className="w-4 h-4 mr-1.5" /> Salvar Hospital</>}
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          </div>
        )}

        {/* ABA: REGRAS DA ESCALA */}
        {activeTab === 'regras' && <WorkloadRulesCard />}

        {/* ABA: CONTRATO MATRIZ */}
        {activeTab === 'contrato' && (
          <div className="max-w-4xl">
            {daysToExpiration !== null && daysToExpiration <= 30 && daysToExpiration >= 0 && (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl flex items-start gap-3 animate-in fade-in">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-800 dark:text-amber-400 text-sm">Contrato próximo do vencimento</h4>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">Faltam apenas <strong>{daysToExpiration} dias</strong> para o vencimento do seu contrato com a ScaleMedic. Renove para evitar a suspensão dos acessos.</p>
                </div>
              </div>
            )}
            
            {daysToExpiration !== null && daysToExpiration < 0 && (
              <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl flex items-start gap-3 animate-in fade-in">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-rose-800 dark:text-rose-400 text-sm">Contrato Vencido</h4>
                  <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">Seu contrato expirou há <strong>{Math.abs(daysToExpiration)} dias</strong>. O sistema poderá ser bloqueado a qualquer momento.</p>
                </div>
              </div>
            )}

            <Card className="p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                <h3 className="font-semibold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Gestão de Contrato & Matriz
                </h3>
                <p className="text-xs text-slate-500 mt-1">Dados de faturamento, vigência e identidade corporativa da rede (Matriz). Esta logo sairá em todos os documentos da rede.</p>
              </div>

              <form onSubmit={handleSaveContract} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  
                  {/* NOVO: UPLOAD DE ARQUIVO DA MATRIZ */}
                  <div className="space-y-2 sm:col-span-2 border-b border-slate-100 dark:border-slate-800 pb-5 mb-1">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><ImageIcon className="w-4 h-4 text-indigo-500" /> Logomarca da Matriz / Rede</Label>
                    <p className="text-[10px] text-slate-500">Selecione a logomarca principal da rede no seu computador.</p>
                    
                    <div className="flex items-center gap-4 mt-2">
                      <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-900 shrink-0">
                        {contractForm.logo_url ? (
                          <img src={contractForm.logo_url} alt="Logo Preview" className="w-full h-full object-contain p-1" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="flex items-center justify-center gap-2 w-full h-11 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <UploadCloud className="w-4 h-4 text-indigo-600" />
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Procurar Imagem</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setContractForm)} />
                        </label>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-slate-400">Tamanho máximo: 2MB</span>
                          {contractForm.logo_url && (
                            <button type="button" onClick={() => setContractForm(prev => ({...prev, logo_url: ''}))} className="text-[10px] font-semibold text-rose-500 hover:underline">
                              Remover Imagem
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Razão Social (Empresa Pagadora) *</Label>
                    <Input value={contractForm.name} onChange={(e) => setContractForm(p => ({...p, name: e.target.value}))} required className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-semibold" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">CNPJ</Label>
                    <Input value={contractForm.cnpj} onChange={(e) => setContractForm(p => ({...p, cnpj: e.target.value}))} placeholder="00.000.000/0000-00" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl tabular-nums" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Ciclo de Faturamento</Label>
                    <Select value={contractForm.billing_cycle} onValueChange={v => setContractForm(p => ({...p, billing_cycle: v}))}>
                      <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-semibold">
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
                      <Label className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">Início do Contrato</Label>
                      <Input type="date" value={contractForm.contract_start} onChange={(e) => setContractForm(p => ({...p, contract_start: e.target.value}))} className="h-10 bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 text-slate-900 dark:text-white rounded-xl cursor-pointer" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">Vencimento do Contrato</Label>
                      <Input type="date" value={contractForm.contract_end} onChange={(e) => setContractForm(p => ({...p, contract_end: e.target.value}))} className="h-10 bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 text-slate-900 dark:text-white rounded-xl font-semibold cursor-pointer" />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between gap-3">
                  <Button type="button" onClick={handleRenewContract} disabled={saving} variant="outline" className="h-11 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200 font-semibold text-xs px-6 rounded-xl cursor-pointer">
                    <RotateCcw className="w-4 h-4 mr-1.5" /> Renovar Automaticamente
                  </Button>
                  <Button type="submit" disabled={saving} className="h-11 bg-slate-900 hover:bg-slate-800 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 font-semibold text-xs px-8 rounded-xl shadow-sm cursor-pointer transition-all">
                    {saving ? 'Processando...' : <><Save className="w-4 h-4 mr-1.5" /> Salvar Contrato</>}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* ABA: GERENCIAR UNIDADES */}
        {activeTab === 'unidades' && (
          <Card className="p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6 gap-4">
              <div>
                <h3 className="font-semibold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-sky-600 dark:text-cyan-400" /> Cadastrar Múltiplos Hospitais
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Adicione novos hospitais que pertencem a este contrato com logotipo independente, CNPJ, endereço e contatos completos.
                </p>
              </div>
              <Button onClick={() => openUnitModal()} className="shrink-0 h-10 bg-sky-600 hover:bg-sky-700 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-semibold text-xs px-5 rounded-xl shadow-sm cursor-pointer">
                <Plus className="w-4 h-4 mr-1.5" /> Adicionar Hospital
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeUnits.length === 0 ? (
                <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50 dark:bg-slate-900/50">
                  <Hospital className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">Nenhum hospital cadastrado</h4>
                </div>
              ) : (
                activeUnits.map(u => (
                  <div key={u.id} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-sky-300 dark:hover:border-sky-700 transition-all flex flex-col justify-between h-full">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="p-2.5 rounded-xl bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400">
                          {u.logo_url ? <img src={u.logo_url} className="w-5 h-5 object-contain" alt="logo" /> : <Hospital className="w-5 h-5" />}
                        </div>
                        <span className={`text-xs font-semibold  px-2 py-0.5 rounded-md ${
                          u.status === 'inativo' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        }`}>
                          {u.status || 'Ativo'}
                        </span>
                      </div>
                      <h4 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">{u.name}</h4>
                      <div className="break-all text-[10px] tabular-nums text-slate-500">ID: {u.id}</div>
                      <div className="text-[11px] tabular-nums font-semibold text-sky-600 dark:text-sky-400">CNPJ: {u.cnpj || 'Não informado'}</div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{u.address || 'Endereço não informado'}</span>
                      </div>
                      {u.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span>{u.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => handleDeleteUnit(u.id, u.name)} className="h-8 text-[10px] font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg px-2.5 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
                      </Button>
                      <Button variant="outline" onClick={() => openUnitModal(u)} className="h-8 text-[10px] font-semibold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg px-3 cursor-pointer">
                        <Edit className="w-3.5 h-3.5 mr-1" /> Editar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Dialog open={unitModalOpen} onOpenChange={setUnitModalOpen}>
              <DialogContent className="w-[95vw] sm:max-w-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-sm rounded-3xl p-6">
                <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <DialogTitle className="text-base font-semibold flex items-center gap-2 text-sky-600 dark:text-sky-400">
                    <Hospital className="w-5 h-5" /> {editingUnit ? 'Editar Hospital / Unidade' : 'Cadastrar Novo Hospital'}
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSaveNewUnit} className="space-y-4 py-2 text-xs">
                  {!editingUnit && contractForm.name && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={handleAutoFillFromContract}
                      className="w-full bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/30 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-400 font-semibold border border-sky-200 dark:border-sky-800 cursor-pointer h-9 mb-2"
                    >
                      <Copy className="w-3.5 h-3.5 mr-2" /> Preencher com dados do Contrato Matriz
                    </Button>
                  )}

                  {/* UPLOAD IMAGEM PARA MODAL DE NOVA UNIDADE */}
                  <div className="space-y-1.5 border-b border-slate-100 dark:border-slate-800 pb-4 mb-2">
                    <Label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5 text-sky-500" /> Logomarca da Unidade</Label>
                    
                    <div className="flex items-center gap-4 mt-2">
                      <div className="w-14 h-14 rounded-2xl border border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-900 shrink-0">
                        {newUnitForm.logo_url ? (
                          <img src={newUnitForm.logo_url} alt="Logo Preview" className="w-full h-full object-contain p-1" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="flex items-center justify-center gap-2 w-full h-10 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <UploadCloud className="w-4 h-4 text-sky-600" />
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Procurar Imagem</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setNewUnitForm)} />
                        </label>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-slate-400">Tamanho máximo: 2MB</span>
                          {newUnitForm.logo_url && (
                            <button type="button" onClick={() => setNewUnitForm(prev => ({ ...prev, logo_url: '' }))} className="text-[10px] font-semibold text-rose-500 hover:underline">
                              Remover Imagem
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700 dark:text-slate-300">Nome Oficial do Hospital *</Label>
                    <Input value={newUnitForm.name} onChange={e => setNewUnitForm({...newUnitForm, name: e.target.value})} placeholder="Ex: Hospital Municipal Central" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl font-semibold" required autoFocus />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="font-semibold text-slate-700 dark:text-slate-300">CNPJ da Unidade</Label>
                      <Input value={newUnitForm.cnpj} onChange={e => setNewUnitForm({...newUnitForm, cnpj: e.target.value})} placeholder="00.000.000/0000-00" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl tabular-nums" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-semibold text-slate-700 dark:text-slate-300">Telefone / Recepção</Label>
                      <Input value={newUnitForm.phone} onChange={e => setNewUnitForm({...newUnitForm, phone: e.target.value})} placeholder="(00) 0000-0000" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl tabular-nums" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700 dark:text-slate-300">Endereço Completo</Label>
                    <Input value={newUnitForm.address} onChange={e => setNewUnitForm({...newUnitForm, address: e.target.value})} placeholder="Rua, Número, Bairro, Cidade - UF" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="font-semibold text-slate-700 dark:text-slate-300">E-mail de Contato</Label>
                      <Input type="email" value={newUnitForm.email} onChange={e => setNewUnitForm({...newUnitForm, email: e.target.value})} placeholder="unidade@hospital.com" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-semibold text-slate-700 dark:text-slate-300">Responsável Local</Label>
                      <Input value={newUnitForm.primary_contact} onChange={e => setNewUnitForm({...newUnitForm, primary_contact: e.target.value})} placeholder="Nome do gestor / RT" className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700 dark:text-slate-300">Status Operacional</Label>
                    <Select value={newUnitForm.status} onValueChange={v => setNewUnitForm({...newUnitForm, status: v})}>
                      <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
                        <SelectItem value="ativo" className="text-emerald-600 font-semibold">Ativo (Permite Escalas)</SelectItem>
                        <SelectItem value="inativo" className="text-rose-500 font-semibold">Inativo (Apenas Histórico)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800 gap-2">
                    <Button type="button" variant="outline" onClick={() => setUnitModalOpen(false)} className="h-10 font-semibold rounded-xl px-4 cursor-pointer border-slate-200 dark:border-slate-700">Cancelar</Button>
                    <Button type="submit" disabled={saving} className="h-10 bg-sky-600 hover:bg-sky-700 text-white font-semibold px-6 rounded-xl cursor-pointer">Salvar Hospital</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </Card>
        )}


      </div>
    </div>
  );
}