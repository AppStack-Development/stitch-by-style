import type { Pattern } from '../types';
import { contrastText } from '../lib/threads';

export type ChartMode = 'symbol' | 'color' | 'both';

interface Props {
  pattern: Pattern;
  x0: number;
  y0: number;
  x1: number; // exclusive
  y1: number; // exclusive
  cellMm: number;
  mode: ChartMode;
}

/** Printable chart for a region of the pattern, with 10-cell rulers. */
export function ChartSVG({ pattern: p, x0, y0, x1, y1, cellMm, mode }: Props) {
  const s = 10; // svg units per cell
  const pad = 22;
  const w = (x1 - x0) * s, h = (y1 - y0) * s;
  const cells: JSX.Element[] = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * p.cols + x;
      const k = p.mask[i];
      if (k === '0') continue;
      const X = pad + (x - x0) * s, Y = pad + (y - y0) * s;
      if (k === '1') {
        cells.push(<rect key={i} x={X} y={Y} width={s} height={s} fill="url(#hatch)" />);
        continue;
      }
      const c = p.cells[i];
      const t = c >= 0 ? p.palette[c] : undefined;
      if (!t) continue;
      const fill = mode === 'symbol' ? '#ffffff' : t.hex;
      cells.push(<rect key={i} x={X} y={Y} width={s} height={s} fill={fill} />);
      if (mode !== 'color') {
        cells.push(
          <text key={'t' + i} x={X + s / 2} y={Y + s / 2 + 0.4} fontSize={7} textAnchor="middle" dominantBaseline="middle"
            fill={mode === 'both' ? contrastText(t.hex) : '#111'} fontWeight={600}>
            {t.symbol}
          </text>,
        );
      }
    }
  }
  const lines: JSX.Element[] = [];
  for (let x = x0; x <= x1; x++) {
    const bold = x % 10 === 0;
    const X = pad + (x - x0) * s;
    lines.push(<line key={'vx' + x} x1={X} y1={pad} x2={X} y2={pad + h} stroke={bold ? '#222' : '#9a9a9a'} strokeWidth={bold ? 0.7 : 0.25} />);
    if (bold || x === x0) lines.push(<text key={'lx' + x} x={X} y={pad - 6} fontSize={6.5} textAnchor="middle" fill="#444">{x}</text>);
  }
  for (let y = y0; y <= y1; y++) {
    const bold = y % 10 === 0;
    const Y = pad + (y - y0) * s;
    lines.push(<line key={'hy' + y} x1={pad} y1={Y} x2={pad + w} y2={Y} stroke={bold ? '#222' : '#9a9a9a'} strokeWidth={bold ? 0.7 : 0.25} />);
    if (bold || y === y0) lines.push(<text key={'ly' + y} x={pad - 4} y={Y + 2} fontSize={6.5} textAnchor="end" fill="#444">{y}</text>);
  }
  // centre arrows
  const cx = p.cols / 2, cy = p.rows / 2;
  const arrows: JSX.Element[] = [];
  if (cx >= x0 && cx <= x1) {
    const X = pad + (cx - x0) * s;
    arrows.push(<path key="ax" d={`M${X - 4},${pad - 17} L${X + 4},${pad - 17} L${X},${pad - 11} Z`} fill="#e0533d" />);
  }
  if (cy >= y0 && cy <= y1) {
    const Y = pad + (cy - y0) * s;
    arrows.push(<path key="ay" d={`M${pad - 20},${Y - 4} L${pad - 20},${Y + 4} L${pad - 14},${Y} Z`} fill="#e0533d" />);
  }
  const totalW = w + pad + 4, totalH = h + pad + 4;
  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      width={`${(totalW / s) * cellMm}mm`}
      height={`${(totalH / s) * cellMm}mm`}
      style={{ fontFamily: '"IBM Plex Sans Thai", sans-serif' }}
    >
      <defs>
        <pattern id="hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3" height="3" fill="#eeeeee" />
          <line x1="0" y1="0" x2="0" y2="3" stroke="#c8c8c8" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x={pad} y={pad} width={w} height={h} fill="#fff" />
      {cells}
      {lines}
      {arrows}
    </svg>
  );
}
