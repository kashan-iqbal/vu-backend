import { TopicStatModel } from "./topicStat.model";
import { CourseTopicWeightModel } from "./courseTopicWeight.model";
import {
  computeReadiness,
  type TopicHistory,
  type TopicWeight,
  type TopicToFix,
} from "./readiness.compute";
import { hasReadinessBreakdownAccess, type AccessUser } from "./access";

export interface ReadinessResponse {
  course: string;
  examType: string;
  status: "ready" | "insufficient";
  attempts: number;
  minAttempts: number;
  readiness: number | null;
  band: { low: number; high: number } | null;
  message?: string;
  breakdown: {
    locked: boolean;
    // Null when locked (paywall) OR insufficient attempts.
    topics: TopicToFix[] | null;
  };
}

// Aggregate a finished quiz into the per-topic tally. Additive and idempotent-ish
// ($inc), called from the quiz submit path. Attempts count only answered
// questions (selectedOption >= 0); unanswered/timed-out ones don't skew accuracy.
export async function recordTopicStats(
  userId: string,
  code: string,
  type: string,
  answers: Array<{
    topic_name: string;
    selectedOption: number;
    correctAnswer: number;
  }>,
): Promise<void> {
  const perTopic = new Map<string, { attempts: number; correct: number }>();
  for (const a of answers) {
    if (!a?.topic_name || a.selectedOption < 0) continue; // skip unanswered
    const cur = perTopic.get(a.topic_name) ?? { attempts: 0, correct: 0 };
    cur.attempts += 1;
    if (a.selectedOption === a.correctAnswer) cur.correct += 1;
    perTopic.set(a.topic_name, cur);
  }
  if (perTopic.size === 0) return;

  const ops = [...perTopic.entries()].map(([topic_name, v]) => ({
    updateOne: {
      filter: { userId, code: code.toUpperCase(), type, topic_name },
      update: { $inc: { attempts: v.attempts, correct: v.correct } },
      upsert: true,
    },
  }));
  await TopicStatModel.bulkWrite(ops, { ordered: false });
}

// Load history + weights for a course exam and compute the gated readiness view.
export async function getReadinessForCourse(
  userId: string,
  code: string,
  type: string,
  user?: AccessUser,
): Promise<ReadinessResponse> {
  const upperCode = code.toUpperCase();

  const [stats, weights] = await Promise.all([
    TopicStatModel.find({ userId, code: upperCode, type }).lean(),
    CourseTopicWeightModel.find({ code: upperCode, type }).lean(),
  ]);

  const history: TopicHistory[] = stats.map((s) => ({
    topic: s.topic_name,
    attempts: s.attempts,
    correct: s.correct,
  }));
  const topicWeights: TopicWeight[] = weights.map((w) => ({
    topic: w.topic_name,
    weight: w.weight,
  }));

  const result = computeReadiness(history, topicWeights);

  const locked = !hasReadinessBreakdownAccess(user);

  const response: ReadinessResponse = {
    course: upperCode,
    examType: type,
    status: result.status,
    attempts: result.attempts,
    minAttempts: result.minAttempts,
    readiness: result.readiness,
    band: result.band,
    breakdown: {
      locked,
      // Hidden if not enough data yet, or gated behind the (future) paywall.
      topics: result.topicsToFix === null || locked ? null : result.topicsToFix,
    },
  };

  if (result.status === "insufficient") {
    response.message = "Keep quizzing to unlock your readiness score.";
  }

  return response;
}
