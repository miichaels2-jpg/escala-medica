import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TOURS, screenHelpFor, tourForVideo } from '@/lib/screenHelp';
import { useAppData } from '@/lib/useAppData';
import GuidedTour from '@/components/help/GuidedTour';
import HelpVideoDock from '@/components/help/HelpVideoDock';
import { markTourDone } from '@/components/help/useTutorialVideo';

const HelpContext = createContext(null);

export const useHelp = () => useContext(HelpContext);

// Fica no AppLayout: o vídeo e o guia continuam abertos quando a pessoa troca de tela.
export function HelpProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isManager } = useAppData();
  const [videoId, setVideoId] = useState(null);
  const [minimized, setMinimized] = useState(false);
  const [tour, setTour] = useState(null);

  const startTour = useCallback(item => {
    if (!item?.tour || !TOURS[item.tour]) return;
    if (item.path && location.pathname !== item.path) navigate(item.path);
    setMinimized(true);
    setTour({ id: item.tour, run: Date.now() });
  }, [location.pathname, navigate]);

  const openVideo = useCallback(id => {
    setTour(null);
    setVideoId(id);
    setMinimized(false);
  }, []);

  const value = useMemo(() => ({ startTour, openVideo, videoId, tourId: tour?.id || null }), [startTour, openVideo, videoId, tour]);
  // "Na tela": o guia desta tela para o vídeo aberto; se não houver, o da tela onde a tarefa se faz.
  const videoTour = videoId
    ? screenHelpFor(location.pathname, isManager).find(item => item.video === videoId && item.tour) || tourForVideo(videoId, isManager)
    : null;

  return (
    <HelpContext.Provider value={value}>
      {children}
      {videoId && (
        <HelpVideoDock
          videoId={videoId}
          minimized={minimized}
          onToggle={() => setMinimized(m => !m)}
          onClose={() => setVideoId(null)}
          onStartTour={videoTour ? () => startTour(videoTour) : null}
        />
      )}
      {tour && (
        <GuidedTour
          key={tour.run}
          steps={TOURS[tour.id]}
          onClose={() => setTour(null)}
          onFinish={() => { markTourDone(tour.id); setTour(null); }}
        />
      )}
    </HelpContext.Provider>
  );
}
