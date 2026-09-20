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
import { supabase } from '@/lib/supabase';
import { Loader2, Repeat, ShieldAlert } from 'lucide-react';

export default function SwapRequestDialog({ open, onClose, onDone, shift, professionals, myProfessional, companyId }) {
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [allShifts, setAllShifts] = useState([]);

  useEffect(() => {
    if (open && shift) {
      setTargetId('');
      setReason('');
      supabase.from('shifts')
        .select('*')
        .eq('company_id', companyId || 'cmp_principal')
        .order('date', { ascending: false })
        .limit(500)
        .then(({ data }) => setAllShifts(data || []))
        .catch(() => setAllShifts([]));
    }
  }, [open, shift, companyId]);

  if (!shift) return null;

  // Filtra profissionais da mesma especialidade ou categoria
  const eligibleOthers = useMemo(() => {
    if (!professionals || !myProfessional) return professionals || [];
    const requesterSpecialty = (myProfessional.specialty || myProfessional.category || '').trim().toLowerCase();

    return professionals.filter((p) => {
      if (String(p.id) === String(myProfessional.id) || p.status === 'inativo') return false;
      if (!requesterSpecialty) return true;
      const pSpec = (p.specialty || p.category || '').trim().toLowerCase();
      return !pSpec || pSpec === requesterSpecialty;
    });
  }, [professionals, myProfessional]);

  // Validação de conflito: verifica se o colega escolhido já tem plantão no mesmo dia
  const targetHasShiftOnSameDay = useMemo(() => {
    if (!targetId || !shift?.date) return false;
    const shiftDateClean = shift.date.split('T')[0];
    return allShifts.some((s) => {
      if (s.status === 'cancelado') return false;
      const sDateClean = (s.date || '').split('T')[0];
      return String(s.professional_id) === String(targetId) && sDateClean === shiftDateClean;
    });
  }, [allShifts, targetId, shift]);

  const targetProf = useMemo(() => {
    return professionals.find((p) => String(p.id) === String(targetId)) || null;
  }, [professionals, targetId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const isMural = !targetId;

      const payload = {
        company_id: companyId || 'cmp_principal',
        unit_id: shift.unit_id,
        shift_id: shift.id,
        shift_date: shift.date,
        shift_time: `${shift.start_time || '07:00'} - ${shift.end_time || '19:00'}`,
        sector_name: shift.sector_name || 'Geral',
        requester_professional_id: myProfessional?.id,
        requester_name: myProfessional?.name || 'Profissional',
        requester_specialty: myProfessional?.specialty || myProfessional?.category || 'Clínica Geral',
        target_professional_id: isMural ? null : targetProf?.id,
        target_name: isMural ? 'Mural Aberto (Qualquer Colega)' : targetProf?.name,
        target_specialty: isMural ? (myProfessional?.specialty || myProfessional?.category) : (targetProf?.specialty || targetProf?.category),
        swap_type: isMural ? 'mural' : 'direta',
        reason: reason.trim(),
        status: 'pendente',
        created_date: new Date().toISOString()
      };

      const { error: swapError } = await supabase.from('shift_swaps').insert([payload]);
      if (swapError) throw swapError;

      // Atualiza o status do plantão original para pendente
      const { error: shiftError } = await supabase.from('shifts').update({
        status: 'pendente',
        notes: isMural 
          ? `Disponibilizado no Mural Aberto por ${myProfessional?.name || 'Profissional'}.` 
          : `Solicitação de troca direcionada para ${targetProf?.name}.`
      }).eq('id', shift.id);

      if (shiftError) throw shiftError;

      if (onDone) onDone();
      if (onClose) onClose();
    } catch (err) {
      alert(err.message || 'Erro ao solicitar troca');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-2xl z-[9999] rounded-3xl p-6">
        <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <DialogTitle className="flex items-center gap-2 font-black text-base text-sky-600 dark:text-cyan-400">
            <Repeat className="w-5 h-5" /> Solicitar Troca ou Cessão de Plantão
          </DialogTitle>
        </DialogHeader>

        <div className="mb-3 p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/50 text-xs text-slate-700 dark:text-slate-300">
          <div className="font-bold text-slate-900 dark:text-white">{shift.date} · {shift.start_time} às {shift.end_time}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{shift.sector_name || 'Setor Geral'}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          <div className="space-y-1.5">
            <Label className="font-bold text-slate-700 dark:text-slate-300">
              Trocar com profissional específico (Opcional)
            </Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl font-bold">
                <SelectValue placeholder="Deixe em branco para enviar ao Mural Aberto" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
                <SelectItem value="" className="text-xs text-slate-500 italic">
                  -- Deixar vago (Mural de Oportunidades) --
                </SelectItem>
                {eligibleOthers.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs font-bold">
                    {p.name} {p.specialty ? `· ${p.specialty}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-slate-400 mt-1">
              * Se selecionar um colega, o pedido irá para a aba de homologação dele. Se deixar em branco, irá para o Mural de Oportunidades.
            </p>
          </div>

          {targetHasShiftOnSameDay && (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-2 text-amber-800 dark:text-amber-200 text-xs animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-black block">Atenção: Profissional de plantão nesse dia!</span>
                O colega selecionado já possui escala registrada nesta mesma data.
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="font-bold text-slate-700 dark:text-slate-300">Motivo da solicitação (opcional)</Label>
            <Input 
              value={reason} 
              onChange={(e) => setReason(e.target.value)} 
              placeholder="Ex: motivo pessoal, saúde..." 
              className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100 dark:border-slate-800 gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="h-10 text-xs font-bold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-5 cursor-pointer">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="h-10 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs px-6 rounded-xl shadow-md cursor-pointer transition-all">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {targetId ? 'Enviar para Homologação' : 'Publicar no Mural'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}