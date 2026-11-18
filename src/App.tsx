import { useEffect, useState } from 'react';
import { Home } from './pages/Home';
import { NewPattern } from './pages/NewPattern';
import { Editor } from './pages/Editor';
import { PrintView } from './pages/PrintView';
import { SharedView } from './pages/SharedView';
import { loadPattern } from './lib/storage';

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
  const hash = useHash();
  const parts = hash.replace(/^#\/?/, '').split('/');
  const [route, arg] = parts;

  if (route === 'new') return <NewPattern key={arg} mode={arg === 'template' ? 'template' : 'free'} />;
  if (route === 'edit' && arg) return <Editor key={arg} id={arg} />;
  if (route === 'print' && arg) {
    const p = loadPattern(arg);
    if (!p) return <div className="empty-state"><h2>ไม่พบลายนี้</h2><a className="btn primary" href="#/">กลับหน้าแรก</a></div>;
    return <PrintView key={arg} pattern={p} backHref={`#/edit/${arg}`} />;
  }
  if (route === 's' && arg) return <SharedView key={arg} data={parts.slice(1).join('/')} />;
  return <Home />;
}
