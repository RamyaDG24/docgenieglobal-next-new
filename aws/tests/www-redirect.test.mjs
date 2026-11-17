// Tests for the CloudFront Function aws/cloudfront/www-redirect.js
// Run: node --test "aws/tests/**/*.test.mjs"   (or aws\test.cmd)
import test from "node:test";
import assert from "node:assert/strict";
import { loadCloudFrontFunction, toViewerRequestEvent } from "../lib/cloudfront-function.mjs";

const handler = loadCloudFrontFunction();
const run = (host, url, method = "GET") => handler(toViewerRequestEvent(method, url, { host }));

test("bare domain -> 301 to https://www, path kept", () => {
  const r = run("docgenieglobal.com", "/about/");
  assert.equal(r.statusCode, 301);
  assert.equal(r.headers.location.value, "https://www.docgenieglobal.com/about/");
});

test("bare domain root", () => {
  assert.equal(run("docgenieglobal.com", "/").headers.location.value, "https://www.docgenieglobal.com/");
});

test("bare domain, host in capitals", () => {
  assert.equal(run("DocGenieGlobal.com", "/pricing/").statusCode, 301);
});

test("query string kept as sent, including repeated keys and empty values", () => {
  const r = run("docgenieglobal.com", "/blogs/?utm_source=a%20b&x=1&x=2&flag=");
  assert.equal(r.headers.location.value, "https://www.docgenieglobal.com/blogs/?utm_source=a%20b&x=1&x=2&flag=");
});

test("path without trailing slash is passed on unchanged (Next.js adds the slash after)", () => {
  assert.equal(run("docgenieglobal.com", "/about").headers.location.value, "https://www.docgenieglobal.com/about");
});

test("POST to the bare domain is redirected too (same as .htaccess today)", () => {
  assert.equal(run("docgenieglobal.com", "/api/contact", "POST").statusCode, 301);
});

test("www passes through untouched", () => {
  const r = run("www.docgenieglobal.com", "/about/?a=1");
  assert.equal(r.statusCode, undefined);
  assert.equal(r.uri, "/about/");
});

test("any other host (e.g. the raw cloudfront.net address) passes through", () => {
  assert.equal(run("d1234abcd.cloudfront.net", "/").statusCode, undefined);
});
