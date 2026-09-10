import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Layers, Grid3X3, List, Search } from 'lucide-react';
import SectorFormDialog from '@/components/sectors/SectorFormDialog';

export default function Setores() {
  const { user, company, loading } = useAppData();
  const [sectors, setSectors] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearch] = useState('');
  const companyId = user?.data?.company_id;
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id;

  const load = async () => {
    const f = companyId ? { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) } : {};
    const [s, sh] = await Promise.all([
      base44.entities.Sector.filter(f, '-created_date', 100),
      base44.entities.Shift.filter(f, '-date', 300),
    ]);
    setSectors(s); setShifts(sh);
  };

  useEffect(() => { if (!loading) load(); }, [loading, companyId, unitId]);

  const handleDelete = async (id) => {
    if (!confirm('Excluir este setor?')) return;
    await base44.entities.Sector.delete(id);
    load();
  };

  const visibleSectors = sectors.filter((sector) => !search || `${sector.name} ${sector.specialty || ''} ${sector.unit || ''}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Setores, alas e especialidades da sua instituição</p>
        <div className="flex flex-wrap gap-2"><div className="flex rounded-lg border border-slate-200 bg-white p-1"><button title="Visualização em cartões" onClick={() => setViewMode('grid')} className={`rounded-md p-2 ${viewMode === 'grid' ? 'bg-sky-600 text-white' : 'text-slate-500'}`}><Grid3X3 className="h-4 w-4" /></button><button title="Visualização em lista" onClick={() => setViewMode('list')} className={`rounded-md p-2 ${viewMode === 'list' ? 'bg-sky-600 text-white' : 'text-slate-500'}`}><List className="h-4 w-4" /></button></div><Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="w-4 h-4 mr-1.5" /> Novo Setor</Button></div>
      </div>

      <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar setor ou especialidade" className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 text-sm text-slate-700" /></div>

      {visibleSectors.length === 0 ? (
        <Card className="p-10 text-center border-slate-200">
          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">Nenhum setor cadastrado ainda.</p>
        </Card>
      ) : (
        viewMode === 'grid' ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleSectors.map((s) => {
            const count = shifts.filter((sh) => sh.sector_id === s.id).length;
            return (
              <Card key={s.id} className="p-5 border-slate-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: (s.color || '#0284c7') + '20', color: s.color || '#0284c7' }}>
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">{s.name}</div>
                      {s.specialty && <div className="text-xs text-slate-500">{s.specialty}</div>}
                    </div>
                  </div>
                  {!s.active && <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">Inativo</span>}
                </div>
                {s.unit && <div className="text-xs text-slate-400 mt-2">Unidade: {s.unit}</div>}
                <div className="text-xs text-slate-500 mt-1">{count} plantão(ões) · mín. {s.min_staff} prof.</div>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditing(s); setDialogOpen(true); }}><Pencil className="w-3.5 h-3.5 mr-1" />Editar</Button>
                  <Button variant="outline" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => handleDelete(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </Card>
            );
          })}
        </div> : <Card className="overflow-hidden border-slate-200"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3">Setor</th><th className="px-4 py-3">Especialidade</th><th className="px-4 py-3">Ala</th><th className="px-4 py-3">Plantões</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody>{visibleSectors.map((s) => <tr key={s.id} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold text-slate-800">{s.name}</td><td className="px-4 py-3 text-slate-600">{s.specialty || '—'}</td><td className="px-4 py-3 text-slate-600">{s.unit || '—'}</td><td className="px-4 py-3 text-slate-600">{shifts.filter((shift) => shift.sector_id === s.id).length}</td><td className="px-4 py-3"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => { setEditing(s); setDialogOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDelete(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></td></tr>)}</tbody></table></div></Card>
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