import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

// Corpo Clínico (gestor): pedidos de exclusão de dados (LGPD) em aberto, com prazo de 15 dias.
// O gestor exclui ou anonimiza o cadastro e marca o pedido como atendido.
export default function PrivacyRequestsBanner() {
  const [requests, setRequests] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('privacy_events').select('id, created_at, user_name, note')
      .eq('kind', 'exclusao_pedida').eq('status', 'aberto').order('created_at');
    setRequests(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!requests.length) return null;

  const resolve = async (req) => {
    const note = window.prompt(`Marcar como atendido o pedido de ${req.user_name || 'profissional'}?\n\nAntes, exclua ou desative e anonimize o cadastro no Corpo Clínico. Se quiser, anote o que foi feito:`, '');
    if (note === null) return;
    setBusyId(req.id);
    const { error } = await supabase.rpc('resolve_privacy_request', { p_id: req.id, p_note: note || null });
    setBusyId(null);
    if (error) { alert('Não foi possível marcar como atendido: ' + error.message); return; }
    load();
  };

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{requests.length} pedido(s) de exclusão de dados (LGPD)</p>
          <p className="text-xs text-amber-800/80 dark:text-amber-200/80">A lei pede resposta em até 15 dias. Exclua ou anonimize o cadastro e marque como atendido.</p>
          <ul className="mt-2 space-y-1.5">
            {requests.map(req => {
              const days = Math.floor((Date.now() - new Date(req.created_at).getTime()) / 86400000);
              const left = 15 - days;
              return (
                <li key={req.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium text-slate-900 dark:text-white">{req.user_name || 'Profissional'}</span>
                  <span className="text-xs text-slate-600 dark:text-slate-300">pedido em {new Date(req.created_at).toLocaleDateString('pt-BR')} · {left > 0 ? `faltam ${left} dia(s)` : 'prazo vencido'}</span>
                  {req.note && <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">“{req.note}”</span>}
                  <Button type="button" variant="outline" disabled={busyId === req.id} onClick={() => resolve(req)} className="h-8 px-3 rounded-lg text-xs ml-auto cursor-pointer">Marcar como atendido</Button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
