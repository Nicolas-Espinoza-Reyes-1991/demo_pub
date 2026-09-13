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

// Light background on purpose, not a stylistic choice: an all-dark design
// (matching the site) got silently "fixed" by Gmail's app dark-mode
// heuristics for recipients — it flattened our dark background to white but
// left the (white-on-transparent) logo image un-recolored, so the logo went
// invisible. A light card is immune to that class of client-side repaint
// across every major mail client, so branding rides on the gradient-colored
// logo and the CTA button instead of on a dark canvas. Full <html> document
// (not a bare fragment) + explicit color-scheme metas are the other half of
// the fix — without them some clients still guess at a dark variant to
// generate on their own.
function emailDocument(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-scheme" content="light">
</head>
<body style="margin:0; padding:0; background-color:#f2f1ee;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f2f1ee" style="background-color:#f2f1ee;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:480px; max-width:100%; background-color:#ffffff; border:1px solid #e8e6e1; border-radius:16px;">
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

const EMAIL_FOOTER = `<div style="margin-top:28px; padding-top:20px; border-top:1px solid #ece9e4; text-align:center;">
  <p style="font-size:12px; line-height:1.6; color:#8a8880; margin:0 0 6px;">Gaston Guarda Parades 54, Futrono, Los Ríos</p>
  <p style="font-size:12px; margin:0;">
    <a href="https://wa.me/56993015918" style="color:#0e7a90; text-decoration:none; font-weight:bold;">WhatsApp</a>
    <span style="color:#c9c6bf;"> &middot; </span>
    <a href="https://www.instagram.com/afterofficefutrono" style="color:#a3268a; text-decoration:none; font-weight:bold;">Instagram</a>
  </p>
</div>`;

export function customerConfirmationEmailHtml({ name, date, partySize, confirmUrl }) {
  return emailDocument(`${EMAIL_LOGO}
    <h1 style="font-size:20px; margin:0 0 16px; color:#1a1a1a; text-align:center;">¡Hola, ${escapeHtml(name)}!</h1>
    <p style="font-size:15px; line-height:1.6; color:#44423e; margin:0 0 8px;">Recibimos tu solicitud de reserva para <strong>${escapeHtml(String(partySize))} personas</strong> el <strong>${escapeHtml(date)}</strong>.</p>
    <p style="font-size:15px; line-height:1.6; color:#44423e; margin:0 0 24px;">Para dejarla lista, confirma tu asistencia y elige tu mesa favorita en el siguiente enlace:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:0 0 24px;">
      <a href="${confirmUrl}" style="display:inline-block; background-color:#22d3ee; background-image:linear-gradient(135deg,#22d3ee,#d946ef); color:#05050a; font-weight:bold; text-decoration:none; padding:14px 28px; border-radius:10px; font-size:15px;">Confirmar asistencia y elegir mesa</a>
    </td></tr></table>
    <p style="font-size:13px; line-height:1.6; color:#8a8880; margin:0;">Este enlace es personal y expira en 48 horas. Si no confirmas dentro de ese plazo, la solicitud se cancela automáticamente para liberar el cupo.</p>
    <p style="font-size:13px; line-height:1.6; color:#8a8880; margin:12px 0 0;">¿Dudas o cambios de última hora? Escríbenos por WhatsApp, abajo.</p>
    ${EMAIL_FOOTER}`);
}

export function ownerNotificationEmailHtml({ name, phone, email, date, partySize, notes }) {
  return emailDocument(`${EMAIL_LOGO}
    <h1 style="font-size:18px; margin:0 0 16px; color:#1a1a1a; text-align:center;">Nueva solicitud de reserva</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px; color:#44423e;">
      <tr><td style="padding:6px 0; color:#8a8880;">Nombre</td><td style="padding:6px 0; text-align:right;">${escapeHtml(name)}</td></tr>
      <tr><td style="padding:6px 0; color:#8a8880;">Teléfono</td><td style="padding:6px 0; text-align:right;">${escapeHtml(phone)}</td></tr>
      <tr><td style="padding:6px 0; color:#8a8880;">Correo</td><td style="padding:6px 0; text-align:right;">${escapeHtml(email)}</td></tr>
      <tr><td style="padding:6px 0; color:#8a8880;">Fecha</td><td style="padding:6px 0; text-align:right;">${escapeHtml(date)}</td></tr>
      <tr><td style="padding:6px 0; color:#8a8880;">Personas</td><td style="padding:6px 0; text-align:right;">${escapeHtml(String(partySize))}</td></tr>
      ${notes ? `<tr><td style="padding:6px 0; color:#8a8880;">Notas</td><td style="padding:6px 0; text-align:right;">${escapeHtml(notes)}</td></tr>` : ''}
    </table>
    <p style="font-size:13px; line-height:1.6; color:#8a8880; margin:20px 0 16px;">Le enviamos al cliente un enlace para confirmar asistencia y elegir su mesa. Vas a ver la mesa asignada en el panel admin apenas la confirme.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
      <a href="https://afterofficefutrono.cl/admin/index.html" style="display:inline-block; background-color:#22d3ee; background-image:linear-gradient(135deg,#22d3ee,#d946ef); color:#05050a; font-weight:bold; text-decoration:none; padding:12px 24px; border-radius:10px; font-size:14px;">Ver en el panel admin</a>
    </td></tr></table>
    ${EMAIL_FOOTER}`);
}
