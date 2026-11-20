import { useEffect, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import type { Pattern } from '../types';
import {
  SIZE_LABEL, STATUS_LABEL, baht, cancelOrder, cm, confirmReceived, getOrder, loadPricing, pieceMm, productName,
  promptPayPayload, slipUrl, uploadSlip, type Order, type OrderStatus, type Pricing,
} from '../lib/orders';
import { useCloud } from '../lib/cloud';
import { decodeShare } from '../lib/share';
import { trackStep } from '../lib/analytics';
import { t, locale } from '../lib/i18n';
import { templateLabel } from '../lib/templates';
import { Thumb } from '../components/Thumb';
import { Icon } from '../components/Icon';
import { AccountButton } from '../components/AccountButton';
import { OrderThread } from '../components/OrderThread';

const day = (iso: string) => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** The steps a customer sees, and which one each status sits on. */
const STEPS = [
  () => t('สั่งแล้ว', 'Ordered'), () => t('ชำระเงิน', 'Payment'), () => t('ผลิต', 'Making'),
  () => t('จัดส่ง', 'Shipped'), () => t('ได้รับ', 'Received'),
];
const STEP_OF: Record<OrderStatus, number> = {
  awaiting_payment: 1, payment_review: 1, paid: 2, in_production: 2, shipped: 3, done: 5, cancelled: -1,
};

/** "#/order/<code>": one order, for the customer who placed it (the team works orders on #/moderation). */
export function OrderPage({ code }: { code: string }) {
  const cloud = useCloud();
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [err, setErr] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (cloud.status !== 'signed-in') return;
    let live = true;
    getOrder(code).then((o) => { if (live) setOrder(o); }).catch((e) => { if (live) setErr((e as Error).message); });
    return () => { live = false; };
  }, [code, cloud.status, cloud.user?.id, reload]);
  useEffect(() => { trackStep('/order/3-page'); }, []);

  let body: JSX.Element;
  if (cloud.status === 'loading') body = <p className="muted">{t('กำลังตรวจสอบบัญชี…', 'Checking your account…')}</p>;
  else if (cloud.status !== 'signed-in') {
    body = (
      <div className="community-msg">
        <p><b>{t('เข้าสู่ระบบเพื่อดูออเดอร์', 'Sign in to see this order')}</b></p>
        <a className="btn primary" href="#/account">{t('ไปหน้าเข้าสู่ระบบ', 'Go to sign in')}</a>
      </div>
    );
  } else if (err) body = <p className="error">{err}</p>;
  else if (order === undefined) body = <p className="muted">{t('กำลังโหลด…', 'Loading…')}</p>;
  else if (order === null) {
    body = (
      <div className="community-msg">
        <p><b>{t('ไม่พบออเดอร์นี้', 'Order not found')}</b></p>
        <p className="muted">{t('ออเดอร์จะเห็นได้เฉพาะบัญชีที่สั่ง ลองเข้าสู่ระบบด้วยบัญชีนั้น', 'An order is only visible to the account that placed it.')}</p>
        <a className="btn" href="#/account">{t('ไปหน้าของฉัน', 'Go to My stuff')}</a>
      </div>
    );
  } else body = <OrderView order={order} onChanged={() => setReload((n) => n + 1)} />;

  return (
    <div className="community-page order-page">
      <header className="site-head">
        <a className="icon-btn" href="#/account" title={t('กลับไปหน้าของฉัน', 'Back to My stuff')} aria-label={t('กลับไปหน้าของฉัน', 'Back to My stuff')}><Icon name="back" /></a>
        <h2><Icon name="cube" size={18} /> {t('ออเดอร์', 'Order')} {code}</h2>
        <div className="spacer" />
        <AccountButton />
      </header>
      <main className="community-main order-main">{body}</main>
    </div>
  );
}

function OrderView({ order: o, onChanged }: { order: Order; onChanged: () => void }) {
  const [p, setP] = useState<Pattern | null>(null);
  useEffect(() => {
    let live = true;
    decodeShare(o.data).then((x) => { if (live) setP({ ...x, name: o.title }); }).catch(() => { /* no preview */ });
    return () => { live = false; };
  }, [o.data, o.title]);
  const step = STEP_OF[o.status];
  const { w, h } = pieceMm(o);

  return (
    <>
      <section className="order-card-box order-status">
        <div className="order-status-head">
          <span className={'status-chip ' + (o.status === 'cancelled' ? 'removed' : o.status === 'done' ? 'published' : 'hidden')}>{STATUS_LABEL[o.status]()}</span>
          <span className="muted small">{t('สั่งเมื่อ', 'Ordered')} {day(o.createdAt)}</span>
        </div>
        {step >= 0 && (
          <ol className="order-steps" aria-label={t('ขั้นตอน', 'Progress')}>
            {STEPS.map((s, i) => (
              <li key={i} className={i < step ? 'done' : i === step ? 'now' : ''} aria-current={i === step ? 'step' : undefined}>
                <i>{i < step ? <Icon name="check" size={14} /> : i + 1}</i><span>{s()}</span>
              </li>
            ))}
          </ol>
        )}
        <NextStep order={o} onChanged={onChanged} />
      </section>

      <section className="order-card-box">
        <h3>{t('รายละเอียด', 'Details')}</h3>
        <div className="order-detail">
          <a className="review-thumb" href={`#/s/${o.data}`} title={t('ดูลาย', 'View pattern')}>
            {p ? <Thumb pattern={p} max={96} view="stitch" /> : <span className="post-wait" aria-hidden="true" />}
          </a>
          <div>
            <b>{o.title}</b>
            <p className="muted small">{templateLabel(o.templateName) ?? '3D'} · {cm(w)} × {cm(h)} {t('ซม.', 'cm')} · {SIZE_LABEL[o.size]()}</p>
            <ul className="order-facts">
              <li><span>{t('แบบ', 'Product')}</span><b>{productName(o.product)}</b></li>
              <li><span>{t('สีพลาสติก', 'Plastic')}</span><b>{o.plasticColor || '–'}</b></li>
              <li><span>{t('จำนวน', 'Qty')}</span><b>{o.quantity}</b></li>
            </ul>
          </div>
        </div>
        <dl className="order-sum">
          <div><dt>{t(`ชิ้นงาน ${baht(o.unit)} × ${o.quantity}`, `Piece ${baht(o.unit)} × ${o.quantity}`)}</dt><dd>{baht(o.unit * o.quantity)}</dd></div>
          <div><dt>{t('ค่าจัดส่ง', 'Shipping')}</dt><dd>{baht(o.shipping)}</dd></div>
          <div className="order-total"><dt>{t('รวม', 'Total')}</dt><dd>{baht(o.total)}</dd></div>
        </dl>
        <h4>{t('จัดส่งถึง', 'Deliver to')}</h4>
        <p className="order-addr">{o.address.name} · {o.address.phone}<br />{o.address.address} {o.address.postcode}</p>
        {o.note && <><h4>{t('ข้อความตอนสั่ง', 'Your note')}</h4><p className="review-note">{o.note}</p></>}
        <p className="hint"><a className="acct-link" href="#/order-terms">{t('เงื่อนไขการสั่งซื้อ', 'Order terms')}</a>{o.termsVersion && t(` · ยอมรับฉบับ ${o.termsVersion}`, ` · accepted version ${o.termsVersion}`)}</p>
      </section>

      <section className="order-card-box">
        <h3><Icon name="chat" size={18} /> {t('คุยกับทีม', 'Talk to the team')}</h3>
        <OrderThread orderId={o.id} asTeam={false} />
      </section>
    </>
  );
}

/** What the customer does (or waits for) now. */
function NextStep({ order: o, onChanged }: { order: Order; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const act = async (fn: () => Promise<void>, ask?: string) => {
    if (ask && !confirm(ask)) return;
    setBusy(true);
    setErr('');
    try { await fn(); onChanged(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  switch (o.status) {
    case 'awaiting_payment':
      return (
        <>
          <Payment order={o} onChanged={onChanged} />
          <div className="btn-row">
            <button className="btn ghost sm" disabled={busy} onClick={() => act(() => cancelOrder(o.code), t('ยกเลิกออเดอร์นี้?', 'Cancel this order?'))}>{t('ยกเลิกออเดอร์', 'Cancel order')}</button>
          </div>
          {err && <p className="error small">{err}</p>}
        </>
      );
    case 'payment_review':
      return (
        <>
          <p><b>{t('ได้รับสลิปแล้ว', 'We’ve got your slip')}</b> {t('ทีมกำลังตรวจยอด ปกติภายใน 1 วันทำการ ถ้าแนบผิด ส่งสลิปใหม่ได้', 'We’re checking the payment, usually within a working day. Sent the wrong one? Upload it again.')}</p>
          <SlipPeek path={o.slipPath} />
          <Payment order={o} onChanged={onChanged} again />
        </>
      );
    case 'paid':
    case 'in_production':
      return <p><b>{t('ชำระเงินเรียบร้อย', 'Payment received')}</b> {t('ทีมกำลังพิมพ์และเตรียมชิ้นงานของคุณ ปกติส่งภายใน 5–7 วันทำการ', 'We’re printing and preparing your piece; it usually ships within 5–7 working days.')}</p>;
    case 'shipped':
      return (
        <>
          <p><b>{t('จัดส่งแล้ว', 'On its way')}</b> {o.trackingCarrier || o.trackingNo
            ? <>{o.trackingCarrier} <span className="order-code-sm">{o.trackingNo}</span></>
            : t('ทีมจะแจ้งเลขพัสดุในข้อความด้านล่าง', 'The team will post the tracking number below.')}</p>
          <div className="btn-row">
            <button className="btn primary" disabled={busy} onClick={() => act(() => confirmReceived(o.code))}><Icon name="check" size={16} /> {t('ได้รับของแล้ว', 'I’ve received it')}</button>
          </div>
          {err && <p className="error small">{err}</p>}
        </>
      );
    case 'done':
      return <p><b>{t('ขอบคุณที่สั่งกับเรา', 'Thank you for your order')}</b> {t('ถ้ามีปัญหากับชิ้นงาน บอกทีมได้ในข้อความด้านล่าง', 'If anything’s wrong with the piece, tell us below.')}</p>;
    case 'cancelled':
      return <p className="muted">{t('ออเดอร์นี้ถูกยกเลิกแล้ว', 'This order was cancelled.')}</p>;
  }
}

/** PromptPay QR for the exact amount, and the slip upload. */
function Payment({ order: o, onChanged, again }: { order: Order; onChanged: () => void; again?: boolean }) {
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (again) return;
    let live = true;
    loadPricing().then((x) => { if (live) setPricing(x); }).catch(() => { /* shown as "not set up" */ });
    return () => { live = false; };
  }, [again]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      await uploadSlip(o, file);
      trackStep('/order/4-slip');
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const picker = (
    <>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
      <button className={'btn' + (again ? ' sm' : ' primary')} disabled={busy} onClick={() => fileRef.current?.click()}>
        <Icon name="upload" size={16} /> {busy ? t('กำลังส่ง…', 'Uploading…') : again ? t('ส่งสลิปใหม่', 'Upload another slip') : t('แนบสลิป', 'Attach slip')}
      </button>
    </>
  );
  if (again) return <div className="btn-row">{picker}{err && <p className="error small">{err}</p>}</div>;

  const payload = pricing?.promptpayId ? promptPayPayload(pricing.promptpayId, o.total) : null;
  return (
    <div className="order-pay">
      <p><b>{t(`ชำระ ${baht(o.total)} ผ่านพร้อมเพย์`, `Pay ${baht(o.total)} by PromptPay`)}</b></p>
      {pricing === null ? <p className="muted small">{t('กำลังโหลด…', 'Loading…')}</p> : payload ? (
        <div className="order-qr">
          <QrCanvas text={payload} />
          <p className="small">{t('สแกนด้วยแอปธนาคาร ยอดเงินจะขึ้นให้อัตโนมัติ', 'Scan with your banking app; the amount fills in by itself.')}
            {pricing.promptpayName && <><br />{t('ชื่อบัญชี', 'Account name')}: <b>{pricing.promptpayName}</b></>}</p>
        </div>
      ) : (
        <p className="muted small">{t('ทีมยังไม่ได้ตั้งช่องทางชำระเงิน จะแจ้งในข้อความด้านล่างเร็วๆ นี้', 'Payment details aren’t set up yet; the team will post them below shortly.')}</p>
      )}
      <p className="small">{t('โอนแล้วแนบสลิปที่นี่ ทีมจะตรวจและเริ่มผลิตให้', 'After paying, attach the slip here and we’ll check it and start making your piece.')}</p>
      <div className="btn-row">{picker}</div>
      {err && <p className="error small">{err}</p>}
    </div>
  );
}

function QrCanvas({ text }: { text: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const qr = qrcode(0, 'M');
    qr.addData(text, 'Byte');
    qr.make();
    const n = qr.getModuleCount();
    const quiet = 4;
    const scale = Math.max(2, Math.floor(200 / (n + quiet * 2)));
    const size = (n + quiet * 2) * scale;
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#111111';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
  }, [text]);
  return <canvas ref={ref} className="order-qr-canvas" role="img" aria-label={t('คิวอาร์พร้อมเพย์', 'PromptPay QR code')} />;
}

/** Shows a private slip image on request (the link lasts 10 minutes). */
export function SlipPeek({ path }: { path: string | null }) {
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  if (!path) return null;
  if (url) return <a href={url} target="_blank" rel="noopener"><img className="order-slip" src={url} alt={t('สลิปการโอน', 'Payment slip')} /></a>;
  return (
    <>
      <button className="btn sm" onClick={() => slipUrl(path).then(setUrl).catch((e) => setErr((e as Error).message))}><Icon name="image" size={15} /> {t('ดูสลิป', 'View slip')}</button>
      {err && <p className="error small">{err}</p>}
    </>
  );
}
