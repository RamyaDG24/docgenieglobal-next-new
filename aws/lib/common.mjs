// Shared helpers for the aws/ scripts. Plain Node (no dependencies), works on
// Windows and Linux. Nothing here ever prints a setting's value.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const RESULTS = path.join(ROOT, "results");
export const DIST = path.join(ROOT, "aws", "dist");
export const LAMBDA_DIR = path.join(DIST, "lambda");
export const ZIP_NAME = "docgenieglobal-website.zip";

/** Logger that prints to the screen and also writes results/<name>.txt. */
export function resultsLog(name) {
  fs.mkdirSync(RESULTS, { recursive: true });
  const file = path.join(RESULTS, `${name}.txt`);
  fs.writeFileSync(file, `# ${name} — ${new Date().toISOString()}\n`);
  const log = (...parts) => {
    const line = parts.join(" ");
    process.stdout.write(line + "\n");
    fs.appendFileSync(file, line + "\n");
  };
  log.raw = (chunk) => {
    process.stdout.write(chunk);
    fs.appendFileSync(file, chunk);
  };
  log.file = file;
  return log;
}

/** Reads KEY=VALUE pairs from a .env file. Values stay in memory only. */
export function readEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, "").trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** Every file under dir, as paths relative to dir with forward slashes. */
export function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else if (entry.isFile()) out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

// ---- Minimal zip writer (deflate), so a Windows-built zip still marks the
// ---- start script executable for Lambda. No external tools needed.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  if (typeof zlib.crc32 === "function") return zlib.crc32(buf) >>> 0;
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Writes a zip of every file in srcDir to zipFile.
 * executables: relative paths that get mode 0755 (others 0644).
 */
export function writeZip(srcDir, zipFile, executables = []) {
  const files = walk(srcDir).sort();
  const fd = fs.openSync(zipFile, "w");
  const central = [];
  let offset = 0;
  // Fixed DOS timestamp (1 Jan 2020): the same input gives the same zip.
  const dosTime = 0, dosDate = ((2020 - 1980) << 9) | (1 << 5) | 1;
  const write = (buf) => { fs.writeSync(fd, buf); offset += buf.length; };
  for (const rel of files) {
    const data = fs.readFileSync(path.join(srcDir, rel));
    const crc = crc32(data);
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const name = Buffer.from(rel, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    const headerOffset = offset;
    write(local); write(name); write(body);
    const mode = executables.includes(rel) ? 0o100755 : 0o100644;
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE((3 << 8) | 20, 4); // made by Unix, so the mode is honoured
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(useDeflate ? 8 : 0, 10);
    cen.writeUInt16LE(dosTime, 12);
    cen.writeUInt16LE(dosDate, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(body.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE((mode << 16) >>> 0, 38);
    cen.writeUInt32LE(headerOffset, 42);
    central.push(Buffer.concat([cen, name]));
  }
  const cdStart = offset;
  for (const c of central) write(c);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(offset - cdStart, 12);
  end.writeUInt32LE(cdStart, 16);
  fs.writeSync(fd, end);
  fs.closeSync(fd);
  return { files: files.length, bytes: fs.statSync(zipFile).size };
}
