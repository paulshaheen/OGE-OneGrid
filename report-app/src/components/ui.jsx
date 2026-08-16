import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { statusOf } from '../lib/format.js';

export function Modal({ open, onClose, theme, children, size = 'max-w-3xl' }) {
  // Portal to <body> so an ancestor with a transform (framer-motion) / overflow-hidden
  // can never clip or mis-position this fixed overlay (the briefing modal bug).
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${theme.overlay}`}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`w-full ${size} max-h-[92vh] overflow-hidden ${theme.modal}`}
            initial={{ scale: 0.92, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 10, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function StatusDot({ status, size = 8 }) {
  const s = statusOf(status);
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <span className="absolute inset-0 rounded-full" style={{ background: s.color, boxShadow: `0 0 10px ${s.glow}` }} />
      {status !== 'ok' && <span className="absolute inset-0 rounded-full animate-pingslow" style={{ background: s.color }} />}
    </span>
  );
}

export function Pill({ status, children, theme }) {
  const s = statusOf(status);
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}44` }}>
      <StatusDot status={status} size={7} /> {children || s.label}
    </span>
  );
}

export function Chip({ theme, children, className = '' }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${theme.chip} ${className}`}>{children}</span>;
}

export function SectionTitle({ theme, children, right }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className={`text-sm font-semibold tracking-wide uppercase ${theme.sub}`}>{children}</h3>
      {right}
    </div>
  );
}

export function Spinner({ theme, label = 'Loading…' }) {
  return (
    <div className={`flex items-center gap-3 ${theme.sub} text-sm py-10 justify-center`}>
      <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      {label}
    </div>
  );
}
