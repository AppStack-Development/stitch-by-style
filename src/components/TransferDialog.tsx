import { useEffect, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import type { Pattern } from '../types';
import { transferUrl } from '../lib/share';
import { computeProgress } from '../lib/progress';
import { Icon } from './Icon';
import { t } from '../lib/i18n';

interface Props {
  pattern: Pattern;
  onClose: () => void;
}

const isLocalHost = () => /^(localhost|127\.0\.0\.1|\[::1\]|.*\.local)$/.test(location.hostname);

/** QR code + link to open this pattern (with its stitching progress) on another device. */
export function TransferDialog({ pattern, onClose }: Props) {
  const [url, setUrl] = useState('');
  const [modules, setModules] = useState(0);
  const [tooBig, setTooBig] = useState(false);
  const [copied, setCopied] = useState(false);
  const [big, setBig] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pct = pattern.progress ? computeProgress(pattern).pct : 0;

  useEffect(() => {
    let live = true;
    transferUrl(pattern).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [pattern]);

  // draw the QR code (error-correction L keeps it as sparse as possible)
  useEffect(() => {
    const c = canvasRef.current;
    if (!url || !c) return;
    let qr: ReturnType<typeof qrcode>;
    try {
      qr = qrcode(0, 'L');
      qr.addData(url, 'Byte');
      qr.make();
    } catch {
      setTooBig(true);
      return;
    }
    const n = qr.getModuleCount();
    setModules(n);
    const quiet = 4;
    const target = big ? Math.min(window.innerWidth, window.innerHeight) - 48 : Math.min(300, window.innerWidth - 96);
    const scale = Math.max(1, Math.floor(target / (n + quiet * 2)));
    const size = (n + quiet * 2) * scale;
    c.width = size;
    c.height = size;
    c.style.width = `${size}px`;
    c.style.height = `${size}px`;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#111111';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) if (qr.isDark(y, x)) ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
    }
  }, [url, big]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') (big ? setBig(false) : onClose()); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose, big]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt(t('คัดลอกลิงก์นี้', 'Copy this link'), url);
    }
  };
  const canShare = typeof navigator.share === 'function';
  const share = () => navigator.share({ title: pattern.name, text: t(`ลายปัก "${pattern.name}" (สำหรับเปิดในอีกเครื่อง)`, `Pattern "${pattern.name}" (to open on another device)`), url }).catch(() => {});

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal transfer" role="dialog" aria-label={t('ส่งไปอีกเครื่อง', 'Send to another device')}>
        <header className="modal-head">
          <h3><Icon name="phone" /> {t('ส่งไปมือถือ / อีกเครื่อง', 'Send to phone / another device')}</h3>
          <button className="icon-btn" onClick={onClose} title={t('ปิด (Esc)', 'Close (Esc)')}><Icon name="close" /></button>
        </header>
        <div className="transfer-body">
          {tooBig ? (
            <p className="error">{t('ลายนี้ใหญ่เกินกว่าจะใส่ใน QR ได้ ใช้ “คัดลอกลิงก์” แล้วส่งให้ตัวเองทาง LINE/อีเมล หรือส่งออกเป็นไฟล์ .json แทน', 'This pattern is too big for a QR code. Use “Copy link” and send it to yourself by LINE or email, or export it as a .json file instead.')}</p>
          ) : (
            <button className={'qr-box' + (big ? ' big' : '')} onClick={() => setBig(!big)} title={big ? t('ย่อ', 'Shrink') : t('ขยาย QR ให้สแกนง่ายขึ้น', 'Enlarge QR for easier scanning')}>
              <canvas ref={canvasRef} />
            </button>
          )}
          <div className="transfer-info">
            <b>{pattern.name}</b>
            <span className="muted">{pct > 0 ? t(`ความคืบหน้า ${pct < 10 ? pct.toFixed(1) : Math.floor(pct)}% จะติดไปด้วย`, `Your ${pct < 10 ? pct.toFixed(1) : Math.floor(pct)}% progress goes with it`) : t('ยังไม่มีความคืบหน้าการปัก', 'No stitching progress yet')}</span>
            <ol>
              <li>{t('เปิดกล้องมือถือแล้วสแกน QR นี้', 'Scan this QR code with your phone camera')}</li>
              <li>{t('บนมือถือ กด “เปิดในโหมดปัก” หรือ “เปิดในตัวแก้ไข”', 'On the phone, tap “Open in Stitch mode” or “Open in editor”')}</li>
              <li>{t('ปักเสร็จแล้วส่งกลับมาด้วยวิธีเดียวกัน ระบบจะรวมความคืบหน้าให้', 'When you’re done, send it back the same way and your progress will be merged')}</li>
            </ol>
            {modules > 105 && <p className="hint">{t('QR ค่อนข้างละเอียด กด QR เพื่อขยายเต็มจอจะสแกนง่ายขึ้น', 'This QR code is quite dense. Tap it to go full screen for easier scanning.')}</p>}
            {isLocalHost() && <p className="error small">{t(<>ตอนนี้เปิดจาก {location.host} ซึ่งมือถือเข้าไม่ได้ ใช้จากเว็บจริง stitch-by-style.vercel.app</>, <>You’re on {location.host}, which a phone can’t reach. Use the live site stitch-by-style.vercel.app</>)}</p>}
          </div>
        </div>
        <footer className="modal-foot">
          <span className="hint">{t('ลิงก์นี้มีความคืบหน้าของคุณ ใช้ส่งให้ตัวเอง · ถ้าจะแชร์ให้เพื่อนใช้ “คัดลอกลิงก์แชร์”', 'This link includes your progress, so send it only to yourself · To share with a friend, use “Copy share link”')}</span>
          <div className="spacer" />
          {canShare && <button className="btn" onClick={share} disabled={!url}><Icon name="share" size={16} /> {t('แชร์…', 'Share…')}</button>}
          <button className="btn primary" onClick={copy} disabled={!url}><Icon name={copied ? 'check' : 'link'} size={16} /> {copied ? t('คัดลอกแล้ว', 'Copied') : t('คัดลอกลิงก์', 'Copy link')}</button>
        </footer>
      </div>
    </div>
  );
}
