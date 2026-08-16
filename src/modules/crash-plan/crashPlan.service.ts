import { TopicStatModel } from "../readiness/topicStat.model";
import { CourseTopicWeightModel } from "../readiness/courseTopicWeight.model";
import { QuizModel } from "../ai-quiz/quiz.model";
import { HandoutModel } from "../handouts/handout.model";
import {
  generateCrashPlan,
  type CrashTopic,
  type CrashActivity,
} from "./crashPlan.compute";
import { hasCrashPlanAccess, type AccessUser } from "./crashPlan.access";
import { slugify } from "./crashPlan.slug";
import {
  CrashPlanModel,
  type ICrashBlock,
  type ICrashQuestion,
} from "./crashPlan.model";

const QUESTIONS_PER_QUIZ = 5;

export interface CrashBlockDTO {
  startTime: string; // ISO
  endTime: string; // ISO
  topic: string | null;
  activityType: CrashActivity;
  whyThisMatters: string | null; // null when locked
  accuracy: number | null;
  handoutRef: { url: string; anchor: string | null } | null;
  questions: ICrashQuestion[] | null; // null when locked or n/a
}

export interface CrashPlanResponse {
  course: string;
  examType: string;
  exists: boolean;
  locked: boolean;
  hoursAvailable: number | null;
  generatedAt: string | null;
  blockCount: number;
  blocks: CrashBlockDTO[];
}

// --- handout heading matching -------------------------------------------------

interface HeadingSlug {
  slug: string;
  tokens: Set<string>;
}

const tokenize = (s: string): Set<string> =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2), // ignore tiny stopword-ish tokens
  );

function parseHeadings(markdown: string): HeadingSlug[] {
  const out: HeadingSlug[] = [];
  const re = /^#{1,6}\s+(.+?)\s*#*\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const text = m[1].trim();
    if (!text) continue;
    out.push({ slug: slugify(text), tokens: tokenize(text) });
  }
  return out;
}

// Best-effort: the heading sharing the most tokens with the topic, requiring at
// least half the topic's tokens to overlap so we don't deep-link to noise.
function matchAnchor(topic: string, headings: HeadingSlug[]): string | null {
  const topicTokens = tokenize(topic);
  if (topicTokens.size === 0 || headings.length === 0) return null;

  let best: { slug: string; score: number } | null = null;
  for (const h of headings) {
    let overlap = 0;
    for (const t of topicTokens) if (h.tokens.has(t)) overlap += 1;
    if (!best || overlap > best.score) best = { slug: h.slug, score: overlap };
  }
  if (!best || best.score === 0) return null;
  return best.score / topicTokens.size >= 0.5 ? best.slug : null;
}

// --- generation ---------------------------------------------------------------

async function drawQuestions(
  code: string,
  type: string,
  topic_name: string,
): Promise<ICrashQuestion[]> {
  const rows = await QuizModel.aggregate([
    { $match: { code, type, topic_name } },
    { $sample: { size: QUESTIONS_PER_QUIZ } },
  ]);
  return rows.map((q: any) => ({
    id: q.id,
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    topic_name: q.topic_name,
  }));
}

// Build, persist and return the crash plan for a course exam.
export async function generateAndSave(
  userId: string,
  code: string,
  type: string,
  hoursAvailable: number,
  user?: AccessUser,
): Promise<CrashPlanResponse> {
  const upperCode = code.toUpperCase();

  const [stats, weights, handout] = await Promise.all([
    TopicStatModel.find({ userId, code: upperCode, type }).lean(),
    CourseTopicWeightModel.find({ code: upperCode, type }).lean(),
    HandoutModel.findOne({ code: upperCode, examType: type })
      .select("content")
      .lean<{ content: string } | null>(),
  ]);

  // Merge weights + weakness into one topic list. Union of both so a weighted but
  // never-quizzed topic still surfaces (the engine gives it max weakness).
  const statByTopic = new Map(stats.map((s) => [s.topic_name, s]));
  const topics: CrashTopic[] = [];
  const seen = new Set<string>();
  for (const w of weights) {
    const s = statByTopic.get(w.topic_name);
    topics.push({
      topic: w.topic_name,
      weight: w.weight,
      attempts: s?.attempts ?? 0,
      correct: s?.correct ?? 0,
    });
    seen.add(w.topic_name);
  }
  for (const s of stats) {
    if (seen.has(s.topic_name)) continue; // quizzed but unweighted → fallback weight
    topics.push({
      topic: s.topic_name,
      weight: 1,
      attempts: s.attempts,
      correct: s.correct,
    });
  }

  const startTimeMs = Date.now();
  const { blocks } = generateCrashPlan({ topics, hoursAvailable, startTimeMs });

  const headings = handout?.content ? parseHeadings(handout.content) : [];
  const handoutUrl = `/handout/${upperCode}/${type}`;

  // Bind each block to real cached content.
  const boundBlocks: ICrashBlock[] = [];
  for (const b of blocks) {
    const block: ICrashBlock = {
      startTime: new Date(startTimeMs + b.startOffsetMin * 60000),
      endTime: new Date(startTimeMs + b.endOffsetMin * 60000),
      topic: b.topic,
      activityType: b.activityType,
      whyThisMatters: b.whyThisMatters,
      accuracy: b.accuracy,
    };
    if (b.activityType === "study" && b.topic) {
      block.handoutRef = { url: handoutUrl, anchor: matchAnchor(b.topic, headings) };
    }
    if (b.activityType === "quiz" && b.topic) {
      block.questions = await drawQuestions(upperCode, type, b.topic);
    }
    boundBlocks.push(block);
  }

  const generatedAt = new Date(startTimeMs);
  await CrashPlanModel.updateOne(
    { userId, code: upperCode, type },
    { $set: { hoursAvailable, generatedAt, blocks: boundBlocks } },
    { upsert: true },
  );

  return shape(upperCode, type, hoursAvailable, generatedAt, boundBlocks, user);
}

// Return a previously generated plan (or an empty "not generated yet" shape).
export async function getSaved(
  userId: string,
  code: string,
  type: string,
  user?: AccessUser,
): Promise<CrashPlanResponse> {
  const upperCode = code.toUpperCase();
  const plan = await CrashPlanModel.findOne({
    userId,
    code: upperCode,
    type,
  }).lean<{
    hoursAvailable: number;
    generatedAt: Date;
    blocks: ICrashBlock[];
  } | null>();

  if (!plan) {
    return {
      course: upperCode,
      examType: type,
      exists: false,
      locked: !hasCrashPlanAccess(user, upperCode),
      hoursAvailable: null,
      generatedAt: null,
      blockCount: 0,
      blocks: [],
    };
  }

  return shape(
    upperCode,
    type,
    plan.hoursAvailable,
    plan.generatedAt,
    plan.blocks,
    user,
  );
}

// --- DTO shaping + paywall gate ----------------------------------------------

function shape(
  course: string,
  examType: string,
  hoursAvailable: number,
  generatedAt: Date,
  blocks: ICrashBlock[],
  user?: AccessUser,
): CrashPlanResponse {
  const locked = !hasCrashPlanAccess(user, course);

  const dto: CrashBlockDTO[] = blocks.map((b) => ({
    startTime: new Date(b.startTime).toISOString(),
    endTime: new Date(b.endTime).toISOString(),
    topic: b.topic ?? null,
    activityType: b.activityType,
    // Structure stays visible when locked (topic + type + times); the actionable
    // content — the "why", the handout anchor and the drilled questions — is gated.
    whyThisMatters: locked ? null : b.whyThisMatters,
    accuracy: b.accuracy ?? null,
    handoutRef: locked ? null : b.handoutRef ?? null,
    questions: locked ? null : b.questions ?? null,
  }));

  return {
    course,
    examType,
    exists: true,
    locked,
    hoursAvailable,
    generatedAt: new Date(generatedAt).toISOString(),
    blockCount: dto.length,
    blocks: dto,
  };
}
