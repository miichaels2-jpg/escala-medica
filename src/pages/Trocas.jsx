import React, { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Repeat, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Plus, 
  Search,
  Calendar, 
  Stethoscope, 
  ArrowRight, 
  ShieldAlert, 
  Loader2,
  Globe,
  Inbox,
  Send,
  ShieldCheck,
  MessageCircle,
  Building2,
  UserCheck,
  Handshake,
  User
} from 'lucide-react';

const statusBadge = {
  pendente: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30',
  aprovada: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
  rejeitada: 'bg-red-500/10 text-red-800 dark:text-red-300 border-red-500/30',
  cancelada: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
};

function toTitleCase(str) {
  if (!str) return '';
  const acr = ['UTI', 'UCO', 'PA', 'PS', 'CRM', 'COREN'];
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => {
      const upper = word.toUpperCase();
      if (acr.includes(upper)) return upper;
      if (['de', 'da', 'do', 'das', 'dos', 'e'].includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export default function Trocas() {
  const { user, company, loading } = useAppData();
  const [swaps, setSwaps] = useState([]);
  const [allShifts, setAllShifts] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  
  const [activeTab, setActiveTab] = useState('received');

  // Formulário
  const [swapType, setSwapType] = useState('cessao'); // 'cessao', 'direta', 'mural'
  const [selectedOwnerProfessionalId, setSelectedOwnerProfessionalId] = useState('');
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [targetProfessionalId, setTargetProfessionalId] = useState('');
  const [swapReason, setSwapReason] = useState('');

  const isAdmin = user?.role === 'admin';
  const isManager = isAdmin || user?.data?.app_role === 'manager' || user?.data?.app_role === 'gestor';
  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id || 'unit_h1';
  
  const myProfessional = useMemo(() => {
    const uId = user?.id;
    const uEmail = user?.email;
    const uName = user?.full_name;
    return (professionals || []).find((p) => p.user_id === uId || (p.email && p.email === uEmail) || p.name === uName);
  }, [professionals, user]);

  const currentProfessionalId = myProfessional?.id || user?.data?.professional_id;

  const loadData = async () => {
    if (!companyId) return;
    setLoadingData(true);
    try {
      const filterBase = { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) };

      const [allSwaps, allProfessionals, shiftsRes] = await Promise.all([
        base44.entities.ShiftSwap.filter(filterBase, '-created_date', 500).catch(() => []),
        base44.entities.Professional.filter(filterBase, '-created_date', 400).catch(() => []),
        base44.entities.Shift.filter(filterBase, '-date', 600).catch(() => [])
      ]);

      setProfessionals(allProfessionals || []);
      setSwaps(allSwaps || []);
      setAllShifts(shiftsRes || []);
    } catch (err) {
      console.error('Erro ao carregar trocas:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!loading) loadData();
  }, [loading, companyId, unitId]);

  const modalAvailableShifts = useMemo(() => {
    if (isManager) {
      if (!selectedOwnerProfessionalId) return [];
      const prof = professionals.find((p) => String(p.id) === String(selectedOwnerProfessionalId));
      if (!prof) return [];
      return allShifts.filter((sh) => String(sh.professional_id) === String(prof.id) || sh.professional_name === prof.name);
    } else {
      return allShifts.filter((sh) => String(sh.professional_id) === String(currentProfessionalId) || sh.professional_name === myProfessional?.name);
    }
  }, [isManager, selectedOwnerProfessionalId, professionals, allShifts, currentProfessionalId, myProfessional]);

  const currentSelectedShift = useMemo(() => {
    return allShifts.find((sh) => String(sh.id) === String(selectedShiftId)) || null;
  }, [allShifts, selectedShiftId]);

  const requesterProfessional = useMemo(() => {
    if (!currentSelectedShift) return isManager ? professionals.find(p => String(p.id) === String(selectedOwnerProfessionalId)) : myProfessional;
    return professionals.find((p) => String(p.id) === String(currentSelectedShift.professional_id)) || myProfessional;
  }, [currentSelectedShift, isManager, selectedOwnerProfessionalId, professionals, myProfessional]);

  const eligibleProfessionals = useMemo(() => {
    if (!requesterProfessional) return [];
    
    const targetSpecialty = (requesterProfessional.specialty || '').trim().toLowerCase();
    const targetCategory = (requesterProfessional.category || '').trim().toLowerCase();

    return professionals.filter((p) => {
      if (String(p.id) === String(requesterProfessional.id)) return false;
      if (p.status === 'inativo') return false;

      const pSpecialty = (p.specialty || '').trim().toLowerCase();
      const pCategory = (p.category || '').trim().toLowerCase();

      if (targetSpecialty) return pSpecialty === targetSpecialty;
      return pCategory === targetCategory;
    });
  }, [requesterProfessional, professionals]);

  // Criação segura da Solicitação sem invoke
  const handleCreateSwap = async (e) => {
    e.preventDefault();
    if (!currentSelectedShift) {
      alert('Por favor, selecione o plantão a ser passado.');
      return;
    }

    const isMural = swapType === 'mural';
    if (!isMural && !targetProfessionalId) {
      alert('Selecione o profissional substituto.');
      return;
    }

    const targetProf = !isMural 
      ? professionals.find((p) => String(p.id) === String(targetProfessionalId)) 
      : null;

    setSubmitting(true);
    try {
      const payload = {
        company_id: companyId,
        unit_id: unitId || currentSelectedShift.unit_id,
        shift_id: currentSelectedShift.id,
        shift_date: currentSelectedShift.date,
        shift_time: `${currentSelectedShift.start_time || '07:00'} - ${currentSelectedShift.end_time || '19:00'}`,
        sector_name: currentSelectedShift.sector_name || 'Geral',
        requester_professional_id: requesterProfessional?.id || currentProfessionalId,
        requester_name: requesterProfessional?.name || user?.full_name,
        requester_specialty: requesterProfessional?.specialty || requesterProfessional?.category || 'Clínica Geral',
        target_professional_id: isMural ? null : targetProf?.id,
        target_name: isMural ? 'Mural Aberto (Qualquer Colega)' : targetProf?.name,
        target_specialty: isMural ? requesterProfessional?.specialty : (targetProf?.specialty || targetProf?.category),
        swap_type: swapType,
        reason: swapReason.trim(),
        status: isManager ? 'aprovada' : 'pendente'
      };

      await base44.entities.ShiftSwap.create(payload);

      if (isManager && currentSelectedShift.id && targetProf) {
        await base44.entities.Shift.update(currentSelectedShift.id, {
          professional_id: targetProf.id,
          professional_name: targetProf.name,
          notes: `Plantão transferido por solicitação do Gestor para ${targetProf.name}`
        });
      }

      setDialogOpen(false);
      setSelectedShiftId('');
      setSelectedOwnerProfessionalId('');
      setTargetProfessionalId('');
      setSwapReason('');
      setSwapType('cessao');
      await loadData();
    } catch (err) {
      // Fallback sem swap_type se o banco ainda não tiver a coluna
      try {
        const payloadFallback = {
          company_id: companyId,
          unit_id: unitId || currentSelectedShift.unit_id,
          shift_id: currentSelectedShift.id,
          shift_date: currentSelectedShift.date,
          shift_time: `${currentSelectedShift.start_time || '07:00'} - ${currentSelectedShift.end_time || '19:00'}`,
          sector_name: currentSelectedShift.sector_name || 'Geral',
          requester_professional_id: requesterProfessional?.id || currentProfessionalId,
          requester_name: requesterProfessional?.name || user?.full_name,
          requester_specialty: requesterProfessional?.specialty || requesterProfessional?.category || 'Clínica Geral',
          target_professional_id: isMural ? null : targetProf?.id,
          target_name: isMural ? 'Mural Aberto (Qualquer Colega)' : targetProf?.name,
          target_specialty: isMural ? requesterProfessional?.specialty : (targetProf?.specialty || targetProf?.category),
          reason: swapReason.trim(),
          status: 'pendente'
        };
        await base44.entities.ShiftSwap.create(payloadFallback);
        setDialogOpen(false);
        setSelectedShiftId('');
        setSelectedOwnerProfessionalId('');
        setTargetProfessionalId('');
        setSwapReason('');
        setSwapType('cessao');
        await loadData();
      } catch (innerErr) {
        alert(innerErr.message || 'Não foi possível solicitar a troca.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (swap, newStatus) => {
    const actionLabel = newStatus === 'aprovada' ? 'aprovar e homologar' : 'rejeitar';
    if (!confirm(`Deseja realmente ${actionLabel} esta solicitação de troca?`)) return;

    try {
      await base44.entities.ShiftSwap.update(swap.id, { status: newStatus });

      if (newStatus === 'aprovada' && swap.shift_id && swap.target_professional_id) {
        await base44.entities.Shift.update(swap.shift_id, {
          professional_id: swap.target_professional_id,
          professional_name: swap.target_name,
          notes: `Plantão transferido de ${swap.requester_name} via módulo de Trocas`
        });
      }

      await loadData();
    } catch (err) {
      alert(err.message || 'Erro ao processar troca.');
    }
  };

  const handleClaimMuralShift = async (swap) => {
    if (!myProfessional && !currentProfessionalId && !isManager) {
      alert('Você precisa ter um perfil profissional vinculado para assumir este plantão.');
      return;
    }

    const claimingProf = myProfessional || professionals.find((p) => String(p.id) === String(currentProfessionalId)) || professionals[0];
    if (!claimingProf) {
      alert('Perfil profissional não localizado para atribuição.');
      return;
    }

    if (!confirm(`Confirmar interesse em assumir o plantão de ${swap.requester_name} em ${swap.shift_date}?`)) return;

    try {
      await base44.entities.ShiftSwap.update(swap.id, {
        target_professional_id: claimingProf.id,
        target_name: claimingProf.name,
        target_specialty: claimingProf.specialty || claimingProf.category,
        status: 'aprovada'
      });

      if (swap.shift_id) {
        await base44.entities.Shift.update(swap.shift_id, {
          professional_id: claimingProf.id,
          professional_name: claimingProf.name,
          notes: `Plantão assumido do Mural por ${claimingProf.name}`
        });
      }

      await loadData();
      alert('Plantão assumido e atribuído com sucesso à sua escala!');
    } catch (err) {
      alert(err.message || 'Erro ao assumir plantão.');
    }
  };

  const handleNotifyWhatsApp = (swap, e) => {
    if (e) e.stopPropagation();
    const prof = professionals.find((p) => String(p.id) === String(swap.target_professional_id));
    const phone = prof?.phone?.replace(/\D/g, '');
    const dateFmt = swap.shift_date ? swap.shift_date.split('-').reverse().join('/') : '';
    
    const text = encodeURIComponent(
      `Olá, Dr(a). ${swap.target_name || ''}!\n\nO Dr(a). *${swap.requester_name}* solicitou a transferência do plantão:\n🏥 Unidade: *${company?.name || 'Hospital'}*\n📅 Data: *${dateFmt}*\n⏰ Horário: *${swap.shift_time}*\n📍 Setor: *${swap.sector_name}*\n\nPor favor, acesse o sistema ScaleMedic para aceitar e confirmar a assunção do turno. Obrigado!`
    );

    if (phone) {
      window.open(`https://wa.me/55${phone}?text=${text}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${text}`, '_blank');
    }
  };

  const searchedSwaps = useMemo(() => {
    return swaps.filter((s) => {
      if (!search) return true;
      const term = search.toLowerCase();
      return (
        (s.requester_name || '').toLowerCase().includes(term) ||
        (s.target_name || '').toLowerCase().includes(term) ||
        (s.sector_name || '').toLowerCase().includes(term)
      );
    });
  }, [swaps, search]);

  const tabReceived = useMemo(() => {
    return searchedSwaps.filter((s) => 
      String(s.target_professional_id) === String(currentProfessionalId) && s.status === 'pendente'
    );
  }, [searchedSwaps, currentProfessionalId]);

  const tabSent = useMemo(() => {
    return searchedSwaps.filter((s) => 
      String(s.requester_professional_id) === String(currentProfessionalId)
    );
  }, [searchedSwaps, currentProfessionalId]);

  const tabMural = useMemo(() => {
    return searchedSwaps.filter((s) => 
      (!s.target_professional_id || s.swap_type === 'mural' || s.target_name?.toLowerCase().includes('mural')) && s.status === 'pendente'
    );
  }, [searchedSwaps]);

  const activeSwapsList = useMemo(() => {
    if (activeTab === 'received') return isManager ? searchedSwaps.filter((s) => s.status === 'pendente') : tabReceived;
    if (activeTab === 'sent') return tabSent;
    if (activeTab === 'mural') return tabMural;
    return searchedSwaps;
  }, [activeTab, isManager, searchedSwaps, tabReceived, tabSent, tabMural]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-400">
              <Repeat className="w-4 h-4" /> Gestão de Cobertura Hospitalar
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-tight">Trocas & Cessões de Plantão</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Substituições diretas com amarração de especialidade, doações para o mural aberto e validação médica.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              onClick={() => setDialogOpen(true)} 
              className="bg-sky-600 hover:bg-sky-500 text-white font-bold gap-2 text-xs h-10 px-5 rounded-xl shadow-lg shadow-sky-950"
            >
              <Plus className="w-4 h-4" /> Nova Solicitação de Troca
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('received')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'received'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>{isManager ? 'Pendentes de Homologação' : 'Pedidos para Mim'}</span>
            {(isManager ? searchedSwaps.filter((s) => s.status === 'pendente').length : tabReceived.length) > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                {isManager ? searchedSwaps.filter((s) => s.status === 'pendente').length : tabReceived.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('sent')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'sent'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Minhas Solicitações</span>
            <span className="text-[10px] opacity-70">({tabSent.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('mural')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'mural'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-sky-600" />
            <span>Mural de Oportunidades</span>
            {tabMural.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-sky-500 text-white text-[10px] font-black flex items-center justify-center">
                {tabMural.length}
              </span>
            )}
          </button>

          {isManager && (
            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Histórico Completo</span>
            </button>
          )}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Filtrar por médico ou setor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {loadingData ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
        </div>
      ) : activeSwapsList.length === 0 ? (
        <Card className="p-16 text-center border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
          <Repeat className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">Nenhuma troca nesta categoria</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {activeTab === 'received' && 'Você não possui nenhum pedido de troca pendente de resposta.'}
            {activeTab === 'sent' && 'Você ainda não solicitou nenhuma troca ou cessão de plantão.'}
            {activeTab === 'mural' && 'Nenhum plantão em aberto no mural neste momento.'}
            {activeTab === 'all' && 'Nenhum registro de troca localizado com este filtro.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeSwapsList.map((swap) => {
            const isTarget = String(swap.target_professional_id) === String(currentProfessionalId);
            const isRequester = String(swap.requester_professional_id) === String(currentProfessionalId);
            const isMuralCard = !swap.target_professional_id || swap.swap_type === 'mural';
            const canAction = isManager || isTarget;

            return (
              <Card 
                key={swap.id} 
                className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between space-y-4 shadow-sm ${
                  isMuralCard 
                    ? 'border-sky-300 bg-sky-50/30 dark:bg-sky-950/10' 
                    : swap.status === 'pendente'
                    ? 'border-amber-300/80 bg-white dark:bg-slate-900'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <Calendar className="w-4 h-4 text-sky-600" />
                      <span>{swap.shift_date ? swap.shift_date.split('-').reverse().join('/') : 'Data a definir'}</span>
                      <span className="text-slate-400">· {swap.shift_time || '12h'}</span>
                    </div>

                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${statusBadge[swap.status] || 'bg-slate-100 text-slate-600'}`}>
                      {swap.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Setor: <b>{toTitleCase(swap.sector_name) || 'Geral'}</b></span>
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Cede o Plantão</span>
                      <strong className="text-slate-900 dark:text-white text-xs block truncate">
                        {toTitleCase(swap.requester_name)}
                      </strong>
                      <span className="text-[10px] text-sky-600 font-medium truncate block">
                        {swap.requester_specialty || 'Especialidade'}
                      </span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

                    <div className="min-w-0 flex-1 text-right">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Assume o Plantão</span>
                      <strong className={`text-xs block truncate ${isMuralCard ? 'text-sky-700 font-black' : 'text-slate-900 dark:text-white'}`}>
                        {isMuralCard ? 'Mural Aberto' : toTitleCase(swap.target_name)}
                      </strong>
                      <span className="text-[10px] text-slate-500 truncate block">
                        {isMuralCard ? 'Disponível' : (swap.target_specialty || 'Especialidade')}
                      </span>
                    </div>
                  </div>

                  {swap.reason && (
                    <p className="text-xs text-slate-500 italic bg-slate-50/50 p-2 rounded-lg">
                      "{swap.reason}"
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  {isMuralCard && swap.status === 'pendente' && !isRequester && (
                    <Button
                      size="sm"
                      onClick={() => handleClaimMuralShift(swap)}
                      className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-8 gap-1.5 shadow-sm"
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Assumir este Plantão
                    </Button>
                  )}

                  {!isMuralCard && swap.status === 'pendente' && canAction && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(swap, 'aprovada')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 gap-1 shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(swap, 'rejeitada')}
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50 text-xs h-8 gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Recusar
                      </Button>
                    </>
                  )}

                  {!isMuralCard && swap.target_professional_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => handleNotifyWhatsApp(swap, e)}
                      className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs h-8 px-2.5"
                      title="Enviar aviso de confirmação no WhatsApp do colega"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold dark:text-white flex items-center gap-2">
              <Handshake className="w-5 h-5 text-sky-600" /> Solicitar Troca ou Cessão de Plantão
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateSwap} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Modalidade de Substituição
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSwapType('cessao')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                    swapType === 'cessao'
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 ring-2 ring-sky-500/20'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Cessão / Doação
                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5">Mão única</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSwapType('direta')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                    swapType === 'direta'
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 ring-2 ring-sky-500/20'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Troca Direta
                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5">1 por 1</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSwapType('mural')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                    swapType === 'mural'
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 ring-2 ring-sky-500/20'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Mural Aberto
                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5">Todos do setor</span>
                </button>
              </div>
            </div>

            {isManager && (
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-sky-600" /> 1. Quem é o profissional que quer passar o plantão?
                </Label>
                <Select value={selectedOwnerProfessionalId} onValueChange={(val) => {
                  setSelectedOwnerProfessionalId(val);
                  setSelectedShiftId('');
                  setTargetProfessionalId('');
                }}>
                  <SelectTrigger className="h-10 text-xs bg-white dark:bg-slate-900">
                    <SelectValue placeholder="Selecione o médico / profissional..." />
                  </SelectTrigger>
                  <SelectContent>
                    {professionals.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name} ({p.specialty || p.category || 'Geral'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {isManager ? '2. Selecione o plantão deste profissional' : 'Selecione o plantão a ser passado'}
              </Label>
              <Select 
                value={selectedShiftId} 
                onValueChange={(val) => {
                  setSelectedShiftId(val);
                  setTargetProfessionalId('');
                }}
                disabled={isManager && !selectedOwnerProfessionalId}
              >
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue placeholder={isManager && !selectedOwnerProfessionalId ? "Primeiro selecione o profissional acima..." : "Escolha o plantão na escala..."} />
                </SelectTrigger>
                <SelectContent>
                  {modalAvailableShifts.length === 0 ? (
                    <div className="p-3 text-xs text-slate-500 text-center">
                      Nenhum plantão localizado para este profissional.
                    </div>
                  ) : (
                    modalAvailableShifts.map((shift) => (
                      <SelectItem key={shift.id} value={shift.id} className="text-xs">
                        {shift.date?.split('-').reverse().join('/')} ({shift.start_time} - {shift.end_time}) · {toTitleCase(shift.sector_name) || 'Geral'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {requesterProfessional && (
              <div className="rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-950/30 p-3 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-sky-700 dark:text-sky-300">Especialidade vinculada: </span>
                  <b>{requesterProfessional.specialty || requesterProfessional.category || 'Clínica Geral'}</b>.
                </div>
              </div>
            )}

            {swapType !== 'mural' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Profissional substituto da mesma especialidade</Label>
                <Select 
                  value={targetProfessionalId} 
                  onValueChange={setTargetProfessionalId}
                  disabled={!selectedShiftId}
                >
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder={!selectedShiftId ? "Primeiro escolha o plantão acima" : "Selecione o colega..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleProfessionals.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500 text-center">
                        Nenhum colega ativo com a mesma especialidade encontrado.
                      </div>
                    ) : (
                      eligibleProfessionals.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.name} ({p.specialty || p.category})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Motivo da solicitação (opcional)</Label>
              <Input
                value={swapReason}
                onChange={(e) => setSwapReason(e.target.value)}
                placeholder="Ex: Conflito de agenda, congresso médico ou emergência pessoal"
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="text-xs">
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={submitting || !selectedShiftId || (swapType !== 'mural' && !targetProfessionalId)}
                className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-5"
              >
                {submitting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                {swapType === 'mural' ? 'Publicar no Mural' : 'Enviar Solicitação'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}