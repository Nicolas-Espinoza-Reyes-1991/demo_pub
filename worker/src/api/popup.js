import { requireSession, hasAdminHeader } from '../auth.js';
import { getPopup } from '../db.js';
import { deleteManagedImage } from './images.js';

function json(data, init) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(init && init.headers) },
  });
}

function cleanString(value, maxLen) {
  return String(value == null ? '' : value).trim().slice(0, maxLen);
}

const ICON_RE = /^[a-z0-9-]{0,40}$/;
const IMAGE_RE = /^[A-Za-z0-9_./%-]{0,300}$/;
const HREF_RE = /^[A-Za-z0-9#/_.-]{0,200}$/;

function cleanFacts(facts) {
  if (!Array.isArray(facts)) return [];
  return facts
    .slice(0, 6)
    .map((f) => ({
      icon: ICON_RE.test(f && f.icon) ? f.icon : 'sparkles',
      text: cleanString(f && f.text, 80),
    }))
    .filter((f) => f.text);
}

export async function handlePopupRoute(request, env, url) {
  const session = await requireSession(request, env);
  if (!session) return json({ error: 'No autenticado.' }, { status: 401 });

  if (request.method === 'GET' && url.pathname === '/api/popup') {
    return json(await getPopup(env.DB));
  }

  if (request.method === 'PUT' && url.pathname === '/api/popup') {
    if (!hasAdminHeader(request)) return json({ error: 'Solicitud inválida.' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const enabled = body.enabled ? 1 : 0;
    const badge = cleanString(body.badge, 60);
    const eyebrow = cleanString(body.eyebrow, 80);
    const title = cleanString(body.title, 120);
    const image = cleanString(body.image, 300);
    const ctaPrimaryLabel = cleanString(body.ctaPrimaryLabel, 40) || 'Reservar mesa';
    const ctaPrimaryHref = HREF_RE.test(body.ctaPrimaryHref) ? body.ctaPrimaryHref : '#contacto';
    const ctaSecondaryLabel = cleanString(body.ctaSecondaryLabel, 40) || 'Ver agenda';
    const ctaSecondaryHref = HREF_RE.test(body.ctaSecondaryHref) ? body.ctaSecondaryHref : '#eventos';
    const facts = cleanFacts(body.facts);

    if (!title || !IMAGE_RE.test(image)) {
      return json({ error: 'Título e imagen son obligatorios y deben tener un formato válido.' }, { status: 400 });
    }

    const previous = await env.DB.prepare('SELECT image FROM popup_config WHERE id = 1').first();

    await env.DB.prepare(
      `UPDATE popup_config SET enabled = ?, badge = ?, eyebrow = ?, title = ?, image = ?, facts = ?,
         cta_primary_label = ?, cta_primary_href = ?, cta_secondary_label = ?, cta_secondary_href = ?,
         updated_at = datetime('now')
       WHERE id = 1`
    )
      .bind(enabled, badge, eyebrow, title, image, JSON.stringify(facts), ctaPrimaryLabel, ctaPrimaryHref, ctaSecondaryLabel, ctaSecondaryHref)
      .run();

    if (previous && previous.image !== image) await deleteManagedImage(env, previous.image);

    return json({ ok: true });
  }

  return json({ error: 'No encontrado.' }, { status: 404 });
}
