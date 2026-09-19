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
  Building2, Plus, Search, Edit, Trash2, 
  Activity, CheckCircle2, AlertTriangle, 
  MapPin, Stethoscope, Save, X, Network
} from 'lucide-react';

export default function Setores() {
  const { sectors = [], company, selectedUnitId, syncGlobalData } = useAppData();

  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSector, setEditingSector] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Estado do Formulário (Sem capacidade de leitos)
  const [formData, setFormData] = useState({
    name: '',
    specialty: '',
    status: 'ativo'
  });

  // Extrair especialidades únicas para o Datalist (Autocompletar)
  const registeredSpecialties = useMemo(() => {
    const set = new Set();
    sectors.forEach(s => {
      if (s.specialty && s.specialty.trim()) set.add(s.specialty.trim());
    });
    return Array.from(set).sort();
  }, [sectors]);

  // Filtragem e Ordenação
  const filteredSectors = useMemo(() => {
    const term = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    
    return sectors.filter(s => {
      if (!term) return true;
      const name = (s.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const spec = (s.specialty || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return name.includes(term) || spec.includes(term);
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [sectors, searchQuery]);

  // Métricas
  const metrics = useMemo(() => {
    let ativos = 0;
    let inativos = 0;

    sectors.forEach(s => {
      if (s.status === 'inativo') inativos++;
      else ativos++;
    });

    return { total: sectors.length, ativos, inativos, especialidades: registeredSpecialties.length };
  }, [sectors, registeredSpecialties]);

  // Ações do CRUD
  const handleOpenModal = (sector = null) => {
    if (sector) {
      setEditingSector(sector);
      setFormData({
        name: sector.name || '',
        specialty: sector.specialty || '',
        status: sector.status || 'ativo'
      });
    } else {
      setEditingSector(null);
      setFormData({
        name: '',
        specialty: '',
        status: 'ativo'
      });
    }
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("O nome do setor é obrigatório.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        company_id: company?.id || 'cmp_principal',
        unit_id: selectedUnitId || 'unit_h1',
        name: formData.name.trim(),
        specialty: formData.specialty.trim() || 'Geral',
        status: formData.status
      };

      if (editingSector?.id) {
        await base44.entities.Sector.update(editingSector.id, payload);
      } else {
        await base44.entities.Sector.create(payload);
      }

      setModalOpen(false);
      await syncGlobalData();
    } catch (error) {
      alert('Erro ao salvar setor: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Tem certeza que deseja excluir permanentemente o setor "${name}"? Esta ação pode afetar escalas vinculadas.`)) {
      return;
    }
    try {
      await base44.entities.Sector.delete(id);
      await syncGlobalData();
    } catch (error) {
      alert('Erro ao excluir: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 p-4 md:p-8 space-y-6 font-sans transition-colors duration-300">
      
      {/* HEADER EXECUTIVO */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] p-6 md:p-8 shadow-xl flex flex-col xl:flex-row xl:items-center justify-between gap-6 transition-colors duration-300">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-sky-600 dark:text-cyan-400">
            <Activity className="w-4 h-4 text-sky-600 dark:text-cyan-400 animate-pulse" /> Estrutura Organizacional
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Gestão de Setores & Especialidades
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-2xl">
            Cadastre as unidades de atendimento, alas hospitalares e parametrize as especialidades clínicas exigidas para cada posto.
          </p>
        </div>

        <div className="shrink-0">
          <Button 
            onClick={() => handleOpenModal()} 
            className="w-full sm:w-auto h-12 bg-sky-600 hover:bg-sky-700 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-black text-xs px-6 rounded-2xl shadow-lg gap-2 cursor-pointer transition-all hover:scale-105 border border-sky-500 dark:border-cyan-500/50"
          >
            <Plus className="w-4 h-4" /> Novo Setor
          </Button>
        </div>
      </div>

      {/* MÉTRICAS (CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in zoom-in-95 duration-300">
        <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] p-5 shadow-sm dark:shadow-lg transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Building2 className="w-5 h-5" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Total de Setores</p>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">{metrics.total}</p>
        </Card>

        <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] p-5 shadow-sm dark:shadow-lg transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Setores Ativos</p>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">{metrics.ativos}</p>
        </Card>

        <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] p-5 shadow-sm dark:shadow-lg transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Setores Inativos</p>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">{metrics.inativos}</p>
        </Card>

        <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] p-5 shadow-sm dark:shadow-lg transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Network className="w-5 h-5" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Especialidades Exigidas</p>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">{metrics.especialidades}</p>
          <p className="text-[10px] text-slate-400 mt-1 font-bold">Mapeadas no hospital</p>
        </Card>
      </div>

      {/* BARRA DE PESQUISA */}
      <div className="relative animate-in fade-in duration-500">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input 
          placeholder="Buscar setor ou especialidade..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-14 pl-12 bg-white dark:bg-[#1e293b] border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl shadow-sm focus:border-sky-500 dark:focus:border-cyan-500 transition-colors font-medium"
        />
      </div>

      {/* GRID DE SETORES */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {filteredSectors.length === 0 ? (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-3xl bg-white/50 dark:bg-[#1e293b]/50 text-slate-500 dark:text-slate-400">
            Nenhum setor encontrado. Clique em "Novo Setor" para adicionar.
          </div>
        ) : (
          filteredSectors.map((sector) => {
            const isInactive = sector.status === 'inativo';

            return (
              <Card 
                key={sector.id} 
                className={`p-5 rounded-3xl border transition-all duration-300 hover:shadow-lg flex flex-col justify-between h-full ${
                  isInactive 
                    ? 'border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-[#0f172a]/50 opacity-70 grayscale hover:grayscale-0' 
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] hover:border-sky-300 dark:hover:border-cyan-800'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-2xl ${isInactive ? 'bg-slate-200 dark:bg-slate-800 text-slate-500' : 'bg-sky-50 dark:bg-cyan-500/10 text-sky-600 dark:text-cyan-400'}`}>
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-lg text-slate-900 dark:text-white leading-tight">
                          {sector.name}
                        </h3>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md mt-1 inline-block ${
                          isInactive 
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' 
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                        }`}>
                          {sector.status || 'Ativo'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mt-5">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800/50">
                      <Stethoscope className="w-4 h-4 text-sky-500 dark:text-cyan-500 shrink-0" />
                      <span className="truncate"><b>Especialidade:</b> {sector.specialty || 'Não definida'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleDelete(sector.id, sector.name)}
                    className="h-8 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 rounded-xl px-3 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => handleOpenModal(sector)}
                    className="h-8 text-xs font-bold bg-white hover:bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-200 rounded-xl px-4 cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5 mr-1.5" /> Editar
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* MODAL DE CADASTRO/EDIÇÃO */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-2xl z-[9999] p-5 sm:p-6 rounded-3xl">
          <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-sky-600 dark:text-cyan-400">
              <Building2 className="w-5 h-5" /> 
              {editingSector ? 'Editar Setor' : 'Novo Setor Hospitalar'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-4 text-sm">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome do Setor / Unidade *</Label>
              <Input 
                autoFocus
                placeholder="Ex: UTI Adulto, Bloco Cirúrgico..." 
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
                className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-medium"
                required
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Especialidade Principal Exigida</Label>
              <Input 
                placeholder="Ex: Intensivista, Cirurgião Geral..." 
                value={formData.specialty} 
                onChange={e => setFormData({ ...formData, specialty: e.target.value })} 
                className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-medium" 
                list="specialty-options" 
              />
              <datalist id="specialty-options">
                {registeredSpecialties.map(spec => <option key={spec} value={spec} />)}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
                  <SelectItem value="ativo" className="font-bold text-emerald-600 dark:text-emerald-400">Ativo</SelectItem>
                  <SelectItem value="inativo" className="font-bold text-rose-600 dark:text-rose-400">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <DialogFooter className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-end border-t border-slate-100 dark:border-slate-800 mt-2 gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setModalOpen(false)} 
                className="w-full sm:w-auto h-11 text-xs font-bold border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-6 cursor-pointer"
              >
                <X className="w-4 h-4 mr-1.5" /> Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={submitting} 
                className="w-full sm:w-auto h-11 bg-sky-600 hover:bg-sky-700 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white font-black text-xs px-8 rounded-xl shadow-md cursor-pointer transition-all"
              >
                <Save className="w-4 h-4 mr-1.5" /> Salvar Setor
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}