import React, { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Repeat, CheckCircle2, XCircle, Clock, Plus, Search,
  Calendar, Stethoscope, ArrowRight, ShieldAlert, Loader2,
  Globe, Inbox, Send, ShieldCheck, MessageCircle, Building2,
  UserCheck, Handshake, User
} from 'lucide-react';

const statusBadge = {
  pendente: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30',
  aguardando_homologacao: 'bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-500/30',
  aprovada: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
  rejeitada: 'bg-red-500/10 text-red-800 dark:text-red-300 border-red-500/30'
};

function toTitleCase(str) {
  return typeof str === 'string' ? str.toLowerCase().split(' ').map(w => ['de','da','do','e'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';
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
  const [swapType, setSwapType] = useState('cessao');
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [targetProfessionalId, setTargetProfessionalId] = useState('');
  const [swapReason, setSwapReason] = useState('');

  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id || 'unit_h1';

  const myProfessional = useMemo(() => {
    return (professionals || []).find(p => p.id === user?.data?.professional_id || p.user_id === user?.id || (p.email && p.email === user?.email));
  }, [professionals, user]);

  const currentProfessionalId = myProfessional?.id || user?.data?.professional_id;

  const loadData = async () => {
    if (!companyId) return;
    setLoadingData(true);
    try {
      const query = { company_id: companyId };
      const [allSwaps, allProfessionals, shiftsRes] = await Promise.all([
        base44.entities.ShiftSwap.filter(query, '-created_date', 500).catch(() => []),
        base44.entities.Professional.filter(query, '-created_date', 500).catch(() => []),
        base44.entities.Shift.filter(query, '-date', 1000).catch(() => [])
      ]);

      setProfessionals(Array.isArray(allProfessionals) ? allProfessionals : []);
      setSwaps(Array.isArray(allSwaps) ? allSwaps : []);
      setAllShifts(Array.isArray(shiftsRes) ? shiftsRes : []);
    } catch (err) {
      console.error('Erro ao carregar trocas:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!loading) loadData();
  }, [loading, companyId]);

  const myAvailableShifts = useMemo(() => {
    return allShifts.filter(sh => (String(sh.professional_id) === String(currentProfessionalId) || sh.professional_name === myProfessional?.name) && sh.status !== 'cancelado');
  }, [allShifts, currentProfessionalId, myProfessional]);

  const currentSelectedShift = useMemo(() => {
    return allShifts.find(sh => String(sh.id) === String(selectedShiftId)) || null;
  }, [allShifts, selectedShiftId]);

  // CRIAÇÃO DA TROCA OU PUBLICAÇÃO NO MURAL
  const handleCreateSwap = async (e) => {
    e.preventDefault();
    if (!currentSelectedShift) {
      alert('Selecione o plantão.');
      return;
    }

    const isMural = swapType === 'mural';
    const targetProf = !isMural ? professionals.find(p => String(p.id) === String(targetProfessionalId)) : null;

    setSubmitting(true);
    try {
      await base44.entities.ShiftSwap.create({
        company_id: companyId,
        unit_id: unitId,
        shift_id: currentSelectedShift.id,
        shift_date: currentSelectedShift.date,
        shift_time: `${currentSelectedShift.start_time} - ${currentSelectedShift.end_time}`,
        sector_name: currentSelectedShift.sector_name || 'Geral',
        requester_professional_id: currentProfessionalId,
        requester_name: myProfessional?.name || user?.full_name,
        target_professional_id: isMural ? null : targetProf?.id,
        target_name: isMural ? 'Mural de Oportunidades' : targetProf?.name,
        swap_type: swapType,
        source_type: swapType,
        request_type: isMural ? 'mural' : 'troca',
        status: 'pendente',
        reason: swapReason.trim()
      });

      if (isMural) {
        await base44.entities.Shift.update(currentSelectedShift.id, {
          status: 'disponivel',
          professional_id: null,
          professional_name: 'Vaga Aberta',
          notes: `Publicado no Mural por ${myProfessional?.name || 'Médico'}`
        });
      }

      setDialogOpen(false);
      setSelectedShiftId('');
      setTargetProfessionalId('');
      setSwapReason('');
      await loadData();
      alert('Solicitação realizada com sucesso!');
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ASSUMIR VAGA DO MURAL (ENTRA EM HOMOLOGAÇÃO)
  const handleClaimMuralShift = async (swap) => {
    const candidateProf = myProfessional || professionals[0];
    if (!candidateProf) {
      alert('Você precisa ter perfil profissional ativo.');
      return;
    }

    if (!confirm(`Confirmar interesse no plantão de ${swap.shift_date}?`)) return;

    try {
      await base44.entities.ShiftSwap.update(swap.id, {
        target_professional_id: candidateProf.id,
        target_name: candidateProf.name,
        status: 'aguardando_homologacao'
      });

      if (swap.shift_id) {
        await base44.entities.Shift.update(swap.shift_id, {
          notes: `Interesse manifestado por Dr(a). ${candidateProf.name} (Aguardando Homologação)`
        });
      }

      await loadData();
      alert('Interesse registrado! Enviado para homologação do gestor.');
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  };

  // HOMOLOGAÇÃO FINAL DO GESTOR
  const handleHomologate = async (swap, approved = true) => {
    if (!confirm(approved ? 'Deseja homologar este plantão?' : 'Deseja rejeitar?')) return;

    try {
      if (approved) {
        await base44.entities.ShiftSwap.update(swap.id, { status: 'aprovada' });

        if (swap.shift_id && swap.target_professional_id) {
          const targetProf = professionals.find(p => String(p.id) === String(swap.target_professional_id));
          const shiftObj = allShifts.find(s => String(s.id) === String(swap.shift_id));

          let calculatedGross = shiftObj?.total_amount || 0;
          if (targetProf && shiftObj) {
            const hours = Number(shiftObj.duration_hours || shiftObj.hours) || 12;
            const remType = String(targetProf.remuneration_type || 'hora').toLowerCase();

            if (remType === 'diaria') {
              calculatedGross = Number(targetProf.daily_rate) || 1500;
            } else if (remType === 'mensal') {
              const monthly = Number(targetProf.monthly_salary) || 18000;
              const workHours = Number(targetProf.monthly_work_hours) || 220;
              const rate = workHours > 0 ? monthly / workHours : 80;
              calculatedGross = Math.round((rate * hours) * 100) / 100;
            } else {
              const rate = Number(targetProf.hourly_rate) || 120;
              calculatedGross = Math.round((rate * hours) * 100) / 100;
            }
          }

          await base44.entities.Shift.update(swap.shift_id, {
            professional_id: swap.target_professional_id,
            professional_name: swap.target_name,
            status: 'confirmado',
            total_amount: calculatedGross,
            notes: `Homologado pela coordenação (Substituto: ${swap.target_name})`
          });
        }
      } else {
        await base44.entities.ShiftSwap.update(swap.id, { status: 'rejeitada' });
      }

      await loadData();
      alert(approved ? 'Plantão homologado com sucesso!' : 'Solicitação rejeitada.');
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  };

  const tabReceived = useMemo(() => {
    return swaps.filter(s => String(s.target_professional_id) === String(currentProfessionalId) && s.status === 'pendente');
  }, [swaps, currentProfessionalId]);

  const tabSent = useMemo(() => {
    return swaps.filter(s => String(s.requester_professional_id) === String(currentProfessionalId));
  }, [swaps, currentProfessionalId]);

  const tabMural = useMemo(() => {
    return swaps.filter(s => (!s.target_professional_id || s.swap_type === 'mural' || s.target_name?.includes('Mural')) && s.status === 'pendente');
  }, [swaps]);

  const tabHomologation = useMemo(() => {
    return swaps.filter(s => s.status === 'aguardando_homologacao');
  }, [swaps]);

  const activeList = useMemo(() => {
    if (activeTab === 'homologation') return tabHomologation;
    if (activeTab === 'received') return tabReceived;
    if (activeTab === 'sent') return tabSent;
    if (activeTab === 'mural') return tabMural;
    return swaps;
  }, [activeTab, tabHomologation, tabReceived, tabSent, tabMural, swaps]);

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-6 text-white shadow-xl flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-black">Trocas & Mural de Oportunidades</h2>
          <p className="text-xs text-slate-300">Gestão de substituições e coberturas hospitalares.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs h-10 px-5">
          <Plus className="w-4 h-4 mr-1.5" /> Solicitar Troca
        </Button>
      </div>

      {/* ABAS */}
      <div className="flex gap-2 border-b pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('homologation')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'homologation' ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
          }`}
        >
          Pendentes de Homologação ({tabHomologation.length})
        </button>

        <button
          onClick={() => setActiveTab('received')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'received' ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
          }`}
        >
          Trocas Recebidas ({tabReceived.length})
        </button>

        <button
          onClick={() => setActiveTab('mural')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'mural' ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
          }`}
        >
          Mural de Oportunidades ({tabMural.length})
        </button>

        <button
          onClick={() => setActiveTab('sent')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'sent' ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
          }`}
        >
          Minhas Solicitações ({tabSent.length})
        </button>
      </div>

      {/* LISTA */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeList.map(swap => (
          <Card key={swap.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <div className="flex justify-between items-center text-xs font-bold border-b pb-2">
              <span>{swap.shift_date} • {swap.shift_time}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase border ${statusBadge[swap.status] || 'bg-slate-100'}`}>
                {swap.status}
              </span>
            </div>

            <div className="text-xs">
              <div><span className="text-slate-400">Origem:</span> <strong>{swap.requester_name}</strong></div>
              <div><span className="text-slate-400">Substituto:</span> <strong>{swap.target_name || 'Mural Aberto'}</strong></div>
              <div className="text-sky-600 mt-1">Setor: {swap.sector_name}</div>
            </div>

            <div className="pt-2 border-t flex gap-2">
              {swap.status === 'pendente' && swap.swap_type === 'mural' && (
                <Button size="sm" onClick={() => handleClaimMuralShift(swap)} className="w-full bg-sky-600 text-white text-xs h-8">
                  Assumir este Plantão
                </Button>
              )}

              {swap.status === 'aguardando_homologacao' && (
                <>
                  <Button size="sm" onClick={() => handleHomologate(swap, true)} className="flex-1 bg-emerald-600 text-white text-xs h-8">
                    Homologar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleHomologate(swap, false)} className="flex-1 text-rose-500 text-xs h-8">
                    Rejeitar
                  </Button>
                </>
              )}
            </div>
          </Card>
        ))}
        {activeList.length === 0 && (
          <p className="text-xs text-slate-400 col-span-3 text-center py-12">Nenhuma solicitação nesta categoria.</p>
        )}
      </div>

      {/* DIALOG DE NOVA TROCA */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Solicitar Troca / Publicar no Mural</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateSwap} className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-bold block mb-1">Modalidade</Label>
              <Select value={swapType} onValueChange={setSwapType}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cessao">Cessão Direta para Colega</SelectItem>
                  <SelectItem value="mural">Publicar no Mural Aberto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-bold block mb-1">Selecione seu Plantão</Label>
              <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Escolha o plantão..." /></SelectTrigger>
                <SelectContent>
                  {myAvailableShifts.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.date} ({s.start_time} - {s.end_time}) • {s.sector_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {swapType !== 'mural' && (
              <div>
                <Label className="text-xs font-bold block mb-1">Médico Substituto</Label>
                <Select value={targetProfessionalId} onValueChange={setTargetProfessionalId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o médico..." /></SelectTrigger>
                  <SelectContent>
                    {professionals.filter(p => p.status !== 'inativo').map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.specialty || 'Geral'})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs font-bold block mb-1">Motivo (Opcional)</Label>
              <Input value={swapReason} onChange={e => setSwapReason(e.target.value)} placeholder="Ex: Emergência pessoal..." className="h-9" />
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" disabled={submitting} className="bg-sky-600 text-white font-bold text-xs h-9">
                {submitting ? 'Enviando...' : (swapType === 'mural' ? 'Publicar no Mural' : 'Enviar Solicitação')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}