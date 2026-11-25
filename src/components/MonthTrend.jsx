// Painel › "Como estamos indo": o mês atual comparado com o anterior e um
// calendário que mostra de relance os dias com vaga aberta ou furo.
import { useMemo } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { monthLabel, percentChange, plural, previousMonth, professionalFinder, summarizeMonth } from '@/lib/monthSummary';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const num = value => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value || 0);
const brl = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value || 0);

// Seta + texto; verde/vermelho só quando a mudança é boa ou ruim.
function Change({ value, unit, goodWhenUp, previousName }) {
  if (value === null) return <span className="text-slate-500 dark:text-slate-400">sem {previousName} para comparar</span>;
  if (value === 0) return <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400"><ArrowRight className="w-3.5 h-3.5" /> igual a {previousName}</span>;
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const tone = goodWhenUp === null ? 'text-slate-600 dark:text-slate-300' : up === goodWhenUp ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400';
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${tone}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />{up ? '+' : '−'}{num(Math.abs(value))}{unit} sobre {previousName}
    </span>
  );
}

export default function MonthTrend({ shifts = [], professionals = [], sectors = [], now = new Date(), onOpenDay }) {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const today = `${month}-${String(now.getDate()).padStart(2, '0')}`;
  const minute = Math.floor(now.getTime() / 60000);

  const { cur, prev } = useMemo(() => {
    const byId = new Map(sectors.map(s => [String(s.id), s.name]));
    const options = {
      shifts,
      getProf: professionalFinder(professionals),
      sectorName: s => byId.get(String(s.sector_id)) || s.sector_name || 'Setor',
      now: new Date(minute * 60000)
    };
    return { cur: summarizeMonth({ ...options, month }), prev: summarizeMonth({ ...options, month: previousMonth(month) }) };
  }, [shifts, professionals, sectors, month, minute]);

  const calendar = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const first = new Date(y, m - 1, 1).getDay();
    const count = new Date(y, m, 0).getDate();
    const byDate = new Map(cur.days.map(d => [d.date, d]));
    const cells = Array.from({ length: first }, () => null);
    for (let d = 1; d <= count; d += 1) {
      const date = `${month}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, date, ...(byDate.get(date) || { total: 0, vacant: 0, overdue: 0 }) });
    }
    return cells;
  }, [cur, month]);

  if (!cur.total && !prev.total) return null;

  const prevName = monthLabel(previousMonth(month), { withYear: false });
  const curName = monthLabel(month, { withYear: false });
  const hasPrev = prev.total > 0;
  const tiles = [
    {
      label: 'Cobertura do mês',
      value: cur.coverage === null ? '—' : `${num(cur.coverage)}%`,
      change: <Change value={hasPrev && cur.coverage !== null ? Math.round((cur.coverage - prev.coverage) * 10) / 10 : null} unit=" ponto(s)" goodWhenUp previousName={prevName} />
    },
    {
      label: 'Vagas sem profissional',
      value: num(cur.vacant),
      change: <Change value={hasPrev ? cur.vacant - prev.vacant : null} unit="" goodWhenUp={false} previousName={prevName} />
    },
    {
      label: 'Custo previsto do mês',
      value: brl(cur.cost),
      change: <Change value={hasPrev ? percentChange(cur.cost, prev.cost) : null} unit="%" goodWhenUp={null} previousName={prevName} />
    },
    {
      label: 'Horas de plantão',
      value: `${num(cur.hours)} h`,
      change: <Change value={hasPrev ? percentChange(cur.hours, prev.hours) : null} unit="%" goodWhenUp={null} previousName={prevName} />
    }
  ];

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Como estamos indo</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">{curName} comparado com {prevName} inteiro</span>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,22rem)] gap-6">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 content-start">
          {tiles.map(tile => (
            <div key={tile.label} className="min-w-0">
              <dt className="text-xs text-slate-500 dark:text-slate-400">{tile.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white truncate">{tile.value}</dd>
              <dd className="mt-0.5 text-xs leading-snug">{tile.change}</dd>
            </div>
          ))}
        </dl>

        <div>
          <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label={`Calendário de ${curName}`}>
            {WEEKDAYS.map(w => <div key={w} className="text-[11px] text-slate-500 dark:text-slate-400 pb-1">{w}</div>)}
            {calendar.map((cell, index) => {
              if (!cell) return <div key={`vazio-${index}`} />;
              const open = cell.vacant - cell.overdue;
              const state = cell.overdue > 0 ? 'furo' : open > 0 ? 'vaga' : cell.total > 0 ? 'ok' : 'sem';
              const style = {
                furo: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:border-rose-500/30',
                vaga: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30',
                ok: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700',
                sem: 'text-slate-400 border-dashed border-slate-200 dark:text-slate-600 dark:border-slate-800'
              }[state];
              const title = state === 'furo' ? plural(cell.overdue, 'furo', 'furos') : state === 'vaga' ? plural(open, 'vaga aberta', 'vagas abertas') : state === 'ok' ? `${plural(cell.total, 'plantão', 'plantões')}, com profissional` : 'sem plantão';
              const clickable = cell.vacant > 0 && onOpenDay;
              return (
                <button
                  key={cell.date}
                  type="button"
                  disabled={!clickable}
                  onClick={() => onOpenDay?.(cell.date)}
                  title={`${String(cell.day).padStart(2, '0')}/${month.slice(5, 7)}: ${title}`}
                  className={`h-10 rounded-lg border text-xs flex flex-col items-center justify-center leading-none ${style} ${cell.date === today ? 'ring-2 ring-sky-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-900' : ''} ${clickable ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}`}
                >
                  <span className="tabular-nums font-medium">{cell.day}</span>
                  {cell.vacant > 0 && <span className="mt-0.5 text-[10px] tabular-nums">{cell.vacant}</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-200 dark:bg-rose-500/40" /> furo</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-200 dark:bg-amber-500/40" /> vaga aberta</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-200 dark:bg-slate-700" /> preenchido</span>
            <span>número = vagas do dia</span>
          </p>
        </div>
      </div>
    </section>
  );
}
