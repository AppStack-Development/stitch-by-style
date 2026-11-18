import { useEffect, useState } from 'react';
import type { Pattern } from '../types';
import { decodeTransfer } from '../lib/share';
import { loadPattern, savePattern } from '../lib/storage';
import { computeProgress, mergeProgress, sameDesign } from '../lib/progress';
import { uid } from '../lib/threads';
import { Thumb } from '../components/Thumb';
import { Icon } from '../components/Icon';
import { LogoMark } from '../components/LogoMark';
import { navigate } from '../App';

const fmtWhen = (t: number) =>
  new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Receives your own pattern sent from another device (QR / link), merging stitching progress. */
export function TransferView({ data }: { data: string }) {
  const [incoming, setIncoming] = useState<Pattern | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    decodeTransfer(data).then(setIncoming).catch(() => setErr('ลิงก์นี้ไม่ถูกต้องหรือข้อมูลไม่ครบ'));
  }, [data]);

  if (err) return <div className="empty-state"><h2>{err}</h2><a className="btn primary" href="#/">ไปหน้าแรก</a></div>;
  if (!incoming) return <div className="empty-state"><p>กำลังเปิดลาย…</p></div>;

  const local = loadPattern(incoming.id);
  const same = local ? sameDesign(local, incoming) : false;
  const inPct = incoming.progress ? computeProgress(incoming).pct : 0;
  const localPct = local?.progress ? computeProgress(local).pct : 0;
  const merged = local && same ? { ...local, progress: mergeProgress(local.progress, incoming.progress), updatedAt: Date.now() } : null;
  const mergedPct = merged?.progress ? computeProgress(merged).pct : 0;
  const pctLabel = (v: number) => `${v > 0 && v < 10 ? v.toFixed(1) : Math.floor(v)}%`;

  const open = (p: Pattern, where: 'stitch' | 'edit') => {
    if (!savePattern(p)) {
      alert('บันทึกไม่สำเร็จ พื้นที่ในเบราว์เซอร์อาจเต็ม');
      return;
    }
    navigate(`#/${where}/${p.id}`);
  };
  const replace = (where: 'stitch' | 'edit') => {
    if (local && local.updatedAt > incoming.updatedAt &&
      !confirm('ลายในเครื่องนี้แก้ไขล่าสุดหลังจากลิงก์นี้ ต้องการแทนที่ด้วยเวอร์ชันจากลิงก์หรือไม่?')) return;
    open({ ...incoming, updatedAt: Date.now() }, where);
  };
  const keepBoth = () => open({ ...incoming, id: uid(), name: `${incoming.name} (จากอีกเครื่อง)`, createdAt: Date.now(), updatedAt: Date.now() }, 'edit');

  return (
    <div className="shared">
      <header className="site-head">
        <a className="brand" href="#/" aria-label="Stitch by Style หน้าแรก"><LogoMark size={36} /><span className="wordmark">Stitch by Style</span></a>
      </header>
      <div className="shared-body">
        <div className="preview-card"><Thumb pattern={incoming} max={400} view="stitch" /></div>
        <div className="form-card">
          <p className="muted"><Icon name="phone" size={15} /> ลายที่ส่งมาจากอีกเครื่อง</p>
          <h1>{incoming.name}</h1>
          <p className="hint">
            {incoming.cols}×{incoming.rows} ช่อง · ส่งมาเมื่อ {fmtWhen(incoming.updatedAt)}
            {incoming.progress ? ` · ปักแล้ว ${pctLabel(inPct)}` : ''}
          </p>

          {!local && (
            <>
              <p className="ok">ลายนี้ยังไม่มีในเครื่องนี้ จะบันทึกไว้พร้อมความคืบหน้า</p>
              <div className="btn-row">
                <button className="btn primary" onClick={() => open(incoming, 'stitch')}><Icon name="needle" size={16} /> เปิดในโหมดปัก</button>
                <button className="btn" onClick={() => open(incoming, 'edit')}><Icon name="edit" size={16} /> เปิดในตัวแก้ไข</button>
              </div>
            </>
          )}

          {local && same && merged && (
            <>
              <div className="merge-box">
                <div><span>เครื่องนี้</span><b>{pctLabel(localPct)}</b></div>
                <div><span>จากลิงก์</span><b>{pctLabel(inPct)}</b></div>
                <div className="arrow">→</div>
                <div className="result"><span>รวมกัน</span><b>{pctLabel(mergedPct)}</b></div>
              </div>
              <p className="hint">มีลายนี้ในเครื่องอยู่แล้ว ช่องที่ทำเครื่องหมายว่าปักแล้วในเครื่องใดเครื่องหนึ่งจะนับว่าปักแล้ว</p>
              <div className="btn-row">
                <button className="btn primary" onClick={() => open(merged, 'stitch')}><Icon name="needle" size={16} /> รวมความคืบหน้าแล้วปักต่อ</button>
                <button className="btn" onClick={() => open(merged, 'edit')}>รวมแล้วเปิดตัวแก้ไข</button>
              </div>
            </>
          )}

          {local && !same && (
            <>
              <p className="error">
                ลายในเครื่องนี้ถูกแก้ไขต่างจากลิงก์ (ในเครื่องนี้แก้ล่าสุด {fmtWhen(local.updatedAt)})
              </p>
              <div className="btn-row">
                <button className="btn primary" onClick={() => replace('stitch')}>ใช้เวอร์ชันจากลิงก์</button>
                <button className="btn" onClick={keepBoth}><Icon name="copy" size={16} /> เก็บไว้ทั้งสองแบบ</button>
                <a className="btn ghost" href={`#/edit/${local.id}`}>ใช้ของเครื่องนี้</a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
