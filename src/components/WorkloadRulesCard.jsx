import { useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppData } from '@/lib/useAppData';
import { getWorkloadRules } from '@/lib/workload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Limites usados nos avisos de carga horária da escala (company.data.workload_rules).
export default function WorkloadRulesCard() {
  const { company, syncGlobalData, isManager } = useAppData();
  const current = getWorkloadRules(company);
  const [form, setForm] = useState({ max_weekly_hours: String(current.max_weekly_hours), max_continuous_hours: String(current.max_continuous_hours) });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setForm({ max_weekly_hours: String(current.max_weekly_hours), max_continuous_hours: String(current.max_continuous_hours) });
  }, [current.max_weekly_hours, current.max_continuous_hours]);

  const handleSave = async (event) => {
    event.preventDefault();
    const weekly = Number(form.max_weekly_hours);
    const continuous = Number(form.max_continuous_hours);
    if (!(weekly >= 12 && weekly <= 168) || !(continuous >= 6 && continuous <= 72)) {
      setMessage('Use entre 12 e 168 h por semana e entre 6 e 72 h seguidas.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const { data: row, error: readError } = await supabase.from('companies').select('data').eq('id', company.id).single();
      if (readError) throw readError;
      const data = { ...(row?.data || {}), workload_rules: { max_weekly_hours: weekly, max_continuous_hours: continuous } };
      const { error } = await supabase.from('companies').update({ data }).eq('id', company.id);
      if (error) throw error;
      await syncGlobalData();
      setMessage('Limites salvos.');
    } catch (err) {
      setMessage(`Não foi possível salvar. ${err?.message || ''}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] p-6 shadow-sm space-y-4">
      <div>
        <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2"><Gauge className="w-5 h-5 text-sky-600" /> Limite de carga horária</h3>
        <p className="text-xs text-slate-500 mt-1">Ao alocar alguém acima desses limites, a escala avisa e pede confirmação. O preenchimento automático não ultrapassa os limites.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 space-y-1">
          Máximo de horas por semana (seg a dom)
          <Input type="number" min="12" max="168" value={form.max_weekly_hours} onChange={e => setForm(f => ({ ...f, max_weekly_hours: e.target.value }))} disabled={!isManager} className="h-10" />
        </label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 space-y-1">
          Máximo de horas seguidas, sem descanso
          <Input type="number" min="6" max="72" value={form.max_continuous_hours} onChange={e => setForm(f => ({ ...f, max_continuous_hours: e.target.value }))} disabled={!isManager} className="h-10" />
        </label>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500" role="status">{message}</span>
        {isManager && <Button type="submit" disabled={saving} className="bg-sky-600 hover:bg-sky-500 text-white">{saving ? 'Salvando…' : 'Salvar limites'}</Button>}
      </div>
    </form>
  );
}
