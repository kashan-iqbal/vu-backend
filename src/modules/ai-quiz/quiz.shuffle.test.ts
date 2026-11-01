import { describe, it, expect } from "vitest";
import {
  shuffleIndices,
  applyOrder,
  toOriginalIndex,
  toDisplayIndex,
  shuffleQuestionOptions,
} from "./quiz.shuffle";

// A deterministic RNG so the shuffle is assertable. Always returns 0, which makes
// Fisher-Yates swap each position with index 0 — a fixed, known permutation.
const alwaysZero = () => 0;

describe("shuffleIndices", () => {
  it("returns a permutation of every index, with none lost or duplicated", () => {
    const order = shuffleIndices(4);
    expect([...order].sort()).toEqual([0, 1, 2, 3]);
  });

  it("is deterministic under an injected RNG", () => {
    expect(shuffleIndices(4, alwaysZero)).toEqual(shuffleIndices(4, alwaysZero));
  });

  it("handles a zero-length input", () => {
    expect(shuffleIndices(0)).toEqual([]);
  });
});

describe("applyOrder", () => {
  it("reorders items to match the order map", () => {
    expect(applyOrder(["a", "b", "c"], [2, 0, 1])).toEqual(["c", "a", "b"]);
  });
});

describe("toOriginalIndex", () => {
  const order = [2, 0, 3, 1]; // display 0 -> original 2, display 1 -> original 0, ...

  it("maps a display index back to the original index", () => {
    expect(toOriginalIndex(order, 0)).toBe(2);
    expect(toOriginalIndex(order, 3)).toBe(1);
  });

  it("rejects the -1 sentinel used for an unanswered question", () => {
    expect(toOriginalIndex(order, -1)).toBeNull();
  });

  it("rejects out-of-range and non-integer input", () => {
    expect(toOriginalIndex(order, 4)).toBeNull();
    expect(toOriginalIndex(order, 1.5)).toBeNull();
    expect(toOriginalIndex(order, NaN)).toBeNull();
  });
});

describe("toDisplayIndex", () => {
  it("finds where an original option now sits on screen", () => {
    expect(toDisplayIndex([2, 0, 3, 1], 3)).toBe(2);
  });

  it("returns -1 when the original index is not in the map", () => {
    expect(toDisplayIndex([2, 0, 3, 1], 9)).toBe(-1);
  });
});

describe("shuffleQuestionOptions", () => {
  it("round-trips: the option at a display index is the one the map points at", () => {
    const original = ["alpha", "beta", "gamma", "delta"];
    const { options, order } = shuffleQuestionOptions(original);

    for (let display = 0; display < options.length; display++) {
      const originalIndex = toOriginalIndex(order, display);
      expect(originalIndex).not.toBeNull();
      expect(options[display]).toBe(original[originalIndex as number]);
    }
  });

  it("keeps every option, so nothing is dropped from the MCQ", () => {
    const { options } = shuffleQuestionOptions(["a", "b", "c", "d"]);
    expect([...options].sort()).toEqual(["a", "b", "c", "d"]);
  });
});
