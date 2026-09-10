import { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Clock, CheckCircle2, FileText, Download, Calendar, Printer } from 'lucide-react';
import { exportProfessionalReceiptPDF } from '@/lib/exportReport';

const statusBadge = {
  pendente: 'bg-amber-50 text-amber-700',
  faturado: 'bg-sky-50 text-sky-700',
  pago: 'bg-emerald-50 text-emerald-700',
  impresso: 'bg-emerald-50 text-emerald-700',
};

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <Card className="p-5 border-slate-200">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}><Icon className="w-5 h-5" /></div>
        <div>
          <div className="text-xs text-slate-500">{label}</div>
          <div className="text-xl font-bold text-slate-800">{value}</div>
        </div>
      </div>
    </Card>
  );
}

export default function Faturamento() {
  const { user, company, loading } = useAppData();
  const [records, setRecords] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('all');
  const companyId = user?.data?.company_id;
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id;

  const load = async () => {
    const f = companyId ? { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) } : {};
    const [r, p, s] = await Promise.all([
      base44.entities.BillingRecord.filter(f, '-date', 500),
      base44.entities.Professional.filter(f, '-created_date', 200),
      base44.entities.Sector.filter(f, '-created_date', 200),
    ]);
    setRecords(r); setProfessionals(p); setSectors(s);
  };

  useEffect(() => {
    if (!loading) {
      load();
      const id = setInterval(load, 15000);
      return () => clearInterval(id);
    }
  }, [loading, companyId, unitId]);

  const byMonth = useMemo(() => {
    const months = [...new Set(records.map((r) => r.date ? r.date.slice(0, 7) : ''))].filter(Boolean).sort().reverse();
    const monthValue = selectedMonth || (months[0] || '');
    const filtered = monthValue ? records.filter((r) => r.date && r.date.startsWith(monthValue)) : records;
    const professionalFiltered = selectedProfessionalId === 'all'
      ? filtered
      : filtered.filter((r) => String(r.professional_id) === String(selectedProfessionalId));
    return { months, monthValue, filtered, professionalFiltered };
  }, [records, selectedMonth, selectedProfessionalId]);

  useEffect(() => {
    if (!selectedMonth && byMonth.months.includes('2026-08')) {
      setSelectedMonth('2026-08');
    }
  }, [selectedMonth, byMonth.months]);

  const totals = useMemo(() => {
    const total = byMonth.professionalFiltered.reduce((s, r) => s + (r.value || 0), 0);
    const paid = byMonth.professionalFiltered.filter((r) => r.status === 'pago').reduce((s, r) => s + (r.value || 0), 0);
    const pending = byMonth.professionalFiltered.filter((r) => r.status === 'pendente').reduce((s, r) => s + (r.value || 0), 0);
    const hours = byMonth.professionalFiltered.reduce((s, r) => s + (r.hours || 0), 0);
    return { total, paid, pending, hours };
  }, [byMonth.professionalFiltered]);

  const byProfessional = useMemo(() => {
    const map = {};
    byMonth.professionalFiltered.forEach((r) => {
      const key = r.professional_id || 'unknown';
      if (!map[key]) map[key] = { id: r.professional_id, name: r.professional_name || '—', total: 0, hours: 0, count: 0, records: [] };
      map[key].total += r.value || 0;
      map[key].hours += r.hours || 0;
      map[key].count += 1;
      map[key].records.push(r);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [byMonth.professionalFiltered]);
  const visibleRecords = selectedProfessionalId === 'all' ? byMonth.professionalFiltered : byMonth.professionalFiltered.filter((r) => String(r.professional_id) === String(selectedProfessionalId));

  const getProfessionalShiftValue = (professional) => {
    if (!professional) return 0;
    const rawValue = Number(professional.daily_rate ?? professional.hourly_rate ?? 0);
    return Number.isFinite(rawValue) ? rawValue : 0;
  };

  const generateFromShifts = async () => {
    if (!confirm('Gerar registros de faturamento a partir dos plantões confirmados? Isso evita duplicatas existentes.')) return;
    const f = companyId ? { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) } : {};
    const shifts = await base44.entities.Shift.filter({ ...f, status: 'confirmado' }, '-date', 500);
    const profs = professionals;
    const existing = new Set(records.map((r) => r.shift_id));
    const toCreate = [];
    shifts.forEach((s) => {
      if (existing.has(s.id)) return;
      const prof = profs.find((p) => p.id === s.professional_id);
      const shiftValue = getProfessionalShiftValue(prof);
      toCreate.push({
        professional_id: s.professional_id,
        professional_name: s.professional_name || prof?.name || '',
        shift_id: s.id,
        date: s.date,
        hours: Number(s.duration_hours || 12),
        shift_type: s.shift_type,
        sector_name: s.sector_name,
        value: shiftValue,
        status: 'pendente',
        company_id: companyId,
        unit_id: unitId,
        sector_id: s.sector_id,
      });
    });
    if (toCreate.length) await base44.entities.BillingRecord.bulkCreate(toCreate);
    load();
  };

  const markPaid = async (id) => {
    const record = records.find((item) => item.id === id);
    if (!record) return;
    const nextStatus = record.status === 'pago' ? 'pendente' : 'pago';
    await base44.entities.BillingRecord.update(id, { status: nextStatus });
    load();
  };

  const exportReceipt = async (professional, recordList = null) => {
    const result = recordList || byMonth.professionalFiltered.filter((r) => r.professional_id === professional.id);
    const fullProfessional = professionals.find((item) => item.id === professional.id) || professional;
    const professionalSector = sectors.find((sector) => sector.id === fullProfessional.default_sector_id);
    exportProfessionalReceiptPDF({ company, professional: { ...fullProfessional, sector_name: professionalSector?.name || fullProfessional.sector_name || fullProfessional.specialty || 'Não informado' }, records: result, monthLabel: byMonth.monthValue || 'Mensal' });
    if (result.length) {
      await Promise.all(result.map((record) => base44.entities.BillingRecord.update(record.id, { status: 'impresso' })));
      load();
    }
  };

  const updateMonthlyAdjustment = async (professionalId, value) => {
    const nextValue = Number(value || 0);
    const professional = professionals.find((p) => p.id === professionalId);
    if (!professional) return;

    await base44.entities.Professional.update(professionalId, {
      daily_rate: nextValue,
      monthly_adjustment: nextValue,
      hourly_rate: professional.hourly_rate || null,
    });

    const toUpdate = records.filter((item) => String(item.professional_id) === String(professionalId));
    await Promise.all(
      toUpdate.map((item) => base44.entities.BillingRecord.update(item.id, { value: nextValue }))
    );

    setProfessionals((current) => current.map((item) => item.id === professionalId ? { ...item, daily_rate: nextValue, monthly_adjustment: nextValue } : item));
    load();
  };

  return (
    <div className="p-4 md:p-8 space-y-5">
      <div className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-[radial-gradient(circle_at_90%_0%,rgba(16,185,129,0.2),transparent_30%),linear-gradient(120deg,#052e2b,#0f766e)] p-6 text-white shadow-lg md:p-8">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">Financeiro operacional</div><h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">Faturamento e repasse</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/80">Acompanhe competência, horas, valores e recibos em uma visão única para fechar cada período com segurança.</p></div>
          <Button onClick={generateFromShifts} className="bg-white text-emerald-800 hover:bg-emerald-50"><FileText className="w-4 h-4 mr-1.5" /> Gerar dos plantões</Button>
        </div>
      </div>

      <Card className="p-4 border-slate-200">
        <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="w-4 h-4 text-sky-600" />
            <span>Filtrar por mês</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <select value={byMonth.monthValue} onChange={(e) => setSelectedMonth(e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm bg-white">
              <option value="">Todos os meses</option>
              {byMonth.months.map((month) => (
                <option key={month} value={month}>{new Date(`${month}-01T00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</option>
              ))}
            </select>
            <select value={selectedProfessionalId} onChange={(e) => setSelectedProfessionalId(e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm bg-white">
              <option value="all">Todos os profissionais</option>
              {professionals.filter((p) => p.status !== 'inativo').map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={DollarSign} label="Total do período" value={`R$ ${totals.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="bg-sky-100 text-sky-700" />
        <SummaryCard icon={CheckCircle2} label="Pago" value={`R$ ${totals.paid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="bg-emerald-100 text-emerald-700" />
        <SummaryCard icon={Clock} label="Pendente" value={`R$ ${totals.pending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="bg-amber-100 text-amber-600" />
        <SummaryCard icon={TrendingUp} label="Horas totais" value={`${totals.hours}h`} color="bg-purple-100 text-purple-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4">Resumo por Profissional</h3>
          {byProfessional.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Nenhum registro de faturamento.</p>
          ) : (
            <div className="space-y-3">
              {byProfessional.map((p, i) => {
                const professional = professionals.find((item) => item.id === p.id) || { id: p.id, name: p.name, monthly_adjustment: 0 };
                return (
                  <div key={i} className="py-2 border-b border-slate-100 last:border-0">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-slate-700">{p.name}</div>
                        <div className="text-xs text-slate-400">{p.count} plantão(ões) · {p.hours}h</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-800">R$ {p.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <button onClick={() => exportReceipt(professionals.find((item) => item.id === p.id) || p, byMonth.filtered.filter((r) => r.professional_id === p.id))} className="mt-1 text-[10px] inline-flex items-center gap-1 text-sky-600 font-medium">
                          <Printer className="w-3 h-3" /> imprimir
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <label className="text-[10px] font-medium uppercase text-slate-500">Ajuste mensal</label>
                      <input
                        type="number"
                        step="0.01"
                        value={Number(professional.daily_rate ?? professional.monthly_adjustment ?? 0)}
                        onChange={(e) => {
                          const next = e.target.value === '' ? 0 : Number(e.target.value);
                          setProfessionals((current) => current.map((item) => item.id === professional.id ? { ...item, daily_rate: next, monthly_adjustment: next } : item));
                        }}
                        onBlur={(e) => updateMonthlyAdjustment(professional.id, e.target.value)}
                        className="w-28 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5 border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4">Registros de Faturamento</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {visibleRecords.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Nenhum registro. Use o botão acima para gerar.</p>}
            {visibleRecords.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate">{r.professional_name}</div>
                  <div className="text-xs text-slate-400">{r.date ? new Date(r.date + 'T00:00').toLocaleDateString('pt-BR') : ''} · {r.sector_name || '—'} · {r.hours}h</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold text-slate-700">R$ {(r.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  {r.status === 'impresso' ? (
                    <button onClick={() => exportReceipt(professionals.find((item) => item.id === r.professional_id) || { id: r.professional_id, name: r.professional_name }, [r])} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium uppercase bg-emerald-50 text-emerald-700 hover:opacity-80">
                      <Printer className="w-3 h-3" /> impresso
                    </button>
                  ) : (
                    <button onClick={() => markPaid(r.id)} className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase ${statusBadge[r.status] || 'bg-slate-100 text-slate-500'} hover:opacity-80`}>{r.status || 'pendente'}</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}