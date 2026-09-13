// Sends transactional email through Resend's HTTP API. Cloudflare Workers
// can't open outbound SMTP connections, so a fetch-based provider is the
// only option; Resend was picked for its free tier (no card required).
// Never throws — a failed send shouldn't roll back a reservation that was
// already written to D1, so callers just get a boolean back and decide what
// (if anything) to tell the customer.
export async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY) {
    console.error('sendEmail: RESEND_API_KEY is not set, skipping send.');
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, html }),
    });
    if (!res.ok) {
      console.error('sendEmail: Resend responded', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.error('sendEmail: request failed', err);
    return false;
  }
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Dark, matching the site — but a first version of this (bare <div>
// fragment, no <head> at all) got silently rewritten by Gmail's app: with no
// color-scheme declared, it decided the recipient's device wanted a light
// mail and flattened our dark background to white. It couldn't recolor the
// logo image, though, so a white-on-transparent logo went invisible on the
// new white background. The fix isn't switching to a light design — it's
// telling clients up front, explicitly, "this is dark on purpose, don't
// touch it": a full <html> document (not a fragment), `color-scheme` +
// `supported-color-scheme` metas set to dark only, and every background
// declared BOTH as a `bgcolor` attribute and inline CSS (some clients honor
// one but not the other) so nothing is left for a client to "improve".
function emailDocument(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
<meta name="supported-color-scheme" content="dark">
<style>
  body, .ao-bg { background-color:#0a0a0f !important; }
  .ao-card { background-color:#141318 !important; }
  .ao-text { color:#f5f5f4 !important; }
  .ao-muted { color:#9c9aa5 !important; }
  @media (prefers-color-scheme: light) {
    body, .ao-bg { background-color:#0a0a0f !important; }
    .ao-card { background-color:#141318 !important; }
    .ao-text { color:#f5f5f4 !important; }
    .ao-muted { color:#9c9aa5 !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#0a0a0f;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0f" class="ao-bg" style="background-color:#0a0a0f;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" bgcolor="#141318" class="ao-card" style="width:480px; max-width:100%; background-color:#141318; border:1px solid rgba(255,255,255,0.08); border-radius:16px;">
<tr><td style="padding:32px 28px; font-family:Arial,Helvetica,sans-serif;">
${bodyHtml}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const EMAIL_LOGO = `<div style="text-align:center; margin:0 0 28px;">
  <img src="https://afterofficefutrono.cl/imagenes_sitio/logo-after-office-email-color.png" width="80" alt="After Office Futrono" style="display:inline-block; width:80px; height:auto; border:0;">
</div>`;

const EMAIL_SEP = `<span class="ao-muted" style="color:#5b5a60;"> &middot; </span>`;

const EMAIL_FOOTER = `<div style="margin-top:28px; padding-top:20px; border-top:1px solid rgba(255,255,255,0.08); text-align:center;">
  <p class="ao-muted" style="font-size:12px; line-height:1.6; color:#9c9aa5; margin:0 0 6px;">Gaston Guarda Parades 54, Futrono, Los Ríos</p>
  <p style="font-size:12px; margin:0;">
    <a href="https://wa.me/56993015918" style="color:#22d3ee; text-decoration:none; font-weight:bold;">WhatsApp</a>${EMAIL_SEP}
    <a href="https://www.instagram.com/afterofficefutrono" style="color:#d946ef; text-decoration:none; font-weight:bold;">Instagram</a>${EMAIL_SEP}
    <a href="https://web.facebook.com/verano.futrono.2025" style="color:#22d3ee; text-decoration:none; font-weight:bold;">Facebook</a>${EMAIL_SEP}
    <a href="https://www.tiktok.com/@after.office.rest" style="color:#d946ef; text-decoration:none; font-weight:bold;">TikTok</a>
  </p>
</div>`;

export function customerConfirmationEmailHtml({ name, date, partySize, confirmUrl }) {
  return emailDocument(`${EMAIL_LOGO}
    <h1 class="ao-text" style="font-size:20px; margin:0 0 16px; color:#f5f5f4; text-align:center;">¡Hola, ${escapeHtml(name)}!</h1>
    <p class="ao-text" style="font-size:15px; line-height:1.6; color:#f5f5f4; margin:0 0 8px;">Recibimos tu solicitud de reserva para <strong>${escapeHtml(String(partySize))} personas</strong> el <strong>${escapeHtml(date)}</strong>.</p>
    <p class="ao-text" style="font-size:15px; line-height:1.6; color:#f5f5f4; margin:0 0 24px;">Para dejarla lista, confirma tu asistencia y elige tu mesa favorita en el siguiente enlace:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:0 0 24px;">
      <a href="${confirmUrl}" style="display:inline-block; background-color:#22d3ee; background-image:linear-gradient(135deg,#22d3ee,#d946ef); color:#05050a; font-weight:bold; text-decoration:none; padding:14px 28px; border-radius:10px; font-size:15px;">Confirmar asistencia y elegir mesa</a>
    </td></tr></table>
    <p class="ao-muted" style="font-size:13px; line-height:1.6; color:#9c9aa5; margin:0;">Este enlace es personal y expira en 48 horas. Si no confirmas dentro de ese plazo, la solicitud se cancela automáticamente para liberar el cupo.</p>
    <p class="ao-muted" style="font-size:13px; line-height:1.6; color:#9c9aa5; margin:12px 0 0;">¿Dudas o cambios de última hora? Escríbenos por WhatsApp, abajo.</p>
    ${EMAIL_FOOTER}`);
}

export function ownerNotificationEmailHtml({ name, phone, email, date, partySize, notes }) {
  return emailDocument(`${EMAIL_LOGO}
    <h1 class="ao-text" style="font-size:18px; margin:0 0 16px; color:#f5f5f4; text-align:center;">Nueva solicitud de reserva</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ao-text" style="font-size:14px; color:#f5f5f4;">
      <tr><td class="ao-muted" style="padding:6px 0; color:#9c9aa5;">Nombre</td><td style="padding:6px 0; text-align:right;">${escapeHtml(name)}</td></tr>
      <tr><td class="ao-muted" style="padding:6px 0; color:#9c9aa5;">Teléfono</td><td style="padding:6px 0; text-align:right;">${escapeHtml(phone)}</td></tr>
      <tr><td class="ao-muted" style="padding:6px 0; color:#9c9aa5;">Correo</td><td style="padding:6px 0; text-align:right;">${escapeHtml(email)}</td></tr>
      <tr><td class="ao-muted" style="padding:6px 0; color:#9c9aa5;">Fecha</td><td style="padding:6px 0; text-align:right;">${escapeHtml(date)}</td></tr>
      <tr><td class="ao-muted" style="padding:6px 0; color:#9c9aa5;">Personas</td><td style="padding:6px 0; text-align:right;">${escapeHtml(String(partySize))}</td></tr>
      ${notes ? `<tr><td class="ao-muted" style="padding:6px 0; color:#9c9aa5;">Notas</td><td style="padding:6px 0; text-align:right;">${escapeHtml(notes)}</td></tr>` : ''}
    </table>
    <p class="ao-muted" style="font-size:13px; line-height:1.6; color:#9c9aa5; margin:20px 0 16px;">Le enviamos al cliente un enlace para confirmar asistencia y elegir su mesa. Vas a ver la mesa asignada en el panel admin apenas la confirme.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
      <a href="https://afterofficefutrono.cl/admin/index.html" style="display:inline-block; background-color:#22d3ee; background-image:linear-gradient(135deg,#22d3ee,#d946ef); color:#05050a; font-weight:bold; text-decoration:none; padding:12px 24px; border-radius:10px; font-size:14px;">Ver en el panel admin</a>
    </td></tr></table>
    ${EMAIL_FOOTER}`);
}
