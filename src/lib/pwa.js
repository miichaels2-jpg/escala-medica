import { useEffect, useState } from 'react';

// O Android/Chrome dispara "beforeinstallprompt" uma única vez, logo no
// carregamento. Guardamos o evento aqui para que qualquer tela possa oferecer
// o botão "Instalar aplicativo" depois.
let deferredInstallPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach(listener => listener());

export function initPwa() {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    try { window.localStorage.setItem('scale_pwa_installed', 'true'); } catch {}
    notify();
  });

  // Só em produção: em desenvolvimento o cache atrapalharia o hot reload.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(error => {
        console.warn('Não foi possível ativar o modo aplicativo (service worker):', error);
      });
    });
  }
}

export function getMobilePlatform() {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  // iPadOS se apresenta como Mac; o toque denuncia que é um iPad.
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (isIOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function isIOSNonSafari() {
  const ua = navigator.userAgent || '';
  return getMobilePlatform() === 'ios' && /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua);
}

export function isRunningAsInstalledApp() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true;
}

export function usePwaInstall() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick(tick => tick + 1);
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);

  const promptInstall = async () => {
    if (!deferredInstallPrompt) return 'unavailable';
    const promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    notify();
    return outcome;
  };

  return {
    canPromptInstall: Boolean(deferredInstallPrompt),
    promptInstall,
    platform: getMobilePlatform(),
    isInstalled: isRunningAsInstalledApp()
  };
}
