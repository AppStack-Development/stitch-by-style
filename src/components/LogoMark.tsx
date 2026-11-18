import { useId } from 'react';
import logo from '../brand/logo-grid.json';

const { grid, colors, geometry: g, needle: N, thread: T } = logo;
const ROWS = grid.length;

interface Props {
  /** rendered size in CSS px */
  size?: number;
  className?: string;
  title?: string;
}

/**
 * The brand mark: a pixel S of cross stitches on a navy tile with a faint hole grid. Its last
 * stitch is only half done, and a big needle comes in from the corner to pierce the next hole,
 * trailing the thread. Drawn as SVG in a 100x100 box; strokes keep a minimum on-screen width so
 * small sizes stay legible, and the hole grid is left out below 24 px.
 */
export function LogoMark({ size = 36, className, title = 'Stitch by Style' }: Props) {
  const S = 100;
  const cell = (S * g.span) / ROWS;
  const x0 = S * g.x0, y0 = S * g.y0;
  const cx = (q: number) => x0 + (q + 0.5) * cell, cy = (r: number) => y0 + (r + 0.5) * cell;
  const p = cell * g.stitchHalf;
  const sw = Math.max(cell * g.stitchWidth, (g.minStrokePx / size) * S);
  const showHoles = size >= 24;
  const [hq, hr] = N.stitch;

  const holes: JSX.Element[] = [];
  if (showHoles) {
    const m = Math.ceil(S / cell) + 1;
    for (let r = -m; r <= m; r++) {
      for (let q = -m; q <= m; q++) {
        const hx = cx(q), hy = cy(r);
        if (hx < 0 || hy < 0 || hx > S || hy > S) continue;
        holes.push(<circle key={`${q},${r}`} cx={hx} cy={hy} r={cell * g.holeRadius} />);
      }
    }
  }
  // "/" goes down first, "\" crosses on top; the half-done stitch has only its "/"
  const under: JSX.Element[] = [], over: JSX.Element[] = [];
  grid.forEach((row, r) =>
    [...row].forEach((ch, q) => {
      if (ch !== '#') return;
      under.push(<line key={`u${q},${r}`} x1={cx(q) - p} y1={cy(r) + p} x2={cx(q) + p} y2={cy(r) - p} />);
      if (q !== hq || r !== hr) over.push(<line key={`o${q},${r}`} x1={cx(q) - p} y1={cy(r) - p} x2={cx(q) + p} y2={cy(r) + p} />);
    }),
  );

  // needle: tip in the hole where the "\" goes down, shaft running off the tile at N.angle
  const tip = [cx(hq) + p, cy(hr) + p];
  const from = [cx(hq) - p, cy(hr) - p];
  const L = N.length * S, w = Math.max(N.halfWidth, N.minHalfWidthPx / size) * S, deg = (N.angle * 180) / Math.PI;
  const eye = [tip[0] + Math.cos(N.angle) * L * N.eyeAt, tip[1] + Math.sin(N.angle) * L * N.eyeAt];
  const t = L * N.taper, k = t * 0.4;
  const shaft = `M0 0Q${k} ${-0.75 * w} ${t} ${-w}L${1.2 * L} ${-w}L${1.2 * L} ${w}L${t} ${w}Q${k} ${0.75 * w} 0 0Z`;
  const thread = `M${from[0]} ${from[1]}C${from[0] + T.c1[0] * S} ${from[1] + T.c1[1] * S} ${eye[0] + T.c2[0] * S} ${eye[1] + T.c2[1] * S} ${eye[0]} ${eye[1]}`;

  const rx = S * g.tileRadius;
  const id = `sbs-logo-${useId().replace(/:/g, '')}`; // unique per instance (valid, non-clashing SVG ids)
  return (
    <svg className={className} width={size} height={size} viewBox={`0 0 ${S} ${S}`} role="img" aria-label={title}>
      <title>{title}</title>
      <defs>
        <clipPath id={`${id}-c`}><rect width={S} height={S} rx={rx} /></clipPath>
        <linearGradient id={`${id}-n`} gradientUnits="userSpaceOnUse" x1="0" y1={-w} x2="0" y2={w}>
          <stop offset="0" stopColor={colors.needleLight} />
          <stop offset="0.4" stopColor={colors.needleMid} />
          <stop offset="1" stopColor={colors.needleDark} />
        </linearGradient>
      </defs>
      <rect width={S} height={S} rx={rx} fill={colors.tile} />
      <g clipPath={`url(#${id}-c)`}>
        {showHoles && <g fill={colors.hole}>{holes}</g>}
        <g strokeLinecap="round" strokeWidth={sw}>
          <g stroke={colors.under}>{under}</g>
          <g stroke={colors.over}>{over}</g>
          <path d={thread} fill="none" stroke={colors.over} />
        </g>
        <g transform={`translate(${tip[0]} ${tip[1]}) rotate(${deg})`}>
          <path d={shaft} fill={`url(#${id}-n)`} />
          <ellipse cx={L * N.eyeAt} cy={0} rx={L * N.eyeHalfLength} ry={w * N.eyeHalfWidth} fill={colors.tile} />
          <line x1={L * N.eyeAt} y1={-w * 0.3} x2={L * N.eyeAt} y2={w * 0.3} stroke={colors.over} strokeWidth={sw} strokeLinecap="round" />
        </g>
        <circle cx={tip[0]} cy={tip[1]} r={Math.max(cell * N.pierceRadius, (0.7 / size) * S)} fill={colors.pierce} />
      </g>
    </svg>
  );
}
