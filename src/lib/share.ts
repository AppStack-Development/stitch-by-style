import type { Pattern } from '../types';
import { normalizePattern } from './pattern';

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

export async function encodeShare(p: Pattern): Promise<string> {
  const { id, createdAt, updatedAt, ...rest } = p;
  const bytes = new TextEncoder().encode(JSON.stringify(rest));
  return toB64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
}

export async function decodeShare(data: string): Promise<Pattern> {
  const bytes = await pipe(fromB64Url(data), new DecompressionStream('deflate-raw'));
  return normalizePattern({ ...JSON.parse(new TextDecoder().decode(bytes)), id: '' });
}

export async function shareUrl(p: Pattern): Promise<string> {
  const base = location.href.split('#')[0];
  return `${base}#/s/${await encodeShare(p)}`;
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
