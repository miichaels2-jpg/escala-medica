import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, MousePointerClick, PlayCircle, X } from 'lucide-react';
import { findTutorial, tutorialSrc } from '@/lib/tutorials';
import { useTutorialVideo } from '@/components/help/useTutorialVideo';

// Clique no vídeo não pode fechar a janela (Radix) aberta por baixo; os controles do vídeo seguem normais.
const keepUnderlyingOpen = event => event.stopPropagation();

// Janelinha flutuante: o vídeo fica no canto enquanto a pessoa faz na tela.
export default function HelpVideoDock({ videoId, minimized, onToggle, onClose, onStartTour }) {
  const ref = useRef(null);
  const video = findTutorial(videoId);
  useTutorialVideo(ref, video ? videoId : null, { autoPlay: true });
  useEffect(() => { if (minimized) ref.current?.pause(); }, [minimized]);
  if (!video) return null;

  return createPortal(
    <div
      data-help-dock=""
      onPointerDown={keepUnderlyingOpen}
      className={`fixed z-[99990] pointer-events-auto print:hidden left-3 right-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:left-auto md:right-5 md:bottom-5 ${video.vertical ? 'md:w-[260px]' : 'md:w-[400px]'} rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100`}
    >
      <div className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 border-b border-slate-200 dark:border-slate-800">
        <PlayCircle className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" />
        <button type="button" onClick={onToggle} className="flex-1 min-w-0 text-left text-sm font-semibold truncate cursor-pointer" title={minimized ? 'Mostrar o vídeo' : 'Recolher o vídeo'}>
          {video.title}
        </button>
        {onStartTour && (
          <button type="button" onClick={onStartTour} className="hidden sm:inline-flex items-center gap-1 h-7 px-2 rounded-lg text-xs font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-500/10 cursor-pointer" title="Mostrar o passo a passo na tela">
            <MousePointerClick className="w-3.5 h-3.5" /> Na tela
          </button>
        )}
        <button type="button" onClick={onToggle} aria-label={minimized ? 'Mostrar o vídeo' : 'Recolher o vídeo'} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
          {minimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button type="button" onClick={onClose} aria-label="Fechar o vídeo" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      {/* Recolhido, o vídeo continua montado (pausado) para não perder o ponto. */}
      <div className={minimized ? 'hidden' : 'bg-slate-900'}>
        <video
          ref={ref}
          key={videoId}
          src={tutorialSrc(videoId)}
          controls
          playsInline
          muted
          preload="metadata"
          className={`block w-full bg-slate-900 ${video.vertical ? 'max-h-[45vh] md:max-h-[60vh] mx-auto object-contain' : ''}`}
        />
      </div>
    </div>,
    document.body
  );
}
