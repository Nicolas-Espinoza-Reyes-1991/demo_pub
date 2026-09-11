import {
  verifyPassword,
  dummyVerify,
  hashPassword,
  createSessionToken,
  newSessionExpiry,
  sessionCookie,
  clearSessionCookie,
  requireSession,
  hasAdminHeader,
  checkRateLimit,
  recordLoginAttempt,
  clearRateLimit,
} from '../auth.js';
import { getUserByUsername, updatePassword } from '../db.js';

function json(data, init) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(init && init.headers) },
  });
}

const GENERIC_LOGIN_ERROR = 'Usuario o contraseña incorrectos.';

async function handleLogin(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const username = String(body.username || '').trim().slice(0, 64);
  const password = String(body.password || '').slice(0, 256);
  if (!username || !password) {
    return json({ error: GENERIC_LOGIN_ERROR }, { status: 400 });
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `login:${ip}:${username.toLowerCase()}`;

  const allowed = await checkRateLimit(env, rateLimitKey);
  if (!allowed) {
    return json({ error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' }, { status: 429 });
  }

  const user = await getUserByUsername(env.DB, username);

  let ok;
  if (user) {
    ok = await verifyPassword(password, user.password_hash);
  } else {
    ok = await dummyVerify(password);
  }

  if (!ok) {
    await recordLoginAttempt(env, rateLimitKey);
    return json({ error: GENERIC_LOGIN_ERROR }, { status: 401 });
  }

  await clearRateLimit(env, rateLimitKey);

  const token = await createSessionToken(env.SESSION_SECRET, {
    uid: user.id,
    tv: user.token_version,
    exp: newSessionExpiry(),
  });

  return json({ ok: true, username: user.username }, {
    headers: { 'Set-Cookie': sessionCookie(token, 8 * 60 * 60) },
  });
}

async function handleLogout() {
  return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie() } });
}

async function handleMe(request, env) {
  const session = await requireSession(request, env);
  if (!session) return json({ error: 'No autenticado.' }, { status: 401 });
  return json({ username: session.username });
}

async function handleChangePassword(request, env) {
  const session = await requireSession(request, env);
  if (!session) return json({ error: 'No autenticado.' }, { status: 401 });
  if (!hasAdminHeader(request)) return json({ error: 'Solicitud inválida.' }, { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const currentPassword = String(body.currentPassword || '');
  const newPassword = String(body.newPassword || '');
  if (newPassword.length < 10) {
    return json({ error: 'La nueva contraseña debe tener al menos 10 caracteres.' }, { status: 400 });
  }

  const user = await env.DB.prepare('SELECT id, password_hash FROM admin_users WHERE id = ?')
    .bind(session.id)
    .first();
  const ok = await verifyPassword(currentPassword, user.password_hash);
  if (!ok) return json({ error: 'La contraseña actual no es correcta.' }, { status: 401 });

  const newHash = await hashPassword(newPassword);
  await updatePassword(env.DB, session.id, newHash);

  return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie() } });
}

export async function handleAuthRoute(request, env, url) {
  if (url.pathname === '/api/auth/login' && request.method === 'POST') return handleLogin(request, env);
  if (url.pathname === '/api/auth/logout' && request.method === 'POST') return handleLogout();
  if (url.pathname === '/api/auth/me' && request.method === 'GET') return handleMe(request, env);
  if (url.pathname === '/api/auth/change-password' && request.method === 'POST') return handleChangePassword(request, env);
  return json({ error: 'No encontrado.' }, { status: 404 });
}
