import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { strFromU8, unzipSync } from 'fflate';
import type { CellKind } from '../types';
import { t } from './i18n';

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
  A: number;
  B: number;
  min: number[];
  max: number[];
  pos: ArrayLike<number>;
}

/** Project the model along its thinnest axis and rasterise its footprint. */
function rasterise(pos: ArrayLike<number>): Raster {
  if (pos.length < 9) throw new Error(t('ไฟล์โมเดลว่างเปล่า', 'The model file is empty'));
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
  return { W, H, res, px, dims, thin, A, B, min, max, pos };
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
  return analyzePositions(stlPositions(buffer), pitchOverrideMm);
}

function stlPositions(buffer: ArrayBuffer): ArrayLike<number> {
  return new STLLoader().parse(buffer).getAttribute('position').array as ArrayLike<number>;
}

export function analyzePositions(pos: ArrayLike<number>, pitchOverrideMm?: number): StlAnalysis {
  const r = rasterise(pos);
  const all = findHoles(r).filter((b) => b.area >= 4);
  if (all.length < 2) throw new Error(t('ไม่พบรูสำหรับปักในโมเดลนี้ (ต้องเป็นแผ่นที่มีรูเรียงเป็นตาราง)', 'No stitch holes found in this model (it needs to be a plate with holes in a grid)'));
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
  // A cross stitch goes through the four holes at its corners, so the holes found are the grid corners and
  // a stitch cell is the square between four of them (the same layout plate.ts prints). The cell grid is
  // one wider than the hole grid each way, so the ring of cells around the outer holes can hold the frame.
  const hc = iHi - iLo + 1, hr = jHi - jLo + 1;
  if (hc < 2 || hr < 2 || hc * hr > 251 * 251) throw new Error(t('ขนาดตารางที่ตรวจพบไม่สมเหตุสมผล ลองกำหนดระยะห่างรูเอง', 'The detected grid size looks wrong. Try setting the hole pitch yourself.'));
  const found = new Set<number>();
  for (const h of holes) {
    const i = Math.round((h.cx - h0.cx) / pitchPx) - iLo;
    const j = Math.round((h.cy - h0.cy) / pitchPx) - jLo;
    if (i >= 0 && j >= 0 && i < hc && j < hr) found.add(j * hc + i);
  }
  const hole = (i: number, j: number) => i >= 0 && j >= 0 && i < hc && j < hr && found.has(j * hc + i);
  const sample = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= r.W || yi >= r.H) return false;
    return r.px[yi * r.W + xi] === 1;
  };
  // cell (c, k) spans hole corners (c - 1, k - 1) .. (c, k)
  const fullCols = hc + 1, fullRows = hr + 1;
  const full: CellKind[] = new Array(fullCols * fullRows).fill('0');
  const q = pitchPx * 0.3;
  for (let k = 0; k < fullRows; k++) {
    for (let c = 0; c < fullCols; c++) {
      if (hole(c - 1, k - 1) && hole(c, k - 1) && hole(c - 1, k) && hole(c, k)) { full[k * fullCols + c] = '2'; continue; }
      const cx = h0.cx + (c - 1 + iLo + 0.5) * pitchPx, cy = h0.cy + (k - 1 + jLo + 0.5) * pitchPx;
      const hits = [[0, 0], [q, 0], [-q, 0], [0, q], [0, -q]].filter(([dx, dy]) => sample(cx + dx, cy + dy)).length;
      if (hits >= 3) full[k * fullCols + c] = '1';
    }
  }
  // trim empty outer rows and columns
  let c0 = fullCols, c1 = -1, k0 = fullRows, k1 = -1;
  full.forEach((v, n) => { if (v === '0') return; const c = n % fullCols, k = (n / fullCols) | 0; c0 = Math.min(c0, c); c1 = Math.max(c1, c); k0 = Math.min(k0, k); k1 = Math.max(k1, k); });
  if (c1 < 0 || !full.includes('2')) throw new Error(t('ไม่พบช่องปักในโมเดลนี้ (ต้องมีรู 4 รูล้อมเป็นสี่เหลี่ยม)', 'No stitch cells found in this model (each needs four holes around it)'));
  const cols = c1 - c0 + 1, rows = k1 - k0 + 1;
  const mask: CellKind[] = [];
  for (let k = k0; k <= k1; k++) for (let c = c0; c <= c1; c++) mask.push(full[k * fullCols + c]);
  /** raster point → index into `mask`, or -1 */
  const cellAt = (x: number, y: number) => {
    const c = Math.floor((x - h0.cx) / pitchPx - iLo + 1) - c0, k = Math.floor((y - h0.cy) / pitchPx - jLo + 1) - k0;
    return c >= 0 && k >= 0 && c < cols && k < rows ? k * cols + c : -1;
  };
  const pitchMm = Math.round(pitchPx * r.res * 100) / 100;
  const holeSide = Math.sqrt(median) * r.res;
  return {
    cols,
    rows,
    mask: mask.join(''),
    pitchMm,
    holeCount: holes.length,
    widthMm: r.dims[r.A],
    heightMm: r.dims[r.B],
    // only geometry over stitch cells counts: lid walls and rims sit on frame cells
    thicknessMm: panelThickness(r, (x, y) => {
      const n = cellAt(x, y);
      return n >= 0 && mask[n] === '2';
    }),
    holeRatio: Math.min(0.85, Math.max(0.25, Math.round((holeSide / pitchMm) * 100) / 100)),
  };
}

/**
 * Thickness of the stitching panel: the extent along the thin axis of triangles whose
 * footprint centre lies on a stitch cell. Box lids have walls/rims much taller than the panel.
 */
function panelThickness(r: Raster, onStitchCell: (px: number, py: number) => boolean): number {
  const { pos, A, B, thin, min, max, res } = r;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < pos.length; i += 9) {
    const cx = ((pos[i + A] + pos[i + 3 + A] + pos[i + 6 + A]) / 3 - min[A]) / res + 1;
    const cy = (max[B] - (pos[i + B] + pos[i + 3 + B] + pos[i + 6 + B]) / 3) / res + 1;
    if (!onStitchCell(cx, cy)) continue;
    for (let k = 0; k < 9; k += 3) {
      lo = Math.min(lo, pos[i + k + thin]);
      hi = Math.max(hi, pos[i + k + thin]);
    }
  }
  const t = hi > lo ? hi - lo : r.dims[thin];
  return Math.round(t * 100) / 100;
}

// ---------------------------------------------------------------------------
// Model files: STL (one part) and 3MF (one part per printable object)

export interface ModelPart {
  name: string;
  positions: Float32Array;
}

export interface PartAnalysis {
  part: ModelPart;
  result: StlAnalysis | null;
  error: string;
}

export function readModelFile(fileName: string, buffer: ArrayBuffer): ModelPart[] {
  const base = fileName.replace(/\.[^.]+$/, '');
  if (/\.3mf$/i.test(fileName)) return read3mf(buffer, base);
  const pos = stlPositions(buffer);
  return [{ name: base, positions: pos instanceof Float32Array ? pos : Float32Array.from(pos) }];
}

export function analyzeParts(parts: ModelPart[], pitchOverrideMm?: number): PartAnalysis[] {
  return parts.map((part) => {
    try {
      return { part, result: analyzePositions(part.positions, pitchOverrideMm), error: '' };
    } catch (e) {
      return { part, result: null, error: (e as Error).message };
    }
  });
}

/** Index of the part with the most stitch holes, or -1. */
export function bestPart(list: PartAnalysis[]): number {
  let best = -1;
  list.forEach((a, i) => {
    if (a.result && (best < 0 || a.result.holeCount > list[best].result!.holeCount)) best = i;
  });
  return best;
}

type Mat = number[]; // 3MF 3x4, row-vector convention: m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32

interface Obj3mf {
  verts?: Float64Array;
  tris?: Uint32Array;
  comps: { key: string; m: Mat | null }[];
}

const UNIT_MM: Record<string, number> = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 };

function attrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/([\w:]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

const parseMat = (t?: string): Mat | null => {
  if (!t) return null;
  const v = t.trim().split(/\s+/).map(Number);
  return v.length === 12 && v.every(Number.isFinite) ? v : null;
};

function read3mf(buffer: ArrayBuffer, base: string): ModelPart[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buffer), { filter: (f) => f.name.endsWith('.model') || f.name.endsWith('.rels') || f.name.endsWith('model_settings.config') });
  } catch {
    throw new Error(t('เปิดไฟล์ 3MF ไม่ได้ (ไฟล์อาจเสียหาย)', 'Could not open this 3MF file (it may be damaged)'));
  }
  const text = (name: string) => (files[name] ? strFromU8(files[name]) : '');
  const norm = (p: string) => p.replace(/^\//, '');
  const rels = text('_rels/.rels');
  const main = norm(/Target="([^"]+\.model)"/i.exec(rels)?.[1] ?? '3D/3dmodel.model');
  if (!files[main]) throw new Error(t('ไม่พบข้อมูลโมเดลในไฟล์ 3MF', 'No model data found in this 3MF file'));

  const objects = new Map<string, Obj3mf>();
  let unitScale = 1;
  const parseFile = (path: string) => {
    const xml = text(path);
    if (path === main) unitScale = UNIT_MM[attrs(/<(?:\w+:)?model\b([^>]*)>/.exec(xml)?.[1] ?? '').unit ?? 'millimeter'] ?? 1;
    for (const om of xml.matchAll(/<(?:\w+:)?object\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?object>/g)) {
      const id = attrs(om[1]).id;
      const body = om[2];
      const obj: Obj3mf = { comps: [] };
      const vm = /<(?:\w+:)?vertices>([\s\S]*?)<\/(?:\w+:)?vertices>/.exec(body);
      if (vm) {
        const v: number[] = [];
        for (const m of vm[1].matchAll(/<(?:\w+:)?vertex\b([^>]*?)\/?>/g)) {
          const a = attrs(m[1]);
          v.push(+a.x, +a.y, +a.z);
        }
        const t: number[] = [];
        const tm = /<(?:\w+:)?triangles>([\s\S]*?)<\/(?:\w+:)?triangles>/.exec(body);
        if (tm) {
          for (const m of tm[1].matchAll(/<(?:\w+:)?triangle\b([^>]*?)\/?>/g)) {
            const a = attrs(m[1]);
            t.push(+a.v1, +a.v2, +a.v3);
          }
        }
        obj.verts = Float64Array.from(v);
        obj.tris = Uint32Array.from(t);
      }
      for (const m of body.matchAll(/<(?:\w+:)?component\b([^>]*?)\/?>/g)) {
        const a = attrs(m[1]);
        const p = a['p:path'] ? norm(a['p:path']) : path;
        obj.comps.push({ key: `${p}#${a.objectid}`, m: parseMat(a.transform) });
        if (a['p:path'] && files[p] && !parsed.has(p)) { parsed.add(p); parseFile(p); }
      }
      objects.set(`${path}#${id}`, obj);
    }
  };
  const parsed = new Set([main]);
  parseFile(main);

  // part names from Bambu/Orca project metadata, keyed by build object id
  const names = new Map<string, string>();
  for (const m of text('Metadata/model_settings.config').matchAll(/<object id="(\d+)">([\s\S]*?)<\/object>/g)) {
    const n = /<metadata key="name" value="([^"]*)"/.exec(m[2])?.[1];
    if (n) names.set(m[1], n.replace(/\.(step|stp|stl|obj|3mf)$/i, ''));
  }

  const emit = (key: string, chain: Mat[], out: number[], depth = 0) => {
    const o = objects.get(key);
    if (!o || depth > 16) return;
    if (o.verts && o.tris) {
      const v = o.verts;
      for (const vi of o.tris) {
        let x = v[vi * 3], y = v[vi * 3 + 1], z = v[vi * 3 + 2];
        for (const m of chain) {
          const nx = x * m[0] + y * m[3] + z * m[6] + m[9];
          const ny = x * m[1] + y * m[4] + z * m[7] + m[10];
          const nz = x * m[2] + y * m[5] + z * m[8] + m[11];
          x = nx; y = ny; z = nz;
        }
        out.push(x * unitScale, y * unitScale, z * unitScale);
      }
    }
    for (const c of o.comps) emit(c.key, c.m ? [c.m, ...chain] : chain, out, depth + 1);
  };

  const parts: ModelPart[] = [];
  const items = [...text(main).matchAll(/<(?:\w+:)?item\b([^>]*?)\/?>/g)].map((m) => attrs(m[1]));
  const roots = items.length
    ? items.map((a) => ({ id: a.objectid, m: parseMat(a.transform) }))
    : [...objects.keys()].filter((k) => k.startsWith(main + '#')).map((k) => ({ id: k.split('#')[1], m: null }));
  roots.forEach((it, n) => {
    const out: number[] = [];
    emit(`${main}#${it.id}`, it.m ? [it.m] : [], out);
    if (out.length >= 9) parts.push({ name: names.get(it.id) ?? (roots.length > 1 ? t(`${base} (ชิ้นที่ ${n + 1})`, `${base} (part ${n + 1})`) : base), positions: Float32Array.from(out) });
  });
  if (!parts.length) throw new Error(t('ไม่พบชิ้นงานที่มีรูปทรงในไฟล์ 3MF', 'No solid parts found in this 3MF file'));
  return parts;
}
