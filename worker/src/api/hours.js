import { requireSession, hasAdminHeader } from '../auth.js';
import { getBusinessHours } from '../db.js';

function json(data, init) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(init && init.headers) },
  });
}

const MONTH_DAY_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function cleanSchedule(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .slice(0, 8)
    .map((line) => String(line == null ? '' : line).trim().slice(0, 120))
    .filter(Boolean);
}

export async function handleHoursRoute(request, env, url) {
  const session = await requireSession(request, env);
  if (!session) return json({ error: 'No autenticado.' }, { status: 401 });

  if (request.method === 'GET' && url.pathname === '/api/hours') {
    return json(await getBusinessHours(env.DB));
  }

  if (request.method === 'PUT' && url.pathname === '/api/hours') {
    if (!hasAdminHeader(request)) return json({ error: 'Solicitud inválida.' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const veranoStart = String(body.veranoStart || '');
    const veranoEnd = String(body.veranoEnd || '');
    const veranoSchedule = cleanSchedule(body.veranoSchedule);
    const inviernoSchedule = cleanSchedule(body.inviernoSchedule);

    if (!MONTH_DAY_RE.test(veranoStart) || !MONTH_DAY_RE.test(veranoEnd)) {
      return json({ error: 'Las fechas de temporada deben tener el formato MM-DD (ej: 10-01).' }, { status: 400 });
    }
    if (!veranoSchedule.length || !inviernoSchedule.length) {
      return json({ error: 'Agrega al menos una línea de horario para cada temporada.' }, { status: 400 });
    }

    await env.DB.prepare(
      `UPDATE business_hours SET verano_start = ?, verano_end = ?, verano_schedule = ?, invierno_schedule = ?,
         updated_at = datetime('now')
       WHERE id = 1`
    )
      .bind(veranoStart, veranoEnd, JSON.stringify(veranoSchedule), JSON.stringify(inviernoSchedule))
      .run();

    return json({ ok: true });
  }

  return json({ error: 'No encontrado.' }, { status: 404 });
}
