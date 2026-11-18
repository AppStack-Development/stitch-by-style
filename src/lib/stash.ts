import { useEffect, useState } from 'react';
import type { Pattern, ThreadColor } from '../types';
import { computeStats } from './stats';

/**
 * "My threads": the DMC threads the user owns (have / don't have, no quantities).
 * Stored locally as { codes, updatedAt } so it can be synced to an account later.
 */
export interface Stash {
  /** DMC codes, e.g. "310", "B5200" */
  codes: string[];
  updatedAt: number;
}

const KEY = 'sbs:stash';
const EVENT = 'sbs:stash-change';

export function loadStash(): Stash {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (Array.isArray(s.codes)) return { codes: s.codes.filter((c: unknown) => typeof c === 'string'), updatedAt: +s.updatedAt || 0 };
    }
  } catch { /* storage blocked or corrupted: start empty */ }
  return { codes: [], updatedAt: 0 };
}

export function saveStash(codes: Iterable<string>): boolean {
  const s: Stash = { codes: [...new Set(codes)].sort(), updatedAt: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(EVENT));
  return true;
}

/** Is this palette thread one the user owns? Only DMC threads (or unbranded ones with a DMC code) can match. */
export function ownsThread(codes: Set<string>, t: Pick<ThreadColor, 'brand' | 'code'>): boolean {
  return !!t.code && (!t.brand || t.brand.toUpperCase() === 'DMC') && codes.has(t.code);
}

/** Live view of the stash; updates when it changes in this tab or another one. */
export function useStash() {
  const [codes, setCodes] = useState(() => new Set(loadStash().codes));
  useEffect(() => {
    const sync = () => setCodes(new Set(loadStash().codes));
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) sync(); };
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', onStorage); };
  }, []);
  const write = (next: Set<string>) => { setCodes(next); saveStash(next); };
  return {
    codes,
    has: (code: string) => codes.has(code),
    toggle: (code: string) => { const n = new Set(codes); if (n.has(code)) n.delete(code); else n.add(code); write(n); },
    add: (list: string[]) => write(new Set([...codes, ...list])),
    remove: (code: string) => { const n = new Set(codes); n.delete(code); write(n); },
    replace: (list: string[]) => write(new Set(list)),
  };
}

export interface ThreadNeed {
  thread: ThreadColor;
  stitches: number;
  skeins: number;
  have: boolean;
}

/** The threads a pattern uses, split into ones the user owns and ones to buy. */
export function threadNeeds(p: Pattern, codes: Set<string>): { have: ThreadNeed[]; buy: ThreadNeed[] } {
  const st = computeStats(p);
  const all = st.colors
    .filter((c) => c.count > 0)
    .map((c) => {
      const thread = p.palette[c.index];
      return { thread, stitches: c.count, skeins: c.skeins, have: ownsThread(codes, thread) };
    });
  return { have: all.filter((n) => n.have), buy: all.filter((n) => !n.have) };
}

/** Plain-text shopping list for pasting into LINE / notes. */
export function shoppingListText(patternName: string, buy: ThreadNeed[], heading: string): string {
  const lines = buy.map((n) => {
    const id = [n.thread.brand, n.thread.code].filter(Boolean).join(' ') || n.thread.hex;
    return `• ${id} ${n.thread.name} × ${Math.max(1, Math.ceil(n.skeins))}`;
  });
  return [`${heading}: ${patternName}`, ...lines].join('\n');
}
