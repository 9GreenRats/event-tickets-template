import { NextResponse } from 'next/server';
import { supabaseService, isOrganizer } from '@/lib/db';

const forbidden = () => NextResponse.json({ error: 'Not signed in as the organizer' }, { status: 401 });

/** Add a tier to a specific event. */
export async function POST(req: Request) {
  if (!(await isOrganizer(req))) return forbidden();
  const b = (await req.json()) as { event_id?: string; name?: string; description?: string; price_naira?: number; capacity?: number };
  if (!b.name?.trim()) return NextResponse.json({ error: 'Tier name is required' }, { status: 400 });
  if (!b.event_id) return NextResponse.json({ error: 'Event is required' }, { status: 400 });
  const db = supabaseService();
  const { data: event } = await db.from('events').select('id').eq('id', b.event_id).maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  const eventId = event.id;
  const { data: existing } = await db.from('ticket_tiers').select('sort').eq('event_id', eventId).order('sort', { ascending: false }).limit(1);
  const { data: tier, error } = await db.from('ticket_tiers').insert({
    event_id: eventId,
    name: b.name.trim(),
    description: (b.description || '').trim(),
    price_kobo: Math.max(0, Math.round((Number(b.price_naira) || 0) * 100)),
    capacity: Math.max(0, parseInt(String(b.capacity), 10) || 0),
    sort: (existing?.[0]?.sort ?? -1) + 1,
    status: 'active',
  }).select('*').single();
  if (error) return NextResponse.json({ error: 'Add failed' }, { status: 500 });
  return NextResponse.json({ tier });
}
