import React, { useState, useMemo } from 'react';
import { useAppData } from '@/lib/useAppData';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Building2, Plus, Search, Edit3, Ban, CheckCircle2, 
  MapPin, Stethoscope, Layers, AlertCircle, Clock
} from 'lucide-react';

export default function Setores() {
  const { 
    sectors, 
    units, 
    selectedUnitId, 
    companyId, 
    isManager, 
    syncGlobalData 
  } = useAppData();

  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    location: '',
    unit_id: '',
    status: 'ativo',
    description: ''
  });

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      location: '',
      unit_id: selectedUnitId || (units[0]?.id || 'unit_h1'),
      status: 'ativo',
      description: ''
    });
    setEditingId(null);
  };

  const handleOpenNew = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleOpenEdit = (sector) => {
    setEditingId(sector.id);
    setFormData({
      name: sector.name || '',
      code: sector.code || '',
      location: sector.location || '',
      unit_id: sector.unit_id || selectedUnitId,
      status: sector.status || 'ativo',
      description: sector.description || ''
    });
    setModalOpen(true);
  };

  const handleToggleSectorStatus = async (sector) => {
    const nextStatus = sector.status === 'inativo' ? 'ativo' : 'inativo';
    const msg = nextStatus === 'inativo' 
      ? `Inativar o setor "${sector.name}"? Ele não aparecerá para novas escalas, mas os plantões antigos e relatórios serão preservados.` 
      : `Reativar o setor "${sector.name}"?`;

    if (!confirm(msg)) return;

    try {
      await base44.entities.Sector.update(sector.id, { status: nextStatus });
      await syncGlobalData();
    } catch (err) {
      alert('Erro ao alterar status do setor: ' + err.message);
    }
  };

  const handleSaveSector = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Informe o nome do setor.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        company_id: companyId || 'cmp_principal',
        unit_id: formData.unit_id || selectedUnitId,
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        location: formData.location.trim(),
        status: formData.status,
        description: formData.description.trim()
      };

      if (editingId) {
        await base44.entities.Sector.update(editingId, payload);
      } else {
        await base44.entities.Sector.create(payload);
      }

      setModalOpen(false);
      resetForm();
      await syncGlobalData();
      alert('Setor salvo com sucesso!');
    } catch (err) {
      alert('Erro ao salvar setor: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSectors = useMemo(() => {
    const term = searchQuery.toLowerCase().trim();
    return sectors.filter(s => {
      if (!term) return true;
      return (s.name || '').toLowerCase().includes(term) || (s.code || '').toLowerCase().includes(term);
    });
  }, [sectors, searchQuery]);

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans">
      
      {/* BANNER PRINCIPAL */}
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
            <Building2 className="w-4 h-4" /> Estrutura Hospitalar
          </div>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black">Setores & Unidades de Atendimento</h2>
          <p className="text-xs text-slate-300">
            Cadastro de alas, UTIs, pronto atendimento e centros cirúrgicos que alimentam as escalas e relatórios.
          </p>
        </div>

        {isManager && (
          <Button onClick={handleOpenNew} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-lg gap-1.5 shrink-0">
            <Plus className="w-4 h-4" /> Novo Setor
          </Button>
        )}
      </div>

      {/* BARRA DE FILTRO */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
        <span className="text-xs font-bold text-slate-500">
          Total de setores: {filteredSectors.length}
        </span>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input 
            placeholder="Buscar por setor ou sigla..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            className="pl-9 h-9 text-xs" 
          />
        </div>
      </div>

      {/* GRID DE SETORES */}
      {filteredSectors.length === 0 ? (
        <Card className="p-16 text-center border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">Nenhum setor cadastrado</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Cadastre os setores operacionais (ex: UTI, PA, Centro Cirúrgico) para poder gerar escalas.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSectors.map(sector => {
            const isInactive = sector.status === 'inativo';

            return (
              <Card 
                key={sector.id} 
                className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-4 shadow-sm ${
                  isInactive 
                    ? 'border-slate-200 dark:border-slate-800 opacity-60 bg-slate-50 dark:bg-slate-950' 
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="font-black text-sm text-slate-900 dark:text-white">
                        {sector.name}
                      </h3>
                      {sector.code && (
                        <span className="text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-900 mt-1 inline-block">
                          {sector.code}
                        </span>
                      )}
                    </div>

                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                      isInactive 
                        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30' 
                        : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                    }`}>
                      {sector.status || 'Ativo'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    {sector.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>Localização: <b>{sector.location}</b></span>
                      </div>
                    )}
                    {sector.description && (
                      <p className="text-[11px] text-slate-500 italic mt-1 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                        "{sector.description}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleOpenEdit(sector)} 
                    className="flex-1 text-xs h-8 gap-1 font-bold"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-indigo-600" /> Editar Setor
                  </Button>

                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => handleToggleSectorStatus(sector)} 
                    className={`text-xs h-8 px-2.5 ${isInactive ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}
                    title={isInactive ? 'Reativar setor' : 'Inativar setor'}
                  >
                    {isInactive ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL: CRIAR OU EDITAR SETOR */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              {editingId ? 'Editar Setor Hospitalar' : 'Cadastrar Novo Setor'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveSector} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Nome do Setor *</Label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="Ex: UTI Adulto Geral, Pronto Atendimento, Pediatria" 
                className="h-9" 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Sigla / Código</Label>
                <Input 
                  value={formData.code} 
                  onChange={e => setFormData({...formData, code: e.target.value})} 
                  placeholder="Ex: UTI-A, PA, CC" 
                  className="h-9" 
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Localização / Andar</Label>
                <Input 
                  value={formData.location} 
                  onChange={e => setFormData({...formData, location: e.target.value})} 
                  placeholder="Ex: 2º Andar, Bloco B" 
                  className="h-9" 
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Unidade Hospitalar Vinculada</Label>
              <Select value={formData.unit_id} onValueChange={v => setFormData({...formData, unit_id: v})}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {units.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Observações / Descrição</Label>
              <Input 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
                placeholder="Ex: Exige especialista RQE em terapia intensiva" 
                className="h-9" 
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="text-xs h-9">
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-5">
                {submitting ? 'Salvando...' : 'Salvar Setor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}