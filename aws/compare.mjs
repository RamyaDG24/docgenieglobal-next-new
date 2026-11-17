// Comparison checker: live site vs the AWS version (local run or a CloudFront address).
// READ-ONLY on live: only GET and HEAD requests are ever sent; no form is submitted.
//
//   node aws/compare.mjs                                  live vs http://localhost:3000 (local run)
//   node aws/compare.mjs --target https://dxxxx.cloudfront.net
//   node aws/compare.mjs --live https://www.docgenieglobal.com --target <url>
//
// Checks: every page URL (live sitemap + src/pages + the build's page list) with
// and without the trailing slash, every redirect in the build, the bare-domain
// redirect, the 404 page, the sitemap (body + headers), every file in public/,
// the security headers, Cache-Control, Content-Type, and for each HTML page the
// SEO parts (title, description, canonical, robots, Open Graph, structured data,
// analytics tags), the visible text, links and images.
// Results: results/compare-<target>.txt (+ .json). Exit code 1 if anything differs.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import crypto from "node:crypto";
import { ROOT, LAMBDA_DIR, resultsLog, walk } from "./lib/common.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith("--") ? [...a, [v.slice(2), all[i + 1]]] : a), [])
);
const LIVE = (args.live || "https://www.docgenieglobal.com").replace(/\/$/, "");
const TARGET = (args.target || "http://localhost:3000").replace(/\/$/, "");
const APEX_HOST = "docgenieglobal.com";
const targetIsLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(TARGET);
const label = targetIsLocal ? "local" : new URL(TARGET).hostname.split(".")[0];
const log = resultsLog("compare-" + label);

// ---------------------------------------------------------------- HTTP (GET/HEAD only)
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || "";
function tunnel(host, port) {
  return new Promise((resolve, reject) => {
    const p = new URL(proxyUrl);
    const req = http.request({ host: p.hostname, port: p.port || 80, method: "CONNECT", path: `${host}:${port}`,
      headers: p.username ? { "Proxy-Authorization": "Basic " + Buffer.from(decodeURIComponent(p.username) + ":" + decodeURIComponent(p.password)).toString("base64") } : {} });
    req.on("connect", (res, socket) => (res.statusCode === 200 ? resolve(socket) : reject(new Error("proxy CONNECT " + res.statusCode))));
    req.on("error", reject);
    req.end();
  });
}
async function request(base, pathname, { method = "GET", host } = {}) {
  if (method !== "GET" && method !== "HEAD") throw new Error("read-only checker: " + method + " not allowed");
  const u = new URL(base + pathname);
  const isHttps = u.protocol === "https:";
  const port = Number(u.port || (isHttps ? 443 : 80));
  const local = /^(localhost|127\.0\.0\.1)$/.test(u.hostname);
  const opts = { method, host: u.hostname, port, path: u.pathname + u.search, headers: { "accept-encoding": "identity", "user-agent": "docgenie-migration-compare/1.0", host: host || u.host }, servername: host || u.hostname };
  if (isHttps && proxyUrl && !local) {
    const socket = await tunnel(host || u.hostname, port);
    const agent = new https.Agent({ keepAlive: false });
    agent.createConnection = () => tls.connect({ socket, servername: host || u.hostname });
    opts.agent = agent;
  }
  return new Promise((resolve, reject) => {
    const req = (isHttps ? https : http).request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(30000, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}
async function withRetry(fn) {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) { if (i >= 2) return { error: e.message }; await new Promise((r) => setTimeout(r, 1000 * (i + 1))); }
  }
}

// ---------------------------------------------------------------- what to check
const HEADERS = ["content-type", "cache-control", "x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy", "strict-transport-security"];

function pagesFromSrc() {
  const dir = path.join(ROOT, "src", "pages");
  return walk(dir)
    .filter((f) => /\.(tsx|ts|jsx|js)$/.test(f) && !f.startsWith("api/") && !/(^|\/)(_app|_document|_error|404|500)\./.test(f) && !f.includes("[") && !f.includes("__tests__"))
    .map((f) => "/" + f.replace(/\.(tsx|ts|jsx|js)$/, "").replace(/(^|\/)index$/, ""))
    .map((p) => (p === "/" ? "/" : p.replace(/\/$/, "") + "/"));
}
function fromManifest(name) {
  for (const dir of [path.join(LAMBDA_DIR, ".next"), path.join(ROOT, ".next")]) {
    const f = path.join(dir, name);
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  }
  return null;
}
const slash = (p) => (p === "/" || p.endsWith("/") || /\.[a-z0-9]+$/i.test(p) ? p : p + "/");

// ---------------------------------------------------------------- HTML → comparable parts
function seo(html) {
  const s = html.toString("utf8");
  const pick = (re) => [...s.matchAll(re)].map((m) => m[1]);
  const attr = (name, key = "name") => pick(new RegExp(`<meta[^>]*${key}="${name}"[^>]*content="([^"]*)"`, "gi")).concat(pick(new RegExp(`<meta[^>]*content="([^"]*)"[^>]*${key}="${name}"`, "gi")));
  const jsonld = pick(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  const body = s.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const text = body.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const norm = (u) => u.replace(/^https:\/\/www\.docgenieglobal\.com/, "");
  const links = [...new Set(pick(/<a[^>]*href="([^"#]*)"/gi).map(norm))].sort();
  const images = [...new Set(pick(/<img[^>]*src="([^"]*)"/gi).map(norm))].sort();
  return {
    title: pick(/<title[^>]*>([\s\S]*?)<\/title>/gi).join(" | "),
    description: attr("description").join(" | "),
    robots: attr("robots").join(" | "),
    canonical: pick(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/gi).join(" | "),
    hreflang: pick(/<link[^>]*hreflang="([^"]*)"/gi).sort().join(","),
    openGraph: ["og:title", "og:description", "og:image", "og:url", "og:type"].map((k) => k + "=" + attr(k, "property").join("|")).join(" ; "),
    twitter: ["twitter:card", "twitter:title", "twitter:image"].map((k) => k + "=" + attr(k).join("|")).join(" ; "),
    _jsonld: jsonld.join("\n"),
    structuredData: jsonld.length + " block(s), sha " + crypto.createHash("sha1").update(jsonld.join("\n")).digest("hex").slice(0, 12),
    h1: pick(/<h1[^>]*>([\s\S]*?)<\/h1>/gi).map((h) => h.replace(/<[^>]+>/g, "").trim()).join(" | "),
    analytics: [/googletagmanager\.com|gtag\(/.test(s) ? "google" : "", /snap\.licdn\.com|_linkedin_partner_id/.test(s) ? "linkedin" : ""].filter(Boolean).join(",") || "none",
    textSha: crypto.createHash("sha1").update(text).digest("hex").slice(0, 12),
    _text: text,
    links: links.length + " link(s), sha " + crypto.createHash("sha1").update(links.join("\n")).digest("hex").slice(0, 12),
    _links: links,
    images: images.length + " image(s), sha " + crypto.createHash("sha1").update(images.join("\n")).digest("hex").slice(0, 12),
    _images: images,
  };
}

// A page that prints the date it was built (e.g. "Last updated: October 31, 2026")
// differs after every rebuild, on EC2 as well. Such differences are reported as expected.
const EXPECTED_DATES = "EXPECTED: only dates differ (the page prints its build date; changes with every rebuild, on EC2 too)";
// Only these pages print their build date (QuickAnswerSection.tsx, SchemaData.ts).
// A date difference anywhere else is a real difference (e.g. a time-zone shift).
const BUILD_DATE_PAGES = ["/solutions/white-label-telemedicine/"];
const stripDates = (t) => t
  .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b/g, "<date>")
  .replace(/\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?/g, "<date>");

function normLocation(loc, base) {
  if (!loc) return "";
  const origin = new URL(base).origin;
  return loc.startsWith(origin) ? loc.slice(origin.length) || "/" : loc;
}

function cause(field, a, b, kind) {
  if (a === "(error)" || b === "(error)") return "request failed (network or the local run is not started)";
  if (field === "status" && b === "404") return "missing in the AWS build (page not built, or file not in public/)";
  if (field === "status") return "different response: check the redirect rules / page code for this path";
  if (field === "location") return "redirect target differs: compare next.config.ts redirects and the CloudFront Function";
  if (field === "cache-control") return "caching header differs: set by Next.js (or Apache on live); CloudFront must not override it";
  if (field === "content-type") return "file type header differs (server MIME mapping)";
  if (HEADERS.includes(field)) return "security header differs: set in next.config.ts headers()";
  if (field === "content-length" || field === "bytes") return kind === "file" ? "file differs: public/ on this branch is not the same as on the live server" : "response size differs";
  if (field === "analytics") return "analytics IDs differ: NEXT_PUBLIC_GA_ID / NEXT_PUBLIC_LINKEDIN_PARTNER_ID not set the same at build time";
  if (field === "body") return "sitemap XML differs: blog data or sitemap code differs from the live build";
  return "page content differs: live is probably built from a different commit (or build-time values differ)";
}

// ---------------------------------------------------------------- run
const checks = [];
const add = (kind, pathname, opts = {}) => checks.push({ kind, path: pathname, ...opts });

log(`Live:   ${LIVE}   (read-only: GET/HEAD only)`);
log(`Target: ${TARGET}`);
log("");

const sm = await withRetry(() => request(LIVE, "/api/sitemap.xml"));
const sitemapPaths = sm.body ? [...sm.body.toString().matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname) : [];
const prerender = fromManifest("prerender-manifest.json");
const routes = fromManifest("routes-manifest.json");
const pages = new Set([...sitemapPaths, ...pagesFromSrc(), ...Object.keys(prerender?.routes || {}).filter((r) => !/^\/(404|500)$/.test(r)).map(slash)].map(slash));
log(`Pages: ${pages.size} (live sitemap ${sitemapPaths.length}, src/pages ${pagesFromSrc().length}, build list ${Object.keys(prerender?.routes || {}).length || "n/a — build first"})`);

for (const p of [...pages].sort()) {
  add("page", p);
  if (p !== "/") add("redirect", p.replace(/\/$/, ""));
}
const redirectSources = (routes?.redirects || []).filter((r) => !r.internal).map((r) => r.source);
for (const src of redirectSources) {
  if (src.includes(":")) add("redirect", src.replace(/\/:path\*.*$/, "/ai-capabilities").replace(/:[a-z]+\*?/gi, "x"));
  else add("redirect", src);
}
log(`Redirect rules in the build: ${redirectSources.length || "n/a — build first"}`);
for (const p of ["/sitemap.xml", "/solution", "/solution/", "/solution/ai-capabilities/", "/no-such-page/", "/no-such-page", "/blogs/no-such-post/", "/api/contact", "/api/contact/"]) add("special", p);
add("sitemap", "/api/sitemap.xml");
for (const f of walk(path.join(ROOT, "public")).filter((f) => !f.split("/").some((part) => part.startsWith(".")))) add("file", "/" + f.split("/").map(encodeURIComponent).join("/"), { method: "HEAD" });
if (targetIsLocal) for (const p of ["/", "/about/", "/blogs/?utm_source=test"]) add("apex", p, { host: APEX_HOST });
else log("Bare-domain redirect: only checked against the local run (it needs the docgenieglobal.com DNS name).");
log(`Total checks: ${checks.length} (each sent to live and to the target)`);
log("");

const seen = new Set();
const unique = checks.filter((c) => { const k = c.kind + (c.host || "") + c.path; if (seen.has(k)) return false; seen.add(k); return true; });

const diffs = [];
let done = 0;
async function runCheck(c) {
  const liveBase = c.host ? `https://${c.host}` : LIVE;
  const [a, b] = await Promise.all([
    withRetry(() => request(liveBase, c.path, { method: c.method || "GET" })),
    withRetry(() => request(TARGET, c.path, { method: c.method || "GET", host: c.host })),
  ]);
  const row = (field, x, y) => { if (x !== y) diffs.push({ kind: c.kind, path: (c.host ? c.host : "") + c.path, field, live: x, target: y, cause: cause(field, x, y, c.kind) }); };
  if (a.error || b.error) { row("status", a.error ? "(error)" : String(a.status), b.error ? "(error)" : String(b.status)); return; }
  row("status", String(a.status), String(b.status));
  row("location", normLocation(a.headers.location, liveBase), normLocation(b.headers.location, TARGET));
  for (const h of HEADERS) {
    if (h === "content-type" && a.status >= 300 && a.status < 400) continue;
    row(h, a.headers[h] || "", b.headers[h] || "");
  }
  if (c.kind === "file") row("content-length", a.headers["content-length"] || "", b.headers["content-length"] || "");
  if (c.kind === "sitemap") row("body", crypto.createHash("sha1").update(a.body).digest("hex"), crypto.createHash("sha1").update(b.body).digest("hex"));
  if (a.status === 200 && /text\/html/.test(a.headers["content-type"] || "") && b.status === 200) {
    const x = seo(a.body), y = seo(b.body);
    for (const k of Object.keys(x).filter((k) => !k.startsWith("_"))) {
      if (x[k] === y[k]) continue;
      let lv = x[k], tv = y[k];
      if (k === "textSha") {
        let i = 0; while (i < x._text.length && x._text[i] === y._text[i]) i++;
        lv = "…" + x._text.slice(Math.max(0, i - 40), i + 60) + "…"; tv = "…" + y._text.slice(Math.max(0, i - 40), i + 60) + "…";
      }
      if (k === "links" || k === "images") {
        const only = (p, q) => p.filter((v) => !q.includes(v)).slice(0, 5).join(" ");
        lv = x[k] + " | only live: " + only(x["_" + k], y["_" + k]); tv = y[k] + " | only target: " + only(y["_" + k], x["_" + k]);
      }
      const field = k === "textSha" ? "visible text" : k;
      const onlyDates = (k === "textSha" && stripDates(x._text) === stripDates(y._text)) || (k === "structuredData" && stripDates(x._jsonld) === stripDates(y._jsonld));
      if (BUILD_DATE_PAGES.includes(c.path) && onlyDates) {
        diffs.push({ kind: c.kind, path: c.path, field, live: lv, target: tv, cause: EXPECTED_DATES, expected: true });
        continue;
      }
      row(field, lv, tv);
    }
  }
}
const queue = [...unique];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    await runCheck(queue.shift());
    if (++done % 50 === 0) process.stdout.write(`  ${done}/${unique.length} checked\n`);
  }
}));

// ---------------------------------------------------------------- report
log(`Checked ${unique.length} URLs on both sides.`);
log("");
const expected = diffs.filter((d) => d.expected);
const real = diffs.filter((d) => !d.expected);
if (!real.length) {
  log(`RESULT: NO DIFFERENCES. Every page, redirect, header, file and the sitemap match live.${expected.length ? ` (${expected.length} expected date-only difference(s) listed below.)` : ""}`);
}
if (diffs.length) {
  const byCause = {};
  for (const d of diffs) (byCause[d.cause] ||= []).push(d);
  if (real.length) log(`RESULT: ${real.length} DIFFERENCE(S) that need a look, grouped by cause:`);
  for (const [why, list] of Object.entries(byCause)) {
    log("");
    log(`== ${why}  (${list.length})`);
    for (const d of list.slice(0, 40)) {
      log(`  [${d.kind}] ${d.path}  ${d.field}`);
      log(`      live:   ${String(d.live).slice(0, 300)}`);
      log(`      target: ${String(d.target).slice(0, 300)}`);
    }
    if (list.length > 40) log(`  … and ${list.length - 40} more (see the .json file)`);
  }
}
fs.writeFileSync(log.file.replace(/\.txt$/, ".json"), JSON.stringify({ live: LIVE, target: TARGET, checked: unique.length, diffs }, null, 2));
process.exit(real.length ? 1 : 0);
