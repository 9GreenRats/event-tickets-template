'use client';

import { useEffect, useMemo, useState } from 'react';
import { fmtDate, fmtTime, left, naira, sellable, type EventRow, type Tier } from '@/lib/db';
import { placeholder } from '@/lib/placeholder';
import Modal from './Modal';

type Tab = 'details' | 'when' | 'tickets';

/** Split a description into a lead paragraph + • highlight cards. */
function splitDescription(raw: string): { lead: string; points: string[]; rest: string } {
  const lines = raw.split('\n');
  const points: string[] = [];
  const rest: string[] = [];
  let lead = '';
  for (const line of lines) {
    const t = line.trim();
    const m = t.match(/^[•\-\*]\s+(.+)$/);
    if (m) points.push(m[1]);
    else if (!lead && t) lead = t;
    else if (t) rest.push(t);
  }
  return { lead, points, rest: rest.join('\n\n') };
}

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
  const gated = event?.venue_reveal === 'after_purchase';
  const art = useMemo(
    () => (event ? event.cover_url || placeholder(event.slug, { initial: event.title }) : null),
    [event],
  );
  const copy = useMemo(() => splitDescription(event?.description || ''), [event]);

  // Returning from Paystack (?ticket_reference) or the front-page
  // Réserver button (?buy=1): both open the ticket flow as a modal.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ticket_reference');
    if (params.get('buy') === '1') {
      setTab('tickets');
      if (tierId) setCheckoutOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
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
    <main>
      {/* ── Hero: artwork-bleed, oversized type, chip meta ── */}
      <header style={hero}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art || ''} alt="" aria-hidden style={heroImg} />
        <div style={heroScrim} aria-hidden />
        <div style={heroInner}>
          <a href="/" style={backLight}>← All events</a>
          <h1 style={heroTitle}>{event.title}</h1>
          {event.tagline && <p style={heroTag}>{event.tagline}</p>}
          <div style={chips}>
            <span style={chip}>📅 {fmtDate(event.starts_at)}{fmtTime(event.starts_at) && ` · ${fmtTime(event.starts_at)}`}</span>
            <span style={chip}>📍 {gated ? 'Secret venue — revealed with ticket' : event.venue || event.city || 'TBA'}</span>
            <span style={{ ...chip, background: 'var(--fw-spark)', borderColor: 'transparent', color: 'var(--fw-ink)', fontWeight: 600 }}>
              {tiers.some(sellable) ? 'Tickets live' : 'Sold out'}
            </span>
          </div>
        </div>
      </header>

      <div style={body}>
        <div role="tablist" aria-label="Event sections" style={tabs}>
          {([['details', 'Details'], ['when', 'When & Where'], ['tickets', 'Tickets']] as [Tab, string][]).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={tab === id ? activeTab : inTab}>
              {label}
              {id === 'tickets' && tiers.some(sellable) && <span aria-hidden style={dot} />}
            </button>
          ))}
        </div>

        {tab === 'details' && (
          <section>
            {copy.lead && <p style={lead}>{copy.lead}</p>}
            {copy.points.length > 0 && (
              <div style={pointGrid}>
                {copy.points.map((p, i) => (
                  <div key={i} style={pointCard}>
                    <span aria-hidden style={pointNum}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{ fontSize: '0.9375rem', lineHeight: 1.55 }}>{p}</span>
                  </div>
                ))}
              </div>
            )}
            {copy.rest && <p style={bodyText}>{copy.rest}</p>}
            {!copy.lead && copy.points.length === 0 && <p style={bodyText}>Details coming soon.</p>}
            <div style={infoGrid}>
              {[
                ['Date', fmtDate(event.starts_at)],
                ['City', event.city || 'TBA'],
                ['Doors', event.doors_at ? `${fmtTime(event.doors_at)}` : 'TBA'],
              ].map(([label, value]) => (
                <div key={label} style={infoCell}>
                  <div className="eyebrow">{label}</div>
                  <div style={{ marginTop: 4, fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'when' && (
          <section style={{ display: 'grid', gap: 12 }}>
            {[
              ['Date', fmtDate(event.starts_at)],
              ['Doors', event.doors_at ? `${fmtDate(event.doors_at)} · ${fmtTime(event.doors_at)}` : 'Announced soon'],
              ['Venue', gated ? 'Revealed after you get a ticket — it arrives with your ticket code.' : ([event.venue, event.address, event.city].filter(Boolean).join(' · ') || 'Announced soon')],
            ].map(([label, value]) => (
              <div key={label} style={whenCard}>
                <div className="eyebrow">{label}</div>
                <div style={{ marginTop: 4, fontSize: '1.0625rem' }}>{value}</div>
              </div>
            ))}
            {!gated && event.address && (
              <a
                href={`https://www.google.com/maps/search/${encodeURIComponent(`${event.venue} ${event.address}`)}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '0.875rem', fontWeight: 600 }}
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
              const pct = t.capacity > 0 ? Math.min(100, Math.round((t.sold / t.capacity) * 100)) : 0;
              return (
                <button key={t.id} disabled={!ok} onClick={() => { setTierId(t.id); setQty(1); }} aria-pressed={on} style={tierCard(on, ok)}>
                  <span style={{ textAlign: 'left', flex: 1 }}>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.0625rem' }}>{t.name}</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600 }}>
                        {t.price_kobo === 0 ? 'Free' : `₦${naira(t.price_kobo)}`}
                      </span>
                    </span>
                    {t.description && <span className="small" style={{ display: 'block', marginTop: 4 }}>{t.description}</span>}
                    <span style={barTrack} aria-hidden>
                      <span style={{ ...barFill, width: `${ok ? pct : 100}%`, background: ok ? 'var(--fw-spark-700)' : 'var(--fw-line)' }} />
                    </span>
                    <span className="micro" style={{ display: 'block', marginTop: 6, color: ok ? 'var(--fw-success)' : 'var(--fw-warn)', fontWeight: 600 }}>
                      {ok ? `${left(t)} of ${t.capacity} left` : 'Sold out'}
                    </span>
                  </span>
                </button>
              );
            })}
            {tier && sellable(tier) && (
              <div style={ctaBar}>
                <div>
                  <div style={{ fontWeight: 700 }}>{tier.name} × {qty}</div>
                  <div className="small">Total ₦{naira(total)}</div>
                </div>
                <button className="btn" onClick={() => { setError(''); setCheckoutOpen(true); }} style={{ minWidth: 180 }}>
                  Get tickets
                </button>
              </div>
            )}
          </section>
        )}

        <footer style={foot}>
          <span>{siteName}</span>
          <span>{fmtDate(event.starts_at)}</span>
        </footer>
      </div>

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
            <input id="email" className="input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
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
                  style={{ fontSize: '0.875rem', fontWeight: 600 }}
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
    </main>
  );
}

/* ── layout ── */
const wrap: React.CSSProperties = { maxWidth: 880, margin: '0 auto', padding: '24px 16px 64px' };
const card: React.CSSProperties = { background: 'var(--fw-white)', border: '1px solid var(--fw-line)', borderRadius: 'var(--r-xl)', padding: 'clamp(20px, 4vw, 36px)', boxShadow: 'var(--shadow-2)' };
const h1: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 'clamp(1.9rem, 5vw, 2.75rem)', lineHeight: 1.2, letterSpacing: '-0.02em', margin: '0 0 8px' };

/* ── hero ── */
const hero: React.CSSProperties = { position: 'relative', overflow: 'hidden', background: 'var(--fw-ink)', color: '#FFF', minHeight: '92svh', display: 'flex' };
const heroImg: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 };
const heroScrim: React.CSSProperties = { position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(26,26,26,0.15) 0%, rgba(26,26,26,0.55) 60%, rgba(26,26,26,0.82) 100%)' };
const heroInner: React.CSSProperties = { position: 'relative', width: '100%', maxWidth: 880, margin: 'auto auto 0', padding: 'clamp(64px, 10vw, 120px) 16px clamp(28px, 5vw, 48px)' };
const backLight: React.CSSProperties = { display: 'inline-block', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.75)', marginBottom: 20, textDecoration: 'none' };
const heroTitle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 'clamp(2.4rem, 7vw, 4.5rem)', lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 700, margin: '0 0 12px', textWrap: 'balance' };
const heroTag: React.CSSProperties = { fontSize: 'clamp(1rem, 2.4vw, 1.25rem)', color: 'rgba(255,255,255,0.85)', margin: '0 0 20px', lineHeight: 1.45, maxWidth: '34em' };
const chips: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 };
const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', fontWeight: 500, color: '#FFF', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 999, padding: '7px 14px', background: 'rgba(26,26,26,0.35)', backdropFilter: 'blur(6px)' };

/* ── body ── */
const body: React.CSSProperties = { maxWidth: 880, margin: '0 auto', padding: '0 16px 64px', marginTop: -0 };
const tabs: React.CSSProperties = { display: 'flex', gap: 4, margin: '20px 0 24px', background: 'var(--fw-mist)', border: '1px solid var(--fw-line)', borderRadius: 999, padding: 4, width: 'fit-content', maxWidth: '100%', overflowX: 'auto' };
const inTab: React.CSSProperties = { border: 'none', background: 'transparent', cursor: 'pointer', padding: '10px 18px', minHeight: 40, fontSize: '0.875rem', fontWeight: 500, color: 'var(--fw-ink-3)', borderRadius: 999, whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)', display: 'inline-flex', alignItems: 'center', gap: 8 };
const activeTab: React.CSSProperties = { ...inTab, background: 'var(--fw-ink)', color: 'var(--fw-paper)' };
const dot: React.CSSProperties = { width: 7, height: 7, borderRadius: '50%', background: 'var(--fw-spark)', display: 'inline-block' };

const lead: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 'clamp(1.25rem, 3vw, 1.6rem)', lineHeight: 1.4, fontWeight: 500, margin: '0 0 20px' };
const bodyText: React.CSSProperties = { whiteSpace: 'pre-line', fontSize: '1rem', lineHeight: 1.65, color: 'var(--fw-ink-2)', margin: '0 0 20px' };
const pointGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, margin: '0 0 20px' };
const pointCard: React.CSSProperties = { background: 'var(--fw-white)', border: '1px solid var(--fw-line)', borderRadius: 'var(--r-lg)', padding: 18, display: 'grid', gap: 8, alignContent: 'start', boxShadow: 'var(--shadow-1)' };
const pointNum: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.08em', color: 'var(--fw-spark-700)', fontWeight: 500 };
const infoGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 };
const infoCell: React.CSSProperties = { background: 'var(--fw-sand)', border: '1px solid var(--fw-line)', borderRadius: 'var(--r-lg)', padding: 18 };
const whenCard: React.CSSProperties = { background: 'var(--fw-white)', border: '1px solid var(--fw-line)', borderRadius: 'var(--r-lg)', padding: 22, boxShadow: 'var(--shadow-1)' };

const tierCard = (on: boolean, ok: boolean): React.CSSProperties => ({
  textAlign: 'left', cursor: ok ? 'pointer' : 'not-allowed', opacity: ok ? 1 : 0.55,
  background: on ? 'var(--fw-white)' : 'var(--fw-mist)',
  border: `2px solid ${on ? 'var(--fw-ink)' : 'var(--fw-line)'}`,
  borderRadius: 'var(--r-lg)', padding: 20, width: '100%', fontFamily: 'var(--font-sans)',
  boxShadow: on ? 'var(--shadow-2)' : 'none',
});
const barTrack: React.CSSProperties = { display: 'block', height: 6, borderRadius: 999, background: 'var(--fw-line)', marginTop: 12, overflow: 'hidden' };
const barFill: React.CSSProperties = { display: 'block', height: '100%', borderRadius: 999, transition: 'width 400ms var(--ease-out)' };
const ctaBar: React.CSSProperties = {
  position: 'sticky', bottom: 16,
  display: 'flex', alignItems: 'center', gap: 16,
  background: 'var(--fw-ink)', color: 'var(--fw-paper)',
  borderRadius: 'var(--r-lg)', padding: '14px 14px 14px 20px',
  boxShadow: 'var(--shadow-pop)',
};
const step: React.CSSProperties = { width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 8, border: '1px solid var(--fw-line)', background: 'var(--fw-white)', cursor: 'pointer', fontSize: '1rem' };
const modalH: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.5rem', margin: '0 0 16px' };
const foot: React.CSSProperties = { marginTop: 40, display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--fw-ink-4)' };
