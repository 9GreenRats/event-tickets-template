import Link from 'next/link';
import { coverUrl, supabaseService } from '@/lib/db';
import { placeholder } from '@/lib/placeholder';

export const dynamic = 'force-dynamic';

const DAY = ['SUN.', 'MON.', 'TUE.', 'WED.', 'THU.', 'FRI.', 'SAT.'];
const MONTH = ['JAN.', 'FEB.', 'MAR.', 'APR.', 'MAY', 'JUNE', 'JULY', 'AUG.', 'SEPT.', 'OCT.', 'NOV.', 'DEC.'];

/**
 * About: the organizer's story, artwork, and recap of past nights.
 * Everything on this page is editable — name/tagline/story in /admin →
 * Site, recap entries are just past events (publish, archive, or delete
 * them like any other event). Placeholder copy and artwork below are
 * clearly marked and vanish the moment real content exists.
 */
export default async function About() {
  const db = supabaseService();
  let site = { site_name: '', tagline: '', description: '' };
  let recap: { slug: string; title: string; city: string | null; starts_at: string | null; cover_path: string | null }[] = [];
  let dbLive = true;
  try {
    const { data: s } = await db.from('site_settings').select('site_name, tagline, description').eq('id', true).maybeSingle();
    if (s) site = s;
    const { data: past } = await db
      .from('events')
      .select('slug, title, city, starts_at, cover_path')
      .eq('status', 'published')
      .lt('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: false })
      .limit(6);
    recap = past || [];
  } catch {
    dbLive = false;
  }

  const name = site.site_name || 'Our nights';
  const art = placeholder('about-' + name, { initial: name });

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '20px 16px 64px' }}>
      <header style={topbar}>
        <Link href="/" style={brand}>{site.site_name || 'Tickets'}</Link>
        <nav style={{ display: 'flex', gap: 8 }}>
          <Link href="/" style={navOff}>Events</Link>
          <Link href="/about" style={navOn}>About</Link>
        </nav>
      </header>

      {!dbLive && <p style={sampleNote}>SAMPLE about page — connect the database to show the organizer's story.</p>}

      {/* ── story hero ── */}
      <section style={heroCard}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art} alt="" aria-hidden style={heroArt} />
        <div style={heroOverlay}>
          <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.75)', marginBottom: 12 }}>About</div>
          <h1 style={heroTitle}>{name}</h1>
          <p style={heroTag}>{site.tagline || 'We throw nights worth leaving home for — lineups, rooms and crowds we choose ourselves.'}</p>
        </div>
      </section>

      {/* ── story body ── */}
      <section style={storyCard}>
        <p style={storyText}>
          {site.description ||
            'Lorem ipsum dolor sit amet — this is placeholder copy. Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Tell the crowd who you are, what your nights feel like, and why they should trust you with their evening.\n\nUt enim ad minim veniam, quis nostrud exercitation ullamco laboris. Replace every word from /admin → Site. Nothing here is hardcoded.'}
        </p>
        {!site.description && <p className="micro" style={{ marginTop: 12 }}>↑ Placeholder story — the organizer replaces it in /admin → Site.</p>}
        <div style={{ marginTop: 20 }}>
          <Link href="/" style={ctaBtn}>Browse upcoming events →</Link>
        </div>
      </section>

      {/* ── recap ── */}
      <section style={{ marginTop: 32 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Recap — past nights</div>
        {recap.length === 0 ? (
          <div style={recapGrid}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={recapCard}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={placeholder(`recap-${i}`, { initial: 'R', wide: false })} alt="" aria-hidden style={recapImg} />
                <div style={{ padding: 16 }}>
                  <div style={{ fontWeight: 700 }}>Sample recap night {i + 1}</div>
                  <p className="small" style={{ margin: '4px 0 0' }}>Past events appear here automatically once their date passes.</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={recapGrid}>
            {recap.map((e) => {
              const d = e.starts_at ? new Date(e.starts_at) : null;
              return (
                <Link key={e.slug} href={`/e/${e.slug}`} style={recapCardLink}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverUrl(e.cover_path) || placeholder(e.slug, { initial: e.title, wide: false })} alt="" style={recapImg} />
                  <div style={{ padding: 16 }}>
                    <div style={{ fontWeight: 700 }}>{e.title}</div>
                    <div className="micro" style={{ marginTop: 4 }}>
                      {d ? `${DAY[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MONTH[d.getMonth()]}` : ''}{e.city ? ` · ${e.city}` : ''}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <footer style={{ marginTop: 40, fontSize: '0.75rem', color: 'var(--fw-ink-4)' }}>
        <span>{site.site_name || 'Tickets'}</span>
      </footer>
    </main>
  );
}

const topbar: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 };
const brand: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, textDecoration: 'none', color: 'inherit' };
const navOn: React.CSSProperties = { fontSize: '0.8125rem', fontWeight: 600, padding: '8px 14px', borderRadius: 999, background: 'var(--fw-ink)', color: 'var(--fw-paper)', textDecoration: 'none' };
const navOff: React.CSSProperties = { fontSize: '0.8125rem', fontWeight: 500, padding: '8px 14px', borderRadius: 999, border: '1px solid var(--fw-line)', textDecoration: 'none', color: 'inherit', background: 'var(--fw-white)' };
const sampleNote: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--fw-warn)', background: 'var(--fw-warn-bg)', border: '1px solid currentColor', borderRadius: 8, padding: '8px 12px', margin: '0 0 16px' };
const heroCard: React.CSSProperties = { position: 'relative', borderRadius: 'var(--r-xl)', overflow: 'hidden', background: 'var(--fw-ink)', color: '#FFF', minHeight: 'min(62svh, 520px)', display: 'flex', border: '1px solid var(--fw-ink)' };
const heroArt: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 };
const heroOverlay: React.CSSProperties = { position: 'relative', marginTop: 'auto', padding: 'clamp(24px, 5vw, 44px)', background: 'linear-gradient(180deg, transparent, rgba(26,26,26,0.72))', width: '100%' };
const heroTitle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 6vw, 3.5rem)', margin: '0 0 10px', letterSpacing: '-0.02em', lineHeight: 1 };
const heroTag: React.CSSProperties = { fontSize: 'clamp(1rem, 2.4vw, 1.2rem)', color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.5, maxWidth: '32em' };
const storyCard: React.CSSProperties = { background: 'var(--fw-white)', border: '1px solid var(--fw-line)', borderRadius: 'var(--r-xl)', padding: 'clamp(20px, 4vw, 36px)', boxShadow: 'var(--shadow-2)', marginTop: 20 };
const storyText: React.CSSProperties = { whiteSpace: 'pre-line', fontSize: '1rem', lineHeight: 1.7, color: 'var(--fw-ink-2)', margin: 0 };
const ctaBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 20px', borderRadius: 'var(--r-md)', background: 'var(--fw-ink)', color: 'var(--fw-paper)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' };
const recapGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 };
const recapCard: React.CSSProperties = { background: 'var(--fw-white)', border: '1px solid var(--fw-line)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-1)' };
const recapCardLink: React.CSSProperties = { ...recapCard, textDecoration: 'none', color: 'inherit', display: 'block' };
const recapImg: React.CSSProperties = { width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block', background: 'var(--fw-mist)' };
