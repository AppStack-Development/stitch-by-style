import { needleHint } from '../lib/stats';

/**
 * Needle size / strand count the app suggests for a hole pitch, as concrete values.
 * Mirrors the ranges written out by `needleHint()` in lib/stats.ts.
 */
export interface NeedleSuggestion {
  /** needle sizes that count as "suggested" */
  sizes: string[];
  /** the one to fill in when the user asks for the suggested value */
  size: string;
  /** inclusive strand range that counts as "suggested" */
  strands: [number, number];
  /** the strand count to fill in */
  strand: number;
  /** human-readable reason (the hint text) */
  reason: string;
}

export function suggestNeedle(pitchMm: number): NeedleSuggestion {
  const reason = needleHint(pitchMm);
  if (pitchMm >= 3.2) return { sizes: ['#18', '#20'], size: '#20', strands: [6, 6], strand: 6, reason };
  if (pitchMm >= 2.4) return { sizes: ['#22'], size: '#22', strands: [4, 6], strand: 4, reason };
  if (pitchMm >= 1.75) return { sizes: ['#24'], size: '#24', strands: [2, 3], strand: 2, reason };
  if (pitchMm >= 1.5) return { sizes: ['#26'], size: '#26', strands: [2, 2], strand: 2, reason };
  return { sizes: ['#26', '#28'], size: '#26', strands: [1, 2], strand: 2, reason };
}

/** "24", "#24", " #24 " all mean the same needle */
export function sameNeedleSize(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().replace(/^#?\s*/, '#');
  return norm(a) === norm(b);
}
