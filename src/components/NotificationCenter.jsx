import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, CheckCircle2, ChevronRight, Flame, Megaphone, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchMyNotifications, markNotificationsRead } from '@/lib/notifications';
import { getShiftDateTimeRange, isShiftVacant } from '@/lib/shiftLiveStatus';

const READ_VACANCIES_KEY = 'scale_read_notifs';
const REFRESH_MS = 60_000;

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function formatDateBR(value) {
  const [y, m, d] = String(value || '').slice(0, 10).split('-');
  return d ? `${d}/${m}/${y}` : '';
}

function timeAgo(value) {
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const hours = Math.round(diffMin / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return `há ${days} dia${days > 1 ? 's' : ''}`;
}

function getShiftSpecialty(shift) {
  if (shift?.target_specialty) return shift.target_specialty;
  return String(shift?.notes || '').match(/\[ESP:(.*?)\]/i)?.[1]?.trim() || '';
}

// Vaga relevante para o profissional: setor autorizado e especialidade compatível.
export function isVacancyRelevantFor(shift, professional) {
  if (!professional) return true;
  const authorized = professional?.data?.authorized_sectors ?? professional?.authorized_sectors;
  if (Array.isArray(authorized) && !authorized.some(id => String(id) === String(shift.sector_id))) return false;
  const required = normalize(getShiftSpecialty(shift));
  const mine = normalize(professional.specialty);
  if (!required || required === 'geral' || !mine) return true;
  return required === mine || required.includes(mine) || mine.includes(required);
}

export function useNotificationCenter({ user, currentProfessional, shifts, selectedUnitId, isManager }) {
  const [notices, setNotices] = useState([]);
  const [readVacancyIds, setReadVacancyIds] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem(READ_VACANCIES_KEY) || '[]'); } catch { return []; }
  });

  const professionalId = currentProfessional?.id && currentProfessional.id !== 'temp_user_id' ? String(currentProfessional.id) : null;
  const userId = user?.id && user.id !== 'usr_guest' ? String(user.id) : null;

  const refresh = useCallback(async () => {
    if (!professionalId && !userId) return;
    setNotices(await fetchMyNotifications({ professionalId, userId }));
  }, [professionalId, userId]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    const onFocus = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const vacancies = useMemo(() => {
    const now = new Date();
    return (shifts || [])
      .filter(s => {
        if (!s || String(s.unit_id) !== String(selectedUnitId)) return false;
        if (normalize(s.status).includes('cancel') || !isShiftVacant(s)) return false;
        const range = getShiftDateTimeRange(s);
        if (!range || range.end <= now) return false;
        return isManager || isVacancyRelevantFor(s, currentProfessional);
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.start_time).localeCompare(String(b.start_time)));
  }, [shifts, selectedUnitId, isManager, currentProfessional]);

  const pendingApprovals = useMemo(() => {
    if (!isManager) return [];
    return (shifts || []).filter(s =>
      s && String(s.unit_id) === String(selectedUnitId) &&
      (s.status === 'aguardando_aprovacao_gestor' || String(s.notes || '').includes('[AGUARDANDO_GESTOR]'))
    );
  }, [shifts, selectedUnitId, isManager]);

  const unreadNotices = notices.filter(n => !n.read);
  const unreadVacancies = vacancies.filter(s => !readVacancyIds.includes(s.id));
  const unreadCount = unreadNotices.length + unreadVacancies.length + pendingApprovals.length;

  const markVacanciesRead = ids => {
    const merged = Array.from(new Set([...readVacancyIds, ...ids]));
    setReadVacancyIds(merged);
    try { window.localStorage.setItem(READ_VACANCIES_KEY, JSON.stringify(merged.slice(-500))); } catch {}
  };

  const markNoticesRead = async ids => {
    if (!ids.length) return;
    setNotices(prev => prev.map(n => (ids.includes(n.id) ? { ...n, read: true } : n)));
    await markNotificationsRead(ids);
  };

  const markAllRead = async () => {
    markVacanciesRead(vacancies.map(s => s.id));
    await markNoticesRead(unreadNotices.map(n => n.id));
  };

  return { notices, unreadNotices, vacancies, unreadVacancies, pendingApprovals, unreadCount, markVacanciesRead, markNoticesRead, markAllRead, refresh };
}

export function NotificationPanel({ center, isManager, onClose }) {
  const navigate = useNavigate();
  const go = path => { onClose(); navigate(path); };
  const { notices, unreadNotices, unreadVacancies, pendingApprovals } = center;
  const visibleNotices = notices.slice(0, 15);
  const isEmpty = visibleNotices.length === 0 && unreadVacancies.length === 0 && pendingApprovals.length === 0;

  const openNotice = async notice => {
    if (!notice.read) await center.markNoticesRead([notice.id]);
    const target = notice.type === 'escala_publicada' || notice.type === 'plantao_alocado' ? '/minha-escala' : '/trocas';
    go(target);
  };

  return (
    <div className="fixed left-3 right-3 top-[calc(4rem+env(safe-area-inset-top))] sm:absolute sm:left-auto sm:right-0 sm:top-auto mt-2 sm:w-96 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 space-y-3 z-50 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-sky-600" />
          <span className="text-sm font-bold text-slate-900 dark:text-white">Notificações</span>
        </div>
        {(unreadNotices.length > 0 || unreadVacancies.length > 0) && (
          <button onClick={center.markAllRead} className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer">
            <CheckCheck className="w-3.5 h-3.5" /> Marcar todas como lidas
          </button>
        )}
      </div>

      <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto space-y-3 pr-1">
        {isEmpty && (
          <div className="text-center py-6 space-y-1">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-80" />
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Tudo em dia</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Nenhum aviso ou vaga nova para você.</p>
          </div>
        )}

        {isManager && pendingApprovals.length > 0 && (
          <button type="button" onClick={() => go('/trocas')} className="w-full text-left p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 flex items-center gap-3 cursor-pointer hover:border-indigo-400">
            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="flex-1 text-sm font-semibold text-indigo-900 dark:text-indigo-200">
              {pendingApprovals.length} pedido(s) de troca aguardando sua aprovação
            </span>
            <ChevronRight className="w-4 h-4 text-indigo-500" />
          </button>
        )}

        {visibleNotices.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Avisos</p>
            {visibleNotices.map(notice => (
              <button
                type="button"
                key={notice.id}
                onClick={() => openNotice(notice)}
                className={`w-full text-left p-3 rounded-2xl border transition-colors cursor-pointer ${notice.read
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-75'
                  : 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900 hover:border-sky-400'}`}
              >
                <div className="flex items-start gap-2.5">
                  <Megaphone className={`w-4 h-4 mt-0.5 shrink-0 ${notice.read ? 'text-slate-400' : 'text-sky-600 dark:text-sky-400'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">{notice.title}</p>
                      {!notice.read && <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0 mt-1.5" aria-label="Não lida" />}
                    </div>
                    {notice.message && <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">{notice.message}</p>}
                    <p className="text-[11px] text-slate-400 mt-1">{timeAgo(notice.created_date)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {unreadVacancies.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {isManager ? 'Vagas abertas na unidade' : 'Vagas abertas para você'}
            </p>
            {unreadVacancies.slice(0, 10).map(shift => (
              <button
                type="button"
                key={shift.id}
                onClick={() => { center.markVacanciesRead([shift.id]); go(isManager ? '/escalas' : '/trocas'); }}
                className="w-full text-left p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 hover:border-amber-400 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1"><Flame className="w-3.5 h-3.5" /> Vaga disponível</span>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{formatDateBR(shift.date)}</span>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                  {shift.start_time} às {shift.end_time}{getShiftSpecialty(shift) ? ` · ${getShiftSpecialty(shift)}` : ''}
                </p>
              </button>
            ))}
            {unreadVacancies.length > 10 && (
              <p className="text-xs text-slate-500 text-center">+ {unreadVacancies.length - 10} vaga(s) no Mural</p>
            )}
          </div>
        )}
      </div>

      <Button
        size="sm"
        onClick={() => go('/trocas')}
        className="w-full h-9 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-xl cursor-pointer"
      >
        Abrir o Mural de Oportunidades <ChevronRight className="w-3.5 h-3.5 ml-1" />
      </Button>
    </div>
  );
}
