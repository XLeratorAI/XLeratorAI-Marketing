// Sends a signed copy of a new application to Data Orchestrator, which hands it to the Patch Factory.
// Used by ../api/application.js after the team has been emailed. It never blocks the applicant:
// every failure is logged and swallowed, because the team email and the stored record already exist.
//
// Signature: hex( HMAC-SHA256( secret, "<timestamp>.<body>" ) ), timestamp in seconds, sent as
// X-Timestamp and X-Signature. The receiver (DataOrchestrator/backend/intake_signing.py) refuses
// anything older than five minutes.
//
// Settings (Pages > Settings > Variables and Secrets): PATCH_FACTORY_URL (the full intake address),
// PATCH_FACTORY_SECRET (the shared secret). If either is missing, nothing is sent.

const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function signBody(secret, timestamp, body) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${body}`)));
}

export async function forwardApplication(env, record, { fetchImpl = fetch, now = () => Date.now() } = {}) {
  if (!env || !env.PATCH_FACTORY_URL || !env.PATCH_FACTORY_SECRET) return { sent: false, reason: 'not-configured' };
  try {
    const body = JSON.stringify(record);
    const timestamp = String(Math.floor(now() / 1000));
    const signature = await signBody(env.PATCH_FACTORY_SECRET, timestamp, body);
    const res = await fetchImpl(env.PATCH_FACTORY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Timestamp': timestamp, 'X-Signature': signature },
      body,
    });
    if (!res.ok) {
      console.error('Patch Factory intake responded', res.status, 'for', record && record.id);
      return { sent: false, reason: `status-${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error('Could not forward the application to Patch Factory:', err);
    return { sent: false, reason: 'error' };
  }
}
