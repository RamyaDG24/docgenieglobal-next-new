// Secret scan of the files about to be committed (git staged files), or of the
// files given as arguments. Prints only file names and WHICH check matched,
// never the matched value.
//   node aws/secret-scan.mjs            (staged files)
//   node aws/secret-scan.mjs file1 ...  (given files)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, readEnvFile } from "./lib/common.mjs";

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);

const PATTERNS = [
  ["AWS access key", /AKIA[0-9A-Z]{16}/],
  ["Google refresh token", /1\/\/0[0-9A-Za-z_-]{20,}/],
  ["Google client secret", /GOCSPX-[0-9A-Za-z_-]{10,}/],
  ["JWT", /eyJ[0-9A-Za-z_-]{10,}\.eyJ[0-9A-Za-z_-]{10,}/],
  ["Anthropic key", /sk-ant-[0-9A-Za-z_-]{10,}/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  // 12-digit AWS account ids inside ARNs. 753240598075 is AWS's own public
  // publisher account for the Lambda Web Adapter layer, not ours.
  ["AWS account id in an ARN", /arn:aws[a-z-]*:[a-z0-9-]+:[a-z0-9-]*:(?!753240598075)\d{12}:/],
];
const FORBIDDEN = [/(^|\/)\.env/, /(^|\/)logs\//, /(^|\/)node_modules\//, /(^|\/)\.next\//, /(^|\/)out\//, /\.zip$/, /(^|\/)results\//, /(^|\/)aws\/dist\//];

const env = {};
for (const f of [".env", ".env.local", ".env.production", ".env.production.local"]) Object.assign(env, readEnvFile(path.join(ROOT, f)));
// Public values that legitimately appear in code and docs (the site's own host
// names, the public Turnstile site key) are not treated as secrets.
const PUBLIC_SETTINGS = ["TURNSTILE_HOSTNAMES", "TURNSTILE_SITE_KEY", "TURNSTILE_TEST_MODE"];
const values = Object.entries(env).filter(([k, v]) => !k.startsWith("NEXT_PUBLIC_") && !PUBLIC_SETTINGS.includes(k) && v && v.length >= 8);

let problems = 0;
for (const rel of files) {
  const norm = rel.split(path.sep).join("/");
  if (FORBIDDEN.some((re) => re.test(norm))) { console.log(`BLOCKED FILE   ${norm}`); problems++; continue; }
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, "utf8");
  for (const [name, re] of PATTERNS) if (re.test(text)) { console.log(`FOUND ${name.padEnd(26)} in ${norm}`); problems++; }
  for (const [k, v] of values) if (text.includes(v)) { console.log(`FOUND value of ${k.padEnd(17)} in ${norm}`); problems++; }
}
console.log(problems ? `SECRET SCAN FAILED: ${problems} problem(s) in ${files.length} file(s).` : `Secret scan OK: ${files.length} file(s), ${values.length} setting value(s) and ${PATTERNS.length} patterns checked.`);
process.exit(problems ? 1 : 0);
