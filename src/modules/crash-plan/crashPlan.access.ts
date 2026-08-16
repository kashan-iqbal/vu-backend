// The single switch that will become the crash-plan paywall.
//
// The crash plan is meant to sell as a one-time, per-course unlock
// (product key `crash:<course>`, e.g. `crash:CS201`). No billing exists yet, so
// this returns true (everyone unlocked). When paid/free lands, implement the real
// entitlement check here — nothing else in the feature changes, because the service
// already emits a `locked` flag from this and null-strips gated content when locked.

export interface AccessUser {
  userId?: string;
  role?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function hasCrashPlanAccess(_user: AccessUser | undefined, _course: string): boolean {
  return true;
}

export const crashProductKey = (course: string) => `crash:${course.toUpperCase()}`;
