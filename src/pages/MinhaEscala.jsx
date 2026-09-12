import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  CalendarDays,
  Clock,
  Repeat,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Stethoscope,
  Globe,
  UserCheck,
  Loader2,
  Moon,
  Sun,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { getShiftTvLifecycle } from '@/lib/shiftUtils';

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const clean = dateStr.split('T')[0];
  const [y, m, d] = clean.split('-');
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return `${d}/${m} (${weekdays[dt.getDay()] || ''})`;
}

function toTitleCase(str) {
  if (!str) return '';
  const acr = ['UTI', 'UCO', 'PA', 'PS', 'CRM', 'COREN'];
  return str
    .toLowerCase()
    .split(' ')
    .map((w) => {
      const u = w.toUpperCase();
      if (acr.includes(u)) return u;
      if (['de', 'da', 'do', 'das', 'dos', 'e'].includes(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

export default function MinhaEscala() {
  const { user, company, loading: appLoading } = useAppData();
  const [shifts, setShifts] = useState([]);
  const [allUnitShifts, setAllUnitShifts] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal de Troca / Doação
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [modalMode, setModalMode] = useState('direta'); // 'direta' (alguém) ou 'mural' (deixar vago)
  const [targetProfId, setTargetProfId] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id || 'unit_h1';

  // Identifica o profissional logado com segurança
  const myProfessional = useMemo(() => {
    const uId = user?.id;
    const uEmail = user?.email;
    const uName = user?.full_name;
    return (professionals || []).find(
      (p) => p.user_id === uId || (p.email && p.email === uEmail) || p.name === uName
    );
  }, [professionals, user]);

  const currentProfId = myProfessional?.id || user?.data?.professional_id;

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const filterBase = { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) };

      const [profsRes, shiftsRes] = await Promise.all([
        base44.entities.Professional.filter(filterBase, '-created_date', 500).catch(() => []),
        base44.entities.Shift.filter(filterBase, '-date', 800).catch(() => [])
      ]);

      setProfessionals(profsRes || []);
      setAllUnitShifts(shiftsRes || []);

      // Filtra estritamente os plantões do usuário atual
      const myShiftsOnly = (shiftsRes || []).filter((s) => {
        if (currentProfId && String(s.professional_id) === String(currentProfId)) return true;
        if (myProfessional?.name && s.professional_name === myProfessional.name) return true;
        if (user?.full_name && s.professional_name === user.full_name) return true;
        return false;
      });

      setShifts(myShiftsOnly);
    } catch (e) {
      console.error('Erro ao carregar Minha Escala:', e);
    } finally {
      setLoading(false);
    }
  }, [companyId, unitId, currentProfId, myProfessional, user]);

  useEffect(() => {
    if (!appLoading) loadData();
  }, [appLoading, loadData]);

  // Colegas da mesma especialidade disponíveis para troca
  const eligibleColleagues = useMemo(() => {
    if (!selectedShift && !myProfessional) return [];
    const mySpec = (myProfessional?.specialty || selectedShift?.sector_name || '').trim().toLowerCase();
    const myCat = (myProfessional?.category || '').trim().toLowerCase();

    return professionals.filter((p) => {
      if (String(p.id) === String(currentProfId)) return false;
      if (p.status === 'inativo') return false;

      const pSpec = (p.specialty || '').trim().toLowerCase();
      const pCat = (p.category || '').trim().toLowerCase();

      if (mySpec && pSpec) return pSpec === mySpec;
      return pCat === myCat;
    });
  }, [professionals, myProfessional, currentProfId, selectedShift]);

  // Validação: colega escolhido já está de plantão no mesmo dia?
  const colleagueHasConflict = useMemo(() => {
    if (!selectedShift || !targetProfId || modalMode !== 'direta') return false;
    const shiftDate = (selectedShift.date || '').split('T')[0];

    return allUnitShifts.some((s) => {
      const sDate = (s.date || '').split('T')[0];
      return (
        sDate === shiftDate &&
        String(s.professional_id) === String(targetProfId) &&
        s.status !== 'cancelado'
      );
    });
  }, [allUnitShifts, selectedShift, targetProfId, modalMode]);

  const openSwapModal = (shift) => {
    setSelectedShift(shift);
    setModalMode('direta');
    setTargetProfId('');
    setSwapReason('');
    setModalOpen(true);
  };

  const handleSendSwap = async (e) => {
    e.preventDefault();
    if (!selectedShift) return;

    const isMural = modalMode === 'mural';
    if (!isMural && !targetProfId) {
      alert('Por favor, selecione para qual colega deseja passar o plantão, ou escolha "Deixar Vago (Mural)".');
      return;
    }

    if (colleagueHasConflict) {
      const proceed = confirm('Atenção: O profissional selecionado já possui plantão escalado neste mesmo dia. Deseja prosseguir com o envio mesmo assim?');
      if (!proceed) return;
    }

    const targetProf = !isMural ? professionals.find((p) => String(p.id) === String(targetProfId)) : null;

    setSubmitting(true);
    try {
      const payload = {
        company_id: companyId,
        unit_id: unitId || selectedShift.unit_id,
        shift_id: selectedShift.id,
        shift_date: selectedShift.date,
        shift_time: `${selectedShift.start_time || '07:00'} - ${selectedShift.end_time || '19:00'}`,
        sector_name: selectedShift.sector_name || 'Geral',
        requester_professional_id: currentProfId,
        requester_name: myProfessional?.name || user?.full_name || 'Plantonista',
        requester_specialty: myProfessional?.specialty || myProfessional?.category || 'Clínica Médica',
        target_professional_id: isMural ? null : targetProf?.id,
        target_name: isMural ? 'Mural Aberto (Qualquer Colega)' : targetProf?.name,
        target_specialty: isMural ? (myProfessional?.specialty || 'Geral') : (targetProf?.specialty || targetProf?.category),
        swap_type: isMural ? 'mural' : 'cessao',
        reason: swapReason.trim(),
        status: 'pendente',
        created_date: new Date().toISOString()
      };

      // Gravação direta e segura na entidade
      await base44.entities.ShiftSwap.create(payload);

      setModalOpen(false);
      setSelectedShift(null);
      alert(
        isMural
          ? 'Plantão publicado com sucesso no Mural de Oportunidades!'
          : `Solicitação enviada com sucesso para ${targetProf?.name}! Aguardando aceite.`
      );
      loadData();
    } catch (err) {
      console.error('Erro ao enviar troca:', err);
      alert(err.message || 'Erro ao registrar solicitação de troca.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Banner Superior */}
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-400">
              <CalendarDays className="w-4 h-4" /> Minha Grade Operacional
            </div>
            <h1 className="mt-2 text-2xl md:text-3xl font-black tracking-tight">
              {myProfessional?.name || user?.full_name || 'Meu Painel de Escala'}
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              {myProfessional?.specialty ? `Especialidade: ${myProfessional.specialty} · ` : ''}
              {shifts.length} plantão(ões) confirmados em sua carteira.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/10 px-4 py-2.5 rounded-2xl text-right">
              <div className="text-2xl font-black text-white">{shifts.length}</div>
              <div className="text-[10px] uppercase font-bold text-slate-300">Plantões Alocados</div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Plantões do Usuário */}
      <Card className="p-5 border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Meus Próximos Plantões</h2>
            <p className="text-xs text-slate-500">Selecione um plantão para transferir a um colega ou abrir no mural</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
          </div>
        ) : shifts.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <CalendarDays className="w-10 h-10 mx-auto opacity-40 text-slate-400" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Nenhum plantão agendado para o seu perfil no momento.</p>
            <p className="text-xs text-slate-400">Fique atento ao mural de oportunidades para assumir vagas abertas.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shifts.map((s) => {
              const isNight = s.shift_type === 'noturno' || (s.start_time >= '18:00' || s.start_time < '06:00');

              return (
                <div
                  key={s.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between space-y-3 hover:border-sky-300 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        <CalendarDays className="w-4 h-4 text-sky-600" />
                        {fmtDate(s.date)}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        isNight ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' : 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                      }`}>
                        {isNight ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                        {s.start_time} às {s.end_time}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Setor: <b>{toTitleCase(s.sector_name) || 'Geral'}</b></span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Confirmado
                    </span>

                    <Button
                      size="sm"
                      onClick={() => openSwapModal(s)}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold h-8 px-3 rounded-xl gap-1.5 shadow-sm"
                    >
                      <Repeat className="w-3.5 h-3.5 text-sky-400" /> Passar / Trocar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* MODAL DE SOLICITAÇÃO DE TROCA (COMPLETAMENTE BLINDADO) */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-black dark:text-white flex items-center gap-2">
              <Repeat className="w-5 h-5 text-sky-600" /> Solicitar Troca de Plantão
            </DialogTitle>
          </DialogHeader>

          {selectedShift && (
            <form onSubmit={handleSendSwap} className="space-y-4 py-2">
              {/* Resumo do Plantão */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>{fmtDate(selectedShift.date)}</span>
                  <span>{selectedShift.start_time} às {selectedShift.end_time}</span>
                </div>
                <div className="text-slate-500">
                  Setor: <b>{toTitleCase(selectedShift.sector_name)}</b>
                </div>
              </div>

              {/* Escolha do Destino: Colega ou Deixar Vago (Mural) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Como deseja passar este plantão?
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModalMode('direta');
                      setTargetProfId('');
                    }}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                      modalMode === 'direta'
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 ring-2 ring-sky-500/20'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Passar para Alguém
                    <span className="block text-[10px] font-normal text-slate-400 mt-0.5">Colega específico</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModalMode('mural');
                      setTargetProfId('');
                    }}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                      modalMode === 'mural'
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 ring-2 ring-sky-500/20'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Deixar Vago (Mural)
                    <span className="block text-[10px] font-normal text-slate-400 mt-0.5">Livre p/ especialidade</span>
                  </button>
                </div>
              </div>

              {/* Se for Direcionado para um Colega */}
              {modalMode === 'direta' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Selecione o profissional substituto</Label>
                  <select
                    value={targetProfId}
                    onChange={(e) => setTargetProfId(e.target.value)}
                    required
                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-100"
                  >
                    <option value="">Selecione um colega da mesma especialidade...</option>
                    {eligibleColleagues.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.specialty || p.category || 'Geral'})
                      </option>
                    ))}
                  </select>

                  {/* ALERTA DE DUPLICIDADE / PLANTONISTA JÁ ESCALADO NO DIA */}
                  {colleagueHasConflict && (
                    <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2 mt-2 animate-pulse">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Atenção: Profissional já está de plantão neste dia!</strong>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                          Este colega já possui outro turno alocado nesta mesma data. Verifique se não haverá choque ou sobrecarga.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Se for para o Mural */}
              {modalMode === 'mural' && (
                <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <span className="font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                    <Globe className="w-4 h-4" /> Mural de Oportunidades do Setor
                  </span>
                  <p className="text-[11px] text-slate-500">
                    O plantão ficará disponível para qualquer colega credenciado na especialidade <b>{myProfessional?.specialty || 'compatível'}</b> assumir com 1 clique.
                  </p>
                </div>
              )}

              {/* Motivo */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Motivo da solicitação (opcional)</Label>
                <Input
                  value={swapReason}
                  onChange={(e) => setSwapReason(e.target.value)}
                  placeholder="Ex: Conflito de agenda, emergência pessoal ou congresso"
                  className="h-9 text-xs"
                />
              </div>

              <DialogFooter className="pt-3 gap-2">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="text-xs">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || (modalMode === 'direta' && !targetProfId)}
                  className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-5"
                >
                  {submitting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                  {modalMode === 'mural' ? 'Publicar no Mural' : 'Enviar Solicitação'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}