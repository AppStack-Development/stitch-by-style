import type { Pattern, ThreadColor } from '../types';
import { DMC_LIBRARY, makeThread } from './threads';
import { t } from './i18n';

export type PaletteMode = 'dmc' | 'exact' | 'current' | 'stash';

export interface ImportOpts {
  /** max number of thread colours */
  colors: number;
  paletteMode: PaletteMode;
  /** 1 = image fits inside the stitchable area */
  scale: number;
  /** shift as a fraction of the stitchable area, -0.5..0.5 */
  offsetX: number;
  offsetY: number;
  skipBackground: boolean;
  /** colour distance (CIE76) still counted as background */
  bgTolerance: number;
  /** replace lone stitches with the surrounding colour */
  cleanup: boolean;
  /** only fill holes that are still empty */
  keepExisting: boolean;
  /** drop palette colours that end up unused */
  pruneUnused: boolean;
  /** trim empty background margins around the subject before fitting */
  autoCrop: boolean;
  /** 'stash' mode: DMC codes the user owns */
  stash?: string[];
  /** 'stash' mode: how many threads outside the stash may be added for colours the stash can't match */
  stashExtra?: number;
}

export const DEFAULT_IMPORT: ImportOpts = {
  colors: 8,
  paletteMode: 'dmc',
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  skipBackground: true,
  bgTolerance: 14,
  cleanup: true,
  keepExisting: false,
  pruneUnused: true,
  autoCrop: true,
};

export interface SourceImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  /** detected uniform background colour, if any */
  bg: Lab | null;
  bgHex: string | null;
  hasAlpha: boolean;
  /** bounding box of the subject (non-background pixels) in source pixels */
  crop: { x: number; y: number; w: number; h: number };
}

export interface ImportResult {
  cells: number[];
  palette: ThreadColor[];
  colorsUsed: number;
  stitched: number;
  /** 'stash' mode: image colours the stash matches poorly (and that no extra thread was allowed for) */
  poorMatches?: number;
}

type Lab = [number, number, number];
type Rgb = [number, number, number];

const lin = (c: number) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function rgbToLab(r: number, g: number, b: number): Lab {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function hexToLab(hex: string): Lab {
  const n = parseInt(hex.slice(1), 16);
  return rgbToLab((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

/** Nearest DMC colour as a hex stand-in when no pixel colours were sampled. */
function labToHexApprox(l: Lab): string {
  return DMC_LIBRARY[nearest(l, DMC_LAB)].hex;
}

const dist2 = (a: Lab, b: Lab) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

const DMC_LAB = DMC_LIBRARY.map((d) => hexToLab(d.hex));

/** The `n` DMC threads closest to a colour, with their colour difference (ΔE76). */
export function nearestDmc(hex: string, n = 6): { code: string; name: string; hex: string; dE: number }[] {
  const lab = hexToLab(hex);
  return DMC_LIBRARY.map((d, i) => ({ ...d, dE: Math.sqrt(dist2(lab, DMC_LAB[i])) }))
    .sort((a, b) => a.dE - b.dE)
    .slice(0, n);
}

function nearest(lab: Lab, set: Lab[]): number {
  let best = 0, bd = Infinity;
  for (let i = 0; i < set.length; i++) {
    const d = dist2(lab, set[i]);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

export async function loadSourceImage(file: Blob): Promise<SourceImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(t('เปิดไฟล์รูปนี้ไม่ได้ (รองรับ PNG, JPG, WebP, GIF)', 'Could not open this image (PNG, JPG, WebP and GIF are supported)'));
  }
  // look at the image border to find a plain background colour
  const n = 48;
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, n, n);
  const d = ctx.getImageData(0, 0, n, n).data;
  let r = 0, g = 0, b = 0, cnt = 0, total = 0, clear = 0;
  const labs: Lab[] = [];
  for (let i = 0; i < n; i++) {
    for (const [x, y] of [[i, 0], [i, n - 1], [0, i], [n - 1, i]]) {
      const o = (y * n + x) * 4;
      total++;
      if (d[o + 3] < 128) { clear++; continue; }
      r += d[o]; g += d[o + 1]; b += d[o + 2]; cnt++;
      labs.push(rgbToLab(d[o], d[o + 1], d[o + 2]));
    }
  }
  let bg: Lab | null = null, bgHex: string | null = null;
  if (cnt > total * 0.5) {
    const avg = rgbToLab(r / cnt, g / cnt, b / cnt);
    const uniform = labs.filter((l) => dist2(l, avg) < 15 * 15).length / labs.length;
    if (uniform > 0.7) {
      bg = avg;
      bgHex = toHex(r / cnt, g / cnt, b / cnt);
    }
  }
  return {
    bitmap, width: bitmap.width, height: bitmap.height, bg, bgHex,
    hasAlpha: clear > total * 0.2,
    crop: subjectBox(bitmap, bg),
  };
}

/** Find the subject's bounding box: pixels that are opaque and not background. */
function subjectBox(bitmap: ImageBitmap, bg: Lab | null): SourceImage['crop'] {
  const full = { x: 0, y: 0, w: bitmap.width, h: bitmap.height };
  const k = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * k)), h = Math.max(1, Math.round(bitmap.height * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (d[o + 3] < 128) continue;
      if (bg && dist2(rgbToLab(d[o], d[o + 1], d[o + 2]), bg) < 20 * 20) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return full;
  const pad = 0; // crop tight: padding adds a background rim that blends into extra colours
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  return { x: x0 / k, y: y0 / k, w: (x1 - x0 + 1) / k, h: (y1 - y0 + 1) / k };
}

function kmeans(pts: Lab[], k: number): { centers: Lab[]; assign: Int32Array } {
  let seed = 1234567;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const centers: Lab[] = [[...pts[Math.floor(rnd() * pts.length)]] as Lab];
  const d2 = new Float64Array(pts.length).fill(Infinity);
  // k-means++ seeding keeps small but distinct colours (eyes, outlines)
  while (centers.length < k) {
    const c = centers[centers.length - 1];
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      d2[i] = Math.min(d2[i], dist2(pts[i], c));
      sum += d2[i];
    }
    if (sum < 1e-9) break;
    let t = rnd() * sum, j = 0;
    for (; j < pts.length - 1; j++) {
      t -= d2[j];
      if (t <= 0) break;
    }
    centers.push([...pts[j]] as Lab);
  }
  const assign = new Int32Array(pts.length).fill(-1);
  for (let iter = 0; iter < 14; iter++) {
    let changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = nearest(pts[i], centers);
      if (a !== assign[i]) { assign[i] = a; changed = true; }
    }
    if (!changed) break;
    const acc = centers.map(() => [0, 0, 0, 0]);
    pts.forEach((p, i) => {
      const s = acc[assign[i]];
      s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    });
    acc.forEach((s, ci) => { if (s[3]) centers[ci] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  return { centers, assign };
}

/** Convert an image to stitches inside the pattern's stitchable holes. */
export function convertImage(src: SourceImage, p: Pattern, o: ImportOpts): ImportResult {
  const { cols, rows, mask } = p;
  let x0 = cols, y0 = rows, x1 = -1, y1 = -1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (mask[y * cols + x] !== '2') continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return { cells: p.cells.slice(), palette: p.palette, colorsUsed: 0, stitched: 0 };

  // place the image (contain-fit) inside the stitchable area
  const aw = x1 - x0 + 1, ah = y1 - y0 + 1;
  const cr = o.autoCrop ? src.crop : { x: 0, y: 0, w: src.width, h: src.height };
  const aspect = cr.w / cr.h;
  const dw = Math.min(aw, ah * aspect) * o.scale, dh = dw / aspect;
  const dx = x0 + aw / 2 + o.offsetX * aw - dw / 2;
  const dy = y0 + ah / 2 + o.offsetY * ah - dh / 2;
  const S = Math.max(1, Math.min(6, Math.floor(1200 / Math.max(cols, rows))));
  const c = document.createElement('canvas');
  c.width = cols * S;
  c.height = rows * S;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src.bitmap, cr.x, cr.y, cr.w, cr.h, dx * S, dy * S, dw * S, dh * S);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;

  // average each cell (alpha-weighted)
  const idx: number[] = [], labs: Lab[] = [];
  // individual pixels of the included cells: the palette comes from these, because a cell
  // that straddles an edge averages into a blend colour that is not really in the image
  const pixLab: Lab[] = [], pixRgb: Rgb[] = [];
  const pixStride = Math.max(1, Math.round((cols * rows * S * S) / 40000));
  let pixN = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (mask[i] !== '2' || (o.keepExisting && p.cells[i] >= 0)) continue;
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) {
        let off = ((y * S + sy) * c.width + x * S) * 4;
        for (let sx = 0; sx < S; sx++, off += 4) {
          const al = data[off + 3] / 255;
          r += data[off] * al; g += data[off + 1] * al; b += data[off + 2] * al; a += al;
        }
      }
      if (a < S * S * 0.5) continue;
      const rgb: Rgb = [r / a, g / a, b / a];
      const lab = rgbToLab(...rgb);
      if (o.skipBackground && src.bg && dist2(lab, src.bg) < o.bgTolerance ** 2) continue;
      idx.push(i); labs.push(lab);
      for (let sy = 0; sy < S; sy++) {
        let off = ((y * S + sy) * c.width + x * S) * 4;
        for (let sx = 0; sx < S; sx++, off += 4) {
          if (data[off + 3] < 128 || pixN++ % pixStride) continue;
          const pr: Rgb = [data[off], data[off + 1], data[off + 2]];
          const pl = rgbToLab(...pr);
          if (o.skipBackground && src.bg && dist2(pl, src.bg) < o.bgTolerance ** 2) continue;
          pixLab.push(pl); pixRgb.push(pr);
        }
      }
    }
  }

  // quantise -> local colour list + assignment
  const stashSet = new Set(o.stash ?? []);
  const stashIdx = o.paletteMode === 'stash' ? DMC_LIBRARY.map((d, i) => (stashSet.has(d.code) ? i : -1)).filter((i) => i >= 0) : [];
  let poorMatches = 0;
  let local: (Partial<ThreadColor> & { hex: string })[] = [];
  let fixedGlobal: number[] | null = null; // when mapping straight onto the current palette
  let assign: Int32Array;
  if (o.paletteMode === 'current' && p.palette.length) {
    const pl = p.palette.map((t) => hexToLab(t.hex));
    assign = Int32Array.from(labs, (l) => nearest(l, pl));
    fixedGlobal = p.palette.map((_, i) => i);
  } else if (labs.length) {
    const pts = pixLab.length ? pixLab : labs;
    const k = Math.max(1, Math.min(o.colors, pts.length));
    const km = kmeans(pts, k);
    // drop clusters that hold under 1% of the pixels (anti-aliased edges, specks):
    // with few real colours, k-means would otherwise spend the extra slots on blends
    const sizes = km.centers.map(() => 0);
    km.assign.forEach((a) => sizes[a]++);
    const minSize = Math.max(1, Math.round(pts.length * 0.01));
    let keep = km.centers.map((_, i) => i).filter((i) => sizes[i] >= minSize);
    if (!keep.length) keep = [sizes.indexOf(Math.max(...sizes))];
    const centers = keep.map((i) => km.centers[i]);
    if (o.paletteMode === 'exact') {
      const acc = centers.map(() => [0, 0, 0, 0]);
      const rgbSrc = pixLab.length ? pixRgb : null;
      pts.forEach((l, i) => {
        const s = acc[nearest(l, centers)];
        const v = rgbSrc ? rgbSrc[i] : null;
        if (v) { s[0] += v[0]; s[1] += v[1]; s[2] += v[2]; s[3]++; }
      });
      local = acc.map((s, ci) => {
        const hex = s[3] ? toHex(s[0] / s[3], s[1] / s[3], s[2] / s[3]) : labToHexApprox(centers[ci]);
        return { hex, name: t('สีจากรูป ', 'Image color ') + hex };
      });
      assign = Int32Array.from(labs, (l) => nearest(l, centers));
    } else if (o.paletteMode === 'stash' && stashIdx.length) {
      // snap each cluster centre to the closest owned thread; for the worst-matched centres,
      // optionally allow a few new threads (closest DMC overall) instead
      const own = stashIdx.map((d) => DMC_LAB[d]);
      const POOR = 12 ** 2; // CIE76 distance that clearly reads as a different colour
      const picks = centers.map((ce) => { const k = nearest(ce, own); return { d: stashIdx[k], err: dist2(ce, own[k]), ce }; });
      let extra = o.stashExtra ?? 0;
      for (const pk of [...picks].sort((a, b) => b.err - a.err)) {
        if (pk.err < POOR) break;
        if (extra > 0) { pk.d = nearest(pk.ce, DMC_LAB); pk.err = 0; extra--; } else poorMatches++;
      }
      const chosen = [...new Set(picks.map((pk) => pk.d))];
      const chosenLab = chosen.map((d) => DMC_LAB[d]);
      local = chosen.map((d) => ({ hex: DMC_LIBRARY[d].hex, name: DMC_LIBRARY[d].name, code: DMC_LIBRARY[d].code, brand: 'DMC' }));
      assign = Int32Array.from(labs, (l) => nearest(l, chosenLab));
    } else {
      // snap cluster centres to real DMC threads, then re-assign every cell to the closest chosen thread
      const chosen = [...new Set(centers.map((ce) => nearest(ce, DMC_LAB)))];
      const chosenLab = chosen.map((d) => DMC_LAB[d]);
      local = chosen.map((d) => ({ hex: DMC_LIBRARY[d].hex, name: DMC_LIBRARY[d].name, code: DMC_LIBRARY[d].code, brand: 'DMC' }));
      assign = Int32Array.from(labs, (l) => nearest(l, chosenLab));
    }
  } else {
    assign = new Int32Array(0);
  }

  // lone-stitch cleanup on a grid of local values
  const val = new Int32Array(cols * rows).fill(-1);
  idx.forEach((ci, k) => { val[ci] = assign[k]; });
  if (o.cleanup) {
    const next = val.slice();
    for (const ci of idx) {
      const x = ci % cols, y = (ci / cols) | 0;
      const nb: number[] = [];
      if (x > 0) nb.push(val[ci - 1]);
      if (x < cols - 1) nb.push(val[ci + 1]);
      if (y > 0) nb.push(val[ci - cols]);
      if (y < rows - 1) nb.push(val[ci + cols]);
      if (nb.includes(val[ci])) continue;
      const counts = new Map<number, number>();
      for (const v of nb) if (v >= 0) counts.set(v, (counts.get(v) ?? 0) + 1);
      for (const [v, n] of counts) if (n >= 3) next[ci] = v;
    }
    val.set(next);
  }

  // merge into the pattern palette
  let palette = [...p.palette];
  const toGlobal = fixedGlobal ?? local.map((t) => {
    const hit = palette.findIndex((e) =>
      t.code ? e.code === t.code && e.brand === t.brand : !e.code && e.hex.toLowerCase() === t.hex.toLowerCase());
    if (hit >= 0) return hit;
    palette.push(makeThread(t, palette));
    return palette.length - 1;
  });

  let cells = p.cells.slice();
  if (!o.keepExisting) for (let i = 0; i < cells.length; i++) if (mask[i] === '2') cells[i] = -1;
  for (const ci of idx) cells[ci] = val[ci] >= 0 ? toGlobal[val[ci]] : -1;

  if (o.pruneUnused) {
    const used = new Set(cells.filter((v) => v >= 0));
    const remap = new Map<number, number>();
    const kept: ThreadColor[] = [];
    palette.forEach((t, i) => {
      if (used.has(i)) { remap.set(i, kept.length); kept.push(t); }
    });
    if (kept.length) {
      palette = kept;
      cells = cells.map((v) => (v >= 0 ? remap.get(v)! : v));
    }
  }

  const usedNow = new Set(cells.filter((v, i) => v >= 0 && mask[i] === '2'));
  return { cells, palette, colorsUsed: usedNow.size, stitched: cells.filter((v, i) => v >= 0 && mask[i] === '2').length, poorMatches };
}
