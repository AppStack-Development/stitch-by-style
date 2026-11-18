import type { Pattern, Progress } from '../types';
import { t } from './i18n';

export function emptyProgress(n: number): Progress {
  return { done: '0'.repeat(n), seconds: 0, daily: {}, updatedAt: Date.now() };
}

export function getProgress(p: Pattern): Progress {
  return p.progress && p.progress.done.length === p.cols * p.rows ? p.progress : emptyProgress(p.cols * p.rows);
}

/** A cell that has a stitch to make. */
export const isStitch = (p: Pattern, i: number) => p.mask[i] === '2' && p.cells[i] >= 0 && p.cells[i] < p.palette.length;

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface ColorProgress {
  index: number;
  total: number;
  done: number;
}

export interface ProgressStats {
  total: number;
  done: number;
  pct: number;
  perColor: ColorProgress[];
  today: number;
  /** stitches per hour from timed sessions, if enough data */
  rate: number | null;
  /** estimated seconds left at that rate */
  etaSeconds: number | null;
}

export function computeProgress(p: Pattern, pr = getProgress(p)): ProgressStats {
  const perColor = p.palette.map((_, index) => ({ index, total: 0, done: 0 }));
  let total = 0, done = 0;
  for (let i = 0; i < p.cells.length; i++) {
    if (!isStitch(p, i)) continue;
    const c = perColor[p.cells[i]];
    c.total++;
    total++;
    if (pr.done.charCodeAt(i) === 49) { c.done++; done++; }
  }
  const rate = pr.seconds >= 300 && done > 0 ? (done / pr.seconds) * 3600 : null;
  return {
    total,
    done,
    pct: total ? (done / total) * 100 : 0,
    perColor,
    today: Math.max(0, pr.daily[todayKey()] ?? 0),
    rate,
    etaSeconds: rate ? ((total - done) / rate) * 3600 : null,
  };
}

/** Set cells to done/undone. Only real stitches change; the day's tally moves by the net change. */
export function markCells(p: Pattern, pr: Progress, idx: number[], value: boolean): { progress: Progress; changed: number } {
  const arr = pr.done.split('');
  const ch = value ? '1' : '0';
  let changed = 0;
  for (const i of idx) {
    if (i < 0 || i >= arr.length || !isStitch(p, i) || arr[i] === ch) continue;
    arr[i] = ch;
    changed++;
  }
  if (!changed) return { progress: pr, changed: 0 };
  const key = todayKey();
  const daily = { ...pr.daily, [key]: (pr.daily[key] ?? 0) + (value ? changed : -changed) };
  return { progress: { ...pr, done: arr.join(''), daily, updatedAt: Date.now() }, changed };
}

/** Connected cells (4-neighbour) with the same thread colour as `start`. */
export function regionOf(p: Pattern, start: number): number[] {
  if (!isStitch(p, start)) return [];
  const color = p.cells[start];
  const seen = new Uint8Array(p.cells.length);
  const out: number[] = [];
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    out.push(i);
    const x = i % p.cols, y = (i / p.cols) | 0;
    const nb = [x > 0 ? i - 1 : -1, x < p.cols - 1 ? i + 1 : -1, y > 0 ? i - p.cols : -1, y < p.rows - 1 ? i + p.cols : -1];
    for (const j of nb) {
      if (j >= 0 && !seen[j] && isStitch(p, j) && p.cells[j] === color) {
        seen[j] = 1;
        stack.push(j);
      }
    }
  }
  return out;
}

/** All stitches of one thread colour. */
export function cellsOfColor(p: Pattern, color: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < p.cells.length; i++) if (isStitch(p, i) && p.cells[i] === color) out.push(i);
  return out;
}

/**
 * After the design changes, a cell whose thread changed is no longer "done".
 * Returns the pattern unchanged when there is no progress or nothing to clear.
 */
export function reconcileProgress(p: Pattern, prevCells: number[]): Pattern {
  if (!p.progress || p.progress.done.length !== p.cells.length) return p;
  let arr: string[] | null = null;
  for (let i = 0; i < p.cells.length; i++) {
    if (p.cells[i] !== prevCells[i] && p.progress.done.charCodeAt(i) === 49) {
      arr ??= p.progress.done.split('');
      arr[i] = '0';
    }
  }
  return arr ? { ...p, progress: { ...p.progress, done: arr.join(''), updatedAt: Date.now() } } : p;
}

export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h) return t(`${h} ชม. ${m} นาที`, `${h} h ${m} min`);
  if (m) return t(`${m} นาที`, `${m} min`);
  return t(`${s} วินาที`, `${s} s`);
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = String(m).padStart(2, '0'), ss = String(r).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Same grid, holes, stitches and thread colours: progress from one can be merged into the other. */
export function sameDesign(a: Pattern, b: Pattern): boolean {
  if (a.cols !== b.cols || a.rows !== b.rows || a.mask !== b.mask) return false;
  if (a.palette.length !== b.palette.length || a.palette.some((t, i) => t.hex !== b.palette[i].hex)) return false;
  for (let i = 0; i < a.cells.length; i++) if (a.cells[i] !== b.cells[i]) return false;
  return true;
}

/**
 * Combine progress recorded on two devices: a stitch done on either counts as done,
 * and timer/daily tallies keep the larger value (they were counted on one device or the other).
 */
export function mergeProgress(a: Progress | undefined, b: Progress | undefined): Progress | undefined {
  if (!a) return b;
  if (!b || a.done.length !== b.done.length) return a;
  let done = '';
  for (let i = 0; i < a.done.length; i++) done += a.done.charCodeAt(i) === 49 || b.done.charCodeAt(i) === 49 ? '1' : '0';
  const daily: Record<string, number> = { ...a.daily };
  for (const [k, v] of Object.entries(b.daily)) daily[k] = Math.max(daily[k] ?? 0, v);
  return { done, seconds: Math.max(a.seconds, b.seconds), daily, updatedAt: Date.now() };
}
