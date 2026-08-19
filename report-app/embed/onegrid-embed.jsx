// Embed entry: builds the FULL OneGrid app UI into a self-contained IIFE bundle
// (CSS injected by JS) so it can be hosted inside a Power BI custom visual.
// Exposes window.OneGridEmbed.mount(el, { apiBase }).
import { createRoot } from 'react-dom/client';
import App from '../src/App.jsx';
import '../src/index.css';

// The Power BI visual sandbox blocks localStorage/sessionStorage (access throws).
// Install an in-memory shim so the app (theme mode, tour state, etc.) doesn't crash.
function installSafeStorage() {
  function memStore() {
    const m = {};
    return {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null),
      setItem: (k, v) => { m[k] = String(v); },
      removeItem: (k) => { delete m[k]; },
      clear: () => { Object.keys(m).forEach((k) => delete m[k]); },
      key: (i) => Object.keys(m)[i] ?? null,
      get length() { return Object.keys(m).length; },
    };
  }
  ['localStorage', 'sessionStorage'].forEach((name) => {
    let broken = false;
    try { const s = window[name]; const t = '__oge_probe__'; s.setItem(t, '1'); s.removeItem(t); }
    catch (e) { broken = true; }
    if (broken) {
      try { Object.defineProperty(window, name, { value: memStore(), configurable: true }); } catch (e) { /* ignore */ }
    }
  });
}

export function mount(el, opts = {}) {
  if (opts && opts.apiBase && typeof window !== 'undefined') {
    window.__ONEGRID_API__ = opts.apiBase;
  }
  installSafeStorage();
  const root = createRoot(el);
  root.render(<App />);
  return () => { try { root.unmount(); } catch (e) { /* ignore */ } };
}

if (typeof window !== 'undefined') {
  window.OneGridEmbed = { mount };
}
