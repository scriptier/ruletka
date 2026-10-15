/**
 * Static invariants: GUM audioConstraints follow noiseReduction flag.
 * Run: node src/media/noiseReduction.test.mjs
 *
 * Mirrors mediasessionMultiSafety.test.mjs — read MediaSession.ts as text.
 * Do not import/run RN.
 *
 * Rules:
 * 1. private noiseReduction = true (default ON)
 * 2. setNoiseReduction exists
 * 3. audioConstraints() derives EC/NS/AGC from this.noiseReduction
 *    (or a local `on` from it) — not hardcoded true
 * 4. applyFullAudioProcessing uses this.noiseReduction !== false
 * 5. iceCandidatePoolSize stays 0
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, "MediaSession.ts"), "utf8");

function stripLineComments(block) {
  return block
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

// --- default ON ---
assert.match(
  src,
  /private noiseReduction\s*=\s*true/,
  "private noiseReduction must default to true"
);

// --- setter ---
assert.match(
  src,
  /setNoiseReduction\s*\(\s*on\s*:\s*boolean\s*\)/,
  "setNoiseReduction(on: boolean) must exist"
);
assert.match(
  src,
  /setNoiseReduction[\s\S]{0,200}this\.noiseReduction\s*=\s*on\s*!==\s*false/,
  "setNoiseReduction must assign this.noiseReduction = on !== false"
);

// --- audioConstraints derives EC/NS/AGC from this.noiseReduction ---
const acIdx = src.indexOf("private audioConstraints()");
assert.ok(acIdx >= 0, "private audioConstraints() helper must exist");
const acEnd = src.indexOf("private videoConstraints(", acIdx);
assert.ok(acEnd > acIdx, "audioConstraints() must precede videoConstraints()");
const acBlock = src.slice(acIdx, acEnd);
const acCode = stripLineComments(acBlock);

assert.ok(
  /this\.noiseReduction/.test(acCode),
  "audioConstraints() must read this.noiseReduction"
);
assert.ok(
  /this\.noiseReduction/.test(acCode) &&
    (/const\s+on\s*=\s*this\.noiseReduction/.test(acCode) ||
      /echoCancellation\s*:\s*(?:on|this\.noiseReduction)/.test(acCode)),
  "audioConstraints() must use this.noiseReduction or a local `on` derived from it"
);

for (const key of ["echoCancellation", "noiseSuppression", "autoGainControl"]) {
  assert.match(
    acCode,
    new RegExp(`${key}\\s*:`),
    `audioConstraints() must set ${key}`
  );
  assert.doesNotMatch(
    acCode,
    new RegExp(`${key}\\s*:\\s*true\\b`),
    `audioConstraints() must not hardcode ${key}: true — derive from this.noiseReduction`
  );
}

// --- applyFullAudioProcessing still uses this.noiseReduction !== false ---
const applyIdx = src.indexOf("async applyFullAudioProcessing(");
assert.ok(applyIdx >= 0, "applyFullAudioProcessing must exist");
const applyEnd = src.indexOf("private pcConfig(", applyIdx);
assert.ok(applyEnd > applyIdx, "applyFullAudioProcessing must precede pcConfig()");
const applyBlock = src.slice(applyIdx, applyEnd);
const applyCode = stripLineComments(applyBlock);
assert.match(
  applyCode,
  /this\.noiseReduction\s*!==\s*false/,
  "applyFullAudioProcessing must use this.noiseReduction !== false"
);
assert.match(
  applyCode,
  /echoCancellation\s*:\s*on/,
  "applyFullAudioProcessing must set echoCancellation from `on`"
);
assert.match(
  applyCode,
  /noiseSuppression\s*:\s*on/,
  "applyFullAudioProcessing must set noiseSuppression from `on`"
);
assert.match(
  applyCode,
  /autoGainControl\s*:\s*on/,
  "applyFullAudioProcessing must set autoGainControl from `on`"
);

// --- pool=0 (regression guard) ---
assert.match(
  src,
  /const iceCandidatePoolSize\s*=\s*0/,
  "iceCandidatePoolSize must be hardcoded 0"
);
assert.doesNotMatch(
  src,
  /iceCandidatePoolSize\s*=\s*[1-9]/,
  "iceCandidatePoolSize must never be set to a positive number"
);

console.log("noiseReduction.test.mjs: ok");
