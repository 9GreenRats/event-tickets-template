import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/db';

/** Trade a payment reference for the ticket it minted. 404 while the
 *  webhook is still processing — the page retries. A paid order also
 *  carries the venue, which is how gated venues get revealed. */
export async function GET(_req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  if (!reference || reference.length > 128) {
    return NextResponse.json({ error: 'Invalid reference' }, { status: 400 });
  }
  const db = supabaseService();
  const { data, error } = await db
    .from('ticket_orders')
    .select('ticket_code, qty, email, status, event_id')
    .eq('paystack_reference', reference)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Ticket not ready yet' }, { status: 404 });
  let venue = null;
  if (data.event_id) {
    const { data: e } = await db
      .from('events')
      .select('venue, address, city')
      .eq('id', data.event_id)
      .maybeSingle();
    venue = e || null;
  }
  return NextResponse.json({ ...data, venue });
}
