import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, GraduationCap, MousePointerClick, PlayCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { screenHelpFor } from '@/lib/screenHelp';
import { helpStorage } from '@/lib/tourTargets';
import { useAppData } from '@/lib/useAppData';
import { useHelp } from '@/components/help/HelpProvider';
import { HELP_CHANGE_EVENT, isTourDone, isVideoSeen } from '@/components/help/useTutorialVideo';

const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Botão "Como fazer" no topo da tela. Na primeira visita abre sozinho uma vez;
// fechou, não volta mais (fica o botão para quando quiser).
export default function ScreenHelpButton() {
  const help = useHelp();
  const { pathname } = useLocation();
  const { isManager, user } = useAppData();
  const items = help ? screenHelpFor(pathname, isManager) : [];
  const hintKey = `hint_${user?.id || 'anon'}_${pathname}`;
  const [open, setOpen] = useState(false);
  const [firstVisit, setFirstVisit] = useState(false);
  const [, refresh] = useState(0);

  useEffect(() => {
    const onChange = () => refresh(n => n + 1);
    window.addEventListener(HELP_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(HELP_CHANGE_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!items.length || helpStorage.get(hintKey)) return undefined;
    const timer = window.setTimeout(() => {
      if (document.querySelector('[role=dialog]')) return;
      setFirstVisit(true);
      setOpen(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [hintKey, items.length]);

  if (!items.length) return null;

  const changeOpen = next => {
    setOpen(next);
    if (!next) { helpStorage.set(hintKey, true); setFirstVisit(false); }
  };
  const choose = action => { changeOpen(false); action(); };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Como fazer nesta tela"
          title="Passo a passo e vídeo desta tela"
          className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full bg-[#fff] hover:bg-[#f0f9ff] text-[#0369a1] text-sm font-semibold shadow-sm cursor-pointer print:hidden"
        >
          <GraduationCap className="w-4 h-4" /> Como fazer
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-[min(340px,calc(100vw-24px))] p-0 rounded-2xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
        <div className="px-4 pt-4 pb-2">
          <p className="font-semibold">Como fazer nesta tela</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {firstVisit ? 'Primeira vez aqui? ' : ''}“Mostrar na tela” aponta onde clicar, passo a passo. O vídeo fica no canto enquanto você faz.
          </p>
        </div>
        <ul className="px-2 pb-2 space-y-1">
          {items.map(item => {
            const done = (item.video && isVideoSeen(item.video)) || (item.tour && isTourDone(item.tour));
            return (
              <li key={item.id} className="rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  {item.title}
                  {done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-label="já visto" />}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {item.tour && (
                    <button type="button" onClick={() => choose(() => help.startTour(item))} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white cursor-pointer">
                      <MousePointerClick className="w-3.5 h-3.5" /> Mostrar na tela
                    </button>
                  )}
                  {item.videoInfo && (
                    <button type="button" onClick={() => choose(() => help.openVideo(item.video))} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                      <PlayCircle className="w-3.5 h-3.5" /> Vídeo <span className="tabular-nums text-slate-500 dark:text-slate-400">{fmt(item.videoInfo.seconds)}</span>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-2.5">
          <Link to="/como-usar" onClick={() => changeOpen(false)} className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline">Ver todos os vídeos</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
