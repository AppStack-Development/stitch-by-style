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

/** Returns false when storage is full or unavailable. */
export function savePattern(p: Pattern): boolean {
  try {
    localStorage.setItem(PREFIX + p.id, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

export function deletePattern(id: string) {
  try {
    localStorage.removeItem(PREFIX + id);
  } catch {
    /* ignore */
  }
}
