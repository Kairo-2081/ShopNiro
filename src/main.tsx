import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import LegalPage from './components/legal/LegalPage.tsx';
import { policyByPath } from './components/legal/policies.ts';
import './index.css';
import 'leaflet/dist/leaflet.css';

// Suppress benign Vite dev server WebSocket HMR rejections in sandboxed preview iframe
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = String(event?.reason?.message || event?.reason || '');
    if (
      reasonStr.includes('WebSocket') ||
      reasonStr.includes('vite') ||
      reasonStr.includes('ws://') ||
      reasonStr.includes('wss://')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

// Public policy pages (/terms, /privacy, /refunds, /delivery) render without the app shell or any API call.
const policy = typeof window !== 'undefined' ? policyByPath(window.location.pathname) : undefined;

createRoot(document.getElementById('root')!).render(
  <StrictMode>{policy ? <LegalPage policy={policy} /> : <App />}</StrictMode>,
);

