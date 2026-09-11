import { getMenu, getPopup, getFeaturedItems } from './db.js';
import { handleAuthRoute } from './api/auth.js';
import { handleMenuRoute } from './api/menu.js';
import { handlePopupRoute } from './api/popup.js';
import { handleImagesRoute, findOrphanKeys } from './api/images.js';
import { handleReservationsRoute } from './api/reservations.js';

const BASE_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const ADMIN_CSP =
  "default-src 'self'; script-src 'self'; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; " +
  "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

function withHeaders(response, extra) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries({ ...BASE_HEADERS, ...extra })) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}

async function routeApi(request, env, url) {
  if (url.pathname.startsWith('/api/auth/')) return handleAuthRoute(request, env, url);
  if (url.pathname.startsWith('/api/menu')) return handleMenuRoute(request, env, url);
  if (url.pathname.startsWith('/api/popup')) return handlePopupRoute(request, env, url);
  if (url.pathname.startsWith('/api/images')) return handleImagesRoute(request, env, url);
  if (url.pathname.startsWith('/api/reservations')) return handleReservationsRoute(request, env, url);
  return new Response(JSON.stringify({ error: 'No encontrado.' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function serveMedia(env, url) {
  const key = decodeURIComponent(url.pathname.slice('/media/'.length));
  if (!key) return new Response('No encontrado.', { status: 404 });
  const { value, metadata } = await env.IMAGES_KV.getWithMetadata(key, { type: 'arrayBuffer' });
  if (!value) return new Response('No encontrado.', { status: 404 });
  const headers = new Headers();
  headers.set('Content-Type', (metadata && metadata.contentType) || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(value, { headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      if (url.pathname === '/js/menu-data.js') {
        const menu = await getMenu(env.DB);
        return new Response(`var MENU = ${JSON.stringify(menu)};`, {
          headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }

      if (url.pathname === '/js/popup-data.js') {
        const popup = await getPopup(env.DB);
        return new Response(`var POPUP = ${JSON.stringify(popup)};`, {
          headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }

      if (url.pathname === '/js/featured-data.js') {
        const featured = await getFeaturedItems(env.DB);
        return new Response(`var FEATURED = ${JSON.stringify(featured)};`, {
          headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }

      if (url.pathname.startsWith('/media/')) {
        return serveMedia(env, url);
      }

      if (url.pathname.startsWith('/api/')) {
        return withHeaders(await routeApi(request, env, url), { 'Content-Security-Policy': "frame-ancestors 'none'" });
      }

      if (url.pathname.startsWith('/admin')) {
        return withHeaders(await env.ASSETS.fetch(request), { 'Content-Security-Policy': ADMIN_CSP });
      }

      return env.ASSETS.fetch(request);
    } catch (err) {
      console.error(err);
      return new Response('Error interno.', { status: 500 });
    }
  },

  // Daily sweep (see [triggers] in wrangler.toml): deletes any uploaded image
  // that's no longer referenced by a menu item or the popup — covers uploads
  // that were never saved (photo picked, tab closed) so storage never
  // quietly accumulates unused files.
  async scheduled(event, env, ctx) {
    const orphans = await findOrphanKeys(env);
    for (const key of orphans) {
      await env.IMAGES_KV.delete(key);
    }
    console.log(`Scheduled cleanup: deleted ${orphans.length} orphaned image(s).`);
  },
};
