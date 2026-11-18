import { useEffect, useRef } from 'react';
import type { ViewMode } from '../types';
import { drawPattern, type Drawable } from '../lib/render';

interface Props {
  pattern: Drawable;
  max: number;
  view?: ViewMode;
  grid?: boolean;
  className?: string;
}

/** Static canvas preview that fits inside a `max` x `max` box. */
export function Thumb({ pattern, max, view = 'color', grid = false, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cell = Math.max(1, max / Math.max(pattern.cols, pattern.rows));
  const w = Math.round(pattern.cols * cell), h = Math.round(pattern.rows * cell);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawPattern(ctx, pattern, { cell, view, grid });
  });
  return <canvas ref={ref} className={className} style={{ width: w, height: h }} />;
}
