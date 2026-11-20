import logo from '../brand/logo.json';
import { APP_NAME } from '../lib/brand';
import { ROWS, stitchWord } from '../brand/stitchLetters';

const { geometry: g } = logo;

interface Props {
  /** rendered size in CSS px */
  size?: number;
  className?: string;
  title?: string;
  /** 'light': drawn straight on a light page (navy under, red over); 'tile': on the navy app-icon tile */
  variant?: 'light' | 'tile';
}

/**
 * The brand mark: one big cross stitch with a fabric hole at each end. The "\" stitch goes down first
 * and the "/" crosses on top, the way a cross stitch is worked. Drawn as SVG in a 100x100 box; the stroke
 * keeps a minimum on-screen width so small sizes stay legible. scripts/make-icons.mjs draws the same thing.
 */
export function LogoMark({ size = 36, className, title = APP_NAME, variant = 'light' }: Props) {
  const S = 100;
  const c = variant === 'tile' ? logo.tile : logo.light;
  const a = g.from * S, b = g.to * S, h = g.holeInset * S, k = S - h;
  const sw = Math.max(g.stroke * S, (g.minStrokePx / size) * S);
  return (
    <svg className={className} width={size} height={size} viewBox={`0 0 ${S} ${S}`} role="img" aria-label={title}>
      <title>{title}</title>
      {variant === 'tile' && <rect width={S} height={S} rx={g.tileRadius * S} fill={logo.tile.background} />}
      {size >= 20 && (
        <g fill={c.hole}>
          {[[h, h], [k, h], [h, k], [k, k]].map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} r={g.holeRadius * S} />)}
        </g>
      )}
      <g strokeWidth={sw} strokeLinecap="round">
        <line x1={a} y1={a} x2={b} y2={b} stroke={c.under} />
        <line x1={a} y1={b} x2={b} y2={a} stroke={c.over} />
      </g>
    </svg>
  );
}

const WORD = stitchWord(APP_NAME);
const crosses = (pts: [number, number][]) =>
  pts.map(([x, y]) => `M${x - 0.32} ${y - 0.32}L${x + 0.32} ${y + 0.32}M${x + 0.32} ${y - 0.32}L${x - 0.32} ${y + 0.32}`).join('');

/**
 * The name as a wordmark, every letter cross-stitched on a grid (src/brand/stitchLetters.ts): the X in
 * thread red, the middle in navy, ".Design" muted. Sized in CSS through --wm-cell (one stitch, in px).
 * Falls back to plain text if the name ever has a letter that isn't drawn yet.
 */
export function Wordmark({ className = 'wordmark' }: { className?: string }) {
  if (!WORD) return <span className={className}>{APP_NAME}</span>;
  return (
    <svg className={className} viewBox={`0 0 ${WORD.cols} ${ROWS}`} style={{ '--wm-cols': WORD.cols } as React.CSSProperties}
      role="img" aria-label={APP_NAME}>
      <g fill="none" strokeWidth={0.44} strokeLinecap="round">
        <path className="wm-x" d={crosses(WORD.parts.first)} />
        <path className="wm-mid" d={crosses(WORD.parts.middle)} />
        <path className="wm-tail" d={crosses(WORD.parts.tail)} />
      </g>
    </svg>
  );
}
