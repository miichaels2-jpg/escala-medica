import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Share, SquarePlus, MoreVertical, Download, CheckCircle2, Smartphone, X, Compass, Chrome, Info
} from 'lucide-react';
import { isIOSNonSafari, usePwaInstall } from '@/lib/pwa';

const BANNER_DISMISS_KEY = 'scale_install_banner_dismissed_at';
const BANNER_SNOOZE_DAYS = 7;

function Step({ number, icon: Icon, title, children }) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="w-7 h-7 rounded-full bg-sky-600 text-white text-xs font-black flex items-center justify-center shrink-0">{number}</span>
      </div>
      <div className="flex-1 min-w-0 pb-1">
        <p className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
          {Icon && <Icon className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />}
          {title}
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{children}</p>
      </div>
    </li>
  );
}

export function InstallAppDialog({ open, onOpenChange }) {
  const { platform, canPromptInstall, promptInstall, isInstalled } = usePwaInstall();
  const [tab, setTab] = useState(platform === 'ios' ? 'ios' : 'android');
  const [installMessage, setInstallMessage] = useState('');

  useEffect(() => {
    if (open) {
      setTab(platform === 'ios' ? 'ios' : 'android');
      setInstallMessage('');
    }
  }, [open, platform]);

  const handleInstallNow = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') setInstallMessage('Pronto! O ScaleMedic está sendo adicionado à sua tela inicial.');
    else if (outcome === 'dismissed') setInstallMessage('Instalação cancelada. Você pode instalar quando quiser.');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] sm:max-w-md max-h-[88dvh] overflow-y-auto bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-3xl p-5 shadow-2xl z-[9999]">
        <DialogHeader>
          <DialogTitle className="text-base font-black flex items-center gap-2 text-sky-600 dark:text-sky-400">
            <Smartphone className="w-5 h-5" /> Instalar o ScaleMedic no celular
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <img src="/icons/icon-192.png" alt="Ícone do ScaleMedic" className="w-14 h-14 rounded-2xl shadow-lg shadow-sky-600/30" />
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">ScaleMedic</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Este é o ícone que vai aparecer junto com os seus aplicativos. O sistema abre em tela cheia,
            sem a barra do navegador, e você entra na sua escala com um toque.
          </p>
        </div>

        {isInstalled ? (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-sm font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" /> Você já está usando o aplicativo instalado.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'ios'}
                onClick={() => setTab('ios')}
                className={`h-10 rounded-xl text-xs font-black transition-all cursor-pointer ${tab === 'ios' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
              >
                iPhone / iPad
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'android'}
                onClick={() => setTab('android')}
                className={`h-10 rounded-xl text-xs font-black transition-all cursor-pointer ${tab === 'android' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
              >
                Android
              </button>
            </div>

            {tab === 'ios' ? (
              <div className="space-y-3">
                {platform === 'ios' && isIOSNonSafari() && (
                  <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Você está em outro navegador. Para garantir a instalação, copie o endereço e abra no <b>Safari</b>.</span>
                  </div>
                )}
                <ol className="space-y-3">
                  <Step number={1} icon={Compass} title="Abra no Safari">
                    Acesse o ScaleMedic pelo <b>Safari</b> (o navegador com ícone de bússola). Se o link abriu dentro do WhatsApp ou Instagram, toque em “Abrir no Safari”.
                  </Step>
                  <Step number={2} icon={Share} title="Toque em Compartilhar">
                    Na barra de baixo da tela, toque no ícone de <b>Compartilhar</b> (quadrado com uma seta para cima). No iPad ele fica no topo, ao lado do endereço.
                  </Step>
                  <Step number={3} icon={SquarePlus} title="Adicionar à Tela de Início">
                    Role a lista de opções para baixo e toque em <b>“Adicionar à Tela de Início”</b>.
                  </Step>
                  <Step number={4} icon={CheckCircle2} title="Confirme em Adicionar">
                    Mantenha o nome <b>ScaleMedic</b> e toque em <b>“Adicionar”</b> no canto superior direito. Pronto: o ícone aparece na sua tela inicial.
                  </Step>
                </ol>
              </div>
            ) : (
              <div className="space-y-3">
                {canPromptInstall && (
                  <Button
                    type="button"
                    onClick={handleInstallNow}
                    className="w-full h-12 bg-sky-600 hover:bg-sky-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-sky-600/30 gap-2 cursor-pointer"
                  >
                    <Download className="w-5 h-5" /> Instalar agora
                  </Button>
                )}
                {installMessage && (
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 text-center">{installMessage}</p>
                )}
                {canPromptInstall && (
                  <p className="text-[11px] text-slate-500 text-center">Se preferir, faça pelo menu do navegador:</p>
                )}
                <ol className="space-y-3">
                  <Step number={1} icon={Chrome} title="Abra no Google Chrome">
                    Acesse o ScaleMedic pelo <b>Chrome</b>. Se o link abriu dentro do WhatsApp, toque nos três pontinhos e escolha “Abrir no Chrome”.
                  </Step>
                  <Step number={2} icon={MoreVertical} title="Toque nos três pontinhos">
                    No canto superior direito, toque no menu <b>⋮</b>.
                  </Step>
                  <Step number={3} icon={Download} title="Instalar aplicativo">
                    Toque em <b>“Instalar aplicativo”</b> (em alguns aparelhos aparece como <b>“Adicionar à tela inicial”</b>).
                  </Step>
                  <Step number={4} icon={CheckCircle2} title="Confirme em Instalar">
                    Toque em <b>“Instalar”</b>. O ícone do ScaleMedic aparece junto com os seus aplicativos.
                  </Step>
                </ol>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <b>Samsung Internet:</b> toque no menu <b>☰</b> (embaixo, à direita) → <b>“Adicionar página a”</b> → <b>“Tela inicial”</b>.
                </p>
              </div>
            )}
          </>
        )}

        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full h-11 rounded-2xl text-xs font-bold border-slate-200 dark:border-slate-700 cursor-pointer">
          Fechar
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// Faixa discreta exibida só no celular, fora do app instalado. "Agora não"
// esconde por 7 dias.
export function InstallAppBanner({ onOpenGuide }) {
  const { platform, isInstalled } = usePwaInstall();
  const [hidden, setHidden] = useState(() => {
    try {
      const dismissedAt = Number(window.localStorage.getItem(BANNER_DISMISS_KEY) || 0);
      return Date.now() - dismissedAt < BANNER_SNOOZE_DAYS * 86_400_000;
    } catch {
      return false;
    }
  });

  if (hidden || isInstalled || platform === 'desktop') return null;

  const dismiss = () => {
    setHidden(true);
    try { window.localStorage.setItem(BANNER_DISMISS_KEY, String(Date.now())); } catch {}
  };

  return (
    <div className="md:hidden mx-3 mt-3 p-3 rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-600 text-white shadow-lg shadow-sky-600/20 flex items-center gap-3 print:hidden">
      <img src="/icons/icon-192.png" alt="" className="w-10 h-10 rounded-xl ring-2 ring-white/30 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black leading-tight">Instale o ScaleMedic no seu celular</p>
        <p className="text-[11px] text-sky-100 leading-tight mt-0.5">Acesso com um toque, em tela cheia.</p>
      </div>
      <Button type="button" onClick={onOpenGuide} className="h-9 px-3 bg-white text-sky-700 hover:bg-sky-50 font-black text-xs rounded-xl shrink-0 cursor-pointer">
        Instalar
      </Button>
      <button type="button" onClick={dismiss} aria-label="Agora não" className="p-1 text-sky-100 hover:text-white shrink-0 cursor-pointer">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
