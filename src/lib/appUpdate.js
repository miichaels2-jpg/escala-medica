import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Atualização automática (V0.9.6). O app aberto (e o instalado no celular, que volta da memória)
// não recarrega sozinho; aqui ele confere se o servidor já tem outro arquivo principal (o nome muda a
// cada versão). Ao trocar de tela, recarrega na hora, já na tela escolhida. Ao voltar para o app ou
// a cada 15 minutos, só avisa, para não perder o que a pessoa estiver digitando.
const MIN_INTERVAL_MS = 60 * 1000;
const POLL_MS = 15 * 60 * 1000;
const BUNDLE = /\/assets\/index-[\w-]+\.js/;
let lastCheck = 0;
let pending = null;

function currentBundle() {
  const script = [...document.querySelectorAll('script[src]')].find(el => BUNDLE.test(el.getAttribute('src') || ''));
  return script ? script.getAttribute('src').match(BUNDLE)[0] : null;
}

// true quando o servidor já está em outra versão. Falha de rede conta como "sem novidade".
export async function hasNewVersion({ force = false } = {}) {
  if (!import.meta.env.PROD) return false;
  const now = Date.now();
  if (!force && now - lastCheck < MIN_INTERVAL_MS) return false;
  if (pending) return pending;
  lastCheck = now;
  pending = (async () => {
    try {
      const mine = currentBundle();
      if (!mine) return false;
      const response = await fetch(`/?versao=${now}`, { cache: 'no-store' });
      if (!response.ok) return false;
      const latest = (await response.text()).match(BUNDLE)?.[0];
      navigator.serviceWorker?.getRegistration?.().then(reg => reg?.update()).catch(() => {});
      return Boolean(latest && latest !== mine);
    } catch {
      return false;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

export function useAppUpdate() {
  const location = useLocation();
  const [available, setAvailable] = useState(false);

  // Troca de tela: momento seguro para recarregar (a tela nova acabou de abrir).
  useEffect(() => {
    let cancelled = false;
    hasNewVersion().then(isNew => { if (isNew && !cancelled) window.location.reload(); });
    return () => { cancelled = true; };
  }, [location.pathname]);

  useEffect(() => {
    const check = () => hasNewVersion({ force: true }).then(isNew => { if (isNew) setAvailable(true); });
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const timer = window.setInterval(check, POLL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.clearInterval(timer);
    };
  }, []);

  return { available, reload: () => window.location.reload() };
}
