import React, { useState, useMemo } from 'react';
import { useAppData } from '@/lib/useAppData';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Flame, Calendar, Clock, Building2, User, 
  CheckCircle2, Check, AlertCircle, ShieldAlert, Filter
} from 'lucide-react';

const CATEGORIES = [
  { id: 'todas', label: 'Todas as Vagas' },
  { id: 'medico', label: 'Médicos' },
  { id: 'enfermeiro', label: 'Enfermagem' },
  { id: 'tecnico_enfermagem', label: 'Téc. Enfermagem' },
  { id: 'fisioterapeuta', label: 'Fisioterapia' },
  { id: 'farmaceutico', label: 'Farmácia' }
];

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

  const [selectedCategoryTab, setSelectedCategoryTab] = useState('todas');
  const [submitting, setSubmitting] = useState(false);

  const sectorMap = useMemo(() => {
    const m = {};
    sectors.forEach(s => { m[String(s.id)] = s; });
    return m;
  }, [sectors]);

  // Vagas do Mural (apenas de hoje em diante)
  const openShifts = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    let localMuralIds = [];
    try {
      localMuralIds = JSON.parse(window.localStorage.getItem('scale_mural_ids') || '[]');
    } catch {}

    return shifts.filter(s => {
      const isVago = s.status === 'vago' || !s.professional_id || s.is_open === true || localMuralIds.includes(s.id);
      if (!isVago) return false;
      if (s.date && s.date < todayStr) return false; // descarta passados

      if (selectedCategoryTab !== 'todas') {
        const requiredCat = s.target_category || 'medico';
        if (requiredCat !== selectedCategoryTab) return false;
      }

      return true;
    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [shifts, selectedCategoryTab]);

  // Candidatar-se com validação estrita de categoria
  const handleClaimShift = async (shift) => {
    const targetProf = currentProfessional || professionals.find(p => p.status === 'ativo');

    if (!targetProf?.id) {
      alert('Identifique seu usuário profissional para assumir vagas.');
      return;
    }

    const requiredCategory = shift.target_category || 'medico';
    const profCategory = targetProf.category || 'medico';

    // VALIDAÇÃO: Impede que enfermeiro assuma vaga de médico ou vice-versa
    if (!isManager && requiredCategory !== profCategory) {
      alert(`⚠️ Bloqueio de Segurança: Esta vaga é exclusiva para a categoria "${requiredCategory.toUpperCase()}". Seu perfil está cadastrado como "${profCategory.toUpperCase()}".`);
      return;
    }

    const sectorName = sectorMap[String(shift.sector_id)]?.name || 'Setor Hospitalar';
    if (!confirm(`Confirmar assunção do plantão em "${sectorName}" no dia ${shift.date} (${shift.start_time} às ${shift.end_time})?`)) {
      return;
    }

    setSubmitting(true);
    try {
      await base44.entities.Shift.update(shift.id, {
        professional_id: targetProf.id,
        status: 'confirmado'
      });

      // Limpa do cache local
      try {
        const muralArr = JSON.parse(window.localStorage.getItem('scale_mural_ids') || '[]');
        window.localStorage.setItem('scale_mural_ids', JSON.stringify(muralArr.filter(id => id !== shift.id)));
      } catch {}

      await syncGlobalData();
      alert(`Plantão confirmado com sucesso para ${targetProf.name}! Ele já consta na sua escala.`);
    } catch (err) {
      alert('Erro ao assumir vaga: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans">
      
      {/* BANNER PRINCIPAL */}
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
            <Flame className="w-4 h-4" /> Mural Multidisciplinar de Oportunidades
          </div>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black">Mural de Vagas em Aberto</h2>
          <p className="text-xs text-slate-300">
            Plantões disponíveis categorizados por especialidade médica e equipe assistencial.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center">
            <span className="text-[10px] font-bold uppercase text-slate-300 block">Vagas Disponíveis</span>
            <span className="text-2xl font-black text-amber-400">{openShifts.length}</span>
          </div>
        </div>
      </div>

      {/* FILTRO DE CATEGORIAS DO MURAL */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 dark:border-slate-800 pb-3">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoryTab(cat.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              selectedCategoryTab === cat.id
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* LISTA DE VAGAS */}
      {openShifts.length === 0 ? (
        <Card className="p-16 text-center border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">Nenhuma vaga aberta nesta categoria</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Todos os plantões estão cobertos no momento. Novos plantões enviados para o mural aparecerão aqui imediatamente.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {openShifts.map(shift => {
            const sector = sectorMap[String(shift.sector_id)];
            const requiredCat = shift.target_category || 'medico';

            return (
              <Card 
                key={shift.id} 
                className="p-5 rounded-3xl border-2 border-amber-300 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10 flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-amber-200/60 dark:border-amber-900/40 pb-3">
                    <div>
                      <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        Vaga Exclusiva: {requiredCat.toUpperCase()}
                      </span>
                      <h3 className="font-black text-base text-slate-900 dark:text-white mt-1.5">
                        {sector?.name || 'Setor Hospitalar'}
                      </h3>
                      {shift.target_specialty && (
                        <span className="text-xs text-sky-600 font-bold block">
                          Especialidade: {shift.target_specialty}
                        </span>
                      )}
                    </div>

                    <span className="text-xs font-mono font-black px-2 py-1 rounded-xl bg-slate-900 text-white dark:bg-slate-800">
                      {shift.start_time} às {shift.end_time}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                      <Calendar className="w-4 h-4 text-sky-600" />
                      <span>Data: {new Date(shift.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
                    </div>

                    {shift.notes && (
                      <p className="text-[11px] text-slate-500 italic mt-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                        "{shift.notes}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-amber-200/60 dark:border-amber-900/40">
                  <Button
                    onClick={() => handleClaimShift(shift)}
                    disabled={submitting}
                    className="w-full h-10 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl shadow-md gap-2"
                  >
                    <Check className="w-4 h-4" /> Candidatar-se / Assumir Plantão
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}