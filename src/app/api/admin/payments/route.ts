import { NextResponse } from 'next/server';
import { isOrganizer } from '@/lib/db';

/**
 * What the organizer needs to take payments: whether their Paystack key
 * is set (server env, set at launch or in hosting), and the exact webhook
 * URL to paste in their own Paystack dashboard. Same contract as the shop
 * track: their account, their bank, our endpoint.
 */
export async function GET(req: Request) {
  if (!(await isOrganizer(req))) {
    return NextResponse.json({ error: 'Not signed in as the organizer' }, { status: 401 });
  }
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  return NextResponse.json({
    paystack_set: Boolean(process.env.PAYSTACK_SECRET_KEY),
    webhook_url: siteUrl ? `${siteUrl}/api/webhook` : '/api/webhook',
  });
}
