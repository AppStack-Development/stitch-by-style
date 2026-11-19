import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { HoleBrush, Pattern, Tool, ViewMode } from '../types';
import { drawPattern } from '../lib/render';

export interface CanvasHandle {
  zoomBy: (f: number) => void;
  fit: () => void;
}

interface Props {
  pattern: Pattern;
  view: ViewMode;
  grid: boolean;
  tool: Tool;
  active: number;
  holeBrush: HoleBrush;
  mirrorX: boolean;
  mirrorY: boolean;
  onStrokeStart: () => void;
  /** a touch stroke turned out to be the first finger of a pinch: undo it and drop its undo step */
  onStrokeCancel?: () => void;
  onChange: (cells: number[], mask: string) => void;
  onPick: (index: number) => void;
  onHover: (cell: { x: number; y: number } | null) => void;
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

function rectPts(a: Pt, b: Pt): Pt[] {
  const pts: Pt[] = [];
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
  for (let x = x0; x <= x1; x++) { pts.push({ x, y: y0 }); if (y1 !== y0) pts.push({ x, y: y1 }); }
  for (let y = y0 + 1; y < y1; y++) { pts.push({ x: x0, y }); if (x1 !== x0) pts.push({ x: x1, y }); }
  return pts;
}

export const PatternCanvas = forwardRef<CanvasHandle, Props>(function PatternCanvas(props, ref) {
  const { pattern: p } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef({ s: 16, ox: 0, oy: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tick, setTick] = useState(0);
  const hoverRef = useRef<Pt | null>(null);
  const previewRef = useRef<Pt[] | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const stroke = useRef<{
    mode: 'paint' | 'pan' | 'shape';
    erase: boolean;
    last: Pt | null;
    start: Pt | null;
    cells: number[];
    mask: string[];
    panFrom?: { x: number; y: number; ox: number; oy: number };
  } | null>(null);
  const spaceDown = useRef(false);
  // touch: fingers on the canvas (canvas-local px), the pinch in progress, and the latest one-finger
  // edit — undone if a second finger lands soon after, because it was meant as a pinch, not a stroke
  const touches = useRef(new Map<number, Pt>());
  const pinch = useRef<{ d0: number; mid0: Pt; s0: number; ox0: number; oy0: number } | null>(null);
  const touchEdit = useRef<{ id: number; at: number } | null>(null);
  const PINCH_GRACE_MS = 350;

  const redraw = useCallback(() => setTick((t) => t + 1), []);

  const fit = useCallback(() => {
    const { w, h } = size;
    if (!w || !h) return;
    const cp = propsRef.current.pattern;
    const s = Math.max(2, Math.min(48, Math.floor(Math.min((w - 48) / cp.cols, (h - 48) / cp.rows))));
    viewRef.current = { s, ox: Math.round((w - cp.cols * s) / 2), oy: Math.round((h - cp.rows * s) / 2) };
    redraw();
  }, [size, redraw]);

  const zoomAt = useCallback((f: number, cx: number, cy: number) => {
    const v = viewRef.current;
    const s = Math.max(2, Math.min(80, v.s * f));
    const k = s / v.s;
    viewRef.current = { s, ox: cx - (cx - v.ox) * k, oy: cy - (cy - v.oy) * k };
    redraw();
  }, [redraw]);

  useImperativeHandle(ref, () => ({
    zoomBy: (f) => zoomAt(f, size.w / 2, size.h / 2),
    fit,
  }), [zoomAt, fit, size]);

  useLayoutEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fitted = useRef(false);
  useEffect(() => {
    if (!fitted.current && size.w > 0) {
      fitted.current = true;
      fit();
    }
  }, [size, fit]);
  // refit when the grid dimensions change
  useEffect(() => { if (fitted.current) fit(); }, [p.cols, p.rows]); // eslint-disable-line react-hooks/exhaustive-deps

  // draw
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
    const cp = props.pattern;
    // outside cells stay transparent so the piece's outline reads clearly
    ctx.strokeStyle = '#00000018';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox - 0.5, oy - 0.5, cp.cols * s + 1, cp.rows * s + 1);
    drawPattern(ctx, cp, { cell: s, view: props.view, grid: props.grid, ox, oy });
    // centre markers
    ctx.fillStyle = '#e0533d';
    const cx = ox + (cp.cols * s) / 2, cy = oy + (cp.rows * s) / 2;
    const m = 7;
    ctx.beginPath();
    ctx.moveTo(cx - m, oy - 12); ctx.lineTo(cx + m, oy - 12); ctx.lineTo(cx, oy - 3); ctx.closePath();
    ctx.moveTo(ox - 12, cy - m); ctx.lineTo(ox - 12, cy + m); ctx.lineTo(ox - 3, cy); ctx.closePath();
    ctx.fill();
    // mirror axes
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#3d6be0';
    ctx.lineWidth = 1.5;
    if (props.mirrorX) { ctx.beginPath(); ctx.moveTo(cx, oy); ctx.lineTo(cx, oy + cp.rows * s); ctx.stroke(); }
    if (props.mirrorY) { ctx.beginPath(); ctx.moveTo(ox, cy); ctx.lineTo(ox + cp.cols * s, cy); ctx.stroke(); }
    ctx.setLineDash([]);
    // shape preview
    const prev = previewRef.current;
    if (prev) {
      const col = props.active >= 0 ? cp.palette[props.active]?.hex ?? '#000' : '#000';
      ctx.fillStyle = col + 'aa';
      for (const q of expandMirror(prev)) {
        if (q.x < 0 || q.y < 0 || q.x >= cp.cols || q.y >= cp.rows) continue;
        if (cp.mask[q.y * cp.cols + q.x] !== '2') continue;
        ctx.fillRect(ox + q.x * s, oy + q.y * s, s, s);
      }
    }
    const h = hoverRef.current;
    if (h && h.x >= 0 && h.y >= 0 && h.x < cp.cols && h.y < cp.rows) {
      ctx.strokeStyle = '#1f2a44';
      ctx.lineWidth = 2;
      for (const q of expandMirror([h])) ctx.strokeRect(ox + q.x * s + 1, oy + q.y * s + 1, s - 2, s - 2);
    }
  }); // redraw on every render (cheap enough, keeps overlays in sync)

  void tick;

  function expandMirror(pts: Pt[]): Pt[] {
    const { mirrorX, mirrorY, pattern: cp } = propsRef.current;
    if (!mirrorX && !mirrorY) return pts;
    const out: Pt[] = [];
    for (const q of pts) {
      out.push(q);
      if (mirrorX) out.push({ x: cp.cols - 1 - q.x, y: q.y });
      if (mirrorY) out.push({ x: q.x, y: cp.rows - 1 - q.y });
      if (mirrorX && mirrorY) out.push({ x: cp.cols - 1 - q.x, y: cp.rows - 1 - q.y });
    }
    return out;
  }

  function cellAt(e: { clientX: number; clientY: number }): Pt {
    const r = canvasRef.current!.getBoundingClientRect();
    const { s, ox, oy } = viewRef.current;
    return { x: Math.floor((e.clientX - r.left - ox) / s), y: Math.floor((e.clientY - r.top - oy) / s) };
  }

  function applyPts(pts: Pt[], erase: boolean) {
    const st = stroke.current!;
    const { pattern: cp, tool, active, holeBrush } = propsRef.current;
    let changed = false;
    for (const q of expandMirror(pts)) {
      if (q.x < 0 || q.y < 0 || q.x >= cp.cols || q.y >= cp.rows) continue;
      const i = q.y * cp.cols + q.x;
      if (tool === 'hole') {
        const k = erase ? '2' : holeBrush;
        if (st.mask[i] !== k) { st.mask[i] = k; changed = true; }
        if (k !== '2' && st.cells[i] !== -1) { st.cells[i] = -1; changed = true; }
        continue;
      }
      if (st.mask[i] !== '2') continue;
      const v = erase || tool === 'eraser' ? -1 : active;
      if (st.cells[i] !== v) { st.cells[i] = v; changed = true; }
    }
    if (changed) propsRef.current.onChange(st.cells.slice(), st.mask.join(''));
  }

  function floodFill(start: Pt, erase: boolean) {
    const st = stroke.current!;
    const { pattern: cp, active } = propsRef.current;
    const seeds = expandMirror([start]);
    const v = erase ? -1 : active;
    let changed = false;
    for (const sd of seeds) {
      if (sd.x < 0 || sd.y < 0 || sd.x >= cp.cols || sd.y >= cp.rows) continue;
      const si = sd.y * cp.cols + sd.x;
      if (st.mask[si] !== '2') continue;
      const target = st.cells[si];
      if (target === v) continue;
      const stack = [si];
      while (stack.length) {
        const i = stack.pop()!;
        if (st.mask[i] !== '2' || st.cells[i] !== target) continue;
        st.cells[i] = v;
        changed = true;
        const x = i % cp.cols, y = (i / cp.cols) | 0;
        if (x > 0) stack.push(i - 1);
        if (x < cp.cols - 1) stack.push(i + 1);
        if (y > 0) stack.push(i - cp.cols);
        if (y < cp.rows - 1) stack.push(i + cp.cols);
      }
    }
    if (changed) propsRef.current.onChange(st.cells.slice(), st.mask.join(''));
  }

  const localPt = (e: { clientX: number; clientY: number }): Pt => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function onPointerDown(e: React.PointerEvent) {
    const el = canvasRef.current!;
    try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    const { tool, pattern: cp } = propsRef.current;
    const v = viewRef.current;
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, localPt(e));
      if (touches.current.size === 2) {
        // second finger: this is a pinch/pan. Take back what the first finger just drew.
        const te = touchEdit.current;
        if (te && (stroke.current || Date.now() - te.at < PINCH_GRACE_MS)) propsRef.current.onStrokeCancel?.();
        touchEdit.current = null;
        stroke.current = null;
        previewRef.current = null;
        const [a, b] = [...touches.current.values()];
        pinch.current = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, s0: v.s, ox0: v.ox, oy0: v.oy };
        redraw();
        return;
      }
      if (touches.current.size > 2) return;
      // a new first finger: only an edit it makes itself may be taken back by a following pinch
      if (touches.current.size === 1) touchEdit.current = null;
    }
    if (e.button === 1 || tool === 'pan' || spaceDown.current) {
      stroke.current = { mode: 'pan', erase: false, last: null, start: null, cells: [], mask: [], panFrom: { x: e.clientX, y: e.clientY, ox: v.ox, oy: v.oy } };
      return;
    }
    const pt = cellAt(e);
    const erase = e.button === 2;
    if (tool === 'picker') {
      if (pt.x >= 0 && pt.y >= 0 && pt.x < cp.cols && pt.y < cp.rows) {
        const c = cp.cells[pt.y * cp.cols + pt.x];
        if (c >= 0) propsRef.current.onPick(c);
      }
      return;
    }
    propsRef.current.onStrokeStart();
    touchEdit.current = e.pointerType === 'touch' ? { id: e.pointerId, at: Date.now() } : null;
    stroke.current = {
      mode: tool === 'line' || tool === 'rect' ? 'shape' : 'paint',
      erase,
      last: pt,
      start: pt,
      cells: cp.cells.slice(),
      mask: cp.mask.split(''),
    };
    if (tool === 'fill') {
      floodFill(pt, erase);
      stroke.current = null;
    } else if (tool === 'line' || tool === 'rect') {
      previewRef.current = [pt];
      redraw();
    } else {
      applyPts([pt], erase);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, localPt(e));
      const pc = pinch.current;
      if (pc && touches.current.size >= 2) {
        // zoom around the point between the fingers and follow them as they move
        const [a, b] = [...touches.current.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const s = Math.max(2, Math.min(80, pc.s0 * (d / pc.d0)));
        const wx = (pc.mid0.x - pc.ox0) / pc.s0, wy = (pc.mid0.y - pc.oy0) / pc.s0;
        viewRef.current = { s, ox: mid.x - wx * s, oy: mid.y - wy * s };
        redraw();
        return;
      }
    }
    const pt = cellAt(e);
    const prevH = hoverRef.current;
    if (!prevH || prevH.x !== pt.x || prevH.y !== pt.y) {
      hoverRef.current = pt;
      const cp = propsRef.current.pattern;
      propsRef.current.onHover(pt.x >= 0 && pt.y >= 0 && pt.x < cp.cols && pt.y < cp.rows ? pt : null);
      redraw();
    }
    const st = stroke.current;
    if (!st) return;
    if (st.mode === 'pan' && st.panFrom) {
      viewRef.current = { ...viewRef.current, ox: st.panFrom.ox + e.clientX - st.panFrom.x, oy: st.panFrom.oy + e.clientY - st.panFrom.y };
      redraw();
      return;
    }
    if (st.mode === 'shape' && st.start) {
      previewRef.current = propsRef.current.tool === 'line' ? linePts(st.start, pt) : rectPts(st.start, pt);
      redraw();
      return;
    }
    if (st.last && (st.last.x !== pt.x || st.last.y !== pt.y)) {
      applyPts(linePts(st.last, pt).slice(1), st.erase);
      st.last = pt;
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (e.pointerType === 'touch') {
      touches.current.delete(e.pointerId);
      if (pinch.current) {
        if (touches.current.size < 2) pinch.current = null;
        // one finger left after a pinch: let it keep moving the view, never draw
        if (touches.current.size === 1) {
          const [rest] = [...touches.current.values()];
          const r = canvasRef.current!.getBoundingClientRect();
          const v = viewRef.current;
          stroke.current = { mode: 'pan', erase: false, last: null, start: null, cells: [], mask: [], panFrom: { x: rest.x + r.left, y: rest.y + r.top, ox: v.ox, oy: v.oy } };
        } else {
          stroke.current = null;
        }
        return;
      }
    }
    const st = stroke.current;
    if (st && st.mode === 'shape' && previewRef.current) {
      applyPts(previewRef.current, st.erase);
    }
    previewRef.current = null;
    stroke.current = null;
    redraw();
  }

  function onWheel(e: React.WheelEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) >= 40 && !e.shiftKey && e.deltaX === 0) {
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX - r.left, e.clientY - r.top);
    } else {
      const v = viewRef.current;
      viewRef.current = { ...v, ox: v.ox - e.deltaX, oy: v.oy - e.deltaY };
      redraw();
    }
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        spaceDown.current = true;
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDown.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    // prevent page zoom on pinch over the canvas
    const el = wrapRef.current!;
    const stop = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', stop, { passive: false });
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      el.removeEventListener('wheel', stop);
    };
  }, []);

  const cursor = props.tool === 'pan' ? 'grab' : props.tool === 'picker' ? 'copy' : 'crosshair';

  return (
    <div ref={wrapRef} className="canvas-wrap">
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h, cursor, touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => { hoverRef.current = null; props.onHover(null); redraw(); }}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
});
