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
  Repeat, CheckCircle2, XCircle, Clock, Plus, Search,
  Calendar, Stethoscope, ArrowRight, ShieldAlert, Loader2
} from 'lucide-react';

const statusBadge = {
  pendente: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  aprovada: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  rejeitada: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
  cancelada: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
};

export default function Trocas() {
  const { user, company, loading } = useAppData();
  const [swaps, setSwaps] = useState([]);
  const [myShifts, setMyShifts] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  // Formulário de nova troca
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [targetProfessionalId, setTargetProfessionalId] = useState('');
  const [swapReason, setSwapReason] = useState('');

  const isAdmin = user?.role === 'admin';
  const isManager = isAdmin || user?.data?.app_role === 'manager' || user?.data?.app_role === 'gestor';
  const companyId = user?.data?.company_id || company?.id;
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id;
  const currentProfessionalId = user?.data?.professional_id;

  const loadData = async () => {
    if (!companyId) return;
    setLoadingData(true);
    try {
      const filterBase = { company_id: companyId };
      if (unitId) filterBase.unit_id = unitId;

      const [allSwaps, allProfessionals, allShifts] = await Promise.all([
        base44.entities.ShiftSwap.filter(filterBase, '-created_date', 300).catch(() => []),
        base44.entities.Professional.filter(filterBase, '-created_date', 300).catch(() => []),
        base44.entities.Shift.filter(filterBase, '-date', 400).catch(() => [])
      ]);

      setProfessionals(allProfessionals);

      // Regra 1: Visibilidade estrita
      // - Se for gestor: visualiza todas as trocas
      // - Se for profissional comum: somente trocas solicitadas por ele OU direcionadas a ele
      if (isManager) {
        setSwaps(allSwaps);
      } else {
        const filteredSwaps = allSwaps.filter((s) => 
          String(s.requester_professional_id) === String(currentProfessionalId) ||
          String(s.target_professional_id) === String(currentProfessionalId)
        );
        setSwaps(filteredSwaps);
      }

      // Plantões disponíveis para o usuário trocar
      if (isManager) {
        setMyShifts(allShifts);
      } else {
        setMyShifts(allShifts.filter((sh) => String(sh.professional_id) === String(currentProfessionalId)));
      }
    } catch (err) {
      console.error('Erro ao carregar trocas:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!loading) loadData();
  }, [loading, companyId, unitId, currentProfessionalId]);

  // Identifica o plantão escolhido no formulário
  const currentSelectedShift = useMemo(() => {
    return myShifts.find((sh) => String(sh.id) === String(selectedShiftId)) || null;
  }, [myShifts, selectedShiftId]);

  // Identifica o profissional dono do plantão selecionado
  const requesterProfessional = useMemo(() => {
    if (!currentSelectedShift) return null;
    return professionals.find((p) => String(p.id) === String(currentSelectedShift.professional_id)) || null;
  }, [currentSelectedShift, professionals]);

  // Regra 2: Amarrar estritamente por especialidade
  // Só lista profissionais da mesma especialidade que NÃO sejam o próprio solicitante
  const eligibleProfessionals = useMemo(() => {
    if (!requesterProfessional) return [];
    
    const targetSpecialty = (requesterProfessional.specialty || '').trim().toLowerCase();
    const targetCategory = (requesterProfessional.category || '').trim().toLowerCase();

    return professionals.filter((p) => {
      if (String(p.id) === String(requesterProfessional.id)) return false;
      if (p.status === 'inativo') return false;

      const pSpecialty = (p.specialty || '').trim().toLowerCase();
      const pCategory = (p.category || '').trim().toLowerCase();

      // Precisa ter a mesma especialidade cadastrada
      if (targetSpecialty) {
        return pSpecialty === targetSpecialty;
      }

      // Se não tiver especialidade explícita, amarra pela categoria (ex: enfermeiro para enfermeiro)
      return pCategory === targetCategory;
    });
  }, [requesterProfessional, professionals]);

  const handleCreateSwap = async (e) => {
    e.preventDefault();
    if (!currentSelectedShift || !targetProfessionalId) {
      alert('Selecione o plantão e o profissional substituto.');
      return;
    }

    const targetProf = professionals.find((p) => String(p.id) === String(targetProfessionalId));
    if (!targetProf) return;

    setSubmitting(true);
    try {
      await base44.entities.ShiftSwap.create({
        company_id: companyId,
        unit_id: unitId || currentSelectedShift.unit_id,
        shift_id: currentSelectedShift.id,
        shift_date: currentSelectedShift.date,
        shift_time: `${currentSelectedShift.start_time || '07:00'} - ${currentSelectedShift.end_time || '19:00'}`,
        sector_name: currentSelectedShift.sector_name || 'Geral',
        requester_professional_id: requesterProfessional?.id,
        requester_name: requesterProfessional?.name,
        requester_specialty: requesterProfessional?.specialty || requesterProfessional?.category,
        target_professional_id: targetProf.id,
        target_name: targetProf.name,
        target_specialty: targetProf.specialty || targetProf.category,
        reason: swapReason.trim(),
        status: 'pendente'
      });

      setDialogOpen(false);
      setSelectedShiftId('');
      setTargetProfessionalId('');
      setSwapReason('');
      await loadData();
    } catch (err) {
      alert(err.message || 'Não foi possível solicitar a troca.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (swap, newStatus) => {
    const actionLabel = newStatus === 'aprovada' ? 'aprovar' : 'rejeitar';
    if (!confirm(`Deseja realmente ${actionLabel} esta solicitação de troca?`)) return;

    try {
      await base44.entities.ShiftSwap.update(swap.id, { status: newStatus });

      // Se a troca for aprovada, atualiza o plantão na escala com o novo profissional
      if (newStatus === 'aprovada' && swap.shift_id) {
        await base44.entities.Shift.update(swap.shift_id, {
          professional_id: swap.target_professional_id,
          professional_name: swap.target_name,
          notes: `Troca realizada com ${swap.requester_name}`
        });
      }

      await loadData();
    } catch (err) {
      alert(err.message || 'Erro ao processar troca.');
    }
  };

  const filteredSwaps = useMemo(() => {
    return swaps.filter((s) => {
      if (!search) return true;
      const term = search.toLowerCase();
      return (
        (s.requester_name || '').toLowerCase().includes(term) ||
        (s.target_name || '').toLowerCase().includes(term) ||
        (s.requester_specialty || '').toLowerCase().includes(term) ||
        (s.sector_name || '').toLowerCase().includes(term)
      );
    });
  }, [swaps, search]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Cabeçalho */}
      <div className="rounded-2xl border border-sky-200 dark:border-sky-900/60 bg-gradient-to-r from-sky-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-900/90 dark:to-sky-950/40 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-sm">
              <Repeat className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-sky-700 dark:text-sky-400 font-semibold">Operação médica</p>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Trocas de plantão</h2>
            </div>
          </div>

          <Button 
            onClick={() => setDialogOpen(true)} 
            className="gap-2 bg-sky-600 hover:bg-sky-700 text-white"
          >
            <Plus className="w-4 h-4" /> Solicitar troca
          </Button>
        </div>
      </div>

      {/* Barra de Busca e Filtro */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por profissional, especialidade ou setor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Listagem de Trocas */}
      {loadingData ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
        </div>
      ) : filteredSwaps.length === 0 ? (
        <Card className="p-12 text-center border-slate-200 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-slate-400 dark:text-slate-500 text-sm">
            Nenhuma solicitação de troca pendente para o seu perfil.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSwaps.map((swap) => {
            const isTarget = String(swap.target_professional_id) === String(currentProfessionalId);
            const canAction = isManager || isTarget;

            return (
              <Card key={swap.id} className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <Calendar className="w-4 h-4 text-sky-600" />
                    <span>{swap.shift_date ? new Date(swap.shift_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Data a definir'}</span>
                    <span>• {swap.shift_time || '12h'}</span>
                  </div>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${statusBadge[swap.status] || 'bg-slate-100 text-slate-600'}`}>
                    {swap.status}
                  </span>
                </div>

                {/* Fluxo: Solicitante -> Substituto */}
                <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Sai</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">
                      {swap.requester_name}
                    </div>
                    <div className="text-[11px] text-sky-600 dark:text-sky-400 truncate flex items-center gap-1">
                      <Stethoscope className="w-3 h-3" />
                      {swap.requester_specialty || 'Especialidade'}
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />

                  <div className="min-w-0 flex-1 text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Assume</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">
                      {swap.target_name}
                    </div>
                    <div className="text-[11px] text-sky-600 dark:text-sky-400 truncate flex items-center justify-end gap-1">
                      <Stethoscope className="w-3 h-3" />
                      {swap.target_specialty || 'Especialidade'}
                    </div>
                  </div>
                </div>

                {swap.reason && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    "{swap.reason}"
                  </p>
                )}

                {/* Botões de Decisão (Aparecem somente para o gestor ou para o médico convidado a assumir) */}
                {swap.status === 'pendente' && canAction && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(swap, 'aprovada')}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Aceitar / Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(swap, 'rejeitada')}
                      className="flex-1 text-red-600 hover:bg-red-50 border-red-200 dark:border-red-900/50 dark:hover:bg-red-950/30 gap-1 text-xs"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Recusar
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal para Solicitar Nova Troca com Especialidade Travada */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Solicitar troca de plantão</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateSwap} className="space-y-4">
            {/* 1. Escolha do Plantão */}
            <div className="space-y-1.5">
              <Label className="dark:text-slate-200">Selecione o plantão a ser passado</Label>
              <Select value={selectedShiftId} onValueChange={(val) => {
                setSelectedShiftId(val);
                setTargetProfessionalId('');
              }}>
                <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
                  <SelectValue placeholder="Escolha um plantão..." />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                  {myShifts.map((shift) => (
                    <SelectItem key={shift.id} value={shift.id}>
                      {new Date(shift.date + 'T00:00:00').toLocaleDateString('pt-BR')} ({shift.start_time || '07:00'} - {shift.end_time || '19:00'}) · {shift.sector_name || 'Setor'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Indicador de Especialidade Travada */}
            {requesterProfessional && (
              <div className="rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-950/30 p-3 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-sky-600 dark:text-sky-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-sky-700 dark:text-sky-300">Especialidade exigida: </span>
                  {requesterProfessional.specialty || requesterProfessional.category}.
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Apenas profissionais com a mesma especialidade estão autorizados para a troca.
                  </p>
                </div>
              </div>
            )}

            {/* 2. Escolha do Profissional Substituto (Filtrado estritamente por especialidade) */}
            <div className="space-y-1.5">
              <Label className="dark:text-slate-200">Profissional substituto da mesma especialidade</Label>
              <Select 
                value={targetProfessionalId} 
                onValueChange={setTargetProfessionalId}
                disabled={!selectedShiftId}
              >
                <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
                  <SelectValue placeholder={!selectedShiftId ? "Primeiro escolha o plantão acima" : "Selecione o profissional..."} />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                  {eligibleProfessionals.length === 0 ? (
                    <div className="p-3 text-xs text-slate-500 text-center">
                      Nenhum outro profissional encontrado com a mesma especialidade..
                    </div>
                  ) : (
                    eligibleProfessionals.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.specialty || p.category})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Justificativa */}
            <div className="space-y-1.5">
              <Label className="dark:text-slate-200">Motivo da troca (opcional)</Label>
              <Input
                value={swapReason}
                onChange={(e) => setSwapReason(e.target.value)}
                placeholder="Ex: Conflito de agenda no consultório"
                className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={submitting || !selectedShiftId || !targetProfessionalId}
                className="bg-sky-600 hover:bg-sky-700 text-white"
              >
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enviar solicitação
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}