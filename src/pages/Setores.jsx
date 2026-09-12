import { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, Pencil, Trash2, Layers, Grid3X3, List, Search, 
  Building2, Users, ShieldAlert, CheckCircle2 
} from 'lucide-react';
import SectorFormDialog from '@/components/sectors/SectorFormDialog';

export default function Setores() {
  const { user, company, loading } = useAppData();
  const [sectors, setSectors] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearch] = useState('');
  
  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id;

  const load = async () => {
    try {
      const f = companyId ? { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) } : {};
      const [s, sh] = await Promise.all([
        base44.entities.Sector.filter(f, '-created_date', 100).catch(() => []),
        base44.entities.Shift.filter(f, '-date', 500).catch(() => []),
      ]);
      setSectors(s || []);
      setShifts(sh || []);
    } catch (e) {
      console.error('Erro ao carregar setores:', e);
    }
  };

  useEffect(() => { if (!loading) load(); }, [loading, companyId, unitId]);

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este setor?')) return;
    try {
      await base44.entities.Sector.delete(id);
      load();
    } catch (e) {
      alert(e.message || 'Erro ao excluir setor.');
    }
  };

  const visibleSectors = useMemo(() => {
    return sectors.filter((sector) => {
      const term = search.toLowerCase();
      const name = (sector.name || '').toLowerCase();
      const specialty = (sector.specialty || '').toLowerCase();
      const unit = (sector.unit || '').toLowerCase();
      return !search || name.includes(term) || specialty.includes(term) || unit.includes(term);
    });
  }, [sectors, search]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* HEADER ENTERPRISE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Setores & Alas Hospitalares</h1>
          <p className="text-sm text-slate-500">
            Gerencie as unidades de atendimento, especialidades e dimensionamento de equipe.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Alternador de Visão */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-sky-700 dark:bg-slate-700 dark:text-sky-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
              title="Visualização em cartões"
            >
              <Grid3X3 className="w-4 h-4" /> Cartões
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-sky-700 dark:bg-slate-700 dark:text-sky-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
              title="Visualização em lista"
            >
              <List className="w-4 h-4" /> Tabela
            </button>
          </div>

          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-sky-600 hover:bg-sky-700 text-white font-bold gap-2">
            <Plus className="w-4 h-4" /> Novo Setor
          </Button>
        </div>
      </div>

      {/* BARRA DE BUSCA */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          placeholder="Buscar por nome do setor, especialidade ou ala..." 
          className="pl-9 h-10 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" 
        />
      </div>

      {/* CONTEÚDO */}
      {visibleSectors.length === 0 ? (
        <Card className="p-12 text-center border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-400 text-sm font-medium">Nenhum setor localizado.</p>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleSectors.map((s) => {
            const sectorShifts = shifts.filter((sh) => String(sh.sector_id) === String(s.id) && sh.status !== 'cancelado');
            const color = s.color || '#0284c7';
            const minStaff = Number(s.min_staff) || 1;
            
            return (
              <Card key={s.id} className="p-5 border-slate-200 dark:border-slate-800 hover:border-sky-300 transition-all flex flex-col justify-between space-y-4 shadow-sm bg-white dark:bg-slate-900">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: color + '15', color: color }}>
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-base">{s.name}</div>
                        {s.specialty && <div className="text-xs font-semibold text-sky-600 uppercase tracking-wide">{s.specialty}</div>}
                      </div>
                    </div>
                    {s.active === false ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold uppercase">Inativo</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold uppercase border border-emerald-200/60">Ativo</span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {s.unit && (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-700 dark:text-slate-300">Ala / Unidade: {s.unit}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Dimensionamento mín.: <b>{minStaff} prof. por plantão</b></span>
                    </div>
                    <div className="flex items-center gap-2 text-sky-600 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{sectorShifts.length} plantão(ões) vinculados na grade</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 text-xs font-semibold" onClick={() => { setEditing(s); setDialogOpen(true); }}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-semibold">Setor</th>
                  <th className="px-4 py-3 font-semibold">Especialidade</th>
                  <th className="px-4 py-3 font-semibold">Ala / Unidade</th>
                  <th className="px-4 py-3 font-semibold">Equipe Mínima</th>
                  <th className="px-4 py-3 font-semibold">Plantões</th>
                  <th className="px-4 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleSectors.map((s) => {
                  const count = shifts.filter((sh) => String(sh.sector_id) === String(s.id) && sh.status !== 'cancelado').length;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color || '#0284c7' }} />
                        {s.name}
                      </td>
                      <td className="px-4 py-3 text-sky-600 font-semibold">{s.specialty || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.unit || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.min_staff || 1} prof.</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{count} plantão(ões)</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-slate-100" onClick={() => { setEditing(s); setDialogOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => handleDelete(s.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <SectorFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={load}
        sector={editing}
        companyId={companyId}
        unitId={unitId}
      />
    </div>
  );
}