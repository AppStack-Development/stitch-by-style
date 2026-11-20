import { useCallback, useEffect, useRef, useState } from 'react';
import type { Post } from '../lib/community';
import { amModerator, decide, recentlyHandled, reviewQueue, DECISION_LABEL, REASON_LABEL, type Decision, type ReviewItem } from '../lib/moderation';
import { useCloud } from '../lib/cloud';
import { t, locale } from '../lib/i18n';
import { templateLabel } from '../lib/templates';
import { Thumb } from '../components/Thumb';
import { Icon } from '../components/Icon';
import { LangSwitch } from '../components/LangSwitch';
import { TeamBadge, usePostPattern } from '../components/PostCard';
import type { Pattern } from '../types';
import {
  ORDER_STATUSES, PRODUCTS, SIZE_LIMITS, STATUS_LABEL as ORDER_STATUS, baht, cm, getTeamNote, listOrders, loadPricing, ordersEnabled,
  pieceMm, productName, promptPayPayload, saveConfig, saveTeamNote, sizeOf, updateOrder, type Order, type OrderMessage, type OrderStatus,
} from '../lib/orders';
import { OrderThread } from '../components/OrderThread';
import { SlipPeek } from './OrderPage';
import { decodeShare, downloadBlob, safeFilename } from '../lib/share';
import { buildPlate, toBinaryStl } from '../lib/plate';
import { computeStats } from '../lib/stats';

type Tab = 'open' | 'handled' | 'orders';

const when = (iso: string) => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * "หน้าทีม" (#/moderation, #/moderation/orders): community reports and production orders, for the team.
 * Everyone else sees a short "not allowed" note.
 */
export function Moderation({ startTab }: { startTab?: Tab } = {}) {
  const cloud = useCloud();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>(startTab ?? 'open');
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [openCount, setOpenCount] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (cloud.status === 'loading') return;
    let live = true;
    amModerator().then((ok) => { if (live) setAllowed(ok); });
    return () => { live = false; };
  }, [cloud.status, cloud.user?.id]);

  useEffect(() => {
    if (!allowed || tab === 'orders') return;
    let live = true;
    setItems(null);
    setErr('');
    (tab === 'open' ? reviewQueue() : recentlyHandled())
      .then((x) => {
        if (!live) return;
        setItems(x);
        if (tab === 'open') setOpenCount(x.length);
      })
      .catch((e) => { if (live) setErr((e as Error).message); });
    return () => { live = false; };
  }, [allowed, tab, reload]);

  const onDecided = (postId: string) => {
    // a decided post leaves the open queue
    if (tab === 'open') {
      setItems((xs) => xs && xs.filter((x) => x.post.id !== postId));
      setOpenCount((n) => (n == null ? n : Math.max(0, n - 1)));
    } else {
      setReload((n) => n + 1);
    }
  };

  let body: JSX.Element;
  if (cloud.status === 'loading' || allowed === null) body = <p className="muted">{t('กำลังตรวจสอบสิทธิ์…', 'Checking access…')}</p>;
  else if (!allowed) {
    body = (
      <div className="community-msg">
        <p><b>{t('หน้านี้สำหรับทีมงาน (ดูแลชุมชนและออเดอร์)', 'This page is for the team (community reports and orders)')}</b></p>
        <p className="muted">{cloud.status === 'signed-in'
          ? t('บัญชีนี้ไม่มีสิทธิ์ตรวจการแจ้งปัญหา', 'This account can’t review reports.')
          : t('เข้าสู่ระบบด้วยบัญชีทีมงานก่อน', 'Sign in with a team account first.')}</p>
        <a className="btn" href={cloud.status === 'signed-in' ? '#/community' : '#/account'}>
          {cloud.status === 'signed-in' ? t('ไปหน้าลายจากชุมชน', 'Go to community patterns') : t('ไปหน้าเข้าสู่ระบบ', 'Go to sign in')}
        </a>
      </div>
    );
  } else {
    body = (
      <>
        <div className="community-filters">
          <div className="seg" role="tablist" aria-label={t('รายการ', 'List')}>
            <button role="tab" aria-selected={tab === 'open'} className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>
              {t('รอตรวจ', 'To review')}{openCount != null && ` (${openCount})`}
            </button>
            <button role="tab" aria-selected={tab === 'handled'} className={tab === 'handled' ? 'on' : ''} onClick={() => setTab('handled')}>{t('จัดการแล้ว', 'Handled')}</button>
            {ordersEnabled && <button role="tab" aria-selected={tab === 'orders'} className={tab === 'orders' ? 'on' : ''} onClick={() => setTab('orders')}>{t('ออเดอร์', 'Orders')}</button>}
          </div>
          <button className="btn sm ghost" onClick={() => setReload((n) => n + 1)}><Icon name="sync" size={15} /> {t('โหลดใหม่', 'Refresh')}</button>
        </div>
        {tab === 'orders' ? <OrdersPanel reload={reload} /> : <>
        {err && <p className="error">{err}</p>}
        {!err && items === null && <p className="muted">{t('กำลังโหลด…', 'Loading…')}</p>}
        {items && !items.length && (
          <div className="community-msg">
            <p><b>{tab === 'open' ? t('ไม่มีการแจ้งที่รอตรวจ', 'Nothing to review') : t('ยังไม่มีรายการที่จัดการแล้ว', 'Nothing handled yet')}</b></p>
            {tab === 'open' && <p className="muted">{t('ทุกการแจ้งได้รับการจัดการแล้ว', 'Every report has been dealt with.')}</p>}
          </div>
        )}
        {items && items.length > 0 && (
          <div className="review-list">
            {items.map((it) => <ReviewCard key={it.post.id} item={it} handled={tab === 'handled'} onDecided={onDecided} />)}
          </div>
        )}
        </>}
      </>
    );
  }

  return (
    <div className="community-page">
      <header className="site-head">
        <a className="icon-btn" href="#/account" title={t('กลับไปหน้าบัญชี', 'Back to account')} aria-label={t('กลับไปหน้าบัญชี', 'Back to account')}><Icon name="back" /></a>
        <h2><Icon name="flag" size={18} /> {t('หน้าทีม', 'Team')}</h2>
        <div className="spacer" />
        <LangSwitch />
      </header>
      <main className="community-main">
        <section className="community-intro">
          <div>
            {tab === 'orders' ? <>
              <h1>{t('ออเดอร์', 'Orders')}</h1>
              <p className="muted">{t('ตรวจสลิปให้ตรงยอด แล้วเลื่อนสถานะตามงานจริง ลูกค้าเห็นสถานะและข้อความในหน้าออเดอร์ของตัวเอง',
                'Check each slip against the total, then move the status along as the work happens. Customers see the status and messages on their order page.')}</p>
            </> : <>
              <h1>{t('การแจ้งปัญหา', 'Reports')}</h1>
              <p className="muted">{t('ตรวจภายใน 7 วันตามข้อกำหนด ลายที่ถูกแจ้งจากผู้ใช้ 3 คนขึ้นไปจะถูกซ่อนให้อัตโนมัติจนกว่าจะตัดสิน',
                'Review within 7 days, as the terms promise. Patterns reported by 3 or more users are hidden automatically until you decide.')}</p>
            </>}
          </div>
        </section>
        {body}
      </main>
    </div>
  );
}

const STATUS_LABEL = {
  published: () => t('แสดงอยู่', 'Visible'),
  hidden: () => t('ซ่อนอยู่', 'Hidden'),
  removed: () => t('นำออกแล้ว', 'Removed'),
};

function ReviewCard({ item, handled, onDecided }: { item: ReviewItem; handled: boolean; onDecided: (postId: string) => void }) {
  const p = usePostPattern(item.post as unknown as Post);
  const [status, setStatus] = useState(item.post.status);
  const [busy, setBusy] = useState<Decision | null>(null);
  const [err, setErr] = useState('');
  const days = Math.floor((Date.now() - new Date(item.reports[0].createdAt).getTime()) / 86400000);

  const act = async (d: Decision) => {
    if (d === 'removed' && !confirm(t(`นำ “${item.post.title}” ออกจากชุมชน? คนอื่นจะไม่เห็นลายนี้อีก (ผู้ออกแบบยังเห็นในหน้าบัญชีว่าถูกนำออก)`,
      `Remove “${item.post.title}” from the community? Nobody else will see it (the designer sees it marked as removed).`))) return;
    setBusy(d);
    setErr('');
    try {
      await decide(item.post.id, d);
      setStatus(d === 'kept' ? 'published' : d);
      onDecided(item.post.id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="review-card">
      <a className="review-thumb" href={`#/c/${item.post.id}`} title={t('เปิดลาย', 'Open pattern')}>
        {p ? <Thumb pattern={p} max={96} view="stitch" /> : <span className="post-wait" aria-hidden="true" />}
      </a>
      <div className="review-main">
        <div className="review-head">
          <a className="review-title" href={`#/c/${item.post.id}`}>{item.post.title}</a>
          <span className={`status-chip ${status}`}>{STATUS_LABEL[status]()}</span>
        </div>
        <div className="post-by">{t('โดย', 'by')} <b>{item.post.author.name}</b>{item.post.author.official && <TeamBadge />}
          <span className="muted">· {t(`แจ้งทั้งหมด ${item.post.reportCount} ครั้ง`, `${item.post.reportCount} reports in total`)}</span>
          {!handled && days >= 5 && <span className="review-late">{t(`รอมา ${days} วัน`, `waiting ${days} days`)}</span>}
        </div>
        <ul className="review-reports">
          {item.reports.map((r) => (
            <li key={r.id}>
              <span className="chip sm">{REASON_LABEL[r.reason]()}</span>
              <span className="review-when">{when(r.createdAt)} · {r.signedIn ? t('สมาชิก', 'member') : t('ไม่ได้เข้าสู่ระบบ', 'signed out')}</span>
              {r.note && <p className="review-note">{r.note}</p>}
              {handled && r.resolution && <span className="review-done">→ {DECISION_LABEL[r.resolution]()}</span>}
            </li>
          ))}
        </ul>
        <div className="review-actions">
          <button className="btn sm" onClick={() => act('kept')} disabled={!!busy || (handled && status === 'published')}>
            <Icon name="check" size={15} /> {busy === 'kept' ? t('กำลังบันทึก…', 'Saving…') : handled ? t('แสดงอีกครั้ง', 'Show again') : t('ไม่มีปัญหา', 'No problem')}
          </button>
          <button className="btn sm" onClick={() => act('hidden')} disabled={!!busy || (handled && status === 'hidden')}>
            {busy === 'hidden' ? t('กำลังบันทึก…', 'Saving…') : t('ซ่อนไว้', 'Hide')}
          </button>
          <button className="btn sm danger" onClick={() => act('removed')} disabled={!!busy || status === 'removed'}>
            <Icon name="trash" size={15} /> {busy === 'removed' ? t('กำลังบันทึก…', 'Saving…') : t('นำออก', 'Remove')}
          </button>
        </div>
        {err && <p className="error small">{err}</p>}
      </div>
    </article>
  );
}

// ---------- orders ----------

const when2 = (iso: string) => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
/** Orders waiting on the team come first. */
const URGENCY: Record<OrderStatus, number> = { payment_review: 0, paid: 1, in_production: 2, awaiting_payment: 3, shipped: 4, done: 5, cancelled: 6 };

/** The team's list of orders: open ones first (most urgent on top), closed ones on demand. */
function OrdersPanel({ reload }: { reload: number }) {
  const [closed, setClosed] = useState(false);
  const [items, setItems] = useState<Order[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    setItems(null);
    setErr('');
    listOrders(!closed)
      .then((x) => { if (live) setItems(closed ? x : [...x].sort((a, b) => URGENCY[a.status] - URGENCY[b.status])); })
      .catch((e) => { if (live) setErr((e as Error).message); });
    return () => { live = false; };
  }, [closed, reload]);
  return (
    <>
      <PricingEditor />
      <label className="check orders-closed">
        <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} />
        <span>{t('แสดงเฉพาะที่ปิดแล้ว (ได้รับแล้ว / ยกเลิก)', 'Show closed only (received / cancelled)')}</span>
      </label>
      {err && <p className="error">{err}</p>}
      {!err && items === null && <p className="muted">{t('กำลังโหลด…', 'Loading…')}</p>}
      {items && !items.length && (
        <div className="community-msg"><p><b>{closed ? t('ยังไม่มีออเดอร์ที่ปิดแล้ว', 'No closed orders yet') : t('ไม่มีออเดอร์ที่รอดำเนินการ', 'No open orders')}</b></p></div>
      )}
      {items && items.length > 0 && <div className="review-list">{items.map((o) => <OrderCard key={o.id} order={o} />)}</div>}
    </>
  );
}

/** Prices per piece by size, shipping, and the PromptPay account customers pay into. */
function PricingEditor() {
  const [vals, setVals] = useState<Record<string, string> | null>(null);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let live = true;
    loadPricing().then((p) => {
      if (!live) return;
      const v: Record<string, string> = {
        shipping: String(p.shipping), promptpay_id: p.promptpayId, promptpay_name: p.promptpayName,
        stitch_rate: Number.isFinite(p.stitchRateSatang) ? (p.stitchRateSatang / 100).toFixed(2) : '',
      };
      for (const pr of PRODUCTS) for (const [s] of SIZE_LIMITS) v[`price:${pr.id}:${s}`] = String(p.prices[`${pr.id}:${s}`] ?? '');
      setVals(v);
      setSaved(v);
    }).catch((e) => setMsg((e as Error).message));
    return () => { live = false; };
  }, []);
  if (!vals) return msg ? <p className="error small">{msg}</p> : null;
  const changed = Object.keys(vals).filter((k) => vals[k] !== saved[k]);
  const badNumber = Object.keys(vals).some((k) => (k.startsWith('price:') || k === 'shipping') && !/^[0-9]{1,6}$/.test(vals[k].trim()));
  const badRate = !/^[0-9]{1,2}(\.[0-9]{1,2})?$/.test(vals.stitch_rate.trim());
  const ppDigits = vals.promptpay_id.replace(/[^0-9]/g, '');
  const badPP = !!vals.promptpay_id.trim() && !promptPayPayload(vals.promptpay_id, 1);
  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      await saveConfig(Object.fromEntries(changed.map((k) => [k, k === 'promptpay_id' ? ppDigits : vals[k]])));
      setSaved({ ...vals });
      setMsg(t('บันทึกแล้ว ใช้กับออเดอร์ใหม่ตั้งแต่ตอนนี้', 'Saved; applies to new orders from now on.'));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setVals({ ...vals, [k]: e.target.value });
  return (
    <details className="order-pricing" open={!saved.promptpay_id || undefined}>
      <summary><Icon name="edit" size={15} /> {t('ราคาและช่องทางชำระเงิน', 'Prices and payment')}{!saved.promptpay_id && <span className="status-chip hidden">{t('ยังไม่ตั้งพร้อมเพย์', 'PromptPay not set')}</span>}<span className="order-pricing-edit">{t('แก้ไข', 'Edit')}</span></summary>
      <table className="order-price-table">
        <thead><tr><th>{t('บาท/ชิ้น', 'THB per piece')}</th>{SIZE_LIMITS.map(([s, mm]) => <th key={s}>{s} <small>≤{mm / 10} {t('ซม.', 'cm')}</small></th>)}</tr></thead>
        <tbody>
          {PRODUCTS.map((pr) => (
            <tr key={pr.id}><th>{pr.name()}{pr.id === 'stitched' && <small> {t('(ราคาตั้งต้น)', '(starting price)')}</small>}</th>
              {SIZE_LIMITS.map(([s]) => <td key={s}><input inputMode="numeric" value={vals[`price:${pr.id}:${s}`]} onChange={set(`price:${pr.id}:${s}`)} aria-label={`${pr.name()} ${s}`} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="order-pay-fields">
        <label className="fb-field"><span>{t('ปักเสร็จ: ค่าปักต่อฝีเข็ม (บาท)', 'Fully stitched: per stitch (THB)')}</span><input inputMode="decimal" value={vals.stitch_rate} onChange={set('stitch_rate')} /></label>
        <label className="fb-field"><span>{t('ค่าจัดส่ง (บาท/ออเดอร์)', 'Shipping (THB per order)')}</span><input inputMode="numeric" value={vals.shipping} onChange={set('shipping')} /></label>
        <label className="fb-field"><span>{t('พร้อมเพย์ (เบอร์มือถือหรือเลขผู้เสียภาษี)', 'PromptPay (mobile or tax id)')}</span><input inputMode="numeric" value={vals.promptpay_id} onChange={set('promptpay_id')} autoComplete="off" /></label>
        <label className="fb-field"><span>{t('ชื่อบัญชีที่ลูกค้าจะเห็น', 'Account name customers see')}</span><input value={vals.promptpay_name} maxLength={100} onChange={set('promptpay_name')} /></label>
      </div>
      <p className="hint">{t('ปักเสร็จคิดราคา = ราคาตั้งต้นตามขนาด + ค่าปักต่อฝีเข็ม × จำนวนฝีเข็มของลาย แล้วปัดขึ้นให้ลงท้ายด้วย 9 เช่น 159 + 0.30 × 214 = 223.2 → 229 บาท',
        'Fully stitched = the starting price for the size + the per-stitch rate × the pattern’s stitches, rounded up to end in 9, e.g. 159 + 0.30 × 214 = 223.2 → 229.')}</p>
      <p className="hint">{t('ราคาใหม่ใช้กับออเดอร์ที่สั่งหลังบันทึก ออเดอร์เดิมคงราคาเดิม พร้อมเพย์จะเห็นได้เฉพาะผู้ใช้ที่เข้าสู่ระบบ',
        'New prices apply to orders placed after saving; existing orders keep theirs. Only signed-in users can see the PromptPay details.')}</p>
      {badNumber && <p className="error small">{t('ราคาต้องเป็นตัวเลขเต็ม', 'Prices must be whole numbers')}</p>}
      {badRate && <p className="error small">{t('ค่าปักต่อฝีเข็มต้องเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง เช่น 0.30', 'The per-stitch rate must be a number with up to 2 decimals, e.g. 0.30')}</p>}
      {badPP && <p className="error small">{t('พร้อมเพย์ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลข 13 หลัก', 'PromptPay must be a 10-digit mobile number or a 13-digit id')}</p>}
      <div className="btn-row">
        <button className="btn primary sm" onClick={save} disabled={busy || !changed.length || badNumber || badRate || badPP}>{busy ? t('กำลังบันทึก…', 'Saving…') : t('บันทึกราคา', 'Save')}</button>
        {msg && <span className="hint">{msg}</span>}
      </div>
    </details>
  );
}

function OrderCard({ order }: { order: Order }) {
  const [o, setO] = useState(order);
  const [p, setP] = useState<Pattern | null>(null);
  const [note, setNote] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [carrier, setCarrier] = useState(order.trackingCarrier);
  const [tracking, setTracking] = useState(order.trackingNo);
  // messages: count on the summary; opens by itself (once) when the customer wrote last and nobody has replied
  const [threadOpen, setThreadOpen] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const autoOpened = useRef(false);
  const onMessages = useCallback((list: OrderMessage[]) => {
    const waiting = list.length > 0 && !list[list.length - 1].fromTeam;
    setMsgCount(list.length);
    setAwaitingReply(waiting);
    if (waiting && !autoOpened.current) { autoOpened.current = true; setThreadOpen(true); }
  }, []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    decodeShare(o.data).then((x) => { if (live) setP({ ...x, name: o.title }); }).catch(() => { /* no preview */ });
    getTeamNote(o.id).then((n) => { if (live) { setNote(n); setSavedNote(n); } }).catch(() => { /* empty */ });
    return () => { live = false; };
  }, [o.id, o.data, o.title]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const setStatus = (status: OrderStatus, extra: { trackingCarrier?: string; trackingNo?: string } = {}) => run(async () => {
    await updateOrder(o.id, { status, ...extra });
    setO({ ...o, status, trackingCarrier: extra.trackingCarrier ?? o.trackingCarrier, trackingNo: extra.trackingNo ?? o.trackingNo });
  });
  const stl = () => {
    if (!p) return;
    downloadBlob(toBinaryStl(buildPlate(p, p.details.thicknessMm, p.details.holeRatio), o.code), `${o.code}-${safeFilename(o.title)}.stl`);
  };
  // the size the customer paid for, checked against the pattern itself
  const real = p ? sizeOf(p) : null;
  // the stitch count the price was based on (fully stitched), checked the same way
  const realStitches = p ? computeStats(p).total : null;
  const { w, h } = p ? pieceMm(p) : pieceMm(o);

  return (
    <article className="review-card order-card">
      <a className="review-thumb" href={`#/s/${o.data}`} title={t('เปิดลาย', 'Open pattern')}>
        {p ? <Thumb pattern={p} max={96} view="stitch" /> : <span className="post-wait" aria-hidden="true" />}
      </a>
      <div className="review-main">
        <div className="review-head">
          <b className="order-code-sm">{o.code}</b>
          <span className={`status-chip ${o.status === 'cancelled' ? 'removed' : o.status === 'done' ? 'published' : 'hidden'}`}>{ORDER_STATUS[o.status]()}</span>
          <span className="review-when">{when2(o.createdAt)}</span>
        </div>
        <div className="post-by"><b>{o.title}</b> <span className="muted">· {templateLabel(o.templateName) ?? '3D'} · {cm(w)} × {cm(h)} {t('ซม.', 'cm')} · {t(`${o.colors} สี`, `${o.colors} ${o.colors === 1 ? 'color' : 'colors'}`)}</span></div>
        {real && real !== o.size && <p className="error small">{t(`ขนาดในลายเป็น ${real} แต่ออเดอร์คิดราคาเป็น ${o.size}`, `The pattern is size ${real} but the order was priced as ${o.size}`)}</p>}
        {realStitches !== null && realStitches !== o.stitches && <p className="error small">{t(`ลายนี้มี ${realStitches.toLocaleString()} ฝีเข็ม แต่ออเดอร์บันทึกไว้ ${o.stitches.toLocaleString()} ฝีเข็ม ตรวจราคาก่อนยืนยันรับเงิน`, `The pattern has ${realStitches.toLocaleString()} stitches but the order says ${o.stitches.toLocaleString()}; check the price before confirming payment`)}</p>}
        <ul className="order-facts">
          <li><span>{t('แบบ', 'Product')}</span><b>{productName(o.product)}</b></li>
          <li><span>{t('สีพลาสติก', 'Plastic')}</span><b>{o.plasticColor || '–'}</b></li>
          <li><span>{t('จำนวน', 'Qty')}</span><b>{o.quantity}</b></li>
          <li><span>{t('ยอด', 'Total')}</span><b>{baht(o.total)}</b></li>
        </ul>
        <p className="order-addr small">{o.address.name} · {o.address.phone}<br />{o.address.address} {o.address.postcode}</p>
        {o.note && <p className="review-note">{o.note}</p>}

        <div className="order-next">
          {o.status === 'awaiting_payment' && <p className="muted small">{t('รอลูกค้าโอนและแนบสลิป', 'Waiting for the customer to pay and attach a slip')}</p>}
          {o.status === 'payment_review' && (
            <>
              <p className="small"><b>{t(`ตรวจสลิป: ต้องได้ ${baht(o.total)}`, `Check the slip: should be ${baht(o.total)}`)}</b></p>
              <SlipPeek path={o.slipPath} />
              <div className="review-actions">
                <button className="btn primary sm" disabled={busy} onClick={() => setStatus('paid')}><Icon name="check" size={15} /> {t('ยืนยันรับเงิน', 'Confirm payment')}</button>
                <button className="btn sm" disabled={busy} onClick={() => setStatus('awaiting_payment')}>{t('สลิปไม่ถูกต้อง ให้ส่งใหม่', 'Slip not right, ask again')}</button>
              </div>
              <p className="hint">{t('ถ้าสลิปไม่ถูกต้อง พิมพ์บอกเหตุผลลูกค้าในข้อความด้านล่างด้วย', 'If the slip is wrong, tell the customer why in the messages below.')}</p>
            </>
          )}
          {o.status === 'paid' && (
            <div className="review-actions">
              <button className="btn primary sm" disabled={busy} onClick={() => setStatus('in_production')}>{t('เริ่มผลิต', 'Start making')}</button>
            </div>
          )}
          {(o.status === 'in_production' || o.status === 'shipped') && (
            <div className="order-ship">
              <label className="fb-field"><span>{t('ขนส่ง', 'Carrier')}</span><input value={carrier} maxLength={40} onChange={(e) => setCarrier(e.target.value)} placeholder={t('เช่น ไปรษณีย์ไทย', 'e.g. Thailand Post')} /></label>
              <label className="fb-field"><span>{t('เลขพัสดุ', 'Tracking no.')}</span><input value={tracking} maxLength={60} onChange={(e) => setTracking(e.target.value)} /></label>
              <button className="btn primary sm" disabled={busy || !tracking.trim()}
                onClick={() => setStatus('shipped', { trackingCarrier: carrier, trackingNo: tracking })}>
                {o.status === 'shipped' ? t('แก้เลขพัสดุ', 'Update tracking') : t('แจ้งจัดส่งแล้ว', 'Mark shipped')}
              </button>
            </div>
          )}
        </div>

        <div className="order-team">
          <label className="fb-field">
            <span>{t('เปลี่ยนสถานะเอง', 'Set status')}</span>
            <select value={o.status} disabled={busy} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS[s]()}</option>)}
            </select>
          </label>
          <label className="fb-field order-team-note">
            <span>{t('บันทึกของทีม (ลูกค้าไม่เห็น)', 'Team note (not shown to the customer)')}</span>
            <textarea value={note} rows={2} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder={t('เช่น พิมพ์บนเครื่อง 2 ใช้ PLA ครีม', 'e.g. printer 2, cream PLA')} />
          </label>
        </div>
        <div className="review-actions">
          <button className="btn sm" onClick={() => run(async () => { await saveTeamNote(o.id, note); setSavedNote(note); })} disabled={busy || note === savedNote}>{t('บันทึกโน้ต', 'Save note')}</button>
          <a className="btn sm" href={`#/s/${o.data}`}><Icon name="edit" size={15} /> {t('เปิดลาย', 'Open pattern')}</a>
          <button className="btn sm" onClick={stl} disabled={!p}><Icon name="cube" size={15} /> {t('ดาวน์โหลด STL', 'Download STL')}</button>
        </div>
        {err && <p className="error small">{err}</p>}
        <details className="order-team-thread" open={threadOpen} onToggle={(e) => setThreadOpen(e.currentTarget.open)}>
          <summary>
            <Icon name="chat" size={15} /> {t('ข้อความกับลูกค้า', 'Messages with the customer')}
            {msgCount > 0 && <span className="muted"> ({msgCount})</span>}
            {awaitingReply && <span className="status-chip hidden">{t('รอทีมตอบ', 'Needs a reply')}</span>}
          </summary>
          <OrderThread orderId={o.id} asTeam onMessages={onMessages} />
        </details>
      </div>
    </article>
  );
}
