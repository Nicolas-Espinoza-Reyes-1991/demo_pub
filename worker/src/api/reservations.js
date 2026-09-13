import { requireSession, hasAdminHeader, checkRateLimit, recordLoginAttempt, createSessionToken, verifySessionToken } from '../auth.js';
import {
  getActiveTables,
  getTablesForAdmin,
  isDateBlocked,
  findAvailableTable,
  insertReservation,
  getReservationById,
  getTablesWithAvailability,
  confirmReservationTable,
  getReservationsForAdmin,
  getBlockedDates,
} from '../db.js';
import { sendEmail, customerConfirmationEmailHtml, ownerNotificationEmailHtml } from '../email.js';

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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// How long a "confirm your attendance" email link stays valid. Baked into
// the signed token itself (see below), not stored in the DB — an expired
// token is rejected purely on its own signature/exp, no lookup needed. The
// daily cron (see index.js scheduled()) separately cancels the reservation
// row once it's been unconfirmed this long, so the two stay in sync.
const CONFIRM_TOKEN_TTL_HOURS = 48;

async function createConfirmToken(env, reservationId) {
  return createSessionToken(env.SESSION_SECRET, {
    p: 'resv_confirm', // distinguishes this from an admin session token
    rid: reservationId,
    exp: Date.now() + CONFIRM_TOKEN_TTL_HOURS * 60 * 60 * 1000,
  });
}

async function verifyConfirmToken(env, token) {
  const payload = await verifySessionToken(env.SESSION_SECRET, token);
  if (!payload || payload.p !== 'resv_confirm' || !Number.isInteger(payload.rid)) return null;
  return payload.rid;
}

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
  const email = cleanString(body.email, 200).toLowerCase();
  const date = cleanString(body.date, 10);
  const arrivalTime = cleanString(body.arrivalTime, 5);
  const notes = cleanString(body.notes, 300);
  const partySize = Number.parseInt(body.partySize, 10);

  if (!name) return json({ error: 'Cuéntanos tu nombre.' }, { status: 400 });
  if (!PHONE_RE.test(phone)) return json({ error: 'Ingresa un teléfono válido.' }, { status: 400 });
  if (!EMAIL_RE.test(email)) return json({ error: 'Ingresa un correo válido — lo necesitamos para confirmar tu asistencia.' }, { status: 400 });
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

  // Just a feasibility check here — no table is actually held yet. The
  // customer picks their own table visually after confirming by email (see
  // handleConfirmGet/Post below), so there's nothing to race against at this
  // step: table_id stays NULL until confirmation.
  const someTableFits = await findAvailableTable(env.DB, date, partySize);
  if (!someTableFits) {
    await recordLoginAttempt(env, rateLimitKey);
    return json({
      error: 'No tenemos mesas disponibles para esa fecha y ese grupo. Escríbenos y te ayudamos a coordinar.',
      fallbackWhatsapp: true,
    }, { status: 409 });
  }

  const id = await insertReservation(env.DB, { name, phone, email, partySize, date, arrivalTime, notes });

  const confirmUrl = `${new URL(request.url).origin}/confirmar.html?token=${await createConfirmToken(env, id)}`;
  const [customerEmailOk] = await Promise.all([
    sendEmail(env, {
      to: email,
      subject: 'Confirma tu asistencia — After Office Futrono',
      html: customerConfirmationEmailHtml({ name, date, partySize, confirmUrl }),
    }),
    env.OWNER_EMAIL
      ? sendEmail(env, {
          to: env.OWNER_EMAIL,
          subject: `Nueva reserva pendiente — ${name} (${partySize} personas, ${date})`,
          html: ownerNotificationEmailHtml({ name, phone, email, date, partySize, notes }),
        })
      : Promise.resolve(false),
  ]);

  return json({
    ok: true,
    id,
    emailSent: customerEmailOk,
    message: customerEmailOk
      ? 'Solicitud recibida. Revisa tu correo para confirmar tu asistencia y elegir tu mesa.'
      : 'Solicitud recibida, pero no pudimos enviarte el correo de confirmación. Escríbenos por WhatsApp para coordinar tu mesa.',
  });
}

async function handleConfirmGet(env, token) {
  const reservationId = await verifyConfirmToken(env, token);
  if (!reservationId) return json({ error: 'Este enlace no es válido o ya expiró.' }, { status: 400 });

  const reservation = await getReservationById(env.DB, reservationId);
  if (!reservation) return json({ error: 'No encontramos esa reserva.' }, { status: 404 });

  if (reservation.status !== 'pendiente' || reservation.table_id != null) {
    return json({
      error: reservation.status === 'cancelada'
        ? 'Esta reserva ya no está vigente (fue cancelada).'
        : 'Esta reserva ya fue confirmada anteriormente.',
    }, { status: 409 });
  }

  if (await isDateBlocked(env.DB, reservation.reservation_date)) {
    return json({ error: 'Esa fecha ya no está disponible. Escríbenos por WhatsApp y vemos otra fecha.', fallbackWhatsapp: true }, { status: 409 });
  }

  const tables = await getTablesWithAvailability(env.DB, reservation.reservation_date, reservation.id);
  return json({
    name: reservation.customer_name,
    date: reservation.reservation_date,
    partySize: reservation.party_size,
    tables,
  });
}

async function handleConfirmPost(env, token, rawTableId, request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `resvconfirm:${ip}`;
  if (!(await checkRateLimit(env, rateLimitKey))) {
    return json({ error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' }, { status: 429 });
  }

  const reservationId = await verifyConfirmToken(env, token);
  if (!reservationId) return json({ error: 'Este enlace no es válido o ya expiró.' }, { status: 400 });

  const tableId = Number.parseInt(rawTableId, 10);
  if (!Number.isInteger(tableId)) return json({ error: 'Elige una mesa.' }, { status: 400 });

  const reservation = await getReservationById(env.DB, reservationId);
  if (!reservation) return json({ error: 'No encontramos esa reserva.' }, { status: 404 });
  if (reservation.status !== 'pendiente' || reservation.table_id != null) {
    await recordLoginAttempt(env, rateLimitKey);
    return json({ error: 'Esta reserva ya fue confirmada o cancelada.' }, { status: 409 });
  }
  if (await isDateBlocked(env.DB, reservation.reservation_date)) {
    return json({ error: 'Esa fecha ya no está disponible. Escríbenos por WhatsApp y vemos otra fecha.', fallbackWhatsapp: true }, { status: 409 });
  }

  const table = await env.DB.prepare('SELECT id, name, capacity FROM venue_tables WHERE id = ? AND active = 1').bind(tableId).first();
  if (!table) {
    await recordLoginAttempt(env, rateLimitKey);
    return json({ error: 'Esa mesa ya no está disponible. Elige otra.' }, { status: 409 });
  }
  if (table.capacity < reservation.party_size) {
    return json({ error: `Esa mesa es para hasta ${table.capacity} personas y ustedes son ${reservation.party_size}. Elige una mesa más grande.` }, { status: 400 });
  }

  let result;
  try {
    result = await confirmReservationTable(env.DB, reservationId, tableId);
  } catch (err) {
    if (String(err && err.message).includes('UNIQUE')) {
      return json({ error: 'Justo alguien más tomó esa mesa. Elige otra de las disponibles.' }, { status: 409 });
    }
    throw err;
  }
  if (!result.meta.changes) {
    return json({ error: 'Esta reserva ya fue confirmada o cancelada.' }, { status: 409 });
  }

  return json({ ok: true, tableName: table.name });
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
  let result;
  try {
    result = await env.DB.prepare('DELETE FROM venue_tables WHERE id = ?').bind(id).run();
  } catch (err) {
    if (String(err && err.message).includes('FOREIGN KEY')) {
      return json({ error: 'No se puede eliminar: esta mesa tiene reservas asociadas. Desactívala en vez de eliminarla, o borra primero sus reservas.' }, { status: 409 });
    }
    throw err;
  }
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

  // "confirmada" is only meaningful once a table is assigned -- and the
  // only place that assigns one is the customer's own confirm link
  // (handleConfirmPost above, which sets table_id and status together in
  // the same UPDATE). Allowing an admin to jump status to "confirmada" by
  // itself leaves table_id NULL, which then makes that customer's own
  // confirm link permanently fail ("ya fue confirmada anteriormente") even
  // though they never actually picked a table.
  if (status === 'confirmada') {
    const current = await env.DB.prepare('SELECT table_id FROM reservations WHERE id = ?').bind(id).first();
    if (!current) return json({ error: 'Reserva no encontrada.' }, { status: 404 });
    if (current.table_id == null) {
      return json({ error: 'No se puede confirmar sin una mesa asignada. El cliente debe elegirla desde el enlace de su correo.' }, { status: 409 });
    }
  }

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

  // Public: gated by the signed, expiring token from the confirmation email
  // (see createConfirmToken above) instead of an admin session.
  if (sub === 'confirm') {
    if (request.method === 'GET') {
      const token = url.searchParams.get('token');
      if (!token) return json({ error: 'Falta el token de confirmación.' }, { status: 400 });
      return handleConfirmGet(env, token);
    }
    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!body.token) return json({ error: 'Falta el token de confirmación.' }, { status: 400 });
      return handleConfirmPost(env, body.token, body.tableId, request);
    }
  }

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
