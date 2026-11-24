import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MousePointerClick, X } from 'lucide-react';
import { findTarget } from '@/lib/tourTargets';

const PAD = 6;
const GAP = 12;
const CARD_WIDTH = 320;

const sameRect = (a, b) => a && b && ['top', 'left', 'width', 'height'].every(k => Math.abs(a[k] - b[k]) < 0.5);

// Para o clique no cartão não fechar a janela (Radix) que está aberta por baixo.
const keepUnderlyingOpen = event => { event.stopPropagation(); event.preventDefault(); };

// Guia na própria tela: destaca o botão do passo, explica e avança quando a pessoa clica nele.
// Não clica em nada sozinho; quem faz é a pessoa.
export default function GuidedTour({ steps, onClose, onFinish }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [missing, setMissing] = useState(false);
  const [cardSize, setCardSize] = useState({ width: CARD_WIDTH, height: 170 });
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const cardRef = useRef(null);
  const targetRef = useRef(null);
  const clickedRef = useRef(0);
  const directionRef = useRef(1);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  // Procura o alvo o tempo todo: janelas abrem, a página rola, a tela troca.
  useEffect(() => {
    clickedRef.current = 0;
    targetRef.current = null;
    setRect(null);
    setMissing(false);
    const startedAt = Date.now();
    let scrolled = false;
    const tick = () => {
      if (step.skipWhen && findTarget(step.skipWhen)) {
        const nextIndex = index + directionRef.current;
        if (nextIndex >= 0 && nextIndex < steps.length) { setIndex(nextIndex); return; }
      }
      const next = steps[index + 1];
      // Se o próximo alvo pode não existir (ex.: mês sem vaga), avança mesmo assim para explicar.
      const nextReady = next && (findTarget(next.target) || (next.skipWhen && findTarget(next.skipWhen)) || (next.missing && Date.now() - clickedRef.current > 1500));
      if (clickedRef.current && nextReady) {
        directionRef.current = 1;
        setIndex(index + 1);
        return;
      }
      const el = findTarget(step.target);
      targetRef.current = el;
      if (!el) {
        setRect(null);
        if (Date.now() - startedAt > 800) setMissing(true);
        return;
      }
      setMissing(false);
      let r = el.getBoundingClientRect();
      if (!scrolled) {
        scrolled = true;
        if (r.top < 64 || r.bottom > window.innerHeight - 96) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          r = el.getBoundingClientRect();
        }
      }
      const box = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
      setRect(prev => (sameRect(prev, box) ? prev : box));
    };
    tick();
    const timer = window.setInterval(tick, 150);
    return () => window.clearInterval(timer);
  }, [index, step, steps]);

  // Clique da pessoa no destaque: o passo avança assim que o próximo alvo aparecer.
  useEffect(() => {
    if (!step.click) return undefined;
    const onClick = event => {
      if (targetRef.current && targetRef.current.contains(event.target)) clickedRef.current = Date.now();
    };
    document.addEventListener('pointerdown', onClick, true);
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('pointerdown', onClick, true);
      document.removeEventListener('click', onClick, true);
    };
  }, [step]);

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const size = { width: el.offsetWidth, height: el.offsetHeight };
    setCardSize(prev => (prev.width === size.width && prev.height === size.height ? prev : size));
  }, [index, missing]);

  const go = delta => {
    directionRef.current = delta;
    setIndex(i => Math.min(steps.length - 1, Math.max(0, i + delta)));
  };

  // Cartão embaixo do destaque; sem espaço, em cima; alvo muito grande, no rodapé da tela.
  const width = Math.min(CARD_WIDTH, viewport.width - 24);
  let cardStyle;
  if (rect) {
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), viewport.width - width - 12);
    const below = rect.top + rect.height + GAP;
    const above = rect.top - GAP - cardSize.height;
    if (below + cardSize.height <= viewport.height - 12) cardStyle = { top: below, left };
    else if (above >= 12) cardStyle = { top: above, left };
    else cardStyle = { bottom: 'calc(5.5rem + env(safe-area-inset-bottom))', left: (viewport.width - width) / 2 };
  } else {
    cardStyle = { top: Math.max(12, viewport.height / 2 - cardSize.height / 2), left: (viewport.width - width) / 2 };
  }

  const waitingClick = step.click && rect && !isLast;
  const text = missing && step.missing ? step.missing : step.text;

  return createPortal(
    <div className="fixed inset-0 z-[100000] pointer-events-none print:hidden" aria-live="polite">
      {rect ? (
        <div
          className="absolute rounded-xl transition-all duration-200"
          style={{ ...rect, boxShadow: '0 0 0 4px #38bdf8, 0 0 0 9999px rgba(15, 23, 42, 0.45)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-900/30" />
      )}
      <div
        ref={cardRef}
        aria-label={`Guia: ${step.title}`}
        data-help-card=""
        onPointerDown={keepUnderlyingOpen}
        onMouseDown={keepUnderlyingOpen}
        className="absolute pointer-events-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xl text-slate-900 dark:text-slate-100"
        style={{ ...cardStyle, width }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400 tabular-nums">Passo {index + 1} de {steps.length}</p>
            <h3 className="mt-0.5 font-semibold">{step.title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar o guia" className="-mr-1 -mt-1 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{text}</p>
        {waitingClick && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-sky-700 dark:text-sky-300">
            <MousePointerClick className="w-3.5 h-3.5" /> Clique no destaque para continuar
          </p>
        )}
        <div className="mt-3 flex items-center justify-end gap-2">
          {index > 0 && (
            <button type="button" onClick={() => go(-1)} className="h-8 px-3 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">Voltar</button>
          )}
          {isLast ? (
            <button type="button" onClick={onFinish} className="h-8 px-3 rounded-lg text-sm font-semibold bg-sky-600 hover:bg-sky-700 text-white cursor-pointer">Concluir</button>
          ) : (
            <button type="button" onClick={() => go(1)} className={`h-8 px-3 rounded-lg text-sm font-semibold cursor-pointer ${waitingClick ? 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800' : 'bg-sky-600 hover:bg-sky-700 text-white'}`}>
              {waitingClick ? 'Pular' : 'Próximo'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
