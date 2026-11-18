import { useMemo, useState } from 'react';
import type { Pattern, ThreadColor } from '../types';
import { DMC_SORTED, SYMBOLS, contrastText, makeThread } from '../lib/threads';
import { colorSortKey } from '../lib/dmc';
import { nearestDmc } from '../lib/imageImport';
import { computeStats } from '../lib/stats';
import { Icon } from './Icon';

const FAMILIES: { id: string; label: string; buckets: number[] | 'neutral' }[] = [
  { id: 'all', label: 'ทั้งหมด', buckets: [] },
  { id: 'red', label: 'แดง/ชมพู', buckets: [0, 11] },
  { id: 'orange', label: 'ส้ม/น้ำตาล', buckets: [1] },
  { id: 'yellow', label: 'เหลือง/ทอง', buckets: [2] },
  { id: 'green', label: 'เขียว', buckets: [3, 4, 5] },
  { id: 'blue', label: 'ฟ้า/น้ำเงิน', buckets: [6, 7, 8] },
  { id: 'purple', label: 'ม่วง', buckets: [9, 10] },
  { id: 'neutral', label: 'ขาว/เทา/ดำ', buckets: 'neutral' },
];

function inFamily(hex: string, fam: (typeof FAMILIES)[number]): boolean {
  if (fam.id === 'all') return true;
  const [neutral, bucket] = colorSortKey(hex);
  if (fam.buckets === 'neutral') return neutral === 1;
  return neutral === 0 && fam.buckets.includes(bucket);
}

interface Props {
  pattern: Pattern;
  active: number;
  setActive: (i: number) => void;
  /** replace palette; optional remap(oldIndex) -> newIndex for cells */
  onPalette: (palette: ThreadColor[], remap?: (i: number) => number) => void;
}

/** Offer the closest real DMC thread for a palette colour that isn't one already. */
function DmcSuggest({ color, onApply }: { color: ThreadColor; onApply: (d: { hex: string; name: string; code: string }) => void }) {
  const best = useMemo(() => nearestDmc(color.hex, 1)[0], [color.hex]);
  if (color.brand === 'DMC' && color.code === best.code) return null;
  return (
    <div className="dmc-suggest">
      <span className="dot" style={{ background: best.hex }} />
      <span>ด้ายที่ใกล้ที่สุด: <b>DMC {best.code}</b> {best.name} <small>(ΔE {best.dE.toFixed(1)})</small></span>
      <button className="btn sm" onClick={() => onApply(best)}>ใช้สีนี้</button>
    </div>
  );
}

export function PalettePanel({ pattern: p, active, setActive, onPalette }: Props) {
  const [editing, setEditing] = useState<number | null>(null);
  const [lib, setLib] = useState(false);
  const [q, setQ] = useState('');
  const [family, setFamily] = useState('all');
  const [probe, setProbe] = useState('#c8507a');
  const stats = useMemo(() => computeStats(p), [p]);

  const update = (i: number, patch: Partial<ThreadColor>) =>
    onPalette(p.palette.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const remove = (i: number) => {
    const count = stats.colors[i]?.count ?? 0;
    if (count > 0 && !confirm(`สีนี้ใช้อยู่ ${count} ช่อง ต้องการลบและล้างช่องเหล่านั้นหรือไม่?`)) return;
    onPalette(p.palette.filter((_, j) => j !== i), (k) => (k === i ? -1 : k > i ? k - 1 : k));
    setEditing(null);
    if (active >= p.palette.length - 1) setActive(Math.max(0, p.palette.length - 2));
  };

  const add = (t: Partial<ThreadColor> & { hex: string }) => {
    const exists = p.palette.findIndex((c) => c.code && c.code === t.code && c.brand === t.brand);
    if (exists >= 0) {
      setActive(exists);
      return;
    }
    onPalette([...p.palette, makeThread(t, p.palette)]);
    setActive(p.palette.length);
  };

  const fam = FAMILIES.find((f) => f.id === family)!;
  const ql = q.trim().toLowerCase();
  const filtered = DMC_SORTED.filter(
    (d) => inFamily(d.hex, fam) && (!ql || d.code.toLowerCase().includes(ql) || d.name.toLowerCase().includes(ql)),
  );
  const inPalette = new Set(p.palette.filter((c) => c.brand === 'DMC').map((c) => c.code));
  const probeMatches = useMemo(() => nearestDmc(probe, 6), [probe]);

  return (
    <div className="panel-body">
      <div className="palette-list">
        {p.palette.map((c, i) => (
          <div key={c.id} className={'palette-row' + (i === active ? ' active' : '')}>
            <button className="swatch" style={{ background: c.hex, color: contrastText(c.hex) }}
              onClick={() => setActive(i)} title={`เลือกสี (${i < 9 ? 'กด ' + (i + 1) : ''})`}>
              {c.symbol}
            </button>
            <button className="palette-label" onClick={() => setActive(i)}>
              <span className="pl-code">{[c.brand, c.code].filter(Boolean).join(' ') || 'กำหนดเอง'}</span>
              <span className="pl-name">{c.name}</span>
            </button>
            <span className="pl-count" title="จำนวนฝีเข็ม">{stats.colors[i]?.count ?? 0}</span>
            <button className="icon-btn sm" onClick={() => setEditing(editing === i ? null : i)} title="แก้ไขสี">
              <Icon name="edit" size={15} />
            </button>
            {editing === i && (
              <div className="palette-edit">
                <label>สี<input type="color" value={c.hex} onChange={(e) => update(i, { hex: e.target.value })} /></label>
                <label>ชื่อสี<input value={c.name} onChange={(e) => update(i, { name: e.target.value })} /></label>
                <div className="row2">
                  <label>ยี่ห้อ<input value={c.brand} onChange={(e) => update(i, { brand: e.target.value })} placeholder="DMC, Anchor…" /></label>
                  <label>รหัสสี<input value={c.code} onChange={(e) => update(i, { code: e.target.value })} /></label>
                </div>
                <label>สัญลักษณ์ในแผนผัง
                  <select value={c.symbol} onChange={(e) => update(i, { symbol: e.target.value })}>
                    {SYMBOLS.map((s) => (
                      <option key={s} value={s} disabled={s !== c.symbol && p.palette.some((o) => o.symbol === s)}>{s}</option>
                    ))}
                  </select>
                </label>
                <DmcSuggest color={c} onApply={(d) => update(i, { hex: d.hex, name: d.name, code: d.code, brand: 'DMC' })} />
                <button className="btn danger sm" onClick={() => remove(i)}><Icon name="trash" size={15} /> ลบสีนี้</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="palette-add">
        <button className="btn sm" onClick={() => setLib(!lib)}><Icon name="palette" size={15} /> เลือกจากด้าย DMC</button>
        <label className="btn sm ghost color-add">
          <Icon name="plus" size={15} /> สีกำหนดเอง
          <input type="color" onChange={(e) => add({ hex: e.target.value, name: 'สีกำหนดเอง ' + e.target.value })} />
        </label>
      </div>
      {lib && (
        <div className="lib">
          <div className="probe">
            <label className="probe-pick" title="เลือกสีที่ต้องการ แล้วระบบจะหาด้าย DMC ที่ใกล้ที่สุด">
              <input type="color" value={probe} onChange={(e) => setProbe(e.target.value)} />
            </label>
            <div className="probe-body">
              <b>หาด้ายที่ใกล้สีนี้</b>
              <div className="probe-list">
                {probeMatches.map((d) => (
                  <button key={d.code} className="lib-chip" title={`DMC ${d.code} ${d.name} · ต่างกัน ΔE ${d.dE.toFixed(1)}`}
                    onClick={() => add({ hex: d.hex, name: d.name, code: d.code, brand: 'DMC' })}>
                    <span style={{ background: d.hex }} />{d.code}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <input className="lib-search" placeholder="ค้นหารหัสหรือชื่อสี เช่น 310, red, rose" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="fam-row">
            {FAMILIES.map((f) => (
              <button key={f.id} className={'chip sm' + (family === f.id ? ' on' : '')} onClick={() => setFamily(f.id)}>{f.label}</button>
            ))}
          </div>
          <div className="lib-grid">
            {filtered.map((d) => (
              <button key={d.code} className={'lib-chip' + (inPalette.has(d.code) ? ' have' : '')} title={`DMC ${d.code} ${d.name}`}
                onClick={() => add({ hex: d.hex, name: d.name, code: d.code, brand: 'DMC' })}>
                <span style={{ background: d.hex }} />
                {d.code}
              </button>
            ))}
            {!filtered.length && <p className="muted">ไม่พบสีที่ค้นหา</p>}
          </div>
          <p className="hint">แสดง {filtered.length} จาก {DMC_SORTED.length} สี · ขีดเส้นใต้ = มีในจานสีแล้ว · สีบนจอเป็นค่าประมาณ ควรเทียบกับการ์ดสีจริงก่อนซื้อด้าย</p>
        </div>
      )}
    </div>
  );
}
