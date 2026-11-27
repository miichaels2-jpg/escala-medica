import { ShieldPlus } from 'lucide-react';
import { standbyDaysFor } from '@/lib/standby';
import { formatDateBR } from '@/lib/format';

// Próximos sobreavisos do plantonista (V0.10.3), na Minha Escala. Só aparece quando há algum.
export default function StandbyMine({ professional, company, sectors = [], units = [] }) {
  if (!professional?.id || professional.id === 'temp_user_id') return null;
  const days = standbyDaysFor(company, professional.id).slice(0, 8);
  if (!days.length) return null;
  const sectorName = id => sectors.find(s => String(s.id) === String(id))?.name || 'Setor';
  const unitName = id => units.find(u => String(u.id) === String(id))?.name || '';
  const weekday = date => new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-2">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2"><ShieldPlus className="w-5 h-5 text-amber-600" /> Meus sobreavisos</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400">Nesses dias você fica de reserva: se abrir uma vaga, a coordenação te chama primeiro e ela aparece no topo do seu Mural.</p>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {days.map(d => (
          <li key={`${d.date}-${d.sectorId}`} className="flex items-center justify-between gap-3 py-1.5 text-sm">
            <span className="tabular-nums font-medium text-slate-800 dark:text-slate-100">{formatDateBR(d.date)} <span className="text-xs font-normal text-slate-500">{weekday(d.date)}</span></span>
            <span className="truncate text-xs text-slate-600 dark:text-slate-300">{sectorName(d.sectorId)}{units.length > 1 && unitName(d.unitId) ? ` · ${unitName(d.unitId)}` : ''}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
