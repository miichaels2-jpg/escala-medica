// TEMPORÁRIO — ver src/lib/roadmap.js para remover quando o acompanhamento acabar.
import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Clock3, Lightbulb } from 'lucide-react';
import { ROADMAP_GROUPS, ROADMAP_UPDATED_AT } from '@/lib/roadmap';
import { APP_VERSION } from '@/lib/version';

const STATUS = {
  entregue: { label: 'Entregue', icon: CheckCircle2, chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300', iconColor: 'text-emerald-600 dark:text-emerald-400' },
  em_andamento: { label: 'Em andamento', icon: Clock3, chip: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300', iconColor: 'text-sky-600 dark:text-sky-400' },
  planejado: { label: 'Planejado', icon: Circle, chip: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', iconColor: 'text-slate-400' },
  ideia: { label: 'Ideia', icon: Lightbulb, chip: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300', iconColor: 'text-amber-500' }
};

const FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'entregue', label: 'Entregues' },
  { id: 'em_andamento', label: 'Em andamento' },
  { id: 'planejado', label: 'Planejados' },
  { id: 'ideia', label: 'Ideias' }
];

export default function Planejamento() {
  const [filter, setFilter] = useState('todos');
  const allItems = useMemo(() => ROADMAP_GROUPS.flatMap(group => group.items), []);
  const counts = useMemo(() => allItems.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {}), [allItems]);
  const delivered = counts.entregue || 0;

  return (
    <div className="min-h-full bg-slate-100 dark:bg-slate-950 p-4 md:p-8 space-y-6 text-slate-900 dark:text-slate-100">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Temporário · some quando terminarmos</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Planejamento de melhorias</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {delivered} de {allItems.length} entregues · versão atual {APP_VERSION} · atualizado em {ROADMAP_UPDATED_AT.split('-').reverse().join('/')}
        </p>
        <div className="mt-3 h-2 w-full max-w-md rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden" aria-hidden="true">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((delivered / Math.max(1, allItems.length)) * 100)}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 w-fit" role="tablist">
        {FILTERS.map(f => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
            className={`h-8 px-3 rounded-xl text-sm cursor-pointer ${filter === f.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            {f.label}{f.id !== 'todos' && counts[f.id] ? ` (${counts[f.id]})` : ''}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {ROADMAP_GROUPS.map(group => {
          const items = group.items.filter(item => filter === 'todos' || item.status === filter);
          if (items.length === 0) return null;
          return (
            <section key={group.title} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <h2 className="px-4 py-3 text-sm font-semibold border-b border-slate-100 dark:border-slate-800">{group.title}</h2>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map(item => {
                  const status = STATUS[item.status] || STATUS.ideia;
                  const Icon = status.icon;
                  return (
                    <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${status.iconColor}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{item.id}. {item.title}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.chip}`}>
                            {status.label}{item.version ? ` · ${item.version}` : ''}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{item.detail}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
