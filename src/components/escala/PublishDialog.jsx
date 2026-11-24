// Publicar a escala do setor (mês inteiro, 15 ou 7 dias).
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { History, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function PublishDialog({ existingPublishedOverlaps, handleApplyQuickRange, handleExecutePublishSector, publishConfig, publishModalOpen, sectors, setPublishConfig, setPublishModalOpen, submitting }) {
  return (
    <>
      {/* 7. MODAL DE PUBLICAÇÃO DE ESCALA */}
      {/* ========================================================================= */}
      <Dialog open={publishModalOpen} onOpenChange={setPublishModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md bg-slate-950 border border-slate-800 text-white shadow-sm rounded-3xl p-6">
          <DialogHeader className="border-b border-slate-800 pb-4">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-emerald-400">
              <Send className="w-5 h-5" /> Publicar e Oficializar Escala
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-400 leading-relaxed">
              A publicação oficializa a grade para os profissionais. A partir desse momento, ela fica visível no aplicativo (Minha Escala) e os médicos recebem as notificações de confirmação de seus plantões.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Setor a ser publicado</Label>
              <Select value={publishConfig.sector_id} onValueChange={v => setPublishConfig({ ...publishConfig, sector_id: v })}>
                <SelectTrigger className="h-10 bg-slate-900 border-slate-700 text-white font-semibold rounded-xl">
                  <SelectValue placeholder="Selecione o setor..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white z-[99999]">
                  {(sectors || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">Data Inicial</Label>
                <Input type="date" value={publishConfig.start_date} onChange={e => setPublishConfig({ ...publishConfig, start_date: e.target.value })} className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl cursor-pointer" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">Data Final</Label>
                <Input type="date" value={publishConfig.end_date} onChange={e => setPublishConfig({ ...publishConfig, end_date: e.target.value })} className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl cursor-pointer" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="button" onClick={() => handleApplyQuickRange('7days')} variant="outline" className="flex-1 h-8 text-[10px] font-semibold border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer">7 Dias</Button>
              <Button type="button" onClick={() => handleApplyQuickRange('15days')} variant="outline" className="flex-1 h-8 text-[10px] font-semibold border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer">15 Dias</Button>
              <Button type="button" onClick={() => handleApplyQuickRange('month')} variant="outline" className="flex-1 h-8 text-[10px] font-semibold border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer">Mês Inteiro</Button>
            </div>

            {existingPublishedOverlaps.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <p className="text-[10px] font-semibold text-amber-500 flex items-center gap-1.5 mb-1"><History className="w-3.5 h-3.5" /> Sobrescrita Detectada</p>
                <p className="text-[10px] text-amber-200/70 leading-tight">Você está publicando um período que já possui dias oficializados. A versão mais recente se tornará a escala principal.</p>
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t border-slate-800">
            <Button type="button" variant="outline" onClick={() => setPublishModalOpen(false)} className="h-11 border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl cursor-pointer">Cancelar</Button>
            <Button type="button" onClick={handleExecutePublishSector} disabled={submitting || !publishConfig.sector_id} className="h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 rounded-xl shadow-sm cursor-pointer">
              Oficializar Escala
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
