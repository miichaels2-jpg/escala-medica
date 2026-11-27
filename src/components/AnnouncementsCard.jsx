import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Megaphone, Plus, Trash2 } from 'lucide-react';
import { useAppData } from '@/lib/useAppData';
import { useUnitScope } from '@/lib/unitScope';
import { announcementAudience, deleteAnnouncement, fetchAnnouncements, fetchReads, publishAnnouncement } from '@/lib/announcements';
import { formatDateBR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Comunicados por setor com "li" (V0.10.2), no Painel da coordenação.
export default function AnnouncementsCard() {
  const { company, user, selectedUnitId, allCompanySectors = [], allCompanyProfessionals = [], professionals = [] } = useAppData();
  const { managedUnits, scopeUnitIds, unitName } = useUnitScope();
  const team = allCompanyProfessionals.length ? allCompanyProfessionals : professionals;
  const [list, setList] = useState([]);
  const [reads, setReads] = useState([]);
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({ unit_id: '', sector_id: '', title: '', body: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const result = await fetchAnnouncements(60);
    setMissing(Boolean(result.missing));
    const mine = result.list.filter(a => scopeUnitIds.includes(String(a.unit_id)));
    setList(mine);
    setReads(await fetchReads(mine.map(a => a.id)));
  }, [scopeUnitIds]);

  useEffect(() => { load(); }, [load]);

  const sectorName = id => allCompanySectors.find(s => String(s.id) === String(id))?.name || 'Setor';
  const sectorsOfUnit = useMemo(() => allCompanySectors.filter(s => s.active !== false && String(s.unit_id) === String(form.unit_id)), [allCompanySectors, form.unit_id]);

  const openNew = () => {
    setForm({ unit_id: String(scopeUnitIds.includes(String(selectedUnitId)) ? selectedUnitId : scopeUnitIds[0] || ''), sector_id: '', title: '', body: '' });
    setError('');
    setOpen(true);
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError('Escreva o título do comunicado.');
    setSaving(true);
    setError('');
    try {
      const { audience } = await publishAnnouncement({
        companyId: company?.id, unitId: form.unit_id, sectorId: form.sector_id, title: form.title, body: form.body,
        user, sectorName: form.sector_id ? sectorName(form.sector_id) : '', professionals: team
      });
      setOpen(false);
      await load();
      alert(`Comunicado publicado. ${audience} profissional(is) avisado(s) no sino e no celular.`);
    } catch (err) {
      setError(missing ? 'Falta a atualização do banco 20261128120000_preferences_announcements.sql.' : `Não foi possível publicar. ${err?.message || ''}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (a) => {
    if (!confirm(`Apagar o comunicado "${a.title}"? Ele some para a equipe.`)) return;
    try { await deleteAnnouncement(a.id); await load(); } catch (err) { alert(`Não foi possível apagar. ${err?.message || ''}`); }
  };

  return (
    <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2"><Megaphone className="w-5 h-5 text-sky-600" /> Comunicados</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Aviso oficial para a equipe de um setor ou de toda a unidade. Você vê quem já leu.</p>
        </div>
        <Button type="button" size="sm" onClick={openNew} disabled={missing} className="shrink-0 gap-1.5 bg-sky-600 hover:bg-sky-500 text-white"><Plus className="w-4 h-4" /> Novo comunicado</Button>
      </div>

      {missing && <p className="text-xs text-amber-700 dark:text-amber-300">Comunicados ficam disponíveis depois da atualização do banco 20261128120000_preferences_announcements.sql.</p>}
      {!missing && list.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum comunicado ainda. Use para avisos como mudança de rotina, protocolo novo ou reunião da equipe.</p>}

      <ul className="space-y-2">
        {list.slice(0, 8).map(a => {
          const audience = announcementAudience(a, team);
          const readIds = new Set(reads.filter(r => r.announcement_id === a.id).map(r => String(r.professional_id)));
          const readers = audience.filter(p => readIds.has(String(p.id)));
          const pending = audience.filter(p => !readIds.has(String(p.id)));
          const isOpen = expanded === a.id;
          return (
            <li key={a.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3">
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => setExpanded(isOpen ? null : a.id)} className="min-w-0 flex-1 text-left cursor-pointer">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{a.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {a.sector_id ? sectorName(a.sector_id) : 'Toda a unidade'}{managedUnits.length > 1 ? ` · ${unitName(a.unit_id)}` : ''} · {formatDateBR(String(a.created_at).slice(0, 10))}
                    {' · '}<b className={pending.length ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}>lido por {readers.length} de {audience.length}</b>
                  </p>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(a)} aria-label="Apagar comunicado" className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              {isOpen && (
                <div className="mt-2 space-y-2 text-xs">
                  {a.body && <p className="whitespace-pre-line text-slate-700 dark:text-slate-200">{a.body}</p>}
                  <p className="text-slate-500"><b className="text-emerald-700 dark:text-emerald-300">Leram:</b> {readers.length ? readers.map(p => p.name).join(', ') : 'ninguém ainda'}</p>
                  <p className="text-slate-500"><b className="text-amber-700 dark:text-amber-300">Faltam:</b> {pending.length ? pending.map(p => p.name).join(', ') : 'ninguém'}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Megaphone className="w-5 h-5 text-sky-600" /> Novo comunicado</DialogTitle></DialogHeader>
          <form onSubmit={handlePublish} className="space-y-3">
            {managedUnits.length > 1 && (
              <div className="space-y-1">
                <Label className="text-xs">Unidade</Label>
                <select value={form.unit_id} onChange={e => setForm({ ...form, unit_id: e.target.value, sector_id: '' })} className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm">
                  {managedUnits.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Para quem</Label>
              <select value={form.sector_id} onChange={e => setForm({ ...form, sector_id: e.target.value })} className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm">
                <option value="">Toda a equipe da unidade</option>
                {sectorsOfUnit.map(s => <option key={s.id} value={String(s.id)}>Equipe do setor {s.name}</option>)}
              </select>
              <p className="text-[11px] text-slate-500">{announcementAudience({ unit_id: form.unit_id, sector_id: form.sector_id }, team).length} profissional(is) recebem o aviso no sino e no celular.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Título *</Label>
              <Input value={form.title} maxLength={120} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Novo protocolo de passagem de plantão" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mensagem</Label>
              <textarea value={form.body} maxLength={2000} rows={5} onChange={e => setForm({ ...form, body: e.target.value })} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm" placeholder="O que a equipe precisa saber." />
            </div>
            {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-sky-600 hover:bg-sky-500 text-white">{saving ? 'Publicando…' : 'Publicar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
