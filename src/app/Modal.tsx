'use client';

import { useEffect } from 'react';

/** Token-styled modal. Scrim click and Esc both close. */
export default function Modal({ label, onClose, children, wide }: { label: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        background: 'rgba(26,26,26,0.44)',
        display: 'grid', placeItems: 'center',
        padding: 16, overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: wide ? 720 : 520,
          background: 'var(--fw-white)',
          border: '1px solid var(--fw-line)',
          borderRadius: 'var(--r-xl)',
          boxShadow: '0 16px 48px -12px rgba(58,58,58,0.20)',
          padding: 'clamp(20px, 4vw, 32px)',
          maxHeight: 'calc(100dvh - 64px)',
          overflowY: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
}
