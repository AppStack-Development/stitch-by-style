import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { StitchArt } from '../components/StitchArt';
import { askConfirm } from '../components/ConfirmDialog';
import type { Pattern, Progress, ViewMode } from '../types';
import { draftState, openPattern, persist, saveDraft, unkeep, type DraftState } from '../lib/drafts';
import { ActionToast, DraftBar } from '../components/DraftBar';
import {
  cellsOfColor, computeProgress, emptyProgress, fmtClock, fmtDuration, getProgress, isStitch, markCells, todayKey,
} from '../lib/progress';
import { contrastText } from '../lib/threads';
import { StitchCanvas, type MarkMode, type StitchCanvasHandle } from '../components/StitchCanvas';
import { Icon, type IconName } from '../components/Icon';
import { TransferDialog } from '../components/TransferDialog';
import { t } from '../lib/i18n';

const MODES: { id: MarkMode; icon: IconName; label: string; hint: string }[] = [
  { id: 'tap', icon: 'tap', label: t('แตะ', 'Tap'), hint: t('แตะช่องเพื่อทำเครื่องหมาย · ลากเพื่อเลื่อน', 'Tap a cell to mark it · drag to pan') },
  { id: 'paint', icon: 'pencil', label: t('ระบาย', 'Paint'), hint: t('ลากผ่านหลายช่องเพื่อทำเครื่องหมาย · ใช้ 2 นิ้วเพื่อเลื่อน/ซูม', 'Drag across cells to mark them · use 2 fingers to pan/zoom') },
  { id: 'region', icon: 'fill', label: t('ทั้งกลุ่ม', 'Area'), hint: t('แตะครั้งเดียว ทำเครื่องหมายช่องสีเดียวกันที่ติดกันทั้งกลุ่ม', 'One tap marks a whole connected area of the same color') },
];

const ones = (s: string) => {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 49) n++;
  return n;
};

/** A short burst of crosses in the finished thread's colours (hidden when the device asks for less motion). */
function CrossBurst({ colors, big }: { colors: string[]; big: boolean }) {
  const n = big ? 26 : 14;
  return (
    <div className={'cross-burst' + (big ? ' big' : '')} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + (i % 2 ? 0.22 : 0);
        const d = (big ? 72 : 46) + ((i * 37) % 30);
        return (
          <i key={i} style={{
            color: colors[i % colors.length],
            '--dx': `${Math.round(Math.cos(a) * d)}px`, '--dy': `${Math.round(Math.sin(a) * d - 16)}px`, '--r': `${((i * 67) % 200) - 100}deg`,
          } as CSSProperties}>✕</i>
        );
      })}
    </div>
  );
}

/** Live clock for the running timer, kept separate so the canvas doesn't re-render every second. */
function Clock({ base, since }: { base: number; since: number | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (since == null) return;
    const iv = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, [since]);
  return <>{fmtClock(base + (since == null ? 0 : (Date.now() - since) / 1000))}</>;
}

export function StitchMode({ id }: { id: string }) {
  const [pattern] = useState<Pattern | null>(() => openPattern(id));
  const [progress, setProgress] = useState<Progress>(() => (pattern ? getProgress(pattern) : emptyProgress(0)));
  /** what the page opened with: only a change from this counts (and saves) */
  const openedWith = useRef(progress);
  /** only trying it (lib/drafts.ts): saved into My patterns on the first change */
  const [dstate, setDstate] = useState<DraftState>(() => draftState(id));
  const [savedNote, setSavedNote] = useState(false);
  const closeSavedNote = useCallback(() => setSavedNote(false), []);
  const [focus, setFocus] = useState<number | null>(null);
  const [mode, setMode] = useState<MarkMode>('tap');
  const [view, setView] = useState<ViewMode>('both');
  const [grid, setGrid] = useState(true);
  const [timerSince, setTimerSince] = useState<number | null>(null);
  const [awake, setAwake] = useState(false);
  // a short note when the keep-awake button is toggled, so its meaning is clear on phones too (no hover)
  const [awakeNote, setAwakeNote] = useState('');
  const awakeTimer = useRef<number>();
  const sayAwake = (msg: string) => {
    setAwakeNote(msg);
    window.clearTimeout(awakeTimer.current);
    awakeTimer.current = window.setTimeout(() => setAwakeNote(''), 2500);
  };
  useEffect(() => () => window.clearTimeout(awakeTimer.current), []);
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
    // a change while trying a pattern is the sign they want it: it goes into My patterns now
    if (persist({ ...pattern, progress: progressRef.current, updatedAt: Date.now() }, true) === 'saved-now') {
      setDstate('saved');
      setSavedNote(true);
    }
  }, [pattern]);

  const saveNow = () => {
    if (!pattern) return;
    dirty.current = false;
    if (saveDraft({ ...pattern, progress: progressRef.current, updatedAt: Date.now() })) {
      setDstate('saved');
      setSavedNote(true);
    }
  };
  const dontKeep = () => {
    if (!pattern) return;
    unkeep({ ...pattern, progress: progressRef.current, updatedAt: Date.now() });
    setDstate('declined');
    setSavedNote(false);
  };

  // save shortly after each change, and on leave
  useEffect(() => {
    if (!pattern) return;
    if (progress === openedWith.current) return;
    dirty.current = true;
    const tm = setTimeout(flush, 400);
    return () => clearTimeout(tm);
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
    const request = async (first: boolean) => {
      try {
        lock = await (navigator as any).wakeLock.request('screen');
        if (first && live) sayAwake(t('หน้าจอจะเปิดค้างไว้ ไม่ดับระหว่างปัก', 'The screen stays on while you stitch'));
      } catch {
        if (!live) return;
        setAwake(false);
        sayAwake(t('เปิดหน้าจอค้างไม่ได้ตอนนี้ (เบราว์เซอร์ไม่อนุญาต หรือแบตเตอรี่เหลือน้อย)', 'Couldn’t keep the screen on (the browser refused, or the battery is low)'));
      }
    };
    request(true);
    const onVis = () => { if (document.visibilityState === 'visible' && live) request(false); };
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

  // a little celebration when a colour (or the whole pattern) becomes finished; not on load, not on undo
  const [cheer, setCheer] = useState<{ id: number; colors: string[]; big: boolean; text: string } | null>(null);
  const prevDone = useRef<number[] | null>(null);
  useEffect(() => {
    if (!pattern || !stats) return;
    const prev = prevDone.current;
    prevDone.current = stats.perColor.map((c) => c.done);
    if (!prev) return;
    const finished = stats.perColor.filter((c, i) => c.total > 0 && c.done === c.total && (prev[i] ?? 0) < c.total);
    if (!finished.length) return;
    const all = stats.total > 0 && stats.done === stats.total;
    const left = stats.perColor.filter((c) => c.total > 0 && c.done < c.total).length;
    const thr = pattern.palette[finished[0].index];
    const label = [thr.brand, thr.code].filter(Boolean).join(' ') || thr.name;
    setCheer({
      id: Date.now(),
      big: all,
      colors: (all ? stats.perColor.filter((c) => c.total > 0) : finished).map((c) => pattern.palette[c.index].hex),
      text: all ? '' : t(`ปักครบ ${label} แล้ว${left ? ` · เหลืออีก ${left} สี` : ''}`, `${label} done${left ? ` · ${left} more to go` : ''}`),
    });
  }, [stats, pattern]);
  useEffect(() => {
    if (!cheer) return;
    const tm = setTimeout(() => setCheer(null), 3200);
    return () => clearTimeout(tm);
  }, [cheer]);

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
        <StitchArt kind="lost" />
        <h2>{t('ไม่พบลายนี้', 'Pattern not found')}</h2>
        <p className="muted">{t('ลายอาจถูกลบไปแล้ว บันทึกไว้ในเบราว์เซอร์อื่น หรือเป็นลายที่ลองไว้ในแท็บที่ปิดไปแล้ว', 'It may have been deleted, saved in a different browser, or only tried in a tab that’s now closed.')}</p>
        <a className="btn primary" href="#/">{t('กลับหน้าแรก', 'Back to home')}</a>
      </div>
    );
  }

  const p = pattern;
  const colors = stats.perColor.filter((c) => c.total > 0);
  const focused = focus != null ? stats.perColor[focus] : null;
  const focusThread = focus != null ? p.palette[focus] : null;
  const complete = stats.total > 0 && stats.done === stats.total;

  const markColor = async (value: boolean) => {
    if (focus == null || !focusThread) return;
    const label = [focusThread.brand, focusThread.code].filter(Boolean).join(' ') || focusThread.name;
    if (!(await askConfirm(value
      ? { title: t(`ปัก ${label} ครบแล้ว?`, `Done with ${label}?`), message: <p>{t(`ทุกช่องสี ${label} จะถูกทำเครื่องหมายว่าปักแล้ว`, `Every ${label} cell is marked as stitched.`)}</p>,
          ok: t('ทำเครื่องหมายครบ', 'Mark all done'), icon: 'check' }
      : { title: t(`ล้างเครื่องหมายของ ${label}?`, `Clear the marks for ${label}?`), message: <p>{t(`ทุกช่องสี ${label} จะกลับเป็นยังไม่ได้ปัก`, `Every ${label} cell goes back to not stitched.`)}</p>,
          ok: t('ล้างเครื่องหมาย', 'Clear marks'), tone: 'danger', icon: 'undo' }))) return;
    onStrokeStart();
    onMark(cellsOfColor(p, focus), value);
  };

  const resetAll = async () => {
    if (!(await askConfirm({
      title: t('ล้างความคืบหน้าทั้งหมด?', 'Clear all progress?'),
      message: <p>{t('เครื่องหมายทุกช่อง เวลาที่จับไว้ และสถิติรายวันของลายนี้จะถูกล้าง', 'Every mark, the tracked time and the daily stats for this pattern are cleared.')}</p>,
      ok: t('ล้างความคืบหน้า', 'Clear progress'),
      tone: 'danger',
    }))) return;
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
        <a className="icon-btn" href={`#/edit/${p.id}`} title={t('กลับไปแก้ไขลาย', 'Back to editor')}><Icon name="back" /></a>
        <div className="stitch-title">
          <b>{p.name}</b>
          <small>{t('โหมดปัก', 'Stitch mode')}</small>
        </div>
        <div className="progress-pill" title={t(`${stats.done.toLocaleString()} / ${stats.total.toLocaleString()} ฝีเข็ม`, `${stats.done.toLocaleString()} / ${stats.total.toLocaleString()} stitches`)}>
          <div className="bar"><i style={{ width: `${stats.pct}%` }} /></div>
          <span>{stats.pct < 10 && stats.pct > 0 ? stats.pct.toFixed(1) : Math.floor(stats.pct)}%</span>
        </div>
        <div className="spacer" />
        <button className={'btn sm timer' + (timerSince != null ? ' on' : '')}
          onClick={() => (timerSince != null ? stopTimer() : setTimerSince(Date.now()))}
          title={timerSince != null ? t('หยุดจับเวลา', 'Stop timer') : t('เริ่มจับเวลาการปัก', 'Start stitching timer')}>
          <Icon name={timerSince != null ? 'pause' : 'play'} size={15} />
          <span className="timer-num"><Clock base={progress.seconds} since={timerSince} /></span>
        </button>
        <a className="icon-btn" href="#/guide/stitch" onClick={flush} title={t('วิธีใช้โหมดปัก', 'Stitch mode help')}><Icon name="help" /></a>
        <button className="btn sm send-btn" onClick={() => { flush(); setTransfer(true); }} title={t('ส่งไปอีกเครื่อง (QR) พร้อมความคืบหน้า', 'Send to another device (QR) with progress')}
          aria-label={t('ส่งไปมือถือ', 'Send to phone')}>
          <Icon name="sendOut" size={16} />
          <span className="hide-xs">{t('ส่งไปมือถือ', 'Send to phone')}</span>
        </button>
      </header>

      {dstate !== 'saved' && <DraftBar state={dstate} kind="stitch" onSave={saveNow} />}
      {savedNote && <ActionToast text={t('บันทึกไว้ในลายของฉันแล้ว', 'Saved to My patterns')} action={t('ไม่เก็บ', 'Don’t keep')}
        onAction={dontKeep} onClose={closeSavedNote} />}
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
            <button className="icon-btn sm bg" onClick={doUndo} disabled={!undo.current.length} title={t('เลิกทำ (Ctrl/⌘+Z)', 'Undo (Ctrl/⌘+Z)')}><Icon name="undo" size={17} /></button>
            <button className="icon-btn sm bg hide-xs" onClick={() => canvas.current?.zoomBy(1.25)} title={t('ซูมเข้า', 'Zoom in')}><Icon name="zoomIn" size={17} /></button>
            <button className="icon-btn sm bg hide-xs" onClick={() => canvas.current?.zoomBy(0.8)} title={t('ซูมออก', 'Zoom out')}><Icon name="zoomOut" size={17} /></button>
            <button className="icon-btn sm bg" onClick={() => canvas.current?.fit()} title={t('พอดีจอ', 'Fit to screen')}><Icon name="fit" size={17} /></button>
            <button className={'icon-btn sm bg' + (grid ? ' on' : '')} onClick={() => setGrid(!grid)} title={t('เส้นตาราง', 'Grid lines')}><Icon name="grid" size={17} /></button>
            <select className="view-select" value={view} onChange={(e) => setView(e.target.value as ViewMode)} aria-label={t('มุมมอง', 'View')}>
              <option value="both">{t('สี + สัญลักษณ์', 'Color + symbol')}</option>
              <option value="color">{t('สี', 'Color')}</option>
              <option value="symbol">{t('สัญลักษณ์', 'Symbol')}</option>
              <option value="stitch">{t('ฝีเข็ม', 'Stitches')}</option>
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

          {cheer && <CrossBurst key={cheer.id} colors={cheer.colors} big={cheer.big} />}
          {!complete && cheer?.text ? (
            <div className="stitch-banner done" role="status"><span>✓ {cheer.text}</span></div>
          ) : complete ? (
            <div className="stitch-banner done">
              <span>🎉 {t('ปักครบทุกช่องแล้ว!', 'All stitched!')} {progress.seconds > 0 && t(`ใช้เวลา ${fmtDuration(progress.seconds)}`, `Time spent: ${fmtDuration(progress.seconds)}`)}</span>
            </div>
          ) : focused && focusThread ? (
            <div className="stitch-banner">
              <span className="sym" style={{ background: focusThread.hex, color: contrastText(focusThread.hex) }}>{focusThread.symbol}</span>
              <span className="grow"><b>{[focusThread.brand, focusThread.code].filter(Boolean).join(' ') || focusThread.name}</b> {focused.done}/{focused.total}</span>
              <button className="btn sm" onClick={showRemaining}><Icon name="target" size={15} /> {t('ช่องที่เหลือ', 'Remaining')}</button>
              <button className="icon-btn sm" onClick={() => setFocus(null)} title={t('ดูทุกสี (Esc)', 'Show all colors (Esc)')}><Icon name="close" size={16} /></button>
            </div>
          ) : (
            <div className="stitch-banner hint-only">{MODES.find((m) => m.id === mode)!.hint}</div>
          )}
          {awakeNote && <div className="toast" role="status">{awakeNote}</div>}
        </section>

        <aside className="side stitch-side">
          <div className="panel-body">
            <section className="progress-card">
              <div className="big-pct">{stats.pct.toFixed(stats.pct > 0 && stats.pct < 10 ? 1 : 0)}<small>%</small></div>
              <div className="bar lg"><i style={{ width: `${stats.pct}%` }} /></div>
              <div className="stat-grid">
                <div><b>{stats.done.toLocaleString()}</b><span>{t(`จาก ${stats.total.toLocaleString()} ฝีเข็ม`, `of ${stats.total.toLocaleString()} stitches`)}</span></div>
                <div><b>{stats.today.toLocaleString()}</b><span>{t('ฝีเข็มวันนี้', 'stitches today')}</span></div>
                <div><b>{progress.seconds >= 60 ? fmtDuration(progress.seconds) : '—'}</b><span>{t('เวลาที่จับไว้', 'time tracked')}</span></div>
                <div>
                  <b>{stats.etaSeconds != null ? fmtDuration(stats.etaSeconds) : '—'}</b>
                  <span>{stats.rate != null ? t(`เหลือโดยประมาณ (${Math.round(stats.rate)} ฝีเข็ม/ชม.)`, `est. remaining (${Math.round(stats.rate)} stitches/hr)`) : t('จับเวลา 5 นาทีขึ้นไปเพื่อประมาณเวลา', 'Track 5+ min for an estimate')}</span>
                </div>
              </div>
              {wakeSupported && (
                <button type="button" role="switch" aria-checked={awake} className={'awake-row' + (awake ? ' on' : '')}
                  onClick={() => {
                    const next = !awake;
                    setAwake(next);
                    // "on" is announced once the browser grants it (see the wake-lock effect)
                    if (!next) sayAwake(t('หน้าจอจะดับตามปกติ', 'The screen will sleep as usual'));
                  }}>
                  <span className="sw" aria-hidden="true" />
                  <span className="awake-text">
                    <b>{t('จอไม่ดับ', 'Keep screen on')}{awake && <em className="awake-pill">{t('เปิดอยู่', 'On')}</em>}</b>
                    <small>{t('กันหน้าจอดับระหว่างปัก', 'Stops the screen going dark while you stitch')}</small>
                  </span>
                </button>
              )}
            </section>

            <h4>{t(<>แต่ละสี <small>แตะเพื่อปักทีละสี</small></>, <>By color <small>tap to stitch one color at a time</small></>)}</h4>
            <div className="color-progress">
              {colors.map((c) => {
                const thr = p.palette[c.index];
                const pct = (c.done / c.total) * 100;
                return (
                  <button key={thr.id} className={'cp-row' + (focus === c.index ? ' active' : '') + (c.done === c.total ? ' finished' : '')}
                    onClick={() => setFocus(focus === c.index ? null : c.index)}>
                    <span className="sym" style={{ background: thr.hex, color: contrastText(thr.hex) }}>{c.done === c.total ? '✓' : thr.symbol}</span>
                    <span className="cp-label">
                      <b>{[thr.brand, thr.code].filter(Boolean).join(' ') || thr.name}</b>
                      <small>{thr.name}</small>
                      <span className="bar"><i style={{ width: `${pct}%`, background: thr.hex }} /></span>
                    </span>
                    <span className="cp-count">{c.done}/{c.total}</span>
                  </button>
                );
              })}
            </div>

            {focus != null && (
              <div className="btn-row">
                <button className="btn sm" onClick={() => markColor(true)}><Icon name="check" size={15} /> {t('สีนี้ปักครบแล้ว', 'Color done')}</button>
                <button className="btn sm ghost" onClick={() => markColor(false)}>{t('ล้างสีนี้', 'Clear color')}</button>
              </div>
            )}

            <button className="btn sm danger reset-btn" onClick={resetAll}><Icon name="trash" size={15} /> {t('ล้างความคืบหน้าทั้งหมด', 'Clear all progress')}</button>
            <p className="hint">{t('ความคืบหน้าบันทึกอัตโนมัติในเบราว์เซอร์นี้ และไม่ถูกส่งไปกับลิงก์แชร์ · กด 1–9 เพื่อเลือกสี, Esc เพื่อดูทุกสี', 'Progress saves automatically in this browser and is not included in share links · press 1–9 to pick a color, Esc to show all')}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
