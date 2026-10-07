import { NextResponse } from 'next/server';
import { isOrganizer, supabaseService } from '@/lib/db';

const forbidden = () => NextResponse.json({ error: 'Not signed in as the organizer' }, { status: 401 });

/** Site profile for the About page — edited here, read publicly. */
export async function GET(req: Request) {
  if (!(await isOrganizer(req))) return forbidden();
  const { data, error } = await supabaseService().from('site_settings').select('site_name, tagline, description').eq('id', true).maybeSingle();
  if (error) return NextResponse.json({ error: 'Load failed' }, { status: 500 });
  return NextResponse.json({ site: data || { site_name: '', tagline: '', description: '' } });
}

export async function PATCH(req: Request) {
  if (!(await isOrganizer(req))) return forbidden();
  const b = (await req.json()) as { site_name?: string; tagline?: string; description?: string };
  const patch: Record<string, string> = {};
  if (typeof b.site_name === 'string' && b.site_name.trim()) patch.site_name = b.site_name.trim().slice(0, 80);
  if (typeof b.tagline === 'string') patch.tagline = b.tagline.trim().slice(0, 160);
  if (typeof b.description === 'string') patch.description = b.description.slice(0, 2000);
  const { error } = await supabaseService().from('site_settings').update(patch).eq('id', true);
  if (error) return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
