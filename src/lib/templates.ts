import type { CellKind } from '../types';
import { t } from './i18n';

export interface TemplateResult {
  cols: number;
  rows: number;
  mask: string;
}

export interface TemplateDef {
  id: string;
  name: string;
  description: string;
  /** default size in cells (width, height) */
  w: number;
  h: number;
  min: number;
  max: number;
  lockAspect: boolean;
  build: (w: number, h: number) => TemplateResult;
}

type Inside = (u: number, v: number) => boolean;

interface ShapeOpts {
  border?: number;
  /** rows reserved above the shape for a keyring tab */
  top?: number;
  tab?: { R: number; r: number };
  /** cut-outs (cell units, centre coords) */
  cutouts?: { cx: number; cy: number; r: number }[];
  /** solid band rows at the top of the shape (e.g. bookmark head) */
  headRows?: number;
}

function pointInPoly(x: number, y: number, pts: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Build a mask from a shape predicate over normalised coords u,v in [-1,1]. */
export function shapeGrid(cols: number, rows: number, inside: Inside, opts: ShapeOpts = {}): TemplateResult {
  const border = opts.border ?? 1;
  const top = opts.top ?? 0;
  const sh = rows - top;
  const inMask = new Uint8Array(cols * rows);
  for (let y = top; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const u = ((x + 0.5) / cols) * 2 - 1;
      const v = ((y - top + 0.5) / sh) * 2 - 1;
      if (inside(u, v)) inMask[y * cols + x] = 1;
    }
  }
  // Chebyshev distance to the outside, so the frame is `border` cells thick
  const dist = new Int32Array(cols * rows).fill(1e9);
  const queue: number[] = [];
  for (let i = 0; i < cols * rows; i++) {
    if (!inMask[i]) {
      dist[i] = 0;
      queue.push(i);
    }
  }
  // the grid edge counts as outside
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (inMask[i] && (x === 0 || y === 0 || x === cols - 1 || y === rows - 1)) {
        dist[i] = 1;
        queue.push(i);
      }
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const x = i % cols, y = (i / cols) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const j = ny * cols + nx;
        if (dist[j] > dist[i] + 1) {
          dist[j] = dist[i] + 1;
          queue.push(j);
        }
      }
    }
  }
  const out: CellKind[] = new Array(cols * rows).fill('0');
  for (let i = 0; i < out.length; i++) {
    if (!inMask[i]) continue;
    out[i] = dist[i] <= border ? '1' : '2';
  }
  if (opts.headRows) {
    for (let x = 0; x < cols; x++) {
      let seen = 0;
      for (let y = 0; y < rows && seen < opts.headRows; y++) {
        const i = y * cols + x;
        if (out[i] !== '0') {
          out[i] = '1';
          seen++;
        }
      }
    }
  }
  if (opts.tab) {
    const cx = cols / 2, cy = opts.tab.R;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= opts.tab.R && out[y * cols + x] !== '2') out[y * cols + x] = '1';
      }
    }
  }
  const cuts = [...(opts.cutouts ?? [])];
  if (opts.tab) cuts.push({ cx: cols / 2, cy: opts.tab.R, r: opts.tab.r });
  for (const c of cuts) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (Math.hypot(x + 0.5 - c.cx, y + 0.5 - c.cy) <= c.r) out[y * cols + x] = '0';
      }
    }
  }
  return { cols, rows, mask: out.join('') };
}

const roundRect = (rx: number, ry: number, r: number): Inside => (u, v) => {
  const ax = Math.abs(u), ay = Math.abs(v);
  if (ax > rx || ay > ry) return false;
  const dx = ax - (rx - r), dy = ay - (ry - r);
  if (dx > 0 && dy > 0) return dx * dx + dy * dy <= r * r;
  return true;
};

const circle: Inside = (u, v) => u * u + v * v <= 1;

const heart: Inside = (u, v) => {
  const x = u * 1.18;
  const y = 0.12 - v * 1.15;
  const a = x * x + y * y - 1;
  return a * a * a - x * x * y * y * y <= 0;
};

function starPts(n: number, inner: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? 1 : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    pts.push([Math.cos(a) * r, Math.sin(a) * r + 0.08]);
  }
  return pts;
}
const STAR = starPts(5, 0.48);
const star: Inside = (u, v) => pointInPoly(u, v, STAR);

const HEX: [number, number][] = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i;
  return [Math.cos(a), Math.sin(a)] as [number, number];
});
const hexagon: Inside = (u, v) => pointInPoly(u, v * 0.88, HEX);

const tabFor = (w: number) => {
  const R = Math.max(2.2, Math.round(w * 0.14));
  return { R, r: Math.max(1, R * 0.48) };
};

/** Template names in both languages. A pattern stores the name in the language it was made in. */
const TEMPLATE_NAMES: [string, string][] = [
  ['ที่คั่นหนังสือ', 'Bookmark'],
  ['ที่รองแก้วกลม', 'Round coaster'],
  ['ที่รองแก้วสี่เหลี่ยม', 'Square coaster'],
  ['พวงกุญแจหัวใจ', 'Heart keychain'],
  ['พวงกุญแจกลม', 'Round keychain'],
  ['ดาวแขวนตกแต่ง', 'Star ornament'],
  ['เข็มกลัดหกเหลี่ยม', 'Hexagon badge'],
  ['การ์ด / แพตช์', 'Card / patch'],
];

/**
 * A stored template name shown in the current language: a built-in template's name is translated, anything
 * else (an imported STL/3MF file name) is shown as is.
 */
export function templateLabel(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  const pair = TEMPLATE_NAMES.find(([th, en]) => th === name || en === name);
  return pair ? t(pair[0], pair[1]) : name;
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'bookmark',
    name: t('ที่คั่นหนังสือ', 'Bookmark'),
    description: t('แผ่นยาว มีรูร้อยพู่ด้านบน', 'Long strip with a tassel hole at the top'),
    w: 12, h: 40, min: 8, max: 30, lockAspect: false,
    build: (w, h) =>
      shapeGrid(w, h, roundRect(1, 1, 0.25), {
        headRows: 4,
        cutouts: [{ cx: w / 2, cy: 2.5, r: Math.max(0.9, w * 0.08) }],
      }),
  },
  {
    id: 'coaster-round',
    name: t('ที่รองแก้วกลม', 'Round coaster'),
    description: t('วงกลม ขอบหนา 1 ช่อง', 'Circle with a 1-cell rim'),
    w: 30, h: 30, min: 12, max: 70, lockAspect: true,
    build: (w, h) => shapeGrid(w, h, circle),
  },
  {
    id: 'coaster-square',
    name: t('ที่รองแก้วสี่เหลี่ยม', 'Square coaster'),
    description: t('สี่เหลี่ยมมุมมน', 'Rounded square'),
    w: 30, h: 30, min: 10, max: 70, lockAspect: false,
    build: (w, h) => shapeGrid(w, h, roundRect(1, 1, 0.2)),
  },
  {
    id: 'keychain-heart',
    name: t('พวงกุญแจหัวใจ', 'Heart keychain'),
    description: t('หัวใจ พร้อมห่วงร้อยพวงกุญแจ', 'Heart with a keyring loop'),
    w: 22, h: 24, min: 12, max: 50, lockAspect: true,
    build: (w, h) => {
      const tab = tabFor(w);
      return shapeGrid(w, h, heart, { top: Math.round(tab.R * 1.25), tab });
    },
  },
  {
    id: 'keychain-round',
    name: t('พวงกุญแจกลม', 'Round keychain'),
    description: t('วงกลม พร้อมห่วงด้านบน', 'Circle with a loop on top'),
    w: 20, h: 23, min: 10, max: 50, lockAspect: true,
    build: (w, h) => {
      const tab = tabFor(w);
      return shapeGrid(w, h, circle, { top: Math.round(tab.R * 1.25), tab });
    },
  },
  {
    id: 'ornament-star',
    name: t('ดาวแขวนตกแต่ง', 'Star ornament'),
    description: t('ดาว 5 แฉก พร้อมห่วงแขวน', '5-point star with a hanging loop'),
    w: 28, h: 31, min: 16, max: 60, lockAspect: true,
    build: (w, h) => {
      const tab = tabFor(w);
      return shapeGrid(w, h, star, { top: Math.round(tab.R * 1.1), tab });
    },
  },
  {
    id: 'badge-hex',
    name: t('เข็มกลัดหกเหลี่ยม', 'Hexagon badge'),
    description: t('หกเหลี่ยม ใช้ทำเข็มกลัด/แม่เหล็ก', 'Hexagon for a pin or magnet'),
    w: 24, h: 22, min: 10, max: 60, lockAspect: true,
    build: (w, h) => shapeGrid(w, h, hexagon),
  },
  {
    id: 'patch-card',
    name: t('การ์ด / แพตช์', 'Card / patch'),
    description: t('สี่เหลี่ยมผืนผ้า ขอบ 2 ช่อง', 'Rectangle with a 2-cell rim'),
    w: 24, h: 32, min: 8, max: 80, lockAspect: false,
    build: (w, h) => shapeGrid(w, h, roundRect(1, 1, 0.08), { border: 2 }),
  },
];

export function freeMask(cols: number, rows: number): string {
  return '2'.repeat(cols * rows);
}
