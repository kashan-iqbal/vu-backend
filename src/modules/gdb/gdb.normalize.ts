import { createHash } from "crypto";

// Normalize a GDB/assignment prompt so trivially-different pastes of the SAME
// question collapse to one cache key: lowercase, trim, and squeeze every run of
// whitespace (spaces, tabs, newlines) down to a single space. Pure + deterministic.
export function normalizeQuestion(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, " ");
}

// sha256 of the normalized prompt — the shared cache key. Two students who paste
// the same GDB with different spacing/casing hash identically and share one answer.
export function hashQuestion(raw: string): string {
  return createHash("sha256").update(normalizeQuestion(raw)).digest("hex");
}
