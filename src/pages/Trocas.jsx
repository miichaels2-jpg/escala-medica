import { useState, useMemo } from 'react';
import { useAppData } from '@/lib/useAppData';
import { getProfessionalUnitIds, isProfessionalAuthorizedForSector } from '@/lib/sectorAccess';
import { findUnavailability } from '@/lib/availability';
import { getShiftUrgency } from '@/lib/urgentVacancies';
import { supabase } from '@/lib/supabase';
import { getShiftDateTimeRange } from '@/lib/shiftLiveStatus';
import { recipientFor, sendNotifications } from '@/lib/notifications';
import { isVacancyRelevantFor } from '@/components/NotificationCenter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Flame, Calendar, Building2, 
  CheckCircle2, Check, Trash2, ArrowRightLeft, Stethoscope, Filter, XCircle,
  Clock3, ShieldCheck, History, ArrowRight
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

// "sábado, 17 de outubro" → "Sábado, 17 de outubro"
function formatLongDate(dateStr) {
  const text = new Date(String(dateStr).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('T')[0].split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(dateStr);
}

function getLocalDateString(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  try {
    if (id) {
      const { data, error } = await supabase.from('shifts').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase.from('shifts').insert([payload]).select().single();
      if (error) throw error;
      return data;
    }
  } catch (err) {
    throw err;
  }
}

async function safeUpdateShift(id, payload) {
  let cleanPayload = { ...payload };
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
      const appendTag = (notes, tag) => String(notes || '').includes(tag) ? String(notes || '').trim() : `${notes || ''} ${tag}`.trim();
      if (cleanPayload.status === 'aguardando_aprovacao_gestor') {
        cleanPayload.status = 'confirmado';
        cleanPayload.notes = appendTag(cleanPayload.notes, '[AGUARDANDO_GESTOR]');
      } else if (cleanPayload.status === 'disponivel_mural') {
        cleanPayload.status = 'vago';
        cleanPayload.notes = appendTag(cleanPayload.notes, '[DISPONIVEL_MURAL]');
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
    allCompanyShifts = [],
    allCompanySectors = [],
    currentProfessional, 
    selectedUnitId,
    units = [],
    company,
    user,
    isManager, 
    syncGlobalData 
  } = useAppData();

  const [activeTab, setActiveTab] = useState('vagas');
  const [selectedSpecialtyFilter, setSelectedSpecialtyFilter] = useState('todas');
  // Gestor escolhe entre ver todas as vagas (gestão) ou só as que ele mesmo pode assumir.
  // O plantonista vê sempre só as vagas que pode assumir.
  const [managerView, setManagerView] = useState('todas');
  // Gestor com mais de uma unidade pode ver o mural de todas de uma vez.
  const [managerAllUnits, setManagerAllUnits] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const myProf = useMemo(() => {
    return currentProfessional || (professionals || []).find(p => 
      (p.id && String(p.id) === String(user?.data?.professional_id || user?.id)) ||
      (p.name && user?.full_name && p.name.toLowerCase().trim() === user.full_name.toLowerCase().trim())
    ) || null;
  }, [currentProfessional, professionals, user]);

  // Avisa o profissional que pediu a troca (pelo ID gravado no pedido ou pelo nome).
  const notifyRequester = async (shift, audit, title, message, type) => {
    const requester = (professionals || []).find(p =>
      (audit.offeredById && String(p.id) === String(audit.offeredById)) ||
      (!audit.offeredById && audit.offeredByName && String(p.name || '').toLowerCase().trim() === audit.offeredByName.toLowerCase().trim())
    ) || (audit.offeredById ? { id: audit.offeredById } : null);
    if (!requester) return;
    await sendNotifications([{
      ...recipientFor(requester),
      company_id: shift.company_id || company?.id,
      unit_id: shift.unit_id || selectedUnitId,
      type,
      category: 'troca',
      title,
      message,
      data: { shift_id: shift.id, date: shift.date }
    }]);
  };

  // Setores de todas as unidades (o plantonista vê vagas de vários hospitais).
  const sectorMap = useMemo(() => {
    const m = {};
    [...(allCompanySectors || []), ...(sectors || [])].forEach(s => { if (s?.id) m[String(s.id)] = s; });
    return m;
  }, [allCompanySectors, sectors]);

  const unitNameById = useMemo(() => {
    const m = {};
    (units || []).forEach(u => { if (u?.id) m[String(u.id)] = u.name; });
    return m;
  }, [units]);

  // Gestor: unidade selecionada. Plantonista: todas as unidades em que atua,
  // num único login, sem precisar trocar de unidade.
  const myUnitIds = useMemo(() => getProfessionalUnitIds(myProf), [myProf]);
  const managerUnitIds = useMemo(() => {
    if (!isManager) return [];
    const allowed = Array.isArray(user?.data?.allowed_unit_ids) ? user.data.allowed_unit_ids.map(String) : [];
    return (units || [])
      .filter(u => user?.role === 'admin' || allowed.length === 0 || allowed.includes(String(u.id)))
      .map(u => String(u.id));
  }, [isManager, units, user]);
  const showUnitName = isManager ? managerAllUnits : myUnitIds.length > 1;
  const unitShifts = useMemo(() => {
    if (isManager && managerAllUnits) {
      const source = allCompanyShifts.length ? allCompanyShifts : shifts || [];
      return source.filter(s => managerUnitIds.includes(String(s.unit_id)));
    }
    if (isManager) return (shifts || []).filter(s => !selectedUnitId || String(s.unit_id) === String(selectedUnitId));
    const source = allCompanyShifts.length ? allCompanyShifts : shifts || [];
    if (myUnitIds.length === 0) return source;
    return source.filter(s => myUnitIds.includes(String(s.unit_id)));
  }, [isManager, managerAllUnits, managerUnitIds, shifts, allCompanyShifts, selectedUnitId, myUnitIds]);

  const myAllocatedShifts = useMemo(() => {
    if (!myProf?.id && !user?.full_name) return [];
    return unitShifts.filter(s => {
      if (!s || s.status === 'cancelado' || s.status === 'vago' || !s.professional_id) return false;
      const matchId = myProf?.id && String(s.professional_id) === String(myProf.id);
      const matchUserId = user?.data?.professional_id && String(s.professional_id) === String(user.data.professional_id);
      const matchName = user?.full_name && s.professional_name && s.professional_name.toLowerCase().trim() === user.full_name.toLowerCase().trim();
      return matchId || matchUserId || matchName;
    });
  }, [unitShifts, myProf, user]);

  const myCompanyShifts = useMemo(() => {
    const myIds = new Set([myProf?.id, user?.data?.professional_id].filter(Boolean).map(String));
    const myName = String(user?.full_name || '').toLowerCase().trim();
    const source = allCompanyShifts.length ? allCompanyShifts : unitShifts;
    return source.filter(s => {
      if (!s || s.status === 'cancelado' || s.status === 'vago' || !s.professional_id) return false;
      return myIds.has(String(s.professional_id)) ||
        (myName && String(s.professional_name || '').toLowerCase().trim() === myName);
    });
  }, [allCompanyShifts, unitShifts, myProf, user]);

  const companySectorMap = useMemo(() => {
    const m = {};
    [...(allCompanySectors || []), ...(sectors || [])].forEach(s => { if (s?.id) m[String(s.id)] = s; });
    return m;
  }, [allCompanySectors, sectors]);

  const checkTimeConflict = (shiftCandidate) => {
    if (!shiftCandidate || !shiftCandidate.date) return { hasConflict: false };

    const candidateRange = getShiftDateTimeRange(shiftCandidate);
    if (!candidateRange) return { hasConflict: false };

    for (const myShift of myCompanyShifts) {
      if (String(myShift.id) === String(shiftCandidate.id)) continue;

      // Data + hora reais: um plantão noturno de ontem pode avançar sobre hoje.
      const myRange = getShiftDateTimeRange(myShift);
      const overlaps = myRange && myRange.start < candidateRange.end && candidateRange.start < myRange.end;

      if (overlaps) {
        const sectorConflict = companySectorMap[String(myShift.sector_id)]?.name || 'outro setor';
        return {
          hasConflict: true,
          conflictShift: myShift,
          message: `Você já está em ${sectorConflict} das ${myShift.start_time} às ${myShift.end_time} (${formatDateBR(myShift.date)}).`
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
    unitShifts.forEach(s => {
      const spec = extractSpecialty(s, null);
      if (spec && spec.toLowerCase() !== 'geral') set.add(spec);
    });
    return Array.from(set).sort();
  }, [professionals, unitShifts]);

  // Data local (toISOString usa UTC e, após as 21h no Brasil, já "vira" o dia).
  const todayStr = useMemo(() => getLocalDateString(), []);

  const muralShifts = useMemo(() => {
    return unitShifts.filter(s => {
      if (!s) return false;
      const st = String(s.status || '').toLowerCase();
      const audit = parseShiftAudit(s);

      if (st.includes('cancel') || st.includes('inativ')) return false;
      if (audit.isAguardandoGestor) return false;

      const isMuralApproved = st === 'vago' || st === 'disponivel_mural' || audit.transferFrom !== '';
      if (!isMuralApproved) return false;
      if (s.professional_id) return false;
      if (s.date && s.date < todayStr) return false;

      if (isManager && selectedSpecialtyFilter !== 'todas') {
        const spec = extractSpecialty(s, null);
        if (spec.toLowerCase() !== selectedSpecialtyFilter.toLowerCase()) return false;
      }

      return true;
    }).sort((a, b) => (a?.date || '').localeCompare(b?.date || '') || String(a?.start_time || '').localeCompare(String(b?.start_time || '')));
  }, [unitShifts, selectedSpecialtyFilter, todayStr, isManager]);

  // Pode assumir: setor autorizado, especialidade compatível e sem choque com a própria escala.
  const canClaim = (shift) => Boolean(myProf?.id) && isVacancyRelevantFor(shift, myProf) &&
    !findUnavailability(myProf, shift.date) && !checkTimeConflict(shift).hasConflict;

  const claimableShifts = useMemo(
    () => muralShifts.filter(canClaim),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [muralShifts, myProf, myCompanyShifts]
  );

  const openShifts = isManager && managerView === 'todas' ? muralShifts : claimableShifts;
  const hiddenForMeCount = muralShifts.length - claimableShifts.length;

  const hiddenReasons = useMemo(() => {
    const reasons = { sector: 0, conflict: 0, away: 0, specialties: new Map() };
    if (!myProf?.id) return reasons;
    muralShifts.forEach(shift => {
      if (!isProfessionalAuthorizedForSector(myProf, shift.sector_id)) { reasons.sector += 1; return; }
      if (!isVacancyRelevantFor(shift, myProf)) {
        const spec = extractSpecialty(shift, null);
        reasons.specialties.set(spec, (reasons.specialties.get(spec) || 0) + 1);
        return;
      }
      if (findUnavailability(myProf, shift.date)) { reasons.away += 1; return; }
      if (checkTimeConflict(shift).hasConflict) reasons.conflict += 1;
    });
    return reasons;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muralShifts, myProf, myCompanyShifts]);

  const openShiftsByDate = useMemo(() => {
    const groups = [];
    openShifts.forEach(shift => {
      const last = groups[groups.length - 1];
      if (last && last.date === shift.date) last.items.push(shift);
      else groups.push({ date: shift.date, items: [shift] });
    });
    return groups;
  }, [openShifts]);

  const pendingApprovalShifts = useMemo(() => {
    return unitShifts.filter(s => {
      if (!s) return false;
      const audit = parseShiftAudit(s);
      return audit.isAguardandoGestor;
    }).sort((a, b) => (a?.date || '').localeCompare(b?.date || ''));
  }, [unitShifts]);

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
    return unitShifts.filter(s => {
      if (!s || s.status === 'vago' || !s.professional_id) return false;
      const isMine = (myProf?.id && String(s.professional_id) === String(myProf.id)) || 
                     (s.professional_name && myProf?.name && s.professional_name.toLowerCase().trim() === myProf.name.toLowerCase().trim()) ||
                     (s.professional_name && user?.full_name && s.professional_name.toLowerCase().trim() === user.full_name.toLowerCase().trim());
      return isMine && s.date >= todayStr && s.status !== 'cancelado';
    }).sort((a, b) => (a?.date || '').localeCompare(b?.date || ''));
  }, [unitShifts, myProf, user, todayStr]);

  const transferHistory = useMemo(() => {
    return unitShifts.filter(s => {
      if (!s) return false;
      const notes = String(s.notes || '');
      return notes.includes('[TRANSFERENCIA:') || notes.includes('[ORIGEM_MURAL:');
    }).sort((a, b) => (b?.date || '').localeCompare(a?.date || ''));
  }, [unitShifts]);

  const handleRequestSendToMural = async (shift) => {
    const requesterName = currentProfessional?.name || user?.full_name || 'Profissional';
    const requesterId = currentProfessional?.id || user?.id || '';

    if (!confirm(`Deseja solicitar a liberação do seu plantão de ${formatDateBR(shift.date)} (${shift.start_time} às ${shift.end_time}) no Mural de Oportunidades?\n\nO pedido será enviado para aprovação da coordenação antes de ser liberado.`)) {
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

      if (typeof syncGlobalData === 'function') await syncGlobalData();
      alert('Solicitação enviada! Aguarde a aprovação da coordenação para liberação no Mural.');
    } catch (e) {
      alert('Erro ao solicitar envio ao mural: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveMuralPost = async (shift) => {
    const audit = parseShiftAudit(shift);
    const originName = audit.offeredByName || formatFullName(shift.professional_name) || 'Colega';

    if (!confirm(`Autorizar a abertura do plantão de ${formatDateBR(shift.date)} no Mural?\nOrigem: ${originName}`)) return;

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

      await notifyRequester(shift, audit, 'Troca aprovada', `Seu plantão de ${formatDateBR(shift.date)} (${shift.start_time} às ${shift.end_time}) foi liberado no Mural pela coordenação.`, 'troca_aprovada');
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
      // Remove também os marcadores do pedido: um pedido recusado não pode aparecer
      // como "Repasse Concluído" no relatório de trocas.
      const cleanNotes = currentNotes
        .replace(/\[AGUARDANDO_GESTOR\]/gi, '')
        .replace(/\[(SOLICITADO_POR|SOLICITADO_ID):[^\]]*\]/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      const updatedNotes = `${cleanNotes} [RECUSADO_EM: ${new Date().toLocaleDateString('pt-BR')}]`.trim();

      await safeUpdateShift(shift.id, {
        status: 'confirmado',
        notes: updatedNotes
      });

      await notifyRequester(shift, audit, 'Troca recusada', `O pedido para liberar seu plantão de ${formatDateBR(shift.date)} (${shift.start_time} às ${shift.end_time}) foi recusado. O plantão continua com você.`, 'troca_recusada');
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
    if (!isVacancyRelevantFor(shift, myProf) && isProfessionalAuthorizedForSector(myProf, shift.sector_id)) {
      alert(`⛔ Esta vaga é para ${extractSpecialty(shift, null)}. Sua especialidade cadastrada é ${myProf.specialty || 'não informada'}.`);
      return;
    }
    // Mesma regra da tela de Escalas: só assume quem está autorizado no setor.
    if (!isProfessionalAuthorizedForSector(myProf, shift.sector_id)) {
      alert(`⛔ Você não está autorizado(a) a atuar no setor ${sectorName}. Fale com a coordenação.`);
      return;
    }

    const audit = parseShiftAudit(shift);
    const originName = audit.transferFrom || audit.offeredByName || null;
    const originMsg = originName ? `\n(Cedido por: ${originName})` : '';

    if (!confirm(`Confirmar assunção do plantão?${originMsg}\n\nSetor: ${sectorName}\nData: ${formatDateBR(shift.date)} (${shift.start_time || '07:00'} às ${shift.end_time || '19:00'})`)) {
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

      if (audit.offeredById || audit.offeredByName) {
        await notifyRequester(shift, audit, 'Seu plantão foi assumido', `${myProf.name} assumiu o plantão de ${formatDateBR(shift.date)} (${shift.start_time} às ${shift.end_time}) que você liberou no Mural.`, 'troca_assumida');
      }
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
      const { error } = await supabase.from('shifts').delete().eq('id', shiftId);
      if (error) throw error;
      await syncGlobalData();
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans bg-slate-100 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      
      {/* 1. CABEÇALHO */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Mural de vagas</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isManager ? 'Vagas abertas, pedidos de troca e histórico de repasses.' : `Vagas que você pode assumir, sem choque com a sua escala${myUnitIds.length > 1 ? `, em todas as suas unidades (${myUnitIds.length})` : ''}.`}
        </p>
      </div>

      {myPendingShifts.length > 0 && !isManager && (
        <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <Clock3 className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm">
            <b>{myPendingShifts.length} pedido(s) de troca em análise.</b>{' '}
            <span className="text-amber-800/90 dark:text-amber-200/80">O plantão só vai para o mural depois da autorização da coordenação.</span>
          </p>
        </div>
      )}

      {/* 2. ABAS */}
      <div className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex min-w-max items-center gap-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1" role="tablist">
          {[
            { id: 'vagas', label: 'Vagas', count: openShifts.length, icon: Flame },
            ...(isManager ? [{ id: 'pendentes', label: 'Aprovações', count: pendingApprovalShifts.length, icon: ShieldCheck }] : []),
            { id: 'trocas', label: 'Meus plantões', count: myUpcomingShifts.length, icon: ArrowRightLeft },
            { id: 'historico', label: 'Histórico', count: transferHistory.length, icon: History },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`h-9 px-3 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer ${active ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                <span className={`rounded-full px-1.5 text-xs ${active ? 'bg-white/20 dark:bg-slate-900/10' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{tab.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. VAGAS NO MURAL */}
      {activeTab === 'vagas' && (
        <div className="space-y-4">
          {isManager && (
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
              {managerUnitIds.length > 1 && (
                <div className="inline-flex rounded-xl bg-slate-200/70 dark:bg-slate-800 p-1" role="tablist" aria-label="Unidades">
                  {[{ id: false, label: 'Esta unidade' }, { id: true, label: `Todas as unidades (${managerUnitIds.length})` }].map(opt => (
                    <button key={String(opt.id)} type="button" role="tab" aria-selected={managerAllUnits === opt.id} onClick={() => setManagerAllUnits(opt.id)}
                      className={`h-8 px-3 rounded-lg text-xs font-medium cursor-pointer ${managerAllUnits === opt.id ? 'bg-white dark:bg-slate-950 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="inline-flex rounded-xl bg-slate-200/70 dark:bg-slate-800 p-1" role="tablist" aria-label="Quais vagas mostrar">
                {[{ id: 'todas', label: `Todas (${muralShifts.length})` }, { id: 'minhas', label: `Que eu posso assumir (${claimableShifts.length})` }].map(opt => (
                  <button key={opt.id} type="button" role="tab" aria-selected={managerView === opt.id} onClick={() => setManagerView(opt.id)}
                    className={`h-8 px-3 rounded-lg text-xs font-medium cursor-pointer ${managerView === opt.id ? 'bg-white dark:bg-slate-950 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {allHospitalSpecialties.length > 0 && (
                <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 sm:ml-auto">
                  <Filter className="w-3.5 h-3.5" /> Especialidade
                  <select
                    value={selectedSpecialtyFilter}
                    onChange={e => setSelectedSpecialtyFilter(e.target.value)}
                    className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-sm text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="todas">Todas</option>
                    {allHospitalSpecialties.map(spec => <option key={spec} value={spec}>{spec}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}

          {openShifts.length === 0 ? (
            <Card className="p-12 text-center border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2 rounded-2xl">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {!myProf?.id && (!isManager || managerView === 'minhas') ? 'Seu perfil profissional não foi encontrado' : 'Nenhuma vaga para você agora'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {!myProf?.id && (!isManager || managerView === 'minhas')
                  ? 'Peça à coordenação para vincular seu usuário ao cadastro no Corpo Clínico.'
                  : isManager && managerView === 'todas'
                    ? 'Todas as escalas estão preenchidas e não há repasses pendentes.'
                    : 'Quando abrir uma vaga no seu setor e especialidade, sem choque com a sua escala, ela aparece aqui.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-5">
              {openShiftsByDate.map(group => (
                <section key={group.date} aria-label={formatDateBR(group.date)}>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>{formatLongDate(group.date)}</span>
                    <span className="rounded-full bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">{group.items.length}</span>
                  </h2>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                    {group.items.map(shift => {
                      const sector = sectorMap[String(shift.sector_id)];
                      const realSpecialty = extractSpecialty(shift, null);
                      const conflictInfo = checkTimeConflict(shift);
                      const claimable = canClaim(shift);
                      const audit = parseShiftAudit(shift);
                      const originName = audit.transferFrom || audit.offeredByName || null;

                      return (
                        <div key={shift.id} title={isManager && conflictInfo.hasConflict ? conflictInfo.message : undefined} className="flex items-center gap-3 sm:gap-4 px-4 py-3">
                          <div className="hidden sm:block w-28 shrink-0 font-mono text-sm font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                            {shift.start_time || '07:00'}–{shift.end_time || '19:00'}
                          </div>

                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="sm:hidden font-mono text-sm font-semibold text-slate-900 dark:text-white">{shift.start_time || '07:00'}–{shift.end_time || '19:00'}</div>
                            <div className="font-semibold text-slate-900 dark:text-white truncate">{sector?.name || 'Setor'}</div>
                            {showUnitName && unitNameById[String(shift.unit_id)] && (
                              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                                <Building2 className="w-3.5 h-3.5 shrink-0" /> {unitNameById[String(shift.unit_id)]}
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {getShiftUrgency(shift) && (
                                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-500/10 px-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
                                  <Clock3 className="w-3.5 h-3.5" /> Urgente · {getShiftUrgency(shift).label}
                                </span>
                              )}
                              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                                <Stethoscope className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> {realSpecialty}
                              </span>
                              {originName && (
                                <span className="inline-flex h-6 max-w-full items-center gap-1 rounded-full bg-sky-50 dark:bg-sky-500/10 px-2.5 text-xs font-medium text-sky-800 dark:text-sky-200">
                                  <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Repasse de {formatFullName(originName)}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            {claimable && (
                              <Button
                                onClick={() => handleClaimShift(shift)}
                                disabled={submitting}
                                className="h-9 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold gap-1.5 cursor-pointer"
                              >
                                <Check className="w-4 h-4" /> Assumir
                              </Button>
                            )}
                            {isManager && (
                              <Button
                                variant="ghost"
                                onClick={() => handleDeleteVaga(shift.id)}
                                className="h-9 w-9 p-0 text-slate-400 hover:text-rose-500 rounded-xl cursor-pointer"
                                title="Excluir vaga"
                                aria-label="Excluir vaga"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          {!isManager && hiddenForMeCount > 0 && myProf?.id && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-sm text-slate-600 dark:text-slate-300">
              <p className="font-medium text-slate-800 dark:text-slate-100">{hiddenForMeCount} vaga(s) do hospital não estão disponíveis para você:</p>
              <ul className="mt-1.5 space-y-0.5 text-xs">
                {[...hiddenReasons.specialties.entries()].map(([spec, count]) => (
                  <li key={spec}>· {count} de outra especialidade (<b>{spec}</b>) — a sua é {myProf.specialty || 'não informada'}</li>
                ))}
                {hiddenReasons.sector > 0 && <li>· {hiddenReasons.sector} de setor em que você não está autorizado(a)</li>}
                {hiddenReasons.conflict > 0 && <li>· {hiddenReasons.conflict} em horário em que você já está escalado(a)</li>}
                {hiddenReasons.away > 0 && <li>· {hiddenReasons.away} em dias que você marcou como indisponível</li>}
              </ul>
            </div>
          )}
        </div>
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
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Solicitante da liberação</span>
                            <strong className="text-sm font-black text-slate-900 dark:text-white block truncate mt-0.5">
                              {requesterName}
                            </strong>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                            <Stethoscope className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span className="truncate">{realSpecialty}</span>
                          </div>
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
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{sector?.name || 'Setor'}</span>
                          <h4 className="font-black text-sm text-slate-900 dark:text-white mt-1">
                            {new Date(shift.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long' })}
                          </h4>
                        </div>
                        <span className="shrink-0 font-mono text-xs font-black text-sky-700 dark:text-sky-300 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950">
                          {shift.start_time}–{shift.end_time}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        <Stethoscope className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                        <span>{extractSpecialty(shift, myProf)}</span>
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

      {/* 6. HISTÓRICO DE REPASSES */}
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
                            <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                              <Stethoscope className="w-3 h-3 shrink-0" /> {extractSpecialty(shift, null)}
                            </span>
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