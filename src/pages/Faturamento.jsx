import React, { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DollarSign, 
  Users, 
  Calendar, 
  Clock, 
  Download, 
  Loader2, 
  TrendingUp, 
  Search, 
  CheckCircle2, 
  FileSpreadsheet,
  X,
  Copy,
  ChevronRight,
  ShieldCheck,
  Stethoscope,
  Building2,
  Landmark,
  CreditCard,
  Printer,
  FileText
} from 'lucide-react';
import { getShiftInterval } from '@/lib/shiftUtils';

export default function Faturamento() {
  const { user, company, loading: appLoading } = useAppData();
  const [professionals, setProfessionals] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  
  const [selectedProf, setSelectedProf] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [printReceiptProf, setPrintReceiptProf] = useState(null);

  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id || 'unit_h1';

  const currentUnit = useMemo(() => {
    const list = company?.units || [];
    return list.find((u) => u.id === unitId) || {
      name: company?.name || 'Hospital Santa Clara',
      cnpj: company?.cnpj || '00.000.000/0001-00',
      address: company?.address || 'Av. Central Hospitalar, 1000 - Centro'
    };
  }, [company, unitId]);

  const loadData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const f = { company_id: companyId, ...(unitId ? { unit_id: unitId } : {}) };
      const [profs, shs] = await Promise.all([
        base44.entities.Professional.filter(f, 'name', 400),
        base44.entities.Shift.filter(f, '-date', 1200)
      ]);
      setProfessionals(profs || []);
      setShifts(shs || []);
    } catch (e) {
      console.error('Erro ao carregar faturamento:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (appLoading) return;
    loadData();
  }, [appLoading, companyId, unitId]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const copyPixKey = (key, e) => {
    if (e) e.stopPropagation();
    if (!key || !key.trim()) {
      showToast('Nenhuma chave PIX cadastrada para este profissional');
      return;
    }
    navigator.clipboard.writeText(key.trim());
    showToast(`Chave PIX copiada: ${key}`);
  };

  // Consolidação de repasses com ordenação dia 1 ao 30 e proporção de mensalistas
  const reportData = useMemo(() => {
    const now = new Date();
    const profMap = {};

    professionals.forEach((p) => {
      profMap[p.id] = {
        ...p,
        rawShifts: [],
        completedShifts: [],
        pendingShifts: [],
        completedHours: 0,
        pendingHours: 0,
        completedValue: 0,
        predictedValue: 0,
        isMensal: (p.remuneration_type || 'hora') === 'mensal',
        unitShiftRate: 0 // Valor unitário de cada plantão para o mensalista
      };
    });

    const monthShifts = shifts.filter((s) => {
      const sDate = (s.date || '').slice(0, 7);
      return sDate === selectedMonth && s.status !== 'cancelado';
    });

    // 1ª Passagem: agrupa todos os plantões do mês do profissional
    monthShifts.forEach((s) => {
      const profId = s.professional_id;
      if (!profId) return;

      if (!profMap[profId]) {
        profMap[profId] = {
          id: profId,
          name: s.professional_name || 'Profissional',
          specialty: s.sector_name || 'Clínica Geral',
          remuneration_type: 'hora',
          hourly_rate: 120,
          daily_rate: 1500,
          monthly_salary: 0,
          pix_type: '',
          pix_key: '',
          bank_info: '',
          rawShifts: [],
          completedShifts: [],
          pendingShifts: [],
          completedHours: 0,
          pendingHours: 0,
          completedValue: 0,
          predictedValue: 0,
          isMensal: false,
          unitShiftRate: 0
        };
      }

      profMap[profId].rawShifts.push(s);
    });

    // 2ª Passagem: calcula os valores unitários e o acumulado concluído vs previsto
    Object.values(profMap).forEach((p) => {
      const totalPlanned = p.rawShifts.length;
      const remType = p.remuneration_type || 'hora';
      const monthly = Number(p.monthly_salary) || 0;

      // Se for mensalista, calcula quanto vale cada plantão (Salário / Total de Plantões Previstos)
      if (p.isMensal && totalPlanned > 0 && monthly > 0) {
        p.unitShiftRate = monthly / totalPlanned;
        p.predictedValue = monthly;
      } else if (p.isMensal) {
        p.predictedValue = monthly;
      }

      // Separa concluídos e pendentes, calculando o valor individual de cada um
      p.rawShifts.forEach((s) => {
        const hours = Number(s.duration_hours) || 12;
        let shiftVal = 0;

        if (p.isMensal) {
          shiftVal = p.unitShiftRate;
        } else if (remType === 'hora') {
          shiftVal = hours * (Number(p.hourly_rate) || 0);
        } else if (remType === 'diaria') {
          shiftVal = Number(p.daily_rate) || 0;
        }

        const interval = getShiftInterval(s);
        const isConcluded = interval ? now >= interval.end : new Date(s.date + 'T23:59:59') < now;

        if (isConcluded) {
          p.completedShifts.push({ ...s, calculatedValue: shiftVal });
          p.completedHours += hours;
          p.completedValue += shiftVal;
        } else {
          p.pendingShifts.push({ ...s, calculatedValue: shiftVal });
          p.pendingHours += hours;
          if (!p.isMensal) {
            p.predictedValue += shiftVal;
          }
        }
      });

      if (!p.isMensal) {
        p.predictedValue = p.completedValue + p.predictedValue;
      }

      // CORREÇÃO 1: Ordenação estrita do dia 1 ao 30/31
      p.completedShifts.sort((a, b) => {
        const dComp = (a.date || '').localeCompare(b.date || '');
        if (dComp !== 0) return dComp;
        return (a.start_time || '').localeCompare(b.start_time || '');
      });

      p.pendingShifts.sort((a, b) => {
        const dComp = (a.date || '').localeCompare(b.date || '');
        if (dComp !== 0) return dComp;
        return (a.start_time || '').localeCompare(b.start_time || '');
      });
    });

    return Object.values(profMap).filter((p) => {
      const totalShifts = p.completedShifts.length + p.pendingShifts.length;
      if (totalShifts === 0 && !p.isMensal) return false;

      const matchesSearch = 
        !search || 
        p.name?.toLowerCase().includes(search.toLowerCase()) || 
        p.specialty?.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (filterCategory === 'medico') return (p.specialty || '').toLowerCase().includes('med') || (p.role || '').toLowerCase().includes('med');
      if (filterCategory === 'enfermeiro') return (p.specialty || '').toLowerCase().includes('enf');
      if (filterCategory === 'fixo') return p.isMensal;

      return true;
    });
  }, [professionals, shifts, selectedMonth, search, filterCategory]);

  const totals = useMemo(() => {
    return reportData.reduce(
      (acc, p) => {
        acc.completedValue += p.completedValue;
        acc.predictedValue += p.predictedValue;
        acc.completedShifts += p.completedShifts.length;
        acc.totalShifts += p.completedShifts.length + p.pendingShifts.length;
        acc.completedHours += p.completedHours;
        return acc;
      },
      { completedValue: 0, predictedValue: 0, completedShifts: 0, totalShifts: 0, completedHours: 0 }
    );
  }, [reportData]);

  const avgHourlyCost = useMemo(() => {
    if (totals.completedHours === 0) return 0;
    return totals.completedValue / totals.completedHours;
  }, [totals]);

  const handleExportCSV = () => {
    const headers = ['Profissional;Especialidade;Tipo Contrato;Plantoes Concluidos;Total Plantoes Mes;Horas Concluidas;Valor Liberado (R$);Previsao Total (R$);Chave PIX;Tipo PIX;Dados Bancarios'];
    const rows = reportData.map((p) => {
      const typeLabel = p.remuneration_type === 'hora' ? 'Horista' : p.remuneration_type === 'diaria' ? 'Diarista' : 'Fixo Mensal';
      const totalShifts = p.completedShifts.length + p.pendingShifts.length;
      return `"${p.name}";"${p.specialty}";"${typeLabel}";${p.completedShifts.length};${totalShifts};${p.completedHours};${p.completedValue.toFixed(2)};${p.predictedValue.toFixed(2)};"${p.pix_key || ''}";"${p.pix_type || ''}";"${p.bank_info || ''}"`;
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Demonstrativo_Repasses_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPixLote = () => {
    const ready = reportData.filter((p) => p.completedValue > 0 && p.pix_key);
    if (ready.length === 0) {
      alert('Nenhum profissional com valor liberado possui chave PIX cadastrada para exportação em lote.');
      return;
    }

    const headers = ['Nome;Chave_PIX;Tipo_Chave;Valor_Reais;Descricao'];
    const rows = ready.map((p) => {
      return `"${p.name}";"${p.pix_key}";"${p.pix_type || 'PIX'}";${p.completedValue.toFixed(2)};"Repasse Plantões ${selectedMonth}"`;
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Lote_PIX_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Disparo de impressão do contracheque
  const handlePrintReceipt = (prof) => {
    setPrintReceiptProf(prof);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 relative">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[9999] flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 font-medium text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-100" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner Executivo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-emerald-400 font-bold">
            <ShieldCheck className="w-4 h-4" /> Gestão Financeira Hospitalar
          </div>
          <h1 className="text-2xl md:text-3xl font-black mt-2 tracking-tight">Faturamento & Repasse Médico</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Repasses proporcionais liberados estritamente após a conclusão dos turnos e controle de pagamentos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
            <Calendar className="w-4 h-4 text-sky-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-sm font-bold text-white outline-none cursor-pointer"
            />
          </div>
          <Button onClick={handleExportPixLote} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 text-xs h-10 px-4 rounded-xl shadow-lg shadow-emerald-950">
            <DollarSign className="w-4 h-4" /> Lote PIX
          </Button>
          <Button onClick={handleExportCSV} variant="outline" className="border-white/20 text-slate-200 hover:bg-white/10 text-xs h-10 px-4 rounded-xl">
            <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Planilha Fechamento
          </Button>
        </div>
      </div>

      {/* 4 Cards Estratégicos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <Card className="p-5 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Liberado para Pagamento
            </span>
            <span className="p-2 rounded-xl bg-emerald-600 text-white shadow-sm">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-black text-emerald-950 dark:text-emerald-100 mt-3">
            R$ {totals.completedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
            Plantões efetivamente concluídos até agora
          </p>
        </Card>

        <Card className="p-5 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Previsão Total do Mês
            </span>
            <span className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-3">
            R$ {totals.predictedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Concluídos + turnos futuros previstos
          </p>
        </Card>

        <Card className="p-5 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Progresso Operacional
            </span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-3">
            {totals.completedShifts} / {totals.totalShifts}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {totals.totalShifts > 0 ? Math.round((totals.completedShifts / totals.totalShifts) * 100) : 0}% dos plantões do mês concluídos
          </p>
        </Card>

        <Card className="p-5 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Custo Médio / Hora
            </span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-3">
            R$ {avgHourlyCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Base: {totals.completedHours}h médicas finalizadas
          </p>
        </Card>
      </div>

      {/* Tabela Principal */}
      <Card className="p-5 border-slate-200 dark:border-slate-800 space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Demonstrativo por Profissional</h3>
            <p className="text-xs text-slate-500">Clique na linha de qualquer profissional para abrir o extrato ou emitir recibo</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
              <button
                onClick={() => setFilterCategory('all')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${filterCategory === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterCategory('medico')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${filterCategory === 'medico' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
              >
                Médicos
              </button>
              <button
                onClick={() => setFilterCategory('enfermeiro')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${filterCategory === 'enfermeiro' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
              >
                Enfermagem
              </button>
              <button
                onClick={() => setFilterCategory('fixo')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${filterCategory === 'fixo' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
              >
                Fixos
              </button>
            </div>

            <div className="relative w-full sm:w-60">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar profissional..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-16">
            <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
          </div>
        ) : reportData.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            Nenhum repasse registrado para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase text-[11px] font-bold border-y border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Profissional</th>
                  <th className="py-3 px-4">Contrato</th>
                  <th className="py-3 px-4 text-center">Plantões Concluídos</th>
                  <th className="py-3 px-4 text-center">Horas Fechadas</th>
                  <th className="py-3 px-4 text-right">Liberado Efetivo (R$)</th>
                  <th className="py-3 px-4 text-right">Previsão Mês (R$)</th>
                  <th className="py-3 px-4 text-center">Chave PIX</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reportData.map((p) => {
                  const remType = p.remuneration_type || 'hora';
                  const badgeStyle = 
                    remType === 'hora' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                    remType === 'diaria' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    'bg-purple-50 text-purple-700 border-purple-200';

                  const badgeLabel = 
                    remType === 'hora' ? `Horista (R$ ${p.hourly_rate}/h)` :
                    remType === 'diaria' ? `Diarista (R$ ${p.daily_rate}/plantão)` :
                    `Fixo (R$ ${p.monthly_salary}/mês)`;

                  const hasPix = !!(p.pix_key && p.pix_key.trim());
                  const totalShiftsCount = p.completedShifts.length + p.pendingShifts.length;

                  return (
                    <tr 
                      key={p.id} 
                      onClick={() => setSelectedProf(p)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span>{p.name}</span>
                          <span className="text-[11px] font-normal text-slate-400">· {p.specialty}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badgeStyle}`}>
                          {badgeLabel}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                        <span className="text-emerald-600 font-black">{p.completedShifts.length}</span>
                        <span className="text-xs text-slate-400 font-normal"> / {totalShiftsCount}</span>
                      </td>

                      <td className="py-3.5 px-4 text-center text-slate-600 dark:text-slate-300 font-semibold">
                        {p.completedHours}h
                      </td>

                      <td className="py-3.5 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-base">
                        R$ {p.completedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-slate-500 text-sm">
                        R$ {p.predictedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        {hasPix ? (
                          <button
                            onClick={(e) => copyPixKey(p.pix_key, e)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-mono font-medium transition-colors"
                            title="Clique para copiar a chave PIX"
                          >
                            <Copy className="w-3 h-3 text-emerald-600" />
                            <span>{p.pix_key.length > 15 ? `${p.pix_key.slice(0, 15)}...` : p.pix_key}</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            Não cadastrada
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrintReceipt(p)}
                            className="h-8 text-xs font-bold gap-1 text-slate-700 hover:text-sky-600 hover:border-sky-300"
                            title="Imprimir Recibo / Contracheque (2 Vias)"
                          >
                            <Printer className="w-3.5 h-3.5 text-sky-600" /> Recibo
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedProf(p)}
                            className="h-8 text-xs font-bold text-sky-600 hover:bg-sky-50"
                          >
                            Extrato <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* DRAWER LATERAL: EXTRATO INDIVIDUAL COM DIAS EM ORDEM 1 A 30 */}
      {selectedProf && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 print:hidden">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between animate-in slide-in-from-right duration-300">
            <div className="space-y-5">
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-sky-600 font-bold">Extrato Individual de Repasse</div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{selectedProf.name}</h2>
                  <p className="text-xs text-slate-500">{selectedProf.specialty} · {selectedProf.document ? `CRM/Reg: ${selectedProf.document}` : ''}</p>
                </div>
                <button 
                  onClick={() => setSelectedProf(null)}
                  className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Destaque Proporcional */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase">Liberado Efetivo</span>
                  <div className="text-2xl font-black text-emerald-950 dark:text-emerald-100 mt-1">
                    R$ {selectedProf.completedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    {selectedProf.completedShifts.length} de {selectedProf.completedShifts.length + selectedProf.pendingShifts.length} plantões concluídos
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Previsão Mês Todo</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    R$ {selectedProf.predictedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {selectedProf.isMensal ? `Salário Fixo: R$ ${selectedProf.monthly_salary}/mês` : 'Total com plantões futuros'}
                  </span>
                </div>
              </div>

              {/* Dados Bancários & PIX */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 space-y-2 text-xs">
                <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-emerald-600" /> Dados para Pagamento
                  </span>
                  <span className="font-mono bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded text-[10px] font-bold">
                    {selectedProf.remuneration_type?.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-500">Chave PIX:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {selectedProf.pix_key || <i className="text-slate-400 font-normal">Não cadastrada</i>}
                  </span>
                </div>

                {selectedProf.pix_type && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Tipo de Chave:</span>
                    <span className="uppercase text-slate-700 dark:text-slate-300 font-semibold">{selectedProf.pix_type}</span>
                  </div>
                )}

                {selectedProf.bank_info && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Banco / Agência / Conta:</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{selectedProf.bank_info}</span>
                  </div>
                )}
              </div>

              {/* Lista Cronológica do Dia 1 ao 30/31 */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Plantões do Mês ({selectedMonth})</span>
                  <span className="text-[10px] text-slate-400 font-normal">Ordem cronológica crescente</span>
                </h4>

                {selectedProf.completedShifts.length === 0 && selectedProf.pendingShifts.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Nenhum plantão localizado neste mês.</p>
                ) : (
                  <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                    {/* Exibe todos os plantões do mês ordenados do dia 1 ao 30 */}
                    {[...selectedProf.completedShifts, ...selectedProf.pendingShifts]
                      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.start_time || '').localeCompare(b.start_time || ''))
                      .map((s) => {
                        const isConcluded = selectedProf.completedShifts.some((c) => c.id === s.id);
                        const [yyyy, mm, dd] = (s.date || '').split('-');

                        return (
                          <div 
                            key={s.id}
                            className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                              isConcluded 
                                ? 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20' 
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-70'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-slate-900 dark:text-white">
                                  Dia {dd}/{mm}
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isConcluded ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {isConcluded ? 'Concluído' : 'Programado'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {s.start_time} às {s.end_time} · {s.sector_name || 'Geral'} ({s.duration_hours || 12}h)
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-sm font-black ${isConcluded ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}`}>
                                R$ {Number(s.calculatedValue || 0).toFixed(2)}
                              </div>
                              <span className="text-[9px] text-slate-400">
                                {isConcluded ? 'Liberado' : 'Aguardando plantão'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* Ações no Rodapé do Drawer */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2">
              <Button 
                onClick={() => handlePrintReceipt(selectedProf)}
                className="flex-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimir Contracheque (2 Vias)
              </Button>
              <Button 
                onClick={(e) => copyPixKey(selectedProf.pix_key, e)}
                disabled={!selectedProf.pix_key}
                variant="outline" 
                className="text-xs font-bold gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" /> Copiar PIX
              </Button>
              <Button 
                onClick={() => setSelectedProf(null)}
                variant="ghost"
                className="text-xs font-bold"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LAYOUT DE IMPRESSÃO A4: CONTRACHEQUE / RECIBO EM 2 VIAS COM PICOTE        */}
      {/* ========================================================================= */}
      {printReceiptProf && (
        <div className="hidden print:block fixed inset-0 bg-white text-black p-4 z-[99999]">
          <style>{`
            @media print {
              @page { size: A4 portrait; margin: 10mm; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .print\\:hidden { display: none !important; }
              .print\\:block { display: block !important; }
            }
          `}</style>

          {/* RENDERIZAÇÃO DAS 2 VIAS NA MESMA FOLHA */}
          {[
            { title: '1ª VIA - HOSPITAL / ADMINISTRAÇÃO', isHospital: true },
            { title: '2ª VIA - PROFISSIONAL / COLABORADOR', isHospital: false }
          ].map((via, idx) => (
            <div 
              key={via.title} 
              className={`p-6 border border-slate-400 rounded-xl flex flex-col justify-between ${
                idx === 0 ? 'mb-6 border-b-2 border-dashed border-slate-500 pb-8' : ''
              }`}
              style={{ minHeight: '45%' }}
            >
              <div>
                {/* Cabeçalho da Via */}
                <div className="flex items-start justify-between border-b pb-3 border-slate-300">
                  <div>
                    <h2 className="text-base font-black uppercase tracking-wide">{currentUnit.name}</h2>
                    <p className="text-[11px] text-slate-600">CNPJ: {currentUnit.cnpj} · {currentUnit.address}</p>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">SISTEMA SCALEMEDIC CGT · GESTÃO OPERACIONAL E REPASSES</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-black uppercase px-2.5 py-1 bg-slate-200 border border-slate-400 rounded">
                      {via.title}
                    </span>
                    <p className="text-[11px] font-bold mt-1.5">Competência: {selectedMonth.split('-').reverse().join('/')}</p>
                  </div>
                </div>

                {/* Dados do Profissional */}
                <div className="grid grid-cols-3 gap-2 my-3 p-2.5 bg-slate-100 rounded text-xs border border-slate-200">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Profissional</span>
                    <strong className="text-sm">{printReceiptProf.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Especialidade / Registro</span>
                    <span>{printReceiptProf.specialty} {printReceiptProf.document ? `(CRM/Reg: ${printReceiptProf.document})` : ''}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Contrato / Chave PIX</span>
                    <span>{printReceiptProf.remuneration_type?.toUpperCase()} · PIX: {printReceiptProf.pix_key || 'Não informada'}</span>
                  </div>
                </div>

                {/* Resumo Financeiro */}
                <table className="w-full text-xs text-left my-2 border border-slate-300">
                  <thead className="bg-slate-200 text-[10px] uppercase border-b border-slate-300">
                    <tr>
                      <th className="py-1.5 px-3">Descrição dos Serviços</th>
                      <th className="py-1.5 px-3 text-center">Plantões Concluídos</th>
                      <th className="py-1.5 px-3 text-center">Horas Fechadas</th>
                      <th className="py-1.5 px-3 text-right">Total Liberado</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="py-2 px-3 font-medium">
                        Repasse de Plantões Médicos Realizados e Auditados ({selectedMonth})
                        {printReceiptProf.isMensal && (
                          <span className="block text-[10px] text-slate-500">
                            Cálculo proporcional: {printReceiptProf.completedShifts.length} de {printReceiptProf.completedShifts.length + printReceiptProf.pendingShifts.length} turnos do mês
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center font-bold">{printReceiptProf.completedShifts.length} turnos</td>
                      <td className="py-2 px-3 text-center font-bold">{printReceiptProf.completedHours}h</td>
                      <td className="py-2 px-3 text-right font-black text-sm">
                        R$ {printReceiptProf.completedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Declaração e Assinaturas */}
              <div className="mt-4 pt-3 border-t border-slate-300 text-[10px]">
                <p className="text-slate-600 mb-6 italic text-center">
                  "Declaro para os devidos fins que prestei os serviços de plantão discriminados e conferi os valores de repasse."
                </p>

                <div className="grid grid-cols-2 gap-8 text-center pt-2">
                  <div>
                    <div className="border-t border-slate-500 w-4/5 mx-auto mb-1"></div>
                    <p className="font-bold text-[11px]">{printReceiptProf.name}</p>
                    <p className="text-slate-500 text-[10px]">Assinatura do Profissional</p>
                  </div>
                  <div>
                    <div className="border-t border-slate-500 w-4/5 mx-auto mb-1"></div>
                    <p className="font-bold text-[11px]">{currentUnit.name}</p>
                    <p className="text-slate-500 text-[10px]">Diretoria Médica / Financeiro</p>
                  </div>
                </div>

                <div className="flex justify-between text-[9px] text-slate-400 mt-4">
                  <span>Emissão em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</span>
                  <span>Autenticação: SM-{printReceiptProf.id?.slice(0, 8).toUpperCase()}-{selectedMonth}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}