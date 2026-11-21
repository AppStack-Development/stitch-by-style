import type { Pattern } from '../types';
import { deletePattern, loadPattern, savePattern } from './storage';

/**
 * Drafts: patterns someone is only trying (a sample, a community pattern) that aren't in "My patterns"
 * yet. They live in this tab's sessionStorage, so a reload keeps them but nothing is saved or synced
 * until the person shows they want it: the first stitch or edit, or the Save button.
 *
 * "declined" means they tapped "Don't keep" after the automatic save; the draft then stays a draft
 * until they save it themselves.
 */
const KEY = 'sbs:draft:';

interface Stored { p: Pattern; declined?: boolean }

function read(id: string): Stored | null {
  try {
    const raw = sessionStorage.getItem(KEY + id);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function write(s: Stored) {
  try { sessionStorage.setItem(KEY + s.p.id, JSON.stringify(s)); } catch { /* tab storage full: the draft just won't survive a reload */ }
}

export function putDraft(p: Pattern, opts: { declined?: boolean } = {}) {
  write({ p, declined: opts.declined ?? read(p.id)?.declined });
}

export function dropDraft(id: string) {
  try { sessionStorage.removeItem(KEY + id); } catch { /* nothing to drop */ }
}

/** A draft in this tab matching the test (e.g. the same sample opened again). */
export function findDraft(test: (p: Pattern) => boolean): Pattern | null {
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k?.startsWith(KEY)) continue;
      const s = read(k.slice(KEY.length));
      if (s && !loadPattern(s.p.id) && test(s.p)) return s.p;
    }
  } catch { /* no tab storage */ }
  return null;
}

export type DraftState = 'saved' | 'draft' | 'declined';

export function draftState(id: string): DraftState {
  if (loadPattern(id)) return 'saved';
  const s = read(id);
  return !s ? 'saved' : s.declined ? 'declined' : 'draft';
}

/** A pattern by id, whether saved or only a draft in this tab. */
export function openPattern(id: string): Pattern | null {
  return loadPattern(id) ?? read(id)?.p ?? null;
}

/**
 * Store a pattern after a change. A saved pattern is saved as usual. A draft is saved into "My patterns"
 * when the change shows intent (unless they declined), otherwise it stays a draft.
 * 'saved-now' tells the page to say so, with a way to undo.
 */
export function persist(p: Pattern, intent: boolean): 'saved' | 'saved-now' | 'draft' | 'error' {
  const s = read(p.id);
  if (!s || loadPattern(p.id)) {
    if (s) dropDraft(p.id);
    return savePattern(p) ? 'saved' : 'error';
  }
  if (intent && !s.declined) {
    if (!savePattern(p)) return 'error';
    dropDraft(p.id);
    return 'saved-now';
  }
  putDraft(p);
  return 'draft';
}

/** The Save button: into "My patterns" now, declined or not. */
export function saveDraft(p: Pattern): boolean {
  if (!savePattern(p)) return false;
  dropDraft(p.id);
  return true;
}

/** "Don't keep": take it back out of "My patterns" and keep working on it as a draft. */
export function unkeep(p: Pattern) {
  deletePattern(p.id);
  putDraft(p, { declined: true });
}
