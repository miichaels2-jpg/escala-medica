import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, CheckCheck, Repeat, Globe } from 'lucide-react';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [pendingSwaps, setPendingSwaps] = useState([]);
  const [open, setOpen] = useState(false);
  const [profId, setProfId] = useState(null);
  const [isManager, setIsManager] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = async (pid, managerCheck, companyId) => {
    try {
      // 1. Busca notificações tradicionais
      const notifs = await base44.entities.Notification.filter({ professional_id: pid }, '-created_date', 30).catch(() => []);
      setNotifications(notifs || []);

      // 2. Busca trocas e plantões no mural pendentes
      const allSwaps = await base44.entities.ShiftSwap.filter({ company_id: companyId, status: 'pendente' }, '-created_date', 30).catch(() => []);
      
      // Filtra o que importa para este usuário específico (Direcionado a ele ou Mural aberto)
      const relevantSwaps = (allSwaps || []).filter((s) => {
        const isDirectForMe = String(s.target_professional_id) === String(pid);
        const isMuralOpen = !s.target_professional_id || s.swap_type === 'mural' || (s.target_name || '').toLowerCase().includes('mural');
        const isRequester = String(s.requester_professional_id) === String(pid);

        if (managerCheck) return !isRequester; // Gestor vê todas as pendências da unidade
        return isDirectForMe || isMuralOpen;
      });

      setPendingSwaps(relevantSwaps);
    } catch (e) {
      console.error('Erro ao carregar alertas:', e);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const user = await base44.auth.me();
        if (!user) { setLoaded(true); return; }

        const managerFlag = user.role === 'admin' || user.data?.app_role === 'manager' || user.data?.app_role === 'gestor';
        setIsManager(managerFlag);

        const companyId = user.data?.company_id || 'cmp_principal';
        const profs = await base44.entities.Professional.filter({ company_id: companyId }, '-created_date', 500).catch(() => []);
        const me = profs.find((p) => p.user_id === user.id || (p.email && p.email === user.email));
        
        const currentPid = me?.id || user.data?.professional_id;
        if (currentPid) {
          setProfId(currentPid);
          await load(currentPid, managerFlag, companyId);
        } else if (managerFlag) {
          // Se for gestor sem perfil professional direto
          await load('manager_global', true, companyId);
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  // Atualiza ao abrir o dropdown
  useEffect(() => {
    if (open) {
      const companyId = 'cmp_principal';
      load(profId || 'manager_global', isManager, companyId);
    }
  }, [open, profId, isManager]);

  const unreadNotifs = notifications.filter((n) => !n.read);
  const totalAlertsCount = unreadNotifs.length + pendingSwaps.length;

  const markAllRead = async () => {
    const updates = unreadNotifs.map((n) => ({ id: n.id, read: true }));
    if (updates.length) {
      try { await base44.entities.Notification.bulkUpdate(updates); } catch (e) {}
    }
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
  };

  if (!loaded) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Alertas e Trocas"
      >
        <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        {totalAlertsCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-sm animate-pulse">
            {totalAlertsCount > 9 ? '9+' : totalAlertsCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-40 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[480px] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
              <span className="font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Central de Alertas & Mural ({totalAlertsCount})
              </span>
              {unreadNotifs.length > 0 && (
                <button onClick={markAllRead} className="text-xs text-sky-600 hover:underline flex items-center gap-1 font-semibold">
                  <CheckCheck className="w-3.5 h-3.5" /> Marcar lidas
                </button>
              )}
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
              {/* 1. SEÇÃO DE PLANTÕES NO MURAL E TROCAS PENDENTES */}
              {pendingSwaps.length > 0 && (
                <div className="bg-sky-50/50 dark:bg-sky-950/20 p-3 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" /> Plantões Disponíveis e Trocas ({pendingSwaps.length})
                  </div>
                  {pendingSwaps.map((swap) => (
                    <a
                      key={swap.id}
                      href="/trocas"
                      onClick={() => setOpen(false)}
                      className="block p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-900/50 hover:border-sky-400 transition-all shadow-sm"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {swap.shift_date ? swap.shift_date.split('-').reverse().join('/') : 'Data'} ({swap.shift_time})
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200 rounded-full">
                          {swap.swap_type === 'mural' ? 'Mural Aberto' : 'Direto'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-medium">
                        De: <b>{swap.requester_name}</b> · Setor: {swap.sector_name || 'Geral'}
                      </div>
                    </a>
                  ))}
                </div>
              )}

              {/* 2. NOTIFICAÇÕES TRADICIONAIS */}
              {notifications.length === 0 && pendingSwaps.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-400">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Nenhum alerta ou pendência no momento.
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={`px-4 py-3 ${n.read ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/80 dark:bg-slate-800/40'}`}>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{n.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{n.message}</div>
                    {n.created_date && (
                      <div className="text-[10px] text-slate-400 mt-1">
                        {new Date(n.created_date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}