# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Marketing site + admin panel for **After Office Resto-Bar**, a nightlife pub/bar in Futrono, Chile, running on **Cloudflare Workers** (static assets + a small API) with a **D1** database and a **KV** namespace. The public pages (`public/index.html`, `public/carta.html`, `public/nosotros.html`) are still plain HTML/CSS/JS — Tailwind via CDN, custom styling in `public/css/*.css`, vanilla JS IIFEs in `public/js/*.js` — but the menu and the "event of the week" popup are no longer hardcoded: they're edited through `/admin` and served dynamically from D1.

Repo layout:
- `public/` — everything Cloudflare serves as static assets: the three HTML pages, `css/`, `js/`, `imagenes_*/`, and `admin/` (the admin panel's login/dashboard HTML+CSS+JS — no secrets in it, all data comes from `/api/*`).
- `worker/` — the Cloudflare Worker: `wrangler.toml`, `schema.sql`, and `src/` (router + auth + D1 helpers + `/api/*` handlers).

## Running it locally

```bash
cd worker
npx wrangler dev --port 8787
```

Open `http://localhost:8787` (site) or `http://localhost:8787/admin/login.html` (admin). `wrangler dev` runs the Worker against a **local emulated D1/KV**, not the real Cloudflare data — seed it once with:

```bash
npx wrangler d1 execute after-office-db --local --file=./schema.sql
```

(plus INSERTs for `menu_categories`/`menu_items`/`popup_config`/`admin_users` — there's no committed seed file since the admin password hash shouldn't be checked into git; regenerate one locally if needed).

The old `python -m http.server 8080` / `ABRIR-SITIO.bat` / `ABRIR-CARTA.bat` workflow still opens the static pages, but the menu (`carta.html`) and popup will be empty/broken under it since `js/menu-data.js` and `js/popup-data.js` are no longer static files — the Worker generates them per-request. Use `wrangler dev` for anything menu- or popup-related.

There is no lint, build, or automated test command in this repo.

## Public site (`public/`)

Three top-level HTML pages, each self-contained (own `<head>`, own Tailwind CDN config, own script includes):

- `index.html` — landing page (hero, Pub Karaoke, Comida & Tragos preview, Eventos, Juego, Disco, Contacto/reservation form) split into `<section id="...">` blocks scrolled to by a sticky in-page nav (`.site-section-nav`). Loads `js/popup-data.js` (Worker-generated) before `sitio.js`.
- `carta.html` — the digital menu. Markup is mostly empty containers (`#carta-tabs`, `#carta-list`, product modal, sections sheet); `js/carta.js` renders it all from `window.MENU`, unchanged from before — it has no idea the data now comes from D1 instead of a static file.
- `nosotros.html` — "About us", static content, same header/footer/nav chrome as `index.html`.

Cross-page navigation is plain `<a href="carta.html">` etc. (the Worker's static-asset serving redirects `/carta.html` → `/carta`, so links still work, just via one extra redirect hop). No router.

### JS (`public/js/`)

Self-invoking functions attached to `document`/`window`, loaded via plain `<script>` tags — no modules, no bundling:

- `site-loader.js` — full-screen loading overlay (`#site-loader`) until critical images finish loading or a timeout hits.
- `sitio.js` — mobile nav, sticky header offsets, "open now" badge (`isOpenNow()`), scroll-spy nav, hero carousel, reservation form (still a **fake submit** — no backend wired to it), lazy Google Maps iframe, and the event popup. `populatePopupFromData()` (top of `initEventPopup()`) reads `window.POPUP` — set by the Worker-generated `js/popup-data.js` — and fills in title/eyebrow/badge/image/facts/CTAs before deciding whether to show it (`POPUP.enabled`); if `window.POPUP` is absent it falls back to whatever's hardcoded in the HTML.
- `images.js` (`window.AOImages`) — lazy image loader. `resolveImage()`: a bare filename resolves against `./imagenes_carta/` (legacy behavior); a value containing `/` (e.g. a future `/media/...` R2 URL) is used as-is.
- `carta.js` — renders `carta.html` from `window.MENU` (tabs/search/product modal). **Unmodified** by the admin-panel work — it just doesn't know `menu-data.js` is now dynamic.
- There is no `menu-data.js` file anymore — `worker/src/index.js` intercepts `GET /js/menu-data.js` and `GET /js/popup-data.js` and generates `var MENU = {...}` / `var POPUP = {...}` from D1 on every request (`Cache-Control: no-store`). Don't add a static file back at those paths — Cloudflare serves static assets before the Worker runs, so a static file there would permanently shadow the dynamic route.

### CSS layering

Four stylesheets loaded in a fixed order — later files override earlier ones, preserve this order:

1. `css/demos.css` — oldest/base shared styles
2. `css/ux.css` — "capa UX / conversión"
3. `css/mobile.css` — mobile overrides, wrapped in `@media (max-width: 767px)`
4. `css/sitio.css` (~3.6k lines) — the active "Demo 2 Neón" theme

`site-neon` body class + `--site-header-h`/`--site-section-nav-h`/`--site-sticky-top` custom properties (computed in `sitio.js`'s `initStickyOffsets()`) drive sticky offsetting. Bump the `?v=...` cache-busting query strings on `<link>`/`<script>` tags when editing CSS/JS.

### Images

- `imagenes_sitio/` — hero/event/loader images for the landing/about pages.
- `imagenes_carta/` — menu product photos, referenced by bare filename from D1 (`menu_items.image`), resolved by `AOImages` at runtime.
- `imagenes_bar/` — legacy, unreferenced by any code; kept at the user's request rather than deleted.
- `imagenes_resto` (repo root, **not** under `public/`) — a symlink to `imagenes_bar` from the project's old path, currently broken and not part of the deployed site.

## Admin panel (`public/admin/` + `worker/src/`)

Login-protected panel to edit the carta (categories + products) and the event popup, backed by D1. See `worker/src/` for the implementation:

- `auth.js` — password hashing/verification, session cookies, rate limiting. **`PBKDF2_ITERATIONS` is capped at 100,000** — Cloudflare Workers' WebCrypto throws `NotSupportedError` above that (this passes silently in `wrangler dev`'s local emulation, which doesn't enforce the cap, so a too-high value only fails in production — if login mysteriously fails only after deploying, check this first). Sessions are stateless signed cookies (`HttpOnly; Secure; SameSite=Strict`) carrying `{uid, tv, exp}`; `tv` (token_version) is checked against the DB on every request so a password change invalidates all other sessions. Mutating API calls also require an `X-Admin-Request: 1` header (CSRF defense-in-depth alongside `SameSite=Strict`). Failed logins are rate-limited via the `RATE_LIMIT` KV namespace (5 attempts / 15 min per IP+username).
- `db.js` — D1 query helpers for menu/popup/users, always parameterized (`.bind()`).
- `api/auth.js`, `api/menu.js`, `api/popup.js` — the `/api/*` routes. `index.js` is the top-level router: it special-cases `/js/menu-data.js`, `/js/popup-data.js`, and `/api/*`, adds security headers (a stricter CSP for `/admin/*`), and falls through to `env.ASSETS.fetch(request)` for everything else.

D1 schema is in `worker/schema.sql`: `admin_users`, `menu_categories`, `menu_items`, `popup_config` (single row, `id = 1`). There's no `package.json`-tracked seed script for menu content — it was migrated once from the old `js/menu-data.js` via a one-off script, not part of the regular workflow.

Image uploads for new menu items / popup flyers aren't wired up yet — the image field is still a plain filename/path, matching the pre-admin behavior. Adding upload support means enabling R2 on the account, creating a bucket, adding a `/api/images/upload` route storing to it, and serving it back via a `/media/<key>` route in `index.html`'s Worker `fetch` handler.

## Secrets / environment

- `worker/.dev.vars` (gitignored) — `SESSION_SECRET` for local `wrangler dev`.
- Production secret is set via `wrangler secret put SESSION_SECRET` (not in any file).
- Never commit an admin password or its hash to a seed file that goes into git.

## Menu content pipeline (historical)

`scripts/import-carta.py` — a one-off migration script (hardcoded absolute Windows paths) that originally scraped a Gourmedia HTML export into `js/menu-data.js` and `imagenes_carta/`, before either existed in D1. Kept for reference only; current menu edits go through `/admin`, not this script.

## Deployment

Cloudflare Worker (`workers.dev` subdomain currently; a custom domain — `afterofficefutrono.cl`, registered at NIC Chile — is not connected yet). Deploy with `cd worker && npx wrangler deploy`. `.htaccess` at the repo root is a leftover from a prior Apache-hosting deploy and has no effect on Cloudflare.

## Known repo quirks

- `node_modules/` (Playwright) and `.wrangler/` are gitignored but may still exist on disk from ad-hoc testing — not project dependencies.
- `imagenes_bar/` (~70MB) is unreferenced by any code but was intentionally kept rather than deleted.
