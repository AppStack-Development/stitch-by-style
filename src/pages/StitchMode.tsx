import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Pattern, Progress, ViewMode } from '../types';
import { loadPattern, savePattern } from '../lib/storage';
import {
  cellsOfColor, computeProgress, emptyProgress, fmtClock, fmtDuration, getProgress, isStitch, markCells, todayKey,
} from '../lib/progress';
import { contrastText } from '../lib/threads';
import { StitchCanvas, type MarkMode, type StitchCanvasHandle } from '../components/StitchCanvas';
import { Icon, type IconName } from '../components/Icon';
import { TransferDialog } from '../components/TransferDialog';

const MODES: { id: MarkMode; icon: IconName; label: string; hint: string }[] = [
  { id: 'tap', icon: 'tap', label: 'แตะ', hint: 'แตะช่องเพื่อทำเครื่องหมาย · ลากเพื่อเลื่อน' },
  { id: 'paint', icon: 'pencil', label: 'ระบาย', hint: 'ลากผ่านหลายช่องเพื่อทำเครื่องหมาย · ใช้ 2 นิ้วเพื่อเลื่อน/ซูม' },
  { id: 'region', icon: 'fill', label: 'ทั้งกลุ่ม', hint: 'แตะครั้งเดียว ทำเครื่องหมายช่องสีเดียวกันที่ติดกันทั้งกลุ่ม' },
];

const ones = (s: string) => {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 49) n++;
  return n;
};

/** Live clock for the running timer, kept separate so the canvas doesn't re-render every second. */
function Clock({ base, since }: { base: number; since: number | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (since == null) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [since]);
  return <>{fmtClock(base + (since == null ? 0 : (Date.now() - since) / 1000))}</>;
}

export function StitchMode({ id }: { id: string }) {
  const [pattern] = useState<Pattern | null>(() => loadPattern(id));
  const [progress, setProgress] = useState<Progress>(() => (pattern ? getProgress(pattern) : emptyProgress(0)));
  const [focus, setFocus] = useState<number | null>(null);
  const [mode, setMode] = useState<MarkMode>('tap');
  const [view, setView] = useState<ViewMode>('both');
  const [grid, setGrid] = useState(true);
  const [timerSince, setTimerSince] = useState<number | null>(null);
  const [awake, setAwake] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [, force] = useState(0);
  const undo = useRef<string[]>([]);
  const canvas = useRef<StitchCanvasHandle>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const [toolsH, setToolsH] = useState(48);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const timerRef = useRef(timerSince);
  timerRef.current = timerSince;
  const dirty = useRef(false);

  const flush = useCallback(() => {
    if (!pattern || !dirty.current) return;
    dirty.current = false;
    savePattern({ ...pattern, progress: progressRef.current, updatedAt: Date.now() });
  }, [pattern]);

  // save shortly after each change, and on leave
  useEffect(() => {
    if (!pattern) return;
    if (progress === pattern.progress) return;
    dirty.current = true;
    const t = setTimeout(flush, 400);
    return () => clearTimeout(t);
  }, [progress, pattern, flush]);

  // fold the running timer into the stored seconds
  const stopTimer = useCallback(() => {
    const since = timerRef.current;
    if (since == null) return;
    const add = (Date.now() - since) / 1000;
    setTimerSince(null);
    setProgress((pr) => ({ ...pr, seconds: pr.seconds + add, updatedAt: Date.now() }));
  }, []);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        if (timerRef.current != null) {
          const add = (Date.now() - timerRef.current) / 1000;
          progressRef.current = { ...progressRef.current, seconds: progressRef.current.seconds + add };
          setProgress(progressRef.current);
          setTimerSince(null);
          dirty.current = true;
        }
        flush();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      if (timerRef.current != null) {
        progressRef.current = { ...progressRef.current, seconds: progressRef.current.seconds + (Date.now() - timerRef.current) / 1000 };
        dirty.current = true;
      }
      flush();
    };
  }, [flush]);

  // keep the screen on while stitching (where supported)
  const wakeSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  useEffect(() => {
    if (!awake || !wakeSupported) return;
    let lock: { release: () => Promise<void> } | null = null;
    let live = true;
    const request = async () => {
      try {
        lock = await (navigator as any).wakeLock.request('screen');
      } catch {
        if (live) setAwake(false);
      }
    };
    request();
    const onVis = () => { if (document.visibilityState === 'visible' && live) request(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
    };
  }, [awake, wakeSupported]);

  const onStrokeStart = useCallback(() => {
    undo.current.push(progressRef.current.done);
    if (undo.current.length > 80) undo.current.shift();
    force((n) => n + 1);
  }, []);

  const onMark = useCallback((idx: number[], value: boolean) => {
    if (!pattern) return;
    setProgress((pr) => markCells(pattern, pr, idx, value).progress);
  }, [pattern]);

  const doUndo = useCallback(() => {
    const prev = undo.current.pop();
    if (prev == null) return;
    setProgress((pr) => {
      const delta = ones(pr.done) - ones(prev);
      const key = todayKey();
      return { ...pr, done: prev, daily: { ...pr.daily, [key]: (pr.daily[key] ?? 0) - delta }, updatedAt: Date.now() };
    });
    force((n) => n + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); return; }
      if (e.metaKey || e.ctrlKey) return;
      if (/^[1-9]$/.test(e.key) && pattern && +e.key <= pattern.palette.length) setFocus(+e.key - 1);
      if (e.key === 'Escape') setFocus(null);
      if (e.key === '+' || e.key === '=') canvas.current?.zoomBy(1.25);
      if (e.key === '-') canvas.current?.zoomBy(0.8);
      if (e.key === '0') canvas.current?.fit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doUndo, pattern]);

  const stats = useMemo(() => (pattern ? computeProgress(pattern, progress) : null), [pattern, progress]);

  // measure the floating toolbar so the pattern is never hidden underneath it
  useEffect(() => {
    const el = toolsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setToolsH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!pattern || !stats) {
    return (
      <div className="empty-state">
        <h2>ไม่พบลายนี้</h2>
        <a className="btn primary" href="#/">กลับหน้าแรก</a>
      </div>
    );
  }

  const p = pattern;
  const colors = stats.perColor.filter((c) => c.total > 0);
  const focused = focus != null ? stats.perColor[focus] : null;
  const focusThread = focus != null ? p.palette[focus] : null;
  const complete = stats.total > 0 && stats.done === stats.total;

  const markColor = (value: boolean) => {
    if (focus == null || !focusThread) return;
    const label = [focusThread.brand, focusThread.code].filter(Boolean).join(' ') || focusThread.name;
    if (!confirm(value ? `ทำเครื่องหมายว่าปัก ${label} ครบทุกช่องแล้ว?` : `ล้างเครื่องหมายของ ${label} ทั้งหมด?`)) return;
    onStrokeStart();
    onMark(cellsOfColor(p, focus), value);
  };

  const resetAll = () => {
    if (!confirm('ล้างความคืบหน้าทั้งหมดของลายนี้? (เวลาที่จับไว้และสถิติรายวันจะถูกล้างด้วย)')) return;
    onStrokeStart();
    setTimerSince(null);
    setProgress(emptyProgress(p.cols * p.rows));
  };

  const showRemaining = () => {
    const rest = (focus != null ? cellsOfColor(p, focus) : p.cells.map((_, i) => i).filter((i) => isStitch(p, i)))
      .filter((i) => progress.done.charCodeAt(i) !== 49);
    canvas.current?.showCells(rest);
  };

  return (
    <div className="editor stitch-page">
      <header className="editor-top">
        <a className="icon-btn" href={`#/edit/${p.id}`} title="กลับไปแก้ไขลาย"><Icon name="back" /></a>
        <div className="stitch-title">
          <b>{p.name}</b>
          <small>โหมดปัก</small>
        </div>
        <div className="progress-pill" title={`${stats.done.toLocaleString()} / ${stats.total.toLocaleString()} ฝีเข็ม`}>
          <div className="bar"><i style={{ width: `${stats.pct}%` }} /></div>
          <span>{stats.pct < 10 && stats.pct > 0 ? stats.pct.toFixed(1) : Math.floor(stats.pct)}%</span>
        </div>
        <div className="spacer" />
        <button className={'btn sm timer' + (timerSince != null ? ' on' : '')}
          onClick={() => (timerSince != null ? stopTimer() : setTimerSince(Date.now()))}
          title={timerSince != null ? 'หยุดจับเวลา' : 'เริ่มจับเวลาการปัก'}>
          <Icon name={timerSince != null ? 'pause' : 'play'} size={15} />
          <Clock base={progress.seconds} since={timerSince} />
        </button>
        <a className="icon-btn" href="#/guide/stitch" onClick={flush} title="วิธีใช้โหมดปัก"><Icon name="help" /></a>
        <button className="icon-btn" onClick={() => { flush(); setTransfer(true); }} title="ส่งไปอีกเครื่อง (QR) พร้อมความคืบหน้า">
          <Icon name="phone" />
        </button>
        {wakeSupported && (
          <button className={'icon-btn' + (awake ? ' on' : '')} onClick={() => setAwake(!awake)}
            title={awake ? 'ปิด: ให้หน้าจอดับตามปกติ' : 'เปิดหน้าจอค้างไว้ระหว่างปัก'}>
            <Icon name="sun" />
          </button>
        )}
      </header>

      {transfer && <TransferDialog pattern={{ ...p, progress, updatedAt: Date.now() }} onClose={() => setTransfer(false)} />}
      <div className="editor-main stitch-main">
        <section className="stage">
          <div className="stitch-tools" ref={toolsRef}>
            <div className="seg">
              {MODES.map((m) => (
                <button key={m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)} title={m.hint}>
                  <Icon name={m.icon} size={15} /> <span>{m.label}</span>
                </button>
              ))}
            </div>
            <button className="icon-btn sm bg" onClick={doUndo} disabled={!undo.current.length} title="เลิกทำ (Ctrl/⌘+Z)"><Icon name="undo" size={17} /></button>
            <button className="icon-btn sm bg hide-xs" onClick={() => canvas.current?.zoomBy(1.25)} title="ซูมเข้า"><Icon name="zoomIn" size={17} /></button>
            <button className="icon-btn sm bg hide-xs" onClick={() => canvas.current?.zoomBy(0.8)} title="ซูมออก"><Icon name="zoomOut" size={17} /></button>
            <button className="icon-btn sm bg" onClick={() => canvas.current?.fit()} title="พอดีจอ"><Icon name="fit" size={17} /></button>
            <button className={'icon-btn sm bg' + (grid ? ' on' : '')} onClick={() => setGrid(!grid)} title="เส้นตาราง"><Icon name="grid" size={17} /></button>
            <select className="view-select" value={view} onChange={(e) => setView(e.target.value as ViewMode)} aria-label="มุมมอง">
              <option value="both">สี + สัญลักษณ์</option>
              <option value="color">สี</option>
              <option value="symbol">สัญลักษณ์</option>
              <option value="stitch">ฝีเข็ม</option>
            </select>
          </div>

          <StitchCanvas
            ref={canvas}
            pattern={p}
            done={progress.done}
            focus={focus}
            view={view}
            grid={grid}
            mode={mode}
            insetTop={toolsH}
            onStrokeStart={onStrokeStart}
            onMark={onMark}
          />

          {complete ? (
            <div className="stitch-banner done">
              <span>🎉 ปักครบทุกช่องแล้ว! {progress.seconds > 0 && `ใช้เวลา ${fmtDuration(progress.seconds)}`}</span>
            </div>
          ) : focused && focusThread ? (
            <div className="stitch-banner">
              <span className="sym" style={{ background: focusThread.hex, color: contrastText(focusThread.hex) }}>{focusThread.symbol}</span>
              <span className="grow"><b>{[focusThread.brand, focusThread.code].filter(Boolean).join(' ') || focusThread.name}</b> {focused.done}/{focused.total}</span>
              <button className="btn sm" onClick={showRemaining}><Icon name="target" size={15} /> ช่องที่เหลือ</button>
              <button className="icon-btn sm" onClick={() => setFocus(null)} title="ดูทุกสี (Esc)"><Icon name="close" size={16} /></button>
            </div>
          ) : (
            <div className="stitch-banner hint-only">{MODES.find((m) => m.id === mode)!.hint}</div>
          )}
        </section>

        <aside className="side stitch-side">
          <div className="panel-body">
            <section className="progress-card">
              <div className="big-pct">{stats.pct.toFixed(stats.pct > 0 && stats.pct < 10 ? 1 : 0)}<small>%</small></div>
              <div className="bar lg"><i style={{ width: `${stats.pct}%` }} /></div>
              <div className="stat-grid">
                <div><b>{stats.done.toLocaleString()}</b><span>จาก {stats.total.toLocaleString()} ฝีเข็ม</span></div>
                <div><b>{stats.today.toLocaleString()}</b><span>ฝีเข็มวันนี้</span></div>
                <div><b>{progress.seconds >= 60 ? fmtDuration(progress.seconds) : '—'}</b><span>เวลาที่จับไว้</span></div>
                <div>
                  <b>{stats.etaSeconds != null ? fmtDuration(stats.etaSeconds) : '—'}</b>
                  <span>{stats.rate != null ? `เหลือโดยประมาณ (${Math.round(stats.rate)} ฝีเข็ม/ชม.)` : 'จับเวลา 5 นาทีขึ้นไปเพื่อประมาณเวลา'}</span>
                </div>
              </div>
            </section>

            <h4>แต่ละสี <small>แตะเพื่อปักทีละสี</small></h4>
            <div className="color-progress">
              {colors.map((c) => {
                const t = p.palette[c.index];
                const pct = (c.done / c.total) * 100;
                return (
                  <button key={t.id} className={'cp-row' + (focus === c.index ? ' active' : '') + (c.done === c.total ? ' finished' : '')}
                    onClick={() => setFocus(focus === c.index ? null : c.index)}>
                    <span className="sym" style={{ background: t.hex, color: contrastText(t.hex) }}>{c.done === c.total ? '✓' : t.symbol}</span>
                    <span className="cp-label">
                      <b>{[t.brand, t.code].filter(Boolean).join(' ') || t.name}</b>
                      <small>{t.name}</small>
                      <span className="bar"><i style={{ width: `${pct}%`, background: t.hex }} /></span>
                    </span>
                    <span className="cp-count">{c.done}/{c.total}</span>
                  </button>
                );
              })}
            </div>

            {focus != null && (
              <div className="btn-row">
                <button className="btn sm" onClick={() => markColor(true)}><Icon name="check" size={15} /> สีนี้ปักครบแล้ว</button>
                <button className="btn sm ghost" onClick={() => markColor(false)}>ล้างสีนี้</button>
              </div>
            )}

            <button className="btn sm danger reset-btn" onClick={resetAll}><Icon name="trash" size={15} /> ล้างความคืบหน้าทั้งหมด</button>
            <p className="hint">ความคืบหน้าบันทึกอัตโนมัติในเบราว์เซอร์นี้ และไม่ถูกส่งไปกับลิงก์แชร์ · กด 1–9 เพื่อเลือกสี, Esc เพื่อดูทุกสี</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
