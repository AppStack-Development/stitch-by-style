import { useMemo, useState } from 'react';
import type { BaseType } from '../types';
import { TEMPLATES, freeMask, type TemplateDef } from '../lib/templates';
import { createPattern } from '../lib/pattern';
import { savePattern } from '../lib/storage';
import type { ModelPart, PartAnalysis, StlAnalysis } from '../lib/stlImport';

// the model importer pulls in three.js + fflate: load it only when a file is chosen
const importer = () => import('../lib/stlImport');
import { needleHint } from '../lib/stats';
import { Thumb } from '../components/Thumb';
import { Icon } from '../components/Icon';
import { navigate } from '../App';

const blank = (cols: number, rows: number, mask: string, baseType: BaseType = 'print3d') => ({
  cols, rows, mask, cells: new Array(cols * rows).fill(-1), palette: [],
  details: { filamentColor: '#f4f1ea', baseType },
});

export function NewPattern({ mode }: { mode: 'free' | 'template' }) {
  return (
    <div className="newp">
      <header className="site-head">
        <a className="icon-btn" href="#/" title="กลับ"><Icon name="back" /></a>
        <h2>{mode === 'free' ? 'ออกแบบอิสระ' : 'เลือกโมเดลแม่แบบ'}</h2>
        <div className="spacer" />
        <a className="btn ghost" href={mode === 'free' ? '#/new/template' : '#/new/free'}>
          {mode === 'free' ? 'ใช้โมเดลแม่แบบแทน' : 'ออกแบบอิสระแทน'}
        </a>
      </header>
      {mode === 'free' ? <FreeForm /> : <TemplatePicker />}
    </div>
  );
}

function FreeForm() {
  const [name, setName] = useState('ลายใหม่');
  const [cols, setCols] = useState(40);
  const [rows, setRows] = useState(40);
  const [base, setBase] = useState<BaseType>('aida');
  const [count, setCount] = useState(14);
  const [pitch, setPitch] = useState(3);
  const pitchMm = base === 'aida' ? 25.4 / count : base === 'plastic-canvas' ? 25.4 / 7 : pitch;
  const clamp = (v: number) => Math.max(4, Math.min(200, Math.round(v) || 4));

  const create = () => {
    const p = createPattern({
      name, mode: 'free', cols, rows, mask: freeMask(cols, rows), pitchMm: +pitchMm.toFixed(3),
      details: { baseType: base, aidaCount: count, needleSize: base === 'aida' ? (count >= 16 ? '#26' : '#24') : '#22', strands: base === 'aida' ? 2 : 4 },
    });
    savePattern(p);
    navigate(`#/edit/${p.id}`);
  };

  return (
    <div className="new-layout">
      <div className="form-card">
        <label>ชื่อลาย<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <div className="presets">
          {[[20, 20], [30, 30], [40, 40], [60, 60], [80, 60], [100, 100]].map(([c, r]) => (
            <button key={c + 'x' + r} className={'chip' + (c === cols && r === rows ? ' on' : '')} onClick={() => { setCols(c); setRows(r); }}>{c}×{r}</button>
          ))}
        </div>
        <div className="row2">
          <label>กว้าง (ช่อง)<input type="number" value={cols} min={4} max={200} onChange={(e) => setCols(clamp(+e.target.value))} /></label>
          <label>สูง (ช่อง)<input type="number" value={rows} min={4} max={200} onChange={(e) => setRows(clamp(+e.target.value))} /></label>
        </div>
        <label>พื้นที่จะใช้ปัก
          <select value={base} onChange={(e) => setBase(e.target.value as BaseType)}>
            <option value="aida">ผ้า Aida</option>
            <option value="plastic-canvas">แผ่น Plastic canvas (7 ct)</option>
            <option value="print3d">ชิ้นงานพิมพ์ 3 มิติ</option>
            <option value="other">อื่นๆ (กำหนดระยะเอง)</option>
          </select>
        </label>
        {base === 'aida' && (
          <label>ความถี่ผ้า
            <select value={count} onChange={(e) => setCount(+e.target.value)}>
              {[11, 14, 16, 18, 20].map((c) => <option key={c} value={c}>{c} ct</option>)}
            </select>
          </label>
        )}
        {(base === 'print3d' || base === 'other') && (
          <label>ระยะห่างระหว่างช่อง (มม.)<input type="number" step={0.1} min={0.8} value={pitch} onChange={(e) => setPitch(+e.target.value || 3)} /></label>
        )}
        <p className="hint">ขนาดชิ้นงานจริง ≈ {(cols * pitchMm).toFixed(0)} × {(rows * pitchMm).toFixed(0)} มม. · {needleHint(pitchMm)}</p>
        <button className="btn primary lg" onClick={create}>สร้างลาย <Icon name="check" size={16} /></button>
      </div>
      <div className="preview-card">
        <Thumb pattern={blank(cols, rows, freeMask(cols, rows), base)} max={420} view="color" grid />
      </div>
    </div>
  );
}

function TemplatePicker() {
  const [sel, setSel] = useState<TemplateDef | 'stl'>(TEMPLATES[0]);
  const [w, setW] = useState(TEMPLATES[0].w);
  const [h, setH] = useState(TEMPLATES[0].h);
  const [pitch, setPitch] = useState(3);
  const [holeRatio, setHoleRatio] = useState(0.55);
  const [thick, setThick] = useState(2);
  const [name, setName] = useState('');
  /** imported model: every part analysed, one selected */
  const [stl, setStl] = useState<{ file: string; parts: ModelPart[]; analyses: PartAnalysis[]; sel: number; err: string } | null>(null);
  const [stlPitch, setStlPitch] = useState('');
  const [busy, setBusy] = useState(false);
  const stlRes: StlAnalysis | null = stl && stl.sel >= 0 ? stl.analyses[stl.sel].result : null;

  const pick = (t: TemplateDef) => {
    setSel(t);
    setW(t.w);
    setH(t.h);
  };
  const setWidth = (v: number) => {
    if (sel === 'stl') return;
    const nw = Math.max(sel.min, Math.min(sel.max, Math.round(v)));
    setW(nw);
    if (sel.lockAspect) setH(Math.round((nw * sel.h) / sel.w));
  };

  const built = useMemo(() => {
    if (sel === 'stl') return stlRes ? { cols: stlRes.cols, rows: stlRes.rows, mask: stlRes.mask } : null;
    return sel.build(w, h);
  }, [sel, w, h, stlRes]);

  const applyResult = (res: StlAnalysis, partName: string) => {
    setPitch(res.pitchMm);
    setHoleRatio(res.holeRatio);
    setThick(res.thicknessMm);
    setStlPitch(String(res.pitchMm));
    setName((n) => n || partName);
  };

  const loadStl = async (f: File) => {
    setBusy(true);
    const buf = await f.arrayBuffer();
    const { readModelFile, analyzeParts, bestPart } = await importer();
    // let the "analysing" state paint before the (synchronous) work
    setTimeout(() => {
      try {
        const parts = readModelFile(f.name, buf);
        const analyses = analyzeParts(parts);
        const best = bestPart(analyses);
        setStl({
          file: f.name, parts, analyses, sel: best,
          err: best < 0 ? (parts.length > 1 ? `ไม่พบรูสำหรับปักในทั้ง ${parts.length} ชิ้นของไฟล์นี้` : analyses[0].error) : '',
        });
        setName('');
        if (best >= 0) applyResult(analyses[best].result!, analyses[best].part.name);
      } catch (e) {
        setStl({ file: f.name, parts: [], analyses: [], sel: -1, err: (e as Error).message });
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  const choosePart = (i: number) => {
    if (!stl || !stl.analyses[i].result) return;
    setStl({ ...stl, sel: i });
    setName('');
    applyResult(stl.analyses[i].result!, stl.analyses[i].part.name);
  };

  const reanalyse = async (override?: number) => {
    if (!stl || stl.sel < 0) return;
    const { analyzeParts } = await importer();
    const [a] = analyzeParts([stl.parts[stl.sel]], override);
    setStl({ ...stl, analyses: stl.analyses.map((x, i) => (i === stl.sel ? a : x)), err: a.result ? '' : a.error });
    if (a.result) applyResult(a.result, a.part.name);
  };

  const create = () => {
    if (!built) return;
    const part = stl && stl.sel >= 0 ? stl.parts[stl.sel] : null;
    const tname = sel === 'stl'
      ? `${stl?.file ?? ''}${part && stl!.parts.length > 1 ? ` · ${part.name}` : ''}`
      : sel.name;
    const p = createPattern({
      name: name || (sel === 'stl' ? 'ลายจากโมเดล' : `ลาย${sel.name}`),
      mode: 'template',
      templateId: sel === 'stl' ? 'stl' : sel.id,
      templateName: tname,
      cols: built.cols, rows: built.rows, mask: built.mask, pitchMm: pitch,
      details: { baseType: 'print3d', holeRatio, thicknessMm: thick, strands: pitch >= 2.4 ? 4 : 2, needleSize: pitch >= 2.4 ? '#22' : '#24' },
    });
    savePattern(p);
    navigate(`#/edit/${p.id}`);
  };

  const holes = built ? built.mask.split('').filter((c) => c === '2').length : 0;

  return (
    <div className="new-layout tpl">
      <div className="tpl-grid">
        {TEMPLATES.map((t) => {
          const r = t.build(t.w, t.h);
          return (
            <button key={t.id} className={'tpl-card' + (sel !== 'stl' && sel.id === t.id ? ' on' : '')} onClick={() => pick(t)}>
              <div className="tpl-thumb"><Thumb pattern={blank(r.cols, r.rows, r.mask)} max={96} view="stitch" /></div>
              <b>{t.name}</b>
              <small>{t.description}</small>
            </button>
          );
        })}
        <label className={'tpl-card stl' + (sel === 'stl' ? ' on' : '')} onClick={() => setSel('stl')}>
          <div className="tpl-thumb"><Icon name="upload" size={34} /></div>
          <b>นำเข้าไฟล์ STL / 3MF</b>
          <small>ตรวจหารูปักจากโมเดลของคุณอัตโนมัติ (รองรับไฟล์จาก MakerWorld)</small>
          <input type="file" accept=".stl,.3mf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setSel('stl'); loadStl(f); } e.target.value = ''; }} />
        </label>
      </div>

      <div className="form-card">
        {sel === 'stl' ? (
          <>
            <h3>นำเข้าโมเดล STL / 3MF</h3>
            {!stl && !busy && <p className="muted">เลือกไฟล์ .stl หรือ .3mf ของชิ้นงานที่มีรูเรียงเป็นตาราง เช่น ฝากล่อง ที่คั่นหนังสือ พวงกุญแจ ระบบจะหาชิ้นที่มีรูและแปลงเป็นช่องสำหรับเติมสี</p>}
            {busy && <p className="muted">กำลังวิเคราะห์โมเดล…</p>}
            {stl && stl.parts.length > 1 && (
              <div className="part-pick">
                <span className="muted">ไฟล์นี้มี {stl.parts.length} ชิ้น เลือกชิ้นที่จะปัก:</span>
                {stl.analyses.map((a, i) => (
                  <button key={i} className={'part-chip' + (i === stl.sel ? ' on' : '')} disabled={!a.result} onClick={() => choosePart(i)}
                    title={`${a.part.name} · ${a.result ? `${a.result.holeCount} รู` : 'ไม่พบรูสำหรับปัก'}`}>
                    <b>{a.part.name}</b>
                    <small>{a.result ? `${a.result.holeCount.toLocaleString()} รู` : 'ไม่มีรู'}</small>
                  </button>
                ))}
              </div>
            )}
            {stl?.err && <p className="error">{stl.err}</p>}
            {stlRes && (
              <p className="ok">พบ {stlRes.holeCount.toLocaleString()} รู · ตาราง {stlRes.cols}×{stlRes.rows} · ชิ้นงาน {stlRes.widthMm.toFixed(1)}×{stlRes.heightMm.toFixed(1)} มม. · แผ่นหนา {stlRes.thicknessMm} มม.</p>
            )}
            {stlRes && (
              <div className="row2 end">
                <label>ระยะห่างรู (มม.)<input value={stlPitch} onChange={(e) => setStlPitch(e.target.value)} /></label>
                <button className="btn" onClick={() => reanalyse(+stlPitch || undefined)}>วิเคราะห์ใหม่</button>
              </div>
            )}
            <label className="btn ghost file-btn">
              <Icon name="upload" size={16} /> {stl ? 'เลือกไฟล์อื่น' : 'เลือกไฟล์ STL / 3MF'}
              <input type="file" accept=".stl,.3mf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) loadStl(f); e.target.value = ''; }} />
            </label>
          </>
        ) : (
          <>
            <h3>{sel.name}</h3>
            <label>ความกว้าง: {w} ช่อง
              <input type="range" min={sel.min} max={sel.max} value={w} onChange={(e) => setWidth(+e.target.value)} />
            </label>
            {!sel.lockAspect && (
              <label>ความสูง: {h} ช่อง
                <input type="range" min={sel.min} max={sel.max * 2} value={h} onChange={(e) => setH(+e.target.value)} />
              </label>
            )}
            <div className="row2">
              <label>ระยะห่างรู (มม.)<input type="number" step={0.1} min={1} max={8} value={pitch} onChange={(e) => setPitch(+e.target.value || 3)} /></label>
              <label>ความหนา (มม.)<input type="number" step={0.2} min={0.6} max={8} value={thick} onChange={(e) => setThick(+e.target.value || 2)} /></label>
            </div>
          </>
        )}
        <label>ชื่อลาย<input value={name} onChange={(e) => setName(e.target.value)} placeholder="ตั้งชื่อภายหลังได้" /></label>
        {built && (
          <p className="hint">
            ขนาด ≈ {(built.cols * pitch).toFixed(1)} × {(built.rows * pitch).toFixed(1)} มม. · {holes} ช่องปัก · {needleHint(pitch)}
          </p>
        )}
        <button className="btn primary lg" disabled={!built} onClick={create}>เริ่มออกแบบบนแม่แบบนี้ <Icon name="check" size={16} /></button>
      </div>

      <div className="preview-card">
        {built ? <Thumb pattern={blank(built.cols, built.rows, built.mask)} max={360} view="stitch" grid /> : <p className="muted">ยังไม่มีตัวอย่าง</p>}
        <div className="legend-mini">
          <span><i className="k2" /> ช่องปัก</span><span><i className="k1" /> โครงทึบ</span><span><i className="k0" /> นอกชิ้นงาน</span>
        </div>
      </div>
    </div>
  );
}
