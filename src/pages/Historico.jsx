import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppData } from '@/lib/useAppData';
import { describeAuditEntry, isInternalOnly } from '@/lib/auditLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const PERIODS = [
  { id: '1', label: 'Hoje', days: 1 },
  { id: '7', label: '7 dias', days: 7 },
  { id: '30', label: '30 dias', days: 30 }
];
const TYPES = [
  { id: 'todos', label: 'Tudo' },
  { id: 'shifts', label: 'Plantões' },
  { id: 'published_schedules', label: 'Publicações' },
  { id: 'payment_statuses', label: 'Pagamentos' },
  { id: 'shift_swaps', label: 'Trocas' }
];

function startOfPeriod(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString();
}

function dayLabel(iso) {
  const text = new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Histórico de alterações: quem criou, alocou, trocou, excluiu, publicou ou pagou, e quando.
export default function Historico() {
  const { company, units = [], appUsers = [], allCompanyProfessionals = [], allCompanySectors = [], selectedUnitId, allUnitsView, setUnitScope } = useAppData();
  const [period, setPeriod] = useState('7');
  const [type, setType] = useState('todos');
  const unitFilter = units.length > 1 && !allUnitsView ? String(selectedUnitId) : 'todas';
  const [search, setSearch] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    setError('');
    const days = PERIODS.find(p => p.id === period)?.days || 7;
    let query = supabase.from('audit_log').select('*')
      .eq('company_id', String(company.id))
      .gte('created_at', startOfPeriod(days))
      .order('created_at', { ascending: false })
      .limit(800);
    if (type !== 'todos') query = query.eq('table_name', type);
    const { data, error: loadError } = await query;
    if (loadError) setError(loadError.code === 'PGRST205' ? 'O histórico ainda não está disponível no banco.' : loadError.message);
    setEntries(data || []);
    setLoading(false);
  }, [company?.id, period, type]);

  useEffect(() => { load(); }, [load]);

  const ctx = useMemo(() => {
    const sectorsById = Object.fromEntries((allCompanySectors || []).map(s => [String(s.id), s.name]));
    const profsById = Object.fromEntries((allCompanyProfessionals || []).map(p => [String(p.id), p.name]));
    return {
      sectorName: id => sectorsById[String(id)],
      professionalName: id => profsById[String(id)]
    };
  }, [allCompanySectors, allCompanyProfessionals]);
  const userNameById = useMemo(() => Object.fromEntries((appUsers || []).map(u => [String(u.id), u.full_name || u.username || u.email])), [appUsers]);
  const unitNameById = useMemo(() => Object.fromEntries((units || []).map(u => [String(u.id), u.name])), [units]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries
      .filter(entry => !isInternalOnly(entry))
      .filter(entry => unitFilter === 'todas' || String(entry.unit_id) === unitFilter)
      .map(entry => ({
        ...entry,
        text: describeAuditEntry(entry, ctx),
        who: entry.changed_by ? (userNameById[String(entry.changed_by)] || 'Usuário removido') : 'Não identificado (versão anterior do app)'
      }))
      .filter(entry => !term || `${entry.text} ${entry.who}`.toLowerCase().includes(term));
  }, [entries, unitFilter, search, ctx, userNameById]);

  const groups = useMemo(() => {
    const list = [];
    rows.forEach(row => {
      const key = new Date(row.created_at).toDateString();
      const last = list[list.length - 1];
      if (last && last.key === key) last.items.push(row);
      else list.push({ key, label: dayLabel(row.created_at), items: [row] });
    });
    return list;
  }, [rows]);

  const chip = active => `h-8 px-3 rounded-lg text-xs font-medium cursor-pointer ${active ? 'bg-white dark:bg-slate-950 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`;

  return (
    <div className="min-h-full bg-slate-100 dark:bg-slate-950 p-4 md:p-8 space-y-5 text-slate-900 dark:text-slate-100">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><History className="w-6 h-6 text-slate-400" /> Histórico de alterações</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Quem criou, alocou, trocou, excluiu, publicou, aprovou troca ou marcou pagamento, e quando.</p>
        </div>
        <Button type="button" variant="outline" onClick={load} disabled={loading} className="h-9 gap-1.5">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-2">
        <div className="inline-flex w-fit rounded-xl bg-slate-200/70 dark:bg-slate-800 p-1" role="tablist" aria-label="Período">
          {PERIODS.map(p => <button key={p.id} type="button" role="tab" aria-selected={period === p.id} onClick={() => setPeriod(p.id)} className={chip(period === p.id)}>{p.label}</button>)}
        </div>
        <div className="inline-flex w-fit rounded-xl bg-slate-200/70 dark:bg-slate-800 p-1" role="tablist" aria-label="Tipo">
          {TYPES.map(o => <button key={o.id} type="button" role="tab" aria-selected={type === o.id} onClick={() => setType(o.id)} className={chip(type === o.id)}>{o.label}</button>)}
        </div>
        <div className="relative lg:ml-auto lg:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar profissional, setor ou autor" className="h-9 pl-9" />
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}

      {!error && !loading && groups.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Nenhuma alteração neste período. O histórico começou a ser registrado na versão V0.2.1.
        </p>
      )}

      <div className="space-y-5">
        {groups.map(group => (
          <section key={group.key}>
            <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{group.label}</h2>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              {group.items.map(row => (
                <li key={row.id} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 px-4 py-2.5">
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                    {new Date(row.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 dark:text-slate-100">{row.text}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {row.who}{units.length > 1 && unitNameById[String(row.unit_id)] ? ` · ${unitNameById[String(row.unit_id)]}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
