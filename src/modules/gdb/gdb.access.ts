import type { IGdbCredit } from "./gdbCredit.model";

// Free credits seeded on a user's first visit to the GDB helper.
export const FREE_CREDITS = 5;

// The paid-product key this feature would sell as (per semester pass), mirroring
// the crash-plan `crash:<course>` convention. Entitlement lookups slot in here when
// real billing lands; for now access is driven by the credit balance + admin grants.
export const gdbPassKey = (semester: string) => `gdb-pass:${semester}`;

export interface GdbAccess {
  hasPass: boolean;
  credits: number;
  locked: boolean; // no active pass AND no credits left → show upgrade UI
}

// Resolve whether a user may generate right now. A pass holder is never charged;
// otherwise they spend credits. Locked when both are exhausted.
export function gdbAccess(credit: Pick<IGdbCredit, "credits" | "passExpiresAt">): GdbAccess {
  const hasPass = !!credit.passExpiresAt && credit.passExpiresAt.getTime() > Date.now();
  const credits = Math.max(0, credit.credits ?? 0);
  return { hasPass, credits, locked: !hasPass && credits <= 0 };
}
