import Link from 'next/link';
import { coverUrl, fmtDate, supabaseService } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const db = supabaseService();
  const { data: settings } = await db.from('site_settings').select('site_name').eq('id', true).maybeSingle();
  const { data: events } = await db
    .from('events')
    .select('slug, title, tagline, venue, city, starts_at, cover_path')
    .eq('status', 'published')
    .order('starts_at', { ascending: true })
    .limit(50);

  const siteName = settings?.site_name || 'Tickets';

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '40px 16px 64px' }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>{siteName}</div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 5vw, 3.75rem)', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
        Nights worth leaving home for.
      </h1>
      <p style={{ fontSize: '1.125rem', color: 'var(--fw-ink-2)', margin: '0 0 32px' }}>
        One page per event. Details, venue, tickets — nothing else.
      </p>

      {(!events || events.length === 0) && (
        <div style={{ background: 'var(--fw-white)', border: '1px dashed var(--fw-line)', borderRadius: 'var(--r-lg)', padding: 48, textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', fontWeight: 600, margin: '0 0 8px' }}>No events yet</h2>
          <p className="small" style={{ margin: 0 }}>Published events appear here the moment the organizer hits publish.</p>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        {(events || []).map((e) => (
          <Link
            key={e.slug}
            href={`/e/${e.slug}`}
            style={{ background: 'var(--fw-white)', border: '1px solid var(--fw-line)', borderRadius: 'var(--r-xl)', padding: 24, display: 'flex', gap: 20, alignItems: 'center', boxShadow: 'var(--shadow-2)', textDecoration: 'none', color: 'inherit' }}
          >
            {e.cover_path && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl(e.cover_path) || ''} alt="" style={{ width: 96, height: 96, borderRadius: 'var(--r-lg)', objectFit: 'cover', flexShrink: 0 }} />
            )}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="micro">{fmtDate(e.starts_at)}</span>
              <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 600 }}>{e.title}</span>
              {e.tagline && <span className="small" style={{ display: 'block', marginTop: 4 }}>{e.tagline}</span>}
              {(e.venue || e.city) && (
                <span className="small" style={{ display: 'block', marginTop: 8 }}>📍 {[e.venue, e.city].filter(Boolean).join(' · ')}</span>
              )}
            </span>
            <span aria-hidden style={{ color: 'var(--fw-ink-3)', flexShrink: 0 }}>→</span>
          </Link>
        ))}
      </div>

      <footer style={{ marginTop: 40, fontSize: '0.75rem', color: 'var(--fw-ink-4)', display: 'flex', gap: 16 }}>
        <span>{siteName}</span>
        <Link href="/admin" style={{ color: 'inherit' }}>Organizer sign in →</Link>
      </footer>
    </main>
  );
}
