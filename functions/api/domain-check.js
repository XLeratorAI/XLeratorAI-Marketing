// "Is this web address available?" for the New Client Application (served at /api/domain-check).
// GET /api/domain-check?domain=mybusiness.com  ->  { domain, status, message, registrar?, expires?, ... }
// Uses only free public lookups (see ../lib/domain.js). No secrets, no account.

import { checkDomain } from '../lib/domain.js';

const respond = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=30' },
  });

// Only our own pages should call this. Browsers send an Origin on cross-site requests.
function allowedOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname;
    return host === 'xleratorai.com' || host.endsWith('.xleratorai.com') || host.endsWith('.pages.dev') || host === 'localhost' || host === '127.0.0.1';
  } catch (_) {
    return false;
  }
}

export async function onRequestGet({ request }) {
  if (!allowedOrigin(request)) return respond({ error: 'Not allowed.' }, 403);
  const raw = new URL(request.url).searchParams.get('domain');
  if (!raw || raw.length > 300) return respond({ error: 'Type a web address like mybusiness.com.' }, 400);
  const result = await checkDomain(raw);
  return respond(result, result.status === 'invalid' ? 400 : 200);
}

export async function onRequest() {
  return respond({ error: 'Method not allowed' }, 405);
}
