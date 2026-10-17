import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { Activity, AlertTriangle, CalendarDays, CheckCircle2, Clock, DollarSign, Maximize2, Minimize2, Users } from 'lucide-react';

// Paleta validada (scripts/validate_palette.js do skill de dataviz) nos dois modos:
// série 1 = azul, série 2 = laranja.
const PALETTE = {
  light: { s1: '#2a78d6', s2: '#eb6834', surface: '#ffffff', grid: '#e2e8f0', axis: '#64748b', text: '#0f172a', muted: '#475569' },
  dark: { s1: '#3987e5', s2: '#d95926', surface: '#1e293b', grid: '#334155', axis: '#94a3b8', text: '#f1f5f9', muted: '#cbd5e1' }
};

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function useIsDark() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

const brl = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value || 0);
const brlCompact = value => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
const num = value => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value || 0);

function ChartTooltip({ active, payload, label, colors, formatter = num, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{labelFormatter ? labelFormatter(label) : label}</p>
      {payload.map(item => (
        <div key={item.dataKey} className="flex items-center gap-2 text-sm">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: item.color || colors.s1 }} />
          <span className="font-bold text-slate-900 dark:text-white tabular-nums">{formatter(item.value)}</span>
          <span className="text-slate-500 dark:text-slate-400">{item.name}</span>
        </div>
      ))}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, detail, tone = 'default' }) {
  const toneClass = {
    default: 'text-slate-900 dark:text-white',
    good: 'text-emerald-700 dark:text-emerald-400',
    warn: 'text-amber-700 dark:text-amber-400',
    bad: 'text-rose-700 dark:text-rose-400'
  }[tone];
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
        <Icon className="w-4 h-4 text-slate-400" aria-hidden="true" />
      </div>
      <div className={`mt-2 text-2xl font-bold tracking-tight tabular-nums whitespace-nowrap ${toneClass}`}>{value}</div>
      {detail && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>}
    </div>
  );
}

function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm ${className}`}>
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function ManagementBI({
  shifts, isVacant, shiftCost, getShiftHours, isShiftPast, financialSummary, coverageRate,
  sectorMetrics, professionalMetrics, credentialAudit, periodLabel, hospitalName, filterSummary
}) {
  const isDark = useIsDark();
  const colors = isDark ? PALETTE.dark : PALETTE.light;
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const togglePresentation = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await containerRef.current?.requestFullscreen?.();
    } catch (error) {
      console.warn('Modo apresentação indisponível neste navegador:', error);
    }
  };

  const data = useMemo(() => {
    const byDate = new Map();
    const byWeekday = WEEKDAYS.map(day => ({ day, plantoes: 0 }));
    let day = 0, night = 0, overdueVacancies = 0, openVacancies = 0;

    shifts.forEach(shift => {
      const date = String(shift.date || '').slice(0, 10);
      if (!date) return;
      const row = byDate.get(date) || { date, preenchidos: 0, vagas: 0, custo: 0 };
      if (isVacant(shift)) {
        row.vagas += 1;
        if (isShiftPast(shift)) overdueVacancies += 1; else openVacancies += 1;
      } else {
        row.preenchidos += 1;
        row.custo += shiftCost(shift);
        const weekday = new Date(`${date}T12:00:00`).getDay();
        byWeekday[weekday].plantoes += 1;
        const startHour = Number(String(shift.start_time || '07:00').split(':')[0]);
        if (startHour >= 18 || startHour < 6) night += 1; else day += 1;
      }
      byDate.set(date, row);
    });

    let accumulated = 0;
    const daily = [...byDate.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(row => {
        accumulated += row.custo;
        return { ...row, acumulado: Math.round(accumulated * 100) / 100 };
      });

    return {
      daily,
      byWeekday,
      day,
      night,
      overdueVacancies,
      openVacancies,
      sectors: [...sectorMetrics].filter(s => s.cost > 0).sort((a, b) => b.cost - a.cost).slice(0, 8),
      topProfessionals: [...professionalMetrics].filter(p => p.hours > 0).sort((a, b) => b.hours - a.hours).slice(0, 8)
    };
  }, [shifts, isVacant, shiftCost, isShiftPast, sectorMetrics, professionalMetrics]);

  const filled = shifts.length - data.overdueVacancies - data.openVacancies;
  const dayLabel = date => {
    const [, m, d] = String(date).split('-');
    return `${d}/${m}`;
  };
  const axisProps = { tick: { fill: colors.axis, fontSize: 12 }, axisLine: { stroke: colors.grid }, tickLine: false };
  const shiftTotal = data.day + data.night;

  return (
    <div
      ref={containerRef}
      className={`space-y-4 ${isFullscreen ? 'bg-slate-50 dark:bg-slate-950 p-6 sm:p-10 overflow-y-auto' : ''}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        {isFullscreen ? (
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">Painel de gestão</p>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{hospitalName}</h2>
            <p className="text-base text-slate-500 dark:text-slate-400">{periodLabel} · {filterSummary}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">Visão consolidada do período filtrado. Use o modo apresentação para exibir em tela cheia em reuniões.</p>
        )}
        <button
          type="button"
          onClick={togglePresentation}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer self-start sm:self-auto"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          {isFullscreen ? 'Sair da apresentação' : 'Modo apresentação'}
        </button>
      </div>

      <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 ${isFullscreen ? "2xl:grid-cols-6" : ""}`}>
        <Kpi icon={CalendarDays} label="Plantões no período" value={num(shifts.length)} detail={`${num(filled)} preenchidos`} />
        <Kpi icon={CheckCircle2} label="Cobertura da escala" value={`${coverageRate}%`} detail="Meta: acima de 98%" tone={coverageRate >= 98 ? 'good' : coverageRate >= 90 ? 'warn' : 'bad'} />
        <Kpi icon={AlertTriangle} label="Vagas sem profissional" value={num(data.openVacancies + data.overdueVacancies)} detail={`${num(data.overdueVacancies)} já passaram (furo) · ${num(data.openVacancies)} futuras`} tone={data.overdueVacancies > 0 ? 'bad' : data.openVacancies > 0 ? 'warn' : 'good'} />
        <Kpi icon={DollarSign} label="Custo previsto" value={brl(financialSummary.totalCost)} detail={`${brl(financialSummary.executedCost)} já realizado`} />
        <Kpi icon={Clock} label="Horas assistenciais" value={`${num(financialSummary.hours)} h`} detail={`${num(data.day)} diurnos · ${num(data.night)} noturnos`} />
        <Kpi icon={Users} label="Credenciais vencidas" value={num(credentialAudit.expired)} detail={`${num(credentialAudit.nearExpiry)} vencem em 30 dias`} tone={credentialAudit.expired > 0 ? 'bad' : credentialAudit.nearExpiry > 0 ? 'warn' : 'good'} />
      </div>

      {shifts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
          <Activity className="w-8 h-8 mx-auto text-slate-400" />
          <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Nenhum plantão no período e filtros escolhidos.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ChartCard title="Cobertura diária da escala" subtitle="Plantões preenchidos e vagas sem profissional, por dia">
              <div className="h-64" role="img" aria-label="Gráfico de colunas empilhadas com plantões preenchidos e vagas por dia">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.daily} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barCategoryGap="25%">
                    <CartesianGrid vertical={false} stroke={colors.grid} />
                    <XAxis dataKey="date" tickFormatter={dayLabel} {...axisProps} minTickGap={12} />
                    <YAxis allowDecimals={false} {...axisProps} />
                    <Tooltip cursor={{ fill: colors.grid, opacity: 0.4 }} content={<ChartTooltip colors={colors} labelFormatter={dayLabel} />} />
                    <Legend iconType="rect" wrapperStyle={{ fontSize: 12 }} formatter={value => <span style={{ color: colors.muted }}>{value}</span>} />
                    <Bar dataKey="preenchidos" name="Preenchidos" stackId="a" fill={colors.s1} stroke={colors.surface} strokeWidth={2} maxBarSize={24} />
                    <Bar dataKey="vagas" name="Vagas" stackId="a" fill={colors.s2} stroke={colors.surface} strokeWidth={2} maxBarSize={24} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Custo acumulado no período" subtitle={`Plantões ocupados · total previsto ${brl(financialSummary.totalCost)}`}>
              <div className="h-64" role="img" aria-label="Gráfico de área com o custo acumulado ao longo do período">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.daily} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={colors.grid} />
                    <XAxis dataKey="date" tickFormatter={dayLabel} {...axisProps} minTickGap={12} />
                    <YAxis tickFormatter={brlCompact} {...axisProps} width={48} />
                    <Tooltip cursor={{ stroke: colors.axis, strokeWidth: 1 }} content={<ChartTooltip colors={colors} formatter={brl} labelFormatter={dayLabel} />} />
                    <Area type="monotone" dataKey="acumulado" name="Custo acumulado" stroke={colors.s1} strokeWidth={2} fill={colors.s1} fillOpacity={0.1} dot={false} activeDot={{ r: 5, stroke: colors.surface, strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ChartCard title="Custo por setor" subtitle="Os 8 setores de maior custo no período">
              <div className="h-72" role="img" aria-label="Gráfico de barras horizontais com o custo por setor">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.sectors} layout="vertical" margin={{ top: 0, right: 56, left: 8, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke={colors.grid} />
                    <XAxis type="number" tickFormatter={brlCompact} {...axisProps} />
                    <YAxis type="category" dataKey="name" width={120} {...axisProps} />
                    <Tooltip cursor={{ fill: colors.grid, opacity: 0.4 }} content={<ChartTooltip colors={colors} formatter={brl} />} />
                    <Bar dataKey="cost" name="Custo" fill={colors.s1} maxBarSize={24} radius={[0, 4, 4, 0]}
                      label={{ position: 'right', fill: colors.muted, fontSize: 12, formatter: brlCompact }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Profissionais com mais horas" subtitle="Os 8 profissionais com maior carga no período">
              <div className="h-72" role="img" aria-label="Gráfico de barras horizontais com as horas por profissional">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.topProfessionals} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke={colors.grid} />
                    <XAxis type="number" {...axisProps} />
                    <YAxis type="category" dataKey="name" width={140} {...axisProps} />
                    <Tooltip cursor={{ fill: colors.grid, opacity: 0.4 }} content={<ChartTooltip colors={colors} formatter={value => `${num(value)} h`} />} />
                    <Bar dataKey="hours" name="Horas" fill={colors.s1} maxBarSize={24} radius={[0, 4, 4, 0]}
                      label={{ position: 'right', fill: colors.muted, fontSize: 12, formatter: value => `${num(value)}h` }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <ChartCard title="Plantões por dia da semana" subtitle="Plantões ocupados" className="xl:col-span-2">
              <div className="h-56" role="img" aria-label="Gráfico de colunas com os plantões por dia da semana">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byWeekday} margin={{ top: 16, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={colors.grid} />
                    <XAxis dataKey="day" {...axisProps} />
                    <YAxis allowDecimals={false} {...axisProps} />
                    <Tooltip cursor={{ fill: colors.grid, opacity: 0.4 }} content={<ChartTooltip colors={colors} />} />
                    <Bar dataKey="plantoes" name="Plantões" fill={colors.s1} maxBarSize={24} radius={[4, 4, 0, 0]}
                      label={{ position: 'top', fill: colors.muted, fontSize: 12 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Diurno × noturno" subtitle="Divisão dos plantões ocupados">
              <div className="space-y-4">
                <div className="flex h-6 w-full overflow-hidden rounded-md gap-0.5" role="img" aria-label={`${data.day} plantões diurnos e ${data.night} noturnos`}>
                  {data.day > 0 && <div style={{ width: `${(data.day / Math.max(1, shiftTotal)) * 100}%`, background: colors.s1 }} />}
                  {data.night > 0 && <div style={{ width: `${(data.night / Math.max(1, shiftTotal)) * 100}%`, background: colors.s2 }} />}
                </div>
                <dl className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><span className="w-3 h-3 rounded-sm" style={{ background: colors.s1 }} /> Diurnos</dt>
                    <dd className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{num(data.day)}</dd>
                    <dd className="text-xs text-slate-500 dark:text-slate-400">{shiftTotal ? Math.round((data.day / shiftTotal) * 100) : 0}% dos plantões</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><span className="w-3 h-3 rounded-sm" style={{ background: colors.s2 }} /> Noturnos</dt>
                    <dd className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{num(data.night)}</dd>
                    <dd className="text-xs text-slate-500 dark:text-slate-400">{shiftTotal ? Math.round((data.night / shiftTotal) * 100) : 0}% dos plantões</dd>
                  </div>
                </dl>
                {financialSummary.payrollWithoutShifts > 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                    Folha mensal sem plantão no período: <b className="text-slate-900 dark:text-white">{brl(financialSummary.payrollWithoutShifts)}</b>
                  </p>
                )}
              </div>
            </ChartCard>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Os números detalhados de cada gráfico estão nas abas Plantões, Setores, Produtividade e Financeiro, com exportação para Excel.
          </p>
        </>
      )}
    </div>
  );
}
