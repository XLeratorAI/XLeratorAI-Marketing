const { Resend } = require('resend');
const { verifyRecaptcha } = require('./_recaptcha');

// Created on first use so a missing key returns a clear error instead of crashing the function
let resend = null;

const TEAM_EMAIL = 'info@xleratorai.com';

// Maps the contact form's interest values to readable labels
const INTEREST_LABELS = {
  problem: 'Business problem / POC',
  partner: 'Consulting partnership',
  'sweet-spot': 'AI Sweet Spot',
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

// ── Serverless handler ──
module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const { name, company, size, email, phone, message, recaptchaToken } = body;
  const title = body.title || body.role;
  const interest = INTEREST_LABELS[body.interest] || body.interest;

  // Validate required fields
  if (!name || !email || !company || !message) {
    return res.status(400).json({ error: 'Please fill in all required fields (name, email, company, and message).' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  // Verify reCAPTCHA
  const captcha = await verifyRecaptcha(recaptchaToken, 'contact');
  if (!captcha.success) {
    return res.status(403).json({ error: 'Security check failed. Please refresh the page and try again.' });
  }

  const data = { name, title, company, size, email, phone, interest, message };

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set; cannot send contact email.');
    return res.status(503).json({ error: 'Our contact form is temporarily unavailable. Please email us directly at info@xleratorai.com.' });
  }
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);

  try {
    // Send both emails concurrently
    const [teamResult, confirmResult] = await Promise.all([
      // 1. Notification to the team
      resend.emails.send({
        from: FROM_EMAIL,
        to: [TEAM_EMAIL],
        replyTo: email,
        subject: `New Inquiry: ${interest || 'General'} — ${name} at ${company}`,
        html: buildTeamEmail(data),
      }),
      // 2. Confirmation to the submitter
      resend.emails.send({
        from: FROM_EMAIL,
        to: [email],
        replyTo: TEAM_EMAIL,
        subject: `We received your message — XLeratorAI`,
        html: buildConfirmationEmail(data),
      }),
    ]);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Email send error:', err);
    return res.status(500).json({ error: 'Something went wrong sending your message. Please try again or email us directly at info@xleratorai.com.' });
  }
};
