import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();

/** Browser-safe client. RLS is service-role-only, so this is used for
 *  auth (sign-in, session) — data goes through our API routes. */
export const supabaseAnon = () =>
  createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } });

/** Public cover URL for the event-covers bucket. */
export const coverUrl = (p: string | null | undefined) =>
  p ? `${url.replace(/\/$/, '')}/storage/v1/object/public/event-images/${p}` : null;

/** Server only. Never import into a client component. */
export const supabaseService = () =>
  createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

export interface Tier {
  id: string;
  name: string;
  description: string;
  price_kobo: number;
  capacity: number;
  sold: number;
  status: 'active' | 'hidden' | 'soldout';
}

export interface EventRow {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  venue: string;
  address: string;
  city: string;
  starts_at: string | null;
  doors_at: string | null;
  venue_reveal: 'public' | 'after_purchase';
  cover_url?: string | null;
}

export const naira = (kobo: number) => (kobo / 100).toLocaleString('en-NG');
export const left = (t: Tier) => Math.max(0, t.capacity - t.sold);
export const sellable = (t: Tier) => t.status === 'active' && left(t) > 0;

export const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : 'To be announced';

export const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' }) : '';

/** True when the request carries the organizer's Supabase session. */
export async function isOrganizer(req: Request): Promise<boolean> {
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
  if (!jwt) return false;
  try {
    const { data } = await supabaseAnon().auth.getUser(jwt);
    return (data.user?.email || '').toLowerCase().trim() === ADMIN_EMAIL && Boolean(ADMIN_EMAIL);
  } catch {
    return false;
  }
}
