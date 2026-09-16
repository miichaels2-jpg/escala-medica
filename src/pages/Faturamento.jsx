import React, { useState, useMemo } from 'react';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  DollarSign, Calendar, Search, Download, Printer, CheckCircle2, 
  Building2, Users, Receipt, Send, CreditCard, ChevronLeft, ChevronRight, FileText
} from 'lucide-react';

function safeNumber(val, fb = 0) {
  if (val === null || val === undefined || val === '') return fb;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : fb;
}

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeNumber(val));
}

export default function Faturamento() {
  const { shifts, professionals, sectors, company, isManager } = useAppData();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfModal, setSelectedProfModal] = useState(null);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  const professionalMap = useMemo(() => {
    const m = {};
    (professionals || []).forEach(p => { if (p) m[String(p.id)] = p; });
    return m;
  }, [professionals]);

  const sectorMap = useMemo(() => {
    const m = {};
    (sectors || []).forEach(s => { if (s) m[String(s.id)] = s; });
    return m;
  }, [sectors]);

  function getProfMeta(prof) {
    if (!prof) return {};
    try {
      const stored = window.localStorage.getItem(`prof_meta_${prof.id}`);
      if (stored) return JSON.parse(stored);
    } catch {}
    if (prof.data && typeof prof.data === 'object') return prof.data;
    return {};
  }

  // CÁLCULO DIRETO DA ESCALA PARA O FATURAMENTO
  const reportData = useMemo(() => {
    const profsSummary = {};

    // 1. Inicializa cada profissional com suas regras contratuais
    (professionals || []).forEach(p => {
      const meta = getProfMeta(p);
      const remunType = p.remuneration_type || meta.remuneration_type || 'mensal';
      
      let baseVal = 0;
      if (remunType === 'hora') baseVal = p.hourly_rate ?? meta.hourly_rate ?? 120;
      else if (remunType === 'diaria') baseVal = p.daily_rate ?? meta.daily_rate ?? 1500;
      else baseVal = p.monthly_salary ?? meta.monthly_salary ?? 5000;

      const taxRate = p.coop_tax_rate ?? meta.coop_tax_rate ?? 0;
      const matricula = p.registration_id || meta.registration_id || 'MAT-XXXX';
      const chavePix = p.pix_key || meta.pix_key || 'Não cadastrado';
      const pixTipo = p.pix_type || meta.pix_type || 'CPF';
      const banco = p.bank_info || meta.bank_info || 'Não cadastrado';

      profsSummary[String(p.id)] = {
        prof: p,
        matricula,
        chavePix,
        pixTipo,
        banco,
        remunType,
        baseVal: safeNumber(baseVal),
        taxRate: safeNumber(taxRate),
        totalPlantões: 0,
        totalHoras: 0,
        plantõesList: []
      };
    });

    // 2. Vasculha os plantões do mês na Escala
    (shifts || []).forEach(shift => {
      if (!shift.date || !shift.date.startsWith(monthPrefix)) return;
      if (!shift.professional_id || shift.status === 'vago') return;

      const pId = String(shift.professional_id);
      if (profsSummary[pId]) {
        const [startH, startM] = (shift.start_time || '07:00').split(':').map(Number);
        const [endH, endM] = (shift.end_time || '19:00').split(':').map(Number);
        let duration = endH - startH + (endM - startM) / 60;
        if (duration <= 0) duration += 24;

        profsSummary[pId].totalPlantões += 1;
        profsSummary[pId].totalHoras += duration;
        profsSummary[pId].plantõesList.push({
          ...shift,
          duration
        });
      }
    });

    // 3. Calcula o Valor Bruto, Descontos e Valor Líquido
    return Object.values(profsSummary).map(item => {
      let valorBruto = 0;

      if (item.remunType === 'hora') {
        valorBruto = item.totalHoras * item.baseVal;
      } else if (item.remunType === 'diaria') {
        valorBruto = item.totalPlantões * item.baseVal;
      } else {
        // Mensalista fixo
        valorBruto = item.totalPlantões > 0 ? item.baseVal : item.baseVal;
      }

      const valorDesconto = (valorBruto * item.taxRate) / 100;
      const valorLiquido = valorBruto - valorDesconto;

      return {
        ...item,
        valorBruto,
        valorDesconto,
        valorLiquido
      };
    });
  }, [professionals, shifts, monthPrefix]);

  const filteredReport = useMemo(() => {
    const term = searchQuery.toLowerCase().trim();
    return reportData.filter(item => {
      if (!term) return true;
      const nome = (item.prof.name || '').toLowerCase();
      const doc = (item.prof.document || '').toLowerCase();
      const mat = (item.matricula || '').toLowerCase();
      return nome.includes(term) || doc.includes(term) || mat.includes(term);
    });
  }, [reportData, searchQuery]);

  // Totais Executivos
  const totals = useMemo(() => {
    let bruto = 0, liquido = 0, plantões = 0, horas = 0;
    reportData.forEach(i => {
      bruto += i.valorBruto;
      liquido += i.valorLiquido;
      plantões += i.totalPlantões;
      horas += i.totalHoras;
    });
    return { bruto, liquido, plantões, horas };
  }, [reportData]);

  // Disparar Extrato via WhatsApp
  const handleSendStatementWhatsApp = (item) => {
    const cleanPhone = String(item.prof.phone || '').replace(/\D/g, '');
    if (!cleanPhone) { alert('Profissional não possui telefone cadastrado.'); return; }
    const phoneWithDDI = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    const msg = [
      `*ScaleMedic - Extrato de Honorários & Repasse* 🏥`,
      `Competência: *${MONTH_NAMES[currentMonth]} / ${currentYear}*`,
      `Profissional: *${item.prof.name}* (ID: ${item.matricula})\n`,
      `📊 *Resumo dos Plantões:*`,
      `• Total de Plantões Realizados: ${item.totalPlantões}`,
      `• Total de Horas Computadas: ${item.totalHoras}h`,
      `• Regime: ${item.remunType === 'hora' ? 'Horista' : item.remunType === 'diaria' ? 'Plantonista' : 'Mensalista'}\n`,
      `💰 *Valores para Repasse:*`,
      `• Valor Bruto: ${formatCurrency(item.valorBruto)}`,
      `• Retenções / Impostos: ${formatCurrency(item.valorDesconto)}`,
      `• *VALOR LÍQUIDO A RECEBER:* ${formatCurrency(item.valorLiquido)}\n`,
      `💳 *Dados Bancários / PIX Cadastrados:*`,
      `• Chave PIX: ${item.chavePix} (${item.pixTipo})`,
      `• Conta: ${item.banco}\n`,
      `_Por favor, confira os dados. Havendo divergência, contate a coordenação médica._`
    ].join('\n');

    window.open(`https://api.whatsapp.com/send?phone=${phoneWithDDI}&text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans bg-slate-100 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      
      {/* BANNER PRINCIPAL */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <DollarSign className="w-4 h-4" /> Gestão Financeira & Conciliação de Plantões
          </div>
          <h2 className="mt-1 text-2xl sm:text-3xl font-black">Faturamento & Repasse Médico</h2>
          <p className="text-xs text-slate-300">
            Cálculo automatizado cruzando escalas realizadas com os valores contratuais de cada profissional.
          </p>
        </div>

        {/* CONTROLE DE COMPETÊNCIA (MÊS/ANO) */}
        <div className="flex items-center bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl gap-2">
          <button onClick={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))} className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-black px-2 uppercase">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </span>
          <button onClick={() => setCurrentDate(new Date(currentYear, currentMonth + 1, 1))} className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CARDS EXECUTIVOS DE KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black uppercase text-slate-400">Total Bruto dos Honorários</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatCurrency(totals.bruto)}</div>
          <span className="text-[10px] text-slate-500 font-semibold">{totals.plantões} plantões contabilizados</span>
        </Card>

        <Card className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Total Líquido p/ Repasse</span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(totals.liquido)}</div>
          <span className="text-[10px] text-slate-500 font-semibold">Após retenções contratuais</span>
        </Card>

        <Card className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black uppercase text-sky-600 dark:text-sky-400">Plantões Realizados</span>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">{totals.plantões}</div>
          <span className="text-[10px] text-slate-500 font-semibold">{totals.horas} horas no mês</span>
        </Card>

        <Card className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">Profissionais na Folha</span>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{reportData.length}</div>
          <span className="text-[10px] text-slate-500 font-semibold">Equipe credenciada ativa</span>
        </Card>
      </div>

      {/* TABELA DE REPASSE & BUSCA */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Espelho de Conciliação e Fechamento</h3>
            <p className="text-xs text-slate-500">Valores computados conforme os plantões executados na escala.</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="Buscar por médico ou matrícula..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="pl-9 h-9 text-xs" 
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 uppercase text-[10px] font-black border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Profissional / Matrícula</th>
                <th className="py-3 px-4">Regime Contratual</th>
                <th className="py-3 px-4 text-center">Plantões / Horas</th>
                <th className="py-3 px-4">Chave PIX para Repasse</th>
                <th className="py-3 px-4 text-right">Valor Bruto</th>
                <th className="py-3 px-4 text-right">Líquido a Pagar</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredReport.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    Nenhum registro encontrado para esta competência.
                  </td>
                </tr>
              ) : (
                filteredReport.map(item => (
                  <tr key={item.prof.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-black text-slate-900 dark:text-white">{item.prof.name}</div>
                      <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">{item.matricula} • {item.prof.document || 'CRM'}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {item.remunType === 'hora' ? 'Horista' : item.remunType === 'diaria' ? 'Plantonista' : 'Fixo Mensal'}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">{formatCurrency(item.baseVal)} base</div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="font-bold text-slate-900 dark:text-white">{item.totalPlantões} plantões</span>
                      <div className="text-[10px] font-mono text-slate-400">{item.totalHoras}h totais</div>
                    </td>

                    <td className="py-3 px-4 font-mono">
                      <span className="text-sky-600 font-bold">{item.chavePix}</span>
                      <div className="text-[10px] text-slate-400">{item.pixTipo}</div>
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-slate-700 dark:text-slate-300">
                      {formatCurrency(item.valorBruto)}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(item.valorLiquido)}
                      </span>
                      {item.taxRate > 0 && <div className="text-[9px] text-rose-500">-{item.taxRate}% retenção</div>}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setSelectedProfModal(item)}
                          className="h-8 text-xs font-bold gap-1 rounded-xl"
                        >
                          <FileText className="w-3.5 h-3.5 text-sky-600" /> Detalhar
                        </Button>

                        {item.prof.phone && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleSendStatementWhatsApp(item)}
                            title="Enviar Extrato no WhatsApp"
                            className="h-8 px-2.5 rounded-xl border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE DETALHAMENTO DE PLANTÕES DO PROFISSIONAL */}
      <Dialog open={!!selectedProfModal} onOpenChange={() => setSelectedProfModal(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-950 text-slate-900 dark:text-white border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-slate-900 dark:text-white">
              <Receipt className="w-5 h-5 text-emerald-600" />
              Espelho de Plantões • {selectedProfModal?.prof.name}
            </DialogTitle>
          </DialogHeader>

          {selectedProfModal && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Matrícula ID</span>
                  <strong className="font-mono text-sm text-indigo-600 dark:text-indigo-400">{selectedProfModal.matricula}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Chave PIX</span>
                  <strong className="font-mono text-xs text-sky-600 truncate block">{selectedProfModal.chavePix}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Plantões Realizados</span>
                  <strong className="text-sm">{selectedProfModal.totalPlantões} plantões</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Valor Líquido</span>
                  <strong className="text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedProfModal.valorLiquido)}</strong>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-black uppercase text-slate-500 text-[11px] block">Relação de Plantões na Escala</span>
                <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedProfModal.plantõesList.length === 0 ? (
                    <div className="p-4 text-center text-slate-400">Nenhum plantão localizado na escala deste mês.</div>
                  ) : (
                    selectedProfModal.plantõesList.map(p => (
                      <div key={p.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {new Date(p.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                          </span>
                          <span className="text-[10px] text-slate-500">{sectorMap[p.sector_id]?.name || 'Setor'} • {p.start_time} às {p.end_time}</span>
                        </div>
                        <span className="font-mono font-bold text-sky-600 bg-sky-50 dark:bg-sky-950/30 px-2 py-1 rounded-lg">
                          {p.duration}h computadas
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedProfModal(null)} className="h-9 text-xs">
                  Fechar
                </Button>
                <Button onClick={() => handleSendStatementWhatsApp(selectedProfModal)} className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 gap-2">
                  <Send className="w-3.5 h-3.5" /> Enviar Extrato via WhatsApp
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}