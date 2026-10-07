import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseService, left, sellable } from '@/lib/db';

/**
 * Buyer checkout on the organizer's own Paystack account.
 * POST { tierId, qty, email } → { url, reference } or { free, reference }.
 */
export async function POST(req: Request) {
  try {
    const { tierId, qty = 1, email } = (await req.json()) as { tierId?: string; qty?: number; email?: string };
    const n = Math.min(Math.max(parseInt(String(qty), 10) || 1, 1), 10);
    if (!tierId) return NextResponse.json({ error: 'Tier is required' }, { status: 400 });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');

    const db = supabaseService();
    const { data: tier } = await db.from('ticket_tiers').select('*').eq('id', tierId).maybeSingle();
    if (!tier || tier.status === 'hidden') return NextResponse.json({ error: 'Tier not found' }, { status: 404 });
    if (!sellable(tier) || left(tier) < n) return NextResponse.json({ error: 'Not enough tickets left in this tier' }, { status: 409 });

    const amount = tier.price_kobo * n;
    const reference = `fw-tk-${crypto.randomUUID()}`;
    const cleanEmail = email.toLowerCase().trim();

    if (amount === 0) {
      // Free tier — mint immediately, no Paystack round-trip.
      const code = ticketCode();
      const { error } = await db.from('ticket_orders').insert({
        event_id: tier.event_id, tier_id: tier.id, email: cleanEmail,
        qty: n, amount_kobo: 0, paystack_reference: reference, ticket_code: code, status: 'paid',
      });
      if (error) throw error;
      await db.from('ticket_tiers').update({ sold: tier.sold + n }).eq('id', tier.id);
      return NextResponse.json({ free: true, reference });
    }

    if (!secret) return NextResponse.json({ error: 'Payments are not set up yet' }, { status: 503 });
    const { data: event } = await db.from('events').select('slug, title').eq('id', tier.event_id).maybeSingle();

    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        amount,
        reference,
        callback_url: `${siteUrl}/e/${event?.slug || ''}?ticket_reference=${reference}`,
        metadata: { app: 'tickets', event_id: tier.event_id, tier_id: tier.id, qty: n, event_title: event?.title || '' },
      }),
    });
    const data = await res.json();
    if (!data.status) throw new Error(data.message || 'Payment initialization failed');
    return NextResponse.json({ url: data.data.authorization_url, reference });
  } catch (e) {
    console.error('checkout failed:', e);
    return NextResponse.json({ error: 'Failed to start checkout' }, { status: 500 });
  }
}

function ticketCode() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const buf = crypto.randomBytes(6);
  let s = '';
  for (const b of buf) s += abc[b % abc.length];
  return `FW-TK-${s}`;
}
