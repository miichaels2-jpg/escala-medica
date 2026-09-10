import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, CheckCheck } from 'lucide-react';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [profId, setProfId] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const load = async (pid) => {
    try {
      const notifs = await base44.entities.Notification.filter({ professional_id: pid }, '-created_date', 50);
      setNotifications(notifs);
    } catch (e) {}
  };

  useEffect(() => {
    (async () => {
      try {
        const user = await base44.auth.me();
        if (!user) { setLoaded(true); return; }
        const profs = await base44.entities.Professional.filter({}, '-created_date', 500);
        const me = profs.find((p) => p.user_id === user.id || (p.email && p.email === user.email));
        if (me) {
          setProfId(me.id);
          await load(me.id);
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  // realtime: refresh when dropdown opens
  useEffect(() => {
    if (open && profId) load(profId);
  }, [open, profId]);

  const unread = notifications.filter((n) => !n.read);

  const markAllRead = async () => {
    const updates = unread.map((n) => ({ id: n.id, read: true }));
    if (updates.length) {
      try { await base44.entities.Notification.bulkUpdate(updates); } catch (e) {}
    }
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
  };

  if (!loaded || !profId) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
        aria-label="Alertas"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unread.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-40 w-80 bg-white rounded-xl shadow-xl border border-slate-200 max-h-96 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
              <span className="font-semibold text-sm text-slate-800">Meus Alertas</span>
              {unread.length > 0 && (
                <button onClick={markAllRead} className="text-xs text-sky-600 hover:underline flex items-center gap-1">
                  <CheckCheck className="w-3.5 h-3.5" /> Marcar como lidas
                </button>
              )}
            </div>
            <div className="overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">
                  <Bell className="w-7 h-7 mx-auto mb-2 opacity-30" />
                  Nenhum alerta no momento.
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={`px-4 py-3 border-b border-slate-50 last:border-0 ${n.read ? 'bg-white' : 'bg-sky-50/60'}`}>
                    <div className="text-sm font-medium text-slate-800">{n.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.message}</div>
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