import { useEffect, useState } from 'react';
import { Home } from './pages/Home';
import { NewPattern } from './pages/NewPattern';
import { Editor } from './pages/Editor';
import { PrintView } from './pages/PrintView';
import { SharedView } from './pages/SharedView';
import { StitchMode } from './pages/StitchMode';
import { TransferView } from './pages/TransferView';
import { Guide } from './pages/Guide';
import { QuickCreate } from './pages/QuickCreate';
import { MyThreads } from './pages/MyThreads';
import { Account } from './pages/Account';
import { ConfirmHost } from './components/ConfirmDialog';
import { openPattern } from './lib/drafts';
import { Privacy } from './pages/Privacy';
import { Community } from './pages/Community';
import { CommunityPost } from './pages/CommunityPost';
import { Terms } from './pages/Terms';
import { Moderation } from './pages/Moderation';
import { OrderPage } from './pages/OrderPage';
import { OrderTerms } from './pages/OrderTerms';
import { MergeDialog } from './components/MergeDialog';
import { FeedbackDialog } from './components/FeedbackDialog';
import { loadPattern } from './lib/storage';
import { NEW_ORIGIN, stuckOnOldDomain } from './lib/domainMove';
import { t } from './lib/i18n';
import { SITE_HOST } from './lib/brand';

export function navigate(hash: string) {
  location.hash = hash;
}

function useHash() {
  const [hash, setHash] = useState(location.hash || '#/');
  useEffect(() => {
    const on = () => {
      setHash(location.hash || '#/');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export function App() {
  // the account merge question can come up on any page right after signing in
  return <>{stuckOnOldDomain && <MovedNotice />}<Routes /><MergeDialog /><FeedbackDialog /><ConfirmHost /></>;
}

/** Only on the old address when this browser has too much data to carry over in a link. */
function MovedNotice() {
  return (
    <div className="moved-notice" role="status">
      {t(<>เราย้ายไปที่ <a href={NEW_ORIGIN}>{SITE_HOST}</a> แล้ว ลายในเครื่องนี้มีมากเกินกว่าจะย้ายให้อัตโนมัติ <a href="#/account">เข้าสู่ระบบ</a> เพื่อเก็บลายไว้ในบัญชี แล้วเข้าสู่ระบบอีกครั้งที่เว็บใหม่</>,
        <>We’ve moved to <a href={NEW_ORIGIN}>{SITE_HOST}</a>. This browser has too many patterns to carry over automatically: <a href="#/account">sign in</a> to keep them in your account, then sign in again on the new site.</>)}
    </div>
  );
}

function Routes() {
  const hash = useHash();
  const parts = hash.replace(/^#\/?/, '').split('/');
  const [route, arg] = parts;

  if (route === 'guide') return <Guide section={arg} />;
  if (route === 'quick') return <QuickCreate />;
  if (route === 'threads') return <MyThreads />;
  if (route === 'account') return <Account />;
  if (route === 'privacy') return <Privacy />;
  if (route === 'terms') return <Terms />;
  if (route === 'order-terms') return <OrderTerms />;
  if (route === 'community') return <Community key={arg ?? ''} tag={arg} />;
  if (route === 'moderation') return <Moderation key={arg ?? ''} startTab={arg === 'orders' ? 'orders' : undefined} />;
  if (route === 'order' && arg) return <OrderPage key={arg} code={arg} />;
  if (route === 'c' && arg) return <CommunityPost key={arg} id={arg} />;
  if (route === 'new') return <NewPattern key={arg} mode={arg === 'template' ? 'template' : 'free'} />;
  if (route === 'edit' && arg) return <Editor key={arg} id={arg} />;
  if (route === 'stitch' && arg) return <StitchMode key={arg} id={arg} />;
  if (route === 'print' && arg) {
    const p = openPattern(arg); // a saved pattern, or one only being tried in this tab
    if (!p) return <div className="empty-state"><h2>{t('ไม่พบลายนี้', 'Pattern not found')}</h2><a className="btn primary" href="#/">{t('กลับหน้าแรก', 'Back to home')}</a></div>;
    return <PrintView key={arg} pattern={p} backHref={`#/edit/${arg}`} />;
  }
  if (route === 's' && arg) return <SharedView key={arg} data={parts.slice(1).join('/')} />;
  if (route === 't' && arg) return <TransferView key={arg} data={parts.slice(1).join('/')} />;
  return <Home />;
}
