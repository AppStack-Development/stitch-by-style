import { useSyncExternalStore } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Optional accounts (Supabase + Google sign-in).
 *
 * Everything here is off unless VITE_SUPABASE_URL and VITE_SUPABASE_KEY are set at build time, so the
 * app keeps working fully signed-out and offline. The Supabase library is loaded lazily, only when
 * accounts are configured.
 */
const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined;
export const cloudEnabled = !!(URL_ && KEY);

export interface CloudUser {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
}

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline';

export interface CloudState {
  /** 'off' = accounts not configured; 'loading' = checking for a saved session */
  status: 'off' | 'loading' | 'signed-out' | 'signed-in';
  user: CloudUser | null;
  sync: SyncState;
  /** epoch ms of the last successful sync */
  lastSync: number | null;
  error: string;
  /** set when this device has local patterns and must ask whether to add them to the account */
  askMerge: { localCount: number } | null;
}

let state: CloudState = {
  status: cloudEnabled ? 'loading' : 'off', user: null, sync: 'idle', lastSync: null, error: '', askMerge: null,
};
const listeners = new Set<() => void>();

export function getCloud(): CloudState {
  return state;
}
export function setCloud(patch: Partial<CloudState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
/** React hook: current account / sync state. */
export function useCloud(): CloudState {
  return useSyncExternalStore(subscribe, getCloud, getCloud);
}

let clientP: Promise<SupabaseClient> | null = null;
export function client(): Promise<SupabaseClient> {
  if (!cloudEnabled) return Promise.reject(new Error('accounts are not configured'));
  clientP ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL_!, KEY!, {
      auth: {
        // PKCE returns ?code=… in the query string, which does not clash with the #/ hash router
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'sbs:auth',
      },
    }),
  );
  return clientP;
}

const RETURN_KEY = 'sbs:auth-return';

/** Start Google sign-in. The page leaves for Google and comes back to the same route afterwards. */
export async function signInWithGoogle() {
  const c = await client();
  try { sessionStorage.setItem(RETURN_KEY, location.hash || '#/'); } catch { /* not critical */ }
  const { error } = await c.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;
}

export async function signOut() {
  const c = await client();
  await c.auth.signOut();
}

/** Permanently deletes the account and everything stored with it (server-side function). */
export async function deleteAccount() {
  const c = await client();
  const { error } = await c.rpc('delete_my_account');
  if (error) throw error;
  await c.auth.signOut({ scope: 'local' });
}

function toUser(u: { id: string; email?: string; user_metadata?: Record<string, unknown> }): CloudUser {
  const m = u.user_metadata ?? {};
  return {
    id: u.id,
    email: u.email ?? '',
    name: (m.full_name as string) || (m.name as string) || (u.email ?? '').split('@')[0],
    avatar: (m.avatar_url as string) || (m.picture as string) || null,
  };
}

type AuthListener = (user: CloudUser | null, event: string) => void;
const authListeners = new Set<AuthListener>();
/** The sync engine registers here to react to sign-in / sign-out. */
export function onAuth(l: AuthListener) {
  authListeners.add(l);
}

/** Called once at startup: restores a saved session and finishes a Google redirect. */
export async function initCloud() {
  if (!cloudEnabled) return;
  // read this before creating the client: supabase-js strips ?code=… from the URL while it signs in
  const returning = location.search.includes('code=') || location.search.includes('error=');
  const oauthError = new URLSearchParams(location.search).get('error_description');
  let c: SupabaseClient;
  try {
    c = await client();
  } catch (e) {
    setCloud({ status: 'signed-out', error: (e as Error).message });
    return;
  }
  c.auth.onAuthStateChange((event, session) => {
    const user = session?.user ? toUser(session.user) : null;
    const was = state.user?.id;
    // keep a sign-in error (e.g. the user cancelled at Google) visible until they sign in successfully
    setCloud({ status: user ? 'signed-in' : 'signed-out', user, ...(user ? { error: '' } : {}) });
    if ((user?.id ?? null) !== (was ?? null)) authListeners.forEach((l) => l(user, event));
  });
  const { data } = await c.auth.getSession();
  if (!data.session) setCloud({ status: 'signed-out' });
  // back from Google: drop ?code=… from the address bar and return to where sign-in started
  if (returning) {
    let back = '#/';
    try { back = sessionStorage.getItem(RETURN_KEY) || '#/'; sessionStorage.removeItem(RETURN_KEY); } catch { /* ignore */ }
    if (oauthError) setCloud({ error: oauthError });
    history.replaceState(null, '', location.pathname + back);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}
