// Modo TV (CCO): quem está de plantão agora e quem entra hoje, em tela cheia.
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Minimize2, Radio } from 'lucide-react';
import { extractSpecialty, formatFullName } from '@/lib/escalaUtils';

export default function TvMode({ closeTvMode, company, liveNow, professionalMap, sectorMap, selectedUnitId, tvData, units }) {
  return (
    <div className="fixed inset-0 z-[99999] h-screen w-screen min-h-[100dvh] bg-slate-950 text-white flex flex-col justify-between p-6 lg:p-8 select-none overflow-hidden font-sans">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-sm">
            <Radio className="w-7 h-7 animate-pulse text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
              <span>{units?.find(u => String(u.id) === String(selectedUnitId))?.name || company?.name || 'Hospital Principal'}</span>
              <span>•</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" /> CCO AO VIVO</span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight text-white mt-0.5">
              Centro de Comando & Situação
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              {liveNow.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} · Escalas em Tempo Real
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="bg-slate-900 border border-slate-800 px-6 py-2.5 rounded-2xl text-right">
            <div className="text-3xl lg:text-4xl font-semibold tabular-nums tracking-tight text-cyan-400">
              {liveNow.toLocaleTimeString('pt-BR')}
            </div>
            <div className="text-xs font-medium text-slate-500">Horário Oficial CCO</div>
          </div>

          <button 
            onClick={closeTvMode}
            className="p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
            title="Sair do Modo TV"
          >
            <Minimize2 className="h-6 w-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 my-6 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
        {/* ATIVOS NO MOMENTO */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0">
              <span className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /> Profissionais no Posto Agora ({tvData.emAndamento.length})
              </span>
              <span className="text-xs tabular-nums font-medium text-slate-400">AO VIVO</span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {tvData.emAndamento.length === 0 ? (
                <div className="py-24 text-center text-xs text-slate-500">Nenhum profissional em atendimento neste exato momento.</div>
              ) : (
                tvData.emAndamento.map((shift, idx) => {
                  const prof = professionalMap[String(shift.professional_id)];
                  const sector = sectorMap[String(shift.sector_id)];
                  const realSpecialty = extractSpecialty(shift, prof);
                  const validName = prof?.name || shift.professional_name;

                  return (
                    <div key={shift.id || `em-${idx}`} className="p-4 bg-slate-950 border border-emerald-500/40 rounded-2xl shadow-sm flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-emerald-400">{sector?.name}</span>
                          {shift.lifecycle.isHandover && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                              Passagem de Turno
                            </span>
                          )}
                        </div>
                        <div className="text-base font-semibold text-white mt-0.5">{formatFullName(validName)}</div>
                        <span className="text-xs text-slate-400">{realSpecialty} • {shift.start_time} às {shift.end_time}</span>
                      </div>
                      <span className="text-xs tabular-nums font-semibold text-emerald-300 bg-emerald-500/20 px-3 py-1.5 rounded-xl">
                        {shift.detail}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* PLANTÕES PROGRAMADOS */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0">
              <span className="text-sm font-semibold text-sky-400 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" /> Plantões Programados (Hoje)
              </span>
              <span className="text-xs tabular-nums font-medium text-slate-400">{tvData.programadosHoje.length} programado(s)</span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {tvData.programadosHoje.length === 0 ? (
                <div className="py-24 text-center text-xs text-slate-500">Nenhum plantão futuro programado para a data de hoje.</div>
              ) : (
                tvData.programadosHoje.map(({ shift, lifecycle }, idx) => {
                  const prof = professionalMap[String(shift.professional_id)];
                  const sector = sectorMap[String(shift.sector_id)];
                  const validName = prof?.name || shift.professional_name;

                  return (
                    <div key={shift.id || `prog-${idx}`} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-xs font-medium text-slate-400">{sector?.name}</span>
                        <div className="text-base font-semibold text-white">{formatFullName(validName)}</div>
                        <span className="text-xs text-sky-400 tabular-nums">{shift.start_time} às {shift.end_time}</span>
                      </div>
                      <span className="text-xs font-semibold bg-sky-500/20 text-sky-300 px-3 py-1.5 rounded-xl tabular-nums">
                        {lifecycle.detail}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800 pt-3 shrink-0 flex items-center justify-between text-xs text-slate-400 font-medium">
        <div>ScaleMedic Enterprise CCO • {units?.find(u => String(u.id) === String(selectedUnitId))?.name || company?.name || 'Hospital Principal'}</div>
        <Button onClick={closeTvMode} variant="outline" className="h-8 text-xs border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer">
          Fechar Modo TV
        </Button>
      </div>
    </div>
  );
}
