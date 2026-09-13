import { getMenu, getPopup, getFeaturedItems, getBusinessHours, cancelUnconfirmedReservations } from './db.js';
import { handleAuthRoute } from './api/auth.js';
import { handleMenuRoute } from './api/menu.js';
import { handlePopupRoute } from './api/popup.js';
import { handleImagesRoute, findOrphanKeys } from './api/images.js';
import { handleReservationsRoute } from './api/reservations.js';
import { handleHoursRoute } from './api/hours.js';

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

// Public site: no external scripts at all now that Tailwind/Lucide were
// replaced with self-hosted equivalents. style-src needs 'unsafe-inline' for
// a handful of static style="" attributes (header texture, hidden form
// state) — much lower risk than allowing it on script-src.
const PUBLIC_CSP =
  "default-src 'self'; script-src 'self'; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; " +
  "img-src 'self' data:; connect-src 'self'; " +
  "frame-src https://maps.google.com https://www.google.com; " +
  "frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

// "MM-DD" (no year) comparison, since the season range repeats every year and
// can wrap across Dec 31 -> Jan 1 (e.g. verano "10-01" to "03-31").
function isDateInRange(mmdd, startMmdd, endMmdd) {
  if (startMmdd <= endMmdd) return mmdd >= startMmdd && mmdd <= endMmdd;
  return mmdd >= startMmdd || mmdd <= endMmdd;
}

function pickActiveSchedule(hours) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  const todayMmdd = `${map.month}-${map.day}`;

  const isVerano = isDateInRange(todayMmdd, hours.veranoStart, hours.veranoEnd);
  return { season: isVerano ? 'verano' : 'invierno', lines: isVerano ? hours.veranoSchedule : hours.inviernoSchedule };
}

function withHeaders(response, extra) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries({ ...BASE_HEADERS, ...extra })) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}

// Workers Static Assets' own default for HTML ("max-age=0, must-revalidate")
// is a signal for *browsers* to always revalidate, but Cloudflare's edge
// cache doesn't reliably treat that as "don't cache me" — we've seen it
// serve a stale HTML page (cf-cache-status: HIT) to real navigations for
// over an hour after a deploy, even with a fresh cache-busting query string,
// while a plain fetch()/curl to the identical URL got the current version.
// A page's text content editing shouldn't ever depend on a manual "Purge
// Everything" to go live, so HTML documents get the unambiguous "never
// cache this at the edge" directive; images/CSS/JS keep whatever
// Cache-Control Static Assets/_headers already gives them.
function withNoStoreForHtml(response, extra) {
  const withCsp = withHeaders(response, extra);
  if ((withCsp.headers.get('Content-Type') || '').includes('text/html')) {
    withCsp.headers.set('Cache-Control', 'no-store');
  }
  return withCsp;
}

async function routeApi(request, env, url) {
  if (url.pathname.startsWith('/api/auth/')) return handleAuthRoute(request, env, url);
  if (url.pathname.startsWith('/api/menu')) return handleMenuRoute(request, env, url);
  if (url.pathname.startsWith('/api/popup')) return handlePopupRoute(request, env, url);
  if (url.pathname.startsWith('/api/images')) return handleImagesRoute(request, env, url);
  if (url.pathname.startsWith('/api/reservations')) return handleReservationsRoute(request, env, url);
  if (url.pathname.startsWith('/api/hours')) return handleHoursRoute(request, env, url);
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

      if (url.pathname === '/js/hours-data.js') {
        const hours = await getBusinessHours(env.DB);
        const payload = hours ? pickActiveSchedule(hours) : null;
        return new Response(`var HOURS = ${JSON.stringify(payload)};`, {
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
        return withNoStoreForHtml(await env.ASSETS.fetch(request), { 'Content-Security-Policy': ADMIN_CSP });
      }

      return withNoStoreForHtml(await env.ASSETS.fetch(request), { 'Content-Security-Policy': PUBLIC_CSP });
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

    // Reservations nobody confirmed by email within the link's own 48h
    // window (see CONFIRM_TOKEN_TTL_HOURS in api/reservations.js) — the
    // token is already unusable by then, this just tidies up the DB row.
    const cancelled = await cancelUnconfirmedReservations(env.DB, 48);
    console.log(`Scheduled cleanup: auto-cancelled ${cancelled} unconfirmed reservation(s).`);
  },
};
