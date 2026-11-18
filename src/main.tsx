import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './lib/pwa';
import './styles.css';
import './styles/editor-mobile.css';
import './styles/defaults.css';
import './styles/samples.css';

createRoot(document.getElementById('root')!).render(<App />);
registerServiceWorker();
