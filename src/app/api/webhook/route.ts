import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseService } from '@/lib/db';

/**
 * Paystack webhook on the ORGANIZER's account — added in their own Paystack
 * dashboard (builder Step 6 shows the address). No relay: money and events
 * both belong to the organizer. Idempotent on paystack_reference.
 */
export async function POST(req: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return new Response('Payments not configured', { status: 500 });

  const raw = await req.text();
  const sig = crypto.createHmac('sha512', secret).update(raw).digest('hex');
  if (sig !== req.headers.get('x-paystack-signature')) return new Response('Invalid signature', { status: 400 });

  const event = JSON.parse(raw);
  if (event.event !== 'charge.success') return new Response('ok');

  const ref = event.data?.reference as string;
  let meta = event.data?.metadata ?? {};
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta); } catch { meta = {}; }
  }
  if ((meta.app && meta.app !== 'tickets') || !String(ref || '').startsWith('fw-tk-')) {
    return new Response('ok'); // not a ticket charge
  }

  try {
    const db = supabaseService();
    const { data: existing } = await db.from('ticket_orders').select('id').eq('paystack_reference', ref).maybeSingle();
    if (existing) return new Response('ok');

    const qty = Math.min(Math.max(parseInt(meta.qty, 10) || 1, 1), 10);
    const { data: tier } = await db.from('ticket_tiers').select('*').eq('id', meta.tier_id).maybeSingle();
    if (!tier) {
      console.error(`webhook: tier missing for ${ref}`);
      return new Response('ok');
    }
    const expected = tier.price_kobo * qty;
    if (event.data.amount !== expected) {
      console.error(`webhook: amount mismatch for ${ref}`);
      return new Response('ok');
    }
    const email = String(event.data.customer?.email || meta.email || '').toLowerCase().trim() || null;
    const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const buf = crypto.randomBytes(6);
    let code = 'FW-TK-';
    for (const b of buf) code += abc[b % abc.length];

    const { error } = await db.from('ticket_orders').insert({
      event_id: meta.event_id, tier_id: tier.id, email, qty,
      amount_kobo: expected, paystack_reference: ref, ticket_code: code, status: 'paid',
    });
    if (error) throw error;
    await db.from('ticket_tiers').update({ sold: tier.sold + qty }).eq('id', tier.id);
    return new Response('ok');
  } catch (e) {
    console.error('webhook failed:', e);
    return new Response('Database error', { status: 500 });
  }
}
