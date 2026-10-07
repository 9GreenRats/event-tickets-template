import { NextResponse } from 'next/server';
import { coverUrl, isOrganizer, supabaseService } from '@/lib/db';

const forbidden = () => NextResponse.json({ error: 'Not signed in as the organizer' }, { status: 401 });

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

/** All events with tiers — the admin console works across all of them. */
export async function GET(req: Request) {
  if (!(await isOrganizer(req))) return forbidden();
  const db = supabaseService();
  const { data: events, error } = await db.from('events').select('*').order('starts_at', { ascending: true });
  if (error) return NextResponse.json({ error: 'Load failed' }, { status: 500 });
  const ids = (events || []).map((e) => e.id);
  let byEvent: Record<string, unknown[]> = {};
  if (ids.length) {
    const { data: tiers } = await db.from('ticket_tiers').select('*').in('event_id', ids).order('sort');
    for (const t of tiers || []) ((byEvent[t.event_id] ||= []) as unknown[]).push(t);
  }
  return NextResponse.json({
    events: (events || []).map((e) => ({ ...e, cover_url: coverUrl(e.cover_path), tiers: byEvent[e.id] || [] })),
  });
}

/** Create an event (draft). */
export async function POST(req: Request) {
  if (!(await isOrganizer(req))) return forbidden();
  const b = (await req.json()) as { title?: string };
  if (!b.title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  const db = supabaseService();
  let slug = slugify(b.title) || `event-${Date.now().toString(36)}`;
  const { data: clash } = await db.from('events').select('id').eq('slug', slug).maybeSingle();
  if (clash) slug = `${slug}-${Date.now().toString(36)}`;
  const { data, error } = await db
    .from('events')
    .insert({ slug, title: b.title.trim(), status: 'draft' })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'Create failed' }, { status: 500 });
  return NextResponse.json({ event: { ...data, cover_url: null, tiers: [] } });
}
