import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import type { CellKind } from '../types';

export interface StlAnalysis {
  cols: number;
  rows: number;
  mask: string;
  pitchMm: number;
  holeCount: number;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  holeRatio: number;
}

interface Raster {
  W: number;
  H: number;
  res: number;
  /** 0 = empty, 1 = solid, 2 = outside */
  px: Uint8Array;
  dims: number[];
  thin: number;
}

/** Project the model along its thinnest axis and rasterise its footprint. */
function rasterise(buffer: ArrayBuffer): Raster {
  const geom = new STLLoader().parse(buffer);
  const pos = geom.getAttribute('position').array as ArrayLike<number>;
  if (pos.length < 9) throw new Error('ไฟล์ STL ว่างเปล่า');
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], pos[i + k]);
      max[k] = Math.max(max[k], pos[i + k]);
    }
  }
  const dims = [0, 1, 2].map((k) => max[k] - min[k]);
  const thin = dims.indexOf(Math.min(...dims));
  const [A, B] = [0, 1, 2].filter((k) => k !== thin);
  const res = Math.max(0.04, Math.max(dims[A], dims[B]) / 900);
  const W = Math.ceil(dims[A] / res) + 3, H = Math.ceil(dims[B] / res) + 3;
  const px = new Uint8Array(W * H);
  const tx = (v: number) => (v - min[A]) / res + 1;
  const ty = (v: number) => (max[B] - v) / res + 1;
  for (let i = 0; i < pos.length; i += 9) {
    const x0 = tx(pos[i + A]), y0 = ty(pos[i + B]);
    const x1 = tx(pos[i + 3 + A]), y1 = ty(pos[i + 3 + B]);
    const x2 = tx(pos[i + 6 + A]), y2 = ty(pos[i + 6 + B]);
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < 1e-6) continue;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
    const s = Math.sign(area), eps = -1e-6;
    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5;
      for (let x = minX; x <= maxX; x++) {
        const pxx = x + 0.5;
        const w0 = ((x1 - pxx) * (y2 - py) - (x2 - pxx) * (y1 - py)) * s;
        const w1 = ((x2 - pxx) * (y0 - py) - (x0 - pxx) * (y2 - py)) * s;
        const w2 = ((x0 - pxx) * (y1 - py) - (x1 - pxx) * (y0 - py)) * s;
        if (w0 >= eps && w1 >= eps && w2 >= eps) px[y * W + x] = 1;
      }
    }
  }
  // flood-fill the outside from the corner
  const stack = [0];
  px[0] = 2;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % W, y = (i / W) | 0;
    const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
    for (const j of nb) {
      if (j >= 0 && px[j] === 0) {
        px[j] = 2;
        stack.push(j);
      }
    }
  }
  return { W, H, res, px, dims, thin };
}

interface Blob2 { cx: number; cy: number; area: number }

function findHoles(r: Raster): Blob2[] {
  const { W, H, px } = r;
  const seen = new Uint8Array(W * H);
  const blobs: Blob2[] = [];
  for (let s = 0; s < W * H; s++) {
    if (px[s] !== 0 || seen[s]) continue;
    let area = 0, sx = 0, sy = 0;
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W, y = (i / W) | 0;
      area++; sx += x + 0.5; sy += y + 0.5;
      const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      for (const j of nb) {
        if (j >= 0 && px[j] === 0 && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    blobs.push({ cx: sx / area, cy: sy / area, area });
  }
  return blobs;
}

export function analyzeStl(buffer: ArrayBuffer, pitchOverrideMm?: number): StlAnalysis {
  const r = rasterise(buffer);
  const all = findHoles(r).filter((b) => b.area >= 4);
  if (all.length < 2) throw new Error('ไม่พบรูสำหรับปักในโมเดลนี้ (ต้องเป็นแผ่นที่มีรูเรียงเป็นตาราง)');
  const areas = all.map((b) => b.area).sort((a, b) => a - b);
  const median = areas[Math.floor(areas.length / 2)];
  const holes = all.filter((b) => b.area >= median * 0.35 && b.area <= median * 2.5);

  let pitchPx: number;
  if (pitchOverrideMm && pitchOverrideMm > 0) {
    pitchPx = pitchOverrideMm / r.res;
  } else {
    const step = Math.max(1, Math.floor(holes.length / 800));
    const nn: number[] = [];
    for (let i = 0; i < holes.length; i += step) {
      let best = Infinity;
      for (let j = 0; j < holes.length; j++) {
        if (i === j) continue;
        const d = Math.hypot(holes[i].cx - holes[j].cx, holes[i].cy - holes[j].cy);
        if (d < best) best = d;
      }
      nn.push(best);
    }
    nn.sort((a, b) => a - b);
    const med = nn[Math.floor(nn.length / 2)];
    // raster quantisation makes spacings alternate (e.g. 22, 23, 22 px): the mean of
    // values near the median is unbiased where the median is not
    // (use every orthogonal neighbour, not just the nearest, or the shorter spacing wins)
    let sum = 0, cnt = 0;
    for (let i = 0; i < holes.length; i += step) {
      for (let j = 0; j < holes.length; j++) {
        if (i === j) continue;
        const d = Math.hypot(holes[i].cx - holes[j].cx, holes[i].cy - holes[j].cy);
        if (d > med * 0.7 && d < med * 1.3) { sum += d; cnt++; }
      }
    }
    pitchPx = cnt ? sum / cnt : med;
    // then refine with a least-squares fit of centroid position against grid index
    for (let pass = 0; pass < 3; pass++) {
      const ref = holes[0];
      let num = 0, den = 0;
      for (const axis of ['cx', 'cy'] as const) {
        const idx = holes.map((h) => Math.round((h[axis] - ref[axis]) / pitchPx));
        const mi = idx.reduce((a, b) => a + b, 0) / idx.length;
        const mc = holes.reduce((a, h) => a + h[axis], 0) / holes.length;
        holes.forEach((h, k) => {
          num += (idx[k] - mi) * (h[axis] - mc);
          den += (idx[k] - mi) ** 2;
        });
      }
      if (den > 0) pitchPx = num / den;
    }
  }
  const h0 = holes[0];
  const iLo = Math.ceil((1 - h0.cx) / pitchPx - 0.2), iHi = Math.floor((r.W - 2 - h0.cx) / pitchPx + 0.2);
  const jLo = Math.ceil((1 - h0.cy) / pitchPx - 0.2), jHi = Math.floor((r.H - 2 - h0.cy) / pitchPx + 0.2);
  const cols = iHi - iLo + 1, rows = jHi - jLo + 1;
  if (cols < 1 || rows < 1 || cols * rows > 250 * 250) throw new Error('ขนาดตารางที่ตรวจพบไม่สมเหตุสมผล ลองกำหนดระยะห่างรูเอง');

  const mask: CellKind[] = new Array(cols * rows).fill('0');
  for (const h of holes) {
    const i = Math.round((h.cx - h0.cx) / pitchPx) - iLo;
    const j = Math.round((h.cy - h0.cy) / pitchPx) - jLo;
    if (i >= 0 && j >= 0 && i < cols && j < rows) mask[j * cols + i] = '2';
  }
  const sample = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= r.W || yi >= r.H) return false;
    return r.px[yi * r.W + xi] === 1;
  };
  const q = pitchPx * 0.3;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (mask[j * cols + i] === '2') continue;
      const cx = h0.cx + (i + iLo) * pitchPx, cy = h0.cy + (j + jLo) * pitchPx;
      const hits = [[0, 0], [q, 0], [-q, 0], [0, q], [0, -q]].filter(([dx, dy]) => sample(cx + dx, cy + dy)).length;
      if (hits >= 3) mask[j * cols + i] = '1';
    }
  }
  const pitchMm = Math.round(pitchPx * r.res * 100) / 100;
  const holeSide = Math.sqrt(median) * r.res;
  const [A, B] = [0, 1, 2].filter((k) => k !== r.thin);
  return {
    cols,
    rows,
    mask: mask.join(''),
    pitchMm,
    holeCount: holes.length,
    widthMm: r.dims[A],
    heightMm: r.dims[B],
    thicknessMm: Math.round(r.dims[r.thin] * 100) / 100,
    holeRatio: Math.min(0.85, Math.max(0.25, Math.round((holeSide / pitchMm) * 100) / 100)),
  };
}
