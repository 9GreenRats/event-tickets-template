'use client';

import { useEffect, useState } from 'react';
import { fmtDate, fmtTime, left, naira, sellable, type EventRow, type Tier } from '@/lib/db';
import Modal from './Modal';

type Tab = 'details' | 'when' | 'tickets';

export default function EventPage({ event, tiers, siteName }: { event: EventRow | null; tiers: Tier[]; siteName: string }) {
  const [tab, setTab] = useState<Tab>('details');
  const [tierId, setTierId] = useState(() => tiers.find(sellable)?.id || '');
  const [qty, setQty] = useState(1);
  const [email, setEmail] = useState('');
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticket, setTicket] = useState<{ ticket_code: string; qty: number; venue: { venue: string; address: string; city: string } | null } | null>(null);

  const tier = tiers.find((t) => t.id === tierId);
  const total = tier ? tier.price_kobo * qty : 0;
  // Private venue: the public page keeps city + date only. The address is
  // revealed in the ticket modal, which only a paid reference can open.
  const gated = event?.venue_reveal === 'after_purchase';

  // Returning from Paystack: ?ticket_reference=… opens the ticket modal.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ticket_reference');
    if (!ref) return;
    setTab('tickets');
    let tries = 0;
    let live = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/order/${encodeURIComponent(ref)}`);
        if (res.ok) {
          const o = await res.json();
          if (!live) return;
          setTicket(o);
          setTicketOpen(true);
          setCheckoutOpen(false);
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
      } catch {}
      if (++tries < 6 && live) setTimeout(poll, 2000);
    };
    poll();
    return () => { live = false; };
  }, []);

  if (!event) {
    return (
      <main style={wrap}>
        <div style={card}>
          <div className="eyebrow">{siteName}</div>
          <h1 style={h1}>No event on sale yet</h1>
          <p className="small">The organizer has not published an event. Check back soon.</p>
        </div>
      </main>
    );
  }

  const buy = async () => {
    if (!tier || buying) return;
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email — your ticket goes there.');
      return;
    }
    setBuying(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId: tier.id, qty, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      if (data.free) {
        // Free ticket — fetch the order and show it in place.
        const oRes = await fetch(`/api/order/${encodeURIComponent(data.reference)}`);
        if (!oRes.ok) throw new Error('Ticket not ready yet');
        setTicket(await oRes.json());
        setTicketOpen(true);
        setCheckoutOpen(false);
      } else if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setBuying(false);
    }
  };

  return (
    <main style={wrap}>
      <a href="/" style={{ ...back, textDecoration: 'none' }}>← All events</a>

      <header style={card}>
        {event.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.cover_url} alt="" style={{ width: 'calc(100% + 72px)', margin: '-36px -36px 24px', maxHeight: 320, objectFit: 'cover', display: 'block', borderRadius: 'var(--r-xl) var(--r-xl) 0 0' }} />
        )}
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          {siteName} · {event.city || 'Nigeria'}
        </div>
        <h1 style={h1}>{event.title}</h1>
        {event.tagline && <p style={tagline}>{event.tagline}</p>}
        <div style={meta}>
          <span>📅 {fmtDate(event.starts_at)}{fmtTime(event.starts_at) && ` · ${fmtTime(event.starts_at)}`}</span>
          {!gated && event.venue && <span>📍 {event.venue}</span>}
          {gated && <span>📍 Venue announced after you get a ticket</span>}
        </div>
      </header>

      <div role="tablist" aria-label="Event sections" style={tabs}>
        {([['details', 'Details'], ['when', 'When & Where'], ['tickets', 'Tickets']] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            style={tab === id ? activeTab : inTab}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <section style={card}>
          <p style={body}>{event.description || 'Details coming soon.'}</p>
        </section>
      )}

      {tab === 'when' && (
        <section style={{ display: 'grid', gap: 12 }}>
          {[
            ['Date', fmtDate(event.starts_at)],
            ['Doors', event.doors_at ? `${fmtDate(event.doors_at)} · ${fmtTime(event.doors_at)}` : 'Announced soon'],
            ['Venue', gated ? 'Revealed after you get a ticket.' : ([event.venue, event.address, event.city].filter(Boolean).join(' · ') || 'Announced soon')],
          ].map(([label, value]) => (
            <div key={label} style={card}>
              <div className="eyebrow">{label}</div>
              <div style={{ marginTop: 4 }}>{value}</div>
            </div>
          ))}
          {!gated && event.address && (
            <a
              href={`https://www.google.com/maps/search/${encodeURIComponent(`${event.venue} ${event.address}`)}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '0.875rem', fontWeight: 500 }}
            >
              Open in Maps →
            </a>
          )}
        </section>
      )}

      {tab === 'tickets' && (
        <section style={{ display: 'grid', gap: 12 }}>
          {tiers.map((t) => {
            const ok = sellable(t);
            const on = t.id === tierId;
            return (
              <button
                key={t.id}
                disabled={!ok}
                onClick={() => { setTierId(t.id); setQty(1); }}
                aria-pressed={on}
                style={tierCard(on, ok)}
              >
                <span style={{ textAlign: 'left' }}>
                  <span style={{ display: 'block', fontWeight: 600 }}>{t.name}</span>
                  {t.description && <span className="small" style={{ display: 'block', marginTop: 4 }}>{t.description}</span>}
                  <span className="micro" style={{ display: 'block', marginTop: 8, color: ok ? 'var(--fw-success)' : 'var(--fw-warn)' }}>
                    {ok ? `${left(t)} left` : 'Sold out'}
                  </span>
                </span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {t.price_kobo === 0 ? 'Free' : `₦${naira(t.price_kobo)}`}
                </span>
              </button>
            );
          })}
          {tier && sellable(tier) && (
            <button className="btn" onClick={() => { setError(''); setCheckoutOpen(true); }} style={{ width: '100%' }}>
              Get tickets{tier.price_kobo === 0 ? ' — free' : ` — ₦${naira(tier.price_kobo)} each`}
            </button>
          )}
        </section>
      )}

      {checkoutOpen && tier && (
        <Modal label={`Get tickets — ${tier.name}`} onClose={() => setCheckoutOpen(false)}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{tier.name} · {event.title}</div>
          <h2 style={modalH}>Get tickets</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="small">Qty</span>
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={step} aria-label="Decrease quantity">−</button>
            <span aria-live="polite" style={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>{qty}</span>
            <button onClick={() => setQty((q) => Math.min(10, Math.min(left(tier), q + 1)))} style={step} aria-label="Increase quantity">+</button>
            <span style={{ marginLeft: 'auto', fontWeight: 600 }}>Total ₦{naira(total)}</span>
          </div>
          <div style={{ marginTop: 16 }}>
            <label className="field-label" htmlFor="email">Email for tickets</label>
            <input
              id="email"
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <p className="micro" style={{ marginTop: 6 }}>Tickets and receipt go here.</p>
          </div>
          <button className="btn" onClick={buy} disabled={buying} style={{ width: '100%', marginTop: 12 }}>
            {buying ? 'Starting checkout…' : total === 0 ? 'Claim free ticket' : `Pay ₦${naira(total)} with Paystack`}
          </button>
          {error && <p role="alert" style={{ color: '#B32D25', fontSize: '0.875rem', marginTop: 8 }}>{error}</p>}
        </Modal>
      )}

      {ticketOpen && ticket && (
        <Modal label="Your ticket" onClose={() => setTicketOpen(false)}>
          <div style={{ textAlign: 'center' }}>
            <div className="eyebrow">You're in — {ticket.qty} ticket{ticket.qty > 1 ? 's' : ''}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.75rem', letterSpacing: 2, margin: '16px 0' }}>
              {ticket.ticket_code}
            </div>
            {ticket.venue && (ticket.venue.venue || ticket.venue.address) && (
              <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--fw-line)' }}>
                <div className="eyebrow">Where</div>
                <div style={{ marginTop: 4, fontWeight: 600 }}>
                  {[ticket.venue.venue, ticket.venue.address, ticket.venue.city].filter(Boolean).join(' · ')}
                </div>
                <a
                  href={`https://www.google.com/maps/search/${encodeURIComponent([ticket.venue.venue, ticket.venue.address].filter(Boolean).join(' '))}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '0.875rem', fontWeight: 500 }}
                >
                  Open in Maps →
                </a>
              </div>
            )}
            <p className="small" style={{ marginTop: 16 }}>Show this code at the door. A receipt went to your email.</p>
            <button className="btn-secondary btn" onClick={() => setTicketOpen(false)} style={{ width: '100%', marginTop: 8 }}>Done</button>
          </div>
        </Modal>
      )}

      <footer style={foot}>
        <span>{siteName}</span>
        <a href="/admin" style={{ color: 'inherit' }}>Organizer sign in →</a>
      </footer>
    </main>
  );
}

const wrap: React.CSSProperties = { maxWidth: 880, margin: '0 auto', padding: '24px 16px 64px' };
const back: React.CSSProperties = { display: 'inline-block', fontSize: '0.8125rem', color: 'var(--fw-ink-3)', marginBottom: 20 };
const card: React.CSSProperties = { background: 'var(--fw-white)', border: '1px solid var(--fw-line)', borderRadius: 'var(--r-xl)', padding: 'clamp(20px, 4vw, 36px)', boxShadow: 'var(--shadow-2)' };
const h1: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 'clamp(1.9rem, 5vw, 2.75rem)', lineHeight: 1.2, letterSpacing: '-0.02em', margin: '0 0 8px' };
const tagline: React.CSSProperties = { fontSize: '1.125rem', color: 'var(--fw-ink-2)', margin: '0 0 16px', lineHeight: 1.45 };
const meta: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: '0.875rem', color: 'var(--fw-ink-3)' };
const body: React.CSSProperties = { whiteSpace: 'pre-line', fontSize: '1rem', lineHeight: 1.6, color: 'var(--fw-ink-2)', margin: 0 };
const tabs: React.CSSProperties = { display: 'flex', gap: 24, borderBottom: '1px solid var(--fw-line)', margin: '24px 0', overflowX: 'auto' };
const inTab: React.CSSProperties = { border: 'none', background: 'transparent', cursor: 'pointer', padding: '12px 2px', minHeight: 44, fontSize: '0.875rem', color: 'var(--fw-ink-3)', borderBottom: '2px solid transparent', marginBottom: -1, whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' };
const activeTab: React.CSSProperties = { ...inTab, color: 'var(--fw-ink)', fontWeight: 500, borderBottomColor: 'var(--fw-ink)' };
const tierCard = (on: boolean, ok: boolean): React.CSSProperties => ({
  textAlign: 'left', cursor: ok ? 'pointer' : 'not-allowed', opacity: ok ? 1 : 0.6,
  background: on ? 'var(--fw-spark-100)' : 'var(--fw-white)',
  border: `1px solid ${on ? 'var(--fw-spark-700)' : 'var(--fw-line)'}`,
  borderRadius: 'var(--r-lg)', padding: 20,
  display: 'flex', justifyContent: 'space-between', gap: 16, width: '100%', fontFamily: 'var(--font-sans)',
});
const step: React.CSSProperties = { width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 8, border: '1px solid var(--fw-line)', background: 'var(--fw-white)', cursor: 'pointer', fontSize: '1rem' };
const modalH: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.5rem', margin: '0 0 16px' };
const foot: React.CSSProperties = { marginTop: 40, display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--fw-ink-4)' };
