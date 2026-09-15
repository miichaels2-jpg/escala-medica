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
  User,
  AlertCircle
} from 'lucide-react';

const statusBadge = {
  pendente: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30',
  aguardando_homologacao: 'bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-500/30',
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
        base44.entities.Shift.filter(filterBase, '-date', 800).catch(() => [])
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

  // Função auxiliar de notificação interna (não quebra se a entidade não existir no schema)
  const createNotificationSilent = async (recipientProfId, title, message, shiftId = null) => {
    if (!recipientProfId || !base44.entities.Notification?.create) return;
    try {
      await base44.entities.Notification.create({
        company_id: companyId,
        unit_id: unitId,
        recipient_professional_id: recipientProfId,
        title,
        message,
        shift_id: shiftId,
        is_read: false,
        created_date: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Aviso: Notificação interna não persistida:', e.message);
    }
  };

  const modalAvailableShifts = useMemo(() => {
    if (isManager) {
      if (!selectedOwnerProfessionalId) return [];
      const prof = professionals.find((p) => String(p.id) === String(selectedOwnerProfessionalId));
      if (!prof) return [];
      return allShifts.filter((sh) => (String(sh.professional_id) === String(prof.id) || sh.professional_name === prof.name) && sh.status !== 'cancelado');
    } else {
      return allShifts.filter((sh) => (String(sh.professional_id) === String(currentProfessionalId) || sh.professional_name === myProfessional?.name) && sh.status !== 'cancelado');
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

  // Criação estruturada da solicitação com blindagem contra duplicidade
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

    // Bloqueio de duplicidade de solicitações pendentes para o mesmo plantão
    const existingActiveSwap = swaps.find(s => 
      String(s.shift_id) === String(currentSelectedShift.id) && 
      (s.status === 'pendente' || s.status === 'aguardando_homologacao')
    );

    if (existingActiveSwap) {
      alert('Já existe uma solicitação ativa ou pendente de homologação para este plantão!');
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
        target_name: isMural ? 'Mural de Oportunidades' : targetProf?.name,
        target_specialty: isMural ? requesterProfessional?.specialty : (targetProf?.specialty || targetProf?.category),
        swap_type: swapType,
        source_type: swapType,
        request_type: isMural ? 'mural' : 'troca',
        status: 'pendente',
        confirmation_status: isMural ? 'aberto' : 'aguardando_profissional',
        approval_status: isManager && !isMural ? 'homologada' : 'aguardando_gestor',
        reason: swapReason.trim()
      };

      const createdSwap = await base44.entities.ShiftSwap.create(payload);

      // Se for publicado no Mural, atualiza o plantão original no Shift para vaga disponível
      if (isMural) {
        await base44.entities.Shift.update(currentSelectedShift.id, {
          status: 'disponivel',
          professional_id: null,
          professional_name: 'Vaga Aberta',
          notes: `Publicado no Mural por ${requesterProfessional?.name || 'Coordenação'}`
        });

        // Notifica colegas elegíveis
        eligibleProfessionals.forEach(p => {
          createNotificationSilent(
            p.id,
            'Nova oportunidade no Mural!',
            `Plantão em ${currentSelectedShift.date} (${currentSelectedShift.sector_name || 'Geral'}) publicado no Mural.`,
            currentSelectedShift.id
          );
        });
      } else {
        // Notifica o médico indicado
        createNotificationSilent(
          targetProf?.id,
          'Solicitação de Plantão Recebida',
          `Dr(a). ${requesterProfessional?.name} solicitou que você assuma o plantão de ${currentSelectedShift.date}.`,
          currentSelectedShift.id
        );
      }

      setDialogOpen(false);
      setSelectedShiftId('');
      setSelectedOwnerProfessionalId('');
      setTargetProfessionalId('');
      setSwapReason('');
      setSwapType('cessao');
      await loadData();
      alert(isMural ? 'Vaga disponibilizada no Mural de Oportunidades!' : 'Solicitação enviada com sucesso ao colega!');
    } catch (err) {
      alert(err.message || 'Erro ao processar solicitação.');
    } finally {
      setSubmitting(false);
    }
  };

  // Aceite pelo profissional indicado (envia para homologação do gestor)
  const handleProfessionalConfirm = async (swap) => {
    if (!confirm(`Confirmar o aceite deste plantão em ${swap.shift_date}? A solicitação será enviada para homologação do gestor.`)) return;

    try {
      await base44.entities.ShiftSwap.update(swap.id, {
        status: 'aguardando_homologacao',
        confirmation_status: 'confirmada_pelo_profissional',
        approval_status: 'aguardando_gestor'
      });

      if (swap.shift_id) {
        await base44.entities.Shift.update(swap.shift_id, {
          notes: `Aguardando homologação do gestor (Substituto: ${swap.target_name})`
        });
      }

      await loadData();
      alert('Aceite registrado! A coordenação foi notificada para homologação final.');
    } catch (err) {
      alert('Erro ao confirmar: ' + err.message);
    }
  };

  // Recusa da troca pelo profissional
  const handleProfessionalReject = async (swap) => {
    const reason = prompt('Informe o motivo da recusa (opcional):');
    if (reason === null) return;

    try {
      await base44.entities.ShiftSwap.update(swap.id, {
        status: 'rejeitada',
        confirmation_status: 'recusada_pelo_profissional',
        reason: reason ? `Recusado: ${reason}` : 'Recusado pelo profissional'
      });

      // Notifica o médico solicitante que o colega recusou
      createNotificationSilent(
        swap.requester_professional_id,
        'Troca não aceita',
        `Dr(a). ${swap.target_name} não pôde aceitar o plantão de ${swap.shift_date}.`,
        swap.shift_id
      );

      await loadData();
      alert('Recusa registrada.');
    } catch (err) {
      alert('Erro ao recusar: ' + err.message);
    }
  };

  // Homologação final pelo Gestor (atribuição definitiva no Shift e faturamento)
  const handleManagerHomologate = async (swap, approved = true) => {
    const actionName = approved ? 'homologar e atribuir' : 'rejeitar';
    if (!confirm(`Deseja realmente ${actionName} este plantão para ${swap.target_name}?`)) return;

    try {
      if (approved) {
        await base44.entities.ShiftSwap.update(swap.id, {
          status: 'aprovada',
          approval_status: 'homologada'
        });

        if (swap.shift_id && swap.target_professional_id) {
          const targetProf = professionals.find(p => String(p.id) === String(swap.target_professional_id));
          const shiftObj = allShifts.find(s => String(s.id) === String(swap.shift_id));
          
          let updatedTotal = shiftObj?.total_amount;
          if (targetProf && shiftObj?.duration_hours) {
            const rate = Number(targetProf.hourly_rate) || 120;
            updatedTotal = rate * Number(shiftObj.duration_hours);
          }

          await base44.entities.Shift.update(swap.shift_id, {
            professional_id: swap.target_professional_id,
            professional_name: swap.target_name,
            status: 'confirmado',
            total_amount: updatedTotal,
            notes: `Homologado pela coordenação (Transferido de ${swap.requester_name})`
          });
        }

        createNotificationSilent(
          swap.target_professional_id,
          'Plantão Homologado!',
          `Seu plantão em ${swap.shift_date} (${swap.sector_name}) foi homologado e já consta na sua escala.`,
          swap.shift_id
        );
      } else {
        await base44.entities.ShiftSwap.update(swap.id, {
          status: 'rejeitada',
          approval_status: 'rejeitada_pelo_gestor'
        });
      }

      await loadData();
      alert(approved ? 'Plantão homologado com sucesso!' : 'Solicitação rejeitada.');
    } catch (err) {
      alert('Erro na homologação: ' + err.message);
    }
  };

  // Manifestação de interesse no Mural (NÃO aprova direto; envia para o gestor)
  const handleClaimMuralShift = async (swap) => {
    if (!myProfessional && !currentProfessionalId && !isManager) {
      alert('Você precisa ter um perfil profissional ativo para assumir este plantão.');
      return;
    }

    const claimingProf = myProfessional || professionals.find((p) => String(p.id) === String(currentProfessionalId)) || professionals[0];
    if (!claimingProf) {
      alert('Perfil profissional não localizado.');
      return;
    }

    if (!confirm(`Demonstrar interesse em assumir o plantão de ${swap.shift_date} (${swap.sector_name})? A solicitação será enviada para homologação do gestor.`)) return;

    try {
      await base44.entities.ShiftSwap.update(swap.id, {
        target_professional_id: claimingProf.id,
        target_name: claimingProf.name,
        target_specialty: claimingProf.specialty || claimingProf.category,
        status: 'aguardando_homologacao',
        confirmation_status: 'confirmada_pelo_profissional',
        approval_status: 'aguardando_gestor'
      });

      if (swap.shift_id) {
        await base44.entities.Shift.update(swap.shift_id, {
          notes: `Interesse manifestado por ${claimingProf.name} (Aguardando Homologação)`
        });
      }

      await loadData();
      alert('Interesse registrado com sucesso! O gestor da escala foi notificado para homologação.');
    } catch (err) {
      alert('Erro ao manifestar interesse: ' + err.message);
    }
  };

  const handleNotifyWhatsApp = (swap, e) => {
    if (e) e.stopPropagation();
    const prof = professionals.find((p) => String(p.id) === String(swap.target_professional_id));
    const phone = prof?.phone?.replace(/\D/g, '');
    const dateFmt = swap.shift_date ? swap.shift_date.split('-').reverse().join('/') : '';
    
    const text = encodeURIComponent(
      `Olá, Dr(a). ${swap.target_name || ''}!\n\nFoi solicitada a cobertura do plantão:\n🏥 Unidade: *${company?.name || 'Hospital'}*\n📅 Data: *${dateFmt}*\n⏰ Horário: *${swap.shift_time}*\n📍 Setor: *${swap.sector_name}*\n\nPor favor, acesse o sistema ScaleMedic para confirmar o aceite do turno. Obrigado!`
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

  // Trocas recebidas pelo médico que aguardam seu aceite
  const tabReceived = useMemo(() => {
    return searchedSwaps.filter((s) => 
      String(s.target_professional_id) === String(currentProfessionalId) && 
      s.status === 'pendente' &&
      s.swap_type !== 'mural'
    );
  }, [searchedSwaps, currentProfessionalId]);

  // Trocas enviadas pelo médico
  const tabSent = useMemo(() => {
    return searchedSwaps.filter((s) => 
      String(s.requester_professional_id) === String(currentProfessionalId)
    );
  }, [searchedSwaps, currentProfessionalId]);

  // Mural de oportunidades ativas
  const tabMural = useMemo(() => {
    return searchedSwaps.filter((s) => 
      (!s.target_professional_id || s.swap_type === 'mural' || s.target_name?.toLowerCase().includes('mural')) && 
      s.status === 'pendente'
    );
  }, [searchedSwaps]);

  // Aba exclusiva do Gestor: Todas as pendências de homologação
  const tabHomologation = useMemo(() => {
    return searchedSwaps.filter((s) => s.status === 'aguardando_homologacao');
  }, [searchedSwaps]);

  const activeSwapsList = useMemo(() => {
    if (activeTab === 'homologation') return tabHomologation;
    if (activeTab === 'received') return tabReceived;
    if (activeTab === 'sent') return tabSent;
    if (activeTab === 'mural') return tabMural;
    return searchedSwaps;
  }, [activeTab, tabHomologation, tabReceived, tabSent, tabMural, searchedSwaps]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-400">
              <Repeat className="w-4 h-4" /> Gestão de Cobertura Hospitalar
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-tight">Trocas, Cessões & Mural de Oportunidades</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Fluxo unificado: solicitação, manifestação de interesse, confirmação do médico e homologação da coordenação.
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
          {isManager && (
            <button
              onClick={() => setActiveTab('homologation')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'homologation'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Pendentes de Homologação</span>
              {tabHomologation.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center animate-pulse">
                  {tabHomologation.length}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab('received')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'received'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Trocas Recebidas</span>
            {tabReceived.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-sky-500 text-white text-[10px] font-black flex items-center justify-center">
                {tabReceived.length}
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
          <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">Nenhuma solicitação nesta aba</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {activeTab === 'homologation' && 'Não há trocas aguardando homologação do gestor.'}
            {activeTab === 'received' && 'Você não possui convites ou pedidos de troca pendentes de confirmação.'}
            {activeTab === 'sent' && 'Você não abriu nenhuma solicitação de cessão ou troca.'}
            {activeTab === 'mural' && 'Não há oportunidades de plantão abertas no mural no momento.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeSwapsList.map((swap) => {
            const isMuralCard = (!swap.target_professional_id || swap.swap_type === 'mural' || swap.target_name?.includes('Mural')) && swap.status === 'pendente';
            const isAwaitingHomologation = swap.status === 'aguardando_homologacao';
            const isPendingTargetAccept = swap.status === 'pendente' && !isMuralCard;

            return (
              <Card 
                key={swap.id} 
                className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between space-y-4 shadow-sm ${
                  isAwaitingHomologation
                    ? 'border-amber-400 bg-amber-50/20 dark:bg-amber-950/10'
                    : isMuralCard
                    ? 'border-sky-300 bg-sky-50/30 dark:bg-sky-950/10' 
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
                      {swap.status === 'aguardando_homologacao' ? 'Aguardando Homologação' : swap.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Setor: <b>{toTitleCase(swap.sector_name) || 'Geral'}</b></span>
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Origem</span>
                      <strong className="text-slate-900 dark:text-white text-xs block truncate">
                        {toTitleCase(swap.requester_name)}
                      </strong>
                      <span className="text-[10px] text-sky-600 font-medium truncate block">
                        {swap.requester_specialty || 'Especialidade'}
                      </span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

                    <div className="min-w-0 flex-1 text-right">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Substituto</span>
                      <strong className={`text-xs block truncate ${isMuralCard ? 'text-sky-700 font-black' : 'text-slate-900 dark:text-white'}`}>
                        {toTitleCase(swap.target_name || 'Mural de Oportunidades')}
                      </strong>
                      <span className="text-[10px] text-slate-500 truncate block">
                        {isMuralCard ? 'Vaga Disponível' : (swap.target_specialty || 'Especialidade')}
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
                  
                  {/* BOTÃO DO MURAL: MANIFESTAR INTERESSE (NÃO HOMOLOGA DIRETO) */}
                  {isMuralCard && (
                    <Button
                      size="sm"
                      onClick={() => handleClaimMuralShift(swap)}
                      className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-8 gap-1.5 shadow-sm"
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Manifestar Interesse
                    </Button>
                  )}

                  {/* AÇÕES DO MÉDICO DESTINATÁRIO (ACEITAR OU RECUSAR) */}
                  {isPendingTargetAccept && String(swap.target_professional_id) === String(currentProfessionalId) && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleProfessionalConfirm(swap)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 gap-1 shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar Aceite
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleProfessionalReject(swap)}
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50 text-xs h-8 gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Recusar
                      </Button>
                    </>
                  )}

                  {/* AÇÕES DO GESTOR: HOMOLOGAR OU REJEITAR */}
                  {isAwaitingHomologation && isManager && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleManagerHomologate(swap, true)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 gap-1 shadow-sm"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> Homologar Plantão
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleManagerHomologate(swap, false)}
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50 text-xs h-8 gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Rejeitar
                      </Button>
                    </>
                  )}

                  {/* Botão WhatsApp para contato rápido */}
                  {swap.target_professional_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => handleNotifyWhatsApp(swap, e)}
                      className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs h-8 px-2.5"
                      title="Enviar lembrete via WhatsApp"
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

      {/* DIALOG DE NOVA SOLICITAÇÃO */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold dark:text-white flex items-center gap-2">
              <Handshake className="w-5 h-5 text-sky-600" /> Solicitar Troca ou Publicar no Mural
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
                  Cessão Direta
                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5">Direcionado</span>
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
                  Troca 1 por 1
                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5">Permuta</span>
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
                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5">Vaga Aberta</span>
                </button>
              </div>
            </div>

            {isManager && (
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-sky-600" /> 1. Qual médico deseja passar o plantão?
                </Label>
                <Select value={selectedOwnerProfessionalId} onValueChange={(val) => {
                  setSelectedOwnerProfessionalId(val);
                  setSelectedShiftId('');
                  setTargetProfessionalId('');
                }}>
                  <SelectTrigger className="h-10 text-xs bg-white dark:bg-slate-900">
                    <SelectValue placeholder="Selecione o médico..." />
                  </SelectTrigger>
                  <SelectContent>
                    {professionals.filter(p => p.status !== 'inativo').map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name} ({p.specialty || 'Geral'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {isManager ? '2. Selecione o plantão deste profissional' : 'Selecione o seu plantão na escala'}
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
                  <SelectValue placeholder={isManager && !selectedOwnerProfessionalId ? "Primeiro selecione o profissional acima..." : "Escolha o plantão..."} />
                </SelectTrigger>
                <SelectContent>
                  {modalAvailableShifts.length === 0 ? (
                    <div className="p-3 text-xs text-slate-500 text-center">
                      Nenhum plantão ativo localizado.
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
              <Label className="text-xs font-semibold">Motivo da solicitação</Label>
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