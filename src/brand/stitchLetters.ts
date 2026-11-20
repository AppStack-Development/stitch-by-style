/**
 * The wordmark's letters, drawn as cross stitches on a grid: every '1' is one stitch.
 * 5x7 cells per letter (narrower for i and '.'), two extra rows below for descenders, one empty
 * column between letters. Only the letters of the app name are drawn; add more here if it changes.
 */
export const LETTERS: Record<string, string[]> = {
  X: ['1...1', '1...1', '.1.1.', '..1..', '.1.1.', '1...1', '1...1'],
  S: ['.111.', '1...1', '1....', '.111.', '....1', '1...1', '.111.'],
  D: ['1111.', '1...1', '1...1', '1...1', '1...1', '1...1', '1111.'],
  t: ['..1..', '..1..', '11111', '..1..', '..1..', '..1.1', '...1.'],
  i: ['.1.', '...', '11.', '.1.', '.1.', '.1.', '111'],
  c: ['.....', '.....', '.111.', '1....', '1....', '1....', '.111.'],
  h: ['1....', '1....', '1.11.', '11..1', '1...1', '1...1', '1...1'],
  e: ['.....', '.....', '.111.', '1...1', '11111', '1....', '.111.'],
  s: ['.....', '.....', '.1111', '1....', '.111.', '....1', '1111.'],
  g: ['.....', '.....', '.1111', '1...1', '1...1', '1...1', '.1111', '....1', '.111.'],
  n: ['.....', '.....', '1.11.', '11..1', '1...1', '1...1', '1...1'],
  '.': ['.', '.', '.', '.', '.', '.', '1'],
};

/** Rows in the grid: 7 for capitals, 2 more for descenders. */
export const ROWS = 9;

export interface StitchedWord {
  /** grid width in cells */
  cols: number;
  /** stitch centres in cells, grouped by part: first letter, the rest up to the dot, the dot and after */
  parts: { first: [number, number][]; middle: [number, number][]; tail: [number, number][] };
}

/** Lays out a name in stitches, or null when it has a letter we haven't drawn. */
export function stitchWord(name: string): StitchedWord | null {
  if ([...name].some((ch) => !LETTERS[ch])) return null;
  const dot = name.indexOf('.');
  const parts: StitchedWord['parts'] = { first: [], middle: [], tail: [] };
  let x = 0;
  [...name].forEach((ch, i) => {
    const g = LETTERS[ch];
    const into = i === 0 ? parts.first : dot >= 0 && i >= dot ? parts.tail : parts.middle;
    g.forEach((row, y) => [...row].forEach((v, c) => { if (v === '1') into.push([x + c + 0.5, y + 0.5]); }));
    x += g[0].length + 1;
  });
  return { cols: x - 1, parts };
}
