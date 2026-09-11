import { requireSession, hasAdminHeader } from '../auth.js';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function json(data, init) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(init && init.headers) },
  });
}

function randomHex(len) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function handleImagesRoute(request, env, url) {
  const session = await requireSession(request, env);
  if (!session) return json({ error: 'No autenticado.' }, { status: 401 });

  if (request.method === 'POST' && url.pathname === '/api/images/upload') {
    if (!hasAdminHeader(request)) return json({ error: 'Solicitud inválida.' }, { status: 403 });

    const contentType = request.headers.get('Content-Type') || '';
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
      return json({ error: 'Formato de subida inválido.' }, { status: 400 });
    }

    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ error: 'No se pudo leer el archivo.' }, { status: 400 });
    }

    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return json({ error: 'No se recibió ninguna imagen.' }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return json({ error: 'La imagen es muy pesada (máximo 8 MB).' }, { status: 400 });
    }
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return json({ error: 'Formato no soportado. Usa JPG, PNG, WEBP o GIF.' }, { status: 400 });
    }

    const key = `uploads/${Date.now()}-${randomHex(8)}.${ext}`;
    await env.IMAGES_KV.put(key, await file.arrayBuffer(), {
      metadata: { contentType: file.type },
    });

    return json({ ok: true, url: `/media/${key}` });
  }

  // Lets the admin UI discard an image it just uploaded but never saved
  // (e.g. the user picked a new photo, then hit Cancel) instead of waiting
  // for the scheduled sweep.
  if (request.method === 'DELETE' && url.pathname === '/api/images') {
    if (!hasAdminHeader(request)) return json({ error: 'Solicitud inválida.' }, { status: 403 });
    const path = url.searchParams.get('path');
    await deleteManagedImage(env, path);
    return json({ ok: true });
  }

  if (request.method === 'GET' && url.pathname === '/api/images/orphans') {
    const orphans = await findOrphanKeys(env);
    return json({ orphans, count: orphans.length });
  }

  if (request.method === 'POST' && url.pathname === '/api/images/cleanup') {
    if (!hasAdminHeader(request)) return json({ error: 'Solicitud inválida.' }, { status: 403 });
    const orphans = await findOrphanKeys(env);
    for (const key of orphans) await env.IMAGES_KV.delete(key);
    return json({ ok: true, deleted: orphans.length });
  }

  return json({ error: 'No encontrado.' }, { status: 404 });
}

// An uploaded-but-abandoned image (picked a photo, then closed the tab
// without saving) never gets cleaned up by deleteManagedImage, since that
// only runs when an item/popup row is actually updated or deleted. This
// reconciles what's really in KV against what menu_items/popup_config still
// reference, and reports/removes anything left over. Skips anything younger
// than GRACE_MS so it never races a save that's still in flight.
const GRACE_MS = 60 * 60 * 1000; // 1 hour

function keyUploadedAt(key) {
  const m = key.match(/^uploads\/(\d+)-/);
  return m ? parseInt(m[1], 10) : 0;
}

export async function findOrphanKeys(env) {
  const used = new Set();

  const items = (await env.DB.prepare('SELECT image FROM menu_items').all()).results;
  for (const item of items) {
    if (item.image && item.image.startsWith('/media/')) used.add(item.image.slice('/media/'.length));
  }

  const popup = await env.DB.prepare('SELECT image FROM popup_config WHERE id = 1').first();
  if (popup && popup.image && popup.image.startsWith('/media/')) used.add(popup.image.slice('/media/'.length));

  const now = Date.now();
  const orphans = [];
  let cursor;
  do {
    const listing = await env.IMAGES_KV.list({ prefix: 'uploads/', cursor });
    for (const entry of listing.keys) {
      if (used.has(entry.name)) continue;
      if (now - keyUploadedAt(entry.name) < GRACE_MS) continue;
      orphans.push(entry.name);
    }
    cursor = listing.list_complete ? undefined : listing.cursor;
  } while (cursor);

  return orphans;
}

// Best-effort cleanup: only ever touches images this system uploaded itself
// (paths under /media/) — never the legacy static files in imagenes_carta/.
export async function deleteManagedImage(env, imagePath) {
  if (!imagePath || !imagePath.startsWith('/media/')) return;
  const key = imagePath.slice('/media/'.length);
  if (!key) return;
  try {
    await env.IMAGES_KV.delete(key);
  } catch {
    // Not worth failing the caller's request over a cleanup miss.
  }
}
