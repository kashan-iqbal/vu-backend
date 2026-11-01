// Pure option-shuffling helpers for quiz delivery. No I/O, no DB, no randomness
// that cannot be injected — same posture as readiness.compute.ts and
// crashPlan.compute.ts, so it is cheap to run and trivially unit-testable.
//
// The whole scheme rests on one convention: `order[displayIndex] = originalIndex`.
// The browser only ever sees shuffled options and taps a DISPLAY index; the stored
// order is the only thing the server needs to map that tap back onto the MCQ's
// real `correctAnswer` index. The browser is never told which index is correct.

export type Rng = () => number;

/** Fisher-Yates over [0..length), using an injectable RNG for deterministic tests. */
export function shuffleIndices(length: number, rand: Rng = Math.random): number[] {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Reorder `items` into display order. */
export function applyOrder<T>(items: T[], order: number[]): T[] {
  return order.map((originalIndex) => items[originalIndex]);
}

/**
 * Map a display index (what the student tapped) back to the original option index
 * (what `quiz.correctAnswer` refers to). Returns null for anything out of range —
 * including the -1 the client sends for an unanswered question.
 */
export function toOriginalIndex(
  order: number[],
  displayIndex: number,
): number | null {
  if (!Number.isInteger(displayIndex)) return null;
  if (displayIndex < 0 || displayIndex >= order.length) return null;
  const original = order[displayIndex];
  return typeof original === "number" ? original : null;
}

/**
 * Map an original option index to where it now sits on screen. Used only AFTER an
 * answer is graded, so the UI can highlight the right option. -1 if absent.
 */
export function toDisplayIndex(order: number[], originalIndex: number): number {
  return order.indexOf(originalIndex);
}

/** Shuffle one MCQ's options for delivery. Returns the display options + the map. */
export function shuffleQuestionOptions(
  options: string[],
  rand: Rng = Math.random,
): { options: string[]; order: number[] } {
  const order = shuffleIndices(options.length, rand);
  return { options: applyOrder(options, order), order };
}
