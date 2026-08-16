import { deepseek } from "../../config/deepseek";
import { env } from "../../config/env";
import { UserModel } from "../user/user.model";
import { GdbCacheModel, type IGdbDraft } from "./gdbCache.model";
import { GdbCreditModel } from "./gdbCredit.model";
import { FREE_CREDITS, gdbAccess } from "./gdb.access";
import { llmGate } from "./gdb.queue";
import { hashQuestion, normalizeQuestion } from "./gdb.normalize";
import { buildGdbMessages, parseDraft, isDraftUsable } from "./gdb.prompt";

const MODEL = "deepseek-chat";

export interface GdbHelpResult {
  locked?: boolean;
  message?: string;
  draft?: IGdbDraft;
  fromCache?: boolean;
  charged?: boolean;
  credits?: number;
  hasPass?: boolean;
}

export class GdbUnavailableError extends Error {}

// Ensure the user's credit row exists, seeding the free allotment exactly once
// (on insert). Returns the current row.
async function ensureCredit(userId: string) {
  return GdbCreditModel.findOneAndUpdate(
    { userId },
    { $setOnInsert: { credits: FREE_CREDITS } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function getGdbStatus(userId: string) {
  const credit = await ensureCredit(userId);
  const access = gdbAccess(credit);
  return {
    credits: access.credits,
    hasPass: access.hasPass,
    passExpiresAt: credit.passExpiresAt ?? null,
    locked: access.locked,
  };
}

// The cache-check → charge → generate → store pipeline.
export async function generateGdbHelp(
  userId: string,
  rawQuestion: string,
): Promise<GdbHelpResult> {
  const hash = hashQuestion(rawQuestion);

  const credit = await ensureCredit(userId);
  const access = gdbAccess(credit);
  if (access.locked) {
    return {
      locked: true,
      message: "You're out of GDB credits. Get a semester pass to keep going.",
      credits: 0,
      hasPass: false,
    };
  }

  // ── Cache hit → free, no LLM call, no charge ──
  const cached = await GdbCacheModel.findOneAndUpdate(
    { hash },
    { $inc: { hits: 1 } },
    { new: true },
  ).lean<{ draft: IGdbDraft } | null>();
  if (cached) {
    return {
      draft: cached.draft,
      fromCache: true,
      charged: false,
      credits: access.credits,
      hasPass: access.hasPass,
    };
  }

  // ── Cache miss → this is a real LLM call ──
  if (!env.DEEPSEEK_API_KEY) {
    throw new GdbUnavailableError(
      "AI drafting is temporarily unavailable. Please try again later.",
    );
  }

  // Charge first (unless a pass covers it). The atomic conditional update IS the
  // entitlement-check + decrement in one step — no negative balance possible, and
  // it works on a standalone mongod (no replica-set transaction needed).
  let charged = false;
  if (!access.hasPass) {
    const dec = await GdbCreditModel.findOneAndUpdate(
      { userId, credits: { $gte: 1 } },
      { $inc: { credits: -1 } },
      { new: true },
    );
    if (!dec) {
      return {
        locked: true,
        message: "You're out of GDB credits. Get a semester pass to keep going.",
        credits: 0,
        hasPass: false,
      };
    }
    charged = true;
  }

  // Refund on any failure after charging, so a student never pays for an error.
  const refund = async () => {
    if (charged) {
      await GdbCreditModel.updateOne({ userId }, { $inc: { credits: 1 } });
    }
  };

  let draft: IGdbDraft;
  try {
    const content = await llmGate.run(async () => {
      const completion = await deepseek.chat.completions.create({
        model: MODEL,
        messages: buildGdbMessages(rawQuestion),
        response_format: { type: "json_object" },
        temperature: 0.6,
        max_tokens: 700,
      });
      return completion.choices[0]?.message?.content?.trim() ?? "";
    });

    draft = parseDraft(content);
    if (!isDraftUsable(draft)) throw new Error("empty draft");
  } catch (err) {
    await refund();
    if ((err as Error).name === "QueueFullError") throw err; // surfaced as 503
    console.error("generateGdbHelp LLM failure:", err);
    throw new GdbUnavailableError(
      "We couldn't draft this right now — you were not charged. Please try again.",
    );
  }

  // Store in the shared cache (best-effort). A rare concurrent double-miss for the
  // same hash just re-upserts — no correctness impact.
  try {
    await GdbCacheModel.updateOne(
      { hash },
      {
        $setOnInsert: {
          hash,
          normalizedPrompt: normalizeQuestion(rawQuestion),
          draft,
          modelName: MODEL,
        },
      },
      { upsert: true },
    );
  } catch (err) {
    console.error("gdb cache store failed (non-fatal):", err);
  }

  const fresh = await GdbCreditModel.findOne({ userId }).lean<{ credits: number } | null>();
  return {
    draft,
    fromCache: false,
    charged,
    credits: fresh?.credits ?? Math.max(0, access.credits - (charged ? 1 : 0)),
    hasPass: access.hasPass,
  };
}

// Admin: top up credits and/or grant a semester pass for a user (by id or email).
export async function grantGdb(input: {
  userId?: string;
  email?: string;
  credits?: number;
  passSemester?: string;
  passDays?: number;
}) {
  let userId = input.userId;
  if (!userId && input.email) {
    const user = await UserModel.findOne({ email: input.email.toLowerCase() })
      .select("_id")
      .lean<{ _id: unknown } | null>();
    if (!user) throw new Error("User not found");
    userId = String(user._id);
  }
  if (!userId) throw new Error("userId or email is required");

  const update: Record<string, unknown> = {};
  if (typeof input.credits === "number" && input.credits !== 0) {
    update.$inc = { credits: input.credits };
  }
  if (input.passSemester && input.passDays) {
    update.$set = {
      passSemester: input.passSemester,
      passExpiresAt: new Date(Date.now() + input.passDays * 24 * 60 * 60 * 1000),
    };
  }
  if (!update.$inc && !update.$set) {
    throw new Error("Nothing to grant (provide credits or a pass)");
  }

  const doc = await GdbCreditModel.findOneAndUpdate({ userId }, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
  return {
    userId,
    credits: doc.credits,
    passSemester: doc.passSemester ?? null,
    passExpiresAt: doc.passExpiresAt ?? null,
  };
}
