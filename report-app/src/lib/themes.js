// Two global visual MODES — Light and Dark — applied consistently across every persona
// tab. (Light is the former "Executive" look; Dark is the former "Control-Room" look.)
// Each mode keeps id/persona = 'executive'/'controlroom' so existing light-vs-dark visual
// checks (theme.persona === 'executive', theme.id === 'executive') keep working.
export const MODES = {
  light: {
    id: 'executive', mode: 'light', name: 'Light', persona: 'executive',
    app: 'bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-800',
    appStyle: {},
    nav: 'bg-white/70 glass border-b border-slate-200/70',
    navText: 'text-slate-500', navActive: 'text-slate-900',
    panel: 'bg-white/70 glass border border-white/60 shadow-xl shadow-slate-300/30 rounded-2xl',
    panelSolid: 'bg-white border border-slate-200 rounded-2xl shadow-sm',
    card: 'bg-white/85 glass border border-white/70 shadow-lg shadow-slate-300/25 rounded-2xl',
    heading: 'text-slate-900', sub: 'text-slate-500',
    accent: '#4f6bff', accentText: 'text-indigo-600',
    chip: 'bg-slate-100 text-slate-600 border border-slate-200',
    gridClass: '',
    modal: 'bg-white/92 glass border border-white/70 rounded-3xl shadow-2xl',
    overlay: 'bg-slate-900/30 backdrop-blur-sm',
    chart: { grid: '#e2e8f0', axis: '#94a3b8', series: ['#4f6bff', '#22c3a6', '#f59e0b', '#ef4444', '#8b5cf6'] },
    three: { bg: '#e9eef6', fog: ['#e9eef6', 70, 260], env: 'city', ground: '#cfd8e6', emissive: 0.3, bloom: 0.3, ambient: 0.95, sun: 1.15 },
  },
  dark: {
    id: 'controlroom', mode: 'dark', name: 'Dark', persona: 'controlroom',
    app: 'text-slate-200',
    appStyle: { background: 'radial-gradient(1200px 800px at 20% -10%, #14233b 0%, #0a1017 45%, #070b11 100%)' },
    nav: 'bg-[#0b131e]/80 glass border-b border-white/5',
    navText: 'text-slate-500', navActive: 'text-cyan-300',
    panel: 'bg-[#0d1826]/70 glass border border-white/5 rounded-xl shadow-2xl shadow-black/40',
    panelSolid: 'bg-[#0d1826] border border-white/5 rounded-xl',
    card: 'bg-gradient-to-b from-[#101f30]/80 to-[#0b1420]/80 glass border border-white/5 rounded-xl shadow-xl shadow-black/40',
    heading: 'text-white', sub: 'text-slate-400',
    accent: '#37e0d0', accentText: 'text-cyan-300',
    chip: 'bg-white/5 text-slate-300 border border-white/10',
    gridClass: 'ops-grid',
    modal: 'bg-[#0c1622]/95 glass border border-cyan-400/20 rounded-2xl shadow-2xl',
    overlay: 'bg-black/60 backdrop-blur-sm',
    chart: { grid: 'rgba(120,140,170,.12)', axis: '#5b7085', series: ['#37e0d0', '#5aa9ff', '#ffcc4d', '#ff5470', '#a78bfa'] },
    three: { bg: '#070b11', fog: ['#070b11', 70, 260], env: 'night', ground: '#0c141d', emissive: 0.6, bloom: 0.85, ambient: 0.4, sun: 0.85 },
  },
};

// The three persona TABS drive layout + content only (colours come from the active MODE).
export const PERSONAS = [
  { id: 'executive', name: 'Executive', tagline: 'Fleet performance at a glance' },
  { id: 'controlroom', name: 'Control-Room', tagline: 'Live mission-control operations' },
  { id: 'maintenance', name: 'Maintenance', tagline: 'Critical issues & work orders' },
  { id: 'ontology', name: 'Ontology', tagline: 'Knowledge graph of the data model' },
];

// Back-compat: some code still imports THEMES keyed by persona id.
export const THEMES = { executive: MODES.light, controlroom: MODES.dark, maintenance: MODES.dark };
export const THEME_LIST = PERSONAS;
