# DocGenie Global website — AWS guide

Running guide for moving `www.docgenieglobal.com` off the EC2 server onto AWS Lambda.
Someone new should be able to carry on from this file alone. Keep it up to date.

---

## 1. What this is

The website (this repo, Next.js 16, Pages Router) runs today on an EC2 server: Apache
(behind a load balancer) proxies to `next start`. It is moving to:

```
Browser → Route 53 → CloudFront (HTTPS, www redirect, edge cache)
   ├─ /apis/*, /s/*  → API Gateway gms-api           (NOT this project: the API, repo API-Nodejs-Global)
   └─ everything else → Lambda "docgenieglobal-website" (Function URL)
                         = the same Next.js server as `next start`, run by the AWS Lambda Web Adapter
```

- The whole website (pages, images, `_next/static`, `/api/contact`, `/api/sitemap.xml`)
  is one Lambda zip. Next.js inside it does all redirects, trailing slashes, security
  headers, the 404 page and the sitemap exactly as on EC2.
- CloudFront (set up by the team, not by code here) adds HTTPS, the
  `docgenieglobal.com → www` redirect (a small CloudFront Function) and edge caching.
- The **Lambda Web Adapter** is an AWS-maintained, free Lambda layer. A Lambda receives
  requests as JSON events; the adapter starts `node server.js` inside the Lambda and
  turns each event into a normal HTTP request to it (like Apache's proxy does today).

## 2. Status

| Date | Step | State |
|---|---|---|
| 2026-10-31 | Branch `aws-migration`; site inspected; plan verified (no SSR, all 59 pages pre-rendered) | done |
| 2026-10-31 | Lambda build, local run, CloudFront Function, tests, comparison checker | done: local run = live (245 URLs, only the expected build date differs) |
| 2026-10-31 | Windows-built zip checked on Linux; builder fixed for time zone (UTC) and `public/` line endings | done |
| 2026-11-01 | Lambda `docgenieglobal-website` deployed (Function URL) | done |
| 2026-11-01 | Turnstile test-mode switch; site key read at runtime from the Lambda's settings | done |
| 2026-11-14 | Contact form works on the Lambda | done |
| — | CloudFront distribution, compare its address with live (`aws\compare-aws.cmd`) | pending (team) |
| — | Before switch-over: remove `TURNSTILE_TEST_MODE`; remove the Lambda host from Cloudflare's hostnames and from `TURNSTILE_HOSTNAMES` | pending |
| — | Switch-over (DNS), then retire EC2 + load balancer | pending |

## 3. Decisions

| Date | Decision |
|---|---|
| 2026-10-31 | The **whole website runs in one Lambda** (Next.js standalone + Lambda Web Adapter), not a static export to S3. Same server as `next start`, so behaviour, SEO, blogs and design stay identical; real SSR would also work if added later. |
| 2026-10-31 | Lambda: Node.js 24, arm64, ap-south-1. Front door: Function URL (free) behind CloudFront. |
| 2026-10-31 | AWS Lambda Web Functions (launched 12 Oct 2026, no adapter needed) is **not used**: not available in ap-south-1 yet, pricing unpublished. The same zip contents would run on it later. |
| 2026-10-31 | `.htaccess`: only the website rules are kept. `http → https` = CloudFront "Redirect HTTP to HTTPS" (301); `docgenieglobal.com → https://www` = CloudFront Function (301). The `/solution` rules never ran (Next.js answers first with its 308s); the SPA `index.html` fallback and "existing files" rules are React-era leftovers. `/apis` and `/s` rules belong to gms-api. |
| 2026-10-31 | `http://docgenieglobal.com/x` becomes 2 redirects (→ https bare → www) instead of 1. Accepted: no SEO effect; HSTS skips the first after one visit. |
| 2026-10-31 | `apis.docgenieglobal.com` is not needed by the website any more (not on the distribution / certificate). |
| 2026-10-31 | Analytics: `NEXT_PUBLIC_GA_ID` falls back to the built-in GA4 ID in `src/lib/gaConfig.ts`; LinkedIn stays off unless `NEXT_PUBLIC_LINKEDIN_PARTNER_ID` is set. Both are build-time values (laptop `.env.local`), not Lambda settings. |
| 2026-10-31 | Contact-form errors on Lambda go to the Lambda's own log group (console), not a file. No separate CloudWatch setup. |
| 2026-10-31 | The builder runs `next build` with `TZ=UTC` (laptop is IST; EC2/Lambda are UTC). Without it the blogs' structured-data dates come out a day early (`…T18:30:00Z`). |
| 2026-10-31 | The builder ships `public/` text files exactly as stored in git (LF). Windows git checks 6 of them out with CRLF (`robots.txt`, `assets/original.js`, …), which would differ from live. |
| 2026-11-01 | **Turnstile test mode** is an explicit switch: `TURNSTILE_TEST_MODE=1` (server setting) = Cloudflare's always-pass test keys on any host. Empty keys alone still reject every submission in production, so a forgotten key can never quietly turn the bot check off. |
| 2026-11-01 | The contact form reads its **site key at runtime** from `/api/turnstile-config/` → server setting `TURNSTILE_SITE_KEY` (Lambda environment variable, changeable without a rebuild); fallback = the key built into the pages (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, as on EC2). |
| 2026-10-31 | Contact form posts to `/api/contact/` (was `/api/contact`, which cost a 308 redirect before every submission because of `trailingSlash: true`). Site change, also fine on EC2. |
| 2026-10-31 | `aws/test.mjs` runs Jest with `--experimental-strip-types` on Node 22.6–22.17 (the laptop has 22.11; Jest needs it to read `jest.config.ts`). |

## 4. Rules

- Live is never changed until the switch is approved: EC2, Apache, DNS, CloudFront, `main`.
- `TURNSTILE_TEST_MODE` must never be left on the live Lambda (the bot check is effectively off while
  it is `1`; the Lambda log shows "TEST MODE is on" for every submission).
- Live is only ever **read** (GET/HEAD). Never submit the live contact form.
- Contact-form tests: local run or the AWS address only, one at a time, every field
  marked `LAMBDA-TEST: test submission from the website migration, please ignore`.
- Never print, paste or commit setting values (Gmail OAuth, Turnstile secret, AWS keys…).
  Only names go in this guide. Never commit `.env*`, `logs/`, `node_modules/`, `.next/`,
  `out/`, zips, `results/`, `aws/dist/`. Run `node aws/secret-scan.mjs` before every commit.
- `logs/contact-errors.log` holds people's contact details: never copy, print or ship it.
  The Lambda build excludes it, and the zip builder refuses to zip any `logs/` or `.env*`.
- The EC2 build must keep working: everything AWS-specific is behind `LAMBDA_BUILD=1`
  or inside `aws/`.

## 5. Run it locally (Windows, double-click in `aws\`)

Needs Node 22+ (Lambda runs 24) and internet (the build downloads the Poppins font).

The Turnstile site key does **not** need to be in any file for the AWS build: the form reads it at
runtime from the Lambda setting `TURNSTILE_SITE_KEY` (6.1). A `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in
`.env.local` is only a fallback built into the pages.
`results\build-lambda.txt` shows `set` / `NOT SET` for the `NEXT_PUBLIC_*` values at the top.
Server-side values (Gmail, receiver, Turnstile secret, hostnames) are never put in the zip (the
build's safety check refuses if one is found); they go in the Lambda's environment variables (6.1).
Contact-form tests on the laptop: `npm run dev` (empty keys = Cloudflare test keys), or
`run-local.cmd` with `TURNSTILE_TEST_MODE=1` in `.env.local` (it runs in production mode, where
empty keys alone reject every submission).
Every script writes its output to `results\` (ignored by git).

| File | What it does | Result file |
|---|---|---|
| `aws\build-lambda.cmd` | `next build` with `LAMBDA_BUILD=1`, assembles `aws\dist\lambda`, safety check (no logs, no `.env`, no secret values inside), writes `aws\dist\docgenieglobal-website.zip` | `results\build-lambda.txt` |
| `aws\run-local.cmd` | runs exactly what is in the zip (`node server.js`) with the CloudFront Function in front, on http://localhost:3000/ . Server settings come from `.env.local`; behaves as on Lambda (contact errors go to the console) | `results\run-local.txt` |
| `aws\test.cmd` | site Jest tests + AWS tests | `results\tests.txt` |
| `aws\compare-local.cmd` | live vs the local run (keep run-local open) | `results\compare-local.txt` / `.json` |
| `aws\compare-aws.cmd` | live vs an AWS address (asks for it, e.g. the `…cloudfront.net` address) | `results\compare-<name>.txt` |

What the comparison checks (read-only on live): every page (live sitemap + `src/pages` +
the build's page list) with and without the trailing slash, every redirect in the build,
the bare-domain redirect (local run only), the 404 page, `/api/contact` (GET only), the
sitemap body and headers, every file in `public/`, the security headers, `Content-Type`,
`Cache-Control`, and per page: title, description, robots, canonical, hreflang, Open
Graph, Twitter, structured data, h1, analytics tags, visible text, links and images.
Each difference is listed with its likely cause. Expected: the White Label solutions page
prints its build date ("Last updated: …"), so it differs after any rebuild (EC2 too).

The normal `npm run build` / `next start` / `npm run dev` are unchanged.

## 6. Deploy (AWS console) and updating the site

### 6.1 Lambda (once)

Lambda console, region **Asia Pacific (Mumbai) ap-south-1** → Create function → Author from scratch:

| Setting | Value |
|---|---|
| Name | `docgenieglobal-website` |
| Runtime | Node.js 24.x |
| Architecture | arm64 |
| Execution role | Create a new role with basic Lambda permissions (name it `docgenieglobal-website-role`) |

Then:
1. **Code** → Upload from → .zip file → `aws\dist\docgenieglobal-website.zip`.
2. **Runtime settings** → Edit → Handler: `run.sh`.
3. **Layers** → Add a layer → Specify an ARN:
   `arn:aws:lambda:ap-south-1:753240598075:layer:LambdaAdapterLayerArm64:30`
   (AWS's own published layer; check https://github.com/aws/aws-lambda-web-adapter for a newer version number).
4. **Configuration → General**: Memory 1024 MB, Timeout 20 s.
5. **Configuration → Environment variables** (names only here; values from the EC2 server's `.env.local` / the team's secret store):

   | Name | Purpose / where the value comes from |
   |---|---|
   | `AWS_LAMBDA_EXEC_WRAPPER` | `/opt/bootstrap` (starts the Web Adapter) |
   | `PORT` | `8080` (port the adapter talks to) |
   | `AWS_LWA_READINESS_CHECK_PATH` | `/robots.txt` (quick "server is up" check) |
   | `GMAIL_USER` | contact form: Gmail account that sends (EC2 `.env.local`) |
   | `GOOGLE_CLIENT_ID` | Gmail OAuth (EC2 `.env.local`) |
   | `GOOGLE_CLIENT_SECRET` | Gmail OAuth (EC2 `.env.local`) |
   | `GOOGLE_REFRESH_TOKEN` | Gmail OAuth (EC2 `.env.local`) |
   | `CONTACT_RECEIVER` | address that receives form mails (EC2 `.env.local`) |
   | `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret (EC2 `.env.local`). If empty, every submission is rejected (safe default). |
   | `TURNSTILE_HOSTNAMES` | comma-separated hosts the form is served from: `www.docgenieglobal.com,docgenieglobal.com` |
   | `TURNSTILE_SITE_KEY` | Cloudflare Turnstile **site** key (public; EC2 `.env.local` `NEXT_PUBLIC_TURNSTILE_SITE_KEY`). Read by the form at page load; change it here without a rebuild. |
   | `TURNSTILE_TEST_MODE` | **testing only**: `1` = Cloudflare test keys on any host (e.g. the Function URL). Remove before the switch-over: while it is on, the bot check is effectively off. |

6. **Configuration → Function URL** → Create: see 7.3 for the auth type.
7. Optional, recommended: **Configuration → Concurrency** → reserved concurrency 20 (caps cost if
   someone floods the site); the log group `/aws/lambda/docgenieglobal-website` → retention 30 days
   (contact-error entries contain people's details).

Quick check: open the Function URL + `/robots.txt` (only if auth type is NONE) or the
CloudFront address once 7 is done.

### 6.2 Updating the site afterwards

| Change | Steps |
|---|---|
| Pages, text, blogs, images, API code | edit → `aws\build-lambda.cmd` → Lambda console → Code → Upload from .zip → CloudFront → Invalidations → `/*` |
| Secrets / receiver address | Lambda → Configuration → Environment variables (no build) |
| `NEXT_PUBLIC_*` values | change `.env.local` on the build laptop → rebuild + upload + invalidation |

Before uploading, optional: `aws\run-local.cmd` + `aws\compare-local.cmd`.

## 7. CloudFront needs (built by the team)

### 7.1 Distribution
- Alternate domain names: `www.docgenieglobal.com`, `docgenieglobal.com`
  (`apis.docgenieglobal.com` not needed by the website).
- Certificate: ACM in **us-east-1** covering both names.
- Default root object: leave empty. Custom error pages: none (Next.js serves its own 404).

### 7.2 Origins
| Origin | Domain | Notes |
|---|---|---|
| website | the Function URL host `xxxx.lambda-url.ap-south-1.on.aws` (no `https://`, no path) | HTTPS only; Origin Access Control if 7.3 = OAC |
| gms-api | (team's existing setup) | not part of this project |

### 7.3 Lambda Function URL access (decision pending, see 11)
- **A. OAC (recommended):** Function URL auth type `AWS_IAM`, CloudFront OAC of type
  *Lambda*, signing "Always"; Lambda resource policy allows `cloudfront.amazonaws.com`
  for this distribution (the console offers the policy). Only CloudFront can reach the
  Lambda. Needs one small site change: CloudFront OAC requires POST bodies to carry an
  `x-amz-content-sha256` header, so the contact form must send it.
- **B. Open URL:** auth type `NONE`. Simpler, but the Lambda's own address also serves the
  whole site to anyone who finds it.

### 7.4 Behaviours (order matters)
| # | Path | Origin | Notes |
|---|---|---|---|
| 1 | `/apis/*` | gms-api | team's existing rules (HTTPS only) |
| 2 | `/s/*` | gms-api | team's existing rules |
| 3 | Default (`*`) | website | see below |

Default behaviour:
- Viewer protocol policy: **Redirect HTTP to HTTPS**
- Allowed methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE (the form POSTs to `/api/contact`)
- Cache policy: custom `docgenieglobal-website-cache` — TTL min 0 / default 86400 / max 31536000;
  cache key: no headers, no cookies, no query strings; Gzip + Brotli on.
  (Pages send no `Cache-Control`, so they use the default 1 day; each deploy is followed by an
  invalidation `/*`. `_next/static` sends `immutable`, the sitemap its own `s-maxage=86400`,
  the 404 page `no-store`; POSTs are never cached.)
- Origin request policy: managed **AllViewerExceptHostHeader** (the Function URL needs its own Host).
- Response headers policy: **none** (Next.js already sends the security headers; a policy would duplicate them).
- Function association: Viewer request → CloudFront Function `docgenieglobal-website-www-redirect`
  (runtime cloudfront-js-2.0), code = `aws/cloudfront/www-redirect.js` (copy-paste, Publish).

## 8. Switch-over and rollback

Before: the AWS address passes `aws\compare-aws.cmd` (only the expected build-date difference),
and one marked contact-form test arrives.

Switch-over:
1. Note the current Route 53 records for `www.docgenieglobal.com` and `docgenieglobal.com`
   (they point at the load balancer). Lower their TTL a day before if they are not aliases.
2. Change both records to an **alias to the CloudFront distribution**.
3. Check: `https://www.docgenieglobal.com/`, `http://docgenieglobal.com/about/` (→ https www),
   a blog page, `/sitemap.xml`, `/apis/...` and a `/s/...` link (gms-api), and run
   `aws\compare-aws.cmd` with `https://www.docgenieglobal.com` as target (should compare live vs itself = clean).
4. Keep EC2 and the load balancer running (unchanged) for at least 7 days.

Rollback (any time in those 7 days): point both Route 53 records back to the load balancer
(the values noted in step 1). Nothing else to undo; the Lambda can stay.

Afterwards: stop, then terminate EC2; delete the load balancer and its target group
(≈ $16–25/month by itself); remove `apis.docgenieglobal.com` DNS once nothing calls it.

## 9. Settings by function (names only)

| Function | Settings | Where |
|---|---|---|
| Contact form mail | `GMAIL_USER`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `CONTACT_RECEIVER` | Lambda env vars |
| Contact form bot check | `TURNSTILE_SECRET_KEY`, `TURNSTILE_HOSTNAMES`, `TURNSTILE_SITE_KEY`, `TURNSTILE_TEST_MODE` (testing only) | Lambda env vars |
| Contact form bot check, fallback | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (build time, optional) | laptop `.env.local` / EC2 `.env.local` |
| Analytics | `NEXT_PUBLIC_GA_ID` (optional, has a built-in fallback), `NEXT_PUBLIC_LINKEDIN_PARTNER_ID` (optional) | laptop `.env.local` |
| Web Adapter | `AWS_LAMBDA_EXEC_WRAPPER`, `PORT`, `AWS_LWA_READINESS_CHECK_PATH` | Lambda env vars |
| Build switch | `LAMBDA_BUILD=1` (set by `aws/build-lambda.mjs` only) | — |

## 10. Known issues / site changes made

Code changes on `aws-migration` (none change the EC2 build):
- `next.config.ts`: when `LAMBDA_BUILD=1`, `output: "standalone"` and the build excludes
  `logs/**` (contact details), `sharp`/`@img` (only for `next/image`, unused, wrong CPU) and `typescript`.
- `src/lib/contactLogger.ts`: on Lambda (`AWS_LAMBDA_FUNCTION_NAME` set) the error entry is
  written to the console; elsewhere still to `logs/contact-errors.log`.
- `tsconfig.json`, `eslint.config.mjs`, `jest.config.ts`: ignore `aws/dist`. `.gitignore`: `aws/dist`, zips, `results/`. `jest.config.ts` also maps the `@/` import alias.
- Turnstile (2026-11-01): `src/lib/turnstile.ts` (test-mode switch `TURNSTILE_TEST_MODE=1`),
  `src/lib/turnstileConfig.ts` (test site key, config URL), new route `src/pages/api/turnstile-config.ts`
  (returns the site key, `Cache-Control: no-store`), `src/components/contact/TurnstileWidget.tsx`
  (asks that route on load, falls back to the built-in key), tests `src/lib/__tests__/turnstile.test.ts`.
  On EC2 nothing changes for visitors: without the new settings the route returns the built-in key.
- `src/components/contact/ContactForm.tsx`: posts to `/api/contact/` (trailing slash), saving one redirect per submission.
- New: `aws/` (scripts, CloudFront Function, tests), `.gitattributes` (`.cmd` CRLF), this guide.

Known:
- The White Label solutions page and its structured data print the **build date** as
  "Last updated" (`QuickAnswerSection.tsx`, `SchemaData.ts`). Existing behaviour.
- Without Turnstile secret the form rejects everything in production; use `TURNSTILE_TEST_MODE=1` to test on a non-live host. Empty keys = test keys only under `npm run dev`.
- After changing a Lambda environment variable, the next request starts a fresh copy (a cold start, ~1–2 s).
- `npm test` on Node older than 22.18 fails ("ts-node is required"): existed before this work. `aws\test.cmd` works around it; installing Node 24 fixes it for `npm test` too.
- The comparison treats a date-only difference as expected **only** on `/solutions/white-label-telemedicine/` (it prints its build date). Anywhere else a date difference is reported.
- Cold start: the first request after a quiet period takes ~1–2 s; CloudFront's cache hides most of it.

## 11. Pending

- Function URL access: OAC (needs the small contact-form header change) or open URL — team decision.
- CloudFront distribution and the comparison of its address with live (see 2).
- Before the switch-over: `TURNSTILE_TEST_MODE` removed; the Lambda host removed from Cloudflare's widget hostnames and from `TURNSTILE_HOSTNAMES`.
- Image folders (`public/lovable-uploads`): no move/rename until the team decides (with SEO);
  if moved, permanent redirects for every old image address and the checker verifying each.
- Monthly cost estimate: Lambda $0 (free tier), CloudFront $0 (free tier), logs a few cents → under $1/month.
