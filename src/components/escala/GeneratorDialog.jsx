// Gerador do mês ("Montar escala"): setor, período e turnos.
import { ArrowRight, Check, CheckCircle2, ChevronRight, Clock, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { WEEKDAY_INITIALS } from '@/lib/sectorTemplates';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SpecialtyPicker from '@/components/SpecialtyPicker';

export default function GeneratorDialog({ generatorConfig, generatorFromTemplate, generatorModalOpen, handleAddSlot, handleExecuteGenerator, handleRemoveSlot, handleUpdateSlot, isManager, loadSectorIntoGenerator, registeredSpecialties, saveAsTemplate, sectors, setGeneratorConfig, setGeneratorModalOpen, setSaveAsTemplate, submitting }) {
  return (
    <>
      {/* ========================================================================= */}
      {/* 6. MODAL GERADOR E CONFIGURADOR DE ESCALAS EM MASSA                       */}
      {/* ========================================================================= */}
      <Dialog open={generatorModalOpen} onOpenChange={setGeneratorModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-sm rounded-3xl p-6">
          <DialogHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <SlidersHorizontal className="w-5 h-5" /> Montar escala
            </DialogTitle>
            <ol className="flex items-center gap-2 pt-3 text-[11px] font-semibold" aria-label="Etapas">
                {['Grade', 'Profissionais', 'Salvar e publicar'].map((label, i) => (
                  <li key={label} className="flex items-center gap-2">
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${i + 1 === 1 ? 'bg-sky-500 text-white' : i + 1 < 1 ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{i + 1 < 1 ? <Check className="h-3 w-3" /> : i + 1}</span>
                    <span className={i + 1 === 1 ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}>{label}</span>
                    {i < 2 && <ChevronRight className="h-3.5 w-3.5 text-slate-600" />}
                  </li>
                ))}
              </ol>
          </DialogHeader>

          <form onSubmit={handleExecuteGenerator} className="space-y-5 py-2">
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">Setor Alvo</Label>
                <Select value={generatorConfig.sector_id} onValueChange={loadSectorIntoGenerator}>
                  <SelectTrigger className="h-10 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-semibold rounded-xl">
                    <SelectValue placeholder="Selecione o setor..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white z-[99999]">
                    {(sectors || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">Data de Início da Grade</Label>
                <Input type="date" value={generatorConfig.start_date} onChange={e => setGeneratorConfig({ ...generatorConfig, start_date: e.target.value })} className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl cursor-pointer" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">Duração (Dias Sequenciais)</Label>
                <Input type="number" min="1" max="365" value={generatorConfig.duration_days} onChange={e => setGeneratorConfig({ ...generatorConfig, duration_days: e.target.value })} className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1"><ArrowRight className="w-3.5 h-3.5"/> Repetir de N em N dias</Label>
                <Input type="number" min="1" max="30" value={generatorConfig.interval_days} onChange={e => setGeneratorConfig({ ...generatorConfig, interval_days: e.target.value })} placeholder="Ex: 15" className="h-10 bg-slate-50 dark:bg-slate-900 border-amber-500/50 text-amber-700 dark:text-amber-300 font-semibold rounded-xl" required />
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-sky-700 dark:text-sky-400 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Configuração Diária das Vagas
                </Label>
                <Button type="button" onClick={handleAddSlot} variant="outline" className="h-8 text-xs font-semibold border-slate-300 dark:border-slate-700 bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-lg px-3 cursor-pointer">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Novo Turno
                </Button>
              </div>

              <div className="space-y-2">
                {generatorConfig.slots.map((slot) => (
                  <div key={slot.id} className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl relative group">
                    <div className="w-full sm:w-auto flex-1 min-w-0 space-y-1">
                      <Label className="text-xs text-slate-500 font-medium">Especialidade</Label>
                      <SpecialtyPicker
                        value={slot.specialty}
                        options={registeredSpecialties}
                        onChange={value => handleUpdateSlot(slot.id, 'specialty', value)}
                        triggerClassName="h-9 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                        contentClassName="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="w-24 shrink-0 space-y-1">
                      <Label className="text-xs text-slate-500 font-medium">Entrada</Label>
                      <Input type="time" value={slot.start_time} onChange={e => handleUpdateSlot(slot.id, 'start_time', e.target.value)} className="h-9 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white" required />
                    </div>
                    <div className="w-24 shrink-0 space-y-1">
                      <Label className="text-xs text-slate-500 font-medium">Saída</Label>
                      <Input type="time" value={slot.end_time} onChange={e => handleUpdateSlot(slot.id, 'end_time', e.target.value)} className="h-9 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white" required />
                    </div>
                    <div className="w-20 shrink-0 space-y-1">
                      <Label className="text-xs text-slate-500 font-medium">Vagas (Qtd)</Label>
                      <Input type="number" min="1" value={slot.quantity} onChange={e => handleUpdateSlot(slot.id, 'quantity', e.target.value)} className="h-9 text-xs font-semibold text-sky-700 dark:text-sky-400 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-center" required />
                    </div>
                    <div className="order-last basis-full flex flex-wrap items-center gap-2">
                      <Label className="text-xs text-slate-500 font-medium">Vagas extras</Label>
                      <Input type="number" min="0" max="50" value={slot.extra_quantity ?? 0} onChange={e => handleUpdateSlot(slot.id, 'extra_quantity', e.target.value)} aria-label="Vagas extras" className="h-8 w-16 text-xs text-center bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
                      {(parseInt(slot.extra_quantity, 10) || 0) > 0 && (
                        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Dias das vagas extras">
                          <span className="text-[11px] text-slate-500 mr-0.5">nos dias</span>
                          {[1, 2, 3, 4, 5, 6, 0].map(day => {
                            const on = (slot.extra_weekdays || []).includes(day);
                            return (
                              <button key={day} type="button" aria-pressed={on}
                                onClick={() => handleUpdateSlot(slot.id, 'extra_weekdays', on ? slot.extra_weekdays.filter(d => d !== day) : [...(slot.extra_weekdays || []), day])}
                                className={`h-7 min-w-9 px-2 rounded-lg text-[11px] font-semibold border cursor-pointer ${on ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                {WEEKDAY_INITIALS[day]}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {generatorConfig.slots.length > 1 && (
                      <div className="w-full sm:w-auto mt-2 sm:mt-0 flex justify-end">
                        <Button type="button" variant="ghost" onClick={() => handleRemoveSlot(slot.id)} className="h-9 w-9 p-0 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {isManager && generatorConfig.sector_id && (
              <label className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 cursor-pointer">
                <input type="checkbox" checked={saveAsTemplate} onChange={e => setSaveAsTemplate(e.target.checked)} className="mt-0.5 h-4 w-4 accent-sky-500 cursor-pointer" />
                <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  <b className="text-slate-900 dark:text-white">{generatorFromTemplate ? 'Atualizar os turnos padrão do setor' : 'Guardar como turnos padrão do setor'}</b>
                  <span className="block text-slate-500 dark:text-slate-400">{generatorFromTemplate ? 'Estes turnos vieram do cadastro do setor. Marque se mudou algo e quer manter para os próximos meses.' : 'No próximo mês o gerador já abre com estes turnos. Dá para mudar em Setores.'}</span>
                </span>
              </label>
            )}

            <div className="p-4 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50 rounded-2xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
              <p className="text-xs text-sky-800 dark:text-sky-200 leading-relaxed">
                A cada data gerada, o sistema cria exatamente a quantidade configurada por horário, mais as vagas extras nos dias da semana escolhidos. Serão <b>{Math.ceil((parseInt(generatorConfig.duration_days) || 0) / (parseInt(generatorConfig.interval_days) || 1))}</b> dia(s) de grade e <b>{(generatorConfig.slots.reduce((acc, slot) => acc + (parseInt(slot.quantity) || 0), 0)) * Math.ceil((parseInt(generatorConfig.duration_days) || 0) / (parseInt(generatorConfig.interval_days) || 1))}</b> vagas no total. Nada é gravado agora: no próximo passo você escolhe os profissionais e só então salva ou publica.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setGeneratorModalOpen(false)} className="h-11 border-slate-300 dark:border-slate-700 bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-xl cursor-pointer">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="h-11 bg-sky-600 hover:bg-sky-500 text-white font-semibold px-6 rounded-xl cursor-pointer">
                Próximo: escolher profissionais <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
    </>
  );
}
