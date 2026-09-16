import React, { useState, useMemo } from 'react';
import { useAppData } from '@/lib/useAppData';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Flame, Calendar, Clock, Building2, User, 
  CheckCircle2, Check, AlertCircle, ShieldAlert, Trash2, 
  Repeat, ArrowRightLeft, Stethoscope, Filter
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

export default function Trocas() {
  const { 
    shifts = [], 
    sectors = [], 
    professionals = [], 
    currentProfessional, 
    isManager, 
    syncGlobalData 
  } = useAppData();

  const [activeTab, setActiveTab] = useState('vagas'); // 'vagas' | 'trocas'
  const [selectedSpecialtyFilter, setSelectedSpecialtyFilter] = useState('todas');
  const [submitting, setSubmitting] = useState(false);

  const sectorMap = useMemo(() => {
    const m = {};
    (sectors || []).forEach(s => { if (s?.id) m[String(s.id)] = s; });
    return m;
  }, [sectors]);

  // Plantões confirmados do usuário para detecção de choque de horário
  const myConfirmedShifts = useMemo(() => {
    if (!currentProfessional?.id) return [];
    return (shifts || []).filter(s => {
      return String(s.professional_id) === String(currentProfessional.id) && s.status === 'confirmado';
    });
  }, [shifts, currentProfessional]);

  const hasTimeConflict = (shiftCandidate) => {
    if (!currentProfessional?.id || isManager) return false;

    return myConfirmedShifts.some(myShift => {
      if (myShift.date !== shiftCandidate.date) return false;

      const myStart = myShift.start_time || '07:00';
      const myEnd = myShift.end_time || '19:00';
      const candStart = shiftCandidate.start_time || '07:00';
      const candEnd = shiftCandidate.end_time || '19:00';

      if (myShift.shift_type && shiftCandidate.shift_type && myShift.shift_type === shiftCandidate.shift_type) return true;
      if (myStart === candStart && myEnd === candEnd) return true;
      return false;
    });
  };

  // Todas as especialidades do hospital puxadas do Corpo Clínico
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

  // Vagas Abertas no Mural (sem conflito de horário)
  const openShifts = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    return (shifts || []).filter(s => {
      if (!s) return false;
      const st = String(s.status || '').toLowerCase();
      const notes = String(s.notes || '').toLowerCase();
      if (st.includes('cancel') || st.includes('inativ') || notes.includes('cancelad') || notes.includes('exclusão')) {
        return false;
      }

      const isMuralVaga = s.status === 'vago' || s.is_open === true;
      if (!isMuralVaga || s.professional_id) return false;
      if (s.date && s.date < todayStr) return false;

      // Oculta plantões em dias que o usuário já tem plantão
      if (hasTimeConflict(s)) return false;

      if (selectedSpecialtyFilter !== 'todas') {
        const spec = extractSpecialty(s, null);
        if (spec.toLowerCase() !== selectedSpecialtyFilter.toLowerCase()) return false;
      }

      return true;
    }).sort((a, b) => (a?.date || '').localeCompare(b?.date || ''));
  }, [shifts, selectedSpecialtyFilter, myConfirmedShifts, isManager, currentProfessional]);

  const myUpcomingShifts = useMemo(() => {
    if (!currentProfessional?.id) return [];
    const todayStr = new Date().toISOString().split('T')[0];
    return (shifts || []).filter(s => {
      return String(s.professional_id) === String(currentProfessional.id) && s.date >= todayStr && s.status === 'confirmado';
    }).sort((a, b) => (a?.date || '').localeCompare(b?.date || ''));
  }, [shifts, currentProfessional]);

  const handleClaimShift = async (shift) => {
    const targetProf = currentProfessional || (professionals || []).find(p => p.status === 'ativo');

    if (!targetProf?.id) {
      alert('Usuário profissional não identificado.');
      return;
    }

    if (hasTimeConflict(shift)) {
      alert(`⚠️ Bloqueio: Você já possui um plantão confirmado para o dia ${shift.date} neste mesmo horário.`);
      return;
    }

    const sectorName = sectorMap[String(shift.sector_id)]?.name || 'Setor Hospitalar';
    if (!confirm(`Deseja assumir o plantão em "${sectorName}" no dia ${shift.date} (${shift.start_time || '07:00'} às {shift.end_time || '19:00'})?`)) {
      return;
    }

    setSubmitting(true);
    try {
      await base44.entities.Shift.update(shift.id, {
        professional_id: targetProf.id,
        status: 'confirmado'
      });
      await syncGlobalData();
      alert(`Plantão confirmado com sucesso para ${targetProf.name}!`);
    } catch (err) {
      alert('Erro ao assumir vaga: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOfferMyShiftForSwap = async (shift) => {
    if (!confirm('Disponibilizar este plantão no Mural de Oportunidades para troca?')) return;
    setSubmitting(true);
    try {
      await base44.entities.Shift.update(shift.id, {
        professional_id: null,
        status: 'vago',
        notes: `Troca solicitada por ${currentProfessional?.name || 'colega'}`
      });
      await syncGlobalData();
      alert('Plantão enviado para o Mural!');
    } catch (err) {
      alert('Erro ao disponibilizar: ' + err.message);
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
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400">
            <Flame className="w-4 h-4" /> Mural de Oportunidades & Trocas
          </div>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black">Mural de Oportunidades</h2>
          <p className="text-xs text-slate-400">Vagas abertas sem conflito de horário com sua escala.</p>
        </div>
        <div className="px-5 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-center shadow-lg">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Disponíveis p/ Você</span>
          <span className="text-2xl font-black text-amber-400">{openShifts.length}</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button onClick={() => setActiveTab('vagas')} className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${activeTab === 'vagas' ? 'bg-amber-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'}`}><Flame className="w-4 h-4" /><span>Vagas em Aberto ({openShifts.length})</span></button>
          <button onClick={() => setActiveTab('trocas')} className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${activeTab === 'trocas' ? 'bg-sky-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'}`}><ArrowRightLeft className="w-4 h-4" /><span>Disponibilizar p/ Troca ({myUpcomingShifts.length})</span></button>
        </div>

        {activeTab === 'vagas' && (
          <div className="flex items-center gap-1.5 overflow-x-auto shrink-0 pb-1">
            <span className="text-[10px] font-black uppercase text-slate-400 mr-1 flex items-center gap-1"><Filter className="w-3 h-3" /> Especialidade:</span>
            <button onClick={() => setSelectedSpecialtyFilter('todas')} className={`px-2.5 py-1 rounded-xl text-xs font-bold ${selectedSpecialtyFilter === 'todas' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-200 dark:bg-slate-800'}`}>Todas</button>
            {allHospitalSpecialties.map(spec => (
              <button key={spec} onClick={() => setSelectedSpecialtyFilter(spec)} className={`px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 ${selectedSpecialtyFilter === spec ? 'bg-amber-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>{spec}</button>
            ))}
          </div>
        )}
      </div>

      {activeTab === 'vagas' && (
        <>
          {openShifts.length === 0 ? (
            <Card className="p-16 text-center border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="font-black text-slate-900 dark:text-white text-base">Nenhuma vaga aberta sem conflito</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">Você não tem choques de horário e não há vagas pendentes nesta categoria.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {openShifts.map(shift => {
                const sector = sectorMap[String(shift.sector_id)];
                const realSpecialty = extractSpecialty(shift, null);

                return (
                  <Card key={shift.id} className="p-5 rounded-3xl border-2 border-amber-300 dark:border-amber-500/40 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-4 shadow-sm">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div>
                          <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-500/30">Vaga: {realSpecialty}</span>
                          <h3 className="font-black text-base text-slate-900 dark:text-white mt-2">{sector?.name || 'Setor'}</h3>
                        </div>
                        <span className="text-xs font-mono font-black px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-950 text-sky-600 dark:text-sky-400 border border-slate-200 dark:border-slate-800">{shift.start_time || '07:00'} às {shift.end_time || '19:00'}</span>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><Calendar className="w-4 h-4 text-sky-600 dark:text-sky-400" /><span>{new Date(shift.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span></div>
                        <div className="flex items-center gap-2 text-slate-500"><Stethoscope className="w-4 h-4" /><span>Exigência: <b>{realSpecialty}</b></span></div>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <Button onClick={() => handleClaimShift(shift)} disabled={submitting} className="flex-1 h-10 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl shadow-md gap-2"><Check className="w-4 h-4" /> Assumir Plantão</Button>
                      {isManager && <Button variant="ghost" onClick={() => handleDeleteVaga(shift.id)} className="h-10 w-10 p-0 text-slate-400 hover:text-rose-500 rounded-xl"><Trash2 className="w-4 h-4" /></Button>}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'trocas' && (
        <div className="space-y-4">
          {myUpcomingShifts.length === 0 ? (
            <Card className="p-12 text-center border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"><p className="text-xs font-bold text-slate-600 dark:text-slate-300">Você não possui plantões futuros confirmados.</p></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myUpcomingShifts.map(shift => {
                const sector = sectorMap[String(shift.sector_id)];
                return (
                  <Card key={shift.id} className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex justify-between items-start">
                      <div><span className="text-[10px] font-bold uppercase text-slate-400">{sector?.name}</span><h4 className="font-black text-sm text-slate-900 dark:text-white mt-0.5">{new Date(shift.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long' })}</h4></div>
                      <span className="font-mono text-xs font-bold text-sky-600">{shift.start_time} - {shift.end_time}</span>
                    </div>
                    <Button onClick={() => handleOfferMyShiftForSwap(shift)} disabled={submitting} className="w-full h-9 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl gap-2"><ArrowRightLeft className="w-3.5 h-3.5" /> Disponibilizar para Troca</Button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}