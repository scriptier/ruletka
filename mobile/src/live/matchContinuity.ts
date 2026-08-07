/**
 * Pure flags for multi-peer match continuity (keep PC / promote secondary).
 */

export type MatchContinuity = {
  keepPrimary: boolean;
  keepSecondary: boolean;
  promoteSecondary: boolean;
};

/**
 * After re-match, decide whether to keep existing PeerConnections.
 * promoteSecondary: primary left, previous secondary is new primary peer.
 */
export function computeMatchContinuity(opts: {
  wasMatched: boolean;
  prevPrimary: string;
  prevSecondary: string;
  primaryPeerId: string;
  secondaryPeerId: string | null | undefined;
  hasMedia2: boolean;
}): MatchContinuity {
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

  // Primary left, secondary still live → promote media2 PC to primary
  const promoteSecondary =
    wasMatched &&
    !keepPrimary &&
    !!prevSecondary &&
    prevSecondary !== "legacy" &&
    primaryPeerId === prevSecondary &&
    hasMedia2;

  return { keepPrimary, keepSecondary, promoteSecondary };
}

/** Soft re-match (party join / find-3rd) keeps primary PC when continuity says so. */
export function shouldSoftRematch(opts: {
  keepPrimary: boolean;
  promoteSecondary: boolean;
  extrasCount: number;
}): boolean {
  return opts.keepPrimary || opts.promoteSecondary || opts.extrasCount > 0;
}
