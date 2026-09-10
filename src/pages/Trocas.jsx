import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Repeat, Check, X, Loader2, Clock, CheckCircle2, XCircle } from 'lucide-react';

const statusInfo = {
  pendente: { label: 'Pendente', color: 'bg-amber-50 text-amber-700', icon: Clock },
  aprovada: { label: 'Aprovada', color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  rejeitada: { label: 'Rejeitada', color: 'bg-red-50 text-red-600', icon: XCircle },
  cancelada: { label: 'Cancelada', color: 'bg-slate-100 text-slate-500', icon: XCircle },
};

export default function Trocas() {
  const { user, company, loading } = useAppData();
  const [swaps, setSwaps] = useState([]);
  const [acting, setActing] = useState(null);
  const companyId = user?.data?.company_id;
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id;

  const load = async () => {
    const f = companyId ? { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) } : {};
    setSwaps(await base44.entities.ShiftSwap.filter(f, '-created_date', 200));
  };

  useEffect(() => { if (!loading) load(); }, [loading, companyId, unitId]);

  const handleAction = async (swap, action) => {
    setActing(swap.id);
    try {
      await base44.functions.invoke('manageShiftSwap', { action, swapId: swap.id });
      load();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Erro');
    } finally {
      setActing(null);
    }
  };

  const canManageSwap = user?.role === 'admin' || user?.data?.app_role === 'manager' || user?.data?.app_role === 'gestor';

  const pending = swaps.filter((s) => s.status === 'pendente');
  const others = swaps.filter((s) => s.status !== 'pendente');

  return (
    <div className="p-4 md:p-8 space-y-5">
      <p className="text-sm text-slate-500">{canManageSwap ? 'Aprove ou rejeite solicitações de troca e libere vagas para remanejamento.' : 'Aprove ou rejeite as solicitações de troca de plantão dos profissionais'}</p>

      <Card className="p-5 border-slate-200">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Repeat className="w-4 h-4 text-amber-500" /> Aguardando aprovação ({pending.length})</h3>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Nenhuma solicitação pendente.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((s) => (
              <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50/50">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{s.requester_name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Plantão: {s.shift_date} · {s.target_name ? `Trocar com ${s.target_name}` : 'Sem profissional sugerido'}
                  </div>
                  {s.reason && <div className="text-xs text-slate-400 mt-0.5">Motivo: {s.reason}</div>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleAction(s, 'approve')} disabled={acting === s.id} className="bg-emerald-600 hover:bg-emerald-700">
                    {acting === s.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />} Aprovar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleAction(s, 'reject')} disabled={acting === s.id} className="text-red-600 hover:bg-red-50">
                    <X className="w-4 h-4 mr-1" /> Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {others.length > 0 && (
        <Card className="p-5 border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4">Histórico</h3>
          <div className="space-y-2">
            {others.map((s) => {
              const Info = statusInfo[s.status] || statusInfo.pendente;
              const Icon = Info.icon;
              return (
                <div key={s.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-slate-700">{s.requester_name} → {s.target_name || 'Sem sugestão'}</div>
                    <div className="text-xs text-slate-400">{s.shift_date}</div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${Info.color}`}>
                    <Icon className="w-3.5 h-3.5" /> {Info.label}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}