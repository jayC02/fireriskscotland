# fireriskscotland.com: static site

The `fireriskscotland/` folder is the complete site. It has no build step, so you can upload it to any static host as it is.

## Deploy

- **Vercel:** deploy the `fireriskscotland/` folder as a static project. `vercel.json` sets clean URLs, trailing slashes, cache headers for `/assets/`, security headers, and a `www` to apex redirect. Then add `fireriskscotland.com` and `www.fireriskscotland.com` as domains.
- **Any other host:** upload the folder and serve `404.html` as the not-found page.
- The canonical domain is `https://fireriskscotland.com` (no `www`). Each page's canonical tag, `sitemap.xml` and the structured data all use it.

## Before going live

1. **Quote form:** `contact/index.html` has `data-endpoint=""` on the form. Put a Formspree, Basin or own API URL there to receive submissions. While it is empty, the form opens a pre-filled email to info@fireriskscotland.com.
2. **Mailbox:** set up info@fireriskscotland.com, or find and replace it across the site.
3. **Raj's photo:** `assets/img/raj-chall.jpg` and `.webp` are 186px, cropped from the photo supplied. A professional headshot at 600px or more would look sharper. Keep the same file names.
4. **IFE register number:** add it to the About page if you want it shown.
5. **Privacy notice:** check `/privacy/`, especially the 12-month retention line and the statement that the site uses no tracking cookies. Both need changing if you add analytics.
6. **Prices:** the only published figure is "from £225 + VAT" for smaller premises, taken from the SES site. Adding "from" prices for medium and large premises on `/fire-risk-assessment-cost/` would help AI answers quote you.

## After going live (SEO and GEO)

- Add the site to Google Search Console and Bing Webmaster Tools, and submit `https://fireriskscotland.com/sitemap.xml`. Gemini and Google's AI Overviews draw on Google's index, so this is the step that matters most.
- Create a Google Business Profile for Fire Risk Scotland using the same name, address and phone number as the site.
- Once profiles exist (Google Business Profile, LinkedIn, Companies House page), add their URLs to `sameAs` in the Organization JSON-LD.
- `robots.txt` allows all search and AI crawlers, including Google-Extended, GPTBot, ClaudeBot and PerplexityBot. `llms.txt` and `llms-full.txt` give AI tools a plain-text summary and the full text of the site.

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
