// Depois do gerador: escolher quem fica em cada vaga e salvar.
import { Button } from '@/components/ui/button';
import { Check, CheckCheck, ChevronLeft, ChevronRight, HeartPulse, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import React from 'react';
import { extractSpecialty, formatDateBR, formatFullName } from '@/lib/escalaUtils';

export default function BulkAllocationDialog({ autoFillBulkAllocation, backToGenerator, bulkAllocationDraft, bulkAllocationOpen, discardGeneratedSchedule, generatedAllocationRows, generatorSkippedCount, generatorSourceInfo, getBulkCandidates, handleSaveGeneratedSchedule, professionalMap, sectorMap, setBulkAllocationDraft, submitting }) {
  return (
    <>
      {/* ========================================================================= */}
      {/* 6B. ALOCAÇÃO EM LOTE DAS VAGAS GERADAS                                  */}
      {/* ========================================================================= */}
      <Dialog open={bulkAllocationOpen} onOpenChange={open => { if (!open) discardGeneratedSchedule(); }}>
        <DialogContent className="w-[96vw] sm:max-w-5xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-sm rounded-3xl p-5 sm:p-6">
          <DialogHeader className="border-b border-slate-200 dark:border-slate-800 pb-4 shrink-0">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-sky-700 dark:text-sky-400">
              <HeartPulse className="w-5 h-5" /> Montar escala · {new Set((generatedAllocationRows || []).map(r => String(r.sector_id))).size > 1 ? `${new Set((generatedAllocationRows || []).map(r => String(r.sector_id))).size} setores` : (sectorMap[String(generatedAllocationRows[0]?.sector_id)]?.name || 'Setor')}
            </DialogTitle>
            <ol className="flex items-center gap-2 pt-3 text-[11px] font-semibold" aria-label="Etapas">
                {['Grade', 'Profissionais', 'Salvar e publicar'].map((label, i) => (
                  <li key={label} className="flex items-center gap-2">
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${i + 1 === 2 ? 'bg-sky-500 text-white' : i + 1 < 2 ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{i + 1 < 2 ? <Check className="h-3 w-3" /> : i + 1}</span>
                    <span className={i + 1 === 2 ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}>{label}</span>
                    {i < 2 && <ChevronRight className="h-3.5 w-3.5 text-slate-600" />}
                  </li>
                ))}
              </ol>
          </DialogHeader>

          {(() => {
            const rows = (generatedAllocationRows || [])
              .slice()
              .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.start_time).localeCompare(String(b.start_time)));
            const assignedCount = rows.filter(row => bulkAllocationDraft[String(row.id)]).length;
            const load = {};
            rows.forEach(row => { const id = bulkAllocationDraft[String(row.id)]; if (id) load[id] = (load[id] || 0) + 1; });
            const loadList = Object.entries(load)
              .map(([id, count]) => ({ id, count, name: formatFullName(professionalMap[id]?.name) || 'Profissional' }))
              .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));

            return (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 shrink-0">
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    <b className="text-slate-900 dark:text-white">{rows.length}</b> plantões · <b className="text-emerald-700 dark:text-emerald-300">{assignedCount}</b> com profissional · <b className="text-amber-700 dark:text-amber-300">{rows.length - assignedCount}</b> vagas abertas
                    {generatorSourceInfo && <span className="block text-[11px] text-sky-700 dark:text-sky-300">{generatorSourceInfo}</span>}
                    {generatorSkippedCount > 0 && <span className="block text-[11px] text-slate-500">{generatorSkippedCount} plantão(ões) desse período já existiam e não serão duplicados.</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {assignedCount > 0 && (
                      <Button type="button" variant="ghost" onClick={() => setBulkAllocationDraft(prev => Object.fromEntries(Object.keys(prev).map(k => [k, ''])))} className="h-9 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl">
                        Limpar escolhas
                      </Button>
                    )}
                    <Button type="button" variant="outline" onClick={autoFillBulkAllocation} className="h-9 border-emerald-500/40 bg-transparent text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-800 dark:hover:text-emerald-200 rounded-xl font-semibold text-xs cursor-pointer">
                      <CheckCheck className="w-4 h-4 mr-1.5" /> Preencher automaticamente
                    </Button>
                  </div>
                </div>

                {loadList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pb-3 shrink-0" aria-label="Plantões por profissional">
                    {loadList.map(item => (
                      <span key={item.id} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-[11px] text-slate-700 dark:text-slate-300">
                        {item.name} <b className="text-slate-900 dark:text-white">{item.count}</b>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  {rows.map((row, index) => {
                    const assignedId = bulkAllocationDraft[String(row.id)] || '';
                    const candidates = getBulkCandidates(row, bulkAllocationDraft);
                    const assignedProf = assignedId ? professionalMap[String(assignedId)] : null;
                    const isNewDay = index === 0 || rows[index - 1].date !== row.date;

                    return (
                      <React.Fragment key={row.id}>
                        {isNewDay && (
                          <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                            {(() => { const s = new Date(row.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' }); return s.charAt(0).toUpperCase() + s.slice(1); })()}
                          </div>
                        )}
                        <div className="grid grid-cols-[88px_minmax(0,1fr)] sm:grid-cols-[110px_minmax(0,180px)_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-3 py-2 border-b border-slate-200 dark:border-slate-800/70 last:border-b-0">
                          <span className="tabular-nums text-xs text-slate-800 dark:text-slate-200 whitespace-nowrap">{row.start_time}–{row.end_time}</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{extractSpecialty(row)}{new Set((generatedAllocationRows || []).map(r => String(r.sector_id))).size > 1 ? ` · ${sectorMap[String(row.sector_id)]?.name || ''}` : ''}</span>
                          <select
                            value={assignedId}
                            onChange={e => setBulkAllocationDraft(prev => ({ ...prev, [String(row.id)]: e.target.value }))}
                            aria-label={`Profissional para ${formatDateBR(row.date)} ${row.start_time}`}
                            className={`col-span-2 sm:col-span-1 w-full h-9 rounded-lg border text-xs px-2 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer ${assignedId ? 'bg-slate-50 dark:bg-slate-900 border-emerald-600/50 text-slate-900 dark:text-white' : 'bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}
                          >
                            <option value="">Deixar como vaga aberta</option>
                            {assignedProf && !candidates.some(p => String(p.id) === String(assignedProf.id)) && (
                              <option value={String(assignedProf.id)}>{assignedProf.name}</option>
                            )}
                            {candidates.map(p => (
                              <option key={p.id} value={String(p.id)}>
                                {p.workloadWarning ? '⚠ ' : ''}{p.name}{load[String(p.id)] ? ` · ${load[String(p.id)]} plantão(ões)` : ''}{p.workloadWarning ? ` — ${p.workloadWarning}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </>
            );
          })()}

          <DialogFooter className="pt-4 mt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row sm:justify-between gap-2 shrink-0">
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={backToGenerator} disabled={submitting} className="h-11 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl cursor-pointer">
                <ChevronLeft className="w-4 h-4 mr-1" /> Voltar à grade
              </Button>
              <Button type="button" variant="ghost" onClick={discardGeneratedSchedule} disabled={submitting} className="h-11 text-slate-500 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-300 rounded-xl cursor-pointer">
                Descartar
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => handleSaveGeneratedSchedule(false)} disabled={submitting} className="h-11 border-slate-300 dark:border-slate-700 bg-transparent text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold cursor-pointer">
                Salvar como rascunho
              </Button>
              <Button type="button" onClick={() => handleSaveGeneratedSchedule(true)} disabled={submitting} className="h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 rounded-xl cursor-pointer">
                <Send className="w-4 h-4 mr-2" /> {submitting ? 'Salvando…' : 'Salvar e publicar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
