// New Client Application handler for Cloudflare Pages (served at /api/application).
//
// What it does, in order:
//   1. Checks every field again on the server (the page checks too, but the page can be bypassed).
//   2. Checks Cloudflare Turnstile (fails closed if the secret is missing).
//   3. Re-runs the domain checks itself, so the team sees a trustworthy result.
//   4. Stores the application as a record, if a KV namespace is bound as APPLICATIONS.
//   5. Emails the team at newclient@xleratorai.com.
//   6. Sends a signed copy to Data Orchestrator for the Patch Factory (see ../lib/forward.js). Never blocks the applicant.
// It sends NO email to the applicant: they get a reference number on screen and we contact them.
//
// Secrets (Pages > Settings > Variables and Secrets): RESEND_API_KEY, TURNSTILE_SECRET_KEY.
// Optional binding (Pages > Settings > Bindings): KV namespace APPLICATIONS.
// Optional, for the Patch Factory: PATCH_FACTORY_URL and PATCH_FACTORY_SECRET.

import { checkDomain } from '../lib/domain.js';
import { validateApplication, buildTeamEmail, newId } from '../lib/application.js';
import { forwardApplication } from '../lib/forward.js';

const TEAM_EMAIL = 'newclient@xleratorai.com';
const FROM_EMAIL = 'XLeratorAI <noreply@xleratorai.com>';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const respond = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });
const FALLBACK = `Please email us at ${TEAM_EMAIL} instead.`;
const str = (v) => (typeof v === 'string' ? v.trim() : '');

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

export async function onRequestPost({ request, env, waitUntil }) {
  let body;
  try { body = await request.json(); } catch (_) { return respond({ error: 'Invalid request.' }, 400); }
  if (!body || typeof body !== 'object') return respond({ error: 'Invalid request.' }, 400);

  // Hidden trap field: people never see it, bots fill it. Look successful, do nothing.
  if (str(body.companyWebsite)) return respond({ success: true, id: newId() });

  const { clean, errors } = validateApplication(body);
  if (Object.keys(errors).length) {
    return respond({ error: 'Please fix the highlighted answers and try again.', fields: errors }, 400);
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    console.error('TURNSTILE_SECRET_KEY is not set; cannot verify the security check.');
    return respond({ error: 'The application form is temporarily unavailable. ' + FALLBACK }, 503);
  }
  const captcha = await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET_KEY, request.headers.get('CF-Connecting-IP'));
  if (!captcha.success) {
    console.warn('Turnstile check failed:', captcha.error);
    return respond({ error: 'The security check did not pass. Please wait a moment and try again.' }, 403);
  }
  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set; cannot send the team email.');
    return respond({ error: 'The application form is temporarily unavailable. ' + FALLBACK }, 503);
  }

  // Our own domain checks (the page's result is not trusted).
  const checks = { main: null, alts: [] };
  const todo = [];
  if (clean.domain) todo.push(checkDomain(clean.domain).then((r) => { checks.main = r; }));
  clean.domainAlternates.forEach((d, i) => todo.push(checkDomain(d).then((r) => { checks.alts[i] = r; })));
  await Promise.allSettled(todo);

  const id = newId();
  const when = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const record = { id, receivedAt: new Date().toISOString(), status: 'new', ...clean, domainChecks: checks };

  let stored = false;
  if (env.APPLICATIONS && typeof env.APPLICATIONS.put === 'function') {
    try { await env.APPLICATIONS.put(`application:${id}`, JSON.stringify(record)); stored = true; }
    catch (err) { console.error('Could not store the application record:', err); }
  } else {
    console.warn('No APPLICATIONS KV binding; the team email is the only record of', id);
  }

  try {
    await sendEmail(env.RESEND_API_KEY, {
      from: FROM_EMAIL,
      to: [TEAM_EMAIL],
      reply_to: clean.email,
      subject: `${clean.isSensitive ? '[SENSITIVE] ' : ''}New client application ${id}: ${clean.companyName}, ${clean.appName}`.replace(/[\r\n\t]+/g, ' ').slice(0, 250),
      html: buildTeamEmail(id, clean, checks, when),
    });
  } catch (err) {
    console.error('Team email failed:', err);
    // The record is stored, but nobody has been told. Do not say it worked.
    return respond({ error: `Something went wrong sending your application. ${FALLBACK}`, stored }, 500);
  }

  // The team has been told. Now hand the application to the Patch Factory. Not awaited by the applicant's
  // response when waitUntil is available; either way a failure is logged and never shown to them.
  const forward = forwardApplication(env, record);
  if (typeof waitUntil === 'function') waitUntil(forward); else await forward;
  return respond({ success: true, id });
}

export async function onRequest() {
  return respond({ error: 'Method not allowed' }, 405);
}
