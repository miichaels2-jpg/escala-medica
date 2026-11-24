// Plantões antigos sem unidade: vincular cada um a um hospital.
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateBR } from '@/lib/escalaUtils';

export default function LegacyUnitDialog({ handleAssignLegacyShiftUnit, legacyAssignmentOpen, legacyAssignmentSaving, legacyUnitDrafts, professionalMap, sectorMap, setLegacyAssignmentOpen, setLegacyUnitDrafts, unassignedShifts, units }) {
  return (
    <>
      {/*       {/* ========================================================================= */}
      {/* 6A. PÓS-GERAÇÃO: CONFIRMAÇÃO PARA ALOCAÇÃO DOS PROFISSIONAIS            */}
      {/* ========================================================================= */}
      <Dialog open={legacyAssignmentOpen} onOpenChange={setLegacyAssignmentOpen}>
        <DialogContent className="w-[96vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950 border border-slate-800 text-white shadow-sm rounded-3xl p-5">
          <DialogHeader className="border-b border-slate-800 pb-4">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-amber-400">
              <AlertTriangle className="h-5 w-5" /> Conferir plantões sem unidade
            </DialogTitle>
            <p className="pt-2 text-xs leading-relaxed text-slate-400">
              Escolha a unidade correta para cada registro. Nenhum valor é atribuído automaticamente quando a unidade não pode ser determinada com segurança.
            </p>
          </DialogHeader>
          <div className="space-y-3 py-3">
            {unassignedShifts.map(shift => (
              <div key={shift.id} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,240px)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white">{sectorMap[String(shift.sector_id)]?.name || 'Setor não identificado'} · {formatDateBR(shift.date)}</p>
                  <p className="mt-1 truncate text-[11px] text-slate-400">{shift.start_time || '07:00'}–{shift.end_time || '19:00'} · {professionalMap[String(shift.professional_id)]?.name || shift.professional_name || 'Sem profissional identificado'}</p>
                </div>
                <Select
                  value={legacyUnitDrafts[String(shift.id)] || ''}
                  onValueChange={value => setLegacyUnitDrafts(prev => ({ ...prev, [String(shift.id)]: value }))}
                >
                  <SelectTrigger className="h-9 border-slate-700 bg-slate-950 text-xs text-white">
                    <SelectValue placeholder="Escolha a unidade correta" />
                  </SelectTrigger>
                  <SelectContent className="z-[99999] border-slate-800 bg-slate-900 text-white">
                    {units.map(unit => <SelectItem key={unit.id} value={String(unit.id)}>{unit.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  disabled={!legacyUnitDrafts[String(shift.id)] || legacyAssignmentSaving}
                  onClick={() => handleAssignLegacyShiftUnit(shift)}
                  className="h-9 bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  Vincular
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter className="border-t border-slate-800 pt-3">
            <Button type="button" variant="outline" onClick={() => setLegacyAssignmentOpen(false)} className="border-slate-700 text-slate-300">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </>
  );
}
