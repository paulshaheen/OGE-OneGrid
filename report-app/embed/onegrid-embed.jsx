// Embed entry: builds the FULL OneGrid app UI into a self-contained IIFE bundle
// (CSS injected by JS) so it can be hosted inside a Power BI custom visual.
// Exposes window.OneGridEmbed.mount(el, { apiBase }).
import { createRoot } from 'react-dom/client';
import App from '../src/App.jsx';
import '../src/index.css';

export function mount(el, opts = {}) {
  if (opts && opts.apiBase && typeof window !== 'undefined') {
    window.__ONEGRID_API__ = opts.apiBase;
  }
  const root = createRoot(el);
  root.render(<App />);
  return () => { try { root.unmount(); } catch (e) { /* ignore */ } };
}

if (typeof window !== 'undefined') {
  window.OneGridEmbed = { mount };
}
