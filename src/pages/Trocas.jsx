import React, { useState, useMemo } from 'react';
import { useAppData } from '@/lib/useAppData';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Flame, Calendar, Clock, Building2, User, 
  CheckCircle2, Check, AlertCircle, ShieldAlert, Trash2, 
  Repeat, ArrowRightLeft, Stethoscope, Filter, XCircle,
  Clock3, ShieldCheck, History, UserCheck, AlertTriangle, ArrowRight
} from 'lucide-react';

function formatFullName(name) {
  if (!name) return 'Profissional';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function extractSpecialty(shift, prof) {
  if (shift?.target_specialty && shift.target_specialty.trim() && shift.target_specialty.toLowerCase() !== 'geral') {
    return shift.target_specialty.trim();
  }
  if (shift?.notes) {
    const match = shift.notes.match(/\[ESP:([^\]]+)\]/i);
    if (match && match[1]) return match[1].trim();
  }
  try {
    if (shift?.id) {
      const cached = window.localStorage.getItem(`shift_spec_${shift.id}`);
      if (cached) return cached;
    }
  } catch {}
  return prof?.specialty || shift?.target_specialty || 'Clínica Médica';
}

function timeToMinutes(timeStr, isEnd = false) {
  if (!timeStr) return isEnd ? 19 * 60 : 7 * 60;
  const [h, m] = String(timeStr).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function getShiftInterval(shift) {
  const startMin = timeToMinutes(shift?.start_time || '07:00');
  let endMin = timeToMinutes(shift?.end_time || '19:00', true);
  if (endMin <= startMin) endMin += 24 * 60;
  return { startMin, endMin };
}

function parseShiftAudit(shift) {
  const notes = String(shift?.notes || '');
  const offeredByName = notes.match(/\[SOLICITADO_POR:\s*([^\]]+)\]/i)?.[1] || '';
  const offeredById = notes.match(/\[SOLICITADO_ID:\s*([^\]]+)\]/i)?.[1] || '';
  const transferFrom = notes.match(/\[ORIGEM_MURAL:\s*([^\]]+)\]/i)?.[1] || '';
  const transferTo = notes.match(/\[TRANSFER_TO:\s*([^\]]+)\]/i)?.[1] || '';
  const transferText = notes.match(/\[TRANSFERENCIA:\s*([^\]]+)\]/i)?.[1] || '';
  const authorizedBy = notes.match(/\[AUTORIZADO_POR:\s*([^\]]+)\]/i)?.[1] || '';
  const isAguardandoGestor = shift?.status === 'aguardando_aprovacao_gestor' || notes.includes('[AGUARDANDO_GESTOR]');

  return { offeredByName, offeredById, transferFrom, transferTo, transferText, authorizedBy, isAguardandoGestor };
}

async function autoHealingSaveShift(id, initialPayload) {
  let payload = { ...initialPayload };
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      if (id) return await base44.entities.Shift.update(id, payload);
      else return await base44.entities.Shift.create(payload);
    } catch (err) {
      const msg = err.message || '';
      const match = msg.match(/Could not find the '([^']+)' column/i);
      if (match && match[1]) { 
        delete payload[match[1]]; 
        continue; 
      }
      throw err;
    }
  }
}

async function safeUpdateShift(id, payload) {
  const cleanPayload = { ...payload };
  delete cleanPayload.offered_by_id;
  delete cleanPayload.offered_by_name;
  delete cleanPayload.transfer_from_id;
  delete cleanPayload.transfer_from_name;
  delete cleanPayload.transfer_to_id;
  delete cleanPayload.transfer_to_name;
  delete cleanPayload.authorized_by_manager;

  try {
    return await autoHealingSaveShift(id, cleanPayload);
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('status') || msg.includes('enum') || msg.includes('check constraint')) {
      if (cleanPayload.status === 'aguardando_aprovacao_gestor') {
        cleanPayload.status = 'confirmado';
        cleanPayload.notes = `${cleanPayload.notes || ''} [AGUARDANDO_GESTOR]`.trim();
      } else if (cleanPayload.status === 'disponivel_mural') {
        cleanPayload.status = 'vago';
        cleanPayload.notes = `${cleanPayload.notes || ''} [DISPONIVEL_MURAL]`.trim();
      }
      return await autoHealingSaveShift(id, cleanPayload);
    }
    throw err;
  }
}

export default function Trocas() {
  const { 
    shifts = [], 
    sectors = [], 
    professionals = [], 
    currentProfessional, 
    user,
    isManager, 
    syncGlobalData 
  } = useAppData();

  const [activeTab, setActiveTab] = useState('vagas');
  const [selectedSpecialtyFilter, setSelectedSpecialtyFilter] = useState('todas');
  const [submitting, setSubmitting] = useState(false);

  const myProf = useMemo(() => {
    return currentProfessional || (professionals || []).find(p => 
      (p.id && String(p.id) === String(user?.data?.professional_id || user?.id)) ||
      (p.name && user?.full_name && p.name.toLowerCase().trim() === user.full_name.toLowerCase().trim())
    ) || null;
  }, [currentProfessional, professionals, user]);

  const sectorMap = useMemo(() => {
    const m = {};
    (sectors || []).forEach(s => { if (s?.id) m[String(s.id)] = s; });
    return m;
  }, [sectors]);

  const myAllocatedShifts = useMemo(() => {
    if (!myProf?.id && !user?.full_name) return [];
    return (shifts || []).filter(s => {
      if (!s || s.status === 'cancelado' || s.status === 'vago' || !s.professional_id) return false;
      const matchId = myProf?.id && String(s.professional_id) === String(myProf.id);
      const matchUserId = user?.data?.professional_id && String(s.professional_id) === String(user.data.professional_id);
      const matchName = user?.full_name && s.professional_name && s.professional_name.toLowerCase().trim() === user.full_name.toLowerCase().trim();
      return matchId || matchUserId || matchName;
    });
  }, [shifts, myProf, user]);

  const checkTimeConflict = (shiftCandidate) => {
    if (!shiftCandidate || !shiftCandidate.date) return { hasConflict: false };

    const candInt = getShiftInterval(shiftCandidate);

    for (const myShift of myAllocatedShifts) {
      if (String(myShift.id) === String(shiftCandidate.id)) continue;
      if (myShift.date !== shiftCandidate.date) continue;

      const myInt = getShiftInterval(myShift);
      const overlaps = Math.max(myInt.startMin, candInt.startMin) < Math.min(myInt.endMin, candInt.endMin);

      if (overlaps) {
        const sectorConflict = sectorMap[String(myShift.sector_id)]?.name || 'outro setor';
        return {
          hasConflict: true,
          conflictShift: myShift,
          message: `Choque de Horário: Você já está alocado em "${sectorConflict}" (${myShift.start_time} às ${myShift.end_time}) no dia ${shiftCandidate.date}.`
        };
      }
    }

    return { hasConflict: false };
  };

  const allHospitalSpecialties = useMemo(() => {
    const set = new Set();
    (professionals || []).forEach(p => {
      if (p?.specialty && p.specialty.trim() && p.specialty.toLowerCase() !== 'geral') {
        set.add(p.specialty.trim());
      }
    });
    (shifts || []).forEach(s => {
      const spec = extractSpecialty(s, null);
      if (spec && spec.toLowerCase() !== 'geral') set.add(spec);
    });
    return Array.from(set).sort();
  }, [professionals, shifts]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const openShifts = useMemo(() => {
    return (shifts || []).filter(s => {
      if (!s) return false;
      const st = String(s.status || '').toLowerCase();
      const audit = parseShiftAudit(s);

      if (st.includes('cancel') || st.includes('inativ')) return false;
      if (audit.isAguardandoGestor) return false;

      const isMuralApproved = st === 'vago' || st === 'disponivel_mural' || audit.transferFrom !== '';
      if (!isMuralApproved) return false;
      if (s.professional_id) return false;
      if (s.date && s.date < todayStr) return false;

      if (selectedSpecialtyFilter !== 'todas') {
        const spec = extractSpecialty(s, null);
        if (spec.toLowerCase() !== selectedSpecialtyFilter.toLowerCase()) return false;
      }

      return true;
    }).sort((a, b) => (a?.date || '').localeCompare(b?.date || ''));
  }, [shifts, selectedSpecialtyFilter, todayStr]);

  const pendingApprovalShifts = useMemo(() => {
    return (shifts || []).filter(s => {
      if (!s) return false;
      const audit = parseShiftAudit(s);
      return audit.isAguardandoGestor;
    }).sort((a, b) => (a?.date || '').localeCompare(b?.date || ''));
  }, [shifts]);

  const myPendingShifts = useMemo(() => {
    if (!myProf?.id) return [];
    return pendingApprovalShifts.filter(s => {
      const audit = parseShiftAudit(s);
      return String(s.professional_id) === String(myProf.id) ||
             String(audit.offeredById) === String(myProf.id) ||
             (audit.offeredByName && myProf.name && audit.offeredByName.toLowerCase().trim() === myProf.name.toLowerCase().trim());
    });
  }, [pendingApprovalShifts, myProf]);

  const myUpcomingShifts = useMemo(() => {
    if (!myProf?.id && !user?.full_name) return [];
    return (shifts || []).filter(s => {
      if (!s || s.status === 'vago' || !s.professional_id) return false;
      const isMine = (myProf?.id && String(s.professional_id) === String(myProf.id)) || 
                     (s.professional_name && myProf?.name && s.professional_name.toLowerCase().trim() === myProf.name.toLowerCase().trim()) ||
                     (s.professional_name && user?.full_name && s.professional_name.toLowerCase().trim() === user.full_name.toLowerCase().trim());
      return isMine && s.date >= todayStr && s.status !== 'cancelado';
    }).sort((a, b) => (a?.date || '').localeCompare(b?.date || ''));
  }, [shifts, myProf, user, todayStr]);

  const transferHistory = useMemo(() => {
    return (shifts || []).filter(s => {
      if (!s) return false;
      const notes = String(s.notes || '');
      return notes.includes('[TRANSFERENCIA:') || notes.includes('[ORIGEM_MURAL:');
    }).sort((a, b) => (b?.date || '').localeCompare(a?.date || ''));
  }, [shifts]);

  const handleRequestSendToMural = async (shift) => {
    const requesterName = myProf?.name || user?.full_name || 'Profissional';
    const requesterId = myProf?.id || user?.id || '';

    if (!confirm(`Deseja solicitar o envio do seu plantão de ${shift.date} (${shift.start_time} às ${shift.end_time}) para o Mural?\n\nA vaga passará pela avaliação da coordenação antes de ser liberada.`)) {
      return;
    }

    setSubmitting(true);
    try {
      const currentNotes = String(shift.notes || '');
      const cleanNotes = currentNotes.replace(/\[SOLICITADO_POR:[^\]]+\]/gi, '').replace(/\[AGUARDANDO_GESTOR\]/gi, '').trim();
      const updatedNotes = `${cleanNotes} [SOLICITADO_POR: ${requesterName}] [SOLICITADO_ID: ${requesterId}] [AGUARDANDO_GESTOR]`.trim();

      await safeUpdateShift(shift.id, {
        status: 'aguardando_aprovacao_gestor',
        notes: updatedNotes
      });

      await syncGlobalData();
      alert('Solicitação enviada com sucesso! O plantão está aguardando a avaliação da coordenação.');
    } catch (err) {
      alert('Erro ao solicitar envio: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveMuralPost = async (shift) => {
    const audit = parseShiftAudit(shift);
    const originName = audit.offeredByName || formatFullName(shift.professional_name) || 'Colega';

    if (!confirm(`Autorizar a abertura do plantão de ${shift.date} no Mural?\nOrigem: ${originName}`)) return;

    setSubmitting(true);
    try {
      const currentNotes = String(shift.notes || '');
      const cleanNotes = currentNotes.replace(/\[AGUARDANDO_GESTOR\]/gi, '').trim();
      const updatedNotes = `${cleanNotes} [ORIGEM_MURAL: ${originName}] [AUTORIZADO_POR: ${user?.full_name || 'Gestor Geral'}] [DISPONIVEL_MURAL]`.trim();

      await safeUpdateShift(shift.id, {
        status: 'vago',
        professional_id: null,
        professional_name: null,
        notes: updatedNotes
      });

      await syncGlobalData();
      alert('Plantão autorizado e publicado com sucesso no Mural de Oportunidades!');
    } catch (err) {
      alert('Erro ao autorizar: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectMuralPost = async (shift) => {
    const audit = parseShiftAudit(shift);
    const originName = audit.offeredByName || formatFullName(shift.professional_name) || 'o profissional';

    if (!confirm(`Recusar a liberação no Mural? O plantão permanecerá sob a titularidade de ${originName}.`)) return;

    setSubmitting(true);
    try {
      const currentNotes = String(shift.notes || '');
      const cleanNotes = currentNotes.replace(/\[AGUARDANDO_GESTOR\]/gi, '').trim();
      const updatedNotes = `${cleanNotes} [RECUSADO_EM: ${new Date().toLocaleDateString('pt-BR')}]`.trim();

      await safeUpdateShift(shift.id, {
        status: 'confirmado',
        notes: updatedNotes
      });

      await syncGlobalData();
      alert(`Solicitação cancelada. O plantão permanece com ${originName}.`);
    } catch (err) {
      alert('Erro ao recusar: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaimShift = async (shift) => {
    if (!myProf?.id) {
      alert('Seu perfil profissional não foi localizado no sistema.');
      return;
    }

    const conflictCheck = checkTimeConflict(shift);
    if (conflictCheck.hasConflict) {
      alert(`⛔ AÇÃO BLOQUEADA PELO SISTEMA:\n\n${conflictCheck.message}\n\nVocê não pode assumir dois plantões no mesmo horário.`);
      return;
    }

    const sectorName = sectorMap[String(shift.sector_id)]?.name || 'Setor Hospitalar';
    const audit = parseShiftAudit(shift);
    const originName = audit.transferFrom || audit.offeredByName || null;
    const originMsg = originName ? `\n(Cedido por: ${originName})` : '';

    if (!confirm(`Confirmar assunção do plantão?${originMsg}\n\nSetor: ${sectorName}\nData: ${shift.date} (${shift.start_time || '07:00'} às ${shift.end_time || '19:00'})`)) {
      return;
    }

    setSubmitting(true);
    try {
      const currentNotes = String(shift.notes || '');
      const cleanNotes = currentNotes.replace(/\[DISPONIVEL_MURAL\]/gi, '').trim();
      const transferAudit = originName 
        ? `[TRANSFERENCIA: ${originName} -> ${myProf.name}] [TRANSFER_TO: ${myProf.name}] [DATA: ${new Date().toLocaleDateString('pt-BR')}]` 
        : `[ASSUNCAO_DIRETA: ${myProf.name}]`;

      const updatedNotes = `${cleanNotes} ${transferAudit}`.trim();

      await safeUpdateShift(shift.id, {
        professional_id: myProf.id,
        professional_name: myProf.name,
        status: 'confirmado',
        notes: updatedNotes
      });

      await syncGlobalData();
      alert(`Plantão confirmado com sucesso para ${myProf.name}!`);
    } catch (err) {
      alert('Erro ao assumir plantão: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteVaga = async (shiftId) => {
    if (!confirm('Excluir esta vaga definitivamente?')) return;
    try {
      await base44.entities.Shift.delete(shiftId);
      await syncGlobalData();
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans bg-slate-100 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      
      {/* 1. HEADER EXECUTIVO */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400">
            <Flame className="w-4 h-4" /> Centro de Oportunidades & Trocas
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Mural de Vagas & Repasses</h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Ambiente auditado com trava matemática contra duplicidade e choques de horário.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-5 py-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-center shadow-lg">
            <span className="text-[10px] font-black uppercase text-slate-400 block">Vagas no Mural</span>
            <span className="text-2xl font-black font-mono text-amber-400">{openShifts.length}</span>
          </div>

          {isManager && (
            <div className="px-5 py-3 rounded-2xl bg-slate-900/90 border border-indigo-500/40 text-center shadow-lg">
              <span className="text-[10px] font-black uppercase text-indigo-400 block">Pendentes Gestor</span>
              <span className="text-2xl font-black font-mono text-indigo-300">{pendingApprovalShifts.length}</span>
            </div>
          )}
        </div>
      </div>

      {myPendingShifts.length > 0 && !isManager && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <Clock3 className="w-5 h-5 text-amber-500 shrink-0 animate-pulse" />
            <div>
              <strong className="text-xs font-black uppercase tracking-wider block">
                Você possui {myPendingShifts.length} solicitação(ões) em análise pela coordenação
              </strong>
              <span className="text-[11px] opacity-90">
                O plantão só ficará disponível para os colegas no Mural após a autorização do gestor.
              </span>
            </div>
          </div>
          <span className="text-xs font-black font-mono px-3 py-1 rounded-xl bg-amber-500/20 text-amber-800 dark:text-amber-300">
            AGUARDANDO GESTÃO
          </span>
        </div>
      )}

      {/* 2. BARRA DE NAVEGAÇÃO POR ABAS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('vagas')} 
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'vagas' ? 'bg-amber-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Vagas no Mural ({openShifts.length})</span>
          </button>

          {isManager && (
            <button 
              onClick={() => setActiveTab('pendentes')} 
              className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'pendentes' ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Aprovações Pendentes ({pendingApprovalShifts.length})</span>
            </button>
          )}

          <button 
            onClick={() => setActiveTab('trocas')} 
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'trocas' ? 'bg-sky-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Meus Plantões / Passar p/ Mural ({myUpcomingShifts.length})</span>
          </button>

          <button 
            onClick={() => setActiveTab('historico')} 
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'historico' ? 'bg-slate-900 text-white dark:bg-slate-800 shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Histórico de Repasses ({transferHistory.length})</span>
          </button>
        </div>

        {activeTab === 'vagas' && (
          <div className="flex items-center gap-1.5 overflow-x-auto shrink-0 pb-1">
            <span className="text-[10px] font-black uppercase text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Especialidade:
            </span>
            <button 
              onClick={() => setSelectedSpecialtyFilter('todas')} 
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedSpecialtyFilter === 'todas' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              Todas
            </button>
            {allHospitalSpecialties.map(spec => (
              <button 
                key={spec} 
                onClick={() => setSelectedSpecialtyFilter(spec)} 
                className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  selectedSpecialtyFilter === spec ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {spec}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. VAGAS NO MURAL */}
      {activeTab === 'vagas' && (
        <>
          {openShifts.length === 0 ? (
            <Card className="p-16 text-center border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2 rounded-3xl">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="font-black text-slate-900 dark:text-white text-base">Nenhuma vaga aberta no momento</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Todas as escalas dos setores estão preenchidas e não há repasses pendentes nesta categoria.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {openShifts.map(shift => {
                const sector = sectorMap[String(shift.sector_id)];
                const realSpecialty = extractSpecialty(shift, null);
                const conflictInfo = checkTimeConflict(shift);
                const audit = parseShiftAudit(shift);
                const originName = audit.transferFrom || audit.offeredByName || null;

                return (
                  <Card 
                    key={shift.id} 
                    className={`p-5 rounded-3xl border-2 transition-all flex flex-col justify-between space-y-4 shadow-sm ${
                      conflictInfo.hasConflict 
                        ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20' 
                        : 'border-amber-300 dark:border-amber-500/40 bg-white dark:bg-slate-900 hover:shadow-md'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div>
                          <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-500/30">
                            Vaga: {realSpecialty}
                          </span>
                          <h3 className="font-black text-base text-slate-900 dark:text-white mt-2">
                            {sector?.name || 'Setor Hospitalar'}
                          </h3>
                        </div>
                        <span className="text-xs font-mono font-black px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-950 text-sky-600 dark:text-sky-400 border border-slate-200 dark:border-slate-800">
                          {shift.start_time || '07:00'} às {shift.end_time || '19:00'}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                          <Calendar className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                          <span>{new Date(shift.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-slate-500">
                          <Stethoscope className="w-4 h-4" />
                          <span>Exigência: <b>{realSpecialty}</b></span>
                        </div>

                        {originName ? (
                          <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-[11px] flex items-center gap-2">
                            <ArrowRightLeft className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                            <span className="truncate">Cedido por: <b className="text-sky-700 dark:text-sky-300">{originName}</b></span>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                            Vaga institucional aberta
                          </div>
                        )}
                      </div>

                      {conflictInfo.hasConflict && (
                        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                          <div className="font-black flex items-center gap-1.5 uppercase text-[10px]">
                            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                            Bloqueio Anti-Duplicidade
                          </div>
                          <p className="leading-tight text-[11px] font-medium">{conflictInfo.message}</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <Button 
                        onClick={() => handleClaimShift(shift)} 
                        disabled={submitting || conflictInfo.hasConflict} 
                        className={`flex-1 h-11 font-black text-xs rounded-xl shadow-md gap-2 ${
                          conflictInfo.hasConflict 
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-slate-700 cursor-not-allowed opacity-80' 
                            : 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                        }`}
                      >
                        <Check className="w-4 h-4" /> 
                        {conflictInfo.hasConflict ? 'Horário Conflitante (Bloqueado)' : 'Assumir Plantão'}
                      </Button>

                      {isManager && (
                        <Button 
                          variant="ghost" 
                          onClick={() => handleDeleteVaga(shift.id)} 
                          className="h-11 w-11 p-0 text-slate-400 hover:text-rose-500 rounded-xl cursor-pointer"
                          title="Excluir Vaga"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 4. APROVAÇÕES PENDENTES */}
      {activeTab === 'pendentes' && isManager && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <span>
                <b>Mesa de Controle do Gestor:</b> Avalie os pedidos dos profissionais antes de liberar os plantões no Mural.
              </span>
            </div>
            <span className="font-mono font-black px-2.5 py-0.5 rounded-lg bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
              {pendingApprovalShifts.length} pendente(s)
            </span>
          </div>

          {pendingApprovalShifts.length === 0 ? (
            <Card className="p-16 text-center border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2 rounded-3xl">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="font-black text-slate-900 dark:text-white text-base">Nenhuma solicitação pendente</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Não há pedidos de envio de plantão ao Mural aguardando sua autorização.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingApprovalShifts.map(shift => {
                const sector = sectorMap[String(shift.sector_id)];
                const audit = parseShiftAudit(shift);
                const requesterName = audit.offeredByName || formatFullName(shift.professional_name) || 'Profissional';
                const realSpecialty = extractSpecialty(shift, null);

                return (
                  <Card key={shift.id} className="p-5 rounded-3xl border-2 border-indigo-300 dark:border-indigo-500/40 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div>
                          <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                            Aguardando Autorização
                          </span>
                          <h3 className="font-black text-base text-slate-900 dark:text-white mt-1.5">
                            {sector?.name || 'Setor'}
                          </h3>
                        </div>
                        <span className="text-xs font-mono font-black text-sky-600 dark:text-sky-400 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                          {shift.start_time} - {shift.end_time}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Solicitante da Liberação:</span>
                          <strong className="text-sm font-black text-slate-900 dark:text-white block truncate">
                            👨‍⚕️ {requesterName}
                          </strong>
                          <span className="text-[11px] text-slate-500 block">Especialidade: {realSpecialty}</span>
                        </div>

                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium">
                          <Calendar className="w-4 h-4 text-sky-600" />
                          <span>{new Date(shift.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
                      <Button 
                        onClick={() => handleRejectMuralPost(shift)} 
                        disabled={submitting} 
                        variant="outline"
                        className="h-10 text-xs font-black border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl gap-1 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" /> Recusar
                      </Button>

                      <Button 
                        onClick={() => handleApproveMuralPost(shift)} 
                        disabled={submitting} 
                        className="h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-md gap-1 cursor-pointer"
                      >
                        <Check className="w-4 h-4" /> Autorizar
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. MEUS PLANTÕES / PASSAR P/ MURAL */}
      {activeTab === 'trocas' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-xs text-sky-900 dark:text-sky-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-sky-600" />
              <span>
                <b>Passar Plantão:</b> Ao disponibilizar seu plantão, o pedido irá para a aprovação do gestor antes de ser liberado aos colegas no Mural.
              </span>
            </div>
          </div>

          {myUpcomingShifts.length === 0 ? (
            <Card className="p-12 text-center border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Você não possui plantões futuros confirmados sob sua titularidade.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myUpcomingShifts.map(shift => {
                const sector = sectorMap[String(shift.sector_id)];
                const audit = parseShiftAudit(shift);
                const isPending = audit.isAguardandoGestor;

                return (
                  <Card key={shift.id} className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400">{sector?.name || 'Setor'}</span>
                          <h4 className="font-black text-sm text-slate-900 dark:text-white mt-0.5">
                            {new Date(shift.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long' })}
                          </h4>
                        </div>
                        <span className="font-mono text-xs font-bold text-sky-600 px-2 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-950">
                          {shift.start_time} - {shift.end_time}
                        </span>
                      </div>
                    </div>

                    {isPending ? (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] font-bold text-amber-700 dark:text-amber-300 text-center flex items-center justify-center gap-1.5">
                        <Clock3 className="w-3.5 h-3.5 animate-pulse" />
                        Aguardando autorização do gestor
                      </div>
                    ) : (
                      <Button 
                        onClick={() => handleRequestSendToMural(shift)} 
                        disabled={submitting} 
                        className="w-full h-10 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs rounded-xl gap-2 shadow-sm cursor-pointer"
                      >
                        <Flame className="w-3.5 h-3.5" /> Passar para o Mural
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. HISTÓRICO DE REPASSES (REGEX CORRIGIDA) */}
      {activeTab === 'historico' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900 text-white text-xs flex items-center justify-between border border-slate-800">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-400" />
              <span>
                <b>Trilha de Auditoria:</b> Histórico consolidado de repasses assistenciais aprovados e concluídos.
              </span>
            </div>
            <span className="font-mono text-slate-400 text-xs">{transferHistory.length} transação(ões)</span>
          </div>

          {transferHistory.length === 0 ? (
            <Card className="p-16 text-center border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl">
              <History className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-50" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Nenhum repasse registrado</h3>
              <p className="text-xs text-slate-500">As trocas efetivadas entre profissionais aparecerão aqui.</p>
            </Card>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 uppercase text-[10px] font-black border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Data do Plantão</th>
                      <th className="py-3 px-4">Setor / Horário</th>
                      <th className="py-3 px-4">Repasse Assistencial (Origem ➔ Destino)</th>
                      <th className="py-3 px-4 text-center">Autorização</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {transferHistory.map(shift => {
                      const sector = sectorMap[String(shift.sector_id)];
                      const notes = String(shift.notes || '');

                      const matchTransfer = notes.match(/\[TRANSFERENCIA:\s*([^\]\->]+)\s*->\s*([^\]]+)\]/i);
                      const deQuem = matchTransfer?.[1]?.trim() || (notes.match(/\[ORIGEM_MURAL:\s*([^\]]+)\]/i)?.[1]) || 'Profissional Cedente';
                      const paraQuem = matchTransfer?.[2]?.trim() || shift.professional_name || (shift.professional_id ? 'Assumido' : 'No Mural');
                      const autorizador = (notes.match(/\[AUTORIZADO_POR:\s*([^\]]+)\]/i)?.[1]) || 'Gestão Geral';

                      return (
                        <tr key={shift.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {shift.date}
                          </td>
                          <td className="py-3 px-4">
                            <strong className="block text-slate-900 dark:text-white">{sector?.name || 'Setor'}</strong>
                            <span className="font-mono text-[11px] text-slate-400">{shift.start_time} às {shift.end_time}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-700 dark:text-slate-300">{deQuem}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <strong className="text-emerald-700 dark:text-emerald-400">{paraQuem}</strong>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-500">
                            {autorizador}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3" /> {shift.status === 'confirmado' ? 'Efetivado' : 'Disponível'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}