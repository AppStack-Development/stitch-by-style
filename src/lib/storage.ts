import type { Pattern } from '../types';
import { normalizePattern } from './pattern';

const PREFIX = 'sbs:p:';

export function listPatterns(): Pattern[] {
  const out: Pattern[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      try {
        out.push(normalizePattern(JSON.parse(localStorage.getItem(key)!)));
      } catch {
        /* skip corrupted entry */
      }
    }
  } catch {
    /* storage unavailable */
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadPattern(id: string): Pattern | null {
  try {
    const raw = localStorage.getItem(PREFIX + id);
    return raw ? normalizePattern(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Fired on window after a local save/delete, so the account sync can push it. Detail: { id, deleted }. */
export const PATTERN_CHANGE = 'sbs:pattern-change';

/**
 * Returns false when storage is full or unavailable.
 * `silent` is for writes that come from the account sync itself (they must not be pushed back).
 */
export function savePattern(p: Pattern, opts: { silent?: boolean } = {}): boolean {
  try {
    localStorage.setItem(PREFIX + p.id, JSON.stringify(p));
  } catch {
    return false;
  }
  if (!opts.silent) window.dispatchEvent(new CustomEvent(PATTERN_CHANGE, { detail: { id: p.id, deleted: false } }));
  return true;
}

export function deletePattern(id: string, opts: { silent?: boolean } = {}) {
  try {
    localStorage.removeItem(PREFIX + id);
  } catch {
    return;
  }
  if (!opts.silent) window.dispatchEvent(new CustomEvent(PATTERN_CHANGE, { detail: { id, deleted: true } }));
}
