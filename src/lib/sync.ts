import type { Pattern } from '../types';
import { client, cloudEnabled, deleteAccount, getCloud, onAuth, setCloud, signOut, type CloudUser } from './cloud';
import { deletePattern, listPatterns, loadPattern, savePattern, PATTERN_CHANGE } from './storage';
import { loadStash, saveStash, STASH_EVENT } from './stash';
import { normalizePattern } from './pattern';
import { mergeProgress, sameDesign } from './progress';
import { lang } from './i18n';
import { myCommunityData } from './community';

/**
 * Account sync, local-first: this device's localStorage stays the working copy and the account is a
 * mirror. A full reconcile (compare every pattern's last-edited time, newer wins; stitching progress
 * of the same design is combined) runs at sign-in, at startup and when the app comes back into view;
 * individual edits are pushed a moment after they are saved.
 *
 * Bookkeeping lives in localStorage 'sbs:sync':
 *   userId    – account this device last synced with (null = never / signed out with "remove")
 *   deleted   – ids deleted on this device that the account still has to hear about
 *   localOnly – ids the user chose to keep on this device only (never uploaded)
 *   merged    – the "add this device's patterns to your account?" question has been answered
 *   lastSync  – epoch ms of the last successful sync
 */
interface Meta {
  userId: string | null;
  deleted: string[];
  localOnly: string[];
  merged: boolean;
  lastSync: number | null;
}

const META_KEY = 'sbs:sync';
const PULLED = 'sbs:patterns-pulled';
export { PULLED as PATTERNS_PULLED };

function loadMeta(): Meta {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) || 'null');
    if (m && typeof m === 'object') {
      return { userId: m.userId ?? null, deleted: m.deleted ?? [], localOnly: m.localOnly ?? [], merged: !!m.merged, lastSync: m.lastSync ?? null };
    }
  } catch { /* fall through */ }
  return { userId: null, deleted: [], localOnly: [], merged: false, lastSync: null };
}
function saveMeta(m: Meta) {
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* storage full: sync still works this session */ }
}

let user: CloudUser | null = null;
const iso = (ms: number) => new Date(ms).toISOString();
const ms = (s: string) => new Date(s).getTime();
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

function ready(): boolean {
  return !!user && loadMeta().merged;
}

// ---------- push ----------

async function pushPatterns(ids: string[]) {
  if (!user || !ids.length) return;
  const c = await client();
  const m = loadMeta();
  const rows = ids.filter((id) => !m.localOnly.includes(id)).map((id) => {
    const p = loadPattern(id);
    return p
      ? { user_id: user!.id, id, data: p, deleted: false, updated_at: iso(p.updatedAt) }
      : { user_id: user!.id, id, data: null, deleted: true, updated_at: iso(Date.now()) };
  });
  for (const part of chunk(rows, 20)) {
    const { error } = await c.from('patterns').upsert(part, { onConflict: 'user_id,id' });
    if (error) throw error;
  }
  const sent = new Set(rows.filter((r) => r.deleted).map((r) => r.id));
  if (sent.size) saveMeta({ ...loadMeta(), deleted: loadMeta().deleted.filter((id) => !sent.has(id)) });
}

async function pushStash() {
  if (!user) return;
  const c = await client();
  const s = loadStash();
  const { error } = await c.from('stashes').upsert({ user_id: user.id, codes: s.codes, updated_at: iso(s.updatedAt || Date.now()) });
  if (error) throw error;
}

// ---------- full reconcile ----------

async function reconcile(opts: { unionStash?: boolean } = {}) {
  if (!user) return;
  const c = await client();
  const m = loadMeta();
  const uid = user.id;

  // patterns: compare last-edited times
  const { data: remote, error } = await c.from('patterns').select('id, updated_at, deleted').eq('user_id', uid);
  if (error) throw error;
  const local = new Map(listPatterns().filter((p) => !m.localOnly.includes(p.id)).map((p) => [p.id, p]));
  const toPull: string[] = [], toPush: string[] = [];
  const seen = new Set<string>();
  for (const r of remote ?? []) {
    seen.add(r.id);
    const lp = local.get(r.id);
    const rt = ms(r.updated_at);
    if (r.deleted) {
      if (lp && lp.updatedAt <= rt) deletePattern(r.id, { silent: true });
      else if (lp) toPush.push(r.id);
      continue;
    }
    if (!lp) {
      if (m.deleted.includes(r.id)) toPush.push(r.id); // deleted here while signed out
      else if (!m.localOnly.includes(r.id)) toPull.push(r.id);
      continue;
    }
    if (rt > lp.updatedAt) toPull.push(r.id);
    else if (lp.updatedAt > rt) toPush.push(r.id);
  }
  for (const id of local.keys()) if (!seen.has(id)) toPush.push(id);
  // tombstones the account never had are done; the rest go out with toPush
  saveMeta({ ...loadMeta(), deleted: loadMeta().deleted.filter((id) => seen.has(id) && toPush.includes(id)) });

  let pulled = 0;
  for (const part of chunk(toPull, 50)) {
    const { data, error: e2 } = await c.from('patterns').select('id, data').eq('user_id', uid).in('id', part);
    if (e2) throw e2;
    for (const row of data ?? []) {
      let incoming: Pattern;
      try { incoming = normalizePattern(row.data); } catch { continue; }
      const mine = loadPattern(row.id);
      if (mine && sameDesign(mine, incoming)) {
        // same stitches on both devices: keep everything marked on either one
        const progress = mergeProgress(mine.progress, incoming.progress);
        incoming = { ...incoming, progress };
        if (JSON.stringify(progress) !== JSON.stringify(row.data?.progress)) toPush.push(row.id);
      }
      savePattern(incoming, { silent: true });
      pulled++;
    }
  }
  await pushPatterns([...new Set(toPush)]);

  // thread stash
  const { data: st, error: e3 } = await c.from('stashes').select('codes, updated_at').eq('user_id', uid).maybeSingle();
  if (e3) throw e3;
  const mine = loadStash();
  if (opts.unionStash && st) {
    saveStash([...mine.codes, ...st.codes], { silent: true });
    await pushStash();
  } else if (st && ms(st.updated_at) > mine.updatedAt) {
    saveStash(st.codes, { at: ms(st.updated_at), silent: true });
  } else if ((!st && mine.codes.length) || (st && mine.updatedAt > ms(st.updated_at))) {
    await pushStash();
  }

  if (pulled) window.dispatchEvent(new Event(PULLED));
}

// ---------- running a sync ----------

let running: Promise<void> | null = null;
let again = false;

function run(opts: { unionStash?: boolean } = {}): Promise<void> {
  if (!ready()) return Promise.resolve();
  if (running) { again = true; return running; }
  setCloud({ sync: 'syncing', error: '' });
  running = (async () => {
    try {
      do {
        again = false;
        await reconcile(opts);
        opts = {};
      } while (again);
      const now = Date.now();
      saveMeta({ ...loadMeta(), lastSync: now });
      setCloud({ sync: 'idle', lastSync: now, error: '' });
    } catch (e) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      setCloud({ sync: offline ? 'offline' : 'error', error: offline ? '' : (e as Error).message || String(e) });
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Sync everything now (Account page button, app start, coming back into view). */
export function syncNow(): Promise<void> {
  return run();
}

// queue single edits and push them shortly after
const queue = new Set<string>();
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let stashTimer: ReturnType<typeof setTimeout> | null = null;

function onPatternChange(e: Event) {
  const { id, deleted } = (e as CustomEvent<{ id: string; deleted: boolean }>).detail;
  const m = loadMeta();
  if (deleted && m.userId && !m.localOnly.includes(id) && !m.deleted.includes(id)) saveMeta({ ...m, deleted: [...m.deleted, id] });
  if (!ready()) return;
  queue.add(id);
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    const ids = [...queue];
    queue.clear();
    setCloud({ sync: 'syncing' });
    try {
      await pushPatterns(ids);
      const now = Date.now();
      saveMeta({ ...loadMeta(), lastSync: now });
      setCloud({ sync: 'idle', lastSync: now, error: '' });
    } catch (err) {
      ids.forEach((i) => queue.add(i)); // retried with the next change or sync
      setCloud({ sync: navigator.onLine === false ? 'offline' : 'error', error: (err as Error).message });
    }
  }, 1500);
}

function onStashChange(e: Event) {
  if ((e as CustomEvent<{ silent?: boolean }>).detail?.silent || !ready()) return;
  if (stashTimer) clearTimeout(stashTimer);
  stashTimer = setTimeout(() => { pushStash().catch((err) => setCloud({ sync: 'error', error: (err as Error).message })); }, 1500);
}

async function saveProfile(u: CloudUser) {
  try {
    const c = await client();
    await c.from('profiles').upsert({ id: u.id, display_name: u.name, avatar_url: u.avatar, lang, updated_at: iso(Date.now()) });
  } catch { /* the profile is cosmetic; never block sync on it */ }
}

/** Answer to "add this device's patterns to your account?" (MergeDialog). */
export async function resolveMerge(choice: 'merge' | 'local-only') {
  if (!user) return;
  const m = loadMeta();
  const localIds = listPatterns().map((p) => p.id);
  saveMeta({ ...m, userId: user.id, merged: true, localOnly: choice === 'local-only' ? localIds : [], deleted: [] });
  setCloud({ askMerge: null });
  await run({ unionStash: choice === 'merge' });
}

/** Ids of this account's patterns stored on this device (everything except "this device only"). */
function syncedLocalIds(): string[] {
  const m = loadMeta();
  return listPatterns().map((p) => p.id).filter((id) => !m.localOnly.includes(id));
}

function clearAccountData() {
  for (const id of syncedLocalIds()) deletePattern(id, { silent: true });
  saveStash([], { at: 0, silent: true });
  saveMeta({ userId: null, deleted: [], localOnly: [], merged: false, lastSync: null });
  window.dispatchEvent(new Event(PULLED));
}

export async function signOutAndClear(clearLocal: boolean) {
  if (clearLocal) clearAccountData();
  await signOut();
}

export async function deleteMyAccount(clearLocal: boolean) {
  await deleteAccount();
  if (clearLocal) clearAccountData();
  else saveMeta({ userId: null, deleted: [], localOnly: [], merged: false, lastSync: null });
}

/** Everything the account holds, as one JSON file (data portability). */
export async function exportMyData(): Promise<Blob> {
  const c = await client();
  if (!user) throw new Error('not signed in');
  const [{ data: profile }, { data: patterns, error }, { data: stash }] = await Promise.all([
    c.from('profiles').select('display_name, avatar_url, lang, created_at, updated_at').eq('id', user.id).maybeSingle(),
    c.from('patterns').select('id, data, updated_at').eq('user_id', user.id).eq('deleted', false),
    c.from('stashes').select('codes, updated_at').eq('user_id', user.id).maybeSingle(),
  ]);
  if (error) throw error;
  const out = {
    app: 'Cross Stitch Lab',
    exportedAt: new Date().toISOString(),
    account: { email: user.email, name: user.name },
    profile,
    patterns: (patterns ?? []).map((r) => r.data),
    threads: stash?.codes ?? [],
    // public name and shared patterns (community gallery); null if those tables aren't reachable
    community: await myCommunityData().catch(() => null),
  };
  return new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
}

export async function accountCounts(): Promise<{ patterns: number; threads: number }> {
  const c = await client();
  if (!user) return { patterns: 0, threads: 0 };
  const [{ count }, { data: stash }] = await Promise.all([
    c.from('patterns').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('deleted', false),
    c.from('stashes').select('codes').eq('user_id', user.id).maybeSingle(),
  ]);
  return { patterns: count ?? 0, threads: stash?.codes?.length ?? 0 };
}

/** Wire sync to sign-in/out, local edits and the app coming back into view. Call once at startup. */
export function initSync() {
  if (!cloudEnabled) return;
  const m0 = loadMeta();
  if (m0.lastSync) setCloud({ lastSync: m0.lastSync });
  window.addEventListener(PATTERN_CHANGE, onPatternChange);
  window.addEventListener(STASH_EVENT, onStashChange);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  window.addEventListener('online', () => { syncNow(); });
  onAuth((u) => {
    user = u;
    if (!u) {
      setCloud({ sync: 'idle', askMerge: null });
      return;
    }
    saveProfile(u);
    const m = loadMeta();
    if (m.userId === u.id && m.merged) {
      syncNow();
      return;
    }
    // first sign-in on this device (or a different account): ask before uploading local patterns
    const localCount = listPatterns().length;
    if (localCount > 0) {
      saveMeta({ ...m, userId: u.id, merged: false });
      setCloud({ askMerge: { localCount } });
    } else {
      saveMeta({ userId: u.id, deleted: [], localOnly: [], merged: true, lastSync: null });
      run({ unionStash: true });
    }
  });
}

/** For debugging in the console. */
export const _syncDebug = { loadMeta, getCloud };
