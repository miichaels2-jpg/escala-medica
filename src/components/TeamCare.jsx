// Painel › "Equipe": quem cobriu vaga de última hora (com botão de agradecer)
// e os aniversários da semana. Só aparece quando há algo para mostrar.
import { useMemo, useState } from 'react';
import { Cake, Check, HeartHandshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { recipientFor, sendNotifications } from '@/lib/notifications';
import { THANKED_TAG, recentUrgentCovers, withTag } from '@/lib/urgentVacancies';
import { firstName, hourLabel, upcomingBirthdays } from '@/lib/welcome';
import { autoHealingSaveShift, getShiftName } from '@/lib/escalaUtils';
import { formatDateBR } from '@/lib/format';

export default function TeamCare({ shifts = [], professionals = [], sectors = [], company, user, now = new Date(), onChanged }) {
  const [sending, setSending] = useState('');
  const [done, setDone] = useState(() => new Set());

  const covers = recentUrgentCovers(shifts, now).slice(0, 6);
  const birthdays = upcomingBirthdays(professionals, now, 7);
  const profById = useMemo(() => new Map(professionals.map(p => [String(p.id), p])), [professionals]);
  const sectorName = shift => sectors.find(s => String(s.id) === String(shift.sector_id))?.name || shift.sector_name || 'Setor';
  const sender = firstName(user?.full_name) || 'A coordenação';

  if (!covers.length && !birthdays.length) return null;

  const notify = async (key, prof, payload) => {
    setSending(key);
    try {
      const ok = await sendNotifications([{ ...recipientFor(prof), company_id: company?.id, ...payload }]);
      if (!ok) throw new Error('Não foi possível enviar agora. Tente de novo em instantes.');
      setDone(prev => new Set(prev).add(key));
      return true;
    } catch (error) {
      alert(error.message);
      return false;
    } finally {
      setSending('');
    }
  };

  const thank = async ({ shift }) => {
    const prof = profById.get(String(shift.professional_id)) || { id: shift.professional_id };
    const ok = await notify(`cobertura:${shift.id}`, prof, {
      unit_id: shift.unit_id,
      type: 'agradecimento',
      category: 'reconhecimento',
      title: 'Obrigado pela cobertura!',
      message: `${sender} agradeceu por você ter coberto o plantão de ${formatDateBR(shift.date)}, ${hourLabel(shift.start_time)}, no setor ${sectorName(shift)}.`,
      data: { shift_id: shift.id, date: shift.date },
      dedupe_key: `agradecimento:${shift.id}`
    });
    if (!ok) return;
    try {
      await autoHealingSaveShift(shift.id, { notes: withTag(shift.notes, THANKED_TAG) });
      await onChanged?.();
    } catch (error) {
      console.warn('Agradecimento enviado, mas a marca no plantão não foi gravada:', error?.message || error);
    }
  };

  const congratulate = person => notify(`aniversario:${person.id}`, profById.get(String(person.id)) || { id: person.id }, {
    type: 'aniversario',
    category: 'reconhecimento',
    title: 'Feliz aniversário!',
    message: `${sender} e a equipe desejam um ótimo dia para você.`,
    dedupe_key: `aniversario:${person.id}:${person.date}`
  });

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Equipe</h2>
      <div className={`mt-4 grid grid-cols-1 gap-6 ${covers.length && birthdays.length ? 'lg:grid-cols-2' : ''}`}>
        {covers.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <HeartHandshake className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" /> Cobriram vaga de última hora
            </h3>
            <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
              {covers.map(item => {
                const key = `cobertura:${item.shift.id}`;
                const thanked = item.thanked || done.has(key);
                return (
                  <li key={item.shift.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{profById.get(String(item.shift.professional_id))?.name || getShiftName(item.shift)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateBR(item.shift.date)} · {hourLabel(item.shift.start_time)} · {sectorName(item.shift)}</p>
                    </div>
                    {thanked ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 shrink-0"><Check className="w-3.5 h-3.5" aria-hidden="true" /> Agradecido</span>
                    ) : (
                      <Button size="sm" variant="outline" disabled={sending === key} onClick={() => thank(item)} className="h-8 rounded-lg text-xs shrink-0 cursor-pointer">
                        {sending === key ? 'Enviando…' : 'Agradecer'}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {birthdays.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <Cake className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" /> Aniversários da semana
            </h3>
            <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
              {birthdays.map(person => {
                const key = `aniversario:${person.id}`;
                const today = person.when === 'hoje';
                return (
                  <li key={person.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{person.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{today ? 'Hoje' : person.when.charAt(0).toUpperCase() + person.when.slice(1)}</p>
                    </div>
                    {today && (done.has(key) ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 shrink-0"><Check className="w-3.5 h-3.5" aria-hidden="true" /> Parabéns enviado</span>
                    ) : (
                      <Button size="sm" variant="outline" disabled={sending === key} onClick={() => congratulate(person)} className="h-8 rounded-lg text-xs shrink-0 cursor-pointer">
                        {sending === key ? 'Enviando…' : 'Dar parabéns'}
                      </Button>
                    ))}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
