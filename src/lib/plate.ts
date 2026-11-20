import type { Pattern } from '../types';
import { APP_SLUG } from './brand';

type PlateSource = Pick<Pattern, 'cols' | 'rows' | 'pitchMm' | 'mask'>;

/**
 * Build a printable plate from the mask. Every cell is split into 3x3 sub-cells
 * (bar | hole | bar); a hole cell leaves its centre sub-cell open.
 * Returns non-indexed triangle positions (9 floats per triangle), centred on the origin,
 * with z from 0 to `thickness`.
 */
export function buildPlate(p: PlateSource, thickness: number, holeRatio: number): Float32Array {
  const { cols, rows, pitchMm: pitch, mask } = p;
  const m = (pitch * (1 - Math.min(0.9, Math.max(0.2, holeRatio)))) / 2;
  const W = cols * pitch, H = rows * pitch;
  const lines = (n: number) => {
    const a: number[] = [];
    for (let i = 0; i < n; i++) a.push(i * pitch, i * pitch + m, (i + 1) * pitch - m);
    a.push(n * pitch);
    return a;
  };
  const xs = lines(cols).map((v) => v - W / 2);
  const ys = lines(rows).map((v) => H / 2 - v);
  const SW = cols * 3, SH = rows * 3;
  const solid = (sx: number, sy: number): boolean => {
    if (sx < 0 || sy < 0 || sx >= SW || sy >= SH) return false;
    const k = mask[((sy / 3) | 0) * cols + ((sx / 3) | 0)];
    if (k === '0') return false;
    if (k === '1') return true;
    return !(sx % 3 === 1 && sy % 3 === 1);
  };

  const out: number[] = [];
  type V = [number, number, number];
  const quad = (a: V, b: V, c: V, d: V, n: V) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) [b, d] = [d, b];
    out.push(...a, ...b, ...c, ...a, ...c, ...d);
  };
  const t = thickness;
  for (let sy = 0; sy < SH; sy++) {
    for (let sx = 0; sx < SW; sx++) {
      if (!solid(sx, sy)) continue;
      const x0 = xs[sx], x1 = xs[sx + 1], y0 = ys[sy], y1 = ys[sy + 1];
      quad([x0, y0, t], [x0, y1, t], [x1, y1, t], [x1, y0, t], [0, 0, 1]);
      quad([x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0], [0, 0, -1]);
      if (!solid(sx - 1, sy)) quad([x0, y0, 0], [x0, y1, 0], [x0, y1, t], [x0, y0, t], [-1, 0, 0]);
      if (!solid(sx + 1, sy)) quad([x1, y0, 0], [x1, y1, 0], [x1, y1, t], [x1, y0, t], [1, 0, 0]);
      if (!solid(sx, sy - 1)) quad([x0, y0, 0], [x1, y0, 0], [x1, y0, t], [x0, y0, t], [0, 1, 0]);
      if (!solid(sx, sy + 1)) quad([x0, y1, 0], [x1, y1, 0], [x1, y1, t], [x0, y1, t], [0, -1, 0]);
    }
  }
  return new Float32Array(out);
}

/** Encode triangle positions as a binary STL file. */
export function toBinaryStl(pos: Float32Array, name = APP_SLUG): Blob {
  const triCount = pos.length / 9;
  const buf = new ArrayBuffer(84 + triCount * 50);
  const dv = new DataView(buf);
  const header = new TextEncoder().encode(name.replace(/[^\x20-\x7e]/g, '').slice(0, 79));
  new Uint8Array(buf, 0, 80).set(header);
  dv.setUint32(80, triCount, true);
  let o = 84;
  for (let i = 0; i < pos.length; i += 9) {
    const ux = pos[i + 3] - pos[i], uy = pos[i + 4] - pos[i + 1], uz = pos[i + 5] - pos[i + 2];
    const vx = pos[i + 6] - pos[i], vy = pos[i + 7] - pos[i + 1], vz = pos[i + 8] - pos[i + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true);
    o += 12;
    for (let k = 0; k < 9; k++) {
      dv.setFloat32(o, pos[i + k], true);
      o += 4;
    }
    dv.setUint16(o, 0, true);
    o += 2;
  }
  return new Blob([buf], { type: 'model/stl' });
}
