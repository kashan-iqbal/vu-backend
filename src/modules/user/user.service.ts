import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library/build/src/auth/oauth2client";
import { IUser } from "./user.model";
import { googleAudiences } from "../auth/auth.controller";
import { QuizAttemptModel } from "../ai-quiz/quizAttempt.model";
import { WrongAnswerModel } from "../ai-quiz/wrongAnswer.model";
import { TopicStatModel } from "../readiness/topicStat.model";
import { CrashPlanModel } from "../crash-plan/crashPlan.model";
import { GdbCreditModel } from "../gdb/gdbCredit.model";
import { FeedbackModel } from "../feedback/feedback.model";
import { UserModel } from "./user.model";

const googleClient = new OAuth2Client();

export class ReauthenticationError extends Error {}

/**
 * Prove the caller is still the account owner, right before an irreversible
 * delete. The JWT alone is not enough — it lives 7 days with no revocation
 * list, so a stolen or left-open session could otherwise nuke the account with
 * no further checks.
 *
 * `password` and `credential` are mutually situational, not mutually optional:
 * which one is required is decided by how THIS account authenticates, not by
 * whichever one the client happened to send.
 */
export async function reauthenticate(
  user: IUser,
  body: { password?: string; credential?: string },
): Promise<void> {
  if (user.password) {
    // Local (or Google-linked-with-a-password) account: a current password.
    if (!body.password) {
      throw new ReauthenticationError("Current password is required");
    }
    const isMatch = await bcrypt.compare(body.password, user.password);
    if (!isMatch) {
      throw new ReauthenticationError("Current password is incorrect");
    }
    return;
  }

  // No password hash at all → a Google-only account. The stored `password`
  // field on `user` here is intentionally the full document (see controller),
  // so this branch only runs for accounts that truly have none.
  if (!body.credential) {
    throw new ReauthenticationError(
      "A Google sign-in is required to confirm account deletion",
    );
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: body.credential,
      audience: googleAudiences(),
    });
    payload = ticket.getPayload();
  } catch {
    throw new ReauthenticationError("Invalid Google credential");
  }

  // Must be a fresh token for THIS account, not merely any valid Google token.
  const matches =
    payload &&
    (payload.sub === user.googleId ||
      (payload.email && payload.email === user.email));
  if (!matches) {
    throw new ReauthenticationError(
      "The Google credential does not match this account",
    );
  }
}

/**
 * Cascade-delete everything keyed to `userId`, then the account itself.
 *
 * There are no transactions anywhere in this codebase (MongoDB Atlas, but the
 * project doesn't use them), so a crash partway through leaves orphans rather
 * than rolling back. The `users` document is therefore deleted LAST — if this
 * function is retried after a partial failure, it can still find the user (for
 * re-auth) and finish cleaning up the rest.
 *
 * Deliberately NOT touched:
 *   - `gdbcaches` — the shared, user-agnostic answer cache. Not this user's data.
 *   - `contributions` — anonymous, keyed by self-reported name + phone, not
 *     `userId`. Not personal account data; confirmed with the project owner not
 *     to cascade these (§2.2 of MOBILE_APP_ACTION_PLAN.md).
 *   - `feedback.user` is NULLED rather than the row deleted, so aggregate
 *     rating stats (admin dashboard trend queries) survive account deletion.
 */
export async function deleteUserAndData(userId: string): Promise<void> {
  await WrongAnswerModel.deleteMany({ userId });
  await QuizAttemptModel.deleteMany({ userId });
  await TopicStatModel.deleteMany({ userId });
  await CrashPlanModel.deleteMany({ userId });
  await GdbCreditModel.deleteMany({ userId });
  await FeedbackModel.updateMany({ user: userId }, { $unset: { user: "" } });

  // Last: once this succeeds, a retry has nothing left to do.
  await UserModel.deleteOne({ _id: userId });
}
