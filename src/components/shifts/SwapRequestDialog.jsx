import { useEffect, useState, useMemo } from 'react';
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
import { Loader2, Repeat, ShieldAlert } from 'lucide-react';

export default function SwapRequestDialog({ open, onClose, onDone, shift, professionals, myProfessional, companyId }) {
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [allShifts, setAllShifts] = useState([]);

  // Carrega os plantões do sistema para verificar conflitos de agenda do colega
  useEffect(() => {
    if (open) {
      setTargetId('');
      setReason('');
      base44.entities.Shift.filter({ company_id: companyId }, '-date', 500)
        .then((res) => setAllShifts(res || []))
        .catch(() => setAllShifts([]));
    }
  }, [open, companyId]);

  if (!shift) return null;

  // Filtra apenas profissionais ativos e da mesma especialidade/categoria
  const eligibleOthers = useMemo(() => {
    if (!professionals || !shift) return [];
    const requesterSpecialty = (myProfessional?.specialty || myProfessional?.category || '').trim().toLowerCase();

    return professionals.filter((p) => {
      if (p.id === myProfessional?.id || p.status === 'inativo') return false;
      if (!requesterSpecialty) return true;
      const pSpec = (p.specialty || p.category || '').trim().toLowerCase();
      return pSpec === requesterSpecialty;
    });
  }, [professionals, myProfessional, shift]);

  // Verifica se o profissional selecionado já possui plantão no mesmo dia
  const selectedTargetProfessional = useMemo(() => {
    return professionals.find((p) => String(p.id) === String(targetId)) || null;
  }, [professionals, targetId]);

  const targetHasShiftOnSameDay = useMemo(() => {
    if (!targetId || !shift?.date) return false;
    const shiftDateClean = shift.date.split('T')[0];
    return allShifts.some((s) => {
      if (s.status === 'cancelado') return false;
      const sDateClean = (s.date || '').split('T')[0];
      return String(s.professional_id) === String(targetId) && sDateClean === shiftDateClean;
    });
  }, [allShifts, targetId, shift]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const isMural = !targetId; // Se deixar em branco, vai para o mural aberto
      
      const payload = {
        company_id: companyId,
        unit_id: shift.unit_id,
        shift_id: shift.id,
        shift_date: shift.date,
        shift_time: `${shift.start_time} - ${shift.end_time}`,
        sector_name: shift.sector_name || 'Geral',
        requester_professional_id: myProfessional?.id,
        requester_name: myProfessional?.name || 'Profissional',
        requester_specialty: myProfessional?.specialty || myProfessional?.category || 'Clínica Geral',
        target_professional_id: isMural ? null : selectedTargetProfessional?.id,
        target_name: isMural ? 'Mural Aberto (Qualquer Colega)' : selectedTargetProfessional?.name,
        target_specialty: isMural ? (myProfessional?.specialty || myProfessional?.category) : (selectedTargetProfessional?.specialty || selectedTargetProfessional?.category),
        swap_type: isMural ? 'mural' : 'direta',
        reason: reason.trim(),
        status: 'pendente',
        created_date: new Date().toISOString()
      };

      await base44.entities.ShiftSwap.create(payload);

      // Atualiza o status do plantão para refletir a pendência
      await base44.entities.Shift.update(shift.id, {
        status: 'pendente',
        notes: isMural 
          ? `Disponibilizado no Mural Aberto por ${myProfessional?.name}.` 
          : `Solicitação de troca direcionada para ${selectedTargetProfessional?.name}.`
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
      <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 font-semibold">
            <Repeat className="w-5 h-5 text-sky-600" /> Solicitar Troca ou Cessão
          </DialogTitle>
        </DialogHeader>
        
        <div className="mb-3 p-3 rounded-lg bg-sky-50 border border-sky-100 text-sm text-slate-700">
          <div className="font-semibold text-slate-800">{shift.date} · {shift.start_time} às {shift.end_time}</div>
          <div className="text-xs text-slate-500 mt-0.5">{shift.sector_name || 'Setor Geral'}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-slate-700 font-medium text-xs">
              Trocar com profissional específico (Opcional)
            </Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger className="bg-white border-slate-300 text-slate-900 text-xs focus:ring-sky-500 focus:border-sky-500">
                <SelectValue placeholder="Deixe em branco para enviar ao Mural Aberto" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-lg">
                <SelectItem value="" className="text-xs text-slate-500 italic">
                  -- Deixar vago (Mural de Oportunidades) --
                </SelectItem>
                {eligibleOthers.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs focus:bg-sky-50 focus:text-slate-900">
                    {p.name} {p.specialty ? `· ${p.specialty}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-slate-400 mt-0.5">
              * Se selecionar um colega, o pedido irá para a aba de homologação/aprovação dele. Se deixar em branco, irá para o Mural de Oportunidades restrito à especialidade.
            </p>
          </div>

          {/* ALERTA DE CONFLITO DE PLANTÃO NO MESMO DIA */}
          {targetHasShiftOnSameDay && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-amber-800 text-xs animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Atenção: Profissional de plantão nesse dia!</span>
                O colega selecionado já possui escala registrada nesta mesma data. Enviar a solicitação pode gerar duplicidade de plantão para ele.
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-slate-700 font-medium text-xs">Motivo</Label>
            <Input 
              value={reason} 
              onChange={(e) => setReason(e.target.value)} 
              placeholder="Ex: motivo pessoal, congresso..." 
              className="bg-white border-slate-300 text-slate-900 text-xs focus:ring-sky-500 focus:border-sky-500"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="border-slate-300 text-slate-700 hover:bg-slate-50 text-xs">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {targetId ? 'Enviar para Homologação' : 'Publicar no Mural'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}