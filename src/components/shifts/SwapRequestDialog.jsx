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
      // Se houver suporte a invoke, tenta por ele; caso contrário, grava diretamente na entidade de solicitações/plantão
      if (base44.functions?.invoke) {
        await base44.functions.invoke('manageShiftSwap', {
          action: 'request',
          shiftId: shift.id,
          companyId,
          requesterId: myProfessional?.id,
          requesterName: myProfessional?.name,
          targetId: targetId || '',
          targetName: target?.name || '',
          reason,
          shiftDate: shift.date,
          shiftTime: `${shift.start_time} - ${shift.end_time}`,
          sectorName: shift.sector_name
        });
      } else if (base44.entities?.ShiftSwap?.create) {
        await base44.entities.ShiftSwap.create({
          action: 'request',
          shift_id: shift.id,
          company_id: companyId,
          requester_id: myProfessional?.id,
          requester_name: myProfessional?.name,
          target_id: targetId || '',
          target_name: target?.name || '',
          reason,
          status: 'pendente',
          created_date: new Date().toISOString()
        });
      } else {
        // Fallback direto atualizando o status do plantão para refletir a pendência de troca
        await base44.entities.Shift.update(shift.id, {
          status: 'pendente',
          notes: `Solicitação de troca por ${myProfessional?.name || 'Profissional'}. Motivo: ${reason}`
        });
      }

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
      <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 font-semibold">
            <Repeat className="w-5 h-5 text-sky-600" /> Solicitar Troca de Plantão
          </DialogTitle>
        </DialogHeader>
        <div className="mb-4 p-3 rounded-lg bg-sky-50 border border-sky-100 text-sm text-slate-700">
          <div className="font-semibold text-slate-800">{shift.date} · {shift.start_time} às {shift.end_time}</div>
          <div className="text-xs text-slate-500 mt-0.5">{shift.sector_name}</div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-slate-700 font-medium">Trocar com (opcional)</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger className="bg-white border-slate-300 text-slate-900 focus:ring-sky-500 focus:border-sky-500">
                <SelectValue placeholder="Deixe em branco se não houver" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-lg">
                {others.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="focus:bg-sky-50 focus:text-slate-900">
                    {p.name}{p.specialty ? ` · ${p.specialty}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-700 font-medium">Motivo</Label>
            <Input 
              value={reason} 
              onChange={(e) => setReason(e.target.value)} 
              placeholder="Ex: motivo pessoal, saúde..." 
              className="bg-white border-slate-300 text-slate-900 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} className="border-slate-300 text-slate-700 hover:bg-slate-50">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="bg-sky-600 hover:bg-sky-700 text-white font-medium">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar solicitação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}