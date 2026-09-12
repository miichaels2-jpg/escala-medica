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

  const handlePhoneChange = (val) => {
    let r = val.replace(/\D/g, "");
    if (r.length > 11) r = r.slice(0, 11);
    
    if (r.length > 10) {
      r = r.replace(/^(\d\d)(\d{5})(\d{4}).*/, "($1) $2-$3");
    } else if (r.length > 5) {
      r = r.replace(/^(\d\d)(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    } else if (r.length > 2) {
      r = r.replace(/^(\d\d)(\d{0,5})/, "($1) $2");
    } else if (r.length > 0) {
      r = r.replace(/^(\d*)/, "($1");
    }
    set('phone', r);
  };

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
        company_id: companyId
      };

      if (isEdit) {
        await base44.entities.Professional.update(professional.id, payload);
      } else {
        await base44.entities.Professional.create(payload);
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Profissional' : 'Novo Profissional'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome completo *</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Registro (CRM/Coren)</Label>
              <Input value={form.document} onChange={(e) => set('document', e.target.value)} placeholder="12345" />
            </div>
            <div className="space-y-1.5">
              <Label>UF</Label>
              <Input value={form.document_uf} onChange={(e) => set('document_uf', e.target.value.toUpperCase())} placeholder="SP" maxLength={2} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="medico">Médico</SelectItem>
                  <SelectItem value="enfermeiro">Enfermeiro</SelectItem>
                  <SelectItem value="tecnico">Técnico</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Especialidade</Label>
              <Input value={form.specialty} onChange={(e) => set('specialty', e.target.value)} placeholder="Clínica Médica" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Cargo / Função</Label>
            <Input value={form.role} onChange={(e) => set('role', e.target.value)} placeholder="Diretor Médico, Enfermeiro, Coordenador..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => handlePhoneChange(e.target.value)} placeholder="(11) 99999-9999" maxLength={15} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor hora (R$)</Label>
              <Input type="number" step="0.01" value={form.hourly_rate} onChange={(e) => set('hourly_rate', e.target.value)} placeholder="80.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Valor por plantão (R$)</Label>
              <Input type="number" step="0.01" value={form.daily_rate} onChange={(e) => set('daily_rate', e.target.value)} placeholder="700.00" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Preferência</Label>
            <Select value={form.shift_preference} onValueChange={(v) => set('shift_preference', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="qualquer">Qualquer turno</SelectItem>
                <SelectItem value="diurno">Diurno</SelectItem>
                <SelectItem value="noturno">Noturno</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="ferias">Férias</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}