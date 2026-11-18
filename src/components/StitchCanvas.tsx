import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { Pattern, ViewMode } from '../types';
import { drawPattern } from '../lib/render';
import { isStitch, regionOf } from '../lib/progress';

export type MarkMode = 'tap' | 'paint' | 'region';

export interface StitchCanvasHandle {
  zoomBy: (f: number) => void;
  fit: () => void;
  /** zoom to the bounding box of these cells */
  showCells: (idx: number[]) => void;
}

interface Props {
  pattern: Pattern;
  done: string;
  focus: number | null;
  view: ViewMode;
  grid: boolean;
  mode: MarkMode;
  onStrokeStart: () => void;
  onMark: (idx: number[], value: boolean) => void;
}

type Pt = { x: number; y: number };

function linePts(a: Pt, b: Pt): Pt[] {
  const pts: Pt[] = [];
  let x0 = a.x, y0 = a.y;
  const dx = Math.abs(b.x - x0), dy = -Math.abs(b.y - y0);
  const sx = x0 < b.x ? 1 : -1, sy = y0 < b.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    pts.push({ x: x0, y: y0 });
    if (x0 === b.x && y0 === b.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return pts;
}

const TAP_SLOP = 8;

export const StitchCanvas = forwardRef<StitchCanvasHandle, Props>(function StitchCanvas(props, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef({ s: 16, ox: 0, oy: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [, setTick] = useState(0);
  const redraw = useCallback(() => setTick((t) => t + 1), []);
  const propsRef = useRef(props);
  propsRef.current = props;
  const hoverRef = useRef<Pt | null>(null);

  const pointers = useRef(new Map<number, Pt>());
  const single = useRef<{
    start: Pt; moved: boolean; painting: boolean; value: boolean | null; last: Pt | null;
    panFrom: { ox: number; oy: number }; pan: boolean;
  } | null>(null);
  const pinch = useRef<{ d0: number; mid0: Pt; s0: number; ox0: number; oy0: number } | null>(null);

  const local = (e: { clientX: number; clientY: number }): Pt => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const cellAt = (pt: Pt): Pt => {
    const { s, ox, oy } = viewRef.current;
    return { x: Math.floor((pt.x - ox) / s), y: Math.floor((pt.y - oy) / s) };
  };
  const indexOf = (c: Pt): number => {
    const p = propsRef.current.pattern;
    return c.x < 0 || c.y < 0 || c.x >= p.cols || c.y >= p.rows ? -1 : c.y * p.cols + c.x;
  };
  /** cells the current focus allows marking */
  const allowed = (i: number) => {
    const { pattern: p, focus } = propsRef.current;
    return i >= 0 && isStitch(p, i) && (focus == null || p.cells[i] === focus);
  };

  const fit = useCallback(() => {
    const { w, h } = size;
    if (!w || !h) return;
    const p = propsRef.current.pattern;
    // leave room for the floating toolbar (top) and status banner (bottom)
    const top = 58, bottom = 58;
    const s = Math.max(2, Math.min(56, Math.min((w - 32) / p.cols, (h - top - bottom) / p.rows)));
    viewRef.current = { s, ox: (w - p.cols * s) / 2, oy: top + (h - top - bottom - p.rows * s) / 2 };
    redraw();
  }, [size, redraw]);

  const zoomAt = useCallback((f: number, cx: number, cy: number) => {
    const v = viewRef.current;
    const s = Math.max(2, Math.min(96, v.s * f));
    const k = s / v.s;
    viewRef.current = { s, ox: cx - (cx - v.ox) * k, oy: cy - (cy - v.oy) * k };
    redraw();
  }, [redraw]);

  const showCells = useCallback((idx: number[]) => {
    const { w, h } = size;
    if (!w || !h || !idx.length) return;
    const p = propsRef.current.pattern;
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (const i of idx) {
      const x = i % p.cols, y = (i / p.cols) | 0;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const bw = x1 - x0 + 3, bh = y1 - y0 + 3;
    const s = Math.max(4, Math.min(44, Math.min(w / bw, h / bh)));
    viewRef.current = { s, ox: w / 2 - ((x0 + x1 + 1) / 2) * s, oy: h / 2 - ((y0 + y1 + 1) / 2) * s };
    redraw();
  }, [size, redraw]);

  useImperativeHandle(ref, () => ({ zoomBy: (f) => zoomAt(f, size.w / 2, size.h / 2), fit, showCells }), [zoomAt, fit, showCells, size]);

  useLayoutEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    const stop = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', stop, { passive: false });
    return () => { ro.disconnect(); el.removeEventListener('wheel', stop); };
  }, []);

  const fitted = useRef(false);
  useEffect(() => {
    if (!fitted.current && size.w > 0) { fitted.current = true; fit(); }
  }, [size, fit]);

  // draw every render; cheap enough and keeps overlays in sync
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !size.w) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(size.w * dpr)) c.width = Math.round(size.w * dpr);
    if (c.height !== Math.round(size.h * dpr)) c.height = Math.round(size.h * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    const { s, ox, oy } = viewRef.current;
    const p = props.pattern;
    drawPattern(ctx, p, { cell: s, view: props.view, grid: props.grid, ox, oy, done: props.done, focus: props.focus });
    // centre markers
    ctx.fillStyle = '#e0533d';
    const cx = ox + (p.cols * s) / 2, cy = oy + (p.rows * s) / 2;
    ctx.beginPath();
    ctx.moveTo(cx - 7, oy - 12); ctx.lineTo(cx + 7, oy - 12); ctx.lineTo(cx, oy - 3); ctx.closePath();
    ctx.moveTo(ox - 12, cy - 7); ctx.lineTo(ox - 12, cy + 7); ctx.lineTo(ox - 3, cy); ctx.closePath();
    ctx.fill();
    const hv = hoverRef.current;
    if (hv && indexOf(hv) >= 0) {
      ctx.strokeStyle = '#f2b33d';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(ox + hv.x * s + 1, oy + hv.y * s + 1, s - 2, s - 2);
    }
  });

  function toggleAt(pt: Pt) {
    const { mode, done, pattern } = propsRef.current;
    const i = indexOf(cellAt(pt));
    if (!allowed(i)) return;
    const value = done.charCodeAt(i) !== 49;
    const idx = mode === 'region' ? regionOf(pattern, i).filter(allowed) : [i];
    propsRef.current.onStrokeStart();
    propsRef.current.onMark(idx, value);
  }

  function onPointerDown(e: React.PointerEvent) {
    try {
      canvasRef.current!.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone (e.g. very quick tap); keep handling the event */
    }
    const pt = local(e);
    pointers.current.set(e.pointerId, pt);
    const v = viewRef.current;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, s0: v.s, ox0: v.ox, oy0: v.oy };
      single.current = null;
      return;
    }
    if (pointers.current.size > 2) return;
    const pan = e.button === 1 || e.button === 2;
    const painting = !pan && propsRef.current.mode === 'paint';
    single.current = { start: pt, moved: false, painting, value: null, last: cellAt(pt), panFrom: { ox: v.ox, oy: v.oy }, pan };
    if (painting) {
      const i = indexOf(cellAt(pt));
      if (allowed(i)) {
        const value = propsRef.current.done.charCodeAt(i) !== 49;
        single.current.value = value;
        propsRef.current.onStrokeStart();
        propsRef.current.onMark([i], value);
      }
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const pt = local(e);
    if (e.pointerType === 'mouse') {
      const c = cellAt(pt);
      const h = hoverRef.current;
      if (!h || h.x !== c.x || h.y !== c.y) { hoverRef.current = c; redraw(); }
    }
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, pt);
    const pc = pinch.current;
    if (pc && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const s = Math.max(2, Math.min(96, pc.s0 * (d / pc.d0)));
      const wx = (pc.mid0.x - pc.ox0) / pc.s0, wy = (pc.mid0.y - pc.oy0) / pc.s0;
      viewRef.current = { s, ox: mid.x - wx * s, oy: mid.y - wy * s };
      redraw();
      return;
    }
    const st = single.current;
    if (!st) return;
    if (!st.moved && Math.hypot(pt.x - st.start.x, pt.y - st.start.y) > TAP_SLOP) st.moved = true;
    if (!st.moved) return;
    if (st.painting) {
      const c = cellAt(pt);
      if (st.last && (c.x !== st.last.x || c.y !== st.last.y)) {
        if (st.value === null) {
          // stroke started outside an allowed cell: take the value from the first one reached
          const first = linePts(st.last, c).map(indexOf).find(allowed);
          if (first !== undefined) {
            st.value = propsRef.current.done.charCodeAt(first) !== 49;
            propsRef.current.onStrokeStart();
          }
        }
        if (st.value !== null) {
          const idx = linePts(st.last, c).map(indexOf).filter(allowed);
          if (idx.length) propsRef.current.onMark(idx, st.value);
        }
        st.last = c;
      }
      return;
    }
    viewRef.current = { ...viewRef.current, ox: st.panFrom.ox + pt.x - st.start.x, oy: st.panFrom.oy + pt.y - st.start.y };
    redraw();
  }

  function onPointerUp(e: React.PointerEvent) {
    const st = single.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 1 && !st) {
      // one finger left after a pinch: continue as a pan from here, never as a tap
      const [rest] = [...pointers.current.values()];
      const v = viewRef.current;
      single.current = { start: rest, moved: true, painting: false, value: null, last: null, panFrom: { ox: v.ox, oy: v.oy }, pan: true };
      return;
    }
    if (pointers.current.size === 0) {
      if (st && !st.moved && !st.painting && !st.pan) toggleAt(local(e));
      single.current = null;
    }
  }

  function onWheel(e: React.WheelEvent) {
    const pt = local(e);
    if (e.ctrlKey || e.metaKey || (Math.abs(e.deltaY) >= 40 && !e.shiftKey && e.deltaX === 0)) {
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), pt.x, pt.y);
    } else {
      const v = viewRef.current;
      viewRef.current = { ...v, ox: v.ox - e.deltaX, oy: v.oy - e.deltaY };
      redraw();
    }
  }

  return (
    <div ref={wrapRef} className="canvas-wrap">
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h, cursor: props.mode === 'paint' ? 'crosshair' : 'pointer', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') { hoverRef.current = null; redraw(); } }}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
});
