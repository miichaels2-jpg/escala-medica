// Plataforma › Pessoas e acessos (V0.8.3): quem entra no estabelecimento e com qual papel, e
// transferência de profissionais para outro estabelecimento (copiar ou mover).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightLeft, KeyRound, Loader2, Search, UserMinus, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const ROLES = [
  ['gestor', 'Gestor'],
  ['coordenador', 'Coordenador'],
  ['faturamento', 'Faturamento'],
  ['assistencial', 'Plantonista']
];
const roleValue = role => (role === 'manager' ? 'gestor' : ROLES.some(([id]) => id === role) ? role : 'assistencial');
const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function PlatformPeopleDialog({ company, companies, onClose, onChanged, rpcMessage }) {
  const [people, setPeople] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState(() => new Set());
  const [target, setTarget] = useState('');
  const [targetUnits, setTargetUnits] = useState([]);
  const [keepOrigin, setKeepOrigin] = useState(true);
  // A Plataforma recria rpcMessage a cada render: a referência evita recarregar em laço.
  const messageRef = useRef(rpcMessage);
  messageRef.current = rpcMessage;

  const load = useCallback(async () => {
    if (!company) return;
    setError('');
    const { data, error: rpcError } = await supabase.rpc('platform_company_people', { p_company_id: company.id });
    if (rpcError) { setError(messageRef.current(rpcError, '20261126200000_platform_people.sql')); setPeople({ users: [], professionals: [] }); return; }
    setPeople(data || { users: [], professionals: [] });
  }, [company]);

  useEffect(() => {
    setPeople(null); setChosen(new Set()); setTarget(''); setTargetUnits([]); setKeepOrigin(true); setNotice(null); setSearch('');
    load();
  }, [load]);

  const others = useMemo(() => (companies || []).filter(c => c.id !== company?.id), [companies, company]);
  const targetCompany = others.find(c => c.id === target);
  useEffect(() => { setTargetUnits(targetCompany ? targetCompany.units.map(u => String(u.id)) : []); }, [targetCompany]);

  const professionals = useMemo(() => {
    const term = normalize(search);
    return (people?.professionals || []).filter(p => !term || normalize(`${p.name} ${p.specialty}`).includes(term));
  }, [people, search]);

  const setRole = async (person, role) => {
    if (role === 'remover' && !window.confirm(`Tirar o acesso de ${person.full_name} a ${company.name}?\n\nO login continua valendo nos outros estabelecimentos dele.`)) return;
    setBusy(`role:${person.id}`); setNotice(null);
    const { error: rpcError } = await supabase.rpc('platform_set_company_role', { p_user_id: person.id, p_company_id: company.id, p_role: role });
    setBusy('');
    if (rpcError) { setNotice({ tone: 'error', text: rpcMessage(rpcError, '20261126200000_platform_people.sql') }); return; }
    setNotice({ tone: 'ok', text: role === 'remover' ? `${person.full_name} não entra mais em ${company.name}.` : `${person.full_name} agora é ${ROLES.find(([id]) => id === role)?.[1]} em ${company.name}.` });
    await load(); onChanged?.();
  };

  const toggle = id => setChosen(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const allVisibleChosen = professionals.length > 0 && professionals.every(p => chosen.has(p.id));

  const transfer = async () => {
    if (!targetCompany || chosen.size === 0 || targetUnits.length === 0) return;
    const verb = keepOrigin ? 'Copiar' : 'Mover';
    if (!window.confirm(`${verb} ${chosen.size} profissional(is) para ${targetCompany.name}?\n\n${keepOrigin ? `Continuam também em ${company.name}.` : `Saem de ${company.name} (ficam inativos lá, com o histórico guardado).`}\nQuem tem login usa a mesma senha e passa a escolher o estabelecimento ao entrar.`)) return;
    setBusy('transfer'); setNotice(null);
    const { data, error: rpcError } = await supabase.rpc('platform_transfer_professionals', {
      p_professional_ids: [...chosen], p_target_company: targetCompany.id, p_unit_ids: targetUnits, p_keep_origin: keepOrigin
    });
    setBusy('');
    if (rpcError) { setNotice({ tone: 'error', text: rpcMessage(rpcError, '20261126200000_platform_people.sql') }); return; }
    const skipped = Array.isArray(data?.skipped) ? data.skipped : [];
    setNotice({
      tone: skipped.length ? 'warn' : 'ok',
      text: `${data?.copied || 0} profissional(is) ${keepOrigin ? 'copiado(s)' : 'movido(s)'} para ${targetCompany.name}. Setores e valores por hospital ficam para ajustar no Corpo Clínico de lá.${skipped.length ? ` Ficaram de fora: ${skipped.map(s => `${s.name} (${s.reason})`).join('; ')}.` : ''}`
    });
    setChosen(new Set());
    await load(); onChanged?.();
  };

  const toneClass = { ok: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200', warn: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200', error: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200' };

  return (
    <Dialog open={Boolean(company)} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="w-[96vw] sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-sky-600" /> Pessoas e acessos · {company?.name}</DialogTitle>
        </DialogHeader>

        {error && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">{error}</p>}
        {notice && <p role="status" className={`rounded-xl border px-3 py-2 text-sm ${toneClass[notice.tone]}`}>{notice.text}</p>}

        {!people ? (
          <p className="flex items-center gap-2 py-6 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p>
        ) : error ? null : (
          <div className="space-y-6">
            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold"><KeyRound className="w-4 h-4 text-slate-400" /> Quem entra em {company.name}</h3>
              <p className="text-xs text-slate-500">O papel vale só neste estabelecimento. Trocar o papel devolve as telas ao padrão dele.</p>
              {people.users.length === 0 && <p className="text-sm text-slate-500">Nenhum login ainda.</p>}
              <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
                {people.users.map(person => (
                  <div key={person.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{person.full_name}</p>
                      <p className="truncate text-xs text-slate-500">{person.username}{person.companies > 1 ? ` · entra em ${person.companies} estabelecimentos` : ''}</p>
                    </div>
                    {person.is_admin ? (
                      <span className="text-xs text-slate-500">Administrador geral</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <select value={roleValue(person.role)} disabled={busy === `role:${person.id}`} onChange={e => setRole(person, e.target.value)} aria-label={`Papel de ${person.full_name}`}
                          className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-xs font-semibold cursor-pointer">
                          {ROLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                        </select>
                        <Button type="button" variant="ghost" size="sm" disabled={busy === `role:${person.id}`} onClick={() => setRole(person, 'remover')} className="h-8 gap-1 text-rose-600 hover:text-rose-700">
                          {busy === `role:${person.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />} Tirar acesso
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold"><ArrowRightLeft className="w-4 h-4 text-slate-400" /> Transferir profissionais para outro estabelecimento</h3>
              {others.length === 0 ? (
                <p className="text-sm text-slate-500">Só existe este estabelecimento.</p>
              ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Para
                      <select value={target} onChange={e => setTarget(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm cursor-pointer">
                        <option value="">Escolha o estabelecimento…</option>
                        {others.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                    <label className="relative block text-xs font-semibold text-slate-600 dark:text-slate-300">Buscar
                      <Search className="pointer-events-none absolute left-2.5 top-[30px] h-3.5 w-3.5 text-slate-400" />
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome ou especialidade" className="mt-1 h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-8 pr-2 text-sm font-normal" />
                    </label>
                  </div>
                  {targetCompany && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">Hospitais liberados:</span>
                      {targetCompany.units.map(u => (
                        <label key={u.id} className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={targetUnits.includes(String(u.id))} onChange={() => setTargetUnits(prev => prev.includes(String(u.id)) ? prev.filter(x => x !== String(u.id)) : [...prev, String(u.id)])} className="h-4 w-4 accent-sky-600" />
                          {u.name}
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    {professionals.length > 0 && (
                      <label className="sticky top-0 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-3 py-2 text-xs font-semibold cursor-pointer">
                        <input type="checkbox" checked={allVisibleChosen} onChange={() => setChosen(prev => { const next = new Set(prev); professionals.forEach(p => (allVisibleChosen ? next.delete(p.id) : next.add(p.id))); return next; })} className="h-4 w-4 accent-sky-600" />
                        Marcar todos ({professionals.length})
                      </label>
                    )}
                    {professionals.length === 0 && <p className="px-3 py-4 text-sm text-slate-500">Nenhum profissional{search ? ' com esse nome' : ''}.</p>}
                    {professionals.map(p => (
                      <label key={p.id} className="flex items-center gap-2 border-b last:border-b-0 border-slate-100 dark:border-slate-800 px-3 py-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={chosen.has(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 accent-sky-600" />
                        <span className="min-w-0 flex-1 truncate">{p.name}<span className="text-xs text-slate-500"> · {p.specialty || 'sem especialidade'}{p.status && p.status !== 'ativo' ? ` · ${p.status}` : ''}</span></span>
                        <span className="shrink-0 text-[11px] text-slate-500">{p.has_login ? 'com login' : 'sem login'}</span>
                      </label>
                    ))}
                  </div>
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={keepOrigin} onChange={e => setKeepOrigin(e.target.checked)} className="mt-0.5 h-4 w-4 accent-sky-600" />
                    <span>Manter também em <b>{company.name}</b> <span className="text-xs text-slate-500">(desmarcado: saem daqui e ficam inativos, com o histórico guardado)</span></span>
                  </label>
                  <div className="flex justify-end">
                    <Button type="button" onClick={transfer} disabled={!targetCompany || chosen.size === 0 || targetUnits.length === 0 || busy === 'transfer'} className="gap-1.5">
                      {busy === 'transfer' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                      {keepOrigin ? 'Copiar' : 'Mover'} {chosen.size || ''} para {targetCompany?.name || '…'}
                    </Button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
