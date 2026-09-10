import { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Clock, Calendar, TrendingUp, FileText, FileSpreadsheet } from 'lucide-react';
import { exportReportPDF, exportReportCSV } from '@/lib/exportReport';

export default function Relatorios() {
  const { user, company, loading } = useAppData();
  const [shifts, setShifts] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const companyId = user?.data?.company_id;

  useEffect(() => {
    if (loading) return;
    (async () => {
      const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id;
      const f = companyId ? { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) } : {};
      const [s, p] = await Promise.all([
        base44.entities.Shift.filter(f, '-date', 500),
        base44.entities.Professional.filter(f, '-created_date', 200),
      ]);
      setShifts(s); setProfessionals(p);
    })();
  }, [loading, companyId, company, user]);

  const byProfessional = useMemo(() => {
    const map = {};
    professionals.forEach((p) => {
      map[p.id] = { name: p.name, category: p.category, confirmed: 0, pending: 0, hours: 0 };
    });
    shifts.forEach((s) => {
      if (!s.professional_id) return;
      if (!map[s.professional_id]) map[s.professional_id] = { name: s.professional_name || '—', category: '', confirmed: 0, pending: 0, hours: 0 };
      if (s.status === 'confirmado') map[s.professional_id].confirmed += 1;
      if (s.status === 'pendente') map[s.professional_id].pending += 1;
      if (s.status === 'confirmado') map[s.professional_id].hours += s.duration_hours || 12;
    });
    return Object.values(map).filter((m) => m.confirmed > 0 || m.pending > 0).sort((a, b) => b.hours - a.hours);
  }, [shifts, professionals]);

  const bySector = useMemo(() => {
    const map = {};
    shifts.forEach((s) => {
      const key = s.sector_name || 'Sem setor';
      if (!map[key]) map[key] = { total: 0, filled: 0, open: 0 };
      map[key].total += 1;
      if (s.status === 'confirmado' || s.status === 'pendente') map[key].filled += 1;
      if (s.status === 'vago') map[key].open += 1;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [shifts]);

  const overview = {
    total: shifts.length,
    confirmed: shifts.filter((s) => s.status === 'confirmado').length,
    pending: shifts.filter((s) => s.status === 'pendente').length,
    open: shifts.filter((s) => s.status === 'vago').length,
  };

  const categoryLabel = { medico: 'Médico', enfermeiro: 'Enfermeiro', tecnico: 'Técnico', outro: 'Outro' };

  return (
    <div className="p-4 md:p-8 space-y-5">
      <p className="text-sm text-slate-500">Horas trabalhadas e distribuição de plantões</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-sky-600" /> Horas por Profissional</h3>
          {byProfessional.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Sem dados suficientes.</p>
          ) : (
            <div className="space-y-2">
              {byProfessional.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-slate-700">{p.name}</div>
                    <div className="text-xs text-slate-400">{categoryLabel[p.category] || 'Profissional'} · {p.confirmed} confirmados, {p.pending} pendentes</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-800">{p.hours}h</div>
                    <div className="text-xs text-slate-400">confirmadas</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-sky-600" /> Cobertura por Setor</h3>
          {bySector.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Sem dados suficientes.</p>
          ) : (
            <div className="space-y-3">
              {bySector.map(([name, data]) => {
                const pct = data.total ? Math.round((data.filled / data.total) * 100) : 0;
                return (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">{name}</span>
                      <span className="text-xs text-slate-500">{pct}% · {data.open} vagas</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5 border-slate-200">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-sky-600" /> Visão Geral</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div><div className="text-2xl font-bold text-slate-800">{shifts.length}</div><div className="text-xs text-slate-500">Total de plantões</div></div>
          <div><div className="text-2xl font-bold text-emerald-600">{shifts.filter((s) => s.status === 'confirmado').length}</div><div className="text-xs text-slate-500">Confirmados</div></div>
          <div><div className="text-2xl font-bold text-amber-600">{shifts.filter((s) => s.status === 'pendente').length}</div><div className="text-xs text-slate-500">Pendentes</div></div>
          <div><div className="text-2xl font-bold text-red-600">{shifts.filter((s) => s.status === 'vago').length}</div><div className="text-xs text-slate-500">Vagas abertas</div></div>
        </div>
      </Card>

      {/* Floating download buttons — rise on hover */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-40">
        <button
          onClick={() => exportReportPDF({ company, byProfessional, bySector, overview })}
          className="flex items-center gap-2 bg-sky-600 text-white px-4 py-3 rounded-xl shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:bg-sky-700"
        >
          <FileText className="w-5 h-5" />
          <span className="text-sm font-medium">Baixar PDF</span>
        </button>
        <button
          onClick={() => exportReportCSV({ byProfessional, bySector, overview })}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:bg-emerald-700"
        >
          <FileSpreadsheet className="w-5 h-5" />
          <span className="text-sm font-medium">Exportar CSV</span>
        </button>
      </div>
    </div>
  );
}