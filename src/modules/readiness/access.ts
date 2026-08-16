// The single switch that will become the readiness paywall.
//
// The topic breakdown (named weak topics + fix plans) is meant to sit behind a
// paid product / semester pass. No billing exists yet, so this returns true
// (everyone unlocked). When paid/free lands, implement the real check here
// (e.g. look up the user's entitlements) — nothing else in the feature changes,
// because the service already emits a `breakdown.locked` flag from this.

export interface AccessUser {
  userId?: string;
  role?: string;
}

export function hasReadinessBreakdownAccess(_user?: AccessUser): boolean {
  return true;
}
