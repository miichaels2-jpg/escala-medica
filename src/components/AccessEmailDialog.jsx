import { useEffect, useMemo, useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { isRealEmail } from '@/lib/passwordRecovery';
import { sendAccessToProfessional } from '@/lib/accessEmail';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Envio do acesso por e-mail em lote (V0.9.4): escolhe entre os profissionais mostrados no Corpo Clínico.
export default function AccessEmailDialog({ open, onOpenChange, professionals = [] }) {
  const withEmail = useMemo(() => professionals.filter(p => isRealEmail(p.email)), [professionals]);
  const [selected, setSelected] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(withEmail.map(p => String(p.id))));
    setSummary(null);
    setProgress(0);
  }, [open, withEmail]);

  const toggle = id => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleSend = async () => {
    const targets = withEmail.filter(p => selected.has(String(p.id)));
    if (!targets.length) return;
    setSending(true);
    const result = { enviado: 0, primeiro: 0, sem_login: [], falha: [] };
    for (let i = 0; i < targets.length; i += 1) {
      const prof = targets[i];
      const r = await sendAccessToProfessional(prof);
      if (r.status === 'enviado') { result.enviado += 1; if (r.firstAccess) result.primeiro += 1; }
      else if (r.status === 'sem_login') result.sem_login.push(prof.name);
      else result.falha.push(`${prof.name}${r.reason ? ` (${r.reason})` : ''}`);
      setProgress(i + 1);
    }
    setSending(false);
    setSummary(result);
  };

  const total = withEmail.filter(p => selected.has(String(p.id))).length;
  const withoutEmail = professionals.length - withEmail.length;

  return (
    <Dialog open={open} onOpenChange={value => { if (!sending) onOpenChange(value); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base"><Mail className="w-5 h-5 text-sky-600" /> Enviar acesso por e-mail</DialogTitle>
        </DialogHeader>
        {summary ? (
          <div className="space-y-3 text-sm">
            <p className="text-slate-800 dark:text-slate-100"><b>{summary.enviado}</b> e-mail(s) enviado(s){summary.primeiro ? `, ${summary.primeiro} com senha provisória nova (quem ainda não tinha entrado)` : ''}.</p>
            {summary.sem_login.length > 0 && <p className="text-amber-700 dark:text-amber-300 text-xs">Sem login no sistema: {summary.sem_login.join(', ')}. Abra o cadastro e salve para criar o acesso.</p>}
            {summary.falha.length > 0 && <p className="text-rose-600 text-xs">Não enviados: {summary.falha.join('; ')}.</p>}
            <DialogFooter><Button type="button" onClick={() => onOpenChange(false)} className="bg-sky-600 hover:bg-sky-500 text-white">Fechar</Button></DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Cada um recebe o endereço e o usuário. Quem <b>ainda não entrou</b> no sistema recebe também uma <b>senha provisória nova</b> (a da data de nascimento, quando o cadastro tem a data). Quem já criou a própria senha não tem a senha alterada.
            </p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{total} de {withEmail.length} marcados{withoutEmail ? ` · ${withoutEmail} sem e-mail no cadastro` : ''}</span>
              <span className="flex gap-3">
                <button type="button" onClick={() => setSelected(new Set(withEmail.map(p => String(p.id))))} className="text-sky-700 dark:text-sky-300 font-medium hover:underline cursor-pointer">Marcar todos</button>
                <button type="button" onClick={() => setSelected(new Set())} className="text-sky-700 dark:text-sky-300 font-medium hover:underline cursor-pointer">Desmarcar</button>
              </span>
            </div>
            <ul className="max-h-[45vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {professionals.map(p => {
                const hasEmail = isRealEmail(p.email);
                return (
                  <li key={p.id}>
                    <label className={`flex items-center gap-3 px-3 py-2 text-sm ${hasEmail ? 'cursor-pointer' : 'opacity-50'}`}>
                      <input type="checkbox" disabled={!hasEmail || sending} checked={hasEmail && selected.has(String(p.id))} onChange={() => toggle(String(p.id))} className="h-4 w-4 accent-sky-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-slate-800 dark:text-slate-100">{p.name}</span>
                        <span className="block truncate text-[11px] text-slate-500">{hasEmail ? p.email : 'Sem e-mail no cadastro'}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" disabled={sending} onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="button" disabled={sending || !total} onClick={handleSend} className="bg-sky-600 hover:bg-sky-500 text-white">
                {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando {progress} de {total}…</> : `Enviar para ${total}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
