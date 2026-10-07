import { NextResponse } from 'next/server';
import { supabaseService, isOrganizer } from '@/lib/db';

const forbidden = () => NextResponse.json({ error: 'Not signed in as the organizer' }, { status: 401 });

/** Edit price / capacity / status / copy of one tier. Sold counts are
 *  never written here — only the webhook moves them. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isOrganizer(req))) return forbidden();
  const { id } = await params;
  const b = (await req.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof b.name === 'string' && b.name.trim()) patch.name = b.name.trim();
  if (typeof b.description === 'string') patch.description = b.description.trim();
  if (b.price_naira !== undefined) patch.price_kobo = Math.max(0, Math.round(Number(b.price_naira) || 0) * 100);
  if (b.capacity !== undefined) patch.capacity = Math.max(0, parseInt(String(b.capacity), 10) || 0);
  if (b.status === 'active' || b.status === 'hidden' || b.status === 'soldout') patch.status = b.status;
  const { data, error } = await supabaseService().from('ticket_tiers').update(patch).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  return NextResponse.json({ tier: data });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isOrganizer(req))) return forbidden();
  const { id } = await params;
  const { error } = await supabaseService().from('ticket_tiers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
