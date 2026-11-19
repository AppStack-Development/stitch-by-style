import type { ReactNode } from 'react';
import { t } from '../lib/i18n';
import { Icon } from '../components/Icon';
import { LangSwitch } from '../components/LangSwitch';

/** Contact address for privacy requests. Leave empty until there is a real one. */
const CONTACT_EMAIL = 'admin@appstack-dev.io';

const Sec = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="privacy-sec">
    <h3>{title}</h3>
    {children}
  </section>
);

const AccountLink = ({ children }: { children: ReactNode }) => <a className="acct-link" href="#/account">{children}</a>;

export function Privacy() {
  return (
    <div className="privacy-page">
      <header className="site-head">
        <a className="icon-btn" href="#/" title={t('กลับหน้าแรก', 'Back to home')} aria-label={t('กลับหน้าแรก', 'Back to home')}><Icon name="back" /></a>
        <h2><Icon name="shield" size={18} /> {t('ความเป็นส่วนตัว', 'Privacy')}</h2>
        <div className="spacer" />
        <LangSwitch />
      </header>
      <main className="privacy-main">
        <article className="privacy-doc">
          <h1>{t('นโยบายความเป็นส่วนตัว', 'Privacy notice')}</h1>
          <p className="hint">{t('ปรับปรุงล่าสุด 19 พ.ย. 2569', 'Last updated 19 Nov 2026')}</p>
          <p className="privacy-lead">{t(
            'ประกาศนี้อธิบายว่าเราเก็บและใช้ข้อมูลส่วนบุคคลของคุณอย่างไร ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) สรุปสั้น ๆ: ถ้าไม่เข้าสู่ระบบ เราไม่เก็บข้อมูลอะไรของคุณเลย',
            'This notice explains how we collect and use your personal data, in line with Thailand’s Personal Data Protection Act (PDPA). In short: if you don’t sign in, we don’t collect anything about you.',
          )}</p>

          <Sec title={t('ใครดูแลบริการนี้', 'Who runs this service')}>
            <p>{t('Stitch by Style ดำเนินการโดย AppStack Development ซึ่งเป็นผู้ควบคุมข้อมูลส่วนบุคคลของคุณ',
              'Stitch by Style is operated by AppStack Development, the data controller for your personal data.')}</p>
          </Sec>

          <Sec title={t('ใช้งานโดยไม่มีบัญชี', 'Using it without an account')}>
            <p>{t('บัญชีเป็นตัวเลือกเสริม ถ้าไม่เข้าสู่ระบบ ลาย ความคืบหน้า และรายการด้ายทั้งหมดจะเก็บไว้ในเบราว์เซอร์บนเครื่องของคุณเท่านั้น ไม่ถูกส่งมาที่เรา',
              'Accounts are optional. If you don’t sign in, your patterns, progress and thread list stay only in the browser on your device and are never sent to us.')}</p>
          </Sec>

          <Sec title={t('ข้อมูลที่เราเก็บ (เฉพาะเมื่อเข้าสู่ระบบ)', 'What we collect (only when you sign in)')}>
            <ul>
              <li>{t('ชื่อ อีเมล และรูปโปรไฟล์จากบัญชี Google ของคุณ', 'Your name, email address and profile picture from your Google account')}</li>
              <li>{t('ลายปักของคุณ รวมถึงความคืบหน้าการปัก', 'Your patterns, including your stitching progress')}</li>
              <li>{t('รายการ “ด้ายของฉัน”', 'Your “My threads” list')}</li>
              <li>{t('ภาษาที่คุณเลือกใช้', 'Your language preference')}</li>
            </ul>
          </Sec>

          <Sec title={t('เราใช้ข้อมูลเพื่ออะไร', 'Why we use it')}>
            <p>{t('เพื่อซิงก์งานของคุณระหว่างอุปกรณ์ และสำรองไว้ไม่ให้หาย เท่านั้น เราประมวลผลข้อมูลนี้ตามความยินยอมของคุณเมื่อคุณเลือกเข้าสู่ระบบ',
              'Only to sync your work between your devices and keep a backup of it. We process this data based on the consent you give when you choose to sign in.')}</p>
          </Sec>

          <Sec title={t('สิ่งที่เราไม่ทำ', 'What we don’t do')}>
            <ul>
              <li>{t('ไม่มีโฆษณา และไม่ขายหรือแบ่งปันข้อมูลของคุณเพื่อการตลาด', 'No ads, and we never sell or share your data for marketing')}</li>
              <li>{t('ไม่ใช้คุกกี้ติดตามพฤติกรรม', 'No tracking cookies')}</li>
            </ul>
            <p>{t('เราใช้พื้นที่จัดเก็บในเบราว์เซอร์ (local storage) เพื่อเก็บงานของคุณและสถานะการเข้าสู่ระบบไว้บนเครื่องนี้เท่านั้น',
              'We use your browser’s local storage only to keep your work and your sign-in session on this device.')}</p>
          </Sec>

          <Sec title={t('ข้อมูลเก็บไว้ที่ไหน', 'Where it’s stored')}>
            <p>{t('ข้อมูลในบัญชีเก็บไว้กับ Supabase ผู้ให้บริการฐานข้อมูลบนคลาวด์ ซึ่งเซิร์ฟเวอร์อาจอยู่นอกประเทศไทย ส่วนการเข้าสู่ระบบดำเนินการโดย Google ผู้ให้บริการทั้งสองรายใช้ข้อมูลเพื่อให้บริการนี้แทนเราเท่านั้น',
              'Account data is stored with Supabase, a cloud database provider whose servers may be outside Thailand. Sign-in is handled by Google. Both act only to provide this service on our behalf.')}</p>
          </Sec>

          <Sec title={t('เก็บไว้นานแค่ไหน', 'How long we keep it')}>
            <p>{t('จนกว่าคุณจะลบข้อมูลนั้น หรือลบบัญชี เมื่อลบบัญชี ข้อมูลทั้งหมดในระบบจะถูกลบถาวร',
              'Until you delete it or delete your account. Deleting your account permanently removes all of its data from our systems.')}</p>
          </Sec>

          <Sec title={t('สิทธิของคุณ', 'Your rights')}>
            <p>{t('คุณมีสิทธิตามกฎหมาย PDPA และทำได้เองทั้งหมดที่', 'Under the PDPA you have these rights, and you can use them yourself on the')}{' '}
              <AccountLink>{t('หน้าบัญชี', 'Account page')}</AccountLink>:</p>
            <ul>
              <li>{t('ขอเข้าถึงและรับสำเนาข้อมูล: กด “ดาวน์โหลดข้อมูลของฉัน”', 'Access and get a copy of your data: use “Download my data”')}</li>
              <li>{t('แก้ไขข้อมูล: แก้ลายและรายการด้ายได้ในแอป ส่วนชื่อและรูปมาจากบัญชี Google ของคุณ', 'Correct your data: edit your patterns and thread list in the app; your name and picture come from your Google account')}</li>
              <li>{t('ลบข้อมูล: ลบลายแต่ละลาย หรือกด “ลบบัญชี” เพื่อลบทั้งหมด', 'Delete your data: delete individual patterns, or use “Delete account” to remove everything')}</li>
              <li>{t('ถอนความยินยอม: ลบบัญชีได้ทุกเมื่อ', 'Withdraw your consent: delete your account at any time')}</li>
            </ul>
            <p>{t('หากเห็นว่าเราใช้ข้อมูลไม่ถูกต้อง คุณร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.) ได้',
              'If you believe we have mishandled your data, you can complain to Thailand’s Personal Data Protection Committee (PDPC).')}</p>
          </Sec>

          <Sec title={t('ติดต่อเรา', 'Contact')}>
            {CONTACT_EMAIL ? (
              <p>{t('มีคำถามเรื่องข้อมูลส่วนบุคคล ติดต่อ AppStack Development ได้ที่', 'For questions about your personal data, contact AppStack Development at')}{' '}
                <a className="acct-link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
            ) : (
              <p>{t(<>สิทธิส่วนใหญ่ใช้ได้เองทันทีที่<AccountLink>หน้าบัญชี</AccountLink> หากมีคำถามอื่น ติดต่อผู้ดูแลเว็บไซต์ (AppStack Development) ผ่านช่องทางติดต่อหรือส่งความคิดเห็นของเว็บไซต์</>,
                <>You can use most of your rights yourself on the <AccountLink>Account page</AccountLink>. For anything else, contact the site owner (AppStack Development) through the site’s contact or feedback channel.</>)}</p>
            )}
          </Sec>
        </article>
      </main>
    </div>
  );
}
