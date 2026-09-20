import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
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
    
    const isMuralAberto = !targetId || targetId === 'vago';
    const target = !isMuralAberto ? professionals.find((p) => p.id === targetId) : null;
    
    try {
      const payload = {
        company_id: companyId || 'cmp_principal',
        shift_id: shift.id,
        requester_professional_id: myProfessional?.id || null,
        requester_name: myProfessional?.name || 'Profissional',
        target_professional_id: isMuralAberto ? null : targetId,
        target_name: target?.name || 'Mural Aberto (Qualquer Colega)',
        reason: reason.trim(),
        shift_date: shift.date,
        shift_time: `${shift.start_time} - ${shift.end_time}`,
        sector_name: shift.sector_name || 'Geral',
        swap_type: isMuralAberto ? 'mural' : 'cessao',
        status: 'pendente',
        created_date: new Date().toISOString()
      };

      const { error } = await supabase.from('shift_swaps').insert([payload]);
      if (error) throw error;
      
      onDone();
      onClose();
    } catch (err) {
      alert(err.message || 'Erro ao solicitar troca');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-3xl p-6 shadow-2xl z-[9999]">
        <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base font-black text-sky-600 dark:text-cyan-400">
            <Repeat className="w-5 h-5 text-sky-600 dark:text-cyan-400" /> Solicitar Troca de Plantão
          </DialogTitle>
        </DialogHeader>
        <div className="my-3 p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 text-xs text-sky-900 dark:text-sky-200">
          <div className="font-bold">{shift.date} · {shift.start_time} às {shift.end_time}</div>
          <div className="text-[11px] opacity-80 mt-0.5">{shift.sector_name}</div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <Label className="font-bold text-slate-700 dark:text-slate-300">Trocar com (opcional)</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 rounded-xl font-bold"><SelectValue placeholder="Deixe em branco para Mural Aberto" /></SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
                <SelectItem value="vago" className="text-amber-600 font-bold">Mural Aberto (Qualquer pessoa)</SelectItem>
                {others.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}{p.specialty ? ` · ${p.specialty}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold text-slate-700 dark:text-slate-300">Motivo</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: motivo pessoal, saúde..." className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 rounded-xl font-medium" />
          </div>
          <DialogFooter className="pt-3 border-t border-slate-100 dark:border-slate-800 gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="h-10 text-xs font-bold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-5 cursor-pointer">Cancelar</Button>
            <Button type="submit" disabled={saving} className="h-10 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs px-6 rounded-xl shadow-md cursor-pointer transition-all">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar solicitação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}