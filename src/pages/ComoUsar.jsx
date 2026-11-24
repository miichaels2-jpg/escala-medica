import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle2, MousePointerClick, PlayCircle } from 'lucide-react';
import PageHero from '@/components/PageHero';
import { useAppData } from '@/lib/useAppData';
import { tutorialSrc, tutorialTopicsFor } from '@/lib/tutorials';
import { tourForVideo } from '@/lib/screenHelp';
import { useHelp } from '@/components/help/HelpProvider';
import { HELP_CHANGE_EVENT, isVideoSeen, useTutorialVideo } from '@/components/help/useTutorialVideo';

// Continua de onde a pessoa parou (o mesmo ponto da janelinha do botão "Como fazer").
function TutorialVideo({ video, autoPlay }) {
  const ref = useRef(null);
  useTutorialVideo(ref, video.id, { autoPlay });
  return (
    <video
      ref={ref}
      src={tutorialSrc(video.id)}
      controls
      playsInline
      muted
      preload="metadata"
      className={`block bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 ${video.vertical ? 'w-full max-w-[250px] mx-auto' : 'w-full'}`}
    />
  );
}

const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function ComoUsar() {
  const { isManager } = useAppData();
  const help = useHelp();
  const topics = tutorialTopicsFor(isManager);
  const location = useLocation();
  // "Ver como fazer" (Primeiros passos) chega com #id do vídeo e abre direto nele.
  const [open, setOpen] = useState(() => location.hash.replace('#', '') || null);
  const [, refresh] = useState(0);
  useEffect(() => {
    const id = location.hash.replace('#', '');
    if (id) setOpen(id);
  }, [location.hash]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`video-${open}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [open]);

  useEffect(() => {
    const onChange = () => refresh(n => n + 1);
    window.addEventListener(HELP_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(HELP_CHANGE_EVENT, onChange);
  }, []);

  return (
    <div className="p-4 md:p-8 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      <PageHero title="Como usar" subtitle="Vídeos curtos, sem som, mostrando cada tarefa na própria tela do ScaleMedic. Em cada tela, o botão de chapéu no topo mostra onde clicar." />

      {topics.map(topic => (
        <section key={topic.id} className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{topic.title}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 items-start">
            {topic.videos.map(video => {
              const tour = help ? tourForVideo(video.id, isManager) : null;
              return (
                <article key={video.id} id={`video-${video.id}`} className="scroll-mt-24 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                  {open === video.id ? (
                    <TutorialVideo video={video} autoPlay />
                  ) : (
                    <button type="button" onClick={() => setOpen(video.id)} className={`group relative block w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 cursor-pointer ${video.vertical ? 'aspect-[9/16] max-w-[250px] mx-auto' : 'aspect-video'}`} aria-label={`Assistir: ${video.title}`}>
                      <video src={`${tutorialSrc(video.id)}#t=3`} preload="metadata" muted playsInline className="absolute inset-0 h-full w-full object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center bg-slate-900/25 group-hover:bg-slate-900/35 transition-colors">
                        <PlayCircle className="w-14 h-14 text-white drop-shadow" />
                      </span>
                    </button>
                  )}
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{video.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{video.summary}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums flex items-center gap-1.5">
                        {fmt(video.seconds)}
                        {isVideoSeen(video.id) && <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> visto</span>}
                      </p>
                      {tour && (
                        <button type="button" onClick={() => help.startTour(tour)} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-500/10 cursor-pointer">
                          <MousePointerClick className="w-3.5 h-3.5" /> Fazer junto na tela
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
