import { describe, it, expect } from "vitest";
import { normalizeQuestion, hashQuestion } from "./gdb.normalize";

describe("normalizeQuestion", () => {
  it("lowercases, trims and collapses whitespace", () => {
    expect(normalizeQuestion("  Discuss   Inflation\n\tTargeting  ")).toBe(
      "discuss inflation targeting",
    );
  });
});

describe("hashQuestion", () => {
  it("is stable across spacing/casing differences of the same question", () => {
    const a = hashQuestion("Discuss whether inflation targeting suits Pakistan.");
    const b = hashQuestion("  discuss   WHETHER inflation\ttargeting suits pakistan.  ");
    expect(a).toBe(b);
  });

  it("differs for different questions", () => {
    expect(hashQuestion("Explain TCP handshake")).not.toBe(
      hashQuestion("Explain UDP"),
    );
  });

  it("returns a 64-char hex sha256", () => {
    expect(hashQuestion("anything")).toMatch(/^[0-9a-f]{64}$/);
  });
});
