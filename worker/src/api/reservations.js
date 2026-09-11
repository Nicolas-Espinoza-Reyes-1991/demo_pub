import { requireSession, hasAdminHeader, checkRateLimit, recordLoginAttempt } from '../auth.js';
import {
  getActiveTables,
  getTablesForAdmin,
  isDateBlocked,
  findAvailableTable,
  insertReservation,
  getReservationsForAdmin,
  getBlockedDates,
} from '../db.js';

function json(data, init) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(init && init.headers) },
  });
}

function cleanString(value, maxLen) {
  return String(value == null ? '' : value).trim().slice(0, maxLen);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE_RE = /^[0-9+\s()-]{6,20}$/;

// The venue is closed Mondays and Sundays (see nosotros.html / index.html
// copy) — kept as a constant here rather than an admin-editable setting
// since that wasn't part of what was scoped/approved.
const CLOSED_WEEKDAYS = new Set([0, 1]); // 0 = Sunday, 1 = Monday

function todayInSantiago() {
  // Workers run in UTC; a naive `new Date()` comparison could reject/accept
  // a date incorrectly around midnight Chile time. Format "now" directly in
  // the venue's timezone instead.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}`;
}

function weekdayOf(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function handleCreateReservation(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `resv:${ip}`;
  const allowed = await checkRateLimit(env, rateLimitKey);
  if (!allowed) {
    return json({ error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos, o escríbenos directamente.', fallbackWhatsapp: true }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const name = cleanString(body.name, 120);
  const phone = cleanString(body.phone, 20);
  const date = cleanString(body.date, 10);
  const arrivalTime = cleanString(body.arrivalTime, 5);
  const notes = cleanString(body.notes, 300);
  const partySize = Number.parseInt(body.partySize, 10);

  if (!name) return json({ error: 'Cuéntanos tu nombre.' }, { status: 400 });
  if (!PHONE_RE.test(phone)) return json({ error: 'Ingresa un teléfono válido.' }, { status: 400 });
  if (!DATE_RE.test(date)) return json({ error: 'Ingresa una fecha válida.' }, { status: 400 });
  if (arrivalTime && !TIME_RE.test(arrivalTime)) return json({ error: 'Hora de llegada inválida.' }, { status: 400 });
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 60) {
    return json({ error: 'Ingresa la cantidad de personas.' }, { status: 400 });
  }

  // Same-day booking is rejected on purpose: a table confirmed minutes
  // before service starts leaves no time for staff to know it's taken, so it
  // can get handed to a walk-in and the reservation lost. One full day of
  // lead time is the minimum for the table to actually be held.
  const minDate = addDays(todayInSantiago(), 1);
  if (date < minDate) {
    return json({ error: 'Las reservas deben hacerse con al menos 1 día de anticipación.' }, { status: 400 });
  }
  if (CLOSED_WEEKDAYS.has(weekdayOf(date))) {
    return json({ error: 'Los lunes y domingos permanecemos cerrados. Elige otro día.' }, { status: 400 });
  }

  if (await isDateBlocked(env.DB, date)) {
    await recordLoginAttempt(env, rateLimitKey);
    return json({
      error: 'Esa fecha no está disponible para reservas (evento privado). Escríbenos y vemos otra fecha.',
      fallbackWhatsapp: true,
    }, { status: 409 });
  }

  // Try a few times in case of a genuine race with another reservation
  // landing on the same table between the SELECT and the INSERT — the
  // UNIQUE index in the schema is what actually guarantees no double-booking;
  // this loop just gives a concurrent request a graceful second attempt
  // instead of a raw DB-constraint error.
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const table = await findAvailableTable(env.DB, date, partySize);
    if (!table) {
      await recordLoginAttempt(env, rateLimitKey);
      return json({
        error: 'No tenemos mesas disponibles para esa fecha y ese grupo. Escríbenos y te ayudamos a coordinar.',
        fallbackWhatsapp: true,
      }, { status: 409 });
    }
    try {
      const id = await insertReservation(env.DB, { tableId: table.id, name, phone, partySize, date, arrivalTime, notes });
      return json({ ok: true, id, tableName: table.name });
    } catch (err) {
      lastError = err;
      // UNIQUE constraint race: another request just took this table. Loop
      // and pick the next available one.
    }
  }

  console.error('Reservation insert failed after retries', lastError);
  return json({
    error: 'No pudimos confirmar la reserva justo ahora. Escríbenos directamente.',
    fallbackWhatsapp: true,
  }, { status: 500 });
}

async function requireAdmin(request, env) {
  const session = await requireSession(request, env);
  if (!session) return null;
  if (request.method !== 'GET' && !hasAdminHeader(request)) return null;
  return session;
}

async function handleListTables(env) {
  return json({ tables: await getTablesForAdmin(env.DB) });
}

async function handleCreateTable(request, env) {
  const body = await request.json().catch(() => ({}));
  const name = cleanString(body.name, 60);
  const capacity = Number.parseInt(body.capacity, 10);
  if (!name || !Number.isInteger(capacity) || capacity < 1 || capacity > 60) {
    return json({ error: 'Nombre y capacidad (número) son obligatorios.' }, { status: 400 });
  }
  const row = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM venue_tables').first();
  const result = await env.DB
    .prepare('INSERT INTO venue_tables (name, capacity, sort_order) VALUES (?, ?, ?)')
    .bind(name, capacity, row.m + 1)
    .run();
  return json({ ok: true, id: result.meta.last_row_id });
}

async function handleUpdateTable(request, env, id) {
  const body = await request.json().catch(() => ({}));
  const name = cleanString(body.name, 60);
  const capacity = Number.parseInt(body.capacity, 10);
  const active = body.active ? 1 : 0;
  if (!name || !Number.isInteger(capacity) || capacity < 1 || capacity > 60) {
    return json({ error: 'Nombre y capacidad (número) son obligatorios.' }, { status: 400 });
  }
  const result = await env.DB
    .prepare('UPDATE venue_tables SET name = ?, capacity = ?, active = ? WHERE id = ?')
    .bind(name, capacity, active, id)
    .run();
  if (!result.meta.changes) return json({ error: 'Mesa no encontrada.' }, { status: 404 });
  return json({ ok: true });
}

async function handleDeleteTable(env, id) {
  const result = await env.DB.prepare('DELETE FROM venue_tables WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return json({ error: 'Mesa no encontrada.' }, { status: 404 });
  return json({ ok: true });
}

async function handleListReservations(request, env, url) {
  const date = url.searchParams.get('date');
  if (date && !DATE_RE.test(date)) return json({ error: 'Fecha inválida.' }, { status: 400 });
  return json({ reservations: await getReservationsForAdmin(env.DB, date || null) });
}

const RESERVATION_STATUSES = new Set(['pendiente', 'confirmada', 'no_show', 'cancelada']);

async function handleUpdateReservationStatus(request, env, id) {
  const body = await request.json().catch(() => ({}));
  const status = cleanString(body.status, 20);
  if (!RESERVATION_STATUSES.has(status)) return json({ error: 'Estado inválido.' }, { status: 400 });
  const result = await env.DB.prepare('UPDATE reservations SET status = ? WHERE id = ?').bind(status, id).run();
  if (!result.meta.changes) return json({ error: 'Reserva no encontrada.' }, { status: 404 });
  return json({ ok: true });
}

async function handleDeleteReservation(env, id) {
  const result = await env.DB.prepare('DELETE FROM reservations WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return json({ error: 'Reserva no encontrada.' }, { status: 404 });
  return json({ ok: true });
}

async function handleListBlocks(env) {
  return json({ blocks: await getBlockedDates(env.DB) });
}

async function handleCreateBlock(request, env) {
  const body = await request.json().catch(() => ({}));
  const date = cleanString(body.date, 10);
  const reason = cleanString(body.reason, 200);
  if (!DATE_RE.test(date)) return json({ error: 'Fecha inválida.' }, { status: 400 });
  const existing = await env.DB.prepare('SELECT id FROM blocked_dates WHERE blocked_date = ?').bind(date).first();
  if (existing) return json({ error: 'Esa fecha ya está bloqueada.' }, { status: 409 });
  const result = await env.DB
    .prepare('INSERT INTO blocked_dates (blocked_date, reason) VALUES (?, ?)')
    .bind(date, reason)
    .run();
  return json({ ok: true, id: result.meta.last_row_id });
}

async function handleDeleteBlock(env, id) {
  const result = await env.DB.prepare('DELETE FROM blocked_dates WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return json({ error: 'Bloqueo no encontrado.' }, { status: 404 });
  return json({ ok: true });
}

export async function handleReservationsRoute(request, env, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', 'reservations', ...]
  const sub = parts[2];

  // Public: anyone can submit a reservation request, no session needed.
  if (!sub && request.method === 'POST') return handleCreateReservation(request, env);

  // Everything else is admin-only.
  const session = await requireAdmin(request, env);
  if (!session) return json({ error: 'No autenticado.' }, { status: 401 });

  if (!sub && request.method === 'GET') return handleListReservations(request, env, url);

  if (sub === 'tables') {
    const id = parts[3];
    if (!id && request.method === 'GET') return handleListTables(env);
    if (!id && request.method === 'POST') return handleCreateTable(request, env);
    if (id && request.method === 'PUT') return handleUpdateTable(request, env, Number(id));
    if (id && request.method === 'DELETE') return handleDeleteTable(env, Number(id));
  }

  if (sub === 'blocks') {
    const id = parts[3];
    if (!id && request.method === 'GET') return handleListBlocks(env);
    if (!id && request.method === 'POST') return handleCreateBlock(request, env);
    if (id && request.method === 'DELETE') return handleDeleteBlock(env, Number(id));
  }

  if (sub && /^\d+$/.test(sub)) {
    const id = Number(sub);
    if (request.method === 'PUT') return handleUpdateReservationStatus(request, env, id);
    if (request.method === 'DELETE') return handleDeleteReservation(env, id);
  }

  return json({ error: 'No encontrado.' }, { status: 404 });
}
