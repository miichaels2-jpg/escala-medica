import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getProfessionalUnitIds, isProfessionalAuthorizedForSector } from '@/lib/sectorAccess';
import { PREFERRED_TURNS, describePreferences, getPreferences, hasPreferences, sanitizePreferences } from '@/lib/preferences';
import { Button } from '@/components/ui/button';

const WEEKDAYS = [[1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [0, 'Dom']];

// Preferências do plantonista (V0.10.2): a coordenação vê, o preenchimento automático respeita e as
// vagas do interesse dele aparecem primeiro no Mural.
export default function PreferencesCard({ professional, sectors = [], onSaved }) {
  const linked = professional?.id && professional.id !== 'temp_user_id';
  const saved = useMemo(() => getPreferences(professional), [professional]);
  const [form, setForm] = useState(saved);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { if (!editing) setForm(saved); }, [saved, editing]);

  const mySectors = useMemo(() => {
    const units = getProfessionalUnitIds(professional);
    return sectors
      .filter(s => s && s.active !== false && (!units.length || !s.unit_id || units.includes(String(s.unit_id))) && isProfessionalAuthorizedForSector(professional, s.id))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
  }, [sectors, professional]);
  const sectorName = id => mySectors.find(s => String(s.id) === String(id))?.name || 'setor';

  const toggle = (key, value) => setForm(f => ({ ...f, [key]: f[key].includes(value) ? f[key].filter(v => v !== value) : [...f[key], value] }));

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const { data: row, error: readError } = await supabase.from('professionals').select('data').eq('id', professional.id).single();
      if (readError) throw readError;
      const data = row?.data && typeof row.data === 'object' ? row.data : {};
      const { error } = await supabase.from('professionals').update({ data: { ...data, preferences: sanitizePreferences(form) } }).eq('id', professional.id);
      if (error) throw error;
      await onSaved?.();
      setEditing(false);
      setMessage('Preferências salvas.');
    } catch (err) {
      setMessage(`Não foi possível salvar. ${err?.message || 'Tente novamente.'}`);
    } finally {
      setSaving(false);
    }
  };

  if (!linked) return null;

  const chip = (on) => `h-8 px-3 rounded-lg text-xs font-semibold border cursor-pointer ${on ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`;

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <SlidersHorizontal className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Minhas preferências</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {hasPreferences(saved) ? describePreferences(saved, sectorName) : 'Conte à coordenação o turno que prefere, os dias que não faz e os setores de interesse.'}
            </p>
          </div>
        </div>
        {!editing && <Button type="button" variant="outline" size="sm" onClick={() => { setForm(saved); setEditing(true); setMessage(''); }} className="shrink-0 h-8 text-xs">{hasPreferences(saved) ? 'Alterar' : 'Informar'}</Button>}
      </div>

      {editing && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Turno</p>
            <div className="flex flex-wrap gap-1.5">
              {PREFERRED_TURNS.map(t => <button key={t.id} type="button" aria-pressed={form.turn === t.id} onClick={() => setForm(f => ({ ...f, turn: t.id }))} className={chip(form.turn === t.id)}>{t.label}</button>)}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Dias em que não faço plantão</p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map(([day, label]) => <button key={day} type="button" aria-pressed={form.avoid_weekdays.includes(day)} onClick={() => toggle('avoid_weekdays', day)} className={chip(form.avoid_weekdays.includes(day))}>{label}</button>)}
            </div>
          </div>
          {mySectors.length > 1 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Setores em que quero mais plantões</p>
              <div className="flex flex-wrap gap-1.5">
                {mySectors.map(s => <button key={s.id} type="button" aria-pressed={form.interest_sector_ids.includes(String(s.id))} onClick={() => toggle('interest_sector_ids', String(s.id))} className={chip(form.interest_sector_ids.includes(String(s.id)))}>{s.name}</button>)}
              </div>
            </div>
          )}
          <p className="text-[11px] text-slate-500 dark:text-slate-400">É uma preferência, não um bloqueio: a coordenação ainda pode te escalar quando precisar. Para períodos em que você não pode (férias, congresso), use a indisponibilidade.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={saving} className="bg-sky-600 hover:bg-sky-500 text-white">{saving ? 'Salvando…' : 'Salvar preferências'}</Button>
          </div>
        </div>
      )}
      {message && <p className="text-xs text-slate-500 dark:text-slate-400" role="status">{message}</p>}
    </section>
  );
}
