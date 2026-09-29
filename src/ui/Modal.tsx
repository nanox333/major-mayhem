import React, { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** The dialog shell every popup shares: Escape or a click outside closes it, focus moves in and stays in, and goes back to the opener on close. */
export function Modal({ label, onClose, small, children }: { label: string; onClose: () => void; small?: boolean; children: React.ReactNode }) {
  const card = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    card.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return close.current();
      if (e.key !== 'Tab' || !card.current) return;
      const items = [...card.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return e.preventDefault();
      const first = items[0], last = items[items.length - 1], at = document.activeElement;
      // From the last control Tab wraps to the first; from the first (or the card itself) Shift+Tab wraps to the last.
      if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && (at === first || at === card.current)) { e.preventDefault(); last.focus(); }
      else if (!card.current.contains(at)) { e.preventDefault(); first.focus(); }
    };
    addEventListener('keydown', key);
    return () => { removeEventListener('keydown', key); if (opener?.isConnected) opener.focus(); };
  }, []);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={label} onClick={() => close.current()}>
      <div className={`modal__card ${small ? 'modal__card--small' : ''}`} ref={card} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={() => close.current()} aria-label="Close">×</button>
        {children}
      </div>
    </div>
  );
}
