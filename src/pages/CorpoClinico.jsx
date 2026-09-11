import { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Search, Phone, Mail, Download, Grid3X3, List, BriefcaseMedical } from 'lucide-react';
import ProfessionalFormDialog from '@/components/professionals/ProfessionalFormDialog';

const categoryLabel = { 
  medico: 'Médico', 
  enfermeiro: 'Enfermeiro', 
  tecnico: 'Técnico', 
  auxiliar: 'Auxiliar', 
  administrativo: 'Administrativo', 
  outro: 'Outro' 
};

const statusBadge = {
  ativo: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border dark:border-emerald-800/50',
  ferias: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 dark:border dark:border-amber-800/50',
  inativo: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 dark:border dark:border-slate-700',
};

function getInitials(name) {
  if (!name) return '?';
  const p = name.trim().split(' ');
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function exportProfessionalsCsv(list) {
  const rows = [
    ['Nome', 'Categoria', 'Cargo', 'Especialidade', 'Telefone', 'E-mail', 'Status', 'Valor hora', 'Setor']
  ];

  list.forEach((p) => {
    rows.push([
      p.name || '',
      categoryLabel[p.category] || p.category || '',
      p.role || '',
      p.specialty || '',
      p.phone || '',
      p.email || '',
      p.status || '',
      p.hourly_rate ? Number(p.hourly_rate).toFixed(2) : '',
      p.default_sector_id || ''
    ]);
  });

  const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'cadastro-profissionais.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export default function CorpoClinico() {
  const { user, company, loading } = useAppData();
  const [professionals, setProfessionals] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('cards');
  const companyId = user?.data?.company_id;
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id;

  const load = async () => {
    const f = companyId ? { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) } : {};
    const [professionalResult, sectorResult] = await Promise.all([
      base44.entities.Professional.filter(f, '-created_date', 300),
      base44.entities.Sector.filter(f, '-created_date', 200)
    ]);
    setProfessionals(professionalResult);
    setSectors(sectorResult);
  };

  useEffect(() => { 
    if (!loading) load(); 
  }, [loading, companyId, unitId]);

  const filtered = useMemo(() => professionals.filter((p) =>
    !search || 
    (p.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (p.document || '').includes(search) || 
    (p.role || '').toLowerCase().includes(search.toLowerCase()) || 
    (p.specialty || '').toLowerCase().includes(search.toLowerCase())
  ), [professionals, search]);

  const handleDelete = async (id) => {
    if (!confirm('Excluir este profissional?')) return;
    await base44.entities.Professional.delete(id);
    load();
  };

  const renderProfessionalCard = (p) => (
    <Card key={p.id} className="p-5 border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 hover:shadow-lg transition-all duration-200">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-100 to-indigo-100 dark:from-sky-950 dark:to-indigo-950 flex items-center justify-center text-sm font-bold text-sky-700 dark:text-sky-300 flex-shrink-0">
          {getInitials(p.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{p.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{categoryLabel[p.category] || 'Profissional'}{p.specialty ? ` · ${p.specialty}` : ''}</div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase ${statusBadge[p.status] || 'bg-slate-100 text-slate-500'}`}>{p.status}</span>
          </div>
          {p.document && <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{p.document}{p.document_uf ? ` / ${p.document_uf}` : ''}</div>}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
        {p.role && <div className="text-xs text-slate-600 dark:text-slate-300"><span className="font-medium">Cargo:</span> {p.role}</div>}
        {p.phone && <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{p.phone}</div>}
        {p.email && <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate"><Mail className="w-3.5 h-3.5 flex-shrink-0" />{p.email}</div>}
        {p.hourly_rate && <div className="text-xs text-slate-500 dark:text-slate-400">Valor hora: <span className="font-medium text-slate-700 dark:text-slate-200">R$ {Number(p.hourly_rate).toFixed(2)}</span></div>}
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-700" onClick={() => { setEditing(p); setDialogOpen(true); }}>
          <Pencil className="w-3.5 h-3.5 mr-1" />Editar
        </Button>
        <Button variant="outline" size="sm" className="text-red-500 hover:bg-red-50 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-red-950/40" onClick={() => handleDelete(p.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="p-4 md:p-8 space-y-5">
      {/* Cabeçalho com contraste adequado para tema escuro e claro */}
      <div className="rounded-2xl border border-sky-200 dark:border-sky-900/60 bg-gradient-to-r from-sky-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-900/90 dark:to-sky-950/40 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-sm">
              <BriefcaseMedical className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-sky-700 dark:text-sky-400 font-semibold">Gestão clínica</p>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Cadastro de profissional</h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => exportProfessionalsCsv(filtered)} className="gap-2 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700">
              <Download className="w-4 h-4" /> Baixar
            </Button>
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-2 bg-sky-600 hover:bg-sky-700 text-white">
              <Plus className="w-4 h-4" /> Novo profissional
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Buscar por nome, CBO, cargo ou especialidade..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-9 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" 
          />
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              viewMode === 'cards' 
                ? 'bg-sky-600 text-white' 
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Grid3X3 className="w-4 h-4" /> Caixas
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              viewMode === 'list' 
                ? 'bg-sky-600 text-white' 
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <List className="w-4 h-4" /> Lista
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center border-slate-200 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-slate-400 dark:text-slate-500 text-sm">Nenhum profissional cadastrado. Clique em "Novo profissional" para começar.</p>
        </Card>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(renderProfessionalCard)}
        </div>
      ) : (
        <Card className="overflow-hidden border-slate-200 dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Profissional</th>
                  <th className="px-4 py-3 font-medium">Cargo</th>
                  <th className="px-4 py-3 font-medium">Contato</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800/80 align-top hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-bold text-xs flex items-center justify-center">
                          {getInitials(p.name)}
                        </div>
                        <div>
                          <div className="font-medium text-slate-700 dark:text-slate-200">{p.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{categoryLabel[p.category] || 'Profissional'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.role || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <div>{p.phone || '—'}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{p.email || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${statusBadge[p.status] || 'bg-slate-100 text-slate-500'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-700" onClick={() => { setEditing(p); setDialogOpen(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-500 hover:bg-red-50 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-red-950/40" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ProfessionalFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={load}
        professional={editing}
        companyId={companyId}
        unitId={unitId}
        sectors={sectors}
      />
    </div>
  );
}