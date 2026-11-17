// Domain checks shared by /api/domain-check and /api/application.
//
// "Is this web address available?" is answered with free public lookups, no account or key:
//   1. RDAP (the modern WHOIS) through rdap.org, which forwards to the registry for the ending.
//   2. DNS over HTTPS at Cloudflare, as a second signal and as a fallback when RDAP is down.
//
// The answer is information, not a promise. A name that is not registered can still be reserved or
// priced as a premium name, and it can be taken before the customer registers it. Callers say so.

// Endings we can check reliably. Anything else is reported as "unsupported" and handled by a person.
export const SUPPORTED_TLDS = ['com', 'net', 'org', 'co', 'app', 'dev', 'io', 'info', 'us', 'biz'];

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

// Turns what a person typed ("https://www.MyShop.com/about") into "myshop.com".
export function normalizeDomain(input) {
  let d = String(input == null ? '' : input).trim().toLowerCase();
  d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  d = d.replace(/^www\./, '');
  d = d.split(/[\/?#]/)[0];
  d = d.replace(/\.$/, '');
  return d;
}

// Returns { ok, domain, tld, supported, error }.
export function validateDomain(input) {
  const domain = normalizeDomain(input);
  if (!domain) return { ok: false, domain, error: 'Type a web address like mybusiness.com.' };
  if (/\s/.test(domain)) return { ok: false, domain, error: 'A web address has no spaces. Try something like mybusiness.com.' };
  const labels = domain.split('.');
  if (labels.length < 2) return { ok: false, domain, error: 'Add an ending, like .com. For example: mybusiness.com.' };
  if (labels.length > 2) return { ok: false, domain, error: 'Type just the name and the ending, like mybusiness.com (no extra parts in front).' };
  if (labels.some((l) => l.startsWith('xn--'))) return { ok: false, domain, error: 'Names with accented or non-English letters cannot be checked here yet. Tell us the name and we will check it with you.' };
  if (!labels.every((l) => LABEL.test(l))) return { ok: false, domain, error: 'Use only letters, numbers and dashes (a dash cannot be first or last).' };
  const tld = labels[1];
  if (tld.length < 2) return { ok: false, domain, error: 'The ending looks too short. For example: mybusiness.com.' };
  return { ok: true, domain, tld, supported: SUPPORTED_TLDS.includes(tld) };
}

function withTimeout(ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
}

// RDAP: 200 = registered, 404 = not found, anything else = could not tell.
async function rdapLookup(domain, f) {
  const to = withTimeout(6000);
  try {
    const res = await f(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      // rdap.org answers 403 to a request with no User-Agent, so say who we are.
      headers: { accept: 'application/rdap+json, application/json', 'user-agent': 'XLeratorAI-NewClient/1.0 (+https://www.xleratorai.com)' },
      redirect: 'follow',
      signal: to.signal,
    });
    if (res.status === 404) return { state: 'not_found' };
    if (!res.ok) return { state: 'error', status: res.status };
    const j = await res.json();
    const events = Array.isArray(j.events) ? j.events : [];
    const when = (action) => (events.find((e) => e.eventAction === action) || {}).eventDate || null;
    let registrar = null;
    for (const ent of Array.isArray(j.entities) ? j.entities : []) {
      if ((ent.roles || []).includes('registrar')) {
        const fn = ((ent.vcardArray && ent.vcardArray[1]) || []).find((p) => p[0] === 'fn');
        if (fn && fn[3]) { registrar = String(fn[3]); break; }
      }
    }
    const nameservers = (Array.isArray(j.nameservers) ? j.nameservers : [])
      .map((n) => String(n.ldhName || '').toLowerCase()).filter(Boolean);
    return { state: 'registered', registrar, expires: when('expiration'), registered: when('registration'), nameservers };
  } catch (err) {
    return { state: 'error', error: String(err && err.name || err) };
  } finally {
    to.done();
  }
}

// DNS: NXDOMAIN (Status 3) = the name is not in the DNS, which for a normal domain means unregistered.
async function dnsLookup(domain, f) {
  const to = withTimeout(4000);
  try {
    const res = await f(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=NS`, {
      headers: { accept: 'application/dns-json' },
      signal: to.signal,
    });
    if (!res.ok) return { state: 'error', status: res.status };
    const j = await res.json();
    if (j.Status === 3) return { state: 'nxdomain' };
    const ns = (Array.isArray(j.Answer) ? j.Answer : []).filter((a) => a.type === 2).map((a) => String(a.data || '').toLowerCase().replace(/\.$/, ''));
    return { state: ns.length ? 'has_ns' : 'no_ns', nameservers: ns };
  } catch (err) {
    return { state: 'error', error: String(err && err.name || err) };
  } finally {
    to.done();
  }
}

// Returns { domain, status, message, registrar?, expires?, nameservers?, onCloudflare? }.
//   status: 'available' | 'registered' | 'unknown' | 'unsupported' | 'invalid'
export async function checkDomain(input, f = fetch) {
  const v = validateDomain(input);
  if (!v.ok) return { domain: v.domain, status: 'invalid', message: v.error };
  const { domain } = v;
  if (!v.supported) {
    return { domain, status: 'unsupported', message: `We cannot check .${v.tld} names automatically yet. Tell us the name and we will check it with you.` };
  }

  const [rdap, dns] = await Promise.all([rdapLookup(domain, f), dnsLookup(domain, f)]);

  if (rdap.state === 'registered') {
    const ns = rdap.nameservers.length ? rdap.nameservers : (dns.nameservers || []);
    return {
      domain, status: 'registered',
      registrar: rdap.registrar || null, expires: rdap.expires || null, registered: rdap.registered || null,
      nameservers: ns, onCloudflare: ns.some((n) => n.endsWith('.ns.cloudflare.com')),
      message: `${domain} is already registered.`,
    };
  }
  if (rdap.state === 'not_found') {
    // Two signals agree: not in RDAP and not in the DNS.
    if (dns.state === 'nxdomain') {
      return { domain, status: 'available', confirmed: true, message: `${domain} looks available. Availability and price are confirmed when you register it, and we cannot reserve it for you.` };
    }
    // RDAP says unregistered but the DNS answers: be careful, tell a person to check.
    if (dns.state === 'has_ns') {
      return { domain, status: 'registered', nameservers: dns.nameservers || [], onCloudflare: (dns.nameservers || []).some((n) => n.endsWith('.ns.cloudflare.com')), message: `${domain} appears to be in use.` };
    }
    return { domain, status: 'available', confirmed: true, message: `${domain} looks available. Availability and price are confirmed when you register it, and we cannot reserve it for you.` };
  }
  // RDAP failed. Fall back to the DNS signal alone (and leave a trace, so a silent degrade is visible in the logs).
  console.warn('RDAP lookup failed for', domain, JSON.stringify(rdap));
  if (dns.state === 'has_ns') {
    return { domain, status: 'registered', nameservers: dns.nameservers || [], onCloudflare: (dns.nameservers || []).some((n) => n.endsWith('.ns.cloudflare.com')), message: `${domain} appears to be in use.` };
  }
  if (dns.state === 'nxdomain') {
    // Only one signal: a registered name with no DNS would look the same, so say it is not confirmed.
    return { domain, status: 'available', confirmed: false, message: `${domain} probably looks available, but we could not confirm it just now. We will check it with you. Availability and price are confirmed when you register it.` };
  }
  return { domain, status: 'unknown', message: 'We could not check that right now. Try again in a moment, or continue and we will check it with you.' };
}
