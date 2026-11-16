// Vercel serverless function: receives the quote form and sends two emails through Resend.
//   1. A notification to the business inbox, with reply-to set to the customer.
//   2. A confirmation to the customer, saying we have their request and will be in touch.
//
// Environment variables (set in Vercel → Project → Settings → Environment Variables):
//   RESEND_API_KEY     required
//   QUOTE_TO_EMAIL     optional, default info@scottishenergyservices.co.uk
//   QUOTE_FROM_EMAIL   optional, default "Fire Risk Scotland <quotes@fireriskscotland.com>"
//                      (must be an address on a domain verified in Resend)
//   TURNSTILE_SITE_KEY   required, public widget key returned to the form
//   TURNSTILE_SECRET_KEY required, server-only matching widget secret

const RESEND_URL = 'https://api.resend.com/emails';
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const ALLOWED_HOSTS = new Set(['fireriskscotland.com', 'www.fireriskscotland.com']);
const MAX_BODY_BYTES = 16384;
const TO_EMAIL = process.env.QUOTE_TO_EMAIL || 'info@scottishenergyservices.co.uk';
const FROM_EMAIL = process.env.QUOTE_FROM_EMAIL || 'Fire Risk Scotland <quotes@fireriskscotland.com>';
const PHONE = '0141 255 1360';
const SITE = 'https://fireriskscotland.com';

const PREMISES = [
  'HMO', 'Short-term let or holiday let', 'Office', 'Shop or retail', 'Pub, restaurant or café',
  'Industrial unit or warehouse', 'Hotel, guest house or B&B', 'Care home', 'Block of flats or tenement close',
  'Church, hall or community building', 'Other'
];
const LIMITS = { name: 100, email: 200, phone: 40, premises_type: 80, postcode: 60, size: 200, reason: 100, message: 3000 };
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}
function oneLine(v) { return v.replace(/[\r\n]+/g, ' '); }

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'object' && !Buffer.isBuffer(body)) return body;
  const text = Buffer.isBuffer(body) ? body.toString('utf8') : String(body);
  try { return JSON.parse(text); } catch (e) { /* not JSON */ }
  return Object.fromEntries(new URLSearchParams(text));
}

function header(req, name) {
  const value = req.headers[name];
  return typeof value === 'string' ? value : '';
}

async function verifyCaptcha(token) {
  const response = await fetch(VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token }),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error('Security check unavailable');
  const result = await response.json();
  if (Array.isArray(result['error-codes']) && result['error-codes'].some(code =>
    ['missing-input-secret', 'invalid-input-secret', 'internal-error'].includes(code))) {
    throw new Error('Security check unavailable');
  }
  return result.success === true && ALLOWED_HOSTS.has(result.hostname) && result.action === 'quote';
}

function respond(req, res, status, payload) {
  const wantsJson = header(req, 'accept').includes('application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (wantsJson) return res.status(status).json(payload);
  // Form posted without JavaScript: send the visitor to a page instead of raw JSON.
  if (payload.ok) { res.setHeader('Location', '/quote-sent/'); return res.status(303).end(); }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(status).send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Request not sent | Fire Risk Scotland</title><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1.25rem;color:#182632"><h1>Your request was not sent</h1><p>${esc(payload.error || 'Something went wrong.')}</p><p><a href="/contact/">Go back to the form</a> or call <a href="tel:+441412551360">${PHONE}</a>.</p></body>`);
}

async function sendEmail(apiKey, email) {
  const r = await fetch(RESEND_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(email)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Resend ${r.status}: ${data.message || data.name || 'unknown error'}`);
  return data;
}

function rows(fields) {
  return fields.filter(([, v]) => v).map(([k, v]) =>
    `<tr><th align="left" style="padding:8px 12px;border-bottom:1px solid #e2e8ea;color:#44535f;font-weight:600;vertical-align:top;white-space:nowrap">${esc(k)}</th><td style="padding:8px 12px;border-bottom:1px solid #e2e8ea;color:#182632;white-space:pre-wrap">${esc(v)}</td></tr>`).join('');
}
function textRows(fields) {
  return fields.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
}
function shell(title, inner) {
  return `<!doctype html><html><body style="margin:0;background:#eef2f3;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f3;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden">
<tr><td style="background:#182632;padding:20px 28px;color:#ffffff;font-family:Georgia,serif;font-size:20px;font-weight:bold">Fire Risk Scotland</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;color:#182632">${esc(title)}</h1>
${inner}
</td></tr>
<tr><td style="padding:18px 28px;background:#f6f8f9;color:#66747f;font-size:12px;line-height:1.6">Fire Risk Scotland, 272 Bath Street, Glasgow G2 4JR · ${PHONE} · <a href="${SITE}" style="color:#66747f">fireriskscotland.com</a><br>A sister company of Scottish Energy Services.</td></tr>
</table></td></tr></table></body></html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Use POST to send a quote request.' });
  }

  // Vercel supplies this country header from the connection's IP address.
  // Never accept a country from the form, client geolocation, or another proxy header.
  // Missing location also fails closed, including direct requests to deployment URLs.
  if (header(req, 'x-vercel-ip-country') !== 'GB') {
    return respond(req, res, 403, { ok: false, error: `Online quote requests are available from UK connections. Please call ${PHONE} or email info@fireriskscotland.com if you are abroad or using a VPN.` });
  }

  if (!process.env.TURNSTILE_SITE_KEY || !process.env.TURNSTILE_SECRET_KEY) {
    return respond(req, res, 503, { ok: false, error: `Our quote form is temporarily unavailable. Please call ${PHONE} or email info@fireriskscotland.com.` });
  }
  // The static page loads only the public key at runtime. Secrets never reach the browser.
  if (req.method === 'GET') return res.status(200).json({ siteKey: process.env.TURNSTILE_SITE_KEY });

  const origin = header(req, 'origin');
  if (origin) {
    let allowed = false;
    try { allowed = new URL(origin).origin === SITE; } catch (err) { /* invalid origin */ }
    if (!allowed) return respond(req, res, 403, { ok: false, error: 'Please send your request from fireriskscotland.com.' });
  }
  if (header(req, 'sec-fetch-site') === 'cross-site') {
    return respond(req, res, 403, { ok: false, error: 'Please send your request from fireriskscotland.com.' });
  }
  const type = header(req, 'content-type').split(';')[0].trim().toLowerCase();
  if (!['application/json', 'application/x-www-form-urlencoded'].includes(type)) {
    return respond(req, res, 415, { ok: false, error: 'Unsupported request format.' });
  }

  let b;
  try {
    const raw = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body || {});
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES || Number(header(req, 'content-length')) > MAX_BODY_BYTES) {
      return respond(req, res, 413, { ok: false, error: 'Please shorten your message and try again.' });
    }
    b = type === 'application/json' && (typeof req.body === 'string' || Buffer.isBuffer(req.body))
      ? JSON.parse(req.body.toString()) : parseBody(req.body);
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error('Invalid body');
  } catch (err) {
    return respond(req, res, 400, { ok: false, error: 'Invalid request. Please reload the form and try again.' });
  }

  // Spam traps: a hidden field real visitors never fill, and a minimum time on the page.
  if (clean(b.company_website, 200)) return respond(req, res, 200, { ok: true });
  const started = Number(b.form_started);
  if (started && Date.now() - started < 3000) return respond(req, res, 200, { ok: true });

  const d = {};
  for (const k of Object.keys(LIMITS)) d[k] = clean(b[k], LIMITS[k]);
  d.name = oneLine(d.name); d.email = oneLine(d.email); d.phone = oneLine(d.phone);
  d.premises_type = oneLine(d.premises_type); d.postcode = oneLine(d.postcode); d.reason = oneLine(d.reason); d.size = oneLine(d.size);

  if (!d.name) return respond(req, res, 400, { ok: false, error: 'Please enter your name.' });
  if (!EMAIL_RE.test(d.email)) return respond(req, res, 400, { ok: false, error: 'Please enter a valid email address.' });
  if (!d.premises_type || !PREMISES.includes(d.premises_type)) return respond(req, res, 400, { ok: false, error: 'Please choose the type of premises.' });
  if (!d.postcode) return respond(req, res, 400, { ok: false, error: 'Please enter the postcode or town of the premises.' });
  if (!b.consent) return respond(req, res, 400, { ok: false, error: 'Please tick the box to agree to us using your details to reply.' });

  const token = b['cf-turnstile-response'];
  if (typeof token !== 'string' || !token.trim() || token.length > 2048) {
    return respond(req, res, 400, { ok: false, error: 'Please complete the security check and try again.' });
  }
  try {
    if (!await verifyCaptcha(token)) {
      return respond(req, res, 400, { ok: false, error: 'The security check expired or failed. Please complete it again.' });
    }
  } catch (err) {
    return respond(req, res, 503, { ok: false, error: `The security check is temporarily unavailable. Please try again or call ${PHONE}.` });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('quote: RESEND_API_KEY is not set');
    return respond(req, res, 500, { ok: false, error: `Our quote form is temporarily unavailable. Please call ${PHONE} or email ${TO_EMAIL}.` });
  }

  const fields = [
    ['Name', d.name], ['Email', d.email], ['Phone', d.phone], ['Premises', d.premises_type],
    ['Postcode or town', d.postcode], ['Size', d.size], ['Reason', d.reason], ['Message', d.message]
  ];
  const submitted = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'full', timeStyle: 'short' });

  // 1. Notification to the business. Reply goes straight to the customer.
  try {
    await sendEmail(apiKey, {
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      reply_to: [d.email],
      subject: `New quote request: ${d.premises_type}, ${d.postcode}`,
      html: shell('New fire risk assessment quote request', `
<p style="margin:0 0 16px;color:#44535f;font-size:15px;line-height:1.6">Sent from the quote form on fireriskscotland.com on ${esc(submitted)}. Reply to this email to answer ${esc(d.name)} directly.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">${rows(fields)}</table>`),
      text: `New fire risk assessment quote request (${submitted})\n\n${textRows(fields)}\n\nReply to this email to answer ${d.name} directly.`
    });
  } catch (err) {
    console.error('quote: notification failed', err.message);
    return respond(req, res, 502, { ok: false, error: `Your request could not be sent. Please call ${PHONE} or email ${TO_EMAIL}.` });
  }

  // 2. Confirmation to the customer. Best effort: the request already reached us.
  let confirmationSent = true;
  const first = d.name.split(/\s+/)[0];
  try {
    await sendEmail(apiKey, {
      from: FROM_EMAIL,
      to: [d.email],
      reply_to: [TO_EMAIL],
      subject: 'We have received your fire risk assessment request',
      html: shell(`Thanks, ${first}. We have your request.`, `
<p style="margin:0 0 14px;color:#44535f;font-size:15px;line-height:1.6">We have received your fire risk assessment request for the <strong>${esc(d.premises_type.toLowerCase())}</strong> at <strong>${esc(d.postcode)}</strong>. We will be in touch shortly with a quote and available dates.</p>
<p style="margin:0 0 20px;color:#44535f;font-size:15px;line-height:1.6">If anything is urgent, call us on <a href="tel:+441412551360" style="color:#c4161c;font-weight:bold">${PHONE}</a>, or reply to this email.</p>
<p style="margin:0 0 8px;color:#182632;font-size:14px;font-weight:bold">What you sent us</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-bottom:20px">${rows(fields.filter(([k]) => k !== 'Email'))}</table>
<p style="margin:0;color:#44535f;font-size:15px;line-height:1.6">Fire Risk Scotland<br>Raj Chall BSc, IFE-registered fire risk assessor</p>`),
      text: `Thanks, ${first}. We have received your fire risk assessment request for the ${d.premises_type.toLowerCase()} at ${d.postcode}. We will be in touch shortly with a quote and available dates.\n\nIf anything is urgent, call ${PHONE} or reply to this email.\n\nWhat you sent us:\n${textRows(fields.filter(([k]) => k !== 'Email'))}\n\nFire Risk Scotland\nRaj Chall BSc, IFE-registered fire risk assessor\n${SITE}`
    });
  } catch (err) {
    confirmationSent = false;
    console.error('quote: confirmation failed', err.message);
  }

  return respond(req, res, 200, { ok: true, confirmationSent });
};
