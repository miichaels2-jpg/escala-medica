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
  date: '', start_time: '07:00', end_time: '19:00',
  shift_type: 'diurno', sector_id: '', professional_id: '',
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
        sector_id: shift.sector_id || '', professional_id: shift.professional_id || '',
        status: shift.status || 'vago', notes: shift.notes || ''
      } : empty);
    }
  }, [open, shift]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const sector = sectors.find((s) => s.id === form.sector_id);
    const prof = professionals.find((p) => p.id === form.professional_id);
    
    const payload = {
      ...form,
      sector_name: sector?.name || '',
      professional_name: prof?.name || '',
      status: form.professional_id ? (form.status === 'vago' ? 'pendente' : form.status) : 'vago',
      company_id: companyId,
      ...(unitId ? { unit_id: unitId } : {}),
      updated_date: new Date().toISOString()
    };

    try {
      if (isEdit) {
        await base44.entities.Shift.update(shift.id, payload);
      } else {
        payload.created_date = new Date().toISOString();
        await base44.entities.Shift.create(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Erro ao salvar plantão');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Plantão' : 'Novo Plantão'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.shift_type} onValueChange={(v) => set('shift_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diurno">Diurno</SelectItem>
                  <SelectItem value="noturno">Noturno</SelectItem>
                  <SelectItem value="intermediario">Intermediário</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Fim</Label>
              <Input type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Setor / Especialidade</Label>
            <Select value={form.sector_id} onValueChange={(v) => set('sector_id', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
              <SelectContent>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} {s.specialty ? `· ${s.specialty}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Profissional</Label>
            <Select value={form.professional_id} onValueChange={(v) => set('professional_id', v)}>
              <SelectTrigger><SelectValue placeholder="Deixe vago para não alocar" /></SelectTrigger>
              <SelectContent>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} {p.document ? `· ${p.document}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vago">Vago</SelectItem>
                <SelectItem value="pendente">Aguardando confirmação</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Salvar' : 'Criar Plantão'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </Dialog>
  );
}