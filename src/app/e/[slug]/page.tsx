import { notFound } from 'next/navigation';
import { coverUrl, supabaseService, type EventRow, type Tier } from '@/lib/db';
import EventPage from '../../EventPage';

export const dynamic = 'force-dynamic';

export type PublicEvent = EventRow & { cover_url?: string | null };

export default async function EventRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = supabaseService();
  const { data: settings } = await db.from('site_settings').select('site_name').eq('id', true).maybeSingle();
  const { data: event } = await db
    .from('events')
    .select('id, slug, title, tagline, description, venue, address, city, starts_at, doors_at, venue_reveal, cover_path, status')
    .eq('slug', slug)
    .maybeSingle();
  if (!event || event.status !== 'published') notFound();

  let tiers: Tier[] = [];
  const { data } = await db
    .from('ticket_tiers')
    .select('*')
    .eq('event_id', event.id)
    .neq('status', 'hidden')
    .order('sort', { ascending: true });
  tiers = (data as Tier[]) || [];

  // Gated venues never reach the browser: stripped before render.
  const pub: PublicEvent = {
    ...(event as unknown as EventRow),
    venue: event.venue_reveal === 'after_purchase' ? null : event.venue,
    address: event.venue_reveal === 'after_purchase' ? null : event.address,
    cover_url: coverUrl(event.cover_path),
  };
  return <EventPage event={pub} tiers={tiers} siteName={settings?.site_name || 'Tickets'} />;
}
