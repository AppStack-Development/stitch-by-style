import type { ThreadColor } from '../types';

import { DMC_LIBRARY } from './dmc';

export { DMC_LIBRARY, DMC_SORTED } from './dmc';

/** Symbols that stay distinguishable when printed in black & white. */
export const SYMBOLS = [
  '●', '■', '▲', '◆', '★', '✚', '✖', '♥', '○', '□', '△', '◇', '☆', '♣', '♠', '♦',
  '▼', '◐', '◑', '✿', '☀', '♪', '#', '@', '%', '&', '=', '+', '/', 'Z', 'S', 'N', 'H',
  'K', 'X', 'O', 'V', 'T', 'Y', 'W',
];

export function nextSymbol(palette: ThreadColor[]): string {
  const used = new Set(palette.map((c) => c.symbol));
  return SYMBOLS.find((s) => !used.has(s)) ?? String(palette.length + 1);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function makeThread(
  partial: Partial<ThreadColor> & { hex: string },
  palette: ThreadColor[],
): ThreadColor {
  return {
    id: uid(),
    name: partial.name ?? partial.hex,
    brand: partial.brand ?? '',
    code: partial.code ?? '',
    symbol: partial.symbol ?? nextSymbol(palette),
    hex: partial.hex,
  };
}

export function defaultPalette(): ThreadColor[] {
  const picks = ['321', '444', '702', '798', '310'];
  const out: ThreadColor[] = [];
  for (const code of picks) {
    const t = DMC_LIBRARY.find((d) => d.code === code)!;
    out.push(makeThread({ hex: t.hex, name: t.name, code: t.code, brand: 'DMC' }, out));
  }
  return out;
}

/** Pick black or white for text over a colour. */
export function contrastText(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1b1b1b' : '#ffffff';
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
