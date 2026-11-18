import { useRef, useState } from 'react';
import type { Pattern } from '../types';
import { deletePattern, listPatterns, savePattern } from '../lib/storage';
import { normalizePattern } from '../lib/pattern';
import { uid } from '../lib/threads';
import { computeStats } from '../lib/stats';
import { computeProgress } from '../lib/progress';
import { Thumb } from '../components/Thumb';
import { Icon } from '../components/Icon';
import { navigate } from '../App';

export function Home() {
  const [items, setItems] = useState<Pattern[]>(() => listPatterns());
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => setItems(listPatterns());

  const importFile = async (f: File) => {
    try {
      const p = normalizePattern(JSON.parse(await f.text()));
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
        <a className="brand" href="#/">
          <span className="brand-mark"><Icon name="close" size={18} /></span>
          Stitch by Style
        </a>
        <div className="spacer" />
        <button className="btn ghost" onClick={() => fileRef.current?.click()}><Icon name="upload" size={16} /> นำเข้าไฟล์ลาย</button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
      </header>

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
            <svg viewBox="0 0 120 80"><path d="M60 74 C20 48 14 30 24 18 C34 6 52 10 60 24 C68 10 86 6 96 18 C106 30 100 48 60 74Z" fill="#f4f1ea" stroke="#243b6b" strokeWidth="3" />
              {Array.from({ length: 30 }, (_, i) => { const x = 30 + (i % 6) * 12, y = 22 + Math.floor(i / 6) * 10; return <rect key={i} x={x} y={y} width="5" height="5" rx="1" fill={i % 7 === 2 || i % 5 === 1 ? '#f2b33d' : '#8a8170'} opacity={(x - 60) ** 2 / 1300 + (y - 40) ** 2 / 700 < 1 ? 1 : 0} />; })}
            </svg>
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
