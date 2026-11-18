import type { Pattern } from '../types';
import { t } from './i18n';

/** Single-strand metres in one standard 6-strand 8 m skein. */
const SKEIN_STRAND_M = 48;

const STITCH_FACTOR: Record<Pattern['details']['stitchType'], number> = {
  cross: 1,
  half: 0.5,
  tent: 0.6,
  fill: 1.25,
};

export interface ColorStat {
  index: number;
  count: number;
  /** estimated thread length (single strand, metres) */
  strandM: number;
  skeins: number;
}

export interface PatternStats {
  total: number;
  holes: number;
  colors: ColorStat[];
  widthMm: number;
  heightMm: number;
  /** bounding box of the stitched area, in cells */
  bbox: { x0: number; y0: number; x1: number; y1: number } | null;
  /** bounding box of the physical piece (non-empty cells) */
  piece: { x0: number; y0: number; x1: number; y1: number } | null;
}

export function computeStats(p: Pattern): PatternStats {
  const counts = new Array(p.palette.length).fill(0);
  let total = 0, holes = 0;
  let bx0 = Infinity, by0 = Infinity, bx1 = -1, by1 = -1;
  let px0 = Infinity, py0 = Infinity, px1 = -1, py1 = -1;
  for (let y = 0; y < p.rows; y++) {
    for (let x = 0; x < p.cols; x++) {
      const i = y * p.cols + x;
      const k = p.mask[i];
      if (k !== '0') {
        px0 = Math.min(px0, x); py0 = Math.min(py0, y);
        px1 = Math.max(px1, x); py1 = Math.max(py1, y);
      }
      if (k !== '2') continue;
      holes++;
      const c = p.cells[i];
      if (c >= 0 && c < counts.length) {
        counts[c]++;
        total++;
        bx0 = Math.min(bx0, x); by0 = Math.min(by0, y);
        bx1 = Math.max(bx1, x); by1 = Math.max(by1, y);
      }
    }
  }
  // front: 2 diagonals, back: 2 short travels, +20% for starting/finishing tails
  const perStitchMm = p.pitchMm * (2 * Math.SQRT2 + 2) * 1.2 * STITCH_FACTOR[p.details.stitchType];
  const strands = Math.max(1, p.details.strands);
  const colors = counts.map((count, index) => {
    const strandM = (count * perStitchMm * strands) / 1000;
    return { index, count, strandM, skeins: Math.ceil((strandM / SKEIN_STRAND_M) * 10) / 10 };
  });
  const piece = px1 >= 0 ? { x0: px0, y0: py0, x1: px1, y1: py1 } : null;
  const pw = piece ? piece.x1 - piece.x0 + 1 : p.cols;
  const ph = piece ? piece.y1 - piece.y0 + 1 : p.rows;
  return {
    total,
    holes,
    colors,
    widthMm: pw * p.pitchMm,
    heightMm: ph * p.pitchMm,
    bbox: bx1 >= 0 ? { x0: bx0, y0: by0, x1: bx1, y1: by1 } : null,
    piece,
  };
}

export function fmtMm(mm: number): string {
  return mm >= 100 ? `${(mm / 10).toFixed(1)} ${t('ซม.', 'cm')}` : `${mm.toFixed(1)} ${t('มม.', 'mm')}`;
}

export function fmtInch(mm: number): string {
  return `${(mm / 25.4).toFixed(2)}"`;
}

/** Practical needle / strand suggestion for a given hole pitch. */
export function needleHint(pitchMm: number): string {
  if (pitchMm >= 3.2) return t('แนะนำ: เข็ม Tapestry #18–20 หรือเข็มพลาสติก, ด้าย 6 เส้น/ไหมพรมเส้นเล็ก', 'Suggested: Tapestry needle #18–20 or a plastic needle, 6 strands or fine yarn');
  if (pitchMm >= 2.4) return t('แนะนำ: เข็ม Tapestry #22, ด้าย 4–6 เส้น', 'Suggested: Tapestry needle #22, 4–6 strands');
  if (pitchMm >= 1.75) return t('แนะนำ: เข็ม Tapestry #24, ด้าย 2–3 เส้น (เทียบ Aida 14ct)', 'Suggested: Tapestry needle #24, 2–3 strands (like Aida 14ct)');
  if (pitchMm >= 1.5) return t('แนะนำ: เข็ม Tapestry #26, ด้าย 2 เส้น (เทียบ Aida 16ct)', 'Suggested: Tapestry needle #26, 2 strands (like Aida 16ct)');
  return t('แนะนำ: เข็ม Tapestry #26–28, ด้าย 1–2 เส้น (เทียบ Aida 18ct ขึ้นไป)', 'Suggested: Tapestry needle #26–28, 1–2 strands (like Aida 18ct or finer)');
}
