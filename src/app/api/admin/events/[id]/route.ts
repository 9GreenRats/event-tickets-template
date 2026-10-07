import { NextResponse } from 'next/server';
import { coverUrl, isOrganizer, supabaseService } from '@/lib/db';

const forbidden = () => NextResponse.json({ error: 'Not signed in as the organizer' }, { status: 401 });

const FIELDS = ['title', 'tagline', 'description', 'venue', 'address', 'city', 'starts_at', 'doors_at', 'ends_at'] as const;

/** Edit one event. Slug and id never change; sold counts live elsewhere. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isOrganizer(req))) return forbidden();
  const { id } = await params;
  const b = (await req.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of FIELDS) {
    if (typeof b[k] === 'string') patch[k] = (b[k] as string).trim() || null;
  }
  if (b.status === 'draft' || b.status === 'published' || b.status === 'archived') patch.status = b.status;
  if (b.venue_reveal === 'public' || b.venue_reveal === 'after_purchase') patch.venue_reveal = b.venue_reveal;
  const { data, error } = await supabaseService().from('events').update(patch).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  return NextResponse.json({ event: { ...data, cover_url: coverUrl(data.cover_path) } });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isOrganizer(req))) return forbidden();
  const { id } = await params;
  const { error } = await supabaseService().from('events').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
