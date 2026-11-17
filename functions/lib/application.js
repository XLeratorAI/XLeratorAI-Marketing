// Rules and email for the New Client Application (used by ../api/application.js).
// Kept out of the route file so the route only exports request handlers.

import { validateDomain } from './domain.js';

const NAVY = '#0f1f38', NAVY_DARK = '#0a1628', BLUE = '#1f7bff', MUTED = '#5a6e8a', BORDER = '#e4eaf3', BG = '#f0f4f9', RED = '#b3261e';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- what each field may contain ----
const ENUMS = {
  companyType: ['llc', 'corp', 'sole', 'partnership', 'not_formed', 'other'],
  companyRegistered: ['yes', 'not_yet', 'not_sure'],
  domainChoice: ['own', 'name_in_mind', 'need_ideas', 'not_sure'],
  registerPlan: ['self_cloudflare', 'help', 'not_sure'],
  hasApp: ['yes', 'no', 'not_sure'],
  appWhere: ['laptop', 'repo', 'zip', 'other', 'not_sure'],
  appUsesAI: ['yes', 'no', 'not_sure'],
  expectedUsers: ['few', 'tens', 'hundreds', 'more', 'not_sure'],
  privacyPolicy: ['yes', 'no', 'not_yet'],
  regulated: ['yes', 'no', 'not_sure'],
  helpLevel: ['self', 'with_us', 'run_it', 'not_sure'],
  startWhen: ['month', 'one_three', 'later', 'none'],
};
const SENSITIVE_KEYS = ['health', 'money', 'children', 'accounts', 'ids'];
// 'payments' (taking payments through a provider such as Stripe) is recorded for the team but is NOT a sensitive-data flag.
const ALL_SENSITIVE = [...SENSITIVE_KEYS, 'payments', 'none'];

const LABELS = {
  companyType: { llc: 'LLC', corp: 'Corporation', sole: 'Sole proprietor', partnership: 'Partnership', not_formed: 'Not formed yet', other: 'Other' },
  companyRegistered: { yes: 'Yes', not_yet: 'Not yet', not_sure: 'Not sure' },
  domainChoice: { own: 'Already owns the web address', name_in_mind: 'Has a name in mind', need_ideas: 'Needs ideas', not_sure: 'Not sure' },
  registerPlan: { self_cloudflare: 'Will register it in their company’s Cloudflare account', help: 'Wants help registering it', not_sure: 'Not sure' },
  hasApp: { yes: 'Yes', no: 'No', not_sure: 'Not sure' },
  appWhere: { laptop: 'On their computer', repo: 'In an online repository', zip: 'A zip file', other: 'Somewhere else', not_sure: 'Not sure' },
  appUsesAI: { yes: 'Yes', no: 'No', not_sure: 'Not sure' },
  expectedUsers: { few: 'A few people', tens: 'Tens', hundreds: 'Hundreds', more: 'More', not_sure: 'Not sure' },
  privacyPolicy: { yes: 'Yes', no: 'No', not_yet: 'Not yet' },
  regulated: { yes: 'Yes', no: 'No', not_sure: 'Not sure' },
  helpLevel: { self: 'Build it myself', with_us: 'Build it with us', run_it: 'We build and run it', not_sure: 'Not sure yet' },
  startWhen: { month: 'Within a month', one_three: 'In 1 to 3 months', later: 'Later', none: 'No date' },
  sensitive: { health: 'Health or medical information', payments: 'Takes payments through a payment provider (not flagged)', money: 'Stores people’s card or bank details itself', children: 'Children', accounts: 'Logging in to or managing other people’s accounts', ids: 'ID numbers', none: 'None of these / not sure' },
};

const str = (v) => (typeof v === 'string' ? v.trim() : '');

// Returns { clean, errors }. Every message is plain language because the page shows it to the applicant.
export function validateApplication(body) {
  const errors = {};
  const clean = {};
  const text = (key, { required = false, max = 300, min = 0, label } = {}) => {
    const v = str(body[key]);
    if (required && !v) errors[key] = `Please fill in ${label || 'this'}.`;
    else if (v && v.length < min) errors[key] = `Please add a little more detail (at least ${min} characters).`;
    else if (v.length > max) errors[key] = `That is too long (limit ${max} characters).`;
    clean[key] = v;
  };
  const pick = (key, { required = true } = {}) => {
    const v = str(body[key]);
    if (!v) { if (required) errors[key] = 'Please choose one.'; clean[key] = ''; return; }
    if (!ENUMS[key].includes(v)) errors[key] = 'Please choose one of the options.';
    clean[key] = v;
  };

  text('yourName', { required: true, max: 120, label: 'your name' });
  text('email', { required: true, max: 200, label: 'your email' });
  if (clean.email && !EMAIL_REGEX.test(clean.email)) errors.email = 'Please enter a valid email address.';
  text('phone', { max: 40 });
  text('role', { max: 80 });

  text('companyName', { required: true, max: 160, min: 2, label: 'the company name' });
  if (/https?:\/\/|www\./i.test(clean.companyName || '')) errors.companyName = 'Please type the company name, not a web address.';
  pick('companyType');
  pick('companyRegistered');
  text('companyState', { max: 60 });

  text('appName', { required: true, max: 120, label: 'the name of your app or idea' });
  pick('domainChoice');
  text('domain', { max: 253 });
  text('domainWords', { max: 200 });
  clean.domainAlternates = (Array.isArray(body.domainAlternates) ? body.domainAlternates : []).slice(0, 3).map((d) => str(d).slice(0, 253)).filter(Boolean);
  clean.domainLater = body.domainLater === true;
  clean.domainAck = body.domainAck === true;
  pick('registerPlan', { required: clean.domainChoice !== 'own' && !!clean.domainChoice });
  if (clean.domainChoice === 'own' && !clean.domain) errors.domain = 'Please type the web address you own.';
  if (clean.domainChoice === 'name_in_mind' && !clean.domain && !clean.domainLater) errors.domain = 'Please type a name, or choose “I’ll decide on the call”.';
  for (const key of ['domain', ...clean.domainAlternates.map((_, i) => `alt${i}`)]) {
    const raw = key === 'domain' ? clean.domain : clean.domainAlternates[Number(key.slice(3))];
    if (raw) {
      const v = validateDomain(raw);
      if (!v.ok) errors[key === 'domain' ? 'domain' : 'domainAlternates'] = v.error;
    }
  }

  text('idea', { required: true, max: 4000, min: 20, label: 'what the idea does' });
  text('audience', { required: true, max: 1000, label: 'who it is for' });
  text('success', { max: 1000 });
  pick('hasApp');
  if (clean.hasApp === 'yes') {
    pick('appWhere', { required: false });
    text('appBuiltWith', { max: 200 });
    pick('appUsesAI', { required: false });
    pick('expectedUsers', { required: false });
  } else {
    clean.appWhere = clean.appBuiltWith = clean.appUsesAI = clean.expectedUsers = '';
  }

  const sens = Array.isArray(body.sensitive) ? body.sensitive.map(str) : [];
  if (!sens.length) errors.sensitive = 'Please tick at least one box, or “None of these”.';
  else if (!sens.every((s) => ALL_SENSITIVE.includes(s))) errors.sensitive = 'Please choose from the boxes shown.';
  clean.sensitive = [...new Set(sens)];
  if (clean.sensitive.includes('none') && clean.sensitive.length > 1) errors.sensitive = 'Either tick “None of these”, or tick the ones that apply, not both.';
  clean.isSensitive = clean.sensitive.some((s) => SENSITIVE_KEYS.includes(s));
  text('sensitiveNotes', { max: 1500 });
  pick('privacyPolicy');
  pick('regulated');

  pick('helpLevel');
  pick('startWhen');
  text('notes', { max: 3000 });

  if (body.agree !== true) errors.agree = 'Please read the notes and tick the box to continue.';
  return { clean, errors };
}

// ---- the record id, like NC-20261117-9F3A1C0B ----
export function newId() {
  const a = new Uint8Array(4);
  crypto.getRandomValues(a);
  const hex = [...a].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `NC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${hex}`;
}

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function row(label, value, html = false) {
  if (value === '' || value == null || (Array.isArray(value) && !value.length)) return '';
  const shown = html ? value : esc(Array.isArray(value) ? value.join(', ') : value).replace(/\n/g, '<br/>');
  return `<tr><td style="padding:9px 0;border-bottom:1px solid ${BORDER};font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:${MUTED};width:170px;vertical-align:top;">${esc(label)}</td><td style="padding:9px 0;border-bottom:1px solid ${BORDER};font-size:14px;color:${NAVY};line-height:1.5;">${shown}</td></tr>`;
}
function section(title, rows) {
  const body = rows.join('');
  if (!body) return '';
  return `<h2 style="margin:26px 0 6px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${BLUE};">${esc(title)}</h2><table width="100%" cellpadding="0" cellspacing="0">${body}</table>`;
}

function domainLine(r) {
  if (!r) return '';
  const colour = r.status === 'available' ? '#1a7f4b' : r.status === 'registered' ? RED : MUTED;
  const extra = [r.registrar && `registrar: ${r.registrar}`, r.expires && `expires: ${String(r.expires).slice(0, 10)}`, r.status === 'registered' && (r.onCloudflare ? 'name servers at Cloudflare' : (r.nameservers && r.nameservers.length ? `name servers: ${r.nameservers.slice(0, 2).join(', ')}` : ''))].filter(Boolean).join('; ');
  return `<span style="color:${colour};font-weight:600;">${esc(r.domain)}: ${esc(r.status)}${r.status === 'available' && r.confirmed === false ? ' (not confirmed, check by hand)' : ''}</span>${extra ? ` <span style="color:${MUTED};">(${esc(extra)})</span>` : ''}`;
}

export function buildTeamEmail(id, c, checks, when) {
  const L = (k, v) => (LABELS[k] && LABELS[k][v]) || v;
  const sens = c.sensitive.map((s) => LABELS.sensitive[s]).join('; ');
  const flag = c.isSensitive
    ? `<div style="background:#fdecea;border:1px solid #f5c2bd;border-radius:10px;padding:14px 18px;margin:0 0 18px;color:${RED};font-size:14px;font-weight:600;">SENSITIVE: the applicant ticked ${esc(c.sensitive.filter((s) => SENSITIVE_KEYS.includes(s)).map((s) => LABELS.sensitive[s]).join('; '))}. Review first. Own database from day one and a human review before any real data.</div>`
    : '';
  const domainRows = [];
  domainRows.push(row('Choice', L('domainChoice', c.domainChoice)));
  if (checks.main) domainRows.push(row('Main name (checked)', domainLine(checks.main), true));
  else if (c.domain) domainRows.push(row('Main name', c.domain));
  (checks.alts || []).forEach((r, i) => domainRows.push(row(`Alternate ${i + 1} (checked)`, domainLine(r), true)));
  domainRows.push(row('Decide later', c.domainLater ? 'Yes, on the call' : ''));
  domainRows.push(row('Continued despite warning', c.domainAck ? 'Yes' : ''));
  domainRows.push(row('Words they like', c.domainWords));
  domainRows.push(row('Registering', c.registerPlan ? L('registerPlan', c.registerPlan) : ''));

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>New client application ${esc(id)}</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:'Helvetica Neue',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">
<tr><td style="background:${NAVY_DARK};padding:26px 34px;border-radius:14px 14px 0 0;"><span style="font-size:20px;font-weight:800;color:#fff;">XLerator<span style="color:${BLUE}">AI</span></span> <span style="float:right;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:${BLUE};">New client application</span></td></tr>
<tr><td style="background:#fff;padding:30px 34px;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};">
<p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">Reference ${esc(id)}</p>
<h1 style="margin:0 0 18px;font-size:21px;color:${NAVY};line-height:1.3;">${esc(c.companyName)}: ${esc(c.appName)}</h1>
${flag}
${section('About the applicant', [row('Name', c.yourName), row('Email', `<a href="mailto:${esc(c.email)}" style="color:${BLUE};">${esc(c.email)}</a>`, true), row('Phone', c.phone), row('Role', c.role)])}
${section('Company', [row('Legal name', c.companyName), row('Type', L('companyType', c.companyType)), row('State', c.companyState), row('Registered', L('companyRegistered', c.companyRegistered))])}
${section('Web address', domainRows)}
${section('The idea', [row('App or idea name', c.appName), row('What it does', c.idea), row('Who it is for', c.audience), row('Success in 3 months', c.success), row('Has an app already', L('hasApp', c.hasApp)), row('Where it is', c.appWhere ? L('appWhere', c.appWhere) : ''), row('Built with', c.appBuiltWith), row('Uses AI', c.appUsesAI ? L('appUsesAI', c.appUsesAI) : ''), row('Expected users', c.expectedUsers ? L('expectedUsers', c.expectedUsers) : '')])}
${section('Care and rules', [row('Sensitive areas', sens), row('How handled', c.sensitiveNotes), row('Privacy policy for users', L('privacyPolicy', c.privacyPolicy)), row('Regulated field', L('regulated', c.regulated))])}
${section('Help and timing', [row('Help wanted', L('helpLevel', c.helpLevel)), row('Wants people using it', L('startWhen', c.startWhen)), row('Anything else', c.notes)])}
<p style="margin:24px 0 0;font-size:13px;color:${MUTED};line-height:1.6;">Received ${esc(when)}. The applicant was <strong>not</strong> emailed; they were shown this reference on screen. Reply to this message to reach them. Before accepting: fit, capacity (we take a limited number of customers at a time), cost, and the sensitive-data answers.</p>
</td></tr>
<tr><td style="background:${BG};padding:18px 34px;border-top:1px solid ${BORDER};border-radius:0 0 14px 14px;text-align:center;"><p style="margin:0;font-size:12px;color:${MUTED};">Sent from the New Client Application on xleratorai.com.</p></td></tr>
</table></td></tr></table></body></html>`;
}

