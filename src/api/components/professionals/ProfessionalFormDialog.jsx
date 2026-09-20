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
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

const empty = {
  name: '', document: '', document_uf: '', specialty: '',
  category: 'medico', role: 'Médico', phone: '', email: '', hourly_rate: '', daily_rate: '',
  shift_preference: 'qualquer', status: 'ativo'
};

export default function ProfessionalFormDialog({ open, onClose, onSaved, professional, companyId }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const isEdit = !!professional;

  useEffect(() => {
    if (open) setForm(professional ? { ...empty, ...professional } : empty);
  }, [open, professional]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const valueFromHourly = form.hourly_rate !== '' && form.hourly_rate !== null && form.hourly_rate !== undefined
        ? Number(form.hourly_rate)
        : null;
      const valueFromDaily = form.daily_rate !== '' && form.daily_rate !== null && form.daily_rate !== undefined
        ? Number(form.daily_rate)
        : valueFromHourly;

      const payload = {
        ...form,
        name: form.name.trim(),
        role: form.role || 'Profissional',
        hourly_rate: valueFromHourly,
        daily_rate: valueFromDaily,
        company_id: companyId || 'cmp_principal'
      };

      if (isEdit) {
        const { error } = await supabase.from('professionals').update(payload).eq('id', professional.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('professionals').insert([payload]);
        if (error) throw error;
      }

      onSaved();
      onClose();
    } catch (err) {
      alert(err.message || 'Erro ao salvar profissional');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Profissional' : 'Novo Profissional'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome completo *</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Registro (CRM/Coren)</Label>
              <Input value={form.document} onChange={(e) => set('document', e.target.value)} placeholder="12345" className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>UF</Label>
              <Input value={form.document_uf} onChange={(e) => set('document_uf', e.target.value.toUpperCase())} placeholder="SP" maxLength={2} className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 uppercase" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v)}>
                <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
                  <SelectItem value="medico">Médico</SelectItem>
                  <SelectItem value="enfermeiro">Enfermeiro</SelectItem>
                  <SelectItem value="tecnico">Técnico</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Especialidade</Label>
              <Input value={form.specialty} onChange={(e) => set('specialty', e.target.value)} placeholder="Clínica Médica" className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Cargo / Função</Label>
            <Input value={form.role} onChange={(e) => set('role', e.target.value)} placeholder="Diretor Médico, Enfermeiro, Coordenador..." className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(11) 99999-9999" className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor hora (R$)</Label>
              <Input type="number" step="0.01" value={form.hourly_rate} onChange={(e) => set('hourly_rate', e.target.value)} placeholder="80.00" className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Valor por plantão (R$)</Label>
              <Input type="number" step="0.01" value={form.daily_rate} onChange={(e) => set('daily_rate', e.target.value)} placeholder="700.00" className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Preferência</Label>
            <Select value={form.shift_preference} onValueChange={(v) => set('shift_preference', v)}>
              <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
                <SelectItem value="qualquer">Qualquer turno</SelectItem>
                <SelectItem value="diurno">Diurno</SelectItem>
                <SelectItem value="noturno">Noturno</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="ferias">Férias</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="border-slate-200 dark:border-slate-700 cursor-pointer">Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-sky-600 hover:bg-sky-500 text-white font-black cursor-pointer">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}