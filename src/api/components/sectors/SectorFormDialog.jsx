import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

const empty = { name: '', specialty: '', unit: '', min_staff: 1, color: '#0284c7', active: true };

export default function SectorFormDialog({ open, onClose, onSaved, sector, companyId }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const isEdit = !!sector;

  useEffect(() => {
    if (open) setForm(sector ? { ...empty, ...sector } : empty);
  }, [open, sector]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    const payload = { 
      ...form, 
      min_staff: Number(form.min_staff) || 1, 
      company_id: companyId || 'cmp_principal' 
    };

    try {
      if (isEdit) {
        const { error } = await supabase.from('sectors').update(payload).eq('id', sector.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sectors').insert([payload]);
        if (error) throw error;
      }
      onSaved();
      onClose();
    } catch (err) {
      alert(err.message || 'Erro ao salvar setor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-2xl z-[9999] rounded-3xl p-6">
        <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <DialogTitle className="text-base font-black text-sky-600 dark:text-cyan-400">
            {isEdit ? 'Editar Setor' : 'Novo Setor Hospitalar'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          <div className="space-y-1.5">
            <Label className="font-bold text-slate-700 dark:text-slate-300">Nome do setor *</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="UTI Geral" required className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold text-slate-700 dark:text-slate-300">Especialidade</Label>
            <Input value={form.specialty} onChange={(e) => set('specialty', e.target.value)} placeholder="Clínica Médica" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold text-slate-700 dark:text-slate-300">Unidade / Ala</Label>
            <Input value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="Emergência Adulto" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700 dark:text-slate-300">Mínimo de profissionais</Label>
              <Input type="number" min="1" value={form.min_staff} onChange={(e) => set('min_staff', e.target.value)} className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700 dark:text-slate-300">Cor de destaque</Label>
              <div className="flex gap-2">
                <Input type="color" value={form.color} onChange={(e) => set('color', e.target.value)} className="w-12 h-11 p-1 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer" />
                <Input value={form.color} onChange={(e) => set('color', e.target.value)} className="flex-1 h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-mono uppercase" />
              </div>
            </div>
          </div>
          <DialogFooter className="pt-3 border-t border-slate-100 dark:border-slate-800 gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="h-10 text-xs font-bold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-5 cursor-pointer">Cancelar</Button>
            <Button type="submit" disabled={saving} className="h-10 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs px-6 rounded-xl shadow-md cursor-pointer transition-all">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Salvar' : 'Criar Setor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}