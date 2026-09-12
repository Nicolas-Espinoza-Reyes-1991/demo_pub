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

const EMAIL_WRAP_OPEN = `<div style="background:#0a0a0f;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#f5f5f4;">
  <div style="max-width:480px;margin:0 auto;background:#141318;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px 28px;">
    <p style="margin:0 0 4px;font-weight:900;letter-spacing:0.04em;font-size:20px;line-height:1;">AFTER OFFICE</p>
    <p style="margin:0 0 24px;font-weight:600;letter-spacing:0.28em;font-size:11px;color:#9c9aa5;">FUTRONO</p>`;
const EMAIL_WRAP_CLOSE = `</div></div>`;

export function customerConfirmationEmailHtml({ name, date, partySize, confirmUrl }) {
  return `${EMAIL_WRAP_OPEN}
    <h1 style="font-size:20px;margin:0 0 16px;color:#ffffff;">¡Hola, ${escapeHtml(name)}!</h1>
    <p style="font-size:15px;line-height:1.6;color:#d6d3d1;margin:0 0 8px;">Recibimos tu solicitud de reserva para <strong>${escapeHtml(String(partySize))} personas</strong> el <strong>${escapeHtml(date)}</strong>.</p>
    <p style="font-size:15px;line-height:1.6;color:#d6d3d1;margin:0 0 24px;">Para dejarla lista, confirma tu asistencia y elige tu mesa favorita en el siguiente enlace:</p>
    <p style="text-align:center;margin:0 0 24px;">
      <a href="${confirmUrl}" style="display:inline-block;background:linear-gradient(135deg,#22d3ee,#d946ef);color:#05050a;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;">Confirmar asistencia y elegir mesa</a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#6b6975;margin:0;">Este enlace es personal y expira en 48 horas. Si no confirmas dentro de ese plazo, la solicitud se cancela automáticamente para liberar el cupo.</p>
  ${EMAIL_WRAP_CLOSE}`;
}

export function ownerNotificationEmailHtml({ name, phone, email, date, partySize, notes }) {
  return `${EMAIL_WRAP_OPEN}
    <h1 style="font-size:18px;margin:0 0 16px;color:#ffffff;">Nueva solicitud de reserva</h1>
    <table style="width:100%;font-size:14px;color:#d6d3d1;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:#9c9aa5;">Nombre</td><td style="padding:6px 0;text-align:right;">${escapeHtml(name)}</td></tr>
      <tr><td style="padding:6px 0;color:#9c9aa5;">Teléfono</td><td style="padding:6px 0;text-align:right;">${escapeHtml(phone)}</td></tr>
      <tr><td style="padding:6px 0;color:#9c9aa5;">Correo</td><td style="padding:6px 0;text-align:right;">${escapeHtml(email)}</td></tr>
      <tr><td style="padding:6px 0;color:#9c9aa5;">Fecha</td><td style="padding:6px 0;text-align:right;">${escapeHtml(date)}</td></tr>
      <tr><td style="padding:6px 0;color:#9c9aa5;">Personas</td><td style="padding:6px 0;text-align:right;">${escapeHtml(String(partySize))}</td></tr>
      ${notes ? `<tr><td style="padding:6px 0;color:#9c9aa5;">Notas</td><td style="padding:6px 0;text-align:right;">${escapeHtml(notes)}</td></tr>` : ''}
    </table>
    <p style="font-size:13px;line-height:1.6;color:#6b6975;margin:20px 0 0;">Le enviamos al cliente un enlace para confirmar asistencia y elegir su mesa. Vas a ver la mesa asignada en el panel admin apenas la confirme.</p>
  ${EMAIL_WRAP_CLOSE}`;
}
