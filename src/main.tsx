import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './lib/pwa';
import { initCloud } from './lib/cloud';
import { initSync } from './lib/sync';
import './styles.css';
import './styles/editor-mobile.css';
import './styles/defaults.css';
import './styles/samples.css';
import './styles/threads.css';
import './styles/quick.css';
import './styles/account.css';
import './styles/consistency.css';

createRoot(document.getElementById('root')!).render(<App />);
registerServiceWorker();
// optional accounts: no-ops unless Supabase is configured at build time
initSync();
initCloud();
