import { useEffect } from 'react';
import { helpStorage } from '@/lib/tourTargets';

export const HELP_CHANGE_EVENT = 'scalemedic:help-change';
const notify = () => window.dispatchEvent(new Event(HELP_CHANGE_EVENT));

export const isVideoSeen = id => Boolean(helpStorage.get(`seen_${id}`));
export const isTourDone = id => Boolean(helpStorage.get(`done_${id}`));
export const markTourDone = id => { helpStorage.set(`done_${id}`, true); notify(); };

// Vídeo gravado pelo navegador vem sem duração: o pulo para o fim libera a barra de tempo.
// Depois disso, volta para onde a pessoa parou da última vez e guarda o ponto a cada segundo.
export function useTutorialVideo(ref, videoId, { autoPlay = false } = {}) {
  useEffect(() => {
    const v = ref.current;
    if (!v || !videoId) return undefined;
    let ready = false;
    let lastSaved = -1;
    const start = () => {
      ready = true;
      const saved = Number(helpStorage.get(`pos_${videoId}`, 0)) || 0;
      if (saved > 1 && saved < v.duration - 1) v.currentTime = saved;
      if (autoPlay) v.play().catch(() => {});
    };
    const onMeta = () => {
      if (v.duration !== Infinity && !Number.isNaN(v.duration)) return start();
      const back = () => { v.removeEventListener('timeupdate', back); v.currentTime = 0; start(); };
      v.addEventListener('timeupdate', back);
      v.currentTime = 1e101;
      return undefined;
    };
    const onTime = () => {
      if (!ready) return;
      const second = Math.floor(v.currentTime);
      if (second === lastSaved) return;
      lastSaved = second;
      helpStorage.set(`pos_${videoId}`, second);
    };
    const onEnded = () => {
      helpStorage.remove(`pos_${videoId}`);
      helpStorage.set(`seen_${videoId}`, true);
      notify();
    };
    if (v.readyState >= 1) onMeta(); else v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnded);
    return () => {
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', onEnded);
    };
  }, [ref, videoId, autoPlay]);
}
