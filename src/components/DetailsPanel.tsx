import { useMemo, useState } from 'react';
import type { Pattern, PatternDetails } from '../types';
import { BASE_LABEL, DIFFICULTY_LABEL, STITCH_LABEL } from '../lib/pattern';
import { computeStats, fmtInch, fmtMm, needleHint } from '../lib/stats';

interface Props {
  pattern: Pattern;
  onChange: (patch: Partial<Pattern>) => void;
}

export function DetailsPanel({ pattern: p, onChange }: Props) {
  const d = p.details;
  const stats = useMemo(() => computeStats(p), [p]);
  const [tagText, setTagText] = useState(d.tags.join(', '));
  const set = (patch: Partial<PatternDetails>) => onChange({ details: { ...d, ...patch } });
  const used = stats.colors.filter((c) => c.count > 0);
  const skeins = used.reduce((a, c) => a + Math.max(0.1, c.skeins), 0);
  const is3d = d.baseType === 'print3d';

  return (
    <div className="panel-body details">
      <section className="stat-grid">
        <div><b>{stats.widthMm.toFixed(1)}×{stats.heightMm.toFixed(1)}</b><span>มม. ({fmtInch(stats.widthMm)}×{fmtInch(stats.heightMm)})</span></div>
        <div><b>{p.cols}×{p.rows}</b><span>ช่องตาราง</span></div>
        <div><b>{stats.total.toLocaleString()}</b><span>ฝีเข็ม / {stats.holes.toLocaleString()} ช่องปักได้</span></div>
        <div><b>{used.length}</b><span>สี · ~{skeins.toFixed(1)} ไจ</span></div>
      </section>

      <h4>ข้อมูลลาย</h4>
      <label>ชื่อลาย<input value={p.name} onChange={(e) => onChange({ name: e.target.value })} /></label>
      <label>คำอธิบาย<textarea rows={2} value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="แรงบันดาลใจ, ใช้ทำอะไร" /></label>
      <div className="row2">
        <label>ผู้ออกแบบ<input value={d.author} onChange={(e) => set({ author: e.target.value })} /></label>
        <label>ระดับความยาก
          <select value={d.difficulty} onChange={(e) => set({ difficulty: e.target.value as PatternDetails['difficulty'] })}>
            {Object.entries(DIFFICULTY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
      <div className="row2">
        <label>แท็ก (คั่นด้วย ,)
          <input value={tagText} onChange={(e) => setTagText(e.target.value)}
            onBlur={() => set({ tags: tagText.split(',').map((t) => t.trim()).filter(Boolean) })} placeholder="ดอกไม้, ของขวัญ" />
        </label>
        <label>เวลาที่ใช้โดยประมาณ<input value={d.estHours} onChange={(e) => set({ estHours: e.target.value })} placeholder="เช่น 3 ชม." /></label>
      </div>

      <h4>วัสดุพื้น</h4>
      <label>ประเภทพื้นที่ใช้ปัก
        <select value={d.baseType} onChange={(e) => {
          const baseType = e.target.value as PatternDetails['baseType'];
          const patch: Partial<Pattern> = { details: { ...d, baseType } };
          if (baseType === 'aida') patch.pitchMm = +(25.4 / d.aidaCount).toFixed(3);
          if (baseType === 'plastic-canvas') patch.pitchMm = +(25.4 / 7).toFixed(3);
          onChange(patch);
        }}>
          {Object.entries(BASE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      {d.baseType === 'aida' ? (
        <label>ความถี่ผ้า (count ต่อนิ้ว)
          <select value={d.aidaCount} onChange={(e) => {
            const aidaCount = +e.target.value;
            onChange({ details: { ...d, aidaCount }, pitchMm: +(25.4 / aidaCount).toFixed(3) });
          }}>
            {[11, 14, 16, 18, 20, 22].map((c) => <option key={c} value={c}>{c} ct ({(25.4 / c).toFixed(2)} มม./ช่อง)</option>)}
          </select>
        </label>
      ) : (
        <label>ระยะห่างระหว่างรู (มม.)
          <input type="number" step={0.05} min={0.8} max={10} value={p.pitchMm}
            onChange={(e) => onChange({ pitchMm: Math.max(0.5, +e.target.value || p.pitchMm) })} />
        </label>
      )}
      {is3d && (
        <>
          <div className="row2">
            <label>เส้นพลาสติก<input value={d.filament} onChange={(e) => set({ filament: e.target.value })} list="filaments" /></label>
            <label>สีชิ้นงาน<input type="color" value={d.filamentColor} onChange={(e) => set({ filamentColor: e.target.value })} /></label>
          </div>
          <datalist id="filaments">{['PLA', 'PETG', 'TPU', 'PLA Matte', 'PLA Silk'].map((f) => <option key={f} value={f} />)}</datalist>
          <div className="row2">
            <label>ความหนาแผ่น (มม.)<input type="number" step={0.2} min={0.6} max={8} value={d.thicknessMm} onChange={(e) => set({ thicknessMm: +e.target.value || 2 })} /></label>
            <label>ขนาดรู ({Math.round(d.holeRatio * 100)}% ของช่อง)
              <input type="range" min={0.3} max={0.8} step={0.05} value={d.holeRatio} onChange={(e) => set({ holeRatio: +e.target.value })} />
            </label>
          </div>
          <p className="hint">รูกว้าง ≈ {(p.pitchMm * d.holeRatio).toFixed(2)} มม., ขอบระหว่างรู ≈ {(p.pitchMm * (1 - d.holeRatio)).toFixed(2)} มม. {p.pitchMm * (1 - d.holeRatio) < 0.8 && '⚠️ บางเกินไปสำหรับหัวพิมพ์ 0.4 มม.'}</p>
        </>
      )}

      <h4>ด้ายและเข็ม</h4>
      <label>รูปแบบการปัก
        <select value={d.stitchType} onChange={(e) => set({ stitchType: e.target.value as PatternDetails['stitchType'] })}>
          {Object.entries(STITCH_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <div className="row2">
        <label>ยี่ห้อด้าย<input value={d.threadBrand} onChange={(e) => set({ threadBrand: e.target.value })} list="brands" /></label>
        <label>จำนวนเส้นด้าย<input type="number" min={1} max={12} value={d.strands} onChange={(e) => set({ strands: Math.max(1, +e.target.value || 1) })} /></label>
      </div>
      <datalist id="brands">{['DMC', 'Anchor', 'Cosmo', 'Madeira', 'ไหมพรม', 'ด้ายทั่วไป'].map((f) => <option key={f} value={f} />)}</datalist>
      <div className="row2">
        <label>ชนิดเข็ม<input value={d.needleType} onChange={(e) => set({ needleType: e.target.value })} list="needles" /></label>
        <label>เบอร์เข็ม<input value={d.needleSize} onChange={(e) => set({ needleSize: e.target.value })} list="needleSizes" /></label>
      </div>
      <datalist id="needles">{['เข็มปลายมน (Tapestry)', 'เข็มปลายแหลม (Embroidery)', 'เข็มพลาสติก', 'เข็มร้อยไหมพรม'].map((f) => <option key={f} value={f} />)}</datalist>
      <datalist id="needleSizes">{['#18', '#20', '#22', '#24', '#26', '#28'].map((f) => <option key={f} value={f} />)}</datalist>
      <p className="hint">{needleHint(p.pitchMm)}</p>

      <h4>บันทึก / ขั้นตอน</h4>
      <textarea rows={4} value={d.notes} onChange={(e) => set({ notes: e.target.value })}
        placeholder={'เช่น\n1. เริ่มปักจากจุดกึ่งกลาง (ลูกศรแดง)\n2. ปักสีเข้มก่อน\n3. เก็บปลายด้ายด้านหลัง'} />

      {used.length > 0 && (
        <>
          <h4>ปริมาณด้ายโดยประมาณ</h4>
          <table className="mini-table">
            <thead><tr><th></th><th>สี</th><th>ฝีเข็ม</th><th>ความยาว*</th><th>ไจ</th></tr></thead>
            <tbody>
              {used.map((c) => {
                const t = p.palette[c.index];
                return (
                  <tr key={t.id}>
                    <td><span className="dot" style={{ background: t.hex }} /></td>
                    <td>{[t.brand, t.code].filter(Boolean).join(' ') || t.name}</td>
                    <td>{c.count}</td>
                    <td>{c.strandM.toFixed(1)} ม.</td>
                    <td>{Math.max(0.1, c.skeins).toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="hint">*ความยาวรวมของด้ายเส้นเดี่ยว ({d.strands} เส้น) รวมเผื่อเก็บปลาย 20% · 1 ไจ = 8 ม. × 6 เส้น · ขนาดชิ้นงาน {fmtMm(stats.widthMm)} × {fmtMm(stats.heightMm)}</p>
        </>
      )}
    </div>
  );
}
