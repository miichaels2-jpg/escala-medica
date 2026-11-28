import { useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, Mail, ScrollText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { isRealEmail } from '@/lib/passwordRecovery';
import PageHero from '@/components/PageHero';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Versões (V0.10.9, só o dono da plataforma): as cartas de versão ficam guardadas aqui, uma por ciclo
// do número do meio (public/cartas/catalogo.json + PDF), e o envelope envia a carta aos gestores.
function SendDialog({ letter, onClose }) {
  const [companies, setCompanies] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!letter) return;
    setResult(null);
    supabase.rpc('platform_companies').then(({ data }) => {
      const list = (Array.isArray(data) ? data : []).filter(c => c.plan !== 'demo')
        .map(c => ({ ...c, managers: (c.managers || []).filter(m => isRealEmail(m.email) && m.is_active !== false && String(m.username).toLowerCase() !== 'admin') }))
        .filter(c => c.managers.length);
      setCompanies(list);
      setSelected(new Set(list.flatMap(c => c.managers.map(m => `${c.id}|${m.id}`))));
    });
  }, [letter]);

  const recipients = useMemo(() => {
    const seen = new Set();
    return companies.flatMap(c => c.managers.filter(m => selected.has(`${c.id}|${m.id}`)).map(m => ({ email: String(m.email).toLowerCase(), name: m.full_name, company: c.name })))
      .filter(r => (seen.has(r.email) ? false : seen.add(r.email)));
  }, [companies, selected]);

  const toggle = key => setSelected(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  const send = async () => {
    if (!recipients.length) return;
    if (!confirm(`Enviar a Carta de Versão ${letter.versao} para ${recipients.length} gestor(es)?`)) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('send-release-letter', { body: { letter, recipients } });
    let res = data;
    if (error) res = await error.context?.json?.().catch(() => null);
    setResult(res || { sent: 0, reason: 'Não foi possível enviar agora.' });
    setSending(false);
  };

  return (
    <Dialog open={Boolean(letter)} onOpenChange={open => { if (!open && !sending) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
        <DialogHeader><DialogTitle className="flex items-center gap-2 text-base"><Mail className="w-5 h-5 text-sky-600" /> Enviar Carta de Versão {letter?.versao}</DialogTitle></DialogHeader>
        {result ? (
          <div className="space-y-3 text-sm">
            <p><b>{result.sent || 0}</b> e-mail(s) enviado(s){result.failed?.length ? `; não foram: ${result.failed.join(', ')}` : ''}.{result.reason ? ` ${result.reason}` : ''}</p>
            <DialogFooter><Button type="button" onClick={onClose} className="bg-sky-600 hover:bg-sky-500 text-white">Fechar</Button></DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-300">Cada gestor recebe um e-mail formal, com o resumo das novidades e o PDF da carta em anexo. Só aparecem gestores com e-mail cadastrado.</p>
            <div className="flex justify-end gap-3 text-xs">
              <button type="button" onClick={() => setSelected(new Set(companies.flatMap(c => c.managers.map(m => `${c.id}|${m.id}`))))} className="text-sky-700 dark:text-sky-300 font-medium hover:underline cursor-pointer">Marcar todos</button>
              <button type="button" onClick={() => setSelected(new Set())} className="text-sky-700 dark:text-sky-300 font-medium hover:underline cursor-pointer">Desmarcar</button>
            </div>
            {companies.length === 0 && <p className="text-sm text-slate-500">Nenhum gestor com e-mail cadastrado.</p>}
            {companies.map(c => (
              <div key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-800">
                <p className="px-3 pt-2 text-xs font-semibold text-slate-500">{c.name}</p>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {c.managers.map(m => (
                    <li key={m.id}>
                      <label className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={selected.has(`${c.id}|${m.id}`)} onChange={() => toggle(`${c.id}|${m.id}`)} className="h-4 w-4 accent-sky-600" />
                        <span className="min-w-0"><span className="block truncate">{m.full_name}</span><span className="block truncate text-[11px] text-slate-500">{m.email}</span></span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={sending}>Cancelar</Button>
              <Button type="button" onClick={send} disabled={sending || !recipients.length} className="bg-sky-600 hover:bg-sky-500 text-white">{sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando…</> : `Enviar para ${recipients.length}`}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Versoes() {
  const [isOwner, setIsOwner] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [sending, setSending] = useState(null);

  useEffect(() => {
    supabase.rpc('sm_auth_is_platform_owner').then(({ data }) => setIsOwner(data === true));
    fetch('/cartas/catalogo.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : { cartas: [] })).then(setCatalog).catch(() => setCatalog({ cartas: [] }));
  }, []);

  if (isOwner === false) return <div className="p-4 md:p-8"><p className="text-sm text-slate-500">Esta área é restrita ao dono da plataforma.</p></div>;
  const letters = (catalog?.cartas || []).slice().sort((a, b) => String(b.versao).localeCompare(String(a.versao), undefined, { numeric: true }));

  return (
    <div className="min-h-full bg-slate-100 dark:bg-slate-950 p-4 md:p-8 space-y-6 text-slate-900 dark:text-slate-100">
      <PageHero title="Versões" subtitle="Cartas de versão do ScaleMedic: o que cada ciclo entregou, para enviar aos gestores dos clientes." />
      {catalog && letters.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
          <ScrollText className="w-8 h-8 mx-auto text-slate-400" />
          <p className="mt-2 font-semibold">Nenhuma carta de versão ainda</p>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">Cada vez que o número do meio da versão virar (ex.: de 0.11.20 para 0.12.1), a carta daquele ciclo aparece aqui, pronta para enviar.</p>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {letters.map(l => (
          <article key={l.versao} className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Carta de Versão {l.versao}</p>
                <h2 className="text-lg font-semibold">{l.titulo}</h2>
                <p className="text-xs text-slate-500">{l.periodo}{l.data ? ` · publicada em ${l.data}` : ''}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setSending(l)} aria-label={`Enviar Carta de Versão ${l.versao} aos gestores`} title="Enviar aos gestores por e-mail" className="h-9 px-3 rounded-xl border-sky-300 text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/30"><Mail className="w-4 h-4" /></Button>
            </div>
            {l.destaques?.length > 0 && <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300 space-y-0.5">{l.destaques.slice(0, 5).map(d => <li key={d}>{d}</li>)}</ul>}
            <a href={`/${l.arquivo}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 dark:text-sky-300 hover:underline"><FileText className="w-4 h-4" /> Abrir o PDF</a>
          </article>
        ))}
      </div>
      <SendDialog letter={sending} onClose={() => setSending(null)} />
    </div>
  );
}
