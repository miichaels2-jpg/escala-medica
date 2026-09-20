import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

const empty = {
  date: '', start_time: '07:00', end_time: '19:00',
  shift_type: 'diurno', sector_id: '', professional_id: 'vago',
  status: 'vago', notes: ''
};

export default function ShiftFormDialog({ open, onClose, onSaved, shift, sectors, professionals, companyId, unitId }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const isEdit = !!shift;

  useEffect(() => {
    if (open) {
      setForm(shift ? {
        date: shift.date || '', start_time: shift.start_time || '07:00',
        end_time: shift.end_time || '19:00', shift_type: shift.shift_type || 'diurno',
        sector_id: shift.sector_id || '', 
        professional_id: shift.professional_id || 'vago',
        status: shift.status || 'vago', notes: shift.notes || ''
      } : empty);
    }
  }, [open, shift]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const sector = sectors.find((s) => String(s.id) === String(form.sector_id));
      const isVago = form.professional_id === 'vago' || !form.professional_id;
      const prof = !isVago ? professionals.find((p) => String(p.id) === String(form.professional_id)) : null;
      
      const payload = {
        ...form,
        professional_id: isVago ? null : form.professional_id,
        sector_name: sector?.name || '',
        professional_name: prof?.name || '',
        status: isVago ? 'vago' : (form.status === 'vago' ? 'pendente' : form.status),
        company_id: companyId || 'cmp_principal',
        ...(unitId ? { unit_id: unitId } : {}),
        updated_date: new Date().toISOString()
      };

      if (isEdit) {
        const { error } = await supabase.from('shifts').update(payload).eq('id', shift.id);
        if (error) throw error;
      } else {
        payload.created_date = new Date().toISOString();
        const { error } = await supabase.from('shifts').insert([payload]);
        if (error) throw error;
      }
      onSaved();
      onClose();
    } catch (err) {
      alert(err.message || 'Erro ao salvar plantão');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-2xl z-[9999] rounded-3xl p-6">
        <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <DialogTitle className="text-base font-black text-sky-600 dark:text-cyan-400">
            {isEdit ? 'Editar Plantão' : 'Novo Plantão / Escala'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700 dark:text-slate-300">Data *</Label>
              <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700 dark:text-slate-300">Tipo</Label>
              <Select value={form.shift_type} onValueChange={(v) => set('shift_type', v)}>
                <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
                  <SelectItem value="diurno">Diurno</SelectItem>
                  <SelectItem value="noturno">Noturno</SelectItem>
                  <SelectItem value="intermediario">Intermediário</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700 dark:text-slate-300">Início *</Label>
              <Input type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} required className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700 dark:text-slate-300">Fim *</Label>
              <Input type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} required className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl font-mono" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold text-slate-700 dark:text-slate-300">Setor / Especialidade</Label>
            <Select value={form.sector_id} onValueChange={(v) => set('sector_id', v)}>
              <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl font-bold"><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name} {s.specialty ? `· ${s.specialty}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold text-slate-700 dark:text-slate-300">Profissional</Label>
            <Select value={form.professional_id} onValueChange={(v) => set('professional_id', v)}>
              <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl font-bold"><SelectValue placeholder="Deixe vago para não alocar" /></SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
                <SelectItem value="vago" className="text-amber-600 dark:text-amber-400 font-bold">Deixar Vago (Mural)</SelectItem>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold text-slate-700 dark:text-slate-300">Status</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl font-bold"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
                <SelectItem value="vago">Vago</SelectItem>
                <SelectItem value="pendente">Aguardando confirmação</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="pt-3 border-t border-slate-100 dark:border-slate-800 gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="h-10 text-xs font-bold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-5 cursor-pointer">Cancelar</Button>
            <Button type="submit" disabled={saving} className="h-10 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs px-6 rounded-xl shadow-md cursor-pointer transition-all">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Salvar' : 'Criar Plantão'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}