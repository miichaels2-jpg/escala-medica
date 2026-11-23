import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PlayCircle } from 'lucide-react';
import PageHero from '@/components/PageHero';
import { useAppData } from '@/lib/useAppData';
import { tutorialSrc, tutorialTopicsFor } from '@/lib/tutorials';

// Vídeo gravado pelo navegador vem sem duração; isto libera a barra de tempo.
function TutorialVideo({ video, autoPlay }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return undefined;
    const onMeta = () => {
      if (v.duration !== Infinity && !Number.isNaN(v.duration)) return;
      const back = () => { v.removeEventListener('timeupdate', back); v.currentTime = 0; if (autoPlay) v.play().catch(() => {}); };
      v.addEventListener('timeupdate', back);
      v.currentTime = 1e101;
    };
    v.addEventListener('loadedmetadata', onMeta);
    return () => v.removeEventListener('loadedmetadata', onMeta);
  }, [autoPlay]);
  return (
    <video
      ref={ref}
      src={tutorialSrc(video.id)}
      controls
      playsInline
      preload="metadata"
      autoPlay={autoPlay}
      muted={autoPlay}
      className={`block bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 ${video.vertical ? 'w-full max-w-[250px] mx-auto' : 'w-full'}`}
    />
  );
}

const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function ComoUsar() {
  const { isManager } = useAppData();
  const topics = tutorialTopicsFor(isManager);
  const location = useLocation();
  // "Ver como fazer" (Primeiros passos) chega com #id do vídeo e abre direto nele.
  const [open, setOpen] = useState(() => location.hash.replace('#', '') || null);
  useEffect(() => {
    const id = location.hash.replace('#', '');
    if (id) setOpen(id);
  }, [location.hash]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`video-${open}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [open]);

  return (
    <div className="p-4 md:p-8 space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      <PageHero title="Como usar" subtitle="Vídeos curtos, sem som, mostrando cada tarefa na própria tela do ScaleMedic." />

      {topics.map(topic => (
        <section key={topic.id} className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{topic.title}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 items-start">
            {topic.videos.map(video => (
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
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">{fmt(video.seconds)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
