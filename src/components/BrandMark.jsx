// Marca do ScaleMedic (V0.3.10): uma grade de escala 3×3 em que os cinco dias do meio formam a
// cruz da saúde. Os ícones do app (public/icons, public/favicon.svg) usam o mesmo desenho.

const CELLS = [
  [4, 4, false], [24, 4, true], [44, 4, false],
  [4, 24, true], [24, 24, true], [44, 24, true],
  [4, 44, false], [24, 44, true], [44, 44, false]
];

const TONES = {
  color: { cross: '#0284C7', corner: '#BAE6FD', cornerOpacity: 1 },
  dark: { cross: '#38BDF8', corner: '#1E3A5F', cornerOpacity: 1 },
  white: { cross: '#FFFFFF', corner: '#FFFFFF', cornerOpacity: 0.35 }
};

export function BrandMark({ size = 32, tone = 'color', className = '', title }) {
  const t = TONES[tone] || TONES.color;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {CELLS.map(([x, y, cross]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="16" height="16" rx="5"
          fill={cross ? t.cross : t.corner} fillOpacity={cross ? 1 : t.cornerOpacity} />
      ))}
    </svg>
  );
}

// Ícone do app: o símbolo branco num quadrado azul de cantos arredondados.
export function BrandAppIcon({ size = 40, className = '' }) {
  return (
    <div className={`shrink-0 flex items-center justify-center bg-sky-600 ${className}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.26) }}>
      <BrandMark size={Math.round(size * 0.58)} tone="white" />
    </div>
  );
}

export function BrandWordmark({ className = '' }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`} style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif" }}>
      Scale<span className="text-sky-600 dark:text-sky-400">Medic</span>
    </span>
  );
}
