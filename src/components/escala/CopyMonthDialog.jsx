// Copiar a escala do mês anterior.
import { ArrowRight, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CopyMonthDialog({ duplicateConfig, duplicateModalOpen, handleExecuteDuplicate, sectors, setDuplicateConfig, setDuplicateModalOpen, submitting }) {
  return (
    <>
      {/* ========================================================================= */}
      {/* 8. MODAL DE DUPLICAR MÊS (COPIAR ESCALAS)                                 */}
      {/* ========================================================================= */}
      <Dialog open={duplicateModalOpen} onOpenChange={setDuplicateModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md bg-slate-950 border border-slate-800 text-white shadow-sm rounded-3xl p-6">
          <DialogHeader className="border-b border-slate-800 pb-4">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-indigo-400">
              <Copy className="w-5 h-5" /> Montar mês seguinte
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleExecuteDuplicate} className="space-y-4 py-2">
            <p className="text-xs text-slate-400 leading-relaxed">
              Usa um mês como modelo. Quem ainda pode assumir continua no mesmo plantão; quem está de férias, em choque de horário ou inativo vira vaga. Você revisa antes de salvar ou publicar.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Setor a ser duplicado</Label>
              <Select value={duplicateConfig.sector_id} onValueChange={v => setDuplicateConfig({ ...duplicateConfig, sector_id: v })}>
                <SelectTrigger className="h-10 bg-slate-900 border-slate-700 text-white font-semibold rounded-xl">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white z-[99999]">
                  <SelectItem value="todos" className="text-sky-400 font-semibold">Todos os Setores</SelectItem>
                  {(sectors || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">Mês modelo</Label>
                <Input type="month" value={duplicateConfig.source_date} onChange={e => setDuplicateConfig({ ...duplicateConfig, source_date: e.target.value })} className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl cursor-pointer" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">Mês a montar</Label>
                <Input type="month" value={duplicateConfig.target_date} onChange={e => setDuplicateConfig({ ...duplicateConfig, target_date: e.target.value })} className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl cursor-pointer" required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Como repetir os dias</Label>
              <div className="grid grid-cols-2 gap-2">
                {[{ id: 'semana', label: 'Mesmo dia da semana', desc: '2ª segunda continua 2ª segunda' }, { id: 'dia', label: 'Mesmo dia do mês', desc: 'Dia 15 continua dia 15' }].map(opt => (
                  <button key={opt.id} type="button" onClick={() => setDuplicateConfig(prev => ({ ...prev, mode: opt.id }))}
                    className={`text-left rounded-xl border p-2.5 cursor-pointer ${duplicateConfig.mode === opt.id ? 'border-sky-500 bg-sky-500/10' : 'border-slate-700 bg-slate-900'}`}>
                    <span className="block text-xs font-semibold text-white">{opt.label}</span>
                    <span className="block text-[11px] text-slate-400">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-800">
              <Button type="button" variant="outline" onClick={() => setDuplicateModalOpen(false)} className="h-11 border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl cursor-pointer">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="h-11 bg-sky-600 hover:bg-sky-500 text-white font-semibold px-6 rounded-xl cursor-pointer">
                Revisar escala <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </>
  );
}
