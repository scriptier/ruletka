import assert from "node:assert/strict";

function computeMatchContinuity(opts) {
  const {
    wasMatched,
    prevPrimary,
    prevSecondary,
    primaryPeerId,
    secondaryPeerId,
    hasMedia2,
  } = opts;
  const keepPrimary =
    wasMatched &&
    !!prevPrimary &&
    prevPrimary !== "legacy" &&
    prevPrimary === primaryPeerId;
  const secondId = secondaryPeerId || "";
  const keepSecondary =
    wasMatched &&
    !!prevSecondary &&
    !!secondId &&
    prevSecondary === secondId &&
    secondId !== "legacy";
  const promoteSecondary =
    wasMatched &&
    !keepPrimary &&
    !!prevSecondary &&
    prevSecondary !== "legacy" &&
    primaryPeerId === prevSecondary &&
    hasMedia2;
  return { keepPrimary, keepSecondary, promoteSecondary };
}

// Fresh match
{
  const c = computeMatchContinuity({
    wasMatched: false,
    prevPrimary: "",
    prevSecondary: "",
    primaryPeerId: "a",
    secondaryPeerId: null,
    hasMedia2: false,
  });
  assert.equal(c.keepPrimary, false);
  assert.equal(c.promoteSecondary, false);
}

// Keep same primary
{
  const c = computeMatchContinuity({
    wasMatched: true,
    prevPrimary: "a",
    prevSecondary: "b",
    primaryPeerId: "a",
    secondaryPeerId: "b",
    hasMedia2: true,
  });
  assert.equal(c.keepPrimary, true);
  assert.equal(c.keepSecondary, true);
  assert.equal(c.promoteSecondary, false);
}

// Promote secondary to primary
{
  const c = computeMatchContinuity({
    wasMatched: true,
    prevPrimary: "a",
    prevSecondary: "b",
    primaryPeerId: "b",
    secondaryPeerId: null,
    hasMedia2: true,
  });
  assert.equal(c.keepPrimary, false);
  assert.equal(c.promoteSecondary, true);
}

// No promote without media2
{
  const c = computeMatchContinuity({
    wasMatched: true,
    prevPrimary: "a",
    prevSecondary: "b",
    primaryPeerId: "b",
    secondaryPeerId: null,
    hasMedia2: false,
  });
  assert.equal(c.promoteSecondary, false);
}

console.log("matchContinuity.test.mjs ok");
