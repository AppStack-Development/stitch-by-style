import { useEffect, useState } from 'react';
import { StitchLoader } from '../components/StitchLoader';
import { askConfirm } from '../components/ConfirmDialog';
import type { Pattern } from '../types';
import { decodeTransfer } from '../lib/share';
import { loadPattern, savePattern } from '../lib/storage';
import { computeProgress, mergeProgress, sameDesign } from '../lib/progress';
import { uid } from '../lib/threads';
import { Thumb } from '../components/Thumb';
import { Icon } from '../components/Icon';
import { LogoMark, Wordmark } from '../components/LogoMark';
import { LangSwitch } from '../components/LangSwitch';
import { AccountButton } from '../components/AccountButton';
import { navigate } from '../App';
import { t, locale } from '../lib/i18n';
import { APP_NAME } from '../lib/brand';

const fmtWhen = (ts: number) =>
  new Date(ts).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Receives your own pattern sent from another device (QR / link), merging stitching progress. */
export function TransferView({ data }: { data: string }) {
  const [incoming, setIncoming] = useState<Pattern | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    decodeTransfer(data).then(setIncoming).catch(() => setErr(t('ลิงก์นี้ไม่ถูกต้องหรือข้อมูลไม่ครบ', 'This link is invalid or incomplete')));
  }, [data]);

  if (err) return <div className="empty-state"><h2>{err}</h2><a className="btn primary" href="#/">{t('ไปหน้าแรก', 'Go to home')}</a></div>;
  if (!incoming) return <div className="empty-state"><StitchLoader label={t('กำลังเปิดลาย…', 'Opening pattern…')} /></div>;

  const local = loadPattern(incoming.id);
  const same = local ? sameDesign(local, incoming) : false;
  const inPct = incoming.progress ? computeProgress(incoming).pct : 0;
  const localPct = local?.progress ? computeProgress(local).pct : 0;
  const merged = local && same ? { ...local, progress: mergeProgress(local.progress, incoming.progress), updatedAt: Date.now() } : null;
  const mergedPct = merged?.progress ? computeProgress(merged).pct : 0;
  const pctLabel = (v: number) => `${v > 0 && v < 10 ? v.toFixed(1) : Math.floor(v)}%`;

  const open = (p: Pattern, where: 'stitch' | 'edit') => {
    if (!savePattern(p)) {
      alert(t('บันทึกไม่สำเร็จ พื้นที่ในเบราว์เซอร์อาจเต็ม', "Couldn't save. Your browser storage may be full."));
      return;
    }
    navigate(`#/${where}/${p.id}`);
  };
  const replace = async (where: 'stitch' | 'edit') => {
    if (local && local.updatedAt > incoming.updatedAt && !(await askConfirm({
      title: t('แทนที่ลายในเครื่องนี้?', 'Replace the pattern on this device?'),
      message: <p>{t('ลายในเครื่องนี้แก้ไขหลังจากสร้างลิงก์นี้ ถ้าแทนที่ การแก้ไขล่าสุดในเครื่องนี้จะหายไป', 'The copy on this device was edited after this link was made. Replacing it loses those newer edits.')}</p>,
      ok: t('แทนที่', 'Replace'),
      tone: 'danger',
      icon: 'sync',
    }))) return;
    open({ ...incoming, updatedAt: Date.now() }, where);
  };
  const keepBoth = () => open({ ...incoming, id: uid(), name: t(`${incoming.name} (จากอีกเครื่อง)`, `${incoming.name} (from another device)`), createdAt: Date.now(), updatedAt: Date.now() }, 'edit');

  return (
    <div className="shared">
      <header className="site-head">
        <a className="brand" href="#/" aria-label={t(`${APP_NAME} หน้าแรก`, `${APP_NAME} home`)}><LogoMark size={34} className="logo-mark" tight /><Wordmark /></a>
        <div className="spacer" /><AccountButton /><LangSwitch />
      </header>
      <div className="shared-body">
        <div className="preview-card"><Thumb pattern={incoming} max={400} view="stitch" /></div>
        <div className="form-card">
          <p className="muted"><Icon name="sendOut" size={15} /> {t('ลายที่ส่งมาจากอีกเครื่อง', 'Pattern sent from another device')}</p>
          <h1>{incoming.name}</h1>
          <p className="hint">
            {incoming.cols}×{incoming.rows} {t('ช่อง', 'cells')} · {t('ส่งมาเมื่อ', 'sent')} {fmtWhen(incoming.updatedAt)}
            {incoming.progress ? t(` · ปักแล้ว ${pctLabel(inPct)}`, ` · ${pctLabel(inPct)} stitched`) : ''}
          </p>

          {!local && (
            <>
              <p className="ok">{t('ลายนี้ยังไม่มีในเครื่องนี้ จะบันทึกไว้พร้อมความคืบหน้า', "This pattern isn't on this device yet. It will be saved with its progress.")}</p>
              <div className="btn-row">
                <button className="btn primary" onClick={() => open(incoming, 'stitch')}><Icon name="needle" size={16} /> {t('เปิดในโหมดปัก', 'Open in Stitch mode')}</button>
                <button className="btn" onClick={() => open(incoming, 'edit')}><Icon name="edit" size={16} /> {t('เปิดในตัวแก้ไข', 'Open in editor')}</button>
              </div>
            </>
          )}

          {local && same && merged && (
            <>
              <div className="merge-box">
                <div><span>{t('เครื่องนี้', 'This device')}</span><b>{pctLabel(localPct)}</b></div>
                <div><span>{t('จากลิงก์', 'From link')}</span><b>{pctLabel(inPct)}</b></div>
                <div className="arrow">→</div>
                <div className="result"><span>{t('รวมกัน', 'Combined')}</span><b>{pctLabel(mergedPct)}</b></div>
              </div>
              <p className="hint">{t('มีลายนี้ในเครื่องอยู่แล้ว ช่องที่ทำเครื่องหมายว่าปักแล้วในเครื่องใดเครื่องหนึ่งจะนับว่าปักแล้ว', 'This pattern is already on this device. A cell marked stitched on either device counts as stitched.')}</p>
              <div className="btn-row">
                <button className="btn primary" onClick={() => open(merged, 'stitch')}><Icon name="needle" size={16} /> {t('รวมความคืบหน้าแล้วปักต่อ', 'Merge and continue stitching')}</button>
                <button className="btn" onClick={() => open(merged, 'edit')}>{t('รวมแล้วเปิดตัวแก้ไข', 'Merge and open editor')}</button>
              </div>
            </>
          )}

          {local && !same && (
            <>
              <p className="error">
                {t(<>ลายในเครื่องนี้ถูกแก้ไขต่างจากลิงก์ (ในเครื่องนี้แก้ล่าสุด {fmtWhen(local.updatedAt)})</>, <>The pattern on this device differs from the link (last edited here {fmtWhen(local.updatedAt)}).</>)}
              </p>
              <div className="btn-row">
                <button className="btn primary" onClick={() => replace('stitch')}>{t('ใช้เวอร์ชันจากลิงก์', 'Use link version')}</button>
                <button className="btn" onClick={keepBoth}><Icon name="copy" size={16} /> {t('เก็บไว้ทั้งสองแบบ', 'Keep both')}</button>
                <a className="btn ghost" href={`#/edit/${local.id}`}>{t('ใช้ของเครื่องนี้', "Keep this device's")}</a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
