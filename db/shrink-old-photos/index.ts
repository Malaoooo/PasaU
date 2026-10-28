// One-off Edge Function "shrink-old-photos": stores a shrunk copy of a listing photo that already exists.
// The resizing happens on the PC (shrink-old-photos.ps1); this only writes the bytes with the service role,
// because storage rules let each student write only their own folder. Delete the function when done.
// Deploy with verify_jwt off and set the secret SHRINK_KEY; every call must send it as x-shrink-key.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const BUCKET = 'listing-photos';
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  const key = Deno.env.get('SHRINK_KEY');
  if (req.method !== 'POST' || !key || req.headers.get('x-shrink-key') !== key) return new Response('Not allowed', { status: 401 });
  const q = new URL(req.url).searchParams, name = q.get('name') || '', kind = q.get('kind');
  const type = req.headers.get('content-type') || '';
  if (!/^[0-9a-f-]{36}\/\d+\/[\w.-]+$/.test(name) || (kind !== 'full' && kind !== 'thumb') || !/^image\/(jpeg|png)$/.test(type)) {
    return new Response('Bad request', { status: 400 });
  }
  // Only photos that are already there: replace one, or add its list-size copy next to it
  const dir = name.slice(0, name.lastIndexOf('/')), file = name.slice(name.lastIndexOf('/') + 1);
  const { data: found } = await sb.storage.from(BUCKET).list(dir, { search: file });
  if (!found || !found.some((o) => o.name === file)) return new Response('No such photo', { status: 404 });
  const path = kind === 'full' ? name : name.replace(/\.[^./]+$/, '') + '-t.jpg';
  const body = new Uint8Array(await req.arrayBuffer());
  if (body.length < 100 || body.length > 2_000_000) return new Response('Bad size', { status: 400 });
  const { error } = await sb.storage.from(BUCKET).upload(path, body, { contentType: type, cacheControl: '31536000', upsert: true });
  return error ? new Response(error.message, { status: 500 }) : new Response(JSON.stringify({ path, bytes: body.length }), { headers: { 'content-type': 'application/json' } });
});
