'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { coverUrl, naira, type Tier } from '@/lib/db';
import { placeholder } from '@/lib/placeholder';
import Modal from '../Modal';

interface EventFull {
  id: string;
  slug: string;
  title: string; tagline: string; description: string; venue: string;
  address: string; city: string; starts_at: string | null; doors_at: string | null;
  status: string; venue_reveal: string; cover_path?: string | null;
  tiers: Tier[];
}

const toLocal = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<EventFull[]>([]);
  const [activeId, setActiveId] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<EventFull | null>(null);

  const active = events.find((e) => e.id === activeId) || null;

  useEffect(() => {
    supabase().auth.getSession().then(({ data }) => setToken(data.session?.access_token || null));
  }, []);

  const auth = useCallback(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    [token],
  );

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/events', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const d = await res.json();
    const list: EventFull[] = (d.events || []).map((e: EventFull) => ({
      ...e,
      starts_at: toLocal(e.starts_at),
      doors_at: toLocal(e.doors_at),
    }));
    setEvents(list);
    setActiveId((id) => (list.some((e) => e.id === id) ? id : list[0]?.id || ''));
  }, [token]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  const login = async () => {
    setBusy(true);
    setLoginError('');
    try {
      const { data, error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      setToken(data.session?.access_token || null);
      setPassword('');
    } catch {
      setLoginError('Wrong email or password.');
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <main style={wrap}>
        <div style={card}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Organizer sign in</div>
          <h1 style={h1}>Your event admin</h1>
          <p className="small" style={{ marginBottom: 16 }}>The organizer email and password from your launch.</p>
          <label className="field-label" htmlFor="a-email">Email</label>
          <input id="a-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <div style={{ marginTop: 12 }}>
            <label className="field-label" htmlFor="a-pass">Password</label>
            <input id="a-pass" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" onKeyDown={(e) => e.key === 'Enter' && login()} />
          </div>
          {loginError && <p role="alert" style={{ color: '#B32D25', fontSize: '0.875rem' }}>{loginError}</p>}
          <button className="btn" onClick={login} disabled={busy} style={{ width: '100%', marginTop: 16 }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p style={{ marginTop: 16 }}><a href="/" className="small">← Back to events</a></p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ ...wrap, maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div className="eyebrow">Event admin</div>
        <button className="btn-secondary btn" style={{ marginLeft: 'auto', minHeight: 36, padding: '6px 14px' }} onClick={() => { supabase().auth.signOut(); setToken(null); }}>
          Sign out
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {events.map((e) => (
          <button
            key={e.id}
            onClick={() => setActiveId(e.id)}
            aria-pressed={e.id === activeId}
            style={pill(e.id === activeId)}
          >
            {e.title} · {e.status}
          </button>
        ))}
        <button onClick={() => setCreating(true)} style={pill(false, true)}>+ New event</button>
      </div>

      {!active ? (
        <div style={card}>
          <h1 style={h1}>No events yet</h1>
          <p className="small">Create your first with “New event”.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <SiteEditor auth={auth} />
          <PaymentsCard auth={auth} />
          <EventEditor
            key={active.id}
            event={active}
            auth={auth}
            reload={load}
            onDelete={() => setDeleting(active)}
          />
          <div style={card}>
            <h2 style={h2}>Tiers & prices</h2>
            {active.tiers.map((t) => (
              <TierRow key={t.id} tier={t} auth={auth} reload={load} />
            ))}
            <NewTier eventId={active.id} auth={auth} reload={load} />
          </div>
        </div>
      )}

      {creating && (
        <NewEventModal
          auth={auth}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            load().then(() => setActiveId(id));
          }}
        />
      )}

      {deleting && (
        <Modal label={`Delete ${deleting.title}`} onClose={() => setDeleting(null)}>
          <h2 style={modalH}>Delete “{deleting.title}”?</h2>
          <p className="small">Its tiers and orders go with it. This cannot be undone.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              className="btn"
              style={{ background: '#B32D25', borderColor: '#B32D25' }}
              onClick={async () => {
                await fetch(`/api/admin/events/${deleting.id}`, { method: 'DELETE', headers: auth() });
                setDeleting(null);
                load();
              }}
            >
              Delete event
            </button>
            <button className="btn-secondary btn" onClick={() => setDeleting(null)}>Keep it</button>
          </div>
        </Modal>
      )}

      <p style={{ marginTop: 16 }}><a href="/" className="small">← View events</a></p>
    </main>
  );
}

function supabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

function PaymentsCard({ auth }: { auth: () => Record<string, string> }) {
  const [info, setInfo] = useState<{ paystack_set: boolean; webhook_url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    fetch('/api/admin/payments', { headers: auth() })
      .then((r) => (r.ok ? r.json() : null))
      .then(setInfo)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div style={card}>
      <h2 style={h2}>Payments — your Paystack</h2>
      <p className="small" style={{ margin: '0 0 12px' }}>
        Buyer money goes to your bank. Your secret key lives in hosting env — set once at launch.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span className="micro">Status</span>
        <span className="micro" style={statusPill}>{info ? (info.paystack_set ? 'Connected' : 'Missing — paid tiers wait') : '…'}</span>
      </div>
      <label className="field-label">Webhook URL — paste in Paystack → Settings → Webhooks</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', background: 'var(--fw-mist)', border: '1px solid var(--fw-line)', borderRadius: 6, padding: '8px 12px', wordBreak: 'break-all' }}>
          {info?.webhook_url || '…'}
        </code>
        <button
          className="btn-secondary btn"
          style={{ minHeight: 36, padding: '6px 14px' }}
          onClick={() => {
            if (!info?.webhook_url) return;
            navigator.clipboard.writeText(info.webhook_url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="micro" style={{ marginTop: 8 }}>Without it a buyer can pay and the ticket will not be marked as paid.</p>
    </div>
  );
}

function SiteEditor({ auth }: { auth: () => Record<string, string> }) {
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/site', { headers: auth() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.site) return;
        setName(d.site.site_name || '');
        setTagline(d.site.tagline || '');
        setDescription(d.site.description || '');
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setBusy(true);
    setNotice('');
    try {
      const res = await fetch('/api/admin/site', {
        method: 'PATCH', headers: auth(),
        body: JSON.stringify({ site_name: name, tagline, description }),
      });
      if (!res.ok) throw new Error();
      setNotice('Saved — shows on the About page.');
    } catch {
      setNotice('Save failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={card}>
      <h2 style={h2}>Site & About page</h2>
      <div style={{ marginBottom: 12 }}>
        <label className="field-label">Site name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lagos Nights" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label className="field-label">Tagline</label>
        <input className="input" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="One line under the name" />
      </div>
      <div>
        <label className="field-label">About text</label>
        <textarea className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who runs these nights, and why come." />
      </div>
      {notice && <p role="status" className="small" style={{ marginTop: 8 }}>{notice}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save site'}</button>
        <a href="/about" target="_blank" rel="noreferrer" className="small">View About page →</a>
      </div>
    </div>
  );
}

function NewEventModal({ auth, onClose, onCreated }: { auth: () => Record<string, string>; onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const create = async () => {
    if (!title.trim()) {
      setError('Give the event a title.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/events', { method: 'POST', headers: auth(), body: JSON.stringify({ title: title.trim() }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Create failed');
      onCreated(d.event.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal label="New event" onClose={onClose}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>New event</div>
      <h2 style={modalH}>Name it to begin</h2>
      <label className="field-label" htmlFor="ne-title">Event title</label>
      <input id="ne-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lagos Founders Mixer" autoFocus onKeyDown={(e) => e.key === 'Enter' && create()} />
      {error && <p role="alert" style={{ color: '#B32D25', fontSize: '0.875rem' }}>{error}</p>}
      <p className="micro" style={{ marginTop: 8 }}>Starts as a draft. Dates, venue, tiers and publish come next.</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn" onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create event'}</button>
        <button className="btn-secondary btn" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

function EventEditor({ event, auth, reload, onDelete }: { event: EventFull; auth: () => Record<string, string>; reload: () => void; onDelete: () => void }) {
  const [f, setF] = useState({ ...event });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const set = (k: 'title' | 'tagline' | 'description' | 'venue' | 'address' | 'city', v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true);
    setNotice('');
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: 'PATCH',
        headers: auth(),
        body: JSON.stringify({ ...f, starts_at: fromLocal(f.starts_at || ''), doors_at: fromLocal(f.doors_at || '') }),
      });
      if (!res.ok) throw new Error();
      setNotice('Saved.');
      reload();
    } catch {
      setNotice('Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const onCover = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setNotice('Image must be under 2MB.');
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const res = await fetch(`/api/admin/events/${event.id}/cover`, {
        method: 'POST',
        headers: auth(),
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      if (!res.ok) throw new Error();
      setNotice('Cover uploaded.');
      reload();
    } catch {
      setNotice('Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <h2 style={{ ...h2, margin: 0 }}>Event page</h2>
        <span className="micro" style={statusPill}>{event.status}</span>
        <span className="micro" style={{ fontFamily: 'var(--font-mono)' }}>/e/{event.slug}</span>
      </div>
      {event.cover_path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl(event.cover_path) || ''} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 'var(--r-md)', marginBottom: 12 }} />
      ) : (
        <div style={{ marginBottom: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={placeholder(event.slug, { initial: event.title, wide: false })} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 'var(--r-md)', opacity: 0.9 }} />
          <p className="micro" style={{ marginTop: 6 }}>Auto artwork — replaced the moment you upload a cover.</p>
        </div>
      )}
      <label className="field-label" htmlFor={`cover-${event.id}`}>Cover image (PNG/JPEG/WebP, under 2MB)</label>
      <input id={`cover-${event.id}`} type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(e) => onCover(e.target.files?.[0])} />
      <div style={{ ...grid, marginTop: 12 }}>
        <div>
          <label className="field-label">Title</label>
          <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} />
        </div>
        <div>
          <label className="field-label">Status</label>
          <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="draft">Draft — hidden</option>
            <option value="published">Published — on sale</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label className="field-label">Tagline</label>
        <input className="input" value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} />
      </div>
      <div style={{ marginTop: 12 }}>
        <label className="field-label">Description</label>
        <textarea className="input" rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </div>
      <div style={{ ...grid, marginTop: 12 }}>
        <div>
          <label className="field-label">Venue</label>
          <input className="input" value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} />
        </div>
        <div>
          <label className="field-label">City</label>
          <input className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label className="field-label">Address (for the map link)</label>
        <input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
      </div>
      <div style={{ ...grid, marginTop: 12 }}>
        <div>
          <label className="field-label">Starts</label>
          <input className="input" type="datetime-local" value={f.starts_at || ''} onChange={(e) => setF({ ...f, starts_at: e.target.value })} />
        </div>
        <div>
          <label className="field-label">Doors</label>
          <input className="input" type="datetime-local" value={f.doors_at || ''} onChange={(e) => setF({ ...f, doors_at: e.target.value })} />
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label className="field-label">Venue reveal</label>
        <select className="input" value={f.venue_reveal} onChange={(e) => setF({ ...f, venue_reveal: e.target.value })}>
          <option value="public">Show venue publicly</option>
          <option value="after_purchase">Reveal after ticket purchase</option>
        </select>
      </div>
      {notice && <p role="status" className="small" style={{ marginTop: 8 }}>{notice}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save event'}</button>
        <a className="btn-secondary btn" href={`/e/${event.slug}`} target="_blank" rel="noreferrer">View page →</a>
        <button className="btn-secondary btn" style={{ marginLeft: 'auto' }} onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

function TierRow({ tier, auth, reload }: { tier: Tier; auth: () => Record<string, string>; reload: () => void }) {
  const [price, setPrice] = useState(String(Math.round(tier.price_kobo / 100)));
  const [cap, setCap] = useState(String(tier.capacity));
  const [status, setStatus] = useState<string>(tier.status);
  const [confirming, setConfirming] = useState(false);
  const save = async () => {
    await fetch(`/api/admin/tiers/${tier.id}`, {
      method: 'PATCH', headers: auth(),
      body: JSON.stringify({ price_naira: parseInt(price, 10) || 0, capacity: parseInt(cap, 10) || 0, status }),
    });
    reload();
  };
  return (
    <>
      <div style={tierRow}>
        <strong style={{ minWidth: 110 }}>{tier.name}</strong>
        <span className="micro">{tier.sold}/{tier.capacity} sold · ₦{naira(tier.price_kobo)}</span>
        <label className="micro">₦ <input aria-label={`${tier.name} price`} className="input" style={mini} type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} /></label>
        <label className="micro">Cap <input aria-label={`${tier.name} capacity`} className="input" style={mini} type="number" min={0} value={cap} onChange={(e) => setCap(e.target.value)} /></label>
        <select aria-label={`${tier.name} status`} className="input" style={{ ...mini, width: 110 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Active</option>
          <option value="hidden">Hidden</option>
          <option value="soldout">Sold out</option>
        </select>
        <button className="btn-secondary btn" style={{ minHeight: 32, padding: '4px 12px' }} onClick={save}>Save</button>
        <button className="btn-secondary btn" style={{ minHeight: 32, padding: '4px 12px' }} onClick={() => setConfirming(true)} aria-label={`Delete ${tier.name}`}>✕</button>
      </div>
      {confirming && (
        <Modal label={`Delete ${tier.name}`} onClose={() => setConfirming(false)}>
          <h2 style={modalH}>Delete “{tier.name}”?</h2>
          <p className="small">Its orders stay, but no new tickets sell on it.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              className="btn"
              style={{ background: '#B32D25', borderColor: '#B32D25' }}
              onClick={async () => {
                await fetch(`/api/admin/tiers/${tier.id}`, { method: 'DELETE', headers: auth() });
                setConfirming(false);
                reload();
              }}
            >
              Delete tier
            </button>
            <button className="btn-secondary btn" onClick={() => setConfirming(false)}>Keep it</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function NewTier({ eventId, auth, reload }: { eventId: string; auth: () => Record<string, string>; reload: () => void }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cap, setCap] = useState('');
  const add = async () => {
    if (!name.trim()) return;
    await fetch('/api/admin/tiers', {
      method: 'POST', headers: auth(),
      body: JSON.stringify({ event_id: eventId, name: name.trim(), price_naira: parseInt(price, 10) || 0, capacity: parseInt(cap, 10) || 0 }),
    });
    setName('');
    setPrice('');
    setCap('');
    reload();
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginTop: 12, alignItems: 'end' }}>
      <div><label className="field-label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. General" /></div>
      <div><label className="field-label">Price ₦</label><input className="input" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="10000" /></div>
      <div><label className="field-label">Capacity</label><input className="input" type="number" value={cap} onChange={(e) => setCap(e.target.value)} placeholder="150" /></div>
      <button className="btn" style={{ minHeight: 44 }} onClick={add}>+ Add tier</button>
    </div>
  );
}

const pill = (on: boolean, dashed?: boolean): React.CSSProperties => ({
  border: `1px ${dashed ? 'dashed var(--fw-line)' : `solid ${on ? 'var(--fw-ink)' : 'var(--fw-line)'}`}`,
  background: on ? 'var(--fw-ink)' : 'transparent',
  color: on ? 'var(--fw-paper)' : 'var(--fw-ink)',
  borderRadius: 999, padding: '8px 16px', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', minHeight: 40,
});

const wrap: React.CSSProperties = { maxWidth: 560, margin: '0 auto', padding: '40px 16px 64px' };
const card: React.CSSProperties = { background: 'var(--fw-white)', border: '1px solid var(--fw-line)', borderRadius: 'var(--r-xl)', padding: 24, boxShadow: 'var(--shadow-2)' };
const h1: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '2rem', margin: '0 0 8px' };
const h2: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', fontWeight: 600, margin: '0 0 16px' };
const modalH: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.5rem', margin: '0 0 16px' };
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 };
const tierRow: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', border: '1px solid var(--fw-line)', borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: 8 };
const mini: React.CSSProperties = { width: 90, padding: '6px 8px' };
const statusPill: React.CSSProperties = { border: '1px solid var(--fw-line)', borderRadius: 999, padding: '2px 10px', background: 'var(--fw-mist)' };
