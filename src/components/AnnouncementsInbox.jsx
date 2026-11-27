import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Megaphone } from 'lucide-react';
import { fetchAnnouncements, fetchReads, isForProfessional, markAnnouncementRead } from '@/lib/announcements';
import { formatDateBR } from '@/lib/format';
import { Button } from '@/components/ui/button';

// Comunicados para o plantonista (V0.10.2), no topo da Minha Escala: os novos com o botão "Li";
// os já lidos ficam guardados embaixo.
export default function AnnouncementsInbox({ professional, sectors = [] }) {
  const linked = professional?.id && professional.id !== 'temp_user_id';
  const [list, setList] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const [showRead, setShowRead] = useState(false);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    if (!linked) return;
    const { list: all } = await fetchAnnouncements(40);
    const mine = all.filter(a => isForProfessional(a, professional));
    setList(mine);
    const reads = await fetchReads(mine.map(a => a.id));
    setReadIds(new Set(reads.filter(r => String(r.professional_id) === String(professional.id)).map(r => r.announcement_id)));
  }, [linked, professional]);

  useEffect(() => { load(); }, [load]);

  const unread = useMemo(() => list.filter(a => !readIds.has(a.id)), [list, readIds]);
  const read = useMemo(() => list.filter(a => readIds.has(a.id)), [list, readIds]);
  const sectorName = id => sectors.find(s => String(s.id) === String(id))?.name || 'Setor';

  const handleRead = async (a) => {
    setBusy(a.id);
    try {
      await markAnnouncementRead(a, professional.id);
      setReadIds(prev => new Set([...prev, a.id]));
    } catch (err) {
      alert(`Não foi possível marcar como lido. ${err?.message || ''}`);
    } finally {
      setBusy(null);
    }
  };

  if (!linked || !list.length) return null;

  const item = (a, isRead) => (
    <li key={a.id} className={`rounded-2xl border p-3 ${isRead ? 'border-slate-200 dark:border-slate-800' : 'border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/20'}`}>
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{a.title}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{a.sector_id ? sectorName(a.sector_id) : 'Toda a unidade'} · {formatDateBR(String(a.created_at).slice(0, 10))}{a.created_by_name ? ` · ${a.created_by_name}` : ''}</p>
      {a.body && <p className="mt-1.5 whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">{a.body}</p>}
      {!isRead && (
        <div className="mt-2 flex justify-end">
          <Button type="button" size="sm" disabled={busy === a.id} onClick={() => handleRead(a)} className="gap-1.5 bg-sky-600 hover:bg-sky-500 text-white"><Check className="w-4 h-4" /> Li</Button>
        </div>
      )}
    </li>
  );

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2"><Megaphone className="w-5 h-5 text-sky-600" /> Comunicados da coordenação{unread.length ? ` (${unread.length} novo${unread.length > 1 ? 's' : ''})` : ''}</h2>
        {read.length > 0 && <button type="button" onClick={() => setShowRead(v => !v)} className="text-xs font-medium text-sky-700 dark:text-sky-300 hover:underline cursor-pointer">{showRead ? 'Esconder lidos' : `Ver lidos (${read.length})`}</button>}
      </div>
      {unread.length === 0 && !showRead && <p className="text-xs text-slate-500 dark:text-slate-400">Você está em dia com os comunicados.</p>}
      <ul className="space-y-2">
        {unread.map(a => item(a, false))}
        {showRead && read.map(a => item(a, true))}
      </ul>
    </section>
  );
}
