import { useState } from 'react';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UNAVAILABILITY_REASONS, addUnavailability, describeUnavailability, getUnavailability } from '@/lib/availability';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// O profissional informa quando NÃO pode trabalhar; a alocação deixa de sugeri-lo nesses dias.
export default function AvailabilityCard({ professional, onSaved }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ start: todayStr(), end: todayStr(), reason: 'Férias' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const linked = professional?.id && professional.id !== 'temp_user_id';
  const today = todayStr();
  const periods = getUnavailability(professional).filter(item => item.end >= today);

  // Lê o cadastro direto do banco antes de gravar, para não misturar dados do usuário no profissional.
  const saveList = async (buildNext) => {
    setSaving(true);
    setError('');
    try {
      const { data: row, error: readError } = await supabase.from('professionals').select('data').eq('id', professional.id).single();
      if (readError) throw readError;
      const data = row?.data && typeof row.data === 'object' ? row.data : {};
      const next = buildNext(Array.isArray(data.unavailability) ? data.unavailability : []);
      const { error: writeError } = await supabase.from('professionals').update({ data: { ...data, unavailability: next } }).eq('id', professional.id);
      if (writeError) throw writeError;
      await onSaved?.();
      return true;
    } catch (err) {
      setError(`Não foi possível salvar. ${err?.message || 'Tente novamente.'}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    if (!form.start || !form.end) { setError('Informe o início e o fim.'); return; }
    if (form.end < today && form.start < today) { setError('O período já passou.'); return; }
    if (await saveList(list => addUnavailability(list, form))) setAdding(false);
  };

  const handleRemove = (id) => saveList(list => list.filter(item => item.id !== id));

  if (!linked) return null;

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarOff className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Minha disponibilidade</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Marque férias e folgas: a coordenação não vai te escalar nesses dias.</p>
          </div>
        </div>
        {!adding && (
          <Button type="button" variant="outline" onClick={() => { setAdding(true); setError(''); }} className="h-9 shrink-0 gap-1.5 text-xs">
            <Plus className="w-4 h-4" /> Informar
          </Button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
          <label className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
            De
            <Input type="date" value={form.start} min={today} onChange={e => setForm(f => ({ ...f, start: e.target.value, end: f.end < e.target.value ? e.target.value : f.end }))} className="h-10" required />
          </label>
          <label className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
            Até
            <Input type="date" value={form.end} min={form.start || today} onChange={e => setForm(f => ({ ...f, end: e.target.value }))} className="h-10" required />
          </label>
          <label className="col-span-2 sm:col-span-1 text-xs text-slate-500 dark:text-slate-400 space-y-1">
            Motivo
            <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className="h-10 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm text-slate-900 dark:text-slate-100">
              {UNAVAILABILITY_REASONS.map(reason => <option key={reason} value={reason}>{reason}</option>)}
            </select>
          </label>
          <div className="col-span-2 sm:col-span-1 flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setAdding(false)} disabled={saving} className="h-10 flex-1 sm:flex-none">Cancelar</Button>
            <Button type="submit" disabled={saving} className="h-10 flex-1 sm:flex-none bg-sky-600 hover:bg-sky-500 text-white">{saving ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </form>
      )}

      {periods.length > 0 ? (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-100 dark:border-slate-800">
          {periods.map(item => (
            <li key={item.id || `${item.start}-${item.end}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="text-slate-700 dark:text-slate-200">{describeUnavailability(item)}</span>
              <Button type="button" variant="ghost" onClick={() => handleRemove(item.id)} disabled={saving || !item.id} aria-label={`Remover ${describeUnavailability(item)}`} className="h-8 w-8 p-0 text-slate-400 hover:text-rose-500">
                <Trash2 className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : !adding && (
        <p className="text-xs text-slate-500 dark:text-slate-400">Nenhum período informado.</p>
      )}

      {error && <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}
    </section>
  );
}
