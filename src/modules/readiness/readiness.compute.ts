// Pure readiness-scoring engine. No I/O, no DB, no LLM — all deterministic maths,
// so it is cheap to run and trivial to unit-test. The service layer feeds it data
// loaded from Mongo; this file must stay free of any imports with side effects.

export interface TopicHistory {
  topic: string;
  attempts: number;
  correct: number;
}

export interface TopicWeight {
  topic: string;
  weight: number;
}

export interface TopicToFix {
  topic: string;
  weight: number;
  accuracy: number; // 0..1
  marksAtStake: number; // weight × (1 − accuracy), rounded
  fixPlan: string;
}

export interface ReadinessResult {
  status: "ready" | "insufficient";
  attempts: number; // total attempts across all topics
  minAttempts: number;
  readiness: number | null; // 0..100, null until enough attempts
  band: { low: number; high: number } | null;
  topicsToFix: TopicToFix[] | null; // top 3 costliest, null until enough attempts
}

export interface ComputeOptions {
  /** Below this many total attempts we refuse to show a (misleading) score. */
  minAttempts?: number;
  /** Missing/zero weights fall back to this so the engine works pre-seeding. */
  fallbackWeight?: number;
}

const DEFAULT_MIN_ATTEMPTS = 10;
const DEFAULT_FALLBACK_WEIGHT = 1;

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

function fixPlanFor(topic: string, accuracyPct: number): string {
  return `You're at ${accuracyPct}% on ${topic}, a heavily-tested topic — practice more of its MCQs to claw back the most marks.`;
}

/**
 * Compute a course-exam readiness score from per-topic history + exam weights.
 *
 * readiness = Σ(weight × accuracy) / Σ(weight) × 100, so being weak on a
 * heavily-tested topic hurts more than being weak on a rare one.
 */
export function computeReadiness(
  history: TopicHistory[],
  weights: TopicWeight[],
  opts: ComputeOptions = {},
): ReadinessResult {
  const minAttempts = opts.minAttempts ?? DEFAULT_MIN_ATTEMPTS;
  const fallbackWeight = opts.fallbackWeight ?? DEFAULT_FALLBACK_WEIGHT;

  const totalAttempts = history.reduce(
    (sum, h) => sum + Math.max(0, h.attempts),
    0,
  );

  // Not enough signal yet — return a clear "keep quizzing" shape instead of a
  // confident-looking number built on 2 questions.
  if (totalAttempts < minAttempts) {
    return {
      status: "insufficient",
      attempts: totalAttempts,
      minAttempts,
      readiness: null,
      band: null,
      topicsToFix: null,
    };
  }

  const weightByTopic = new Map<string, number>();
  for (const w of weights) weightByTopic.set(w.topic, w.weight);

  // Per-topic accuracy + resolved weight (fallback when unseeded).
  const rows = history
    .filter((h) => h.attempts > 0)
    .map((h) => {
      const accuracy = clamp(h.correct / h.attempts, 0, 1);
      const raw = weightByTopic.get(h.topic);
      const weight = raw && raw > 0 ? raw : fallbackWeight;
      return { topic: h.topic, accuracy, weight };
    });

  const weightSum = rows.reduce((s, r) => s + r.weight, 0);
  if (weightSum === 0) {
    // No usable weights at all — can't form a weighted score.
    return {
      status: "insufficient",
      attempts: totalAttempts,
      minAttempts,
      readiness: null,
      band: null,
      topicsToFix: null,
    };
  }

  const weightedAcc = rows.reduce((s, r) => s + r.weight * r.accuracy, 0);
  const readiness = Math.round((weightedAcc / weightSum) * 100);

  // Confidence margin shrinks as attempts accumulate (wider band = less certain).
  const margin = clamp(Math.round(40 / Math.sqrt(totalAttempts)), 4, 20);
  const band = {
    low: clamp(readiness - margin, 0, 100),
    high: clamp(readiness + margin, 0, 100),
  };

  // Costliest topics: high exam-weight AND currently weak.
  const topicsToFix: TopicToFix[] = rows
    .map((r) => ({
      topic: r.topic,
      weight: r.weight,
      accuracy: r.accuracy,
      cost: r.weight * (1 - r.accuracy),
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 3)
    .filter((r) => r.cost > 0) // nothing to fix if fully accurate
    .map((r) => ({
      topic: r.topic,
      weight: r.weight,
      accuracy: Math.round(r.accuracy * 100) / 100,
      marksAtStake: Math.round(r.cost * 10) / 10,
      fixPlan: fixPlanFor(r.topic, Math.round(r.accuracy * 100)),
    }));

  return {
    status: "ready",
    attempts: totalAttempts,
    minAttempts,
    readiness,
    band,
    topicsToFix,
  };
}
