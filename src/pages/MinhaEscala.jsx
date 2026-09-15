import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CalendarDays, 
  Clock, 
  Building2, 
  Repeat, 
  CheckCircle2, 
  Loader2, 
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function safeArray(val) { return Array.isArray(val) ? val : []; }
function formatDateBR(dateStr) {
  if (!dateStr) return '—';
  const parts = String(dateStr).trim().split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(dateStr);
}

export default function MinhaEscala() {
  const { user, company, loading: appLoading } = useAppData();
  const navigate = useNavigate();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const myProfId = user?.data?.professional_id || user?.id;

  useEffect(() => {
    async function loadMyShifts() {
      setLoading(true);
      try {
        const query = companyId ? { company_id: companyId } : {};
        const allShifts = await base44.entities.Shift.filter(query, '-date', 1000);
        
        // Filtra os plantões onde este usuário está alocado e ativos
        const myShifts = safeArray(allShifts).filter(s => 
          (String(s.professional_id) === String(myProfId) || s.professional_name === user?.full_name) &&
          s.status !== 'cancelado'
        );

        setShifts(myShifts);
      } catch (e) {
        console.error('Erro ao carregar minha escala:', e);
      } finally {
        setLoading(false);
      }
    }

    if (!appLoading) loadMyShifts();
  }, [appLoading, companyId, myProfId, user]);

  const upcomingShifts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return shifts.filter(s => String(s.date) >= today).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [shifts]);

  const pastShifts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return shifts.filter(s => String(s.date) < today).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [shifts]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* CABEÇALHO */}
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-400">
              <CalendarDays className="w-4 h-4" /> Minha Agenda de Plantões
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-tight">Meus Plantões Escalados</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Consulte seus próximos plantões, solicite trocas e acompanhe os turnos já realizados.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => navigate('/trocas')} className="bg-sky-600 hover:bg-sky-500 text-white font-bold gap-2 text-xs h-10 px-5 rounded-xl shadow-lg">
              <Repeat className="w-4 h-4" /> Pedir Troca ou Ver Mural
            </Button>
          </div>
        </div>
      </div>

      {/* PRÓXIMOS PLANTÕES */}
      <div className="space-y-3">
        <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-sky-600" /> Próximos Plantões ({upcomingShifts.length})
        </h3>

        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-600" />
            Carregando sua escala...
          </div>
        ) : upcomingShifts.length === 0 ? (
          <Card className="p-12 text-center bg-white dark:bg-slate-900 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
            Você não possui plantões futuros agendados no momento. Acesse o Mural de Oportunidades para assumir turnos.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingShifts.map(s => (
              <Card key={s.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-sky-600">{formatDateBR(s.date)}</span>
                    <span className="font-mono text-slate-500">{s.start_time} às {s.end_time}</span>
                  </div>
                  <div className="text-sm font-black text-slate-900 dark:text-white">
                    {s.sector_name || 'Setor Geral'}
                  </div>
                  <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    Valor Estimado: R$ {Number(s.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => navigate('/trocas')} className="text-xs h-8 text-sky-600 border-sky-300 hover:bg-sky-50">
                    <Repeat className="w-3 h-3 mr-1" /> Passar Plantão
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* PLANTÕES ANTERIORES */}
      <div className="space-y-3 pt-6 border-t border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Plantões Concluídos ({pastShifts.length})
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 opacity-80">
          {pastShifts.slice(0, 8).map(s => (
            <div key={s.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs flex justify-between items-center">
              <div>
                <strong className="block text-slate-800 dark:text-slate-200">{formatDateBR(s.date)}</strong>
                <span className="text-[10px] text-slate-400">{s.sector_name} ({s.start_time} - {s.end_time})</span>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-bold px-2 py-0.5 rounded-full">
                Realizado
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}