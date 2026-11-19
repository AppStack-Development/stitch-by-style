import type { Pattern } from '../types';
import { defaultDetails, normalizePattern } from './pattern';
import { uid } from './threads';
import { t } from './i18n';

function toB64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(str: string): Uint8Array {
  const b = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

/*
 * Compact cell encoding: one character per cell ('.' = empty, '0'.. = palette index),
 * which deflates far better than a JSON number array. Decoding accepts both forms,
 * so links made before this change keep working.
 */
const CELL_BASE = 48; // '0'
const MAX_COMPACT_PALETTE = 74; // '0'..'z'

function pack(p: Partial<Pattern>): Record<string, unknown> {
  const { cells, details, palette, ...rest } = p;
  // details: only fields that differ from the defaults (normalizePattern fills the rest back in)
  const defaults = defaultDetails() as unknown as Record<string, unknown>;
  const d: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details ?? {})) {
    if (JSON.stringify(v) !== JSON.stringify(defaults[k])) d[k] = v;
  }
  // palette ids are only React keys; they are regenerated on decode
  const pal = palette?.map(({ id, ...t }) => t);
  const out: Record<string, unknown> = { ...rest, details: d, palette: pal };
  if (!cells || (palette?.length ?? 0) > MAX_COMPACT_PALETTE) return { ...out, cells };
  return { ...out, c: cells.map((v) => (v < 0 ? '.' : String.fromCharCode(CELL_BASE + v))).join('') };
}

function unpack(raw: any): any {
  let out = raw;
  if (typeof raw.c === 'string' && !Array.isArray(raw.cells)) {
    const { c, ...rest } = raw;
    out = { ...rest, cells: Array.from(c as string, (ch) => (ch === '.' ? -1 : ch.charCodeAt(0) - CELL_BASE)) };
  }
  if (Array.isArray(out.palette)) out = { ...out, palette: out.palette.map((t: any) => ({ ...t, id: t.id || uid() })) };
  return out;
}

async function deflateJson(obj: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  return toB64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
}

async function inflateJson(data: string): Promise<any> {
  const bytes = await pipe(fromB64Url(data), new DecompressionStream('deflate-raw'));
  return unpack(JSON.parse(new TextDecoder().decode(bytes)));
}

const baseUrl = () => location.href.split('#')[0];

/** Share with someone else: a fresh copy, without your stitching progress. */
export async function encodeShare(p: Pattern): Promise<string> {
  // stitching progress is personal: never put it in a share link; community links live in their own columns
  const { id, createdAt, updatedAt, progress, postId, remixOf, ...rest } = p;
  return deflateJson(pack(rest));
}

export async function decodeShare(data: string): Promise<Pattern> {
  return normalizePattern({ ...(await inflateJson(data)), id: '' });
}

export async function shareUrl(p: Pattern): Promise<string> {
  return `${baseUrl()}#/s/${await encodeShare(p)}`;
}

/** Move your own pattern to another device: keeps its id, dates and progress. */
export async function encodeTransfer(p: Pattern): Promise<string> {
  return deflateJson(pack(p));
}

export async function decodeTransfer(data: string): Promise<Pattern> {
  const raw = await inflateJson(data);
  if (!raw.id) throw new Error(t('ลิงก์ไม่ครบ', 'The link is incomplete'));
  return normalizePattern(raw);
}

export async function transferUrl(p: Pattern): Promise<string> {
  return `${baseUrl()}#/t/${await encodeTransfer(p)}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function safeFilename(name: string): string {
  return (name.trim() || 'pattern').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60);
}
