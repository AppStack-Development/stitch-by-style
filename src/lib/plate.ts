import type { Pattern } from '../types';
import { APP_SLUG } from './brand';

type PlateSource = Pick<Pattern, 'cols' | 'rows' | 'pitchMm' | 'mask'>;

/**
 * Build a printable plate from the mask. A cross stitch covers one cell and its four ends go through
 * holes at the cell's corners, so the holes sit on the grid corners (every corner that touches a
 * stitchable cell) and the middle of each cell stays solid for the stitch to lie on, like Aida fabric.
 * Stitchable cells on the outside of the shape get a half-cell rim so their corner holes stay closed.
 * Returns non-indexed triangle positions (9 floats per triangle), centred on the origin,
 * with z from 0 to `thickness`.
 */
export function buildPlate(p: PlateSource, thickness: number, holeRatio: number): Float32Array {
  const { cols, rows, pitchMm: pitch, mask } = p;
  const half = (pitch * Math.min(0.85, Math.max(0.2, holeRatio))) / 2; // half the hole's side
  const rim = pitch / 2; // around stitchable cells that touch the outside
  const W = cols * pitch, H = rows * pitch;
  const kind = (cx: number, cy: number) => (cx < 0 || cy < 0 || cx >= cols || cy >= rows ? '0' : mask[cy * cols + cx]);
  const stitchable = (cx: number, cy: number) => kind(cx, cy) === '2';
  const holeAt = (vx: number, vy: number) =>
    stitchable(vx - 1, vy - 1) || stitchable(vx, vy - 1) || stitchable(vx - 1, vy) || stitchable(vx, vy);

  // break lines: cell edges, hole edges around every corner, and the rim beyond the outer cells
  const lines = (n: number) => {
    const a = new Set<number>();
    for (let i = 0; i <= n; i++) [i * pitch, i * pitch - half, i * pitch + half].forEach((v) => a.add(+v.toFixed(6)));
    a.add(-rim); a.add(n * pitch + rim);
    for (let i = 0; i < n; i++) a.add(+(i * pitch + pitch / 2).toFixed(6));
    return [...a].sort((u, v) => u - v);
  };
  const gx = lines(cols), gy = lines(rows);
  const NX = gx.length - 1, NY = gy.length - 1;
  const xs = gx.map((v) => v - W / 2);
  const ys = gy.map((v) => H / 2 - v);

  // decide each small rectangle by its centre (grid units: x right, y down, origin at the top-left corner)
  const filled = new Uint8Array(NX * NY);
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const x = (gx[i] + gx[i + 1]) / 2, y = (gy[j] + gy[j + 1]) / 2;
      const vx = Math.round(x / pitch), vy = Math.round(y / pitch);
      if (Math.abs(x - vx * pitch) < half && Math.abs(y - vy * pitch) < half && holeAt(vx, vy)) continue;
      const cx = Math.floor(x / pitch), cy = Math.floor(y / pitch);
      let solid = kind(cx, cy) !== '0';
      // outside the shape (or in a cut-out): solid only within the rim of a stitchable cell
      for (let dy = -1; !solid && dy <= 1; dy++) {
        for (let dx = -1; !solid && dx <= 1; dx++) {
          if (!stitchable(cx + dx, cy + dy)) continue;
          const ex = Math.max((cx + dx) * pitch - x, 0, x - (cx + dx + 1) * pitch);
          const ey = Math.max((cy + dy) * pitch - y, 0, y - (cy + dy + 1) * pitch);
          if (Math.max(ex, ey) <= rim) solid = true;
        }
      }
      if (solid) filled[j * NX + i] = 1;
    }
  }
  const solid = (sx: number, sy: number): boolean => sx >= 0 && sy >= 0 && sx < NX && sy < NY && filled[sy * NX + sx] === 1;
  const SW = NX, SH = NY;

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
