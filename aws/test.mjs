// Runs all tests: the site's Jest tests and the aws/ tests (CloudFront Function, zip).
// Results: results/tests.txt
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, resultsLog } from "./lib/common.mjs";

const log = resultsLog("tests");
const run = (title, args) => {
  log(`== ${title}`);
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } });
  log.raw((r.stdout || "") + (r.stderr || ""));
  log(`== ${title}: ${r.status === 0 ? "PASSED" : "FAILED"}`);
  log("");
  return r.status === 0;
};
// Workaround: Jest reads jest.config.ts with Node's own TypeScript support,
// which is on by default only from Node 22.18. Older Node 22 (e.g. 22.11)
// has it behind --experimental-strip-types; without it Jest asks for ts-node.
const [major, minor] = process.versions.node.split(".").map(Number);
const needsFlag = !process.features.typescript && (major > 22 || (major === 22 && minor >= 6));
const jestArgs = [...(needsFlag ? ["--experimental-strip-types", "--no-warnings=ExperimentalWarning"] : []), path.join(ROOT, "node_modules", "jest", "bin", "jest.js")];
if (needsFlag) log(`(Node ${process.version}: running Jest with --experimental-strip-types)`);
const a = run("Site tests (Jest)", jestArgs);
const awsTests = fs.readdirSync(path.join(ROOT, "aws", "tests")).filter((f) => f.endsWith(".test.mjs")).map((f) => path.join("aws", "tests", f));
const b = run("AWS tests (CloudFront Function, zip)", ["--test", ...awsTests]);
log(a && b ? "ALL TESTS PASSED" : "SOME TESTS FAILED");
process.exit(a && b ? 0 : 1);
