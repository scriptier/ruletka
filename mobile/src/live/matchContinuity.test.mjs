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

function shouldSoftRematch(opts) {
  return opts.keepPrimary || opts.promoteSecondary || opts.extrasCount > 0;
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

// "legacy" prevPrimary is a sentinel, never kept even if it equals primaryPeerId
{
  const c = computeMatchContinuity({
    wasMatched: true,
    prevPrimary: "legacy",
    prevSecondary: "b",
    primaryPeerId: "legacy",
    secondaryPeerId: "b",
    hasMedia2: true,
  });
  assert.equal(c.keepPrimary, false);
}

// "legacy" secondaryPeerId is never kept even if it equals prevSecondary
{
  const c = computeMatchContinuity({
    wasMatched: true,
    prevPrimary: "a",
    prevSecondary: "legacy",
    primaryPeerId: "a",
    secondaryPeerId: "legacy",
    hasMedia2: true,
  });
  assert.equal(c.keepSecondary, false);
}

// "legacy" prevSecondary blocks promotion even if primaryPeerId matches it
{
  const c = computeMatchContinuity({
    wasMatched: true,
    prevPrimary: "a",
    prevSecondary: "legacy",
    primaryPeerId: "legacy",
    secondaryPeerId: null,
    hasMedia2: true,
  });
  assert.equal(c.promoteSecondary, false);
}

// Already keeping primary: never also promote secondary
{
  const c = computeMatchContinuity({
    wasMatched: true,
    prevPrimary: "a",
    prevSecondary: "a",
    primaryPeerId: "a",
    secondaryPeerId: null,
    hasMedia2: true,
  });
  assert.equal(c.keepPrimary, true);
  assert.equal(c.promoteSecondary, false);
}

// undefined secondaryPeerId (vs. null) is treated the same as missing
{
  const c = computeMatchContinuity({
    wasMatched: true,
    prevPrimary: "a",
    prevSecondary: "b",
    primaryPeerId: "a",
    secondaryPeerId: undefined,
    hasMedia2: false,
  });
  assert.equal(c.keepSecondary, false);
}

// wasMatched false: no continuity at all, even with matching ids
{
  const c = computeMatchContinuity({
    wasMatched: false,
    prevPrimary: "a",
    prevSecondary: "b",
    primaryPeerId: "a",
    secondaryPeerId: "b",
    hasMedia2: true,
  });
  assert.equal(c.keepPrimary, false);
  assert.equal(c.keepSecondary, false);
  assert.equal(c.promoteSecondary, false);
}

// shouldSoftRematch: true when keeping primary
assert.equal(
  shouldSoftRematch({ keepPrimary: true, promoteSecondary: false, extrasCount: 0 }),
  true,
);

// shouldSoftRematch: true when promoting secondary
assert.equal(
  shouldSoftRematch({ keepPrimary: false, promoteSecondary: true, extrasCount: 0 }),
  true,
);

// shouldSoftRematch: true when there are extras, even without continuity
assert.equal(
  shouldSoftRematch({ keepPrimary: false, promoteSecondary: false, extrasCount: 1 }),
  true,
);

// shouldSoftRematch: false when nothing carries over
assert.equal(
  shouldSoftRematch({ keepPrimary: false, promoteSecondary: false, extrasCount: 0 }),
  false,
);

console.log("matchContinuity.test.mjs ok");
