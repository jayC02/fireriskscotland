# fireriskscotland.com: static site

The `fireriskscotland/` folder is the complete site. It has no build step, so you can upload it to any static host as it is.

## Deploy

- **Vercel:** deploy the `fireriskscotland/` folder as a static project. `vercel.json` sets clean URLs, trailing slashes, cache headers for `/assets/`, security headers, and a `www` to apex redirect. Then add `fireriskscotland.com` and `www.fireriskscotland.com` as domains.
- **Any other host:** upload the folder and serve `404.html` as the not-found page.
- The canonical domain is `https://fireriskscotland.com` (no `www`). Each page's canonical tag, `sitemap.xml` and the structured data all use it.

## Before going live

1. **Quote form:** `/contact/` submits to the Vercel function at `/api/quote/`. Configure the Resend and Cloudflare Turnstile variables below before deploying. Other static hosts need an equivalent server endpoint; there is no unprotected email fallback.
2. **Mailbox:** set up info@fireriskscotland.com, or find and replace it across the site.
3. **Raj's photo:** `assets/img/raj-chall.jpg` and `.webp` are 186px, cropped from the photo supplied. A professional headshot at 600px or more would look sharper. Keep the same file names.
4. **IFE register number:** add it to the About page if you want it shown.
5. **Privacy notice:** check `/privacy/`, including the 12-month retention line, security providers, and the statement that the site uses no tracking cookies. Update it if you add analytics.
6. **Prices:** the only published figure is "from £225 + VAT" for smaller premises, taken from the SES site. Adding "from" prices for medium and large premises on `/fire-risk-assessment-cost/` would help AI answers quote you.

## After going live (SEO and GEO)

- Add the site to Google Search Console and Bing Webmaster Tools, and submit `https://fireriskscotland.com/sitemap.xml`. Gemini and Google's AI Overviews draw on Google's index, so this is the step that matters most.
- Create a Google Business Profile for Fire Risk Scotland using the same name, address and phone number as the site.
- Once profiles exist (Google Business Profile, LinkedIn, Companies House page), add their URLs to `sameAs` in the Organization JSON-LD.
- `robots.txt` allows all search and AI crawlers, including Google-Extended, GPTBot, ClaudeBot and PerplexityBot. `llms.txt` and `llms-full.txt` give AI tools a plain-text summary and the full text of the site.

## Quote form spam protection

Set these variables in the existing **fireriskscotland** Vercel project, then redeploy:

- `RESEND_API_KEY`: existing Resend sending key.
- `QUOTE_FROM_EMAIL`: existing verified sender, default `Fire Risk Scotland <quotes@fireriskscotland.com>`.
- `QUOTE_TO_EMAIL`: optional business recipient, default `info@scottishenergyservices.co.uk`.
- `TURNSTILE_SITE_KEY`: public Cloudflare Turnstile site key.
- `TURNSTILE_SECRET_KEY`: matching secret; keep it server-side and out of Git.

Use a managed Turnstile widget with `fireriskscotland.com` in its allowed hostnames. Reusing the SES widget is supported after adding this hostname; preserve its existing SES hostnames and keys. The form uses the action `quote`, and the server checks both that action and the exact Fire Risk hostname. The SES endpoint still validates its own hostname and action independently. Never deploy Cloudflare test keys to production.

The static form fetches only the public site key through `GET /api/quote/`; no build step is needed. The submit handler verifies each token using [Cloudflare Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) before either the business notification or customer confirmation can be sent. Failed, expired, reused, wrong-hostname and wrong-action tokens are rejected. Provider outages and missing keys fail closed, with phone and email alternatives. Failed submissions retain the visitor's details and reset the token for a fresh check.

Both GET configuration and POST submissions require Vercel's trusted `x-vercel-ip-country` header to be `GB`, the UK country code. Non-UK and unknown locations are rejected before CAPTCHA or email calls; a form field or `cf-ipcountry` header cannot override the result. Normal pages remain available worldwide. The restriction is based on the connecting IP, so a UK VPN exit can pass the country check, while an overseas VPN exit or a UK customer abroad will need to use phone or email. Country blocking does not establish residency or eliminate all spam.

The endpoint also retains its honeypot and timing trap, limits request size, and rejects unsupported content types and cross-site submissions. No in-memory rate limiter is used: serverless instance counters are not durable. An optional Vercel Firewall rate limit can be added specifically for POST `/api/quote` and `/api/quote/` after checking current plan support and shared-network traffic.

Run the dependency-free server checks with `node --test tests/quote.test.cjs`. They mock Cloudflare and Resend; no email is sent. Browser checks should cover a successful submission, missing/expired checks, blocked-country responses, retry after errors, and mobile layout. Local browser mocks are not evidence of a real Cloudflare solve. A plain static server cannot run the API; production geolocation is supplied by [Vercel](https://vercel.com/docs/headers/request-headers).

## Backlink from Scottish Energy Services

Suggested link on the SES fire risk assessment section, with descriptive anchor text:

```html
<p>Our specialist fire risk assessment team operates as
<a href="https://fireriskscotland.com/">Fire Risk Scotland</a>, covering HMOs,
short-term lets, workplaces and blocks of flats across Scotland.</p>
```

Suggested addition to the SES Organization structured data:

```json
"subOrganization": { "@type": "ProfessionalService", "name": "Fire Risk Scotland", "url": "https://fireriskscotland.com/" }
```

Don't copy this site's text onto the SES site. Two sites with the same text compete with each other in search results.

## Pages

Home, fire risk assessments, HMOs, short-term lets, workplaces, hotels and care homes, blocks of flats, fire safety law in Scotland, choosing an assessor, cost, FAQ (27 questions), areas we cover, Glasgow, Edinburgh, about, contact, privacy, 404.
