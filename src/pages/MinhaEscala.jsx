import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';

import {
  CalendarDays,
  Clock3,
  Repeat2,
  CheckCircle2,
  Building2,
  Loader2,
  Moon,
  Sun,
  ShieldAlert,
  Globe2,
  Handshake,
  UserRound,
  ArrowRight,
  Info,
  ChevronRight,
  Sparkles,
  CalendarCheck2,
  AlertCircle,
  UsersRound
} from 'lucide-react';

/* =========================================================
   FUNÇÕES AUXILIARES
========================================================= */

function fmtDate(dateStr) {
  if (!dateStr) return '';

  const clean = dateStr.split('T')[0];
  const [year, month, day] = clean.split('-');

  const weekdays = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado'
  ];

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  return {
    short: `${day}/${month}`,
    full: `${day}/${month}/${year}`,
    weekday: weekdays[date.getDay()] || '',
    day,
    month
  };
}

function toTitleCase(value) {
  if (!value) return '';

  const acronyms = [
    'UTI',
    'UCO',
    'PA',
    'PS',
    'CRM',
    'COREN',
    'SAMU',
    'SUS'
  ];

  return value
    .toLowerCase()
    .split(' ')
    .map((word) => {
      const upper = word.toUpperCase();

      if (acronyms.includes(upper)) {
        return upper;
      }

      if (
        ['de', 'da', 'do', 'das', 'dos', 'e'].includes(word)
      ) {
        return word;
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function isNightShift(shift) {
  if (shift?.shift_type === 'noturno') {
    return true;
  }

  const start = shift?.start_time || '';

  return start >= '18:00' || start < '06:00';
}

function hasSwapInformation(shift) {
  const notes = String(shift?.notes || '').toLowerCase();

  return (
    notes.includes('transferido') ||
    notes.includes('mural') ||
    notes.includes('troca') ||
    notes.includes('cessão')
  );
}

/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */

export default function MinhaEscala() {
  const {
    user,
    company,
    loading: appLoading
  } = useAppData();

  const [shifts, setShifts] = useState([]);
  const [allUnitShifts, setAllUnitShifts] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);

  /* Modal de troca */
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [modalMode, setModalMode] = useState('direta');
  const [targetProfId, setTargetProfId] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const companyId =
    user?.data?.company_id ||
    company?.id ||
    'cmp_principal';

  const unitId =
    user?.data?.selected_unit_id ||
    company?.selected_unit_id ||
    company?.units?.[0]?.id ||
    'unit_h1';

  /* =========================================================
     PROFISSIONAL LOGADO
  ========================================================= */

  const myProfessional = useMemo(() => {
    const userId = user?.id;
    const userEmail = user?.email;
    const userName = user?.full_name;

    return (professionals || []).find(
      (professional) =>
        professional.user_id === userId ||
        (
          professional.email &&
          professional.email === userEmail
        ) ||
        professional.name === userName
    );
  }, [professionals, user]);

  const currentProfId =
    myProfessional?.id ||
    user?.data?.professional_id;

  const currentProfessionalName =
    myProfessional?.name ||
    user?.full_name ||
    'Meu Painel de Escala';

  const currentSpecialty =
    myProfessional?.specialty ||
    myProfessional?.category ||
    'Profissional de saúde';

  /* =========================================================
     CARREGAMENTO DOS DADOS
  ========================================================= */

  const loadData = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);

    try {
      const filterBase = {
        company_id: companyId,
        ...(unitId ? { unit_id: unitId } : {})
      };

      const [
        professionalsResponse,
        shiftsResponse
      ] = await Promise.all([
        base44.entities.Professional
          .filter(
            filterBase,
            '-created_date',
            500
          )
          .catch(() => []),

        base44.entities.Shift
          .filter(
            filterBase,
            'date',
            800
          )
          .catch(() => [])
      ]);

      const loadedProfessionals =
        professionalsResponse || [];

      const loadedShifts =
        shiftsResponse || [];

      setProfessionals(loadedProfessionals);
      setAllUnitShifts(loadedShifts);

      const userId = user?.id;
      const userEmail = user?.email;
      const userName = user?.full_name;

      const loggedProfessional =
        loadedProfessionals.find(
          (professional) =>
            professional.user_id === userId ||
            (
              professional.email &&
              professional.email === userEmail
            ) ||
            professional.name === userName
        );

      const professionalId =
        loggedProfessional?.id ||
        user?.data?.professional_id;

      const myShiftsOnly = loadedShifts
        .filter((shift) => {
          if (
            professionalId &&
            String(shift.professional_id) ===
              String(professionalId)
          ) {
            return true;
          }

          if (
            loggedProfessional?.name &&
            shift.professional_name ===
              loggedProfessional.name
          ) {
            return true;
          }

          if (
            userName &&
            shift.professional_name === userName
          ) {
            return true;
          }

          return false;
        })
        .sort((a, b) => {
          const dateA = a.date
            ? a.date.split('T')[0]
            : '';

          const dateB = b.date
            ? b.date.split('T')[0]
            : '';

          if (dateA < dateB) return -1;
          if (dateA > dateB) return 1;

          const timeA = a.start_time || '00:00';
          const timeB = b.start_time || '00:00';

          return timeA.localeCompare(timeB);
        });

      setShifts(myShiftsOnly);
    } catch (error) {
      console.error(
        'Erro ao carregar Minha Escala:',
        error
      );
    } finally {
      setLoading(false);
    }
  }, [
    companyId,
    unitId,
    user
  ]);

  useEffect(() => {
    if (!appLoading) {
      loadData();
    }
  }, [
    appLoading,
    loadData
  ]);

  /* =========================================================
     COLEGAS E CONFLITOS
  ========================================================= */

  const eligibleColleagues = useMemo(() => {
    if (!selectedShift && !myProfessional) {
      return [];
    }

    const mySpecialty = (
      myProfessional?.specialty ||
      selectedShift?.sector_name ||
      ''
    )
      .trim()
      .toLowerCase();

    const myCategory = (
      myProfessional?.category ||
      ''
    )
      .trim()
      .toLowerCase();

    return professionals.filter((professional) => {
      if (
        String(professional.id) ===
        String(currentProfId)
      ) {
        return false;
      }

      if (
        professional.status === 'inativo'
      ) {
        return false;
      }

      const professionalSpecialty = (
        professional.specialty ||
        ''
      )
        .trim()
        .toLowerCase();

      const professionalCategory = (
        professional.category ||
        ''
      )
        .trim()
        .toLowerCase();

      if (
        mySpecialty &&
        professionalSpecialty
      ) {
        return (
          professionalSpecialty ===
          mySpecialty
        );
      }

      return (
        professionalCategory ===
        myCategory
      );
    });
  }, [
    professionals,
    myProfessional,
    currentProfId,
    selectedShift
  ]);

  const colleagueHasConflict = useMemo(() => {
    if (
      !selectedShift ||
      !targetProfId ||
      modalMode !== 'direta'
    ) {
      return false;
    }

    const selectedDate =
      selectedShift.date?.split('T')[0];

    return allUnitShifts.some((shift) => {
      const shiftDate =
        shift.date?.split('T')[0];

      return (
        shiftDate === selectedDate &&
        String(shift.professional_id) ===
          String(targetProfId) &&
        shift.status !== 'cancelado'
      );
    });
  }, [
    allUnitShifts,
    selectedShift,
    targetProfId,
    modalMode
  ]);

  /* =========================================================
     MODAL
  ========================================================= */

  const openSwapModal = (shift) => {
    setSelectedShift(shift);
    setModalMode('direta');
    setTargetProfId('');
    setSwapReason('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;

    setModalOpen(false);
    setSelectedShift(null);
    setTargetProfId('');
    setSwapReason('');
  };

  const handleSendSwap = async (event) => {
    event.preventDefault();

    if (!selectedShift) return;

    const isMural = modalMode === 'mural';

    if (!isMural && !targetProfId) {
      alert(
        'Selecione um colega ou escolha a opção "Deixar no Mural".'
      );

      return;
    }

    if (colleagueHasConflict) {
      const proceed = window.confirm(
        'Atenção: o profissional selecionado já possui plantão nesta data. Deseja continuar mesmo assim?'
      );

      if (!proceed) return;
    }

    const targetProfessional = !isMural
      ? professionals.find(
          (professional) =>
            String(professional.id) ===
            String(targetProfId)
        )
      : null;

    setSubmitting(true);

    try {
      const payload = {
        company_id: companyId,
        unit_id:
          unitId ||
          selectedShift.unit_id,

        shift_id: selectedShift.id,
        shift_date: selectedShift.date,

        shift_time: `${
          selectedShift.start_time || '07:00'
        } - ${
          selectedShift.end_time || '19:00'
        }`,

        sector_name:
          selectedShift.sector_name ||
          'Geral',

        requester_professional_id:
          currentProfId,

        requester_name:
          myProfessional?.name ||
          user?.full_name ||
          'Plantonista',

        requester_specialty:
          myProfessional?.specialty ||
          myProfessional?.category ||
          'Clínica Médica',

        target_professional_id:
          isMural
            ? null
            : targetProfessional?.id,

        target_name:
          isMural
            ? 'Mural Aberto'
            : targetProfessional?.name,

        target_specialty:
          isMural
            ? (
                myProfessional?.specialty ||
                'Geral'
              )
            : (
                targetProfessional?.specialty ||
                targetProfessional?.category
              ),

        swap_type:
          isMural
            ? 'mural'
            : 'cessao',

        reason:
          swapReason.trim(),

        status: 'pendente',

        created_date:
          new Date().toISOString()
      };

      await base44.entities.ShiftSwap.create(
        payload
      );

      closeModal();

      alert(
        isMural
          ? 'Plantão publicado no Mural de Oportunidades!'
          : `Solicitação enviada para ${targetProfessional?.name || 'o colega'}!`
      );

      await loadData();
    } catch (error) {
      console.error(
        'Erro ao enviar troca:',
        error
      );

      alert(
        error.message ||
          'Erro ao registrar solicitação de troca.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* =========================================================
     ESTATÍSTICAS
  ========================================================= */

  const totalShifts = shifts.length;

  const dayShifts = shifts.filter(
    (shift) => !isNightShift(shift)
  ).length;

  const nightShifts = shifts.filter(
    (shift) => isNightShift(shift)
  ).length;

  const nextShift = shifts[0];

  /* =========================================================
     RENDERIZAÇÃO
  ========================================================= */

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-8">
      <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 md:px-8 md:py-8 space-y-5">

        {/* =====================================================
            CABEÇALHO PRINCIPAL
        ===================================================== */}

        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-5 text-white shadow-xl sm:p-7">

          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="relative space-y-5">

            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300 sm:text-xs">
              <CalendarCheck2 className="h-4 w-4" />
              Minha escala
            </div>

            <div>
              <h1 className="max-w-2xl text-2xl font-black tracking-tight sm:text-3xl">
                Olá, {currentProfessionalName.split(' ')[0]}!
              </h1>

              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
                Consulte seus plantões, horários e solicite trocas de forma rápida.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-300">
              <UserRound className="h-4 w-4 text-sky-300" />
              <span>{currentSpecialty}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-3">

              <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
                <div className="text-2xl font-black text-white">
                  {totalShifts}
                </div>

                <div className="mt-1 text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-300">
                  Plantões
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
                <div className="flex items-center gap-1.5 text-2xl font-black text-white">
                  {dayShifts}
                  <Sun className="h-4 w-4 text-amber-300" />
                </div>

                <div className="mt-1 text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-300">
                  Diurnos
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
                <div className="flex items-center gap-1.5 text-2xl font-black text-white">
                  {nightShifts}
                  <Moon className="h-4 w-4 text-indigo-300" />
                </div>

                <div className="mt-1 text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-300">
                  Noturnos
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* =====================================================
            PRÓXIMO PLANTÃO
        ===================================================== */}

        {!loading && nextShift && (
          <section className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm dark:border-sky-900/50 dark:bg-slate-900 sm:p-5">

            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                <Sparkles className="h-4 w-4" />
              </div>

              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  Seu próximo plantão
                </h2>

                <p className="text-xs text-slate-500">
                  Fique atento ao seu próximo compromisso
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">

              <div className="flex min-w-0 items-center gap-3">

                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-sky-600 text-white shadow-sm">
                  <span className="text-[10px] font-bold uppercase">
                    {fmtDate(nextShift.date)?.month}
                  </span>

                  <span className="text-xl font-black leading-none">
                    {fmtDate(nextShift.date)?.day}
                  </span>
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900 dark:text-white">
                    {toTitleCase(nextShift.sector_name) || 'Setor geral'}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {fmtDate(nextShift.date)?.weekday}
                  </p>

                  <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-300">
                    <Clock3 className="h-3.5 w-3.5" />
                    {nextShift.start_time || '07:00'} às {nextShift.end_time || '19:00'}
                  </div>
                </div>

              </div>

              <div className="hidden shrink-0 sm:block">
                <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-[10px] font-black uppercase text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  Confirmado
                </span>
              </div>

            </div>
          </section>
        )}

        {/* =====================================================
            LISTA DE PLANTÕES
        ===================================================== */}

        <Card className="overflow-hidden rounded-[28px] border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

          <div className="border-b border-slate-100 px-4 py-5 dark:border-slate-800 sm:px-6">

            <div className="flex items-center justify-between gap-3">

              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white sm:text-lg">
                  Meus plantões
                </h2>

                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Consulte seus horários ou solicite uma troca.
                </p>
              </div>

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <CalendarDays className="h-5 w-5" />
              </div>

            </div>
          </div>

          <div className="p-3 sm:p-5">

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Loader2 className="h-8 w-8 animate-spin text-sky-600" />

                <p className="text-xs font-semibold text-slate-500">
                  Carregando sua escala...
                </p>
              </div>
            ) : shifts.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-16 text-center">

                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                  <CalendarDays className="h-8 w-8" />
                </div>

                <h3 className="text-sm font-black text-slate-700 dark:text-slate-200">
                  Nenhum plantão encontrado
                </h3>

                <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-500">
                  No momento, não existem plantões vinculados ao seu perfil.
                  Fique atento ao Mural de Oportunidades.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">

                {shifts.map((shift) => {
                  const nightShift = isNightShift(shift);
                  const swapInformation = hasSwapInformation(shift);
                  const dateInfo = fmtDate(shift.date);

                  return (
                    <article
                      key={shift.id}
                      className="group overflow-hidden rounded-3xl border border-slate-200 bg-white transition-all duration-200 hover:border-sky-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-700"
                    >

                      {/* Faixa superior */}
                      <div
                        className={`h-1.5 w-full ${
                          nightShift
                            ? 'bg-gradient-to-r from-indigo-500 to-violet-500'
                            : 'bg-gradient-to-r from-sky-500 to-cyan-400'
                        }`}
                      />

                      <div className="space-y-4 p-4">

                        {/* Data e horário */}
                        <div className="flex items-start justify-between gap-3">

                          <div className="flex min-w-0 items-center gap-3">

                            <div
                              className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl ${
                                nightShift
                                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                                  : 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                              }`}
                            >
                              <span className="text-[10px] font-black uppercase">
                                {dateInfo?.month}
                              </span>

                              <span className="text-xl font-black leading-none">
                                {dateInfo?.day}
                              </span>
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-900 dark:text-white">
                                {dateInfo?.weekday}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-500">
                                {dateInfo?.full}
                              </p>

                              <div
                                className={`mt-1.5 flex items-center gap-1.5 text-xs font-black ${
                                  nightShift
                                    ? 'text-indigo-600 dark:text-indigo-300'
                                    : 'text-sky-600 dark:text-sky-300'
                                }`}
                              >
                                {nightShift ? (
                                  <Moon className="h-3.5 w-3.5" />
                                ) : (
                                  <Sun className="h-3.5 w-3.5" />
                                )}

                                {shift.start_time || '07:00'} às {shift.end_time || '19:00'}
                              </div>
                            </div>

                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase ${
                              nightShift
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                            }`}
                          >
                            {nightShift ? 'Noturno' : 'Diurno'}
                          </span>

                        </div>

                        {/* Setor */}
                        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/70">

                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-400">
                            <Building2 className="h-4 w-4" />
                          </div>

                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Setor de atuação
                            </p>

                            <p className="truncate text-xs font-black text-slate-700 dark:text-slate-200">
                              {toTitleCase(shift.sector_name) || 'Setor geral'}
                            </p>
                          </div>

                        </div>

                        {/* Informações de troca */}
                        {swapInformation && (
                          <div className="flex items-start gap-2 rounded-2xl border border-sky-100 bg-sky-50 p-3 dark:border-sky-900/50 dark:bg-sky-950/30">

                            <Handshake className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" />

                            <p className="text-[11px] font-semibold leading-relaxed text-sky-800 dark:text-sky-200">
                              {shift.notes}
                            </p>

                          </div>
                        )}

                        {/* Rodapé do card */}
                        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">

                          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-4 w-4" />
                            Confirmado
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            onClick={() => openSwapModal(shift)}
                            className="h-9 rounded-xl bg-slate-950 px-3 text-[11px] font-black text-white shadow-sm transition hover:bg-sky-700 dark:bg-slate-800 dark:hover:bg-sky-700"
                          >
                            <Repeat2 className="mr-1.5 h-3.5 w-3.5 text-sky-300" />
                            Trocar
                            <ChevronRight className="ml-1 h-3.5 w-3.5" />
                          </Button>

                        </div>

                      </div>
                    </article>
                  );
                })}

              </div>
            )}

          </div>
        </Card>

        {/* =====================================================
            AVISO INFORMATIVO
        ===================================================== */}

        <div className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
            <Info className="h-4 w-4" />
          </div>

          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200">
              Sobre as solicitações de troca
            </h3>

            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              A solicitação ficará pendente até ser analisada ou aceita pelo profissional responsável.
              A troca só deve ser considerada válida após a confirmação no sistema.
            </p>
          </div>

        </div>

      </div>

      {/* =======================================================
          MODAL DE TROCA
      ======================================================= */}

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeModal();
          } else {
            setModalOpen(true);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] w-[calc(100%-24px)] overflow-y-auto rounded-3xl border-slate-200 p-0 dark:border-slate-800 dark:bg-slate-900 sm:max-w-lg">

          <div className="border-b border-slate-100 bg-slate-50 px-5 py-5 dark:border-slate-800 dark:bg-slate-950/60">

            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                  <Repeat2 className="h-5 w-5" />
                </div>

                Solicitar troca
              </DialogTitle>
            </DialogHeader>

            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Escolha se deseja passar o plantão para um colega específico ou disponibilizá-lo no mural.
            </p>
          </div>

          {selectedShift && (
            <form
              onSubmit={handleSendSwap}
              className="space-y-5 p-5"
            >

              {/* Resumo do plantão */}
              <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/60">

                <div className="flex items-center gap-3">

                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                    <span className="text-[9px] font-black uppercase">
                      {fmtDate(selectedShift.date)?.month}
                    </span>

                    <span className="text-lg font-black leading-none">
                      {fmtDate(selectedShift.date)?.day}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      {fmtDate(selectedShift.date)?.weekday}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500">
                      {fmtDate(selectedShift.date)?.full}
                    </p>

                    <p className="mt-1 text-xs font-black text-sky-600 dark:text-sky-300">
                      {selectedShift.start_time || '07:00'} às {selectedShift.end_time || '19:00'}
                    </p>
                  </div>

                </div>

                <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <Building2 className="h-4 w-4 text-slate-400" />

                  <span>
                    Setor:{' '}
                    <strong>
                      {toTitleCase(selectedShift.sector_name) || 'Geral'}
                    </strong>
                  </span>
                </div>

              </div>

              {/* Tipo de troca */}
              <div className="space-y-2">

                <Label className="text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  Como deseja disponibilizar?
                </Label>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">

                  <button
                    type="button"
                    onClick={() => {
                      setModalMode('direta');
                      setTargetProfId('');
                    }}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      modalMode === 'direta'
                        ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-500/20 dark:bg-sky-950/40'
                        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <UsersRound
                        className={`h-5 w-5 ${
                          modalMode === 'direta'
                            ? 'text-sky-600'
                            : 'text-slate-400'
                        }`}
                      />

                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        Passar para alguém
                      </span>
                    </div>

                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      Escolher um colega específico.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModalMode('mural');
                      setTargetProfId('');
                    }}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      modalMode === 'mural'
                        ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-500/20 dark:bg-sky-950/40'
                        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Globe2
                        className={`h-5 w-5 ${
                          modalMode === 'mural'
                            ? 'text-sky-600'
                            : 'text-slate-400'
                        }`}
                      />

                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        Deixar no mural
                      </span>
                    </div>

                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      Disponibilizar para colegas compatíveis.
                    </p>
                  </button>

                </div>
              </div>

              {/* Seleção do profissional */}
              {modalMode === 'direta' && (
                <div className="space-y-2">

                  <Label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    Profissional substituto
                  </Label>

                  <select
                    value={targetProfId}
                    onChange={(event) =>
                      setTargetProfId(event.target.value)
                    }
                    required
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="">
                      Selecione um colega...
                    </option>

                    {eligibleColleagues.map((professional) => (
                      <option
                        key={professional.id}
                        value={professional.id}
                      >
                        {professional.name} —{' '}
                        {professional.specialty ||
                          professional.category ||
                          'Geral'}
                      </option>
                    ))}
                  </select>

                  {eligibleColleagues.length === 0 && (
                    <p className="flex items-center gap-1.5 text-[11px] text-amber-600">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Nenhum colega compatível encontrado.
                    </p>
                  )}

                  {colleagueHasConflict && (
                    <div className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">

                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />

                      <div>
                        <strong className="text-xs font-black">
                          Atenção: conflito de escala
                        </strong>

                        <p className="mt-1 text-[11px] leading-relaxed">
                          Este profissional já possui outro plantão nesta mesma data.
                          Verifique se não haverá sobrecarga.
                        </p>
                      </div>

                    </div>
                  )}

                </div>
              )}

              {/* Aviso do mural */}
              {modalMode === 'mural' && (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-950/30">

                  <div className="flex items-center gap-2 text-xs font-black text-sky-700 dark:text-sky-300">
                    <Globe2 className="h-4 w-4" />
                    Mural de Oportunidades
                  </div>

                  <p className="mt-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    Seu plantão ficará disponível para profissionais credenciados
                    na especialidade compatível com este setor.
                  </p>

                </div>
              )}

              {/* Motivo */}
              <div className="space-y-2">

                <Label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  Motivo da solicitação
                  <span className="ml-1 font-normal text-slate-400">
                    (opcional)
                  </span>
                </Label>

                <Input
                  value={swapReason}
                  onChange={(event) =>
                    setSwapReason(event.target.value)
                  }
                  placeholder="Ex: conflito de agenda, emergência pessoal..."
                  className="h-11 rounded-xl text-xs"
                />

              </div>

              {/* Botões */}
              <DialogFooter className="flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row">

                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                  disabled={submitting}
                  className="h-11 w-full rounded-xl text-xs font-bold sm:w-auto"
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  disabled={
                    submitting ||
                    (
                      modalMode === 'direta' &&
                      !targetProfId
                    )
                  }
                  className="h-11 w-full rounded-xl bg-sky-600 text-xs font-black text-white hover:bg-sky-700 sm:w-auto"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      {modalMode === 'mural'
                        ? 'Publicar no mural'
                        : 'Enviar solicitação'}

                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

              </DialogFooter>

            </form>
          )}

        </DialogContent>
      </Dialog>
    </div>
  );
}