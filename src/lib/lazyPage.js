import { lazy } from 'react';

// Carrega a tela só quando ela é aberta (o celular não baixa o app inteiro de uma vez).
// Se o arquivo da tela sumiu porque saiu uma versão nova enquanto o app estava aberto,
// recarrega a página para pegar a versão atual em vez de mostrar erro. A trava evita repetir a
// recarga em seguida (V0.10.11: antes valia só uma vez por sessão e depois a tela travava).
const RELOAD_FLAG = 'sm-recarregou-versao';
const RELOAD_WINDOW_MS = 30 * 1000;

export function lazyPage(load) {
  return lazy(() => load()
    .then(mod => {
      try { window.sessionStorage.removeItem(RELOAD_FLAG); } catch { /* sem armazenamento: segue */ }
      return mod;
    })
    .catch(error => {
      let alreadyReloaded = false;
      try { alreadyReloaded = Date.now() - Number(window.sessionStorage.getItem(RELOAD_FLAG) || 0) < RELOAD_WINDOW_MS; } catch { /* sem armazenamento */ }
      if (!alreadyReloaded) {
        try { window.sessionStorage.setItem(RELOAD_FLAG, String(Date.now())); } catch { /* sem armazenamento */ }
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }));
}
