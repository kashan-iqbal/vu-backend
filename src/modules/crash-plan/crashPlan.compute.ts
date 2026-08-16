// Pure "Exam in N hours" crash-plan engine. No I/O, no DB, no LLM — deterministic
// scheduling maths only, so it is cheap to run and trivial to unit-test. The
// service layer feeds it topic data loaded from Mongo and then binds each block to
// real content (handout anchors + drawn MCQs); this file must stay side-effect free.
//
// Blocks are emitted with MINUTE OFFSETS from the start; the service converts those
// to absolute ISO timestamps. Keeping wall-clock out of here (except a pure
// night-window calc driven by an explicit tz offset) is what keeps it deterministic.

export type CrashActivity = "study" | "quiz" | "rest" | "mock";

export interface CrashTopic {
  topic: string;
  weight: number; // exam-weight (CourseTopicWeight); <=0 falls back to 1
  attempts: number; // past answered questions for this topic
  correct: number;
}

export interface CrashBlock {
  startOffsetMin: number; // minutes from the plan start
  endOffsetMin: number;
  topic: string | null; // null for rest/mock
  activityType: CrashActivity;
  priority: number; // weight × weakness (0 for rest/mock)
  accuracy: number | null; // 0..1 for study/quiz, null otherwise
  whyThisMatters: string;
}

export interface CrashOptions {
  minStudyBlockMin?: number; // 45
  maxStudyBlockMin?: number; // 120
  quizBlockMin?: number; // 20 (fixed per-topic drill)
  mockBlockMin?: number; // 90
  sleepBlockMin?: number; // 360
  nightStartHour?: number; // 1 → 01:00 local
  nightEndHour?: number; // 7 → 07:00 local
  maxTopics?: number; // 8 cap
  /** Minutes to add to UTC to get the student's local time. PKT = +300. */
  tzOffsetMin?: number;
}

export interface GenerateInput {
  topics: CrashTopic[];
  hoursAvailable: number;
  startTimeMs: number;
  opts?: CrashOptions;
}

export interface CrashPlanResult {
  blocks: CrashBlock[];
  topicOrder: string[]; // topics that got blocks, in study order
}

const DEFAULTS = {
  minStudyBlockMin: 45,
  maxStudyBlockMin: 120,
  quizBlockMin: 20,
  mockBlockMin: 90,
  sleepBlockMin: 360,
  nightStartHour: 1,
  nightEndHour: 7,
  maxTopics: 8,
  tzOffsetMin: 300,
};

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

// Local hour (0..24, fractional) at a UTC epoch, shifted by an explicit tz offset
// so the calc is deterministic in tests (pass tzOffsetMin: 0 + Date.UTC times).
function localHour(startMs: number, tzOffsetMin: number): number {
  const d = new Date(startMs + tzOffsetMin * 60000);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

function isNight(hour: number, startHour: number, endHour: number): boolean {
  return startHour < endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour; // window wraps midnight
}

// Offset (minutes from start) at which the night window is first entered. Returns 0
// if the plan already starts in the night, or null if it is never entered within
// `windowMin` of the start.
function nightStartOffset(
  startMs: number,
  windowMin: number,
  o: Required<CrashOptions>,
): number | null {
  const startHour = localHour(startMs, o.tzOffsetMin);
  if (isNight(startHour, o.nightStartHour, o.nightEndHour)) return 0;

  // Walk to the next local nightStart boundary.
  const localMs = startMs + o.tzOffsetMin * 60000;
  const d = new Date(localMs);
  d.setUTCHours(o.nightStartHour, 0, 0, 0);
  let boundaryLocal = d.getTime();
  if (boundaryLocal <= localMs) boundaryLocal += 24 * 60 * 60000;

  const offset = Math.round((boundaryLocal - localMs) / 60000);
  return offset < windowMin ? offset : null;
}

function studyWhy(topic: string, attempts: number, accPct: number): string {
  if (attempts === 0) {
    return `${topic} carries real exam weight and you haven't drilled it yet — start here to stop losing easy marks.`;
  }
  if (accPct < 50) {
    return `You're at ${accPct}% on ${topic}, a high-value topic — this is your biggest score risk, so master it first.`;
  }
  return `${topic} is worth solid marks and you're at ${accPct}% — tighten it up before the exam.`;
}

/**
 * Build an ordered, time-boxed crash study plan.
 *
 * priority = weight × weakness (weakness = 1 − accuracy; un-quizzed topics take the
 * maximum weakness so they are never skipped). Highest-priority topics are
 * front-loaded, given study time proportional to priority, each with a quick MCQ
 * drill; a rest block is inserted if the window crosses the night, and a full timed
 * mock is always appended last.
 */
export function generateCrashPlan(input: GenerateInput): CrashPlanResult {
  const o: Required<CrashOptions> = { ...DEFAULTS, ...(input.opts ?? {}) };
  const totalMin = Math.max(0, Math.round(input.hoursAvailable * 60));

  // Rank topics by priority (weight × weakness), stable tie-break by name.
  const ranked = input.topics
    .map((t) => {
      const weight = t.weight > 0 ? t.weight : 1;
      const attempts = Math.max(0, t.attempts);
      const accuracy = attempts > 0 ? clamp(t.correct / attempts, 0, 1) : 0;
      const weakness = attempts > 0 ? 1 - accuracy : 1; // un-quizzed = max weakness
      return {
        topic: t.topic,
        weight,
        attempts,
        accuracy,
        priority: weight * weakness,
      };
    })
    .filter((t) => t.priority > 0)
    .sort((a, b) =>
      b.priority !== a.priority
        ? b.priority - a.priority
        : a.topic.localeCompare(b.topic),
    );

  const blocks: CrashBlock[] = [];
  let offset = 0;
  const push = (
    activityType: CrashActivity,
    durationMin: number,
    topic: string | null,
    priority: number,
    accuracy: number | null,
    whyThisMatters: string,
  ) => {
    if (durationMin <= 0) return;
    blocks.push({
      startOffsetMin: offset,
      endOffsetMin: offset + durationMin,
      topic,
      activityType,
      priority,
      accuracy,
      whyThisMatters,
    });
    offset += durationMin;
  };

  const mockMin = Math.min(o.mockBlockMin, Math.max(15, Math.floor(totalMin / 2)));

  // Nothing to study (no weighted/weak topics) — a single mock is still useful.
  if (ranked.length === 0) {
    push(
      "mock",
      Math.min(totalMin, o.mockBlockMin),
      null,
      0,
      null,
      "No practice topics yet — sit a full timed mock to see where you stand, then quiz a few topics to unlock a targeted plan.",
    );
    return { blocks, topicOrder: [] };
  }

  const workRegionEnd = Math.max(0, totalMin - mockMin);

  // Reserve a sleep block only if the study window crosses the night.
  const nightAt = nightStartOffset(input.startTimeMs, workRegionEnd, o);
  const sleepMin =
    nightAt !== null
      ? Math.min(o.sleepBlockMin, Math.max(0, Math.floor(workRegionEnd / 2)))
      : 0;
  const workBudget = Math.max(0, workRegionEnd - sleepMin);

  const pairMin = o.minStudyBlockMin + o.quizBlockMin;
  const nTopics = Math.min(
    o.maxTopics,
    ranked.length,
    Math.floor(workBudget / pairMin),
  );

  // Lay out study/quiz pairs, inserting the rest block when the clock hits night.
  let slept = false;
  const maybeSleep = () => {
    if (slept || sleepMin <= 0) return;
    if (nightAt !== null && offset >= nightAt) {
      push(
        "rest",
        sleepMin,
        null,
        0,
        null,
        "Sleep now — grinding through the small hours wrecks recall. You'll retain far more after rest and be sharper for the mock.",
      );
      slept = true;
    }
  };

  const selected: string[] = [];

  if (nTopics >= 1) {
    const chosen = ranked.slice(0, nTopics);
    const prioritySum = chosen.reduce((s, t) => s + t.priority, 0);
    let extra = Math.max(0, workBudget - nTopics * pairMin);

    for (const t of chosen) {
      maybeSleep();
      const share = prioritySum > 0 ? t.priority / prioritySum : 1 / nTopics;
      const studyExtra = Math.floor(extra * share);
      const studyMin = clamp(
        o.minStudyBlockMin + studyExtra,
        o.minStudyBlockMin,
        o.maxStudyBlockMin,
      );
      const accPct = Math.round(t.accuracy * 100);
      push(
        "study",
        studyMin,
        t.topic,
        t.priority,
        t.accuracy,
        studyWhy(t.topic, t.attempts, accPct),
      );
      push(
        "quiz",
        o.quizBlockMin,
        t.topic,
        t.priority,
        t.accuracy,
        `Lock in ${t.topic} with a quick timed drill and confirm it actually stuck.`,
      );
      selected.push(t.topic);
    }
  } else if (workBudget >= 15) {
    // Tiny window: one quick pass over the single most important topic.
    const t = ranked[0];
    maybeSleep();
    push(
      "study",
      Math.min(o.maxStudyBlockMin, workBudget),
      t.topic,
      t.priority,
      t.accuracy,
      studyWhy(t.topic, t.attempts, Math.round(t.accuracy * 100)),
    );
    selected.push(t.topic);
  }

  // Night was due but never hit during the work loop (e.g. it starts right at the
  // work/mock boundary) — take the rest before the mock rather than lose it.
  if (!slept && sleepMin > 0) {
    push(
      "rest",
      sleepMin,
      null,
      0,
      null,
      "Sleep now — grinding through the small hours wrecks recall. You'll retain far more after rest and be sharper for the mock.",
    );
  }

  push(
    "mock",
    mockMin,
    null,
    0,
    null,
    "Finish with a full timed mock to rehearse exam pressure and surface any gaps while there's still time to close them.",
  );

  return { blocks, topicOrder: selected };
}
