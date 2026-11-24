import { BrandMark } from '@/components/BrandMark';
import ScreenHelpButton from '@/components/help/ScreenHelpButton';

// Topo de todas as telas: faixa azul da marca com o símbolo ao fundo.
// As cores do botão principal vão em hexadecimal porque o tema escuro reescreve bg-white e text-sky-*.
const HERO = {
  outline: 'bg-white/10 hover:bg-white/20 text-white border border-white/30 disabled:opacity-60',
  outlineIcon: 'text-white',
  primary: 'bg-[#fff] hover:bg-[#f0f9ff] text-[#0369a1] disabled:opacity-60',
  // seletor de mês e afins
  pill: 'bg-white/10 border border-white/25',
  pillButton: 'hover:bg-white/15 text-white'
};

export default function PageHero({ title, subtitle, actions, children }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 sm:p-7 bg-sky-600 dark:bg-sky-700 text-white border border-sky-600 dark:border-sky-700">
      <BrandMark size={150} tone="white" className="pointer-events-none absolute -right-8 -top-10 w-28 h-28 sm:w-[150px] sm:h-[150px] opacity-20" />
      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 md:pr-20">
        <div className="space-y-1.5 max-w-2xl">
          {/* "Como fazer" ao lado do título: só aparece nas telas que têm guia ou vídeo */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white" style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif" }}>
              {title}
            </h1>
            <ScreenHelpButton />
          </div>
          {subtitle && <p className="text-sm text-sky-100">{subtitle}</p>}
          {children}
        </div>
        {actions && actions(HERO)}
      </div>
    </div>
  );
}
