import type { IGdbDraft } from "./gdbCache.model";

// The GDB helper deliberately returns a STRUCTURED, EDITABLE DRAFT — an original
// framework the student reshapes and owns — never a finished, submit-ready answer.
// We request strict JSON (DeepSeek is OpenAI-compatible → response_format json_object)
// so the UI can render clean, labelled sections.

const SYSTEM = `You are a study coach for university students preparing a Graded Discussion Board (GDB) or assignment. You produce an ORIGINAL DRAFT FRAMEWORK the student must edit, expand and put in their own words — never a finished, submit-ready answer, and never fabricated citations or data.

Return ONLY a JSON object with EXACTLY these keys:
{
  "stance": "1-2 sentences taking a clear opening position on the prompt",
  "supportingPoints": ["2 to 3 short bullet arguments that back the stance"],
  "counterpoint": "1-2 sentences giving the strongest opposing view and a brief rebuttal",
  "conclusion": "1-2 sentences that resolve the discussion",
  "registerNote": "one short tip on tone/length to match a typical student's own voice"
}

Keep it concise, in plain student-level English. Do not add any keys, markdown, or text outside the JSON.`;

export function buildGdbMessages(question: string) {
  return [
    { role: "system" as const, content: SYSTEM },
    {
      role: "user" as const,
      content: `GDB / assignment prompt:\n\n"""${question}"""\n\nProduce the JSON draft framework.`,
    },
  ];
}

// Coerce the model's JSON into a safe IGdbDraft (defensive — never trust shape).
export function parseDraft(raw: string): IGdbDraft {
  const obj = JSON.parse(raw) as Partial<IGdbDraft>;
  const points = Array.isArray(obj.supportingPoints)
    ? obj.supportingPoints.filter((p): p is string => typeof p === "string").slice(0, 3)
    : [];
  return {
    stance: typeof obj.stance === "string" ? obj.stance : "",
    supportingPoints: points,
    counterpoint: typeof obj.counterpoint === "string" ? obj.counterpoint : "",
    conclusion: typeof obj.conclusion === "string" ? obj.conclusion : "",
    registerNote: typeof obj.registerNote === "string" ? obj.registerNote : "",
  };
}

// A draft is only useful if it actually carried substance.
export function isDraftUsable(d: IGdbDraft): boolean {
  return d.stance.trim().length > 0 || d.supportingPoints.length > 0;
}
