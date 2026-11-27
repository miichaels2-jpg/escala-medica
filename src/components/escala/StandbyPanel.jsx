import { useState } from 'react';
import { BellRing, ShieldPlus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getStandby, withStandby } from '@/lib/standby';
import { isProfessionalAuthorizedForSector, getProfessionalUnitIds } from '@/lib/sectorAccess';
import { recipientFor, sendNotifications } from '@/lib/notifications';
import { formatDateBR } from '@/lib/format';
import { getShiftSpecialty, specialtyMatches } from '@/lib/vacancyRelevance';

// Sobreaviso no painel do dia (V0.10.3): por setor, quem fica de reserva. "Chamar sobreaviso" avisa
// essas pessoas quando o dia tem vaga aberta.
export default function StandbyPanel({ dateStr, sectors = [], professionals = [], company, unitOfSector, dayShifts = [], isVacant, isManager, onChanged }) {
  const [busy, setBusy] = useState('');
  const [adding, setAdding] = useState('');

  const save = async (sector, ids) => {
    setBusy(sector.id);
    try {
      const { data: row, error: readError } = await supabase.from('companies').select('data').eq('id', company.id).single();
      if (readError) throw readError;
      const { error } = await supabase.from('companies').update({ data: withStandby(row?.data, unitOfSector(sector.id), sector.id, dateStr, ids) }).eq('id', company.id);
      if (error) throw error;
      await onChanged?.();
    } catch (err) {
      alert(`Não foi possível salvar o sobreaviso. ${err?.message || ''}`);
    } finally {
      setBusy('');
      setAdding('');
    }
  };

  const callStandby = async (sector, people, vacancies) => {
    const first = vacancies[0];
    if (!confirm(`Avisar ${people.map(p => p.name.split(' ')[0]).join(', ')} que há ${vacancies.length} vaga(s) aberta(s) em ${sector.name} em ${formatDateBR(dateStr)}?`)) return;
    const ok = await sendNotifications(people.map(p => ({
      ...recipientFor(p), company_id: company?.id, unit_id: unitOfSector(sector.id),
      type: 'sobreaviso', category: 'vaga',
      title: `Sobreaviso: vaga em ${sector.name} ${formatDateBR(dateStr).slice(0, 5)} ${first.start_time}`,
      message: `Você está de sobreaviso. ${vacancies.length > 1 ? `Há ${vacancies.length} vagas abertas` : `Vaga aberta das ${first.start_time} às ${first.end_time}`}. Abra o Mural para assumir ou fale com a coordenação.`,
      data: { shift_id: first.id, date: dateStr, url: '/trocas' }
    })));
    alert(ok ? 'Sobreaviso chamado: o aviso chega no sino e no celular.' : 'Não foi possível enviar o aviso agora.');
  };

  const rows = sectors.map(sector => {
    const ids = getStandby(company, unitOfSector(sector.id), sector.id, dateStr);
    const people = ids.map(id => professionals.find(p => String(p.id) === id)).filter(Boolean);
    const vacancies = dayShifts.filter(s => String(s.sector_id) === String(sector.id) && isVacant(s) && !String(s.notes || '').includes('[VAGA_EXTRA]'));
    // Só chama quem é da especialidade de alguma das vagas (V0.10.6).
    const callable = people.filter(p => vacancies.some(v => specialtyMatches(v, p)));
    return { sector, ids, people, vacancies, callable };
  });
  // Com vários setores (aba "Todos"), mostra só quem tem reserva ou vaga no dia; adicionar é com o setor escolhido.
  const multi = sectors.length > 1;
  const visible = rows.filter(r => (multi ? r.people.length || (isManager && r.vacancies.length) : isManager || r.people.length));

  if (!visible.length && !(multi && isManager)) return null;

  return (
    <section className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-2.5 space-y-2">
      <h4 className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400"><ShieldPlus className="h-3.5 w-3.5" /> Sobreaviso</h4>
      {multi && isManager && <p className="text-[11px] text-slate-500 dark:text-slate-400">Para colocar alguém de reserva, escolha o setor nas abas acima.</p>}
      {visible.map(({ sector, ids, people, vacancies, callable }) => {
        // Reserva: liberado no setor e da especialidade de algum turno do setor no dia (se o dia tem plantão).
        const daySpecs = dayShifts.filter(s => String(s.sector_id) === String(sector.id));
        const candidates = professionals.filter(p => String(p.status || 'ativo') === 'ativo' && !ids.includes(String(p.id)) &&
          getProfessionalUnitIds(p).includes(String(unitOfSector(sector.id))) && isProfessionalAuthorizedForSector(p, sector.id) &&
          (!daySpecs.length || daySpecs.some(s => specialtyMatches(s, p))))
          .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
        return (
          <div key={sector.id} className="space-y-1.5">
            {sectors.length > 1 && <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{sector.name}</p>}
            <div className="flex flex-wrap items-center gap-1.5">
              {people.length === 0 && <span className="text-[11px] text-slate-500 dark:text-slate-400">Ninguém de reserva.</span>}
              {people.map(p => (
                <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 pl-2.5 pr-1 py-0.5 text-xs text-slate-700 dark:text-slate-200">
                  {p.name.split(' ').slice(0, 2).join(' ')}
                  {isManager && <button type="button" disabled={busy === sector.id} onClick={() => save(sector, ids.filter(id => id !== String(p.id)))} aria-label={`Tirar ${p.name} do sobreaviso`} className="rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"><X className="h-3 w-3" /></button>}
                </span>
              ))}
              {isManager && !multi && (adding === sector.id ? (
                <select autoFocus defaultValue="" onBlur={() => setAdding('')} onChange={e => e.target.value && save(sector, [...ids, e.target.value])} className="h-7 max-w-[200px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs">
                  <option value="">Escolha quem fica de reserva</option>
                  {candidates.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                </select>
              ) : (
                <button type="button" disabled={busy === sector.id || !candidates.length} onClick={() => setAdding(sector.id)} className="rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/30 cursor-pointer disabled:opacity-40">+ Adicionar</button>
              ))}
            </div>
            {isManager && people.length > 0 && vacancies.length > 0 && callable.length === 0 && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Ninguém de reserva é da especialidade das vagas abertas ({[...new Set(vacancies.map(getShiftSpecialty))].join(', ')}).</p>
            )}
            {isManager && callable.length > 0 && vacancies.length > 0 && (
              <button type="button" onClick={() => callStandby(sector, callable, vacancies.filter(v => callable.some(p => specialtyMatches(v, p))))} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 px-2.5 py-1 text-xs font-semibold text-white cursor-pointer">
                <BellRing className="h-3.5 w-3.5" /> Chamar sobreaviso ({vacancies.length} vaga{vacancies.length > 1 ? 's' : ''})
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
