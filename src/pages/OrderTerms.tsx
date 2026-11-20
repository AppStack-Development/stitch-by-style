import type { ReactNode } from 'react';
import { t } from '../lib/i18n';
import { Icon } from '../components/Icon';
import { LangSwitch } from '../components/LangSwitch';
import { APP_NAME } from '../lib/brand';
import { ORDER_TERMS_VERSION } from '../lib/orders';

const CONTACT_EMAIL = 'admin@appstack-dev.io';

const Sec = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="privacy-sec">
    <h3>{title}</h3>
    {children}
  </section>
);

/**
 * "เงื่อนไขการสั่งซื้อ" (#/order-terms): what a customer agrees to when ordering a printed piece.
 * Every order records ORDER_TERMS_VERSION; when this text changes in substance, bump it.
 */
export function OrderTerms() {
  return (
    <div className="privacy-page">
      <header className="site-head">
        <a className="icon-btn" href="#/account" title={t('กลับไปหน้าของฉัน', 'Back to My stuff')} aria-label={t('กลับไปหน้าของฉัน', 'Back to My stuff')}><Icon name="back" /></a>
        <h2><Icon name="cube" size={18} /> {t('เงื่อนไขการสั่งซื้อ', 'Order terms')}</h2>
        <div className="spacer" />
        <LangSwitch />
      </header>
      <main className="privacy-main">
        <article className="privacy-doc">
          <h1>{t('เงื่อนไขการสั่งผลิตชิ้นงาน', 'Terms for ordering a piece')}</h1>
          <p className="hint">{t(`ฉบับ ${ORDER_TERMS_VERSION} · ปรับปรุงล่าสุด 21 พ.ย. 2569`, `Version ${ORDER_TERMS_VERSION} · last updated 21 Nov 2026`)}</p>
          <p className="privacy-lead">{t(
            `เงื่อนไขนี้ใช้เมื่อคุณสั่งผลิตชิ้นงาน 3D จากลายของคุณผ่าน ${APP_NAME} ซึ่งดำเนินการโดย AppStack Development ทุกชิ้นผลิตตามลายที่คุณส่งมาโดยเฉพาะ`,
            `These terms apply when you order a 3D printed piece of your pattern through ${APP_NAME}, run by AppStack Development. Every piece is made to order from the pattern you send.`,
          )}</p>

          <Sec title={t('สินค้าและราคา', 'The piece and the price')}>
            <ul>
              <li>{t('ราคาที่เห็นก่อนกดสั่งคือราคาที่ต้องจ่าย รวมค่าจัดส่งแล้ว และล็อกไว้ในออเดอร์ แม้ราคาจะเปลี่ยนภายหลัง', 'The price shown before you order is what you pay, shipping included, and it stays fixed on your order even if prices change later.')}</li>
              <li>{t('ชิ้นงานพิมพ์ 3D มีลายเส้นชั้นพิมพ์เล็ก ๆ ตามธรรมชาติ สีพลาสติกและสีด้ายจริงอาจต่างจากที่เห็นบนจอเล็กน้อย', '3D printed pieces have fine layer lines by nature, and real plastic and thread colours can look a little different from your screen.')}</li>
              <li>{t('“ชุดปักเอง” ให้ด้าย DMC ทุกสีในลาย ตัดตามปริมาณที่ลายใช้พร้อมเผื่อ ไม่ใช่ด้ายเต็มไจ', 'A “stitch-it-yourself kit” includes every DMC colour in the pattern, cut to the length the pattern needs plus spare, not full skeins.')}</li>
            </ul>
          </Sec>

          <Sec title={t('การชำระเงิน', 'Payment')}>
            <ul>
              <li>{t('ชำระผ่านพร้อมเพย์ตามยอดในหน้าออเดอร์ แล้วแนบสลิปในหน้าเดียวกัน ทีมตรวจยอดภายใน 1 วันทำการ', 'Pay by PromptPay for the amount on your order page and attach the slip there. We check it within one working day.')}</li>
              <li>{t('เราเริ่มผลิตหลังยืนยันการชำระเงินแล้วเท่านั้น', 'We start making your piece only once the payment is confirmed.')}</li>
              <li>{t('ออเดอร์ที่ไม่ชำระภายใน 7 วันหลังสั่ง อาจถูกยกเลิก', 'An order that isn’t paid within 7 days may be cancelled.')}</li>
            </ul>
          </Sec>

          <Sec title={t('การผลิตและจัดส่ง', 'Making and delivery')}>
            <ul>
              <li>{t('ปกติจัดส่งภายใน 5–7 วันทำการหลังยืนยันการชำระเงิน แบบปักเสร็จอาจใช้เวลานานกว่านี้ ทีมจะแจ้งในหน้าออเดอร์', 'We usually ship within 5–7 working days of confirming payment. Fully stitched pieces can take longer; we’ll tell you on the order page.')}</li>
              <li>{t('ตอนนี้จัดส่งเฉพาะในประเทศไทย เลขพัสดุจะแสดงในหน้าออเดอร์เมื่อส่งแล้ว', 'For now we deliver within Thailand only. The tracking number appears on your order page once it’s sent.')}</li>
              <li>{t('โปรดตรวจชื่อ เบอร์โทร และที่อยู่ให้ถูกต้อง ถ้าพัสดุตีกลับเพราะที่อยู่ไม่ถูกต้อง ค่าส่งรอบใหม่เป็นของผู้สั่ง', 'Please check your name, phone and address. If a parcel comes back because the address was wrong, the cost of sending it again is yours.')}</li>
            </ul>
          </Sec>

          <Sec title={t('การยกเลิก', 'Cancelling')}>
            <ul>
              <li>{t('ก่อนชำระเงิน ยกเลิกได้เองทันทีในหน้าออเดอร์', 'Before you pay, cancel any time on your order page.')}</li>
              <li>{t('ชำระแล้วแต่ทีมยังไม่เริ่มผลิต แจ้งยกเลิกในหน้าออเดอร์ได้ เราคืนเงินเต็มจำนวน', 'Paid but not yet in production: ask on your order page and we refund in full.')}</li>
              <li>{t('เมื่อสถานะเป็น “กำลังผลิต” แล้ว ยกเลิกไม่ได้ เพราะชิ้นงานทำตามลายของคุณโดยเฉพาะ', 'Once the status is “In production” it can’t be cancelled, because the piece is made just for you.')}</li>
            </ul>
          </Sec>

          <Sec title={t('ชิ้นงานเสียหายหรือไม่ตรงลาย', 'If something’s wrong')}>
            <p>{t('ถ้าชิ้นงานเสียหายระหว่างขนส่ง พิมพ์ผิด หรือไม่ตรงกับลายและตัวเลือกในออเดอร์ แจ้งในหน้าออเดอร์ภายใน 7 วันหลังได้รับ พร้อมรูปถ่ายชิ้นงานและกล่อง เราจะผลิตใหม่และส่งให้ฟรี หรือคืนเงิน ตามที่คุณเลือก',
              'If the piece is damaged in transit, misprinted, or doesn’t match the pattern and options on your order, tell us on the order page within 7 days of receiving it, with photos of the piece and the box. We’ll make a new one and send it free, or refund you, whichever you prefer.')}</p>
          </Sec>

          <Sec title={t('การคืนสินค้า', 'Returns')}>
            <p>{t('ชิ้นงานทุกชิ้นผลิตตามลายของคุณโดยเฉพาะ จึงไม่รับคืนกรณีเปลี่ยนใจ เว้นแต่กฎหมายกำหนดไว้เป็นอย่างอื่น',
              'Every piece is made to your own pattern, so we don’t take returns for a change of mind, except where the law says otherwise.')}</p>
          </Sec>

          <Sec title={t('การคืนเงิน', 'Refunds')}>
            <p>{t('เมื่ออนุมัติคืนเงินแล้ว เราโอนคืนผ่านพร้อมเพย์หรือบัญชีที่คุณแจ้งในหน้าออเดอร์ ภายใน 7 วันทำการ',
              'Once a refund is agreed, we send it by PromptPay or to the account you give us on the order page, within 7 working days.')}</p>
          </Sec>

          <Sec title={t('สิทธิ์ในลายที่สั่งผลิต', 'Rights in the pattern')}>
            <ul>
              <li>{t('คุณยืนยันว่ามีสิทธิ์ใช้ลายที่สั่งผลิต เช่น เป็นลายที่คุณออกแบบเอง หรือลายจากชุมชนที่นำมาใช้เองตามข้อกำหนดการแชร์', 'You confirm you may use the pattern you order, for example one you designed, or a community pattern for your own use under the sharing terms.')}</li>
              <li>{t('เราขอสงวนสิทธิ์ไม่ผลิตลายที่ใช้ตัวการ์ตูน โลโก้ หรือแบรนด์ของคนอื่นโดยไม่ได้รับอนุญาต หรือมีเนื้อหาไม่เหมาะสม ถ้าชำระเงินแล้วเราคืนเงินเต็มจำนวน',
                'We may decline patterns that use other people’s characters, logos or brands without permission, or that have inappropriate content. If you’ve paid, we refund in full.')}</li>
            </ul>
          </Sec>

          <Sec title={t('ข้อมูลส่วนตัว', 'Your information')}>
            <p>{t('ข้อมูลที่ใช้ในการสั่งซื้อและระยะเวลาที่เก็บ อธิบายไว้ใน', 'What we keep for an order, and for how long, is in the')}{' '}
              <a className="acct-link" href="#/privacy">{t('นโยบายความเป็นส่วนตัว', 'privacy notice')}</a></p>
          </Sec>

          <Sec title={t('ติดต่อเรา', 'Contact')}>
            <p>{t('คุยกับทีมได้ที่ช่องข้อความในหน้าออเดอร์ หรืออีเมล', 'Write to us in the messages on your order page, or email')}{' '}
              <a className="acct-link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
          </Sec>
        </article>
      </main>
    </div>
  );
}
