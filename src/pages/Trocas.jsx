import React, { useState, useMemo } from 'react';
import { useAppData } from '@/lib/useAppData';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Flame, Calendar, Clock, Building2, User, 
  CheckCircle2, Check, AlertCircle, ShieldAlert, Trash2, Lock
} from 'lucide-react';

function formatFullName(name) {
  if (!name) return 'Profissional';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export default function Trocas() {
  const { 
    shifts, 
    sectors, 
    professionals, 
    currentProfessional, 
    isManager, 
    syncGlobalData 
  } = useAppData();

  const [submitting, setSubmitting] = useState(false);

  const sectorMap = useMemo(() => {
    const m = {};
    sectors.forEach(s => { m[String(s.id)] = s; });
    return m;
  }, [sectors]);

  const userCategory = currentProfessional?.category || (currentProfessional?.specialty?.toLowerCase().includes('enferm') ? 'enfermeiro' : 'medico');

  const openShifts = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    return shifts.filter(s => {
      const st = String(s.status || '').toLowerCase();
      const notes = String(s.notes || '').toLowerCase();
      if (st.includes('cancel') || st.includes('inativ') || notes.includes('cancelad') || notes.includes('exclusão')) {
        return false;
      }

      const isMuralVaga = s.status === 'vago' || s.is_open === true;
      if (!isMuralVaga || s.professional_id) return false;
      if (s.date && s.date < todayStr) return false;

      if (!isManager) {
        const requiredCat = s.target_category || 'medico';
        if (requiredCat !== userCategory) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [shifts, isManager, userCategory]);

  const handleClaimShift = async (shift) => {
    const targetProf = currentProfessional || professionals.find(p => p.status === 'ativo');

    if (!targetProf?.id) {
      alert('Usuário profissional não identificado.');
      return;
    }

    const requiredCategory = shift.target_category || 'medico';
    const profCategory = targetProf.category || 'medico';

    if (!isManager && requiredCategory !== profCategory) {
      alert(`⚠️ Acesso Negado: Esta vaga é exclusiva para ${requiredCategory.toUpperCase()}.`);
      return;
    }

    const sectorName = sectorMap[String(shift.sector_id)]?.name || 'Setor Hospitalar';
    if (!confirm(`Deseja assumir o plantão em "${sectorName}" no dia ${shift.date} (${shift.start_time || '07:00'} às ${shift.end_time || '19:00'})?`)) {
      return;
    }

    setSubmitting(true);
    try {
      await base44.entities.Shift.update(shift.id, {
        professional_id: targetProf.id,
        status: 'confirmado'
      });
      await syncGlobalData();
      alert(`Plantão confirmado com sucesso para ${targetProf.name}! Ele já consta na sua escala.`);
    } catch (err) {
      alert('Erro ao assumir vaga: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteVaga = async (shiftId) => {
    if (!confirm('Deseja excluir esta vaga definitivamente do sistema?')) return;
    try {
      await base44.entities.Shift.delete(shiftId);
      await syncGlobalData();
    } catch (err) {
      alert('Erro ao excluir vaga: ' + err.message);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans bg-slate-100 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      
      {/* BANNER PRINCIPAL */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400">
            <Flame className="w-4 h-4" /> Mural de Oportunidades
          </div>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black">
            Vagas Abertas {!isManager && `(${userCategory.toUpperCase()})`}
          </h2>
          <p className="text-xs text-slate-400">
            {!isManager 
              ? `Exibindo apenas plantões disponíveis específicos para sua área (${userCategory.toUpperCase()}).`
              : 'Painel Geral: Visualização de todas as vagas publicadas para a equipe.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-5 py-2.5 rounded-2xl bg-white/10 dark:bg-slate-900/80 border border-white/20 dark:border-slate-800 text-center shadow-lg">
            <span className="text-[10px] font-bold uppercase text-slate-300 dark:text-slate-400 block">Vagas Disponíveis</span>
            <span className="text-2xl font-black text-amber-400">{openShifts.length}</span>
          </div>
        </div>
      </div>

      {/* CARDS DAS VAGAS */}
      {openShifts.length === 0 ? (
        <Card className="p-16 text-center border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="font-black text-slate-900 dark:text-white text-base">Nenhuma vaga aberta no momento</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Todos os plantões da sua categoria estão preenchidos. Quando o coordenador disponibilizar uma vaga no mural, você será notificado no sininho.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {openShifts.map(shift => {
            const sector = sectorMap[String(shift.sector_id)];
            const targetCat = shift.target_category || 'medico';

            return (
              <Card 
                key={shift.id} 
                className="p-5 rounded-3xl border-2 border-amber-300 dark:border-amber-500/40 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-4 shadow-sm hover:border-amber-400 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-500/30">
                        Vaga Exclusiva: {targetCat.toUpperCase()}
                      </span>
                      <h3 className="font-black text-base text-slate-900 dark:text-white mt-2">
                        {sector?.name || 'Setor Hospitalar'}
                      </h3>
                    </div>

                    <span className="text-xs font-mono font-black px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-950 text-sky-600 dark:text-sky-400 border border-slate-200 dark:border-slate-800">
                      {shift.start_time || '07:00'} às {shift.end_time || '19:00'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                      <Calendar className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      <span>Data: {new Date(shift.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
                    </div>

                    {shift.notes && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-2 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                        "{shift.notes}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <Button
                    onClick={() => handleClaimShift(shift)}
                    disabled={submitting}
                    className="flex-1 h-10 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl shadow-md gap-2"
                  >
                    <Check className="w-4 h-4" /> Assumir Plantão
                  </Button>

                  {isManager && (
                    <Button
                      variant="ghost"
                      onClick={() => handleDeleteVaga(shift.id)}
                      title="Excluir vaga"
                      className="h-10 w-10 p-0 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl"
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
    </div>
  );
}