// Publicar a escala do setor (mês inteiro, 15 ou 7 dias).
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { History, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { monthLabel, percentChange, previousRange, professionalFinder, summarizePeriod } from '@/lib/monthSummary';
import { useAppData } from '@/lib/useAppData';
import { isExtraVacancy } from '@/lib/sectorTemplates';
import { isShiftVacant } from '@/lib/shiftLiveStatus';

const brl = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value || 0);
const fmtDay = date => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

// O que vai ser publicado: plantões, vagas e custo estimado, comparado com o período anterior.
function PublishPreview({ shifts, professionals, sectorId, start, end }) {
  const { company } = useAppData();
  const preview = useMemo(() => {
    if (!sectorId || !start || !end || end < start) return null;
    // Vagas extras vazias saem ao publicar: não entram na conta.
    const allSector = shifts.filter(s => String(s.sector_id) === String(sectorId));
    const isEmptyExtra = s => isExtraVacancy(s) && isShiftVacant(s);
    const emptyExtras = allSector.filter(s => isEmptyExtra(s) && s.date >= start && s.date <= end).length;
    const sectorShifts = allSector.filter(s => !isEmptyExtra(s));
    const getProf = professionalFinder(professionals);
    const cur = summarizePeriod({ shifts: sectorShifts, start, end, getProf, company });
    const [prevStart, prevEnd] = previousRange(start, end);
    const prev = summarizePeriod({ shifts: sectorShifts, start: prevStart, end: prevEnd, getProf, company });
    const wholeMonth = prevStart.slice(8) === '01' && start.slice(8) === '01' && prevStart.slice(0, 7) !== start.slice(0, 7);
    const prevName = wholeMonth ? monthLabel(prevStart.slice(0, 7), { withYear: false }) : `${fmtDay(prevStart)} a ${fmtDay(prevEnd)}`;
    return { cur, prev, prevName, emptyExtras };
  }, [shifts, professionals, sectorId, start, end, company]);

  if (!preview) return null;
  const { cur, prev, prevName, emptyExtras } = preview;
  if (!cur.total) {
    return <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3 text-xs text-slate-600 dark:text-slate-300">Nenhum plantão lançado neste setor no período escolhido.</p>;
  }
  const change = percentChange(cur.cost, prev.cost);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 space-y-1.5">
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">O que vai ser publicado</p>
      <p className="text-sm text-slate-800 dark:text-slate-100">
        <b className="tabular-nums">{cur.total}</b> {cur.total === 1 ? 'plantão' : 'plantões'}{' '}
        {cur.vacant > 0
          ? <span className="text-amber-700 dark:text-amber-400">· <b className="tabular-nums">{cur.vacant}</b> sem profissional</span>
          : <span className="text-slate-500 dark:text-slate-400">· todos com profissional</span>}
      </p>
      <p className="text-sm text-slate-800 dark:text-slate-100">
        Custo estimado <b className="tabular-nums">{brl(cur.cost)}</b>
        {prev.cost > 0 && change !== null && (
          <span className="text-slate-500 dark:text-slate-400">
            {' '}· {change === 0 ? 'igual a' : `${String(Math.abs(change)).replace('.', ',')}% ${change > 0 ? 'acima de' : 'abaixo de'}`} {prevName} ({brl(prev.cost)})
          </span>
        )}
      </p>
      {emptyExtras > 0 && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{emptyExtras} vaga(s) extra(s) vazia(s) saem da escala ao publicar.</p>
      )}
      {(cur.pendingProduction > 0 || cur.missingRate > 0) && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {cur.pendingProduction > 0 && `${cur.pendingProduction} por produtividade entram só no fechamento. `}
          {cur.missingRate > 0 && `${cur.missingRate} sem valor cadastrado no Corpo Clínico.`}
        </p>
      )}
    </div>
  );
}

export default function PublishDialog({ existingPublishedOverlaps, handleApplyQuickRange, handleExecutePublishSector, professionals = [], publishConfig, publishModalOpen, sectors, setPublishConfig, setPublishModalOpen, shifts = [], submitting }) {
  return (
    <>
      {/* 7. MODAL DE PUBLICAÇÃO DE ESCALA */}
      {/* ========================================================================= */}
      <Dialog open={publishModalOpen} onOpenChange={setPublishModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-sm rounded-3xl p-6">
          <DialogHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Send className="w-5 h-5" /> Publicar e Oficializar Escala
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              A publicação oficializa a grade para os profissionais. A partir desse momento, ela fica visível no aplicativo (Minha Escala) e os médicos recebem as notificações de confirmação de seus plantões.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Setor a ser publicado</Label>
              <Select value={publishConfig.sector_id} onValueChange={v => setPublishConfig({ ...publishConfig, sector_id: v })}>
                <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-semibold rounded-xl">
                  <SelectValue placeholder="Selecione o setor..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white z-[99999]">
                  {(sectors || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Data Inicial</Label>
                <Input type="date" value={publishConfig.start_date} onChange={e => setPublishConfig({ ...publishConfig, start_date: e.target.value })} className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl cursor-pointer" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Data Final</Label>
                <Input type="date" value={publishConfig.end_date} onChange={e => setPublishConfig({ ...publishConfig, end_date: e.target.value })} className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl cursor-pointer" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="button" onClick={() => handleApplyQuickRange('7days')} variant="outline" className="flex-1 h-8 text-[10px] font-semibold border-slate-300 dark:border-slate-700 bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white cursor-pointer">7 Dias</Button>
              <Button type="button" onClick={() => handleApplyQuickRange('15days')} variant="outline" className="flex-1 h-8 text-[10px] font-semibold border-slate-300 dark:border-slate-700 bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white cursor-pointer">15 Dias</Button>
              <Button type="button" onClick={() => handleApplyQuickRange('month')} variant="outline" className="flex-1 h-8 text-[10px] font-semibold border-slate-300 dark:border-slate-700 bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white cursor-pointer">Mês Inteiro</Button>
            </div>

            <PublishPreview shifts={shifts} professionals={professionals} sectorId={publishConfig.sector_id} start={publishConfig.start_date} end={publishConfig.end_date} />

            {existingPublishedOverlaps.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-500 flex items-center gap-1.5 mb-1"><History className="w-3.5 h-3.5" /> Sobrescrita Detectada</p>
                <p className="text-[10px] text-amber-800 dark:text-amber-200/70 leading-tight">Você está publicando um período que já possui dias oficializados. A versão mais recente se tornará a escala principal.</p>
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setPublishModalOpen(false)} className="h-11 border-slate-300 dark:border-slate-700 bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-xl cursor-pointer">Cancelar</Button>
            <Button type="button" onClick={handleExecutePublishSector} disabled={submitting || !publishConfig.sector_id} className="h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 rounded-xl shadow-sm cursor-pointer">
              Oficializar Escala
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
