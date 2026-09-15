import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  ShieldCheck, 
  Building2, 
  Plus, 
  Edit3, 
  Loader2, 
  Clock, 
  CheckCircle2, 
  PlusCircle,
  Share2,
  DollarSign,
  CreditCard,
  LayoutGrid,
  List,
  MessageCircle,
  Search,
  X,
  UserCheck,
  Hash
} from 'lucide-react';
import ProfessionalFormDialog from '@/components/professionals/ProfessionalFormDialog';

const DEFAULT_SECTORS = [
  { id: 'sec_uti_adulto', name: 'UTI Adulto', specialty: 'Medicina Intensiva' },
  { id: 'sec_emergencia', name: 'Emergência / Pronto-Socorro', specialty: 'Emergência' },
  { id: 'sec_bloco_cirurgico', name: 'Bloco Cirúrgico', specialty: 'Cirurgia Geral' },
  { id: 'sec_cardiologia', name: 'Cardiologia / UCO', specialty: 'Cardiologia' },
  { id: 'sec_pediatria', name: 'Pediatria e Pronto Atendimento', specialty: 'Pediatria' },
  { id: 'sec_clinica_medica', name: 'Enfermaria / Clínica Médica', specialty: 'Clínica Médica' }
];

function toTitleCase(str) {
  return typeof str === 'string' ? str.toLowerCase().split(' ').map(w => ['de','da','do','e'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';
}

export default function CorpoClinico() {
  const { user, company } = useAppData();
  const [professionals, setProfessionals] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Controle do Modal Modular
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState(null);

  const [activeTab, setActiveTab] = useState('ativos');
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const [newSpecialtyModal, setNewSpecialtyModal] = useState(false);
  const [newSpecialtyName, setNewSpecialtyName] = useState('');
  const [savingSpecialty, setSavingSpecialty] = useState(false);

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
      const pNotes = (p.notes || '').toLowerCase();
      return pName.includes(query) || pDoc.includes(query) || pSpec.includes(query) || pEmail.includes(query) || pNotes.includes(query);
    });
  }, [activeTab, activeList, pendingList, searchQuery]);

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
    const url = `${window.location.origin}/register`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setToastMessage('Link de auto-cadastro copiado com sucesso!');
      setTimeout(() => setToastMessage(''), 3000);
    } else {
      alert(`Link de auto-cadastro: ${url}`);
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

  const handleOpenNew = () => {
    setEditingProfessional(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (prof) => {
    setEditingProfessional(prof);
    setFormDialogOpen(true);
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
      setNewSpecialtyName('');
      setNewSpecialtyModal(false);
      setToastMessage('Especialidade criada com sucesso!');
      setTimeout(() => setToastMessage(''), 3000);
    } catch (e) {
      alert('Erro ao criar especialidade: ' + e.message);
    } finally {
      setSavingSpecialty(false);
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
            Gerenciamento cadastral, cooperativas médicas, repasses e aprovação de credenciamento.
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
            <Share2 className="w-4 h-4 text-sky-600" /> Copiar Link Auto-Cadastro
          </Button>
          
          <Button variant="outline" onClick={() => setNewSpecialtyModal(true)} className="gap-2">
            <PlusCircle className="w-4 h-4 text-sky-600" /> Nova Especialidade
          </Button>
          
          <Button onClick={handleOpenNew} className="bg-sky-600 hover:bg-sky-700 text-white gap-2 font-medium px-5">
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
            placeholder="Pesquisar por nome, CRM/COREN, matrícula, cooperativa, especialidade ou e-mail..."
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
              <p className="text-xs text-slate-500 mt-1">Quando os médicos utilizarem a rota <strong>/register</strong>, eles aparecerão aqui para validação.</p>
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
              const isInactive = prof.status === 'inativo';

              const remType = prof.remuneration_type || 'hora';
              const remLabel = 
                remType === 'hora' ? `R$ ${Number(prof.hourly_rate || 0).toLocaleString('pt-BR')}/hora` :
                remType === 'diaria' ? `R$ ${Number(prof.daily_rate || 0).toLocaleString('pt-BR')}/plantão` :
                `R$ ${Number(prof.monthly_salary || 0).toLocaleString('pt-BR')}/mês (Fixo)`;

              return (
                <Card
                  key={prof.id}
                  className={`p-5 border transition-all flex flex-col justify-between space-y-4 shadow-sm bg-white dark:bg-slate-900 ${
                    isInactive 
                      ? 'border-rose-300 dark:border-rose-900/60 opacity-70' 
                      : 'border-slate-200 dark:border-slate-800 hover:border-sky-300'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-slate-900 dark:text-white">{prof.name}</h3>
                          {isInactive && (
                            <span className="bg-rose-500/10 text-rose-500 text-[10px] font-black px-2 py-0.5 rounded-full border border-rose-500/20">
                              INATIVO
                            </span>
                          )}
                        </div>
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

                      {prof.notes && (
                        <div className="text-[11px] text-slate-400 pt-1 truncate border-t border-slate-100 dark:border-slate-800">
                          {prof.notes}
                        </div>
                      )}
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
                      onClick={() => handleEdit(prof)}
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
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:bg-slate-100" onClick={() => handleEdit(prof)} title="Editar">
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

      {/* COMPONENTE MODULAR COMPLETO COM TODOS OS CAMPOS NOVOS */}
      <ProfessionalFormDialog 
        open={formDialogOpen}
        onClose={() => setFormDialogOpen(false)}
        onSaved={loadData}
        professional={editingProfessional}
        companyId={companyId}
        units={units}
        specialties={specialties}
        onOpenNewSpecialty={() => setNewSpecialtyModal(true)}
      />

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