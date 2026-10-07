import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { coverUrl, isOrganizer, supabaseService } from '@/lib/db';

/** Cover upload: base64 JSON (no multipart dependency), 2MB cap. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isOrganizer(req))) {
    return NextResponse.json({ error: 'Not signed in as the organizer' }, { status: 401 });
  }
  const { id } = await params;
  const db = supabaseService();
  const { data: event } = await db.from('events').select('id, cover_path').eq('id', id).maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const { imageDataUrl } = (await req.json()) as { imageDataUrl?: string };
  const m = String(imageDataUrl || '').match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
  if (!m) return NextResponse.json({ error: 'Send a PNG, JPEG or WebP image' }, { status: 400 });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 2 * 1024 * 1024) return NextResponse.json({ error: 'Image must be under 2MB' }, { status: 413 });

  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const objectPath = `covers/${id}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await db.storage.from('event-images').upload(objectPath, buf, {
    contentType: `image/${m[1]}`,
    upsert: false,
  });
  if (upErr) return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  if (event.cover_path) {
    await db.storage.from('event-images').remove([event.cover_path]).catch(() => {});
  }
  const { error } = await db.from('events').update({ cover_path: objectPath }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  return NextResponse.json({ cover_url: coverUrl(objectPath) });
}
