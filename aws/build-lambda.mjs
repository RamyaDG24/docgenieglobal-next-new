// Builds the Lambda zip: aws/dist/docgenieglobal-website.zip
//
//   1. next build with LAMBDA_BUILD=1 (standalone server; see next.config.ts)
//   2. assemble aws/dist/lambda = standalone server + public/ + .next/static + run.sh
//   3. safety check: no logs, no .env files, no secret values inside
//   4. zip it (run.sh marked executable)
//
// Run from the repo root:  node aws/build-lambda.mjs   (or aws\build-lambda.cmd)
// Results: results/build-lambda.txt
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, DIST, LAMBDA_DIR, ZIP_NAME, resultsLog, readEnvFile, walk, writeZip } from "./lib/common.mjs";

const log = resultsLog("build-lambda");
const fail = (msg) => { log(""); log("BUILD FAILED: " + msg); process.exit(1); };

// Start script the Web Adapter runs (handler = run.sh). Written here, not
// kept as a file, so Windows line endings can never break it.
const RUN_SH = [
  "#!/bin/bash",
  "# Started by the AWS Lambda Web Adapter (layer). Runs the Next.js server.",
  "export PORT=${PORT:-8080}",
  "export HOSTNAME=127.0.0.1",
  "export NEXT_TELEMETRY_DISABLED=1",
  "exec node server.js",
  "",
].join("\n");

// ---- Settings check (names only) -------------------------------------------
const envFiles = [".env", ".env.production", ".env.local", ".env.production.local"];
const env = {};
for (const f of envFiles) Object.assign(env, readEnvFile(path.join(ROOT, f)));
for (const k of Object.keys(process.env)) if (k.startsWith("NEXT_PUBLIC_")) env[k] = process.env[k];

log("Node " + process.version + " | repo " + ROOT);
log("");
log("Values written into the pages at build time (NEXT_PUBLIC_*):");
for (const k of ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "NEXT_PUBLIC_GA_ID", "NEXT_PUBLIC_LINKEDIN_PARTNER_ID"]) {
  log(`  ${k.padEnd(34)} ${env[k] ? "set" : "NOT SET"}`);
}
log("  (The contact form's Turnstile site key normally comes from the Lambda setting TURNSTILE_SITE_KEY");
log("   at runtime; NEXT_PUBLIC_TURNSTILE_SITE_KEY is only the fallback built into the pages.)");

// ---- 1. Build ----------------------------------------------------------------
fs.rmSync(DIST, { recursive: true, force: true });
log("");
log("Step 1/4: next build (LAMBDA_BUILD=1) ...");
const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
if (!fs.existsSync(nextBin)) fail("node_modules is missing. Run `npm ci` first.");
const build = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: ROOT,
  // TZ=UTC: pages that format dates at build time (blog structured data) must
  // come out exactly as on the EC2 server and the Lambda, which run in UTC.
  env: { ...process.env, LAMBDA_BUILD: "1", NEXT_TELEMETRY_DISABLED: "1", TZ: "UTC" },
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
log.raw((build.stdout || "") + (build.stderr || ""));
if (build.status !== 0) fail("next build exited with code " + build.status);

const standalone = path.join(ROOT, ".next", "standalone");
if (!fs.existsSync(path.join(standalone, "server.js"))) {
  fail(".next/standalone/server.js not found (is LAMBDA_BUILD handled in next.config.ts?)");
}

// ---- 2. Assemble ---------------------------------------------------------------
log("Step 2/4: assembling aws/dist/lambda ...");
fs.mkdirSync(LAMBDA_DIR, { recursive: true });
fs.cpSync(standalone, LAMBDA_DIR, { recursive: true });
fs.cpSync(path.join(ROOT, "public"), path.join(LAMBDA_DIR, "public"), { recursive: true });
// Windows git checks text files out with CRLF line endings; the server's copies
// (and git's) have LF. Ship such files exactly as stored in git.
const eol = spawnSync("git", ["ls-files", "--eol", "-z", "public"], { cwd: ROOT, encoding: "utf8" });
if (eol.status === 0) {
  let fixed = 0;
  for (const entry of eol.stdout.split("\0").filter(Boolean)) {
    const [info, file] = entry.split("\t");
    if (!/i\/lf/.test(info) || !/w\/(crlf|mixed)/.test(info)) continue;
    const dest = path.join(LAMBDA_DIR, file);
    fs.writeFileSync(dest, fs.readFileSync(dest).toString("latin1").replace(/\r\n/g, "\n"), "latin1");
    fixed++;
  }
  log(`  public/: ${fixed} file(s) with Windows line endings shipped as stored in git (LF).`);
} else {
  log("  WARNING: git not available; public/ text files copied as they are on disk.");
}
fs.cpSync(path.join(ROOT, ".next", "static"), path.join(LAMBDA_DIR, ".next", "static"), { recursive: true });
fs.writeFileSync(path.join(LAMBDA_DIR, "run.sh"), RUN_SH);
// Next.js copies the build-time .env files next to the server; the Lambda
// must take its settings from its own environment variables only.
for (const f of fs.readdirSync(LAMBDA_DIR)) {
  if (f.startsWith(".env")) fs.rmSync(path.join(LAMBDA_DIR, f));
}

// ---- 3. Safety check -----------------------------------------------------------
log("Step 3/4: safety check ...");
const files = walk(LAMBDA_DIR);
const problems = [];
for (const rel of files) {
  const name = rel.split("/").pop();
  if (!rel.includes("node_modules/") && rel.split("/").includes("logs")) problems.push("log folder: " + rel);
  if (name.startsWith(".env")) problems.push("settings file: " + rel);
  if (/\.(log|pem|key|zip)$/i.test(name)) problems.push("not allowed in the zip: " + rel);
}
// Server-only secret values must never be inside the bundle (they belong in
// the Lambda's environment variables). Compared in memory; never printed.
const secretNames = Object.keys(env).filter(
  (k) => !k.startsWith("NEXT_PUBLIC_") && !/SITE_KEY/.test(k) && /SECRET|TOKEN|PASSWORD|CLIENT_ID|_KEY$/.test(k) && env[k] && env[k].length >= 8
);
if (secretNames.length) {
  const needles = secretNames.map((k) => [k, Buffer.from(env[k])]);
  for (const rel of files) {
    if (!/\.(js|json|html|txt|map|css|sh|mjs|cjs|rsc)$/i.test(rel)) continue;
    const buf = fs.readFileSync(path.join(LAMBDA_DIR, rel));
    for (const [k, needle] of needles) if (buf.includes(needle)) problems.push(`value of ${k} found in ${rel}`);
  }
}
if (problems.length) {
  for (const p of problems) log("  PROBLEM: " + p);
  fail(problems.length + " problem(s) found; the zip was NOT created.");
}
log(`  OK: ${files.length} files, no logs, no .env files, no server-only setting values inside.`);

// ---- 4. Zip --------------------------------------------------------------------
log("Step 4/4: zipping ...");
const zipFile = path.join(DIST, ZIP_NAME);
const z = writeZip(LAMBDA_DIR, zipFile, ["run.sh"]);
const mb = (z.bytes / 1048576).toFixed(1);
log("");
log(`DONE: aws/dist/${ZIP_NAME}  (${z.files} files, ${mb} MB)`);
log(z.bytes < 50 * 1048576
  ? "  Under 50 MB: upload it directly in the Lambda console (Code > Upload from > .zip file)."
  : "  Over 50 MB: upload it to the deploy S3 bucket first, then Lambda > Upload from > Amazon S3 location.");
