#!/usr/bin/env node
/**
 * Run pure mobile unit tests under src/live and src/prefs (no RN).
 * Invoked by: npm test · ./scripts/dev-smoke.sh --unit
 */
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dirs = [
  join(root, "src/live"),
  join(root, "src/prefs"),
  join(root, "src/media"), // CONNECTIVITY_LOCK auto-retry schedule
];
let fail = 0;
let ran = 0;

for (const dir of dirs) {
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".test.mjs"));
  } catch {
    continue;
  }
  for (const f of files.sort()) {
    const path = join(dir, f);
    ran++;
    const r = spawnSync(process.execPath, [path], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (r.status === 0) {
      console.log(`✓ ${f}`);
    } else {
      fail++;
      console.error(`✗ ${f}`);
      if (r.stdout) process.stderr.write(r.stdout);
      if (r.stderr) process.stderr.write(r.stderr);
    }
  }
}

if (ran === 0) {
  console.error("no *.test.mjs found");
  process.exit(1);
}
if (fail) {
  console.error(`live-units FAIL (${fail}/${ran})`);
  process.exit(1);
}
console.log(`live-units OK (${ran})`);
