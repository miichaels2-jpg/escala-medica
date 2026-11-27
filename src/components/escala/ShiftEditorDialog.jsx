// Janela de lançar/editar um plantão.
import { AlertTriangle, Flame, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SpecialtyPicker from '@/components/SpecialtyPicker';

export default function ShiftEditorDialog({ categorizedProfessionalsForModal, editingShiftId, formData, handleDeleteShift, handleSaveShift, isEditingPastShift, modalOpen, professionalMap, registeredSpecialties, sectors, setFormData, setModalOpen, submitting }) {
  return (
    <>
      {/* ========================================================================= */}
      {/* 5. MODAL LANÇAR / EDITAR PLANTÃO COM ALTURA RESPONSIVA (MAX-H-85VH)       */}
      {/* ========================================================================= */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-2xl z-[9999] p-4 sm:p-6 rounded-3xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <DialogTitle className="text-base font-semibold text-sky-700 dark:text-sky-400">
              {editingShiftId ? 'Editar Plantão da Escala' : 'Lançar Novo Plantão'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveShift} className="space-y-3.5 py-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Data do Plantão *</Label>
                <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl cursor-pointer" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Setor / Seção *</Label>
                <Select value={formData.sector_id} onValueChange={v => setFormData({ ...formData, sector_id: v })}>
                  <SelectTrigger className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl">
                    <SelectValue placeholder="Selecione o setor..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white z-[99999]">
                    {(sectors || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Especialidade Exigida *</Label>
              <SpecialtyPicker
                value={formData.target_specialty}
                options={registeredSpecialties}
                onChange={value => setFormData(prev => ({ ...prev, target_specialty: value }))}
                triggerClassName="h-10 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 font-semibold text-sky-700 dark:text-sky-400 rounded-xl"
                contentClassName="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Horário Entrada</Label>
                <Input type="time" value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })} className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Horário Saída</Label>
                <Input type="time" value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })} className="h-10 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl" />
              </div>
            </div>

            <div className="p-3.5 sm:p-4 bg-white/90 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <Label className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Modo de Alocação</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button 
                  type="button" 
                  onClick={() => setFormData({ ...formData, action_type: 'alocar' })} 
                  className={`p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${formData.action_type === 'alocar' ? 'bg-sky-600 border-sky-600 text-white shadow-sm' : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  Alocar Pessoal
                </button>
                <button 
                  type="button" 
                  onClick={() => setFormData({ ...formData, action_type: 'mural', professional_id: '' })} 
                  className={`p-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${formData.action_type === 'mural' ? 'bg-rose-600 border-rose-600 text-white shadow-sm' : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  <Flame className="w-3.5 h-3.5" /> Vaga no Mural
                </button>
              </div>

              {formData.action_type === 'alocar' ? (
                <div className="space-y-1.5 pt-1 w-full">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Profissional Disponível *</Label>
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                      {categorizedProfessionalsForModal.available.length} livre(s)
                    </span>
                  </div>

                  <div className="relative w-full">
                    <select
                      value={formData.professional_id || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        const p = professionalMap[v];
                        setFormData({
                          ...formData,
                          professional_id: v,
                          target_specialty: p?.specialty || formData.target_specialty
                        });
                      }}
                      className="w-full h-11 px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none appearance-none truncate pr-9 cursor-pointer"
                    >
                      <option value="">Selecione o profissional...</option>

                      <optgroup label="🟢 PROFISSIONAIS DISPONÍVEIS">
                        {categorizedProfessionalsForModal.available.map(p => (
                          <option key={p.id} value={String(p.id)} className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white py-1.5">
                            {p.workloadWarning ? '⚠' : '✓'} {p.name} • {p.specialty || 'Geral'} ({p.document || 'CRM'}){p.workloadWarning ? ` — ${p.workloadWarning}` : ''}
                          </option>
                        ))}
                      </optgroup>

                      {categorizedProfessionalsForModal.unavailable.length > 0 && (
                        <optgroup label="⛔ INDISPONÍVEIS">
                          {categorizedProfessionalsForModal.unavailable.map(p => (
                            <option key={p.id} value={String(p.id)} disabled className="bg-white dark:bg-slate-950 text-rose-600 dark:text-rose-400 py-1 opacity-70">
                              ✕ {p.name} • {p.conflictReason}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 dark:text-slate-400 text-xs">
                      ▼
                    </div>
                  </div>
                </div>
              ) : (
                formData.is_extra ? (
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 leading-tight">
                    Fica como <b>vaga extra</b> na escala, para você encaixar alguém depois. Não vai para o Mural.
                  </p>
                ) : (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 leading-tight">
                    O plantão será disponibilizado no <b>Mural</b> para que os profissionais assumam.
                  </p>
                )
              )}

              <label className="flex items-start gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 cursor-pointer">
                <input type="checkbox" checked={Boolean(formData.is_extra)} onChange={e => setFormData({ ...formData, is_extra: e.target.checked })} className="mt-0.5 h-4 w-4 accent-sky-600 cursor-pointer" />
                <span className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
                  <b className="text-slate-900 dark:text-white">Vaga extra</b> · folga para encaixar alguém além da equipe fixa. Não vai para o Mural e, vazia, não conta como vaga em aberto nem furo.
                </span>
              </label>

              {/* CAMPO DE JUSTIFICATIVA RETROATIVA */}
              {isEditingPastShift && formData.action_type === 'alocar' && (
                <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <Label className="text-xs font-semibold text-amber-600 dark:text-amber-500 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Justificativa Retroativa *
                  </Label>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mb-1">Como este plantão já aconteceu, descreva o motivo do lançamento tardio para fins de auditoria financeira.</p>
                  <Input 
                    value={formData.retroactive_justification} 
                    onChange={e => setFormData({...formData, retroactive_justification: e.target.value})} 
                    placeholder="Ex: Profissional cobriu furo de última hora..." 
                    className="h-10 bg-white dark:bg-slate-950 border-amber-500/50 text-amber-900 dark:text-amber-100 rounded-xl" 
                    required 
                  />
                </div>
              )}
            </div>

            <DialogFooter className="pt-3 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 dark:border-slate-800 mt-2 gap-2">
              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                {editingShiftId && (
                  <Button type="button" variant="ghost" onClick={() => handleDeleteShift(editingShiftId)} className="h-10 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl px-3 cursor-pointer">
                    <Trash2 className="w-4 h-4 mr-1" /> Excluir
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1 sm:flex-none h-10 text-xs font-semibold border-slate-300 dark:border-slate-700 bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-xl px-4 cursor-pointer">
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1 sm:flex-none h-10 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs px-6 rounded-xl shadow-sm cursor-pointer">
                  Confirmar
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </>
  );
}
