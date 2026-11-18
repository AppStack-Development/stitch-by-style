import { useMemo, useRef, useState } from 'react';
import type { Pattern } from '../types';
import { deletePattern, listPatterns, savePattern } from '../lib/storage';
import { normalizePattern } from '../lib/pattern';
import { uid } from '../lib/threads';
import { computeStats } from '../lib/stats';
import { computeProgress } from '../lib/progress';
import { Thumb } from '../components/Thumb';
import { Icon } from '../components/Icon';
import { LogoMark } from '../components/LogoMark';
import { navigate } from '../App';
import { useInstall } from '../lib/pwa';
import { TEMPLATES } from '../lib/templates';

/**
 * Card art drawn from the real heart-keychain template, so every hole sits exactly
 * where the printable model has one. Holes 2+ cells in from the frame are shown
 * stitched in gold, which traces a smaller heart inside.
 */
function TemplateArt() {
  const { cols, rows, mask, depth } = useMemo(() => {
    const t = TEMPLATES.find((x) => x.id === 'keychain-heart')!;
    const r = t.build(14, Math.round((14 * t.h) / t.w));
    // Chebyshev distance of each hole from the nearest non-hole cell
    const n = r.cols * r.rows;
    const d = new Int32Array(n).fill(1e9);
    const queue: number[] = [];
    for (let i = 0; i < n; i++) if (r.mask[i] !== '2') { d[i] = 0; queue.push(i); }
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q], x = i % r.cols, y = (i / r.cols) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= r.cols || ny >= r.rows) continue;
        const j = ny * r.cols + nx;
        if (d[j] > d[i] + 1) { d[j] = d[i] + 1; queue.push(j); }
      }
    }
    return { ...r, depth: d };
  }, []);
  const s = 6;
  const cells: JSX.Element[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x, k = mask[i];
      if (k === '0') continue;
      const px = x * s, py = y * s;
      // slight overlap hides hairline seams between frame cells
      cells.push(<rect key={'f' + i} x={px - 0.2} y={py - 0.2} width={s + 0.4} height={s + 0.4} fill="#f4f1ea" />);
      if (k !== '2') continue;
      if (depth[i] >= 2) {
        cells.push(
          <g key={'x' + i} stroke="#e9a92c" strokeWidth={1.7} strokeLinecap="round">
            <line x1={px + 1.3} y1={py + 1.3} x2={px + s - 1.3} y2={py + s - 1.3} />
            <line x1={px + s - 1.3} y1={py + 1.3} x2={px + 1.3} y2={py + s - 1.3} stroke="#f6c35a" />
          </g>,
        );
      } else {
        cells.push(<rect key={'h' + i} x={px + 1.6} y={py + 1.6} width={s - 3.2} height={s - 3.2} rx={0.6} fill="#8a8170" />);
      }
    }
  }
  return <svg viewBox={`-3 -3 ${cols * s + 6} ${rows * s + 6}`}>{cells}</svg>;
}

export function Home() {
  const [items, setItems] = useState<Pattern[]>(() => listPatterns());
  const fileRef = useRef<HTMLInputElement>(null);
  const inst = useInstall();
  const [iosHelp, setIosHelp] = useState(false);
  const refresh = () => setItems(listPatterns());

  const importFile = async (f: File) => {
    try {
      let raw: unknown;
      try {
        raw = JSON.parse(await f.text());
      } catch {
        throw new Error('ไฟล์นี้ไม่ใช่ไฟล์ลาย (.json) ที่ส่งออกจาก Stitch by Style');
      }
      const p = normalizePattern(raw);
      const copy = { ...p, id: uid(), updatedAt: Date.now() };
      savePattern(copy);
      navigate(`#/edit/${copy.id}`);
    } catch (e) {
      alert('นำเข้าไม่สำเร็จ: ' + (e as Error).message);
    }
  };

  const duplicate = (p: Pattern) => {
    savePattern({ ...p, id: uid(), name: p.name + ' (สำเนา)', createdAt: Date.now(), updatedAt: Date.now() });
    refresh();
  };

  return (
    <div className="home">
      <header className="site-head">
        <a className="brand" href="#/" aria-label="Stitch by Style หน้าแรก"><LogoMark size={36} /><span className="wordmark">Stitch by Style</span></a>
        <div className="spacer" />
        {(inst.canPrompt || inst.iosManual) && (
          <button className="btn" onClick={() => (inst.canPrompt ? inst.install() : setIosHelp(!iosHelp))} title="ติดตั้งเป็นแอปบนหน้าจอโฮม ใช้งานได้แม้ออฟไลน์">
            <Icon name="install" size={16} /> <span className="hide-xs">ติดตั้งแอป</span>
          </button>
        )}
        <a className="btn ghost" href="#/guide" title="คู่มือการใช้งาน" aria-label="คู่มือการใช้งาน"><Icon name="book" size={16} /> <span className="hide-sm">คู่มือ</span></a>
        <button className="btn ghost" onClick={() => fileRef.current?.click()} title="นำเข้าไฟล์ลาย (.json)" aria-label="นำเข้าไฟล์ลาย"><Icon name="upload" size={16} /> <span className="hide-sm">นำเข้าไฟล์ลาย</span></button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
      </header>

      {iosHelp && (
        <div className="ios-help">
          <span>บน iPhone/iPad: กดปุ่ม <b>แชร์</b> (สี่เหลี่ยมมีลูกศรชี้ขึ้น) ใน Safari แล้วเลือก <b>“เพิ่มไปยังหน้าจอโฮม”</b></span>
          <button className="icon-btn sm" onClick={() => setIosHelp(false)} title="ปิด"><Icon name="close" size={16} /></button>
        </div>
      )}
      <section className="hero">
        <h1>ออกแบบลายปัก<br />สำหรับผ้าและชิ้นงานพิมพ์ 3 มิติ</h1>
        <p>เติมสีลงในช่อง วางแผนด้าย เข็ม และขนาดชิ้นงาน แล้วพิมพ์แผนผังหรือแชร์ให้เพื่อนได้ในคลิกเดียว</p>
      </section>

      <section className="mode-cards">
        <a className="mode-card" href="#/new/free">
          <div className="mode-art free" aria-hidden="true">
            {Array.from({ length: 48 }, (_, i) => <i key={i} style={{ background: [3, 4, 10, 11, 12, 13, 17, 18, 19, 20, 21, 22, 25, 26, 27, 28, 29, 30, 34, 35, 36, 37, 43, 44].includes(i) ? '#c72b3b' : undefined }} />)}
          </div>
          <h3>ออกแบบอิสระ</h3>
          <p>กำหนดขนาดตารางเอง เหมาะกับผ้า Aida หรือวางแผนลายก่อนเลือกชิ้นงาน</p>
          <span className="go">เริ่มออกแบบ →</span>
        </a>
        <a className="mode-card" href="#/new/template">
          <div className="mode-art tpl" aria-hidden="true">
            <TemplateArt />
          </div>
          <h3>ใช้โมเดลแม่แบบ</h3>
          <p>เลือกชิ้นงานพิมพ์ 3D ที่มีรูให้ปัก (พวงกุญแจ ที่คั่นหนังสือ ที่รองแก้ว) หรือนำเข้าไฟล์ STL ของคุณ</p>
          <span className="go">เลือกแม่แบบ →</span>
        </a>
      </section>

      <section className="my-patterns">
        <h2>ลายของฉัน <small>{items.length ? `${items.length} ลาย · บันทึกไว้ในเบราว์เซอร์นี้` : ''}</small></h2>
        {!items.length && <p className="muted">ยังไม่มีลาย เริ่มจากเลือกรูปแบบการทำงานด้านบน</p>}
        <div className="gallery">
          {items.map((p) => {
            const st = computeStats(p);
            const pr = p.progress ? computeProgress(p) : null;
            return (
              <article key={p.id} className="card">
                <a className="card-thumb" href={`#/edit/${p.id}`}><Thumb pattern={p} max={150} view="stitch" /></a>
                <div className="card-body">
                  <a className="card-title" href={`#/edit/${p.id}`}>{p.name}</a>
                  <div className="card-meta">
                    {p.templateName ?? 'ออกแบบอิสระ'} · {p.cols}×{p.rows} · {st.colors.filter((c) => c.count).length} สี
                  </div>
                  {pr && pr.total > 0 && (
                    <div className="card-progress" title={`ปักแล้ว ${pr.done}/${pr.total} ฝีเข็ม`}>
                      <div className="bar"><i style={{ width: `${pr.pct}%` }} /></div>
                      <span>{pr.done === pr.total ? 'ปักเสร็จแล้ว ✓' : `ปักแล้ว ${Math.floor(pr.pct)}%`}</span>
                    </div>
                  )}
                  <div className="card-meta">แก้ไข {new Date(p.updatedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</div>
                </div>
                <div className="card-actions">
                  <a className="btn sm stitch-btn" href={`#/stitch/${p.id}`} title="โหมดปัก"><Icon name="needle" size={15} /> {pr && pr.done > 0 ? 'ปักต่อ' : 'เริ่มปัก'}</a>
                  <span className="spacer" />
                  <a className="icon-btn sm" href={`#/print/${p.id}`} title="พิมพ์"><Icon name="print" size={16} /></a>
                  <button className="icon-btn sm" onClick={() => duplicate(p)} title="ทำสำเนา"><Icon name="copy" size={16} /></button>
                  <button className="icon-btn sm" title="ลบ"
                    onClick={() => { if (confirm(`ลบ "${p.name}" ถาวร?`)) { deletePattern(p.id); refresh(); } }}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
