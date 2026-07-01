import { HandoutModel, ExamType, IHandout } from "./handout.model";

type HandoutContent = Pick<IHandout, "code" | "examType" | "content">;
type HandoutKey = Pick<IHandout, "code" | "examType">;

// Single handout lookup — hits the unique { code, examType } index, returns a
// lean projection (no _id / timestamps) so only the content travels.
export async function getHandout(
  code: string,
  examType: string,
): Promise<HandoutContent | null> {
  return HandoutModel.findOne({ code: code.toUpperCase(), examType })
    .select("code examType content -_id")
    .lean<HandoutContent>();
}

// Lightweight list of every { code, examType } pair (no content) — used by the
// frontend's generateStaticParams to pre-render one static page per handout.
export async function listHandoutKeys(): Promise<HandoutKey[]> {
  return HandoutModel.find({}, { code: 1, examType: 1, _id: 0 })
    .sort({ code: 1, examType: 1 })
    .lean<HandoutKey[]>();
}

// Upsert by { code, examType } — used by the bulk md-import script / admin POST.
export async function upsertHandout(
  code: string,
  examType: ExamType,
  content: string,
) {
  return HandoutModel.findOneAndUpdate(
    { code: code.toUpperCase(), examType },
    { content },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
}
