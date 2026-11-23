import { lazy } from 'react';

// Carrega a tela só quando ela é aberta (o celular não baixa o app inteiro de uma vez).
// Se o arquivo da tela sumiu porque saiu uma versão nova enquanto o app estava aberto,
// recarrega a página uma vez para pegar a versão atual em vez de mostrar erro.
const RELOAD_FLAG = 'sm-recarregou-versao';

export function lazyPage(load) {
  return lazy(() => load()
    .then(mod => {
      try { window.sessionStorage.removeItem(RELOAD_FLAG); } catch { /* sem armazenamento: segue */ }
      return mod;
    })
    .catch(error => {
      let alreadyReloaded = false;
      try { alreadyReloaded = window.sessionStorage.getItem(RELOAD_FLAG) === '1'; } catch { /* sem armazenamento */ }
      if (!alreadyReloaded) {
        try { window.sessionStorage.setItem(RELOAD_FLAG, '1'); } catch { /* sem armazenamento */ }
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }));
}
