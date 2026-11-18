import { lang, setLang } from '../lib/i18n';
import { Icon } from './Icon';

/** Header button that flips the UI between Thai and English (reloads the page). */
export function LangSwitch() {
  const next = lang === 'th' ? 'en' : 'th';
  return (
    <button className="btn ghost lang-switch" onClick={() => setLang(next)}
      title={lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'} lang={next}>
      <Icon name="globe" size={16} /> <span>{next === 'en' ? 'EN' : 'ไทย'}</span>
    </button>
  );
}
