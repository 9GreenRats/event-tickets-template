import Link from 'next/link';
import { coverUrl, supabaseService } from '@/lib/db';
import { placeholder } from '@/lib/placeholder';

export const dynamic = 'force-dynamic';

/* Reference: poster rail (portrait cards, sticker badges, date blocks,
   price/time footer) + featured split panel (genre pills, giant date,
   dotted-leader tier rows, low centered pill CTA). */

const DAY = ['SUN.', 'MON.', 'TUE.', 'WED.', 'THU.', 'FRI.', 'SAT.'];
const MONTH = ['JAN.', 'FEB.', 'MAR.', 'APR.', 'MAY', 'JUNE', 'JULY', 'AUG.', 'SEPT.', 'OCT.', 'NOV.', 'DEC.'];

interface CardEvent {
  slug: string;
  title: string;
  tagline: string;
  venue: string | null;
  city: string | null;
  starts_at: string | null;
  art: string;
  sample?: boolean;
}

interface TierRow {
  name: string;
  price_kobo: number;
}

function splitDate(iso: string | null): { day: string; num: string; month: string; time: string } {
  if (!iso) return { day: 'TBA', num: '—', month: '', time: '' };
  const d = new Date(iso);
  return {
    day: DAY[d.getDay()],
    num: String(d.getDate()).padStart(2, '0'),
    month: MONTH[d.getMonth()],
    time: d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}

const naira = (kobo: number) => (kobo / 100).toLocaleString('en-NG');

function priceLabel(kobo: number | null): string {
  if (kobo === null) return 'TBA';
  if (kobo === 0) return 'Free';
  return `${naira(kobo)} ₦`;
}

async function load(): Promise<{ siteName: string; events: CardEvent[]; featuredTiers: Record<string, TierRow[]>; dbLive: boolean }> {
  const db = supabaseService();
  try {
    const { data: settings } = await db.from('site_settings').select('site_name').eq('id', true).maybeSingle();
    const { data: events } = await db
      .from('events')
      .select('slug, title, tagline, venue, city, starts_at, cover_path')
      .eq('status', 'published')
      .order('starts_at', { ascending: true })
      .limit(12);
    if (!events) throw new Error('no tables yet');
    const ids = events.map((e) => e.slug);
    let tiersBySlug: Record<string, TierRow[]> = {};
    if (ids.length) {
      const { data: evIds } = await db.from('events').select('id, slug').in('slug', ids);
      const idToSlug: Record<string, string> = {};
      for (const e of evIds || []) idToSlug[e.id] = e.slug;
      const { data: tiers } = await db
        .from('ticket_tiers')
        .select('event_id, name, price_kobo, status, sort')
        .in('event_id', Object.keys(idToSlug))
        .neq('status', 'hidden')
        .order('sort', { ascending: true });
      for (const t of tiers || []) {
        const s = idToSlug[t.event_id];
        if (s) (tiersBySlug[s] ||= []).push({ name: t.name, price_kobo: t.price_kobo });
      }
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '');
    const cards: CardEvent[] = events.map((e) => ({
      slug: e.slug,
      title: e.title,
      tagline: e.tagline,
      venue: e.venue,
      city: e.city,
      starts_at: e.starts_at,
      art: e.cover_path
        ? `${supabaseUrl}/storage/v1/object/public/event-images/${e.cover_path}`
        : placeholder(e.slug, { initial: e.title, wide: false }),
    }));
    return { siteName: settings?.site_name || 'Tickets', events: cards, featuredTiers: tiersBySlug, dbLive: true };
  } catch {
    // Local dev before the tables exist: show the layout with clearly
    // badged SAMPLE content so the design is reviewable. Production
    // launched sites always have tables, so this never renders there.
    if (process.env.NODE_ENV === 'production') {
      return { siteName: 'Tickets', events: [], featuredTiers: {}, dbLive: true };
    }
    const samples: CardEvent[] = [
      { slug: 'sample-founders-mixer', title: 'SYNTH INVASION', tagline: '', venue: 'The Nest Hub', city: 'Lagos', starts_at: new Date(Date.now() + 24 * 864e5).toISOString(), art: placeholder('synth-invasion', { initial: 'S', wide: false }), sample: true },
      { slug: 'sample-secret-sessions', title: 'NEON PULSE', tagline: '', venue: 'The Bunker', city: 'Lagos', starts_at: new Date(Date.now() + 33 * 864e5).toISOString(), art: placeholder('neon-pulse', { initial: 'N', wide: false }), sample: true },
      { slug: 'sample-rooftop', title: 'CRUSTY CRAB', tagline: '', venue: 'Food Court', city: 'Lagos', starts_at: new Date(Date.now() + 38 * 864e5).toISOString(), art: placeholder('crusty-crab', { initial: 'C', wide: false }), sample: true },
      { slug: 'sample-market', title: 'QUENTIN UTOPIA', tagline: '', venue: 'Old Hall', city: 'Lagos', starts_at: new Date(Date.now() + 40 * 864e5).toISOString(), art: placeholder('quentin-utopia', { initial: 'Q', wide: false }), sample: true },
    ];
    return {
      siteName: 'Tickets',
      events: samples,
      featuredTiers: {
        'sample-founders-mixer': [
          { name: 'Solidaire', price_kobo: 900000 },
          { name: 'Normal', price_kobo: 1100000 },
          { name: 'Soutien', price_kobo: 1300000 },
        ],
      },
      dbLive: false,
    };
  }
}

export default async function Home() {
  const { siteName, events, featuredTiers, dbLive } = await load();
  const [featured, ...rest] = events;

  return (
    <main style={wrap}>
      <header style={topbar}>
        <Link href="/" style={brand}>{siteName}</Link>
        <nav style={{ display: 'flex', gap: 8 }}>
          <Link href="/" style={navOn}>Events</Link>
          <Link href="/about" style={navOff}>About</Link>
        </nav>
      </header>

      {!dbLive && (
        <p style={sampleNote}>SAMPLE layout preview — run the database migrations to see live events.</p>
      )}

      {events.length === 0 ? (
        <div style={empty}>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '0.9375rem', fontWeight: 600, margin: '0 0 8px' }}>No events yet</h2>
          <p className="small" style={{ margin: 0 }}>Published events appear here the moment the organizer hits publish.</p>
        </div>
      ) : (
        <>
          <section aria-label="Events" style={rail}>
            {(rest.length > 0 ? rest : events).map((e) => (
              <EventCard key={e.slug} e={e} tiers={featuredTiers[e.slug] || []} />
            ))}
          </section>
          {featured && rest.length > 0 && <FeaturedCard e={featured} tiers={featuredTiers[featured.slug] || []} />}
        </>
      )}

      <footer style={foot}>
        <span>{siteName}</span>
        <Link href="/about" style={{ color: 'inherit' }}>About →</Link>
      </footer>
    </main>
  );
}

function EventCard({ e, tiers }: { e: CardEvent; tiers: TierRow[] }) {
  const d = splitDate(e.starts_at);
  const from = tiers.length ? Math.min(...tiers.map((t) => t.price_kobo)) : null;
  return (
    <Link href={dbLiveHref(e)} style={poster}>
      <span style={posterImgWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={e.art} alt="" style={posterImg} />
        <span style={stickerSm}>★<br />HOT</span>
        <span style={venueChip}>{(e.city || e.venue || 'LIVE').toUpperCase().slice(0, 12)}</span>
      </span>
      <span style={posterBody}>
        <span style={posterTitleRow}>
          <span style={posterTitle}>{e.title}</span>
          <span style={dateBlock}>
            <span style={dateDay}>{d.day}</span>
            <span style={dateNum}>{d.num}</span>
            <span style={dateMon}>{d.month}</span>
          </span>
        </span>
        <span style={posterFoot}>
          <span>{priceLabel(from)}</span>
          <span>{d.time}</span>
        </span>
      </span>
    </Link>
  );
}

function dbLiveHref(e: CardEvent): string {
  return e.sample ? '#' : `/e/${e.slug}`;
}

function FeaturedCard({ e, tiers }: { e: CardEvent; tiers: TierRow[] }) {
  const d = splitDate(e.starts_at);
  const shown = tiers.slice(0, 4);
  const from = tiers.length ? Math.min(...tiers.map((t) => t.price_kobo)) : null;
  return (
    <section aria-label={`Featured: ${e.title}`} style={feature}>
      <Link href={dbLiveHref(e)} style={featureImgWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={e.art} alt="" style={featureImg} />
        <span style={stickerLg}>★<br />HOT</span>
      </Link>
      <div style={featureBody}>
        <div style={tagRow}>
          <span style={tagDark}>{(e.city || 'LIVE').toUpperCase().slice(0, 14)}</span>
          <span style={tag}>FEATURED</span>
        </div>
        <div style={featureDateRow}>
          <div style={featureDate}>
            <span style={fDay}>{d.day}</span>
            <span style={fNum}>{d.num}</span>
            <span style={fMon}>{d.month}</span>
          </div>
          <div style={featureTitle}>{e.title}</div>
        </div>
        {shown.length > 0 && (
          <ul style={tierList}>
            {shown.map((t) => (
              <li key={t.name} style={tierRow}>
                <span>{t.name}</span>
                <span aria-hidden style={dots} />
                <span style={{ fontWeight: 700 }}>{priceLabel(t.price_kobo)}</span>
              </li>
            ))}
          </ul>
        )}
        <div style={featureMeta}>
          <span>{priceLabel(from)} from</span>
          <span>{d.time}</span>
        </div>
        <Link href={e.sample ? '#' : `/e/${e.slug}?buy=1`} style={reserveBtn}>
          Get tickets
        </Link>
      </div>
    </section>
  );
}

/* ── layout ── */
const wrap: React.CSSProperties = { maxWidth: 1120, margin: '0 auto', padding: '20px 16px 64px' };
const topbar: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 };
const brand: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, textDecoration: 'none', color: 'inherit' };
const navOn: React.CSSProperties = { fontSize: '0.8125rem', fontWeight: 600, padding: '8px 14px', borderRadius: 999, background: 'var(--fw-ink)', color: 'var(--fw-paper)', textDecoration: 'none' };
const navOff: React.CSSProperties = { fontSize: '0.8125rem', fontWeight: 500, padding: '8px 14px', borderRadius: 999, border: '1px solid var(--fw-line)', textDecoration: 'none', color: 'inherit', background: 'var(--fw-white)' };
const sampleNote: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--fw-warn)', background: 'var(--fw-warn-bg)', border: '1px solid currentColor', borderRadius: 8, padding: '8px 12px', margin: '0 0 16px' };
const empty: React.CSSProperties = { background: 'var(--fw-white)', border: '1px dashed var(--fw-line)', borderRadius: 'var(--r-lg)', padding: 48, textAlign: 'center' };
const rail: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 };
const foot: React.CSSProperties = { marginTop: 40, fontSize: '0.75rem', color: 'var(--fw-ink-4)', display: 'flex', gap: 16 };

/* ── poster card (reference: portrait, sticker, venue chip, date block, price/time) ── */
const poster: React.CSSProperties = { background: 'var(--fw-white)', border: '1px solid var(--fw-ink)', borderRadius: 'var(--r-lg)', overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'block', boxShadow: 'var(--shadow-2)' };
const posterImgWrap: React.CSSProperties = { position: 'relative', display: 'block', aspectRatio: '3 / 4', overflow: 'hidden', background: 'var(--fw-mist)' };
const posterImg: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
const stickerSm: React.CSSProperties = { position: 'absolute', top: 10, left: -6, width: 52, height: 52, display: 'grid', placeItems: 'center', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', fontWeight: 700, lineHeight: 1.2, color: 'var(--fw-ink)', background: 'var(--fw-paper)', border: '2px solid var(--fw-ink)', borderRadius: '50%', transform: 'rotate(-8deg)', boxShadow: 'var(--shadow-2)' };
const venueChip: React.CSSProperties = { position: 'absolute', left: 10, bottom: 10, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', color: '#FFF', background: 'rgba(26,26,26,0.85)', borderRadius: 6, padding: '5px 10px' };
const posterBody: React.CSSProperties = { display: 'block', padding: '12px 12px 10px' };
const posterTitleRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' };
const posterTitle: React.CSSProperties = { fontWeight: 800, fontSize: '0.8125rem', letterSpacing: '0.02em', textTransform: 'uppercase', lineHeight: 1.3 };
const dateBlock: React.CSSProperties = { textAlign: 'right', lineHeight: 1.05, flexShrink: 0 };
const dateDay: React.CSSProperties = { display: 'block', fontSize: '0.625rem', fontWeight: 600 };
const dateNum: React.CSSProperties = { display: 'block', fontFamily: 'var(--font-display)', fontSize: '1.625rem', fontWeight: 700 };
const dateMon: React.CSSProperties = { display: 'block', fontSize: '0.625rem', fontWeight: 600 };
const posterFoot: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--fw-line)', fontSize: '0.75rem', color: 'var(--fw-ink-2)', fontWeight: 500 };

/* ── featured (reference: split panel, pills, giant date, dotted leaders, low pill) ── */
const feature: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', background: 'var(--fw-white)', border: '1px solid var(--fw-ink)', borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--shadow-2)' };
const featureImgWrap: React.CSSProperties = { position: 'relative', display: 'block', minHeight: 340, background: 'var(--fw-mist)' };
const featureImg: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };
const stickerLg: React.CSSProperties = { position: 'absolute', right: 16, bottom: 16, width: 68, height: 68, display: 'grid', placeItems: 'center', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', fontWeight: 700, lineHeight: 1.2, color: 'var(--fw-ink)', background: 'var(--fw-paper)', border: '2px solid var(--fw-ink)', borderRadius: '50%', transform: 'rotate(8deg)', boxShadow: 'var(--shadow-2)' };
const featureBody: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, padding: 'clamp(20px, 4vw, 32px)' };
const tagRow: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' };
const tagDark: React.CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', background: 'var(--fw-ink)', color: 'var(--fw-paper)', borderRadius: 999, padding: '6px 12px' };
const tag: React.CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', background: 'var(--fw-spark-100)', color: 'var(--fw-ink)', border: `1px solid var(--fw-spark-700)`, borderRadius: 999, padding: '6px 12px' };
const featureDateRow: React.CSSProperties = { display: 'flex', gap: 16, alignItems: 'stretch' };
const featureDate: React.CSSProperties = { textAlign: 'left', lineHeight: 1.05, borderRight: '2px solid var(--fw-ink)', paddingRight: 16 };
const fDay: React.CSSProperties = { display: 'block', fontWeight: 700, fontSize: '1rem' };
const fNum: React.CSSProperties = { display: 'block', fontFamily: 'var(--font-display)', fontSize: '3.25rem', fontWeight: 700, lineHeight: 1 };
const fMon: React.CSSProperties = { display: 'block', fontWeight: 700, fontSize: '1rem' };
const featureTitle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 700, lineHeight: 1.1, alignSelf: 'center' };
const tierList: React.CSSProperties = { listStyle: 'none', margin: '4px 0 0', padding: 0, display: 'grid', gap: 10 };
const tierRow: React.CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: '0.9375rem', fontWeight: 500 };
const dots: React.CSSProperties = { flex: 1, borderBottom: '2px dotted var(--fw-line-strong)', transform: 'translateY(-4px)', minWidth: 24 };
const featureMeta: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 600, borderTop: '1px solid var(--fw-line)', paddingTop: 12 };
const reserveBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 999, background: 'var(--fw-ink)', color: 'var(--fw-paper)', fontSize: '0.9375rem', fontWeight: 600, textDecoration: 'none', marginTop: 'auto' };
