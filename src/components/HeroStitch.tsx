import { useEffect, useMemo } from 'react';
import { t } from '../lib/i18n';

/** a small heart, one cross stitch per X */
const HEART = ['.XX...XX.', 'XXXX.XXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'];
const C = 15; // one cell in the 150-wide box
const O = 7;  // margin
const SEEN = 'sbs:hero-stitched';

function seen(): boolean {
  try { return sessionStorage.getItem(SEEN) === '1'; } catch { return true; }
}

/**
 * The home page's picture: a heart that stitches itself, one cross at a time, row by row and back the
 * way it's worked by hand. It plays once per visit (and never when the device asks for less motion,
 * see .hero-stitch in styles.css); after that it's simply the finished heart.
 */
export function HeroStitch() {
  const animate = useMemo(() => !seen(), []);
  useEffect(() => {
    try { sessionStorage.setItem(SEEN, '1'); } catch { /* plays again next time */ }
  }, []);
  // stitching order: left to right, then right to left on the next row
  const crosses = useMemo(() => {
    const out: [number, number][] = [];
    HEART.forEach((row, y) => {
      const xs = [...row].map((c, x) => (c === 'X' ? x : -1)).filter((x) => x >= 0);
      (y % 2 ? xs.reverse() : xs).forEach((x) => out.push([x, y]));
    });
    return out;
  }, []);
  const p = 3.5;
  return (
    <svg className={'hero-stitch' + (animate ? ' play' : '')} viewBox="0 0 150 134" role="img"
      aria-label={t('หัวใจปักครอสติช', 'A cross-stitched heart')}>
      <g className="hs-holes">
        {HEART.flatMap((row, y) => [...row].map((_, x) => <circle key={`${x},${y}`} cx={O + x * C + C / 2} cy={O + y * C + C / 2} r={1.6} />))}
      </g>
      {crosses.map(([x, y], i) => {
        const a = O + x * C, b = O + y * C;
        return (
          <g key={`${x},${y}`} className="hs-x" style={{ animationDelay: `${i * 28}ms` }}>
            <line x1={a + p} y1={b + p} x2={a + C - p} y2={b + C - p} className="under" />
            <line x1={a + C - p} y1={b + p} x2={a + p} y2={b + C - p} className="over" />
          </g>
        );
      })}
    </svg>
  );
}
