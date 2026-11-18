import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HoleBrush, Pattern, ThreadColor, Tool, ViewMode } from '../types';
import { loadPattern, savePattern } from '../lib/storage';
import { computeStats } from '../lib/stats';
import { exportPng } from '../lib/render';
import { buildPlate, toBinaryStl } from '../lib/plate';
import { downloadBlob, safeFilename, shareUrl } from '../lib/share';
import { contrastText } from '../lib/threads';
import { PatternCanvas, type CanvasHandle } from '../components/PatternCanvas';
import { PalettePanel } from '../components/PalettePanel';
import { DetailsPanel } from '../components/DetailsPanel';
import { TransferDialog } from '../components/TransferDialog';

// three.js is large: load the 3D preview only when its tab is opened
const Preview3D = lazy(() => import('../components/Preview3D').then((m) => ({ default: m.Preview3D })));
import { Icon, type IconName } from '../components/Icon';
import { ImageImportDialog } from '../components/ImageImportDialog';
import { computeProgress, reconcileProgress } from '../lib/progress';
import { navigate } from '../App';

type Snap = Pick<Pattern, 'cells' | 'mask' | 'palette'>;

const TOOLS: { id: Tool; icon: IconName; label: string; key: string }[] = [
  { id: 'pencil', icon: 'pencil', label: 'ดินสอ', key: 'B' },
  { id: 'eraser', icon: 'eraser', label: 'ยางลบ', key: 'E' },
  { id: 'fill', icon: 'fill', label: 'เทสี', key: 'G' },
  { id: 'picker', icon: 'picker', label: 'ดูดสี', key: 'I' },
  { id: 'line', icon: 'line', label: 'เส้นตรง', key: 'L' },
  { id: 'rect', icon: 'rect', label: 'กรอบสี่เหลี่ยม', key: 'R' },
  { id: 'pan', icon: 'pan', label: 'เลื่อนมุมมอง (กด Space ค้าง)', key: 'H' },
  { id: 'hole', icon: 'hole', label: 'แก้ไขช่องปัก/โครง', key: 'K' },
];

export function Editor({ id }: { id: string }) {
  const [pattern, setPattern] = useState<Pattern | null>(() => loadPattern(id));
  const [tool, setTool] = useState<Tool>('pencil');
  const [active, setActive] = useState(0);
  const [holeBrush, setHoleBrush] = useState<HoleBrush>('2');
  const [view, setView] = useState<ViewMode>('stitch');
  const [grid, setGrid] = useState(true);
  const [mirrorX, setMirrorX] = useState(false);
  const [mirrorY, setMirrorY] = useState(false);
  const [tab, setTab] = useState<'palette' | 'details' | '3d'>('palette');
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState('');
  /** image import dialog: closed (null), open empty, or open with a file */
  const [imgImport, setImgImport] = useState<{ file: File | null } | null>(null);
  const [transfer, setTransfer] = useState(false);
  const undo = useRef<Snap[]>([]);
  const redo = useRef<Snap[]>([]);
  const [, force] = useState(0);
  const canvas = useRef<CanvasHandle>(null);
  const first = useRef(true);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  };

  // autosave
  useEffect(() => {
    if (!pattern) return;
    if (first.current) {
      first.current = false;
      return;
    }
    setSaveState('saving');
    const t = setTimeout(() => {
      const ok = savePattern({ ...pattern, updatedAt: Date.now() });
      setSaveState(ok ? 'saved' : 'error');
    }, 500);
    return () => clearTimeout(t);
  }, [pattern]);

  const current = useRef(pattern);
  current.current = pattern;

  const snapshot = useCallback(() => {
    const p = current.current;
    if (!p) return;
    undo.current.push({ cells: p.cells, mask: p.mask, palette: p.palette });
    if (undo.current.length > 150) undo.current.shift();
    redo.current = [];
    force((n) => n + 1);
  }, []);

  const restore = useCallback((from: React.MutableRefObject<Snap[]>, to: React.MutableRefObject<Snap[]>) => {
    const p = current.current;
    const s = from.current.pop();
    if (!p || !s) return;
    to.current.push({ cells: p.cells, mask: p.mask, palette: p.palette });
    const next = { ...p, ...s };
    current.current = next;
    setPattern(next);
  }, []);
  const doUndo = useCallback(() => restore(undo, redo), [restore]);
  const doRedo = useCallback(() => restore(redo, undo), [restore]);

  const onPalette = useCallback((palette: ThreadColor[], remap?: (i: number) => number) => {
    snapshot();
    setPattern((p) => (p ? { ...p, palette, cells: remap ? p.cells.map((c) => (c < 0 ? c : remap(c))) : p.cells } : p));
  }, [snapshot]);

  // paste an image anywhere in the editor -> open the import dialog
  useEffect(() => {
    if (imgImport) return;
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'));
      if (f) { e.preventDefault(); setImgImport({ file: f }); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [imgImport]);

  // keyboard shortcuts
  useEffect(() => {
    if (imgImport) return;
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? doRedo() : doUndo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); return; }
      if (mod) return;
      const t = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
      if (t) { setTool(t.id); return; }
      if (/^[1-9]$/.test(e.key) && pattern && +e.key <= pattern.palette.length) { setActive(+e.key - 1); return; }
      if (e.key === '+' || e.key === '=') canvas.current?.zoomBy(1.25);
      if (e.key === '-') canvas.current?.zoomBy(0.8);
      if (e.key === '0') canvas.current?.fit();
      if (e.key.toLowerCase() === 'x') setMirrorX((v) => !v);
      if (e.key.toLowerCase() === 'y') setMirrorY((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doUndo, doRedo, pattern, imgImport]);

  const stats = useMemo(() => (pattern ? computeStats(pattern) : null), [pattern]);

  if (!pattern || !stats) {
    return (
      <div className="empty-state">
        <h2>ไม่พบลายนี้</h2>
        <p>ลายอาจถูกลบไปแล้ว หรือบันทึกไว้ในเบราว์เซอร์อื่น</p>
        <a className="btn primary" href="#/">กลับหน้าแรก</a>
      </div>
    );
  }

  const p = pattern;
  const activeColor = p.palette[active];
  const hoverKind = hover ? p.mask[hover.y * p.cols + hover.x] : null;
  const hoverColor = hover ? p.palette[p.cells[hover.y * p.cols + hover.x]] : undefined;

  const doExport = async (kind: 'print' | 'png' | 'json' | 'stl' | 'share' | 'transfer') => {
    setMenu(false);
    savePattern({ ...p, updatedAt: Date.now() });
    const fname = safeFilename(p.name);
    if (kind === 'print') navigate(`#/print/${p.id}`);
    if (kind === 'transfer') setTransfer(true);
    if (kind === 'png') downloadBlob(await exportPng(p, view === 'symbol' ? 'symbol' : 'color'), `${fname}.png`);
    if (kind === 'json') downloadBlob(new Blob([JSON.stringify(p, null, 1)], { type: 'application/json' }), `${fname}.stitch.json`);
    if (kind === 'stl') {
      const thick = p.details.thicknessMm;
      downloadBlob(toBinaryStl(buildPlate(p, thick, p.details.holeRatio), p.name), `${fname}.stl`);
      flash('ดาวน์โหลดไฟล์ STL แล้ว นำไปเปิดในโปรแกรม slicer ได้เลย');
    }
    if (kind === 'share') {
      const url = await shareUrl(p);
      try {
        await navigator.clipboard.writeText(url);
        flash(`คัดลอกลิงก์แชร์แล้ว (${(url.length / 1024).toFixed(1)} KB)`);
      } catch {
        prompt('คัดลอกลิงก์นี้เพื่อแชร์', url);
      }
    }
  };

  return (
    <div className="editor">
      <header className="editor-top">
        <a className="icon-btn" href="#/" title="กลับหน้าแรก"><Icon name="back" /></a>
        <input className="name-input" value={p.name} onChange={(e) => setPattern({ ...p, name: e.target.value })} aria-label="ชื่อลาย" />
        <span className={'save-state ' + saveState}>
          {saveState === 'saved' ? 'บันทึกแล้ว' : saveState === 'saving' ? 'กำลังบันทึก…' : 'บันทึกไม่สำเร็จ (พื้นที่เต็ม?)'}
        </span>
        <div className="spacer" />
        <button className="btn ghost sm img-btn" onClick={() => setImgImport({ file: null })} title="แปลงรูปภาพเป็นลายปัก (หรือลากรูปมาวาง / Ctrl+V)">
          <Icon name="image" size={16} /> <span>รูปภาพ → ลาย</span>
        </button>
        <div className="seg" role="group" aria-label="มุมมอง">
          {([['stitch', 'ฝีเข็ม'], ['color', 'สี'], ['symbol', 'สัญลักษณ์']] as const).map(([v, l]) => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>
        <button className="icon-btn" onClick={doUndo} disabled={!undo.current.length} title="เลิกทำ (Ctrl/⌘+Z)"><Icon name="undo" /></button>
        <button className="icon-btn" onClick={doRedo} disabled={!redo.current.length} title="ทำซ้ำ (Shift+Ctrl/⌘+Z)"><Icon name="redo" /></button>
        <a className="btn sm stitch-btn" href={`#/stitch/${p.id}`} onClick={() => savePattern({ ...p, updatedAt: Date.now() })}
          title="เปิดโหมดปัก: ติ๊กช่องที่ปักแล้ว ดูความคืบหน้าแต่ละสี">
          <Icon name="needle" size={16} /> <span>โหมดปัก{p.progress ? ` · ${Math.floor(computeProgress(p).pct)}%` : ''}</span>
        </a>
        <div className="menu-wrap">
          <button className="btn primary" onClick={() => setMenu(!menu)}><Icon name="download" size={16} /> ส่งออก / แชร์</button>
          {menu && (
            <div className="menu" onMouseLeave={() => setMenu(false)}>
              <button onClick={() => doExport('print')}><Icon name="print" /> <span><b>พิมพ์ / บันทึกเป็น PDF</b><small>แผนผัง + รายการด้าย + รายละเอียด</small></span></button>
              <button onClick={() => doExport('png')}><Icon name="image" /> <span><b>รูปภาพ PNG</b><small>สำหรับส่งให้เพื่อนทาง LINE / โซเชียล</small></span></button>
              <button onClick={() => doExport('transfer')}><Icon name="phone" /> <span><b>ส่งไปมือถือ / อีกเครื่อง</b><small>สแกน QR เพื่อปักต่อในมือถือ (รวมความคืบหน้า)</small></span></button>
              <button onClick={() => doExport('share')}><Icon name="link" /> <span><b>คัดลอกลิงก์แชร์</b><small>เพื่อนเปิดดูและบันทึกต่อได้</small></span></button>
              <button onClick={() => doExport('json')}><Icon name="file" /> <span><b>ไฟล์ลาย (.json)</b><small>สำรองข้อมูล / นำเข้าเครื่องอื่น</small></span></button>
              <button onClick={() => doExport('stl')}><Icon name="cube" /> <span><b>โมเดล 3D (.stl)</b><small>แผ่นเจาะรูตามรูปทรงนี้ สำหรับพิมพ์</small></span></button>
            </div>
          )}
        </div>
      </header>

      <div className="editor-main">
        <aside className="toolbar">
          {TOOLS.map((t) => (
            <button key={t.id} className={'tool' + (tool === t.id ? ' on' : '')} onClick={() => setTool(t.id)} title={`${t.label} (${t.key})`}>
              <Icon name={t.icon} size={20} />
            </button>
          ))}
          <div className="tool-sep" />
          <button className={'tool' + (mirrorX ? ' on' : '')} onClick={() => setMirrorX(!mirrorX)} title="สมมาตรซ้าย-ขวา (X)"><Icon name="mirrorX" size={20} /></button>
          <button className={'tool' + (mirrorY ? ' on' : '')} onClick={() => setMirrorY(!mirrorY)} title="สมมาตรบน-ล่าง (Y)"><Icon name="mirrorY" size={20} /></button>
          <button className={'tool' + (grid ? ' on' : '')} onClick={() => setGrid(!grid)} title="เส้นตาราง"><Icon name="grid" size={20} /></button>
          <div className="tool-sep" />
          <button className="tool" onClick={() => canvas.current?.zoomBy(1.25)} title="ซูมเข้า (+)"><Icon name="zoomIn" size={20} /></button>
          <button className="tool" onClick={() => canvas.current?.zoomBy(0.8)} title="ซูมออก (−)"><Icon name="zoomOut" size={20} /></button>
          <button className="tool" onClick={() => canvas.current?.fit()} title="พอดีจอ (0)"><Icon name="fit" size={20} /></button>
        </aside>

        <section className="stage"
          onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
          onDrop={(e) => {
            const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/'));
            if (f) { e.preventDefault(); setImgImport({ file: f }); }
          }}>
          {tool === 'hole' && (
            <div className="hole-bar">
              <span>แก้ไขรูปทรงชิ้นงาน:</span>
              {([['2', 'ช่องปัก'], ['1', 'โครงทึบ'], ['0', 'ตัดออก']] as const).map(([k, l]) => (
                <button key={k} className={'chip k' + k + (holeBrush === k ? ' on' : '')} onClick={() => setHoleBrush(k)}>{l}</button>
              ))}
            </div>
          )}
          <PatternCanvas
            ref={canvas}
            pattern={p}
            view={view}
            grid={grid}
            tool={tool}
            active={active}
            holeBrush={holeBrush}
            mirrorX={mirrorX}
            mirrorY={mirrorY}
            onStrokeStart={snapshot}
            onChange={(cells, mask) => setPattern((cur) => (cur ? reconcileProgress({ ...cur, cells, mask }, cur.cells) : cur))}
            onPick={(i) => { setActive(i); setTool('pencil'); }}
            onHover={setHover}
          />
          <footer className="status">
            {activeColor && (
              <span className="status-color">
                <span className="dot lg" style={{ background: activeColor.hex, color: contrastText(activeColor.hex) }}>{activeColor.symbol}</span>
                {[activeColor.brand, activeColor.code].filter(Boolean).join(' ')} {activeColor.name}
              </span>
            )}
            <span>{hover ? `คอลัมน์ ${hover.x + 1}, แถว ${hover.y + 1}` : '—'}</span>
            {hover && <span>{hoverKind === '2' ? (hoverColor ? `ปักแล้ว: ${hoverColor.code || hoverColor.name}` : 'ช่องว่าง') : hoverKind === '1' ? 'โครงทึบ' : 'นอกชิ้นงาน'}</span>}
            <span className="spacer" />
            <span>{stats.total.toLocaleString()} / {stats.holes.toLocaleString()} ช่อง</span>
            <span>{stats.widthMm.toFixed(0)}×{stats.heightMm.toFixed(0)} มม.</span>
            <span className="kbd-hint">คลิกขวา = ลบ</span>
          </footer>
          {toast && <div className="toast">{toast}</div>}
        </section>

        <aside className="side">
          <nav className="tabs">
            <button className={tab === 'palette' ? 'on' : ''} onClick={() => setTab('palette')}><Icon name="palette" size={16} /> สีด้าย</button>
            <button className={tab === 'details' ? 'on' : ''} onClick={() => setTab('details')}><Icon name="info" size={16} /> รายละเอียด</button>
            <button className={tab === '3d' ? 'on' : ''} onClick={() => setTab('3d')}><Icon name="cube" size={16} /> 3D</button>
          </nav>
          {tab === 'palette' && <PalettePanel pattern={p} active={active} setActive={setActive} onPalette={onPalette} />}
          {tab === 'details' && <DetailsPanel pattern={p} onChange={(patch) => setPattern({ ...p, ...patch })} />}
          {tab === '3d' && (
            <Suspense fallback={<div className="preview3d"><p className="muted">กำลังโหลดภาพ 3 มิติ…</p></div>}>
              <Preview3D pattern={p} />
            </Suspense>
          )}
        </aside>
      </div>
      {transfer && <TransferDialog pattern={p} onClose={() => setTransfer(false)} />}
      {imgImport && (
        <ImageImportDialog
          pattern={p}
          initialFile={imgImport.file}
          onClose={() => setImgImport(null)}
          onApply={(cells, palette, summary) => {
            snapshot();
            setPattern(reconcileProgress({ ...p, cells, palette }, p.cells));
            setActive(0);
            setTab('palette');
            setImgImport(null);
            flash(summary);
          }}
        />
      )}
    </div>
  );
}
