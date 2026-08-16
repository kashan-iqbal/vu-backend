import { describe, it, expect } from "vitest";
import { generateCrashPlan, type CrashTopic } from "./crashPlan.compute";

// tzOffsetMin: 0 + Date.UTC start times keep the night-window maths deterministic
// regardless of the machine's timezone.
const DAYTIME = Date.UTC(2026, 0, 1, 9, 0); // 09:00 local when tzOffsetMin=0
const noTz = { tzOffsetMin: 0 };

const topic = (
  t: string,
  weight: number,
  attempts: number,
  correct: number,
): CrashTopic => ({ topic: t, weight, attempts, correct });

describe("generateCrashPlan", () => {
  it("returns just a mock block when there are no weak/weighted topics", () => {
    const { blocks, topicOrder } = generateCrashPlan({
      topics: [],
      hoursAvailable: 12,
      startTimeMs: DAYTIME,
      opts: noTz,
    });
    expect(topicOrder).toEqual([]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].activityType).toBe("mock");
  });

  it("drops fully-mastered topics (weakness 0 → priority 0)", () => {
    const { blocks } = generateCrashPlan({
      topics: [topic("Mastered", 10, 20, 20)], // 100% accuracy
      hoursAvailable: 12,
      startTimeMs: DAYTIME,
      opts: noTz,
    });
    expect(blocks.every((b) => b.activityType !== "study")).toBe(true);
    expect(blocks.at(-1)?.activityType).toBe("mock");
  });

  it("ranks a heavy weak topic ahead of a light weak one", () => {
    const { topicOrder } = generateCrashPlan({
      topics: [
        topic("Light", 2, 10, 5), // priority 2 × 0.5 = 1
        topic("Heavy", 10, 10, 2), // priority 10 × 0.8 = 8
      ],
      hoursAvailable: 6,
      startTimeMs: DAYTIME,
      opts: noTz,
    });
    expect(topicOrder[0]).toBe("Heavy");
    expect(topicOrder).toContain("Light");
  });

  it("surfaces an un-quizzed topic instead of skipping it", () => {
    const { topicOrder } = generateCrashPlan({
      topics: [
        topic("Practiced", 3, 10, 7), // priority 3 × 0.3 = 0.9
        topic("NeverTried", 5, 0, 0), // priority 5 × 1 = 5 (max weakness)
      ],
      hoursAvailable: 6,
      startTimeMs: DAYTIME,
      opts: noTz,
    });
    expect(topicOrder[0]).toBe("NeverTried");
    expect(topicOrder).toContain("Practiced");
  });

  it("keeps study blocks within [45,120] and quiz blocks fixed", () => {
    const { blocks } = generateCrashPlan({
      topics: [
        topic("A", 8, 10, 2),
        topic("B", 5, 10, 4),
        topic("C", 3, 10, 6),
      ],
      hoursAvailable: 6, // 09:00 → 15:00, no night
      startTimeMs: DAYTIME,
      opts: noTz,
    });
    for (const b of blocks) {
      const dur = b.endOffsetMin - b.startOffsetMin;
      if (b.activityType === "study") {
        expect(dur).toBeGreaterThanOrEqual(45);
        expect(dur).toBeLessThanOrEqual(120);
      }
      if (b.activityType === "quiz") expect(dur).toBe(20);
    }
  });

  it("inserts a rest block when the window spans a night", () => {
    const { blocks } = generateCrashPlan({
      topics: [topic("A", 8, 10, 2), topic("B", 5, 10, 4)],
      hoursAvailable: 24, // 09:00 → next 09:00, crosses 01:00–07:00
      startTimeMs: DAYTIME,
      opts: noTz,
    });
    expect(blocks.some((b) => b.activityType === "rest")).toBe(true);
  });

  it("omits the rest block for a short daytime window", () => {
    const { blocks } = generateCrashPlan({
      topics: [topic("A", 8, 10, 2), topic("B", 5, 10, 4)],
      hoursAvailable: 6, // 09:00 → 15:00
      startTimeMs: DAYTIME,
      opts: noTz,
    });
    expect(blocks.some((b) => b.activityType === "rest")).toBe(false);
  });

  it("always ends with the mock block", () => {
    const { blocks } = generateCrashPlan({
      topics: [topic("A", 8, 10, 2), topic("B", 5, 10, 4)],
      hoursAvailable: 24,
      startTimeMs: DAYTIME,
      opts: noTz,
    });
    expect(blocks.at(-1)?.activityType).toBe("mock");
    // exactly one mock, and it is last
    expect(blocks.filter((b) => b.activityType === "mock")).toHaveLength(1);
  });

  it("gives the heavier-priority topic at least as much study time", () => {
    const { blocks } = generateCrashPlan({
      topics: [
        topic("Heavy", 10, 10, 1), // priority 9
        topic("Light", 2, 10, 5), // priority 1
      ],
      hoursAvailable: 8,
      startTimeMs: DAYTIME,
      opts: noTz,
    });
    const study = (t: string) =>
      blocks.find((b) => b.activityType === "study" && b.topic === t)!;
    const heavy = study("Heavy");
    const light = study("Light");
    const dur = (b: typeof heavy) => b.endOffsetMin - b.startOffsetMin;
    expect(dur(heavy)).toBeGreaterThanOrEqual(dur(light));
  });

  it("is deterministic for the same input", () => {
    const input = {
      topics: [topic("A", 8, 10, 2), topic("B", 5, 10, 4)],
      hoursAvailable: 24,
      startTimeMs: DAYTIME,
      opts: noTz,
    };
    expect(generateCrashPlan(input)).toEqual(generateCrashPlan(input));
  });

  it("still returns a usable plan for a tiny window", () => {
    const { blocks } = generateCrashPlan({
      topics: [topic("A", 8, 10, 2)],
      hoursAvailable: 1, // 60 min
      startTimeMs: DAYTIME,
      opts: noTz,
    });
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks.at(-1)?.activityType).toBe("mock");
  });
});
