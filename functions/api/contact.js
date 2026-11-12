// Contact form handler for Cloudflare Pages (served at /api/contact).
// Ported from api/contact.js (Vercel). Differences:
//   - Cloudflare Turnstile replaces reCAPTCHA (secret: TURNSTILE_SECRET_KEY).
//   - Resend is called over its web API with fetch (no SDK), and a failed send now returns an error
//     instead of being treated as success.
//   - Fails closed: a missing Turnstile secret returns 503 instead of skipping the check.
// Secrets (Pages > Settings > Variables and Secrets): RESEND_API_KEY, TURNSTILE_SECRET_KEY.

const TEAM_EMAIL = 'info@xleratorai.com';

// Maps the contact form's interest values to readable labels
const INTEREST_LABELS = {
  problem: 'Business problem / POC',
  partner: 'Consulting partnership',
  'small-business': 'Small business application',
  'sweet-spot': 'AI Sweet Spot',
  'innovators-lab': "Innovator's Lab",
  architecture: 'Trust / architecture review',
  solutions: 'XLeratorAI solutions',
  conversation: 'Not sure yet',
};
const FROM_EMAIL = 'XLeratorAI <noreply@xleratorai.com>';

// ── Brand colors ──
const NAVY = '#0f1f38';
const NAVY_DARK = '#0a1628';
const BLUE = '#1f7bff';
const MUTED = '#5a6e8a';
const BORDER = '#e4eaf3';
const BG = '#f0f4f9';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Notification email to the team ──
function buildTeamEmail(data) {
  const { name, title, company, size, email, phone, interest, message } = data;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>New Contact Inquiry</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="background:${NAVY_DARK};padding:32px 40px;border-radius:14px 14px 0 0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td><span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">XLerator<span style="color:${BLUE}">AI</span></span></td>
        <td align="right"><span style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${BLUE};background:rgba(31,123,255,0.12);padding:5px 12px;border-radius:999px;">New Inquiry</span></td>
      </tr>
    </table>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#ffffff;padding:40px;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};">
    <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${BLUE};">Contact Form Submission</p>
    <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:${NAVY};line-height:1.3;">${escapeHtml(name)} from ${escapeHtml(company)}</h1>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      ${fieldRow('Interest', interest)}
      ${fieldRow('Name', name)}
      ${fieldRow('Title / Role', title)}
      ${fieldRow('Company', company)}
      ${fieldRow('Company Size', size)}
      ${fieldRow('Email', email, true)}
      ${fieldRow('Phone', phone)}
    </table>

    <div style="background:${BG};border:1px solid ${BORDER};border-radius:10px;padding:20px 24px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};">Message</p>
      <p style="margin:0;font-size:15px;color:${NAVY};line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
      <tr><td align="center">
        <a href="mailto:${escapeHtml(email)}" style="display:inline-block;background:${BLUE};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;">Reply to ${escapeHtml(name)} →</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:${BG};padding:24px 40px;border-top:1px solid ${BORDER};border-radius:0 0 14px 14px;text-align:center;">
    <p style="margin:0;font-size:12px;color:${MUTED};">This message was sent from the XLeratorAI website contact form.</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

function fieldRow(label, value, isEmail = false) {
  if (!value) return '';
  const display = isEmail
    ? `<a href="mailto:${escapeHtml(value)}" style="color:${BLUE};text-decoration:none;">${escapeHtml(value)}</a>`
    : escapeHtml(value);
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${BORDER};font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED};width:140px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:10px 0;border-bottom:1px solid ${BORDER};font-size:15px;color:${NAVY};">${display}</td>
  </tr>`;
}

// ── Confirmation email to the submitter ──
function buildConfirmationEmail(data) {
  const { name, interest } = data;
  const firstName = escapeHtml((name || '').split(' ')[0] || 'there');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>We received your message</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="background:${NAVY_DARK};padding:32px 40px;border-radius:14px 14px 0 0;text-align:center;">
    <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">XLerator<span style="color:${BLUE}">AI</span></span>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#ffffff;padding:44px 40px;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};">
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:${NAVY};line-height:1.3;">Thanks, ${firstName}.</h1>
    <p style="margin:0 0 20px;font-size:15px;color:${MUTED};line-height:1.65;">We've received your inquiry${interest ? ` regarding <strong style="color:${NAVY};">${escapeHtml(interest)}</strong>` : ''} and a senior team member will be in touch within <strong style="color:${NAVY};">one business day</strong>.</p>

    <div style="background:${BG};border:1px solid ${BORDER};border-radius:10px;padding:24px;margin-bottom:28px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${BLUE};">What happens next?</p>
      <table cellpadding="0" cellspacing="0" style="margin-top:12px;">
        <tr><td style="padding:0 12px 10px 0;vertical-align:top;font-size:18px;">1.</td><td style="padding:0 0 10px;font-size:14px;color:${NAVY};line-height:1.5;">A senior team member reviews your inquiry and any relevant context.</td></tr>
        <tr><td style="padding:0 12px 10px 0;vertical-align:top;font-size:18px;">2.</td><td style="padding:0 0 10px;font-size:14px;color:${NAVY};line-height:1.5;">We'll reach out with tailored recommendations or schedule a discovery call.</td></tr>
        <tr><td style="padding:0 12px 0 0;vertical-align:top;font-size:18px;">3.</td><td style="padding:0;font-size:14px;color:${NAVY};line-height:1.5;">No hard sell — just an honest assessment of how we can help.</td></tr>
      </table>
    </div>

    <p style="margin:0;font-size:14px;color:${MUTED};line-height:1.6;">In the meantime, feel free to reply to this email if you have anything to add. For urgent requests, mention it in your reply and we'll prioritize.</p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:${NAVY_DARK};padding:32px 40px;border-radius:0 0 14px 14px;text-align:center;">
    <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.5);">XLeratorAI: AI product engineering for consulting firms and enterprise teams.</p>
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);">&copy; ${new Date().getFullYear()} XLeratorAI. All rights reserved.</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

// ── Pages Function handler ──
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const respond = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });
const EMAIL_FALLBACK = 'Please email us directly at info@xleratorai.com.';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function verifyTurnstile(token, secret, ip) {
  if (!token) return { success: false, error: 'missing-token' };
  const form = new URLSearchParams({ secret, response: token });
  if (ip) form.set('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const data = await res.json();
  return { success: !!data.success, error: (data['error-codes'] || []).join(',') };
}

async function sendEmail(apiKey, message) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch (_) { return respond({ error: 'Invalid request.' }, 400); }
  body = body || {};

  const { name, company, size, email, phone, message } = body;
  const title = body.title || body.role;
  const interest = INTEREST_LABELS[body.interest] || body.interest;

  if (!name || !email || !company || !message) {
    return respond({ error: 'Please fill in all required fields (name, email, company, and message).' }, 400);
  }
  if (!EMAIL_REGEX.test(email)) {
    return respond({ error: 'Please enter a valid email address.' }, 400);
  }
  // Basic size limits so the form cannot be used to send huge payloads
  const tooLong = [name, company, email, title, size, phone, interest].some((v) => v && String(v).length > 300) || String(message).length > 10000;
  if (tooLong) {
    return respond({ error: 'One of the fields is too long. Please shorten it and try again.' }, 400);
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    console.error('TURNSTILE_SECRET_KEY is not set; cannot verify the security check.');
    return respond({ error: 'Our contact form is temporarily unavailable. ' + EMAIL_FALLBACK }, 503);
  }
  const captcha = await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET_KEY, request.headers.get('CF-Connecting-IP'));
  if (!captcha.success) {
    console.warn('Turnstile check failed:', captcha.error);
    return respond({ error: 'Security check failed. Please refresh the page and try again.' }, 403);
  }

  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set; cannot send contact email.');
    return respond({ error: 'Our contact form is temporarily unavailable. ' + EMAIL_FALLBACK }, 503);
  }

  const data = { name, title, company, size, email, phone, interest, message };

  try {
    // Send both emails concurrently
    await Promise.all([
      // 1. Notification to the team
      sendEmail(env.RESEND_API_KEY, {
        from: FROM_EMAIL,
        to: [TEAM_EMAIL],
        reply_to: email,
        subject: `New Inquiry: ${interest || 'General'} — ${name} at ${company}`,
        html: buildTeamEmail(data),
      }),
      // 2. Confirmation to the submitter
      sendEmail(env.RESEND_API_KEY, {
        from: FROM_EMAIL,
        to: [email],
        reply_to: TEAM_EMAIL,
        subject: 'We received your message — XLeratorAI',
        html: buildConfirmationEmail(data),
      }),
    ]);
    return respond({ success: true });
  } catch (err) {
    console.error('Email send error:', err);
    return respond({ error: 'Something went wrong sending your message. Please try again or email us directly at info@xleratorai.com.' }, 500);
  }
}

// Anything other than POST
export async function onRequest() {
  return respond({ error: 'Method not allowed' }, 405);
}
