'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function TicketInner() {
  const ref = useSearchParams().get('ticket_reference');
  const [code, setCode] = useState('');
  const [qty, setQty] = useState(1);
  const [venue, setVenue] = useState<{ venue: string; address: string; city: string } | null>(null);
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    if (!ref) {
      setWaiting(false);
      return;
    }
    let tries = 0;
    let live = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/order/${encodeURIComponent(ref)}`);
        if (res.ok) {
          const o = await res.json();
          if (!live) return;
          setCode(o.ticket_code);
          setQty(o.qty || 1);
          setVenue(o.venue || null);
          setWaiting(false);
          return;
        }
      } catch {}
      if (++tries < 6 && live) setTimeout(poll, 2000);
      else if (live) setWaiting(false);
    };
    poll();
    return () => { live = false; };
  }, [ref]);

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '80px 16px', textAlign: 'center' }}>
      <div style={{ background: 'var(--fw-white)', border: '1px solid var(--fw-line)', borderRadius: 'var(--r-xl)', padding: 36, boxShadow: 'var(--shadow-2)' }}>
        {!ref ? (
          <>
            <h1 style={h1}>No ticket here</h1>
            <p className="small">This page opens after checkout. <a href="/">Back to the event →</a></p>
          </>
        ) : waiting && !code ? (
          <>
            <h1 style={h1}>Confirming payment…</h1>
            <p className="small">Your ticket appears here in a few seconds.</p>
          </>
        ) : code ? (
          <>
            <div className="eyebrow">You're in — {qty} ticket{qty > 1 ? 's' : ''}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.75rem', letterSpacing: 2, margin: '16px 0' }}>{code}</div>
            {venue && (venue.venue || venue.address) && (
              <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--fw-line)' }}>
                <div className="eyebrow">Where</div>
                <div style={{ marginTop: 4 }}>
                  {[venue.venue, venue.address, venue.city].filter(Boolean).join(' · ')}
                </div>
                <a
                  href={`https://www.google.com/maps/search/${encodeURIComponent([venue.venue, venue.address].filter(Boolean).join(' '))}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '0.875rem', fontWeight: 500 }}
                >
                  Open in Maps →
                </a>
              </div>
            )}
            <p className="small">Show this code at the door. A receipt went to your email.</p>
            <p style={{ marginTop: 16 }}><a href="/">Back to the event →</a></p>
          </>
        ) : (
          <>
            <h1 style={h1}>Still confirming</h1>
            <p className="small">The payment went through but the ticket is not ready. Check your email, or <a href="/">try the event page →</a></p>
          </>
        )}
      </div>
    </main>
  );
}

export default function TicketPage() {
  return (
    <Suspense>
      <TicketInner />
    </Suspense>
  );
}

const h1: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '2rem', margin: '0 0 8px' };
