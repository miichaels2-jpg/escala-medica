// Minha Escala › "Nota fiscal de <mês>": o profissional PJ envia a nota de cada unidade
// em que trabalhou no mês e acompanha se foi aceita ou devolvida.
import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { INVOICE_STATUS, invoiceKey, invoiceState, isPjProfessional } from '@/lib/invoiceRules';
import { fetchInvoices, openInvoiceFile, uploadInvoice } from '@/lib/invoices';

const TONE = {
  amber: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  sky: 'bg-sky-50 text-sky-800 dark:bg-sky-500/10 dark:text-sky-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
};

export default function InvoiceCard({ professional, companyId, month, monthName, units = [], uploadedBy }) {
  const [invoices, setInvoices] = useState(() => new Map());
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const pendingUnit = useRef(null);
  const enabled = isPjProfessional(professional) && units.length > 0;

  const load = useCallback(async () => {
    if (!enabled || !professional?.id) return;
    try {
      setInvoices(await fetchInvoices({ companyId, professionalId: professional.id, month }));
    } catch (e) {
      setError(e?.message || 'Não foi possível carregar as notas.');
    }
  }, [enabled, companyId, professional?.id, month]);

  useEffect(() => { load(); }, [load]);

  if (!enabled) return null;

  const choose = unitId => {
    pendingUnit.current = unitId;
    setError('');
    inputRef.current?.click();
  };

  const onFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const unitId = pendingUnit.current;
    if (!file || !unitId) return;
    setBusy(unitId);
    try {
      const previous = invoices.get(invoiceKey(unitId, professional.id, month));
      const saved = await uploadInvoice({ file, companyId, unitId, professionalId: professional.id, month, uploadedBy, previous });
      setInvoices(prev => new Map(prev).set(invoiceKey(unitId, professional.id, month), saved));
    } catch (e) {
      setError(e?.message || 'Não foi possível enviar a nota. Tente de novo.');
    } finally {
      setBusy('');
    }
  };

  const open = async invoice => {
    try { await openInvoiceFile(invoice); } catch (e) { setError(e?.message || 'Não foi possível abrir a nota.'); }
  };

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-slate-400" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Nota fiscal de {monthName}</h2>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Uma nota por unidade, em PDF ou foto (até 10 MB). O pagamento é liberado depois que a coordenação aceita a nota.</p>
      <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={onFile} />
      <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {units.map(unit => {
          const invoice = invoices.get(invoiceKey(unit.unitId, professional.id, month));
          const state = invoiceState(invoice);
          const info = INVOICE_STATUS[state];
          return (
            <li key={unit.unitId} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{unit.name}</p>
                <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[info.tone]}`}>{info.label}</span>
                {state === 'devolvida' && invoice.review_note && (
                  <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">Motivo: {invoice.review_note}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {invoice && (
                  <Button size="sm" variant="ghost" onClick={() => open(invoice)} className="h-8 rounded-lg text-xs cursor-pointer">Ver</Button>
                )}
                {state !== 'aceita' && (
                  <Button size="sm" variant="outline" disabled={busy === unit.unitId} onClick={() => choose(unit.unitId)} className="h-8 rounded-lg text-xs gap-1.5 cursor-pointer">
                    {busy === unit.unitId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {busy === unit.unitId ? 'Enviando…' : invoice ? 'Enviar outra' : 'Enviar nota'}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</p>}
    </section>
  );
}
