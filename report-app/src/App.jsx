import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MODES, PERSONAS } from './lib/themes.js';
import { FocusProvider } from './lib/focus.js';
import { useCapacityStatus } from './lib/api.js';
import Executive from './personas/Executive.jsx';
import ControlRoom from './personas/ControlRoom.jsx';
import Maintenance from './personas/Maintenance.jsx';
import Ontology from './personas/Ontology.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import { Tour, TOUR_STEPS } from './components/Tour.jsx';

const PAGES = { executive: Executive, controlroom: ControlRoom, maintenance: Maintenance, ontology: Ontology };

// Full-width strip shown when the Fabric capacity backing the data is paused (e.g. auto-paused
// outside normal operating hours). Explains why values are blank; auto-hides when it resumes.
function CapacityPausedBanner({ status }) {
  return (
    <AnimatePresence>
      {status && status.capacityPaused && (
        <motion.div
          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }} role="status" aria-live="polite"
          className="relative z-10 overflow-hidden"
          style={{ background: 'linear-gradient(90deg, rgba(245,158,11,.16), rgba(245,158,11,.08))', borderBottom: '1px solid rgba(245,158,11,.45)' }}>
          <div className="flex items-center gap-3 px-4 sm:px-6 py-2.5">
            <span className="grid place-items-center w-6 h-6 rounded-full shrink-0" style={{ background: 'rgba(245,158,11,.25)', color: '#f59e0b' }}>
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            </span>
            <div className="leading-tight min-w-0">
              <div className="text-sm font-semibold" style={{ color: '#fbbf24' }}>
                {status.inferred ? 'Live data unavailable' : 'Fabric capacity paused'}
              </div>
              <div className="text-[12px] opacity-80" style={{ color: '#fde68a' }}>
                {status.message || 'Live data is unavailable outside normal operating hours. Readings refresh automatically when the capacity restarts.'}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  const [personaId, setPersonaId] = useState('executive');
  const [mode, setMode] = useState(() => (typeof localStorage !== 'undefined' && localStorage.getItem('pm.theme.mode')) || 'dark');
  const [tourOpen, setTourOpen] = useState(false);
  const capacityStatus = useCapacityStatus();
  const theme = MODES[mode] || MODES.light;
  const Persona = PAGES[personaId];
  const toggleMode = () => { const m = mode === 'light' ? 'dark' : 'light'; setMode(m); try { localStorage.setItem('pm.theme.mode', m); } catch { /* ignore */ } };

  // Auto-launch the tour on first visit.
  useEffect(() => {
    try {
      if (!localStorage.getItem('pm.tour.seen')) {
        const t = setTimeout(() => setTourOpen(true), 900);
        localStorage.setItem('pm.tour.seen', '1');
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, []);

  return (
    <FocusProvider>
    <div className={`h-full w-full flex flex-col ${theme.app} ${theme.gridClass}`} style={theme.appStyle}>
      <header className={`relative z-20 flex items-center gap-4 px-4 sm:px-6 h-14 ${theme.nav}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg grid place-items-center font-black text-sm"
            style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.chart.series[1]})`, color: theme.mode === 'light' ? '#fff' : '#0a0f14' }}>OG</div>
          <div className="leading-tight">
            <div className={`text-sm font-bold ${theme.heading}`}>OneGrid</div>
            <div className={`text-[10px] uppercase tracking-widest ${theme.sub}`}>{PERSONAS.find((p) => p.id === personaId)?.tagline}</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div data-tour="tabs" className="flex items-center gap-1 p-1 rounded-xl" style={{ background: theme.mode === 'light' ? 'rgba(0,0,0,.04)' : 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
            {PERSONAS.map((t) => (
              <button key={t.id} onClick={() => setPersonaId(t.id)} title={t.tagline}
                className={`relative px-3.5 py-1.5 rounded-lg text-sm font-semibold transition ${personaId === t.id ? '' : `${theme.navText} hover:opacity-100`}`}
                style={personaId === t.id ? { color: theme.accent } : {}}>
                {personaId === t.id && <motion.span layoutId="personapill" className="absolute inset-0 rounded-lg" style={{ background: `${theme.accent}1f`, border: `1px solid ${theme.accent}55` }} />}
                <span className="relative">{t.name}</span>
              </button>
            ))}
          </div>

          {/* Light / Dark toggle — applies to every tab */}
          <button data-tour="theme" onClick={toggleMode} title={`Switch to ${mode === 'light' ? 'dark' : 'light'} theme`}
            className="relative w-14 h-8 rounded-full transition shrink-0"
            style={{ background: theme.mode === 'light' ? 'rgba(15,23,42,.08)' : 'rgba(255,255,255,.10)', border: `1px solid ${theme.mode === 'light' ? 'rgba(15,23,42,.12)' : 'rgba(255,255,255,.14)'}` }}>
            <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full grid place-items-center"
              style={{ left: mode === 'light' ? 3 : 'calc(100% - 27px)', background: theme.accent, color: theme.mode === 'light' ? '#fff' : '#06121f' }}>
              {mode === 'light'
                ? <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><circle cx="12" cy="12" r="5" /><g stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></g></svg>
                : <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
            </motion.span>
          </button>

          {/* Help / guided tour */}
          <button onClick={() => setTourOpen(true)} title="Take a quick tour"
            className="w-8 h-8 rounded-full grid place-items-center shrink-0 transition hover:opacity-80"
            style={{ background: `${theme.accent}1f`, color: theme.accent, border: `1px solid ${theme.accent}55` }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9.1 9a3 3 0 1 1 4.5 2.6c-.9.5-1.6 1.2-1.6 2.4" strokeLinecap="round" /><circle cx="12" cy="17.5" r="0.6" fill="currentColor" stroke="none" /></svg>
          </button>
        </div>
      </header>

      <CapacityPausedBanner status={capacityStatus} />

      <main className="relative flex-1 min-h-0">
        <AnimatePresence mode="wait">
          <motion.div key={personaId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }} className="absolute inset-0">
            <Persona theme={theme} onNavigate={setPersonaId} />
          </motion.div>
        </AnimatePresence>
      </main>

      <ChatPanel theme={theme} persona={personaId} />
      <Tour open={tourOpen} steps={TOUR_STEPS} theme={theme} onNavigate={setPersonaId} onClose={() => setTourOpen(false)} />
    </div>
    </FocusProvider>
  );
}
