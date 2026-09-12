import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { Loader2, Repeat } from 'lucide-react';

export default function SwapRequestDialog({ open, onClose, onDone, shift, professionals, myProfessional, companyId }) {
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setTargetId(''); setReason(''); }
  }, [open]);

  if (!shift) return null;

  const others = professionals.filter((p) => p.id !== myProfessional?.id && p.status === 'ativo');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const target = professionals.find((p) => p.id === targetId);
    
    try {
      // Fim do invoke também nas trocas! Criamos o ShiftSwap diretamente.
      const payload = {
        company_id: companyId,
        shift_id: shift.id,
        requester_professional_id: myProfessional?.id,
        requester_name: myProfessional?.name || 'Profissional',
        target_professional_id: targetId || null,
        target_name: target?.name || 'Mural Aberto (Qualquer Colega)',
        reason: reason.trim(),
        shift_date: shift.date,
        shift_time: `${shift.start_time} - ${shift.end_time}`,
        sector_name: shift.sector_name || 'Geral',
        swap_type: targetId ? 'cessao' : 'mural',
        status: 'pendente',
        created_date: new Date().toISOString()
      };

      await base44.entities.ShiftSwap.create(payload);
      
      onDone();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Erro ao solicitar troca');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md dark:bg-slate-900 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Repeat className="w-5 h-5 text-sky-600" /> Solicitar Troca de Plantão</DialogTitle>
        </DialogHeader>
        <div className="mb-4 p-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900 text-sm text-slate-600 dark:text-slate-300">
          <div className="font-semibold">{shift.date} · {shift.start_time} às {shift.end_time}</div>
          <div className="text-xs mt-0.5">{shift.sector_name}</div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Trocar com (opcional)</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger><SelectValue placeholder="Deixe em branco para Mural Aberto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vago" className="text-amber-600 font-bold">Mural Aberto (Qualquer pessoa)</SelectItem>
                {others.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}{p.specialty ? ` · ${p.specialty}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: motivo pessoal, saúde..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-sky-600 hover:bg-sky-700 text-white">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar solicitação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}