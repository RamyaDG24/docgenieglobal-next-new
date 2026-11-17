// Checks the zip writer: readable entries, run.sh executable, data intact.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { writeZip } from "../lib/common.mjs";

test("zip keeps contents and marks run.sh executable", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zt-"));
  fs.mkdirSync(path.join(dir, "a"));
  fs.writeFileSync(path.join(dir, "run.sh"), "#!/bin/bash\necho hi\n");
  fs.writeFileSync(path.join(dir, "a", "b.txt"), "hello ".repeat(100));
  const zip = path.join(os.tmpdir(), `zt-${process.pid}.zip`);
  writeZip(dir, zip, ["run.sh"]);
  const buf = fs.readFileSync(zip);
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const seen = {};
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const mode = buf.readUInt32LE(p + 38) >>> 16, off = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nlen);
    const lnlen = buf.readUInt16LE(off + 26), lelen = buf.readUInt16LE(off + 28);
    const raw = buf.subarray(off + 30 + lnlen + lelen, off + 30 + lnlen + lelen + csize);
    seen[name] = { mode, data: (method === 8 ? zlib.inflateRawSync(raw) : raw).toString() };
    p += 46 + nlen + elen + clen;
  }
  assert.equal(seen["run.sh"].mode & 0o777, 0o755);
  assert.equal(seen["a/b.txt"].mode & 0o777, 0o644);
  assert.equal(seen["a/b.txt"].data, "hello ".repeat(100));
  assert.ok(seen["run.sh"].data.startsWith("#!/bin/bash\n"));
  fs.rmSync(dir, { recursive: true }); fs.rmSync(zip);
});
