import type { Pattern, ViewMode } from '../types';
import { contrastText, shade } from './threads';
import { computeStats } from './stats';
import { t as tr } from './i18n';

export type Drawable = Pick<Pattern, 'cols' | 'rows' | 'mask' | 'cells' | 'palette'> & {
  details?: Pick<Pattern['details'], 'filamentColor' | 'baseType'>;
};

export interface DrawOpts {
  cell: number;
  view: ViewMode;
  grid: boolean;
  ox?: number;
  oy?: number;
  /** progress mask: '1' cells are drawn as finished */
  done?: string;
  /** palette index to highlight; other cells are faded */
  focus?: number | null;
}

const FONT = '"IBM Plex Sans Thai", system-ui, sans-serif';

export function drawPattern(ctx: CanvasRenderingContext2D, p: Drawable, o: DrawOpts) {
  const { cell: s, view } = o;
  const ox = o.ox ?? 0, oy = o.oy ?? 0;
  const plastic = p.details?.filamentColor ?? '#f4f1ea';
  const is3d = (p.details?.baseType ?? 'print3d') === 'print3d' || p.details?.baseType === 'plastic-canvas';
  const frame = view === 'symbol' ? '#e6e6e6' : shade(plastic, -0.06);
  const holeDark = shade(plastic, -0.42);
  const emptyHole = view === 'symbol' ? '#ffffff' : is3d ? plastic : '#fbfaf6';
  const pad = Math.max(1, s * 0.12);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.floor(s * 0.66)}px ${FONT}`;
  for (let y = 0; y < p.rows; y++) {
    for (let x = 0; x < p.cols; x++) {
      const i = y * p.cols + x;
      const k = p.mask[i];
      if (k === '0') continue;
      const px = ox + x * s, py = oy + y * s;
      if (k === '1') {
        ctx.fillStyle = frame;
        ctx.fillRect(px, py, s, s);
        if (view === 'symbol' && s >= 8) {
          ctx.strokeStyle = '#c9c9c9';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px, py + s);
          ctx.lineTo(px + s, py);
          ctx.stroke();
        }
        continue;
      }
      const c = p.cells[i];
      const color = c >= 0 ? p.palette[c] : undefined;
      if (view === 'color' || view === 'both') {
        ctx.fillStyle = color ? color.hex : emptyHole;
        ctx.fillRect(px, py, s, s);
        if (!color && is3d && s >= 6) {
          ctx.fillStyle = holeDark;
          ctx.fillRect(px + s * 0.3, py + s * 0.3, s * 0.4, s * 0.4);
        }
        if (view === 'both' && color && s >= 9) {
          ctx.fillStyle = contrastText(color.hex);
          ctx.fillText(color.symbol, px + s / 2, py + s / 2 + s * 0.04);
        }
      } else if (view === 'symbol') {
        ctx.fillStyle = color ? shade(color.hex, 0) + '33' : '#ffffff';
        ctx.fillRect(px, py, s, s);
        if (color && s >= 7) {
          ctx.fillStyle = '#111111';
          ctx.fillText(color.symbol, px + s / 2, py + s / 2 + s * 0.04);
        }
      } else {
        // "stitch" look: frame + hole, colour drawn as an X stitch
        ctx.fillStyle = is3d ? plastic : '#fbfaf6';
        ctx.fillRect(px, py, s, s);
        if (is3d) {
          ctx.fillStyle = holeDark;
          if (s < 8) ctx.fillRect(px + s * 0.2, py + s * 0.2, s * 0.6, s * 0.6);
          else ctx.fillRect(px + pad * 1.6, py + pad * 1.6, s - pad * 3.2, s - pad * 3.2);
        }
        if (color) {
          if (s < 6) {
            ctx.fillStyle = color.hex;
            ctx.fillRect(px, py, s, s);
          } else {
            ctx.lineCap = 'round';
            ctx.lineWidth = s * 0.3;
            ctx.strokeStyle = shade(color.hex, -0.18);
            ctx.beginPath();
            ctx.moveTo(px + pad, py + pad);
            ctx.lineTo(px + s - pad, py + s - pad);
            ctx.stroke();
            ctx.strokeStyle = color.hex;
            ctx.beginPath();
            ctx.moveTo(px + s - pad, py + pad);
            ctx.lineTo(px + pad, py + s - pad);
            ctx.stroke();
            ctx.lineWidth = Math.max(1, s * 0.06);
            ctx.strokeStyle = shade(color.hex, 0.18);
            ctx.beginPath();
            ctx.moveTo(px + s - pad * 1.6, py + pad * 1.4);
            ctx.lineTo(px + pad * 2, py + s - pad * 2.2);
            ctx.stroke();
          }
        }
      }
      if (o.done && color && o.done.charCodeAt(i) === 49) {
        // finished stitch: dark wash + check mark
        ctx.fillStyle = 'rgba(24, 32, 52, 0.58)';
        ctx.fillRect(px, py, s, s);
        if (s >= 10) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(1.5, s * 0.1);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(px + s * 0.26, py + s * 0.52);
          ctx.lineTo(px + s * 0.43, py + s * 0.69);
          ctx.lineTo(px + s * 0.75, py + s * 0.33);
          ctx.stroke();
        }
      }
      if (o.focus != null && o.focus >= 0 && c !== o.focus) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(px, py, s, s);
      }
    }
  }
  if (o.grid && s >= 5) drawGrid(ctx, p, s, ox, oy, view === 'symbol' ? '#00000055' : '#00000022', '#00000088');
  ctx.restore();
}

function drawGrid(ctx: CanvasRenderingContext2D, p: Drawable, s: number, ox: number, oy: number, thin: string, bold: string) {
  for (const pass of [0, 1]) {
    ctx.beginPath();
    for (let x = 0; x <= p.cols; x++) {
      const isBold = x % 10 === 0;
      if ((pass === 1) !== isBold) continue;
      const X = Math.round(ox + x * s) + 0.5;
      ctx.moveTo(X, oy);
      ctx.lineTo(X, oy + p.rows * s);
    }
    for (let y = 0; y <= p.rows; y++) {
      const isBold = y % 10 === 0;
      if ((pass === 1) !== isBold) continue;
      const Y = Math.round(oy + y * s) + 0.5;
      ctx.moveTo(ox, Y);
      ctx.lineTo(ox + p.cols * s, Y);
    }
    ctx.strokeStyle = pass ? bold : thin;
    ctx.lineWidth = pass ? 1.4 : 1;
    ctx.stroke();
  }
}

export function renderCanvas(p: Drawable, cell: number, view: ViewMode, grid = false): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(p.cols * cell));
  c.height = Math.max(1, Math.round(p.rows * cell));
  drawPattern(c.getContext('2d')!, p, { cell, view, grid });
  return c;
}

/** A shareable PNG: title, chart and thread legend in one image. */
export function exportPng(p: Pattern, view: ViewMode): Promise<Blob> {
  const stats = computeStats(p);
  const used = stats.colors.filter((c) => c.count > 0);
  const cell = Math.max(8, Math.min(28, Math.floor(1100 / Math.max(p.cols, p.rows))));
  const chartW = p.cols * cell, chartH = p.rows * cell;
  const W = Math.max(chartW + 80, 720);
  const rowH = 34;
  const legendH = 60 + Math.ceil(used.length / 2) * rowH;
  const H = 110 + chartH + 40 + legendH;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#faf6ef';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1f2a44';
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(p.name, 40, 52);
  ctx.font = `400 16px ${FONT}`;
  ctx.fillStyle = '#5b6478';
  const meta = [
    tr(`${p.cols}×${p.rows} ช่อง`, `${p.cols}×${p.rows} cells`),
    `${stats.widthMm.toFixed(0)}×${stats.heightMm.toFixed(0)} ${tr('มม.', 'mm')}`,
    tr(`${stats.total.toLocaleString()} ฝีเข็ม`, `${stats.total.toLocaleString()} stitches`),
    tr(`${used.length} สี`, `${used.length} ${used.length === 1 ? 'color' : 'colors'}`),
    p.details.author ? tr(`โดย ${p.details.author}`, `by ${p.details.author}`) : '',
  ].filter(Boolean).join('  ·  ');
  ctx.fillText(meta, 40, 82);
  const ox = Math.round((W - chartW) / 2), oy = 110;
  drawPattern(ctx, p, { cell, view, grid: true, ox, oy });
  let y = oy + chartH + 50;
  ctx.fillStyle = '#1f2a44';
  ctx.font = `700 18px ${FONT}`;
  ctx.fillText(tr('ด้ายที่ใช้', 'Threads used'), 40, y);
  y += 20;
  used.forEach((u, idx) => {
    const t = p.palette[u.index];
    const col = idx % 2, row = Math.floor(idx / 2);
    const x = 40 + col * ((W - 80) / 2), yy = y + row * rowH;
    ctx.fillStyle = t.hex;
    ctx.fillRect(x, yy, 26, 26);
    ctx.strokeStyle = '#00000033';
    ctx.strokeRect(x + 0.5, yy + 0.5, 25, 25);
    ctx.fillStyle = contrastText(t.hex);
    ctx.font = `600 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(t.symbol, x + 13, yy + 19);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1f2a44';
    ctx.font = `500 15px ${FONT}`;
    const label = `${[t.brand, t.code].filter(Boolean).join(' ')} ${t.name}`.trim();
    ctx.fillText(label.slice(0, 34), x + 36, yy + 18);
    ctx.fillStyle = '#5b6478';
    ctx.textAlign = 'right';
    ctx.fillText(`${u.count}`, x + (W - 80) / 2 - 16, yy + 18);
    ctx.textAlign = 'left';
  });
  ctx.fillStyle = '#9aa0ad';
  ctx.font = `400 13px ${FONT}`;
  ctx.fillText(tr('สร้างด้วย Stitch by Style', 'Made with Stitch by Style'), 40, H - 16);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG failed'))), 'image/png'));
}
