import { useMemo, useState } from 'react';
import { ArrowRightLeft, Check, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { recipientFor, sendNotifications } from '@/lib/notifications';
import { findSwapOptions, OPEN_SWAP_STATUSES, SWAP_STATUS, SWAP_TYPE } from '@/lib/directSwap';
import { isVacancyRelevantFor } from '@/components/NotificationCenter';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function shortDate(date) {
  const text = new Date(String(date).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function firstLast(name) {
  const parts = String(name || '').trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0] || 'Colega';
}

const TONE = {
  amber: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  sky: 'bg-sky-50 text-sky-800 dark:bg-sky-500/10 dark:text-sky-300',
  emerald: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
};

// Estado e ações da troca direta entre colegas.
export function useDirectSwaps({ swaps, myProf, user, company, isManager, managerUnitIds, shifts, professionals, appUsers, sectorName, syncGlobalData }) {
  const [busyId, setBusyId] = useState(null);
  const direct = useMemo(() => (swaps || []).filter(s => s?.swap_type === SWAP_TYPE)
    .sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || ''))), [swaps]);
  const openShiftIds = useMemo(() => direct.filter(s => OPEN_SWAP_STATUSES.includes(s.status))
    .flatMap(s => [s.shift_id, s.target_shift_id]).filter(Boolean).map(String), [direct]);

  const myId = myProf?.id ? String(myProf.id) : '';
  const incoming = direct.filter(s => String(s.target_professional_id) === myId && s.status === 'aguardando_colega');
  const recentCutoff = Date.now() - 30 * 86400000;
  const mine = direct.filter(s => (String(s.requester_professional_id) === myId || String(s.target_professional_id) === myId) &&
    !(String(s.target_professional_id) === myId && s.status === 'aguardando_colega') &&
    (OPEN_SWAP_STATUSES.includes(s.status) || new Date(s.updated_date || s.created_date).getTime() >= recentCutoff));
  const awaitingManager = isManager
    ? direct.filter(s => s.status === 'aguardando_gestor' && (!managerUnitIds?.length || managerUnitIds.includes(String(s.unit_id))))
    : [];

  const shiftById = id => (shifts || []).find(s => String(s.id) === String(id));
  const profById = id => (professionals || []).find(p => String(p.id) === String(id)) || { id };

  const notify = (items) => sendNotifications(items.filter(Boolean).map(item => ({ company_id: company?.id, category: 'troca', ...item })));
  const managersToNotify = (unitId) => (appUsers || [])
    .filter(u => u?.id && (u.role === 'admin' || ['gestor', 'coordenador'].includes(u.data?.app_role) || u.data?.can_edit === true))
    .filter(u => !Array.isArray(u.data?.allowed_unit_ids) || !u.data.allowed_unit_ids.length || u.data.allowed_unit_ids.map(String).includes(String(unitId)))
    .map(u => ({ user_id: String(u.id) }));

  const run = async (id, fn) => {
    setBusyId(id);
    try { await fn(); await syncGlobalData(); return true; } catch (err) { alert(err?.message || 'Não foi possível concluir. Tente novamente.'); return false; } finally { setBusyId(null); }
  };

  const propose = (myShift, option, reason) => run(myShift.id, async () => {
    const theirs = option.shift;
    const row = {
      company_id: company?.id || 'cmp_principal',
      unit_id: myShift.unit_id,
      swap_type: SWAP_TYPE,
      status: 'aguardando_colega',
      shift_id: myShift.id,
      shift_date: myShift.date,
      shift_time: `${myShift.start_time}–${myShift.end_time}`,
      sector_name: sectorName(myShift.sector_id),
      requester_professional_id: String(myProf.id),
      requester_name: myProf.name,
      requester_specialty: myProf.specialty || null,
      target_professional_id: String(option.colleague.id),
      target_name: option.colleague.name,
      target_specialty: option.colleague.specialty || null,
      target_shift_id: theirs.id,
      target_shift_date: theirs.date,
      target_shift_time: `${theirs.start_time}–${theirs.end_time}`,
      target_sector_name: sectorName(theirs.sector_id),
      reason: reason?.trim() || null
    };
    const { error } = await supabase.from('shift_swaps').insert([row]);
    if (error) throw error;
    await notify([{
      ...recipientFor(option.colleague), unit_id: theirs.unit_id, type: 'troca_proposta',
      title: `${firstLast(myProf.name)} propôs uma troca de plantão`,
      message: `Seu ${shortDate(theirs.date)} ${theirs.start_time} pelo ${shortDate(myShift.date)} ${myShift.start_time} (${row.sector_name}). Responda no Mural › Meus plantões.`,
      data: { shift_id: theirs.id }
    }]);
  });

  const respond = (swap, accept) => run(swap.id, async () => {
    const { error } = await supabase.from('shift_swaps')
      .update({ status: accept ? 'aguardando_gestor' : 'recusada_colega', updated_date: new Date().toISOString() })
      .eq('id', swap.id).eq('status', 'aguardando_colega');
    if (error) throw error;
    await notify([
      { ...recipientFor(profById(swap.requester_professional_id)), unit_id: swap.unit_id, type: accept ? 'troca_aceita' : 'troca_recusada',
        title: accept ? `${firstLast(swap.target_name)} aceitou a troca` : `${firstLast(swap.target_name)} recusou a troca`,
        message: accept ? 'Agora a troca vai para a aprovação da coordenação.' : `Seu plantão de ${shortDate(swap.shift_date)} continua com você.`,
        data: { shift_id: swap.shift_id } },
      ...(accept ? managersToNotify(swap.unit_id).map(m => ({ ...m, unit_id: swap.unit_id, type: 'troca_para_aprovar',
        title: 'Troca de plantão para aprovar',
        message: `${firstLast(swap.requester_name)} ⇄ ${firstLast(swap.target_name)} · ${shortDate(swap.shift_date)} e ${shortDate(swap.target_shift_date)}. Veja em Mural › Aprovações.`,
        data: { swap_id: swap.id } })) : [])
    ]);
  });

  const cancel = (swap) => run(swap.id, async () => {
    const { error } = await supabase.from('shift_swaps').update({ status: 'cancelada', updated_date: new Date().toISOString() })
      .eq('id', swap.id).in('status', OPEN_SWAP_STATUSES);
    if (error) throw error;
  });

  const decide = (swap, approve) => run(swap.id, async () => {
    if (approve) {
      // Confere de novo as regras (a escala pode ter mudado depois do pedido).
      const requesterShift = shiftById(swap.shift_id);
      const stillValid = requesterShift && findSwapOptions({
        myShift: requesterShift, me: profById(swap.requester_professional_id), professionals, shifts, isRelevant: isVacancyRelevantFor
      }).some(o => String(o.shift.id) === String(swap.target_shift_id));
      if (!stillValid && !confirm('A troca não passa mais nas regras (choque de horário, férias, setor ou especialidade). Aprovar mesmo assim?')) return;
      const { data, error } = await supabase.rpc('approve_shift_swap', { p_swap_id: swap.id, p_decided_by: user?.id ? String(user.id) : null });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Não foi possível aprovar a troca.');
    } else {
      const { error } = await supabase.from('shift_swaps')
        .update({ status: 'recusada_gestor', decided_by: user?.id ? String(user.id) : null, decided_at: new Date().toISOString(), updated_date: new Date().toISOString() })
        .eq('id', swap.id).eq('status', 'aguardando_gestor');
      if (error) throw error;
    }
    const text = approve ? 'aprovou' : 'recusou';
    await notify([swap.requester_professional_id, swap.target_professional_id].map(id => ({
      ...recipientFor(profById(id)), unit_id: swap.unit_id, type: approve ? 'troca_aprovada' : 'troca_recusada',
      title: `A coordenação ${text} a troca de plantão`,
      message: approve
        ? `${firstLast(swap.requester_name)} fica com ${shortDate(swap.target_shift_date)} ${swap.target_shift_time}; ${firstLast(swap.target_name)} fica com ${shortDate(swap.shift_date)} ${swap.shift_time}.`
        : 'Os plantões continuam como estavam.',
      data: { swap_id: swap.id }
    })));
  });

  const optionsFor = (myShift) => findSwapOptions({
    myShift, me: myProf, professionals, shifts, isRelevant: isVacancyRelevantFor, blockedShiftIds: openShiftIds
  });

  return { direct, incoming, mine, awaitingManager, openShiftIds, busyId, propose, respond, cancel, decide, optionsFor };
}

function SwapLine({ swap }) {
  return (
    <span className="block text-sm text-slate-800 dark:text-slate-100">
      <b>{firstLast(swap.requester_name)}</b> {shortDate(swap.shift_date)} {swap.shift_time} <span className="text-slate-500">({swap.sector_name})</span>
      <ArrowRightLeft className="inline w-3.5 h-3.5 mx-1.5 text-slate-400" />
      <b>{firstLast(swap.target_name)}</b> {shortDate(swap.target_shift_date)} {swap.target_shift_time} <span className="text-slate-500">({swap.target_sector_name})</span>
    </span>
  );
}

function StatusChip({ status }) {
  const meta = SWAP_STATUS[status] || { label: status, tone: 'slate' };
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TONE[meta.tone]}`}>{meta.label}</span>;
}

// Pedidos recebidos (aceitar/recusar) e enviados/recentes (situação, cancelar).
export function MySwapsList({ swapsApi, myProfId }) {
  const { incoming, mine, busyId, respond, cancel } = swapsApi;
  if (incoming.length === 0 && mine.length === 0) return null;
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <h2 className="px-4 py-3 text-sm font-semibold border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <ArrowRightLeft className="w-4 h-4 text-slate-400" /> Trocas com colegas
      </h2>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {incoming.map(swap => (
          <li key={swap.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Proposta para você</span>
              <SwapLine swap={swap} />
              {swap.reason && <span className="block text-xs text-slate-500 mt-0.5">“{swap.reason}”</span>}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button type="button" variant="outline" disabled={busyId === swap.id} onClick={() => respond(swap, false)} className="h-9 gap-1"><X className="w-4 h-4" /> Recusar</Button>
              <Button type="button" disabled={busyId === swap.id} onClick={() => respond(swap, true)} className="h-9 gap-1 bg-sky-600 hover:bg-sky-500 text-white"><Check className="w-4 h-4" /> Aceitar</Button>
            </div>
          </li>
        ))}
        {mine.map(swap => (
          <li key={swap.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="min-w-0 flex-1"><SwapLine swap={swap} /></div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusChip status={swap.status} />
              {OPEN_SWAP_STATUSES.includes(swap.status) && String(swap.requester_professional_id) === String(myProfId) && (
                <Button type="button" variant="ghost" disabled={busyId === swap.id} onClick={() => cancel(swap)} className="h-8 text-xs text-slate-500">Cancelar</Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Aprovação da coordenação.
export function ManagerSwapApprovals({ swapsApi, unitNameById }) {
  const { awaitingManager, busyId, decide } = swapsApi;
  if (awaitingManager.length === 0) return null;
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <h2 className="px-4 py-3 text-sm font-semibold border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <ArrowRightLeft className="w-4 h-4 text-slate-400" /> Trocas entre colegas ({awaitingManager.length})
      </h2>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {awaitingManager.map(swap => (
          <li key={swap.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="min-w-0 flex-1">
              <SwapLine swap={swap} />
              <span className="block text-xs text-slate-500 mt-0.5">
                Os dois concordaram{unitNameById?.[String(swap.unit_id)] ? ` · ${unitNameById[String(swap.unit_id)]}` : ''}{swap.reason ? ` · “${swap.reason}”` : ''}
              </span>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button type="button" variant="outline" disabled={busyId === swap.id} onClick={() => decide(swap, false)} className="h-9 gap-1"><X className="w-4 h-4" /> Recusar</Button>
              <Button type="button" disabled={busyId === swap.id} onClick={() => decide(swap, true)} className="h-9 gap-1 bg-emerald-600 hover:bg-emerald-500 text-white"><Check className="w-4 h-4" /> Aprovar troca</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Janela para escolher o plantão do colega e enviar a proposta.
export function SwapProposalDialog({ shift, onClose, swapsApi, sectorName, unitNameById }) {
  const [choice, setChoice] = useState('');
  const [reason, setReason] = useState('');
  const options = useMemo(() => (shift ? swapsApi.optionsFor(shift) : []), [shift, swapsApi]);
  const chosen = options.find(o => String(o.shift.id) === choice);
  const multiUnit = new Set(options.map(o => String(o.shift.unit_id))).size > 1;

  const submit = async () => {
    if (!chosen) return;
    if (!(await swapsApi.propose(shift, chosen, reason))) return;
    setChoice('');
    setReason('');
    onClose();
  };

  return (
    <Dialog open={Boolean(shift)} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-white border-slate-200 dark:border-slate-800">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base font-bold">Propor troca de plantão</DialogTitle>
          {shift && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Seu plantão: <b className="text-slate-800 dark:text-slate-100">{shortDate(shift.date)} {shift.start_time}–{shift.end_time}</b> · {sectorName(shift.sector_id)}
            </p>
          )}
        </DialogHeader>
        <p className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
          Só aparecem plantões que dá para trocar nos dois sentidos: especialidade, setor autorizado, sem choque de horário e sem férias. Depois que o colega aceitar, a coordenação aprova.
        </p>
        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          {options.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">Nenhum plantão de colega pode ser trocado por este agora.</p>
          ) : options.map(({ shift: theirs, colleague }) => {
            const selected = choice === String(theirs.id);
            return (
              <label key={theirs.id} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer ${selected ? 'bg-sky-50 dark:bg-sky-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-900'}`}>
                <input type="radio" name="swap-option" checked={selected} onChange={() => setChoice(String(theirs.id))} className="w-4 h-4" />
                <span className="w-24 shrink-0 font-mono text-xs">{shortDate(theirs.date)}<br />{theirs.start_time}–{theirs.end_time}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate">{firstLast(colleague.name)}</span>
                  <span className="block text-xs text-slate-500 truncate">{sectorName(theirs.sector_id)}{multiUnit && unitNameById?.[String(theirs.unit_id)] ? ` · ${unitNameById[String(theirs.unit_id)]}` : ''}</span>
                </span>
              </label>
            );
          })}
        </div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          maxLength={240}
          placeholder="Mensagem para o colega (opcional)"
          className="shrink-0 w-full min-h-[60px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-sm"
        />
        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={!chosen || swapsApi.busyId === shift?.id} onClick={submit} className="bg-sky-600 hover:bg-sky-500 text-white">
            Enviar proposta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
