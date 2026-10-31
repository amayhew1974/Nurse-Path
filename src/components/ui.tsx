import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

/* ---------- Modal (native <dialog>: focus is trapped and Escape closes it) ---------- */
export function Modal({ open, title, onClose, children, footer, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="modal" style={wide ? { width: 'min(760px, calc(100vw - 32px))' } : undefined} onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }} aria-labelledby="modal-title">
      {open && (
        <>
          <div className="modal-head">
            <h2 id="modal-title" style={{ fontSize: '1.2rem' }}>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

/* ---------- Two-step confirm (no browser pop-ups) ---------- */
export function ConfirmButton({ label, confirmLabel, onConfirm, className = 'btn danger sm', icon, prompt }: { label: string; confirmLabel: string; onConfirm: () => void; className?: string; icon?: string; prompt?: string }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className={className} onClick={() => setAsking(true)}>
        {icon && <Icon name={icon} />}
        {label}
      </button>
    );
  }
  return (
    <span className="row" role="group" aria-label="Confirm">
      {prompt && <span className="small">{prompt}</span>}
      <button type="button" className="btn danger solid sm" onClick={() => { setAsking(false); onConfirm(); }} autoFocus>{confirmLabel}</button>
      <button type="button" className="btn sm" onClick={() => setAsking(false)}>Cancel</button>
    </span>
  );
}

/* ---------- Toast ---------- */
const ToastCtx = createContext<(msg: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite" role="status" className="sr-only">{msg}</div>
      {msg && <div className="toast" aria-hidden="true">{msg}</div>}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- Empty state ---------- */
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Meter({ value, label, gold }: { value: number; label: string; gold?: boolean }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`meter${gold ? ' gold' : ''}`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

/** Topic chips with an input for adding new ones. */
export function TopicInput({ id, value, onChange, suggestions = [], placeholder = 'Type a topic and press Enter' }: { id: string; value: string[]; onChange: (v: string[]) => void; suggestions?: string[]; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = (t: string) => {
    const clean = t.trim().slice(0, 80);
    if (!clean || value.some((v) => v.toLowerCase() === clean.toLowerCase())) return;
    onChange([...value, clean]);
  };
  const remaining = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));
  return (
    <div className="stack" style={{ gap: 10 }}>
      {value.length > 0 && (
        <div className="chips">
          {value.map((t) => (
            <span key={t} className="chip on">
              {t}
              <button type="button" className="x" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((v) => v !== t))}>×</button>
            </span>
          ))}
        </div>
      )}
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input id={id} className="input" value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(draft); setDraft(''); } }} />
        <button type="button" className="btn" onClick={() => { add(draft); setDraft(''); }} disabled={!draft.trim()}>Add topic</button>
      </div>
      {remaining.length > 0 && (
        <div className="chips" aria-label="Suggestions">
          {remaining.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => add(s)}>+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}
