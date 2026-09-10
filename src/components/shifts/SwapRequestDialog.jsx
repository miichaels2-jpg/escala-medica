import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { Loader2, Repeat } from 'lucide-react';

export default function SwapRequestDialog({ open, onClose, onDone, shift, professionals, myProfessional, companyId, unitId }) {
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setTargetId(''); setReason(''); }
  }, [open]);

  if (!shift) return null;

  const others = professionals.filter((p) => p.id !== (myProfessional?.id || '') && p.status === 'ativo');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const target = professionals.find((p) => p.id === targetId);
    try {
      await base44.functions.invoke('manageShiftSwap', {
        action: 'request',
        shiftId: shift.id,
        companyId,
        unitId,
        requesterId: myProfessional?.id || 'manager-request',
        requesterName: myProfessional?.name || 'Gestor',
        targetId: targetId || '',
        targetName: target?.name || '',
        reason,
        shiftDate: shift.date,
        shiftTime: `${shift.start_time} - ${shift.end_time}`,
        sectorName: shift.sector_name
      });
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Repeat className="w-5 h-5 text-sky-600" /> Solicitar Troca de Plantão</DialogTitle>
        </DialogHeader>
        <div className="mb-4 p-3 rounded-lg bg-sky-50 border border-sky-100 text-sm text-slate-600">
          <div className="font-semibold text-slate-700">{shift.date} · {shift.start_time} às {shift.end_time}</div>
          <div className="text-xs text-slate-500 mt-0.5">{shift.sector_name}</div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Trocar com (opcional)</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger><SelectValue placeholder="Deixe em branco se não houver" /></SelectTrigger>
              <SelectContent>
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
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar solicitação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}