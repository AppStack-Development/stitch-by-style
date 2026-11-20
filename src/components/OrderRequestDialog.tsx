import { useEffect, useMemo, useState } from 'react';
import type { Pattern } from '../types';
import {
  PLASTIC_COLORS, PRODUCTS, SIZE_LABEL, addressProblem, baht, cannotOrder, cm, emptyAddress, lastAddress, loadPricing,
  pieceMm, placeOrder, quote, sizeOf, unitPrice, type Address, type Pricing, type Product,
} from '../lib/orders';
import { signInWithGoogle, useCloud } from '../lib/cloud';
import { detectInApp } from '../lib/inAppBrowser';
import { computeStats } from '../lib/stats';
import { trackStep } from '../lib/analytics';
import { t } from '../lib/i18n';
import { templateLabel } from '../lib/templates';
import { navigate } from '../App';
import { Thumb } from './Thumb';
import { Icon } from './Icon';

/**
 * "สั่งผลิต": order a printed piece of this 3D pattern. The customer sees the price straight away, gives a
 * delivery address and places the order; payment and everything after happen on the order page (#/order/<code>).
 */
export function OrderRequestDialog({ pattern, onClose }: { pattern: Pattern; onClose: () => void }) {
  const cloud = useCloud();
  useEffect(() => { trackStep('/order/1-form'); }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal order-dialog" role="dialog" aria-modal="true" aria-labelledby="order-title">
        <header className="modal-head">
          <h3 id="order-title"><Icon name="cube" /> {t('สั่งผลิตชิ้นนี้', 'Order this piece')}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={t('ปิด', 'Close')} title={t('ปิด', 'Close')}><Icon name="close" /></button>
        </header>
        {cloud.status === 'loading'
          ? <div className="fb-body"><p className="muted">{t('กำลังตรวจสอบบัญชี…', 'Checking your account…')}</p></div>
          : cloud.status !== 'signed-in' ? <SignInFirst /> : <OrderForm pattern={pattern} onClose={onClose} />}
      </div>
    </div>
  );
}

function SignInFirst() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inApp = useMemo(() => detectInApp(), []);
  const go = async () => {
    setBusy(true);
    setErr('');
    try { await signInWithGoogle(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <>
      <div className="fb-body">
        <p><b>{t('เข้าสู่ระบบก่อนสั่งผลิต', 'Sign in to order')}</b></p>
        <p className="muted">{t('ออเดอร์จะผูกกับบัญชีของคุณ เพื่อให้ชำระเงิน ติดตามสถานะ และคุยกับทีมได้ในเว็บนี้ ดูได้ที่หน้า “ของฉัน”',
          'Orders belong to your account, so you can pay, follow the status and talk to the team right here, under “My stuff”.')}</p>
        {err && <p className="error small">{err}</p>}
      </div>
      <footer className="modal-foot fb-foot">
        {inApp ? (
          <a className="btn primary" href="#/account">{t('ไปหน้าเข้าสู่ระบบ', 'Go to sign in')}</a>
        ) : (
          <button className="btn primary" onClick={go} disabled={busy}>{busy ? t('กำลังไปที่ Google…', 'Opening Google…') : t('เข้าสู่ระบบด้วย Google', 'Continue with Google')}</button>
        )}
      </footer>
    </>
  );
}

function OrderForm({ pattern, onClose }: { pattern: Pattern; onClose: () => void }) {
  const [product, setProduct] = useState<Product>('kit');
  const [color, setColor] = useState(() => PLASTIC_COLORS[0]());
  const [otherColor, setOtherColor] = useState('');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [addr, setAddr] = useState<Address>(emptyAddress);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [tried, setTried] = useState(false);
  const [agree, setAgree] = useState(false);

  const blocked = cannotOrder(pattern);
  const size = sizeOf(pattern);
  const { w, h } = pieceMm(pattern);
  const stats = computeStats(pattern);
  const used = stats.colors.filter((c) => c.count > 0).length;

  useEffect(() => {
    let live = true;
    loadPricing().then((p) => { if (live) setPricing(p); }).catch((e) => { if (live) setErr((e as Error).message); });
    lastAddress().then((a) => { if (live && a) setAddr((cur) => (cur.name || cur.address ? cur : a)); }).catch(() => { /* fill in by hand */ });
    return () => { live = false; };
  }, []);

  const plastic = color === 'other' ? otherColor : color;
  const price = pricing && size ? quote(pricing, product, size, stats.total, qty) : null;
  const addrErr = addressProblem(addr);
  const colorErr = color === 'other' && !otherColor.trim() ? t('บอกสีที่ต้องการ', 'Say which color you want') : null;
  const canOrder = !blocked && !!price && !busy;

  const order = async () => {
    setTried(true);
    if (!canOrder || addrErr || colorErr || !agree) return;
    setBusy(true);
    setErr('');
    try {
      const code = await placeOrder(pattern, { product, plasticColor: plastic, quantity: qty, note, address: addr });
      trackStep('/order/2-placed');
      onClose();
      navigate(`#/order/${code}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  const field = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setAddr({ ...addr, [k]: e.target.value });

  return (
    <>
      <div className="fb-body order-form">
        <div className="publish-head">
          <span className="pick-thumb"><Thumb pattern={pattern} max={64} view="stitch" /></span>
          <div>
            <b>{pattern.name}</b>
            <span className="muted small">{templateLabel(pattern.templateName) ?? t('ชิ้นงาน 3D', '3D piece')} · {cm(w)} × {cm(h)} {t('ซม.', 'cm')} · {t(`${used} สี`, `${used} ${used === 1 ? 'color' : 'colors'}`)}</span>
            {size && <span className="muted small">{SIZE_LABEL[size]()}</span>}
          </div>
        </div>
        {blocked && <p className="error small">{blocked}</p>}

        <div className="fb-field">
          <span>{t('อยากได้แบบไหน', 'What would you like?')}</span>
          <div className="order-products" role="radiogroup" aria-label={t('แบบสินค้า', 'Product')}>
            {PRODUCTS.map((p) => {
              const each = pricing && size ? unitPrice(pricing, p.id, size, stats.total) : undefined;
              return (
                <label key={p.id} className={'order-product' + (product === p.id ? ' on' : '')}>
                  <input type="radio" name="product" checked={product === p.id} onChange={() => setProduct(p.id)} />
                  <span>
                    <b>{p.name()}{each !== undefined && Number.isFinite(each) && <em className="order-each">{baht(each)}</em>}</b>
                    <small>{p.desc()}{p.id === 'stitched' && ` ${t(`ราคาตามจำนวนฝีเข็ม (ลายนี้ ${stats.total.toLocaleString()} ฝีเข็ม)`, `Priced by stitch count (${stats.total.toLocaleString()} stitches in this pattern)`)}`}</small>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="fb-field">
          <span>{t('สีพลาสติกของชิ้นงาน', 'Plastic color')}</span>
          <div className="publish-tags">
            {PLASTIC_COLORS.map((c) => {
              const name = c();
              return <button key={name} type="button" className={'chip' + (color === name ? ' on' : '')} aria-pressed={color === name} onClick={() => setColor(name)}>{name}</button>;
            })}
            <button type="button" className={'chip' + (color === 'other' ? ' on' : '')} aria-pressed={color === 'other'} onClick={() => setColor('other')}>{t('สีอื่น', 'Other')}</button>
          </div>
          {color === 'other' && (
            <input id="order-other-color" value={otherColor} maxLength={40} onChange={(e) => setOtherColor(e.target.value)} placeholder={t('เช่น เหลืองพาสเทล', 'e.g. pastel yellow')} aria-label={t('สีที่ต้องการ', 'Color you want')} />
          )}
          {tried && colorErr && <p className="error small">{colorErr}</p>}
        </div>

        <div className="fb-field">
          <span>{t('จำนวน', 'Quantity')}</span>
          <div className="qty">
            <button type="button" className="icon-btn" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label={t('ลด', 'Less')}>−</button>
            <output aria-live="polite">{qty}</output>
            <button type="button" className="icon-btn" onClick={() => setQty((q) => Math.min(20, q + 1))} disabled={qty >= 20} aria-label={t('เพิ่ม', 'More')}><Icon name="plus" size={16} /></button>
            <span className="hint">{t('สูงสุด 20 ชิ้นต่อออเดอร์', 'Up to 20 per order')}</span>
          </div>
        </div>

        <fieldset className="order-address">
          <legend>{t('ที่อยู่จัดส่ง', 'Delivery address')}</legend>
          <div className="order-address-row">
            <label className="fb-field"><span>{t('ชื่อผู้รับ', 'Recipient')}</span>
              <input value={addr.name} maxLength={100} autoComplete="name" onChange={field('name')} /></label>
            <label className="fb-field"><span>{t('เบอร์โทร', 'Phone')}</span>
              <input value={addr.phone} maxLength={20} inputMode="tel" autoComplete="tel" onChange={field('phone')} placeholder="08x-xxx-xxxx" /></label>
          </div>
          <label className="fb-field"><span>{t('ที่อยู่', 'Address')}</span>
            <textarea value={addr.address} rows={2} maxLength={500} autoComplete="street-address" onChange={field('address')}
              placeholder={t('บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด', 'House no., street, sub-district, district, province')} /></label>
          <label className="fb-field order-postcode"><span>{t('รหัสไปรษณีย์', 'Postcode')}</span>
            <input value={addr.postcode} maxLength={5} inputMode="numeric" autoComplete="postal-code" onChange={field('postcode')} /></label>
          {tried && addrErr && <p className="error small">{addrErr}</p>}
        </fieldset>

        <label className="fb-field">
          <span>{t('ข้อความถึงทีม (ไม่บังคับ)', 'Note to the team (optional)')}</span>
          <textarea id="order-note" value={note} maxLength={1000} rows={2} onChange={(e) => setNote(e.target.value)}
            placeholder={t('เช่น อยากได้ภายในวันที่ 20 ธ.ค. เป็นของขวัญ', 'e.g. needed by 20 Dec as a gift')} />
        </label>

        {price && (
          <dl className="order-sum" aria-label={t('สรุปราคา', 'Price')}>
            <div><dt>{t(`ชิ้นงาน ${baht(price.unit)} × ${qty}`, `Piece ${baht(price.unit)} × ${qty}`)}</dt><dd>{baht(price.unit * qty)}</dd></div>
            <div><dt>{t('ค่าจัดส่ง', 'Shipping')}</dt><dd>{baht(price.shipping)}</dd></div>
            <div className="order-total"><dt>{t('รวม', 'Total')}</dt><dd>{baht(price.total)}</dd></div>
          </dl>
        )}
        {!price && !blocked && !err && <p className="muted small">{t('กำลังโหลดราคา…', 'Loading prices…')}</p>}
        <p className="hint">{t('กดสั่งแล้วจะไปที่หน้าออเดอร์ เพื่อชำระเงินผ่านพร้อมเพย์และแนบสลิป ทีมเริ่มผลิตหลังตรวจสลิปแล้ว ปกติส่งภายใน 5–7 วันทำการ',
          'After ordering you’ll go to the order page to pay by PromptPay and attach the slip. We start once the payment is checked; it usually ships within 5–7 working days.')}</p>
        <label className="check order-agree">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>{t(<>ฉันอ่านและยอมรับ <a href="#/order-terms" target="_blank" rel="noopener">เงื่อนไขการสั่งซื้อ</a> แล้ว</>,
            <>I’ve read and accept the <a href="#/order-terms" target="_blank" rel="noopener">order terms</a></>)}</span>
        </label>
        {tried && !agree && <p className="error small">{t('ติ๊กยอมรับเงื่อนไขการสั่งซื้อก่อน', 'Tick to accept the order terms first')}</p>}
        {err && <p className="error small">{err}</p>}
      </div>
      <footer className="modal-foot fb-foot">
        <button className="btn" onClick={onClose}>{t('ยกเลิก', 'Cancel')}</button>
        <button className="btn primary" onClick={order} disabled={!canOrder}>
          <Icon name="check" size={16} /> {busy ? t('กำลังสั่ง…', 'Ordering…') : price ? t(`สั่งเลย · ${baht(price.total)}`, `Place order · ${baht(price.total)}`) : t('สั่งเลย', 'Place order')}
        </button>
      </footer>
    </>
  );
}
