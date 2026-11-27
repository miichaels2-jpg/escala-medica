import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, Megaphone } from 'lucide-react';
import { useAppData } from '@/lib/useAppData';
import { fetchAnnouncements, fetchReads, isForProfessional, markAnnouncementRead } from '@/lib/announcements';
import { formatDateBR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const DISMISSED = 'sm_avisos_depois';

// Comunicado novo em janela (V0.10.3): quem é da equipe vê o texto inteiro ao abrir o app e toca em
// "Li". "Depois" esconde até a próxima vez que o app for aberto; tudo fica guardado em Avisos.
export default function AnnouncementPopup() {
  const { currentProfessional, allCompanySectors = [] } = useAppData();
  const navigate = useNavigate();
  const location = useLocation();
  const [queue, setQueue] = useState([]);
  const [busy, setBusy] = useState(false);
  const linked = currentProfessional?.id && currentProfessional.id !== 'temp_user_id';

  const load = useCallback(async () => {
    if (!linked) return;
    const { list } = await fetchAnnouncements(20);
    const mine = list.filter(a => isForProfessional(a, currentProfessional));
    if (!mine.length) { setQueue([]); return; }
    const reads = await fetchReads(mine.map(a => a.id));
    const readIds = new Set(reads.filter(r => String(r.professional_id) === String(currentProfessional.id)).map(r => r.announcement_id));
    let dismissed = [];
    try { dismissed = JSON.parse(window.sessionStorage.getItem(DISMISSED) || '[]'); } catch { /* sem armazenamento */ }
    setQueue(mine.filter(a => !readIds.has(a.id) && !dismissed.includes(a.id)).reverse());
  }, [linked, currentProfessional]);

  useEffect(() => { load(); }, [load]);
  // Chegou aviso novo com o app aberto (o sino atualiza a lista): confere de novo ao voltar para o app.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const current = location.pathname === '/avisos' ? null : queue[0];
  const next = () => setQueue(q => q.slice(1));

  const handleRead = async () => {
    setBusy(true);
    try { await markAnnouncementRead(current, currentProfessional.id); next(); }
    catch (err) { alert(`Não foi possível marcar como lido. ${err?.message || ''}`); }
    finally { setBusy(false); }
  };
  const handleLater = () => {
    try {
      const list = JSON.parse(window.sessionStorage.getItem(DISMISSED) || '[]');
      window.sessionStorage.setItem(DISMISSED, JSON.stringify([...list, current.id]));
    } catch { /* sem armazenamento */ }
    next();
  };

  if (!current) return null;
  const sectorName = allCompanySectors.find(s => String(s.id) === String(current.sector_id))?.name;

  return (
    <Dialog open onOpenChange={open => { if (!open) handleLater(); }}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300"><Megaphone className="w-4 h-4" /> Comunicado da coordenação{queue.length > 1 ? ` · 1 de ${queue.length}` : ''}</p>
          <DialogTitle className="text-lg">{current.title}</DialogTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400">{sectorName || 'Toda a unidade'} · {formatDateBR(String(current.created_at).slice(0, 10))}{current.created_by_name ? ` · ${current.created_by_name}` : ''}</p>
        </DialogHeader>
        {current.body && <p className="max-h-[50vh] overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-200">{current.body}</p>}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => { handleLater(); navigate('/avisos'); }} className="text-xs">Ver todos os avisos</Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleLater}>Depois</Button>
            <Button type="button" disabled={busy} onClick={handleRead} className="gap-1.5 bg-sky-600 hover:bg-sky-500 text-white"><Check className="w-4 h-4" /> Li</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
