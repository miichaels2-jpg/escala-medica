import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';

const empty = { name: '', specialty: '', unit: '', min_staff: 1, color: '#0284c7', active: true };

export default function SectorFormDialog({ open, onClose, onSaved, sector, companyId, unitId }) {
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
    const payload = { ...form, min_staff: Number(form.min_staff) || 1, company_id: companyId, unit_id: unitId };
    try {
      if (isEdit) {
        await base44.entities.Sector.update(sector.id, payload);
      } else {
        await base44.entities.Sector.create(payload);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Setor' : 'Novo Setor'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome do setor *</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="UTI Geral" required />
          </div>
          <div className="space-y-1.5">
            <Label>Especialidade</Label>
            <Input value={form.specialty} onChange={(e) => set('specialty', e.target.value)} placeholder="Clínica Médica" />
          </div>
          <div className="space-y-1.5">
            <Label>Unidade / Ala</Label>
            <Input value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="Emergência Adulto" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mínimo de profissionais</Label>
              <Input type="number" min="1" value={form.min_staff} onChange={(e) => set('min_staff', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cor de destaque</Label>
              <div className="flex gap-2">
                <Input type="color" value={form.color} onChange={(e) => set('color', e.target.value)} className="w-14 h-10 p-1" />
                <Input value={form.color} onChange={(e) => set('color', e.target.value)} className="flex-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Salvar' : 'Criar Setor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}