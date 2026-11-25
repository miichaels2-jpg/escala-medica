// Apresentação do mês para a diretoria: slides em tela cheia (setas do teclado),
// sempre comparando com o mês anterior, e PDF com um slide por página.
import { cloneElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight, FileDown, X } from 'lucide-react';
import { BrandAppIcon } from '@/components/BrandMark';
import { getCompanyLogoUrl, getUnitLogoUrl } from '@/lib/printBranding';
import {
  buildHighlights, monthLabel, nextMonth, percentChange, plural, previousMonth, professionalFinder, summarizeMonth
} from '@/lib/monthSummary';

// Mesma paleta validada do BI (azul = mês atual, laranja = vagas); o mês anterior fica em cinza neutro.
const PALETTE = {
  light: { s1: '#2a78d6', s2: '#eb6834', prev: '#94a3b8', surface: '#ffffff', grid: '#e2e8f0', axis: '#64748b', muted: '#475569' },
  dark: { s1: '#3987e5', s2: '#d95926', prev: '#64748b', surface: '#0f172a', grid: '#334155', axis: '#94a3b8', muted: '#cbd5e1' }
};

const num = value => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value || 0);
const brl = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value || 0);
const brlCompact = value => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);
const dayLabel = date => `${String(date).slice(8, 10)}/${String(date).slice(5, 7)}`;

// No PDF cada slide tem tamanho fixo (A4 deitado); na tela o gráfico acompanha a janela.
const PRINT_SIZE = { width: 1123, height: 794 };

function Fit({ print, width, height, children }) {
  if (print) return cloneElement(children, { width, height });
  return <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>;
}

// "↑ 3 pontos sobre outubro": seta e texto, cor só quando é bom ou ruim
// (goodWhenUp = null: custo e horas, que não são bons nem ruins por si).
function Delta({ value, unit = '%', goodWhenUp = true, previousName }) {
  if (value === null || value === undefined) return <p className="text-base text-slate-500 dark:text-slate-400">Sem {previousName} para comparar</p>;
  if (value === 0) return <p className="flex items-center gap-1.5 text-base text-slate-600 dark:text-slate-300"><ArrowRight className="w-5 h-5" /> Igual a {previousName}</p>;
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const tone = goodWhenUp === null ? 'text-slate-700 dark:text-slate-200' : up === goodWhenUp ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400';
  return (
    <p className={`flex items-center gap-1.5 text-base font-medium ${tone}`}>
      <Icon className="w-5 h-5" aria-hidden="true" />
      {up ? '+' : '−'}{num(Math.abs(value))}{unit} sobre {previousName}
    </p>
  );
}

function Big({ label, value, children }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-5xl sm:text-6xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">{value}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ChartTooltip({ active, payload, label, formatter = num, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 shadow-sm">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{labelFormatter ? labelFormatter(label) : label}</p>
      {payload.map(item => (
        <div key={item.dataKey} className="flex items-center gap-2 text-sm">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: item.color }} />
          <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{formatter(item.value)}</span>
          <span className="text-slate-500 dark:text-slate-400">{item.name}</span>
        </div>
      ))}
    </div>
  );
}

// Legenda em HTML acima do gráfico (a do recharts cai em cima do eixo no PDF).
function ChartLegend({ items }) {
  return (
    <p className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
      {items.map(item => (
        <span key={item.label} className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: item.color }} /> {item.label}</span>
      ))}
    </p>
  );
}

// Barra horizontal simples em HTML (lista de setores/profissionais): imprime igual à tela.
function BarRow({ label, value, max, text, color }) {
  return (
    <li className="grid grid-cols-[minmax(0,10rem)_1fr_auto] sm:grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-3 py-1.5">
      <span className="truncate text-base text-slate-800 dark:text-slate-100">{label}</span>
      <span className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <span className="block h-full rounded-full" style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%`, background: color }} />
      </span>
      <span className="text-base font-semibold tabular-nums text-slate-900 dark:text-white">{text}</span>
    </li>
  );
}

function Slide({ index, total, title, kicker, footer, print, children }) {
  return (
    <section
      className={`board-slide flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-white ${print ? 'p-12' : 'h-full p-6 sm:p-10 lg:p-14'}`}
      style={print ? PRINT_SIZE : undefined}
      aria-label={`Slide ${index + 1} de ${total}: ${title}`}
    >
      {kicker && <p className="text-sm font-semibold text-sky-700 dark:text-sky-400">{kicker}</p>}
      <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h2>
      <div className="flex-1 min-h-0 mt-6 sm:mt-8">{children}</div>
      <footer className="mt-6 flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-2"><BrandAppIcon size={16} /> {footer}</span>
        <span className="tabular-nums">{index + 1} / {total}</span>
      </footer>
    </section>
  );
}

function useIsDark() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

export default function BoardPresentation({ open, onClose, shifts = [], professionals = [], sectors = [], company, unit, hospitalName, scopeLabel }) {
  const isDark = useIsDark();
  const rootRef = useRef(null);
  const [slide, setSlide] = useState(0);
  const [printing, setPrinting] = useState(false);

  // Meses com plantão, do mais recente para o mais antigo.
  const months = useMemo(() => {
    const set = new Set(shifts.map(s => String(s?.date || '').slice(0, 7)).filter(m => /^\d{4}-\d{2}$/.test(m)));
    return [...set].sort().reverse();
  }, [shifts]);

  // Padrão: o mês atual; no começo do mês, ou se ele ainda tem menos da metade
  // dos plantões do anterior, o mês que acabou de fechar.
  const defaultMonth = useMemo(() => {
    const today = new Date();
    const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const prev = previousMonth(current);
    const count = m => shifts.filter(s => String(s?.date || '').startsWith(m)).length;
    if (months.includes(prev) && (today.getDate() <= 10 || count(current) < count(prev) / 2)) return prev;
    return months.includes(current) ? current : months[0] || current;
  }, [months, shifts]);
  const [month, setMonth] = useState(defaultMonth);
  useEffect(() => { if (open) { setMonth(defaultMonth); setSlide(0); } }, [open, defaultMonth]);

  const sectorName = useMemo(() => {
    const byId = new Map(sectors.map(s => [String(s.id), s.name]));
    return s => byId.get(String(s.sector_id)) || s.sector_name || 'Setor não informado';
  }, [sectors]);
  const getProf = useMemo(() => professionalFinder(professionals), [professionals]);

  const data = useMemo(() => {
    const options = { shifts, getProf, sectorName };
    const cur = summarizeMonth({ ...options, month });
    const prev = summarizeMonth({ ...options, month: previousMonth(month) });
    const next = summarizeMonth({ ...options, month: nextMonth(month) });
    return { cur, prev, next };
  }, [shifts, getProf, sectorName, month]);

  const { cur, prev, next } = data;
  const curName = monthLabel(month, { withYear: false });
  const prevName = monthLabel(previousMonth(month), { withYear: false });
  const nextName = monthLabel(nextMonth(month), { withYear: false });
  const colors = isDark && !printing ? PALETTE.dark : PALETTE.light;
  const axisProps = { tick: { fill: colors.axis, fontSize: 13 }, axisLine: { stroke: colors.grid }, tickLine: false };
  const footer = `${hospitalName} · ${capitalize(monthLabel(month))}`;
  const logos = [...new Set([getCompanyLogoUrl(company), getUnitLogoUrl(unit)].filter(Boolean))];

  const coverageDiff = cur.coverage !== null && prev.coverage !== null ? Math.round((cur.coverage - prev.coverage) * 10) / 10 : null;
  const sectorCompare = useMemo(() => {
    const prevByName = new Map(prev.sectors.map(s => [s.name, s]));
    return cur.sectors.filter(s => s.cost > 0 || prevByName.get(s.name)?.cost > 0).slice(0, 6)
      .map(s => ({ name: s.name, atual: Math.round(s.cost), anterior: Math.round(prevByName.get(s.name)?.cost || 0) }));
  }, [cur, prev]);
  const sectorChartHeight = Math.min(470, 90 + sectorCompare.length * 64);
  const vacancySectors = cur.sectors.filter(s => s.vacant > 0).sort((a, b) => b.vacant - a.vacant).slice(0, 6);
  const topPeople = cur.professionals.slice(0, 6);
  const shiftsSplit = cur.day + cur.night;

  const renderSlides = print => {
    // No PDF a página não chega à largura de tela grande: as duas colunas são fixas.
    const twoCols = print ? 'h-full grid grid-cols-[18rem_1fr] gap-8' : 'h-full grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-8';
    const slides = [
      {
        title: capitalize(monthLabel(month)),
        kicker: 'Resultado da escala',
        body: (
          <div className="h-full flex flex-col justify-between gap-8">
            <div>
              {logos.length > 0 && (
                <div className="flex items-center gap-6 mb-6">
                  {logos.map(src => <img key={src} src={src} alt="" className="h-16 max-w-[220px] object-contain" />)}
                </div>
              )}
              <p className="text-2xl text-slate-700 dark:text-slate-200">{hospitalName}</p>
              {scopeLabel && <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">{scopeLabel}</p>}
              <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">Comparado com {prevName}</p>
            </div>
            <div className={print ? 'grid grid-cols-3 gap-6' : 'grid grid-cols-1 sm:grid-cols-3 gap-6'}>
              <Big label="Cobertura da escala" value={cur.coverage === null ? '—' : `${num(cur.coverage)}%`}><Delta value={coverageDiff} unit=" ponto(s)" previousName={prevName} /></Big>
              <Big label="Plantões" value={num(cur.total)}><p className="text-base text-slate-500 dark:text-slate-400">{plural(cur.filled, 'preenchido', 'preenchidos')}</p></Big>
              <Big label="Custo estimado" value={brl(cur.cost)}><Delta value={percentChange(cur.cost, prev.cost)} goodWhenUp={null} previousName={prevName} /></Big>
            </div>
          </div>
        )
      },
      {
        title: 'Cobertura da escala',
        kicker: `${num(cur.filled)} de ${plural(cur.total, 'plantão', 'plantões')} com profissional`,
        body: (
          <div className={twoCols}>
            <div className="space-y-6">
              <Big label={`Em ${curName}`} value={cur.coverage === null ? '—' : `${num(cur.coverage)}%`}><Delta value={coverageDiff} unit=" ponto(s)" previousName={prevName} /></Big>
              <p className="text-base text-slate-600 dark:text-slate-300">Meta: acima de 98%. Em {prevName}: {prev.coverage === null ? 'sem plantões' : `${num(prev.coverage)}%`}.</p>
            </div>
            <div className="flex flex-col gap-2 min-h-[16rem]" style={print ? { height: 470 } : undefined}>
             <ChartLegend items={[{ label: 'Preenchidos', color: colors.s1 }, { label: 'Vagas', color: colors.s2 }]} />
             <div className="flex-1 min-h-0" role="img" aria-label="Colunas empilhadas: plantões preenchidos e vagas por dia">
              <Fit print={print} width={700} height={440}>
                <BarChart data={cur.days} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barCategoryGap="20%">
                  <CartesianGrid vertical={false} stroke={colors.grid} />
                  <XAxis dataKey="date" tickFormatter={dayLabel} {...axisProps} minTickGap={10} />
                  <YAxis allowDecimals={false} {...axisProps} />
                  {!print && <Tooltip cursor={{ fill: colors.grid, opacity: 0.4 }} content={<ChartTooltip labelFormatter={dayLabel} />} />}
                  <Bar dataKey="filled" name="Preenchidos" stackId="a" fill={colors.s1} stroke={colors.surface} strokeWidth={2} maxBarSize={28} radius={[4, 4, 0, 0]} isAnimationActive={!print} />
                  <Bar dataKey="vacant" name="Vagas" stackId="a" fill={colors.s2} stroke={colors.surface} strokeWidth={2} maxBarSize={28} radius={[4, 4, 0, 0]} isAnimationActive={!print} />
                </BarChart>
              </Fit>
             </div>
            </div>
          </div>
        )
      },
      {
        title: 'Vagas e furos',
        kicker: 'Furo é o plantão que passou sem ninguém',
        body: (
          <div className={twoCols}>
            <div className="space-y-6">
              <Big label="Furos" value={num(cur.overdue)}><Delta value={prev.total ? cur.overdue - prev.overdue : null} unit="" goodWhenUp={false} previousName={prevName} /></Big>
              <Big label="Vagas ainda abertas" value={num(cur.vacant - cur.overdue)}><p className="text-base text-slate-500 dark:text-slate-400">dá para preencher</p></Big>
            </div>
            {vacancySectors.length === 0 ? (
              <div className="flex items-center gap-4 self-start rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="text-2xl font-semibold">Escala toda preenchida</p>
                  <p className="mt-1 text-base text-slate-500 dark:text-slate-400">Nenhum plantão de {curName} ficou sem profissional.</p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-base font-semibold text-slate-700 dark:text-slate-200">Onde faltou gente</p>
                <ul className="mt-3">
                  {vacancySectors.map(s => (
                    <BarRow key={s.name} label={s.name} value={s.vacant} max={vacancySectors[0].vacant} color={colors.s2}
                      text={`${plural(s.vacant, 'vaga', 'vagas')}${s.overdue ? ` · ${plural(s.overdue, 'furo', 'furos')}` : ''}`} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      },
      {
        title: 'Custo da escala',
        kicker: 'Estimado pela tabela de valores de cada profissional',
        body: (
          <div className={twoCols}>
            <div className="space-y-6">
              <Big label={`Em ${curName}`} value={brl(cur.cost)}><Delta value={percentChange(cur.cost, prev.cost)} goodWhenUp={null} previousName={prevName} /></Big>
              <p className="text-base text-slate-600 dark:text-slate-300">
                {cur.filled ? `${brl(cur.cost / cur.filled)} por plantão, em média.` : ''} Em {prevName}: {brl(prev.cost)}.
              </p>
              {(cur.pendingProduction > 0 || cur.missingRate > 0) && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {cur.pendingProduction > 0 && `${plural(cur.pendingProduction, 'plantão por produtividade entra', 'plantões por produtividade entram')} só no fechamento. `}
                  {cur.missingRate > 0 && `${plural(cur.missingRate, 'plantão', 'plantões')} sem valor cadastrado.`}
                </p>
              )}
            </div>
            {sectorCompare.length === 0 ? (
              <p className="self-center text-lg text-slate-500 dark:text-slate-400">Sem valores cadastrados para estimar o custo.</p>
            ) : (
              <div className="flex flex-col gap-2">
               <ChartLegend items={[{ label: capitalize(prevName), color: colors.prev }, { label: capitalize(curName), color: colors.s1 }]} />
               <div style={{ height: sectorChartHeight }} role="img" aria-label={`Barras por setor: custo de ${prevName} e de ${curName}`}>
                <Fit print={print} width={700} height={sectorChartHeight}>
                  <BarChart data={sectorCompare} layout="vertical" margin={{ top: 0, right: 64, left: 8, bottom: 0 }} barGap={2}>
                    <CartesianGrid horizontal={false} stroke={colors.grid} />
                    <XAxis type="number" tickFormatter={brlCompact} {...axisProps} />
                    <YAxis type="category" dataKey="name" width={150} {...axisProps} />
                    {!print && <Tooltip cursor={{ fill: colors.grid, opacity: 0.4 }} content={<ChartTooltip formatter={brl} />} />}
                    <Bar dataKey="anterior" name={capitalize(prevName)} fill={colors.prev} maxBarSize={18} radius={[0, 4, 4, 0]} isAnimationActive={!print} />
                    <Bar dataKey="atual" name={capitalize(curName)} fill={colors.s1} maxBarSize={18} radius={[0, 4, 4, 0]} isAnimationActive={!print}
                      label={{ position: 'right', fill: colors.muted, fontSize: 13, formatter: brlCompact }} />
                  </BarChart>
                </Fit>
               </div>
              </div>
            )}
          </div>
        )
      },
      {
        title: 'Equipe',
        kicker: `${plural(cur.professionals.length, 'profissional', 'profissionais')} de plantão em ${curName}`,
        body: (
          <div className={twoCols}>
            <div className="space-y-6">
              <Big label="Horas de plantão" value={`${num(cur.hours)} h`}><Delta value={percentChange(cur.hours, prev.hours)} goodWhenUp={null} previousName={prevName} /></Big>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Diurno × noturno</p>
                <div className="mt-2 flex h-4 w-full overflow-hidden rounded-md gap-0.5" role="img" aria-label={`${cur.day} diurnos e ${cur.night} noturnos`}>
                  {cur.day > 0 && <div style={{ width: `${(cur.day / Math.max(1, shiftsSplit)) * 100}%`, background: colors.s1 }} />}
                  {cur.night > 0 && <div style={{ width: `${(cur.night / Math.max(1, shiftsSplit)) * 100}%`, background: colors.s2 }} />}
                </div>
                <p className="mt-2 flex flex-wrap gap-x-4 text-base text-slate-700 dark:text-slate-200">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: colors.s1 }} /> {num(cur.day)} diurnos</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: colors.s2 }} /> {num(cur.night)} noturnos</span>
                </p>
              </div>
            </div>
            <div>
              <p className="text-base font-semibold text-slate-700 dark:text-slate-200">Quem mais esteve de plantão</p>
              {topPeople.length === 0 ? <p className="mt-3 text-base text-slate-500">Nenhum plantão preenchido.</p> : (
                <ul className="mt-3">
                  {topPeople.map(p => (
                    <BarRow key={p.name} label={p.name} value={p.hours} max={topPeople[0].hours} color={colors.s1}
                      text={`${num(p.hours)} h · ${plural(p.shifts, 'plantão', 'plantões')}`} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )
      },
      {
        title: 'Resumo e próximo mês',
        kicker: 'Para levar da reunião',
        body: (
          <div className={print ? 'h-full grid grid-cols-[1fr_22rem] gap-8' : 'h-full grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-8'}>
            <ul className="space-y-4">
              {buildHighlights(cur, prev, { previousName: prevName }).map(text => (
                <li key={text} className="flex gap-3 text-xl leading-snug text-slate-800 dark:text-slate-100">
                  <span className="mt-2.5 w-2 h-2 rounded-full bg-sky-600 shrink-0" aria-hidden="true" /> {text}
                </li>
              ))}
            </ul>
            <div className="self-start rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{capitalize(nextName)}</p>
              {next.total === 0 ? (
                <p className="mt-2 text-lg text-slate-700 dark:text-slate-200">A escala ainda não foi lançada.</p>
              ) : (
                <>
                  <p className="mt-1 text-4xl font-semibold tabular-nums">{num(next.coverage)}%</p>
                  <p className="text-base text-slate-600 dark:text-slate-300">de cobertura até agora</p>
                  <p className="mt-3 text-base text-slate-700 dark:text-slate-200">{plural(next.total, 'plantão lançado', 'plantões lançados')} · <b>{plural(next.vacant, 'vaga aberta', 'vagas abertas')}</b></p>
                </>
              )}
            </div>
          </div>
        )
      }
    ];
    return slides.map((s, index) => (
      <Slide key={s.title} index={index} total={slides.length} title={s.title} kicker={s.kicker} footer={footer} print={print}>{s.body}</Slide>
    ));
  };

  const SLIDE_COUNT = 6;
  const go = useCallback(step => setSlide(current => Math.min(SLIDE_COUNT - 1, Math.max(0, current + step))), []);

  const close = useCallback(async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* o navegador já saiu */ }
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    rootRef.current?.requestFullscreen?.().catch(() => {});
    const onKey = event => {
      if (event.target?.closest?.('select')) return;
      if (['ArrowRight', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); go(1); }
      if (['ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); go(-1); }
      if (event.key === 'Escape' && !document.fullscreenElement) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, go, close]);

  // PDF: mostra todos os slides no claro, imprime e volta como estava.
  useEffect(() => {
    if (!printing) return undefined;
    const html = document.documentElement;
    const wasDark = html.classList.contains('dark');
    html.classList.remove('dark');
    const previousTitle = document.title;
    document.title = `Apresentação - ${hospitalName} - ${capitalize(monthLabel(month))}`;
    const finish = () => {
      if (wasDark) html.classList.add('dark');
      document.title = previousTitle;
      setPrinting(false);
    };
    window.addEventListener('afterprint', finish, { once: true });
    const timer = setTimeout(() => window.print(), 400);
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', finish); };
  }, [printing, hospitalName, month]);

  if (!open) return null;

  return createPortal(
    <div ref={rootRef} className="board-root fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-slate-950" role="dialog" aria-modal="true" aria-label="Apresentação do mês">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          html, body { background: #fff !important; }
          body > *:not(.board-root) { display: none !important; }
          .board-root { position: static !important; display: block !important; }
          .board-controls, .board-screen { display: none !important; }
          .board-print { display: block !important; }
          .board-print .board-slide { break-after: page; page-break-after: always; overflow: hidden; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="board-controls flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <label htmlFor="board-month" className="text-sm text-slate-500 dark:text-slate-400">Mês</label>
          <select id="board-month" value={month} onChange={e => { setMonth(e.target.value); setSlide(0); }}
            className="h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-sm text-slate-900 dark:text-white cursor-pointer">
            {(months.includes(month) ? months : [month, ...months]).map(m => <option key={m} value={m}>{capitalize(monthLabel(m))}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go(-1)} disabled={slide === 0} aria-label="Slide anterior"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"><ChevronLeft className="w-5 h-5" /></button>
          <span className="w-14 text-center text-sm tabular-nums text-slate-600 dark:text-slate-300">{slide + 1} / {SLIDE_COUNT}</span>
          <button type="button" onClick={() => go(1)} disabled={slide === SLIDE_COUNT - 1} aria-label="Próximo slide"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"><ChevronRight className="w-5 h-5" /></button>
          <button type="button" onClick={() => setPrinting(true)} disabled={printing}
            className="ml-2 h-9 px-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          <button type="button" onClick={close} aria-label="Fechar apresentação"
            className="ml-1 h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="board-screen flex-1 min-h-0 overflow-y-auto">
        {renderSlides(false)[slide]}
      </div>

      {printing && <div className="board-print hidden">{renderSlides(true)}</div>}
    </div>,
    document.body
  );
}
