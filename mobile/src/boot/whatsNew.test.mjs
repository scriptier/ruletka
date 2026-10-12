/**
 * Fresh install vs upgrade vs same version for the What's new card.
 * Mirrors decideWhatsNew / shouldPaintWhatsNew in whatsNew.ts (node cannot import TS).
 */
import assert from "node:assert/strict";

function decideWhatsNew(seen, current) {
  const prev = String(seen || "").trim();
  const cur = String(current || "").trim();
  if (!cur) return "hide";
  if (!prev) return "mark";
  if (prev !== cur) return "show";
  return "hide";
}

function shouldPaintWhatsNew(rulesAccepted, decision) {
  return !!rulesAccepted && decision === "show";
}

const cur = "0.1.471+479";

// Fresh install: no seen key. Record silently. Do not cover rules or Start.
assert.equal(decideWhatsNew("", cur), "mark");
assert.equal(decideWhatsNew("   ", cur), "mark");
assert.equal(shouldPaintWhatsNew(false, "mark"), false);
assert.equal(shouldPaintWhatsNew(true, "mark"), false);

// Same version already recorded.
assert.equal(decideWhatsNew(cur, cur), "hide");
assert.equal(shouldPaintWhatsNew(true, "hide"), false);

// Real upgrade from a previously seen version. Still not over the age gate.
assert.equal(decideWhatsNew("0.1.470+478", cur), "show");
assert.equal(shouldPaintWhatsNew(true, "show"), true);
assert.equal(shouldPaintWhatsNew(false, "show"), false);

// Missing current version must not flash a card.
assert.equal(decideWhatsNew("", ""), "hide");
assert.equal(decideWhatsNew("0.1.470+478", ""), "hide");

console.log("whatsNew.test.mjs ok");
