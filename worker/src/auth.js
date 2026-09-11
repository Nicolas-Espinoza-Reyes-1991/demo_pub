// Cloudflare Workers' WebCrypto rejects PBKDF2 above 100,000 iterations
// (throws NotSupportedError) even though it runs fine in local dev — this is
// the platform ceiling, not a stylistic choice.
const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function toBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function timingSafeEqualBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function timingSafeEqualStr(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqualBytes(ab, bb);
}

async function pbkdf2(password, salt, iterations, keyLenBytes) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    keyLenBytes * 8
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS, KEY_BYTES);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(password, stored) {
  try {
    const parts = stored.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
    const iterations = parseInt(parts[1], 10);
    const salt = fromBase64Url(parts[2]);
    const expected = fromBase64Url(parts[3]);
    const actual = await pbkdf2(password, salt, iterations, expected.length);
    return timingSafeEqualBytes(actual, expected);
  } catch {
    return false;
  }
}

// Runs a PBKDF2 computation with the same cost as a real check, so that
// "user not found" and "wrong password" take the same amount of time.
export async function dummyVerify(password) {
  const salt = new Uint8Array(SALT_BYTES);
  await pbkdf2(password, salt, PBKDF2_ITERATIONS, KEY_BYTES);
  return false;
}

async function hmacSign(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return toBase64Url(new Uint8Array(sig));
}

export async function createSessionToken(secret, payload) {
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmacSign(secret, body);
  return `${body}.${sig}`;
}

export async function verifySessionToken(secret, token) {
  if (!token || token.indexOf('.') === -1) return null;
  const [body, sig] = token.split('.');
  const expectedSig = await hmacSign(secret, body);
  if (!timingSafeEqualStr(sig, expectedSig)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function newSessionExpiry() {
  return Date.now() + SESSION_TTL_MS;
}

export function sessionCookie(token, maxAgeSeconds) {
  return `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie() {
  return 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
}

export function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return match ? match[1] : null;
}

// Verifies the session cookie AND checks token_version against the DB row,
// so changing a password immediately invalidates every other session.
export async function requireSession(request, env) {
  const token = readCookie(request, 'session');
  const payload = await verifySessionToken(env.SESSION_SECRET, token);
  if (!payload || !payload.uid) return null;

  const user = await env.DB.prepare('SELECT id, username, token_version FROM admin_users WHERE id = ?')
    .bind(payload.uid)
    .first();
  if (!user) return null;
  if (user.token_version !== payload.tv) return null;

  return { id: user.id, username: user.username };
}

// CSRF mitigation: state-changing requests must carry this header. A cross-site
// form post cannot set custom headers without triggering a CORS preflight,
// which this API never allows, so this blocks cross-site writes even though
// the SameSite=Strict cookie already stops most of them.
export function hasAdminHeader(request) {
  return request.headers.get('X-Admin-Request') === '1';
}

const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

export async function checkRateLimit(env, key) {
  const raw = await env.RATE_LIMIT.get(key);
  const count = raw ? parseInt(raw, 10) : 0;
  return count < RATE_LIMIT_MAX_ATTEMPTS;
}

export async function recordLoginAttempt(env, key) {
  const raw = await env.RATE_LIMIT.get(key);
  const count = raw ? parseInt(raw, 10) : 0;
  await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS });
}

export async function clearRateLimit(env, key) {
  await env.RATE_LIMIT.delete(key);
}
