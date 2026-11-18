/** A 1-bit image in cells. */
export interface Bitmap {
  w: number;
  h: number;
  bits: Uint8Array; // 1 = stitch
}

/*
 * 5x7 pixel font (blank columns are trimmed per glyph, so narrow letters stay narrow).
 * Rows are top to bottom; '#' = stitch.
 */
const G: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '.#', '#.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '-': ['...', '...', '...', '###', '...', '...', '...'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  ':': ['.', '#', '.', '.', '.', '#', '.'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
  '♥': ['.....', '.#.#.', '#####', '#####', '.###.', '..#..', '.....'],
  '★': ['..#..', '..#..', '#####', '.###.', '.#.#.', '#...#', '.....'],
};
const GLYPH_H = 7;

/** Characters the pixel font can draw (lower case is drawn as upper case). */
export function pixelUnsupported(text: string): string[] {
  const bad = new Set<string>();
  for (const ch of text.toUpperCase()) if (ch !== ' ' && ch !== '\n' && !G[ch]) bad.add(ch);
  return [...bad];
}

function glyph(ch: string): string[] | null {
  if (ch === ' ') return ['...', '...', '...', '...', '...', '...', '...'];
  const g = G[ch.toUpperCase()];
  if (!g) return null;
  // trim blank columns on both sides
  const w = g[0].length;
  let l = 0, r = w - 1;
  while (l < r && g.every((row) => row[l] === '.')) l++;
  while (r > l && g.every((row) => row[r] === '.')) r--;
  return g.map((row) => row.slice(l, r + 1));
}

export function pixelText(text: string, scale = 1, spacing = 1): Bitmap {
  const lines = text.split('\n').map((line) => [...line].map(glyph).filter((g): g is string[] => !!g));
  const rendered = lines.filter((l) => l.length);
  if (!rendered.length) return { w: 0, h: 0, bits: new Uint8Array(0) };
  const lineW = (l: string[][]) => l.reduce((s, g) => s + g[0].length, 0) + spacing * (l.length - 1);
  const lineGap = 2;
  const w0 = Math.max(...rendered.map(lineW));
  const h0 = rendered.length * GLYPH_H + (rendered.length - 1) * lineGap;
  const base = new Uint8Array(w0 * h0);
  rendered.forEach((l, li) => {
    let x = Math.floor((w0 - lineW(l)) / 2); // centre each line
    const y0 = li * (GLYPH_H + lineGap);
    for (const g of l) {
      for (let y = 0; y < GLYPH_H; y++) {
        for (let gx = 0; gx < g[y].length; gx++) if (g[y][gx] === '#') base[(y0 + y) * w0 + x + gx] = 1;
      }
      x += g[0].length + spacing;
    }
  });
  if (scale === 1) return { w: w0, h: h0, bits: base };
  const w = w0 * scale, h = h0 * scale, bits = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) bits[y * w + x] = base[((y / scale) | 0) * w0 + ((x / scale) | 0)];
  return { w, h, bits };
}

export interface FontTextOpts {
  /** total height of the text in cells */
  height: number;
  bold: boolean;
  /** 0..1: share of a cell that must be inked for it to become a stitch */
  threshold: number;
}

const FONT = '"IBM Plex Sans Thai", system-ui, sans-serif';

/** Render text with a real font (Thai included) and sample it down to cells. */
export async function fontText(text: string, o: FontTextOpts): Promise<Bitmap> {
  const lines = text.split('\n').filter((l) => l.trim());
  if (!lines.length) return { w: 0, h: 0, bits: new Uint8Array(0) };
  const weight = o.bold ? 700 : 500;
  const px = 120;
  try {
    await document.fonts.load(`${weight} ${px}px "IBM Plex Sans Thai"`, text);
  } catch {
    /* fall back to whatever font is available */
  }
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = `${weight} ${px}px ${FONT}`;
  const lineH = px * 1.6;
  const W = Math.ceil(Math.max(...lines.map((l) => probe.measureText(l).width))) + px;
  const H = Math.ceil(lineH * lines.length + px);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.font = `${weight} ${px}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, px * 1.15 + i * lineH));
  const a = ctx.getImageData(0, 0, W, H).data;
  // tight ink box (Thai vowels and tone marks above/below are included)
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (a[(y * W + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return { w: 0, h: 0, bits: new Uint8Array(0) };
  const inkW = x1 - x0 + 1, inkH = y1 - y0 + 1;
  const h = Math.max(1, Math.round(o.height));
  const k = h / inkH; // cells per source pixel
  const w = Math.max(1, Math.round(inkW * k));
  const bits = new Uint8Array(w * h);
  const SS = 4; // sub-samples per axis per cell
  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      let ink = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const x = Math.min(W - 1, Math.floor(x0 + ((cx + (sx + 0.5) / SS) / w) * inkW));
        const y = Math.min(H - 1, Math.floor(y0 + ((cy + (sy + 0.5) / SS) / h) * inkH));
        ink += a[(y * W + x) * 4 + 3] / 255;
      }
      if (ink / (SS * SS) >= o.threshold) bits[cy * w + cx] = 1;
    }
  }
  return { w, h, bits };
}

/** Bounding box of stitchable cells, for centring text on the piece. */
export function stitchArea(mask: string, cols: number, rows: number) {
  let x0 = cols, y0 = rows, x1 = -1, y1 = -1;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (mask[y * cols + x] !== '2') continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? { x0: 0, y0: 0, x1: cols - 1, y1: rows - 1 } : { x0, y0, x1, y1 };
}

/** Stamp the bitmap at (ox, oy). Returns new cells and how many text cells missed a stitch hole. */
export function stamp(cells: number[], mask: string, cols: number, rows: number, b: Bitmap, ox: number, oy: number, color: number) {
  const out = cells.slice();
  let placed = 0, missed = 0;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    if (!b.bits[y * b.w + x]) continue;
    const gx = ox + x, gy = oy + y;
    const i = gy * cols + gx;
    if (gx < 0 || gy < 0 || gx >= cols || gy >= rows || mask[i] !== '2') { missed++; continue; }
    out[i] = color;
    placed++;
  }
  return { cells: out, placed, missed };
}
