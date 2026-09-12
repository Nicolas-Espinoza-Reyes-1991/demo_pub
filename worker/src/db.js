function toPublicItem(row) {
  return {
    id: row.id,
    name: row.name,
    desc: row.description,
    price: row.price,
    img: row.image,
    tags: JSON.parse(row.tags || '[]'),
  };
}

export async function getMenu(db) {
  const { results: categories } = await db
    .prepare('SELECT id, label, sort_order FROM menu_categories ORDER BY sort_order, id')
    .all();
  const { results: items } = await db
    .prepare('SELECT id, category_id, name, description, price, image, tags, sort_order FROM menu_items ORDER BY category_id, sort_order, id')
    .all();

  const itemsByCategory = {};
  for (const row of items) {
    if (!itemsByCategory[row.category_id]) itemsByCategory[row.category_id] = [];
    itemsByCategory[row.category_id].push(toPublicItem(row));
  }

  return {
    tabs: categories.map((c) => ({ id: c.id, label: c.label })),
    items: itemsByCategory,
  };
}

export async function getMenuForAdmin(db) {
  const { results: categories } = await db
    .prepare('SELECT id, label, sort_order FROM menu_categories ORDER BY sort_order, id')
    .all();
  const { results: items } = await db
    .prepare('SELECT id, category_id, name, description, price, image, tags, sort_order, featured_group FROM menu_items ORDER BY category_id, sort_order, id')
    .all();
  return {
    categories,
    items: items.map((row) => ({
      ...toPublicItem(row),
      categoryId: row.category_id,
      sortOrder: row.sort_order,
      featuredGroup: row.featured_group,
    })),
  };
}

// Feeds the landing page's "Comida & tragos" preview — up to 3 hand-picked
// items per group, chosen by the admin from any category (not tied to which
// menu category the item lives in).
export async function getFeaturedItems(db) {
  const { results } = await db
    .prepare(
      `SELECT mi.id, mi.name, mi.description, mi.price, mi.image, mi.featured_group, mc.label AS category_label
       FROM menu_items mi
       JOIN menu_categories mc ON mc.id = mi.category_id
       WHERE mi.featured_group IN ('comida', 'trago')
       ORDER BY mi.featured_group, mi.id`
    )
    .all();

  const grouped = { comida: [], trago: [] };
  for (const row of results) {
    grouped[row.featured_group].push({
      id: row.id,
      name: row.name,
      desc: row.description,
      price: row.price,
      img: row.image,
      tag: row.category_label,
    });
  }
  return grouped;
}

export function popupRowToJson(row) {
  if (!row) return null;
  return {
    enabled: !!row.enabled,
    badge: row.badge,
    eyebrow: row.eyebrow,
    title: row.title,
    image: row.image,
    facts: JSON.parse(row.facts || '[]'),
    ctaPrimaryLabel: row.cta_primary_label,
    ctaPrimaryHref: row.cta_primary_href,
    ctaSecondaryLabel: row.cta_secondary_label,
    ctaSecondaryHref: row.cta_secondary_href,
  };
}

export async function getPopup(db) {
  const row = await db.prepare('SELECT * FROM popup_config WHERE id = 1').first();
  return popupRowToJson(row);
}

export function hoursRowToJson(row) {
  if (!row) return null;
  return {
    veranoStart: row.verano_start,
    veranoEnd: row.verano_end,
    veranoSchedule: JSON.parse(row.verano_schedule || '[]'),
    inviernoSchedule: JSON.parse(row.invierno_schedule || '[]'),
  };
}

export async function getBusinessHours(db) {
  const row = await db.prepare('SELECT * FROM business_hours WHERE id = 1').first();
  return hoursRowToJson(row);
}

export async function getUserByUsername(db, username) {
  return db.prepare('SELECT id, username, password_hash, token_version FROM admin_users WHERE username = ?')
    .bind(username)
    .first();
}

export async function getUserById(db, id) {
  return db.prepare('SELECT id, username, token_version FROM admin_users WHERE id = ?').bind(id).first();
}

export async function bumpTokenVersion(db, userId) {
  await db.prepare('UPDATE admin_users SET token_version = token_version + 1 WHERE id = ?').bind(userId).run();
}

export async function updatePassword(db, userId, passwordHash) {
  await db.prepare('UPDATE admin_users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?')
    .bind(passwordHash, userId)
    .run();
}

// ---------- Reservations ----------

export async function getActiveTables(db) {
  const { results } = await db
    .prepare('SELECT id, name, capacity FROM venue_tables WHERE active = 1 ORDER BY sort_order, id')
    .all();
  return results;
}

export async function getTablesForAdmin(db) {
  const { results } = await db
    .prepare('SELECT id, name, capacity, active, sort_order FROM venue_tables ORDER BY sort_order, id')
    .all();
  return results;
}

export async function isDateBlocked(db, date) {
  const row = await db.prepare('SELECT id FROM blocked_dates WHERE blocked_date = ?').bind(date).first();
  return !!row;
}

// Smallest active table that both fits the party and is free on that date.
// Picking the smallest sufficient table (not the biggest) leaves the larger
// tables free for larger groups that come along later.
export async function findAvailableTable(db, date, partySize) {
  return db
    .prepare(
      `SELECT id, name, capacity FROM venue_tables
       WHERE active = 1 AND capacity >= ?
         AND id NOT IN (
           SELECT table_id FROM reservations
           WHERE reservation_date = ? AND status IN ('pendiente', 'confirmada')
         )
       ORDER BY capacity ASC, id ASC
       LIMIT 1`
    )
    .bind(partySize, date)
    .first();
}

export async function insertReservation(db, { tableId, name, phone, partySize, date, arrivalTime, notes }) {
  const result = await db
    .prepare(
      `INSERT INTO reservations (table_id, customer_name, phone, party_size, reservation_date, arrival_time, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(tableId, name, phone, partySize, date, arrivalTime, notes)
    .run();
  return result.meta.last_row_id;
}

export async function getReservationsForAdmin(db, date) {
  const query = date
    ? db.prepare(
        `SELECT r.id, r.customer_name, r.phone, r.party_size, r.reservation_date, r.arrival_time, r.notes,
                r.status, r.created_at, t.id AS table_id, t.name AS table_name
         FROM reservations r LEFT JOIN venue_tables t ON t.id = r.table_id
         WHERE r.reservation_date = ?
         ORDER BY r.created_at DESC`
      ).bind(date)
    : db.prepare(
        `SELECT r.id, r.customer_name, r.phone, r.party_size, r.reservation_date, r.arrival_time, r.notes,
                r.status, r.created_at, t.id AS table_id, t.name AS table_name
         FROM reservations r LEFT JOIN venue_tables t ON t.id = r.table_id
         ORDER BY r.reservation_date DESC, r.created_at DESC
         LIMIT 200`
      );
  const { results } = await query.all();
  return results;
}

export async function getBlockedDates(db) {
  const { results } = await db
    .prepare("SELECT id, blocked_date, reason FROM blocked_dates WHERE blocked_date >= date('now') ORDER BY blocked_date")
    .all();
  return results;
}
