import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Bell, CheckCheck } from 'lucide-react';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [profId, setProfId] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const load = async (pid) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('professional_id', pid)
        .order('created_date', { ascending: false })
        .limit(50);

      if (!error && data) {
        setNotifications(data);
      }
    } catch (e) {
      console.error('Erro ao carregar notificações:', e);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          setLoaded(true);
          return;
        }

        // Busca o professional associado ao usuário logado
        const { data: profs, error: profError } = await supabase
          .from('professionals')
          .select('*')
          .limit(500);

        if (!profError && profs) {
          const me = profs.find((p) => p.user_id === user.id || (p.email && p.email === user.email));
          if (me) {
            setProfId(me.id);
            await load(me.id);
          }
        }
      } catch (e) {
        console.error('Erro na inicialização de notificações:', e);
      }
      setLoaded(true);
    })();
  }, []);

  // Atualiza as notificações quando o dropdown é aberto
  useEffect(() => {
    if (open && profId) load(profId);
  }, [open, profId]);

  const unread = notifications.filter((n) => !n.read);

  const markAllRead = async () => {
    const unreadIds = unread.map((n) => n.id);
    if (unreadIds.length > 0) {
      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .in('id', unreadIds);
      } catch (e) {
        console.error('Erro ao marcar notificações como lidas:', e);
      }
    }
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
  };

  if (!loaded || !profId) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        aria-label="Alertas"
      >
        <Bell className="w-5 h-5 text-slate-600 dark:text-slate-200" />
        {unread.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-40 w-80 bg-white dark:bg-[#121c2b] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-96 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
              <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Meus Alertas</span>
              {unread.length > 0 && (
                <button onClick={markAllRead} className="text-xs text-sky-600 hover:underline flex items-center gap-1 dark:text-sky-400 cursor-pointer">
                  <CheckCheck className="w-3.5 h-3.5" /> Marcar como lidas
                </button>
              )}
            </div>
            <div className="overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-400">
                  <Bell className="w-7 h-7 mx-auto mb-2 opacity-30" />
                  Nenhum alerta no momento.
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={`px-4 py-3 border-b border-slate-50 dark:border-slate-700 last:border-0 ${n.read ? 'bg-white dark:bg-[#121c2b]' : 'bg-sky-50/60 dark:bg-sky-950/30'}`}>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{n.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-300 mt-0.5 leading-relaxed">{n.message}</div>
                    {n.created_date && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-400 mt-1">
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