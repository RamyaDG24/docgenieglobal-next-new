// Local run of exactly what goes into the Lambda zip (aws/dist/lambda), with
// the CloudFront Function in front, like on AWS:
//
//   browser -> http://localhost:3000  (this proxy: runs aws/cloudfront/www-redirect.js)
//           -> http://127.0.0.1:3101  (node server.js from aws/dist/lambda, as the Lambda runs it)
//
// Build first: aws\build-lambda.cmd. Stop with Ctrl+C.
// Server-side settings are taken from .env.local (names are listed, values never).
// AWS_LAMBDA_FUNCTION_NAME is set so the code behaves as on Lambda (contact
// errors go to this console, not to logs/).
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { ROOT, LAMBDA_DIR, resultsLog, readEnvFile } from "./lib/common.mjs";
import { loadCloudFrontFunction, toViewerRequestEvent } from "./lib/cloudfront-function.mjs";

const PUBLIC_PORT = Number(process.env.LOCAL_PORT || 3000);
const LAMBDA_PORT = PUBLIC_PORT + 101;
const log = resultsLog("run-local");

if (!fs.existsSync(path.join(LAMBDA_DIR, "server.js"))) {
  log("aws/dist/lambda is missing. Run aws\\build-lambda.cmd first.");
  process.exit(1);
}

const SERVER_SETTINGS = [
  "GMAIL_USER", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN",
  "CONTACT_RECEIVER", "TURNSTILE_SECRET_KEY", "TURNSTILE_HOSTNAMES",
  "TURNSTILE_SITE_KEY", "TURNSTILE_TEST_MODE",
];
const fileEnv = readEnvFile(path.join(ROOT, ".env.local"));
const childEnv = { ...process.env };
for (const k of Object.keys(childEnv)) if (k.startsWith("NEXT_PUBLIC_")) delete childEnv[k];
log("Server-side settings for the local Lambda (from .env.local):");
for (const k of SERVER_SETTINGS) {
  if (fileEnv[k]) childEnv[k] = fileEnv[k];
  log(`  ${k.padEnd(22)} ${fileEnv[k] ? "set" : "not set"}`);
}
Object.assign(childEnv, {
  PORT: String(LAMBDA_PORT),
  HOSTNAME: "127.0.0.1",
  NEXT_TELEMETRY_DISABLED: "1",
  AWS_LAMBDA_FUNCTION_NAME: "local-run",
});

const server = spawn(process.execPath, ["server.js"], { cwd: LAMBDA_DIR, env: childEnv });
server.stdout.on("data", (d) => log.raw("[lambda] " + d));
server.stderr.on("data", (d) => log.raw("[lambda] " + d));
server.on("exit", (code) => { log("Lambda server stopped (" + code + ")"); process.exit(code || 0); });

const cfHandler = loadCloudFrontFunction();
const proxy = http.createServer((req, res) => {
  const result = cfHandler(toViewerRequestEvent(req.method, req.url, req.headers));
  if (result && result.statusCode) {
    const headers = {};
    for (const [k, v] of Object.entries(result.headers || {})) headers[k] = v.value;
    res.writeHead(result.statusCode, result.statusDescription, headers);
    res.end();
    log(`${req.method} ${req.headers.host}${req.url} -> ${result.statusCode} (CloudFront Function)`);
    return;
  }
  const headers = { ...req.headers, host: `127.0.0.1:${LAMBDA_PORT}`, "x-forwarded-for": req.socket.remoteAddress || "127.0.0.1" };
  const upstream = http.request({ host: "127.0.0.1", port: LAMBDA_PORT, method: req.method, path: req.url, headers }, (up) => {
    res.writeHead(up.statusCode, up.headers);
    up.pipe(res);
  });
  upstream.on("error", (e) => { res.writeHead(502); res.end("Local Lambda not reachable: " + e.message); });
  req.pipe(upstream);
});
proxy.listen(PUBLIC_PORT, () => {
  log("");
  log(`Local run ready: http://localhost:${PUBLIC_PORT}/   (Ctrl+C to stop)`);
});
const stop = () => { server.kill(); proxy.close(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
