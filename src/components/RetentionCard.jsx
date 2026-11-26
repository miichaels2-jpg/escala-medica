import { useEffect, useState } from 'react';
import { Percent } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppData } from '@/lib/useAppData';
import { safeFinancialNumber } from '@/lib/financialCalculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Retenção padrão do estabelecimento (company.data.default_retention_rate), V0.9.1. Vale para todos;
// quem tem percentual próprio no cadastro (Corpo Clínico) fica com o dele.
export default function RetentionCard() {
  const { company, syncGlobalData, isManager } = useAppData();
  const current = safeFinancialNumber(company?.data?.default_retention_rate, 0);
  const [value, setValue] = useState(current ? String(current) : '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { setValue(current ? String(current) : ''); }, [current]);

  const handleSave = async (event) => {
    event.preventDefault();
    const rate = value.trim() === '' ? 0 : Number(value.replace(',', '.'));
    if (!(rate >= 0 && rate <= 100)) {
      setMessage('Use um percentual entre 0 e 100.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const { data: row, error: readError } = await supabase.from('companies').select('data').eq('id', company.id).single();
      if (readError) throw readError;
      const data = { ...(row?.data || {}), default_retention_rate: rate };
      const { error } = await supabase.from('companies').update({ data }).eq('id', company.id);
      if (error) throw error;
      await syncGlobalData();
      setMessage(rate ? `Retenção de ${String(rate).replace('.', ',')}% salva.` : 'Sem retenção padrão.');
    } catch (err) {
      setMessage(`Não foi possível salvar. ${err?.message || ''}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
      <div>
        <h3 className="font-semibold text-lg text-slate-900 dark:text-white flex items-center gap-2"><Percent className="w-5 h-5 text-sky-600" /> Retenção padrão</h3>
        <p className="text-xs text-slate-500 mt-1">Percentual descontado do valor bruto de todos os profissionais no Faturamento, no recibo e no informe de rendimentos. Quem tem percentual próprio no cadastro (Corpo Clínico, passo Valores) fica com o dele.</p>
      </div>
      <label className="block max-w-xs text-xs font-medium text-slate-600 dark:text-slate-300 space-y-1">
        Retenção (%)
        <Input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={value} placeholder="0" onChange={e => setValue(e.target.value)} disabled={!isManager} className="h-10" />
      </label>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500" role="status">{message}</span>
        {isManager && <Button type="submit" disabled={saving} className="bg-sky-600 hover:bg-sky-500 text-white">{saving ? 'Salvando…' : 'Salvar retenção'}</Button>}
      </div>
    </form>
  );
}
