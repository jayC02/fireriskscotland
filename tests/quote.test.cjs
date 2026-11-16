const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/quote.js');

const originalFetch = global.fetch;
const envNames = ['TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY', 'RESEND_API_KEY'];
let savedEnv, calls, verification, verificationStatus, fetchError, emailStatus;
const valid = () => ({
  name: 'Jane Example', email: 'jane@example.com', phone: '0141 000 0000',
  premises_type: 'Office', postcode: 'G2 4JR', consent: 'on',
  'cf-turnstile-response': 'mock-single-use-token',
  form_started: String(Date.now() - 10000)
});

beforeEach(() => {
  savedEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
  process.env.TURNSTILE_SITE_KEY = 'mock-site-key';
  process.env.TURNSTILE_SECRET_KEY = 'mock-secret-key';
  process.env.RESEND_API_KEY = 'mock-email-key';
  calls = [];
  verification = { success: true, hostname: 'fireriskscotland.com', action: 'quote' };
  verificationStatus = 200;
  emailStatus = 200;
  fetchError = null;
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/siteverify')) {
      if (fetchError) throw fetchError;
      return { ok: verificationStatus === 200, json: async () => verification };
    }
    assert.equal(url, 'https://api.resend.com/emails');
    return { ok: emailStatus === 200, status: emailStatus, json: async () => ({ id: 'mock-email' }) };
  };
});
afterEach(() => {
  global.fetch = originalFetch;
  for (const name of envNames) {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  }
});

async function request({ method = 'POST', body = valid(), headers = {} } = {}) {
  const req = { method, body, headers: {
    accept: 'application/json', 'content-type': 'application/json',
    'x-vercel-ip-country': 'GB', origin: 'https://fireriskscotland.com', ...headers
  } };
  const result = { headers: {} };
  const res = {
    setHeader(name, value) { result.headers[name] = value; },
    status(code) { result.status = code; return this; },
    json(data) { result.body = data; return this; },
    send(html) { result.html = html; return this; },
    end() { return this; }
  };
  await handler(req, res);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  return result;
}

test('UK configuration exposes only the public site key', async () => {
  const result = await request({ method: 'GET' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { siteKey: 'mock-site-key' });
  assert.equal(calls.length, 0);
});

for (const country of ['US', 'IN', 'CN', 'FR', '', undefined, ['GB']]) {
  test(`reject country ${JSON.stringify(country)} before any provider calls`, async () => {
    for (const method of ['GET', 'POST']) {
      const result = await request({ method, body: { ...valid(), country: 'GB' }, headers: {
        'x-vercel-ip-country': country, 'cf-ipcountry': 'GB', 'x-country-code': 'GB'
      } });
      assert.equal(result.status, 403);
      assert.match(result.body.error, /UK connections/);
    }
    assert.equal(calls.length, 0);
  });
}

test('unsupported methods return 405 without contacting a provider', async () => {
  const result = await request({ method: 'DELETE' });
  assert.equal(result.status, 405);
  assert.equal(result.headers.Allow, 'GET, POST');
  assert.equal(calls.length, 0);
});

for (const name of ['TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY']) {
  test(`missing ${name} fails closed for config and submission`, async () => {
    delete process.env[name];
    assert.equal((await request({ method: 'GET' })).status, 503);
    assert.equal((await request()).status, 503);
    assert.equal(calls.length, 0);
  });
}

for (const token of ['', undefined, ['token'], 'x'.repeat(2049)]) {
  test(`invalid token ${typeof token} is rejected before provider calls`, async () => {
    assert.equal((await request({ body: { ...valid(), 'cf-turnstile-response': token } })).status, 400);
    assert.equal(calls.length, 0);
  });
}

for (const response of [
  { success: false, 'error-codes': ['timeout-or-duplicate'] },
  { success: true, hostname: 'scottishenergyservices.co.uk', action: 'quote' },
  { success: true, hostname: 'fireriskscotland.com.evil.example', action: 'quote' },
  { success: true, hostname: 'fireriskscotland.com', action: 'enquiry' },
  { success: true },
  { success: 'true', hostname: 'fireriskscotland.com', action: 'quote' }
]) {
  test(`failed or mismatched Siteverify response cannot send email: ${JSON.stringify(response)}`, async () => {
    verification = response;
    assert.equal((await request()).status, 400);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /siteverify$/);
  });
}

test('verification timeout fails closed and supports a fresh attempt', async () => {
  fetchError = new Error('timeout');
  assert.equal((await request()).status, 503);
  assert.equal(calls.length, 1);
  fetchError = null;
  assert.equal((await request()).status, 200);
  assert.equal(calls.length, 4);
});

test('verification provider failure sends no email', async () => {
  verificationStatus = 502;
  assert.equal((await request()).status, 503);
  assert.equal(calls.length, 1);
});

test('an invalid configured secret is reported as unavailable without sending email', async () => {
  verification = { success: false, 'error-codes': ['invalid-input-secret'] };
  assert.equal((await request()).status, 503);
  assert.equal(calls.length, 1);
});

test('a valid UK submission verifies the token before sending both emails', async () => {
  const result = await request();
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true, confirmationSent: true });
  assert.equal(calls.length, 3);
  const check = calls[0];
  assert.match(check.url, /siteverify$/);
  assert.equal(check.options.body.get('secret'), 'mock-secret-key');
  assert.equal(check.options.body.get('response'), 'mock-single-use-token');
  assert.ok(check.options.signal instanceof AbortSignal);
  const emails = calls.slice(1).map(call => JSON.parse(call.options.body));
  assert.deepEqual(emails[0].reply_to, ['jane@example.com']);
  assert.deepEqual(emails[1].to, ['jane@example.com']);
  assert.ok(emails.every(email => !JSON.stringify(email).includes('mock-single-use-token')));
});

test('form-urlencoded browser submission is supported', async () => {
  const result = await request({ body: new URLSearchParams(valid()).toString(), headers: {
    'content-type': 'application/x-www-form-urlencoded;charset=UTF-8'
  } });
  assert.equal(result.status, 200);
  assert.equal(calls.length, 3);
});

test('a reused token cannot trigger another email pair', async () => {
  assert.equal((await request()).status, 200);
  verification = { success: false, 'error-codes': ['timeout-or-duplicate'] };
  assert.equal((await request()).status, 400);
  assert.equal(calls.filter(call => call.url.includes('resend.com')).length, 2);
});

test('honeypot and timing trap never contact CAPTCHA or email providers', async () => {
  assert.equal((await request({ body: { ...valid(), company_website: 'https://spam.example' } })).status, 200);
  assert.equal((await request({ body: { ...valid(), form_started: String(Date.now()) } })).status, 200);
  assert.equal(calls.length, 0);
});

test('oversized payload is rejected before provider calls', async () => {
  assert.equal((await request({ body: { ...valid(), message: 'x'.repeat(17000) } })).status, 413);
  assert.equal(calls.length, 0);
});

for (const body of ['{invalid', 'null', '[]', '42']) {
  test(`malformed JSON body ${body} is rejected`, async () => {
    assert.equal((await request({ body })).status, 400);
    assert.equal(calls.length, 0);
  });
}

test('unsupported content types and cross-site origins are rejected', async () => {
  assert.equal((await request({ headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await request({ headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await request({ headers: { origin: 'https://fireriskscotland.com.evil.example' } })).status, 403);
  assert.equal((await request({ headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  assert.equal(calls.length, 0);
});

test('native form errors show an accessible contact alternative rather than raw JSON', async () => {
  const result = await request({ headers: { accept: 'text/html', 'x-vercel-ip-country': 'US' } });
  assert.equal(result.status, 403);
  assert.match(result.html, /UK connections/);
  assert.match(result.html, /tel:\+441412551360/);
  assert.equal(calls.length, 0);
});
