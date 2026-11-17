// Loads aws/cloudfront/www-redirect.js (written for CloudFront's runtime, no
// exports) into Node so the tests and the local run use the exact same code.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT } from "./common.mjs";

export function loadCloudFrontFunction(file = path.join(ROOT, "aws", "cloudfront", "www-redirect.js")) {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(file, "utf8") + "\n;globalThis.__handler = handler;", context);
  return context.__handler;
}

/** Turns a Node request into a CloudFront Functions viewer-request event. */
export function toViewerRequestEvent(method, rawUrl, headers) {
  const q = rawUrl.indexOf("?");
  const uri = q === -1 ? rawUrl : rawUrl.slice(0, q);
  const querystring = {};
  if (q !== -1) {
    for (const pair of rawUrl.slice(q + 1).split("&")) {
      if (!pair) continue;
      const eq = pair.indexOf("=");
      const key = eq === -1 ? pair : pair.slice(0, eq);
      const value = eq === -1 ? "" : pair.slice(eq + 1);
      if (querystring[key]) {
        const item = querystring[key];
        item.multiValue = item.multiValue || [{ value: item.value }];
        item.multiValue.push({ value });
      } else querystring[key] = { value };
    }
  }
  const h = {};
  for (const [k, v] of Object.entries(headers)) h[k.toLowerCase()] = { value: Array.isArray(v) ? v.join(",") : String(v) };
  return { version: "1.0", context: { eventType: "viewer-request" }, viewer: { ip: "127.0.0.1" }, request: { method, uri, querystring, headers: h, cookies: {} } };
}
