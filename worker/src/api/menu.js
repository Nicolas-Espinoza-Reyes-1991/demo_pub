import { requireSession, hasAdminHeader } from '../auth.js';
import { getMenuForAdmin } from '../db.js';
import { deleteManagedImage } from './images.js';

function json(data, init) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(init && init.headers) },
  });
}

const SLUG_RE = /^[a-z0-9-]{1,64}$/;
const IMAGE_RE = /^[A-Za-z0-9_./%-]{0,300}$/;

function validCategoryId(id) {
  return typeof id === 'string' && SLUG_RE.test(id);
}

function cleanString(value, maxLen) {
  return String(value == null ? '' : value).trim().slice(0, maxLen);
}

function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => cleanString(t, 24))
    .filter(Boolean)
    .slice(0, 5);
}

function validImage(image) {
  return typeof image === 'string' && IMAGE_RE.test(image);
}

const FEATURED_GROUPS = new Set(['', 'comida', 'trago']);
const FEATURED_GROUP_LABEL = { comida: 'comidas destacadas', trago: 'tragos destacados' };

function validFeaturedGroup(group) {
  return typeof group === 'string' && FEATURED_GROUPS.has(group);
}

// The cap is enforced here (a COUNT check) rather than in the schema because
// SQLite has no clean way to express "at most 3 rows with this value".
async function checkFeaturedCapacity(env, group, excludeId) {
  if (!group) return null;
  const row = await env.DB
    .prepare('SELECT COUNT(*) AS c FROM menu_items WHERE featured_group = ? AND id != ?')
    .bind(group, excludeId || -1)
    .first();
  if (row.c >= 3) {
    return `Ya hay 3 ${FEATURED_GROUP_LABEL[group]} en la portada. Quita uno primero.`;
  }
  return null;
}

async function requireAdmin(request, env) {
  const session = await requireSession(request, env);
  if (!session) return null;
  if (request.method !== 'GET' && !hasAdminHeader(request)) return null;
  return session;
}

async function nextCategorySortOrder(db) {
  const row = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM menu_categories').first();
  return row.m + 1;
}

async function nextItemSortOrder(db, categoryId) {
  const row = await db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM menu_items WHERE category_id = ?')
    .bind(categoryId)
    .first();
  return row.m + 1;
}

async function createCategory(request, env) {
  const body = await request.json().catch(() => ({}));
  const id = cleanString(body.id, 64).toLowerCase();
  const label = cleanString(body.label, 120);
  if (!validCategoryId(id) || !label) {
    return json({ error: 'Id (minúsculas, números y guiones) y nombre son obligatorios.' }, { status: 400 });
  }
  const exists = await env.DB.prepare('SELECT id FROM menu_categories WHERE id = ?').bind(id).first();
  if (exists) return json({ error: 'Ya existe una categoría con ese id.' }, { status: 409 });

  const sortOrder = await nextCategorySortOrder(env.DB);
  await env.DB.prepare('INSERT INTO menu_categories (id, label, sort_order) VALUES (?, ?, ?)')
    .bind(id, label, sortOrder)
    .run();
  return json({ ok: true, id });
}

async function updateCategory(request, env, id) {
  const body = await request.json().catch(() => ({}));
  const label = cleanString(body.label, 120);
  if (!label) return json({ error: 'El nombre es obligatorio.' }, { status: 400 });
  const result = await env.DB.prepare('UPDATE menu_categories SET label = ? WHERE id = ?').bind(label, id).run();
  if (!result.meta.changes) return json({ error: 'Categoría no encontrada.' }, { status: 404 });
  return json({ ok: true });
}

async function deleteCategory(env, id) {
  const items = (await env.DB.prepare('SELECT image FROM menu_items WHERE category_id = ?').bind(id).all()).results;
  await env.DB.prepare('DELETE FROM menu_items WHERE category_id = ?').bind(id).run();
  const result = await env.DB.prepare('DELETE FROM menu_categories WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return json({ error: 'Categoría no encontrada.' }, { status: 404 });
  for (const item of items) await deleteManagedImage(env, item.image);
  return json({ ok: true });
}

async function moveCategory(env, id, direction) {
  const rows = (await env.DB.prepare('SELECT id, sort_order FROM menu_categories ORDER BY sort_order, id').all()).results;
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return json({ error: 'Categoría no encontrada.' }, { status: 404 });
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= rows.length) return json({ ok: true });

  const a = rows[idx];
  const b = rows[swapIdx];
  await env.DB.batch([
    env.DB.prepare('UPDATE menu_categories SET sort_order = ? WHERE id = ?').bind(b.sort_order, a.id),
    env.DB.prepare('UPDATE menu_categories SET sort_order = ? WHERE id = ?').bind(a.sort_order, b.id),
  ]);
  return json({ ok: true });
}

async function createItem(request, env) {
  const body = await request.json().catch(() => ({}));
  const categoryId = cleanString(body.categoryId, 64);
  const name = cleanString(body.name, 120);
  const description = cleanString(body.description, 2000);
  const price = cleanString(body.price, 32);
  const image = cleanString(body.image, 300);
  const tags = cleanTags(body.tags);
  const featuredGroup = cleanString(body.featuredGroup, 10);

  if (!validCategoryId(categoryId) || !name || !validImage(image) || !validFeaturedGroup(featuredGroup)) {
    return json({ error: 'Categoría, nombre e imagen son obligatorios y deben tener un formato válido.' }, { status: 400 });
  }
  const category = await env.DB.prepare('SELECT id FROM menu_categories WHERE id = ?').bind(categoryId).first();
  if (!category) return json({ error: 'La categoría no existe.' }, { status: 400 });

  const capacityError = await checkFeaturedCapacity(env, featuredGroup, null);
  if (capacityError) return json({ error: capacityError }, { status: 409 });

  const sortOrder = await nextItemSortOrder(env.DB, categoryId);
  const result = await env.DB
    .prepare('INSERT INTO menu_items (category_id, name, description, price, image, tags, sort_order, featured_group) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(categoryId, name, description, price, image, JSON.stringify(tags), sortOrder, featuredGroup)
    .run();
  return json({ ok: true, id: result.meta.last_row_id });
}

async function updateItem(request, env, id) {
  const body = await request.json().catch(() => ({}));
  const name = cleanString(body.name, 120);
  const description = cleanString(body.description, 2000);
  const price = cleanString(body.price, 32);
  const image = cleanString(body.image, 300);
  const tags = cleanTags(body.tags);
  const featuredGroup = cleanString(body.featuredGroup, 10);

  if (!name || !validImage(image) || !validFeaturedGroup(featuredGroup)) {
    return json({ error: 'Nombre e imagen son obligatorios y deben tener un formato válido.' }, { status: 400 });
  }

  const capacityError = await checkFeaturedCapacity(env, featuredGroup, id);
  if (capacityError) return json({ error: capacityError }, { status: 409 });

  const previous = await env.DB.prepare('SELECT image FROM menu_items WHERE id = ?').bind(id).first();
  const result = await env.DB
    .prepare('UPDATE menu_items SET name = ?, description = ?, price = ?, image = ?, tags = ?, featured_group = ? WHERE id = ?')
    .bind(name, description, price, image, JSON.stringify(tags), featuredGroup, id)
    .run();
  if (!result.meta.changes) return json({ error: 'Producto no encontrado.' }, { status: 404 });
  if (previous && previous.image !== image) await deleteManagedImage(env, previous.image);
  return json({ ok: true });
}

async function deleteItem(env, id) {
  const previous = await env.DB.prepare('SELECT image FROM menu_items WHERE id = ?').bind(id).first();
  const result = await env.DB.prepare('DELETE FROM menu_items WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return json({ error: 'Producto no encontrado.' }, { status: 404 });
  if (previous) await deleteManagedImage(env, previous.image);
  return json({ ok: true });
}

async function moveItem(env, id, direction) {
  const item = await env.DB.prepare('SELECT id, category_id, sort_order FROM menu_items WHERE id = ?').bind(id).first();
  if (!item) return json({ error: 'Producto no encontrado.' }, { status: 404 });

  const rows = (await env.DB
    .prepare('SELECT id, sort_order FROM menu_items WHERE category_id = ? ORDER BY sort_order, id')
    .bind(item.category_id)
    .all()).results;
  const idx = rows.findIndex((r) => r.id === item.id);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= rows.length) return json({ ok: true });

  const a = rows[idx];
  const b = rows[swapIdx];
  await env.DB.batch([
    env.DB.prepare('UPDATE menu_items SET sort_order = ? WHERE id = ?').bind(b.sort_order, a.id),
    env.DB.prepare('UPDATE menu_items SET sort_order = ? WHERE id = ?').bind(a.sort_order, b.id),
  ]);
  return json({ ok: true });
}

export async function handleMenuRoute(request, env, url) {
  const session = await requireAdmin(request, env);
  if (!session) return json({ error: 'No autenticado.' }, { status: 401 });

  const parts = url.pathname.split('/').filter(Boolean); // ['api','menu', ...]
  const sub = parts[2];

  if (!sub && request.method === 'GET') {
    return json(await getMenuForAdmin(env.DB));
  }

  if (sub === 'categories') {
    const id = parts[3];
    if (!id && request.method === 'POST') return createCategory(request, env);
    if (id && parts[4] === 'move' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      return moveCategory(env, id, body.direction === 'up' ? 'up' : 'down');
    }
    if (id && request.method === 'PUT') return updateCategory(request, env, id);
    if (id && request.method === 'DELETE') return deleteCategory(env, id);
  }

  if (sub === 'items') {
    const id = parts[3];
    if (!id && request.method === 'POST') return createItem(request, env);
    if (id && parts[4] === 'move' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      return moveItem(env, Number(id), body.direction === 'up' ? 'up' : 'down');
    }
    if (id && request.method === 'PUT') return updateItem(request, env, Number(id));
    if (id && request.method === 'DELETE') return deleteItem(env, Number(id));
  }

  return json({ error: 'No encontrado.' }, { status: 404 });
}
