import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Corpo Clínico › "Convidar equipe": código e link de credenciamento do hospital.
// A ficha preenchida pelo profissional chega na aba "Pendentes".
function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { window.prompt('Copie:', value); }
  };
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm">{value}</code>
        <Button type="button" variant="outline" onClick={copy} className="h-9 px-3 rounded-lg gap-1.5 shrink-0 cursor-pointer">
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />} {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
    </div>
  );
}

export default function InviteTeamDialog({ open, onOpenChange, code }) {
  const link = code ? `${window.location.origin}/register?empresa=${code}` : '';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convidar equipe</DialogTitle>
        </DialogHeader>
        {code ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">Mande o link para os profissionais (por WhatsApp, e-mail…). Cada um preenche a própria ficha e ela chega na aba <b>Pendentes</b> para você aprovar.</p>
            <CopyField label="Link (já abre com o hospital preenchido)" value={link} />
            <CopyField label="Código do hospital (para quem abrir pela tela de entrada)" value={code} />
            <p className="text-xs text-slate-500 dark:text-slate-400">Para cadastrar alguém você mesmo, use “Novo profissional”.</p>
          </div>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">Esta empresa ainda não tem código de credenciamento. Peça ao suporte do ScaleMedic.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
