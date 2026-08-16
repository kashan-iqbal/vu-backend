import { describe, it, expect } from "vitest";
import {
  computeReadiness,
  type TopicHistory,
  type TopicWeight,
} from "./readiness.compute";

// Enough attempts to clear the default minAttempts=10 gate.
const enough = (rows: TopicHistory[]) => rows;

describe("computeReadiness", () => {
  it("returns insufficient status below the attempts threshold", () => {
    const r = computeReadiness(
      [{ topic: "A", attempts: 3, correct: 3 }],
      [{ topic: "A", weight: 5 }],
    );
    expect(r.status).toBe("insufficient");
    expect(r.readiness).toBeNull();
    expect(r.band).toBeNull();
    expect(r.topicsToFix).toBeNull();
    expect(r.attempts).toBe(3);
  });

  it("all-correct with enough attempts scores 100", () => {
    const r = computeReadiness(
      [{ topic: "A", attempts: 12, correct: 12 }],
      [{ topic: "A", weight: 5 }],
    );
    expect(r.status).toBe("ready");
    expect(r.readiness).toBe(100);
    expect(r.topicsToFix).toEqual([]); // nothing to fix
  });

  it("weights a heavily-tested weak topic more than a rare weak one", () => {
    // Same accuracy (50%) on both topics, but topic H is weighted far heavier.
    const history: TopicHistory[] = [
      { topic: "H", attempts: 10, correct: 5 }, // heavy, 50%
      { topic: "L", attempts: 10, correct: 10 }, // light, 100%
    ];
    const heavyWeak: TopicWeight[] = [
      { topic: "H", weight: 9 },
      { topic: "L", weight: 1 },
    ];
    const lightWeak: TopicWeight[] = [
      { topic: "H", weight: 1 },
      { topic: "L", weight: 9 },
    ];
    const rHeavyWeak = computeReadiness(history, heavyWeak);
    const rLightWeak = computeReadiness(history, lightWeak);
    // Being weak on the heavy topic should drag readiness DOWN more.
    expect(rHeavyWeak.readiness!).toBeLessThan(rLightWeak.readiness!);
    // Sanity: Σ(w·acc)/Σw = (9*0.5 + 1*1)/10 = 0.55 → 55
    expect(rHeavyWeak.readiness).toBe(55);
  });

  it("ranks topicsToFix by weight × (1 − accuracy) and takes top 3", () => {
    const history: TopicHistory[] = [
      { topic: "A", attempts: 10, correct: 2 }, // acc .2, w 5 → cost 4.0
      { topic: "B", attempts: 10, correct: 9 }, // acc .9, w 10 → cost 1.0
      { topic: "C", attempts: 10, correct: 5 }, // acc .5, w 8 → cost 4.0
      { topic: "D", attempts: 10, correct: 1 }, // acc .1, w 1 → cost 0.9
    ];
    const weights: TopicWeight[] = [
      { topic: "A", weight: 5 },
      { topic: "B", weight: 10 },
      { topic: "C", weight: 8 },
      { topic: "D", weight: 1 },
    ];
    const r = computeReadiness(history, weights);
    expect(r.topicsToFix).toHaveLength(3);
    const topics = r.topicsToFix!.map((t) => t.topic);
    // A (4.0) and C (4.0) top, then B (1.0); D (0.9) drops off.
    expect(topics).toContain("A");
    expect(topics).toContain("C");
    expect(topics).toContain("B");
    expect(topics).not.toContain("D");
  });

  it("band shrinks as attempts grow", () => {
    const few = computeReadiness(
      [{ topic: "A", attempts: 12, correct: 6 }],
      [{ topic: "A", weight: 1 }],
    );
    const many = computeReadiness(
      [{ topic: "A", attempts: 200, correct: 100 }],
      [{ topic: "A", weight: 1 }],
    );
    const width = (b: { low: number; high: number } | null) =>
      b ? b.high - b.low : Infinity;
    expect(width(many.band)).toBeLessThan(width(few.band));
  });

  it("band stays within 0..100", () => {
    const low = computeReadiness(
      [{ topic: "A", attempts: 12, correct: 0 }],
      [{ topic: "A", weight: 1 }],
    );
    expect(low.band!.low).toBeGreaterThanOrEqual(0);
    const high = computeReadiness(
      [{ topic: "A", attempts: 12, correct: 12 }],
      [{ topic: "A", weight: 1 }],
    );
    expect(high.band!.high).toBeLessThanOrEqual(100);
  });

  it("falls back to weight 1 when a topic has no seeded weight", () => {
    // No weights at all → equal weighting → plain average accuracy.
    const r = computeReadiness(
      [
        { topic: "A", attempts: 10, correct: 10 }, // 100%
        { topic: "B", attempts: 10, correct: 0 }, // 0%
      ],
      [],
    );
    expect(r.status).toBe("ready");
    expect(r.readiness).toBe(50);
  });

  it("empty history is insufficient", () => {
    const r = computeReadiness([], [{ topic: "A", weight: 5 }]);
    expect(r.status).toBe("insufficient");
    expect(r.attempts).toBe(0);
  });

  it("ignores topics with zero attempts in the accuracy blend", () => {
    const r = computeReadiness(
      enough([
        { topic: "A", attempts: 10, correct: 5 },
        { topic: "B", attempts: 0, correct: 0 }, // untouched topic
      ]),
      [
        { topic: "A", weight: 5 },
        { topic: "B", weight: 5 },
      ],
    );
    // Only A counts → 50%.
    expect(r.readiness).toBe(50);
  });

  it("respects a custom minAttempts option", () => {
    const r = computeReadiness(
      [{ topic: "A", attempts: 4, correct: 2 }],
      [{ topic: "A", weight: 1 }],
      { minAttempts: 3 },
    );
    expect(r.status).toBe("ready");
  });
});
