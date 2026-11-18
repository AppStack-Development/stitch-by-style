import { useEffect, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import type { Pattern } from '../types';
import { transferUrl } from '../lib/share';
import { computeProgress } from '../lib/progress';
import { Icon } from './Icon';

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
      prompt('คัดลอกลิงก์นี้', url);
    }
  };
  const canShare = typeof navigator.share === 'function';
  const share = () => navigator.share({ title: pattern.name, text: `ลายปัก "${pattern.name}" (สำหรับเปิดในอีกเครื่อง)`, url }).catch(() => {});

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal transfer" role="dialog" aria-label="ส่งไปอีกเครื่อง">
        <header className="modal-head">
          <h3><Icon name="phone" /> ส่งไปมือถือ / อีกเครื่อง</h3>
          <button className="icon-btn" onClick={onClose} title="ปิด (Esc)"><Icon name="close" /></button>
        </header>
        <div className="transfer-body">
          {tooBig ? (
            <p className="error">ลายนี้ใหญ่เกินกว่าจะใส่ใน QR ได้ ใช้ “คัดลอกลิงก์” แล้วส่งให้ตัวเองทาง LINE/อีเมล หรือส่งออกเป็นไฟล์ .json แทน</p>
          ) : (
            <button className={'qr-box' + (big ? ' big' : '')} onClick={() => setBig(!big)} title={big ? 'ย่อ' : 'ขยาย QR ให้สแกนง่ายขึ้น'}>
              <canvas ref={canvasRef} />
            </button>
          )}
          <div className="transfer-info">
            <b>{pattern.name}</b>
            <span className="muted">{pct > 0 ? `ความคืบหน้า ${pct < 10 ? pct.toFixed(1) : Math.floor(pct)}% จะติดไปด้วย` : 'ยังไม่มีความคืบหน้าการปัก'}</span>
            <ol>
              <li>เปิดกล้องมือถือแล้วสแกน QR นี้</li>
              <li>กด “เปิดในเครื่องนี้” บนมือถือ</li>
              <li>ปักเสร็จแล้วส่งกลับมาด้วยวิธีเดียวกัน ระบบจะรวมความคืบหน้าให้</li>
            </ol>
            {modules > 105 && <p className="hint">QR ค่อนข้างละเอียด กด QR เพื่อขยายเต็มจอจะสแกนง่ายขึ้น</p>}
            {isLocalHost() && <p className="error small">ตอนนี้เปิดจาก {location.host} ซึ่งมือถือเข้าไม่ได้ ใช้จากเว็บจริง stitch-by-style.vercel.app</p>}
          </div>
        </div>
        <footer className="modal-foot">
          <span className="hint">ลิงก์นี้มีความคืบหน้าของคุณ ใช้ส่งให้ตัวเอง · ถ้าจะแชร์ให้เพื่อนใช้ “คัดลอกลิงก์แชร์”</span>
          <div className="spacer" />
          {canShare && <button className="btn" onClick={share} disabled={!url}><Icon name="share" size={16} /> แชร์…</button>}
          <button className="btn primary" onClick={copy} disabled={!url}><Icon name={copied ? 'check' : 'link'} size={16} /> {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}</button>
        </footer>
      </div>
    </div>
  );
}
