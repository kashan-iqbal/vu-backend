import { HandoutModel, ExamType, IHandout } from "./handout.model";

type HandoutContent = Pick<IHandout, "code" | "examType" | "content" | "updatedAt">;
type HandoutKey = Pick<IHandout, "code" | "examType" | "updatedAt">;

// Single handout lookup — hits the unique { code, examType } index, returns a
// lean projection so only what the page needs travels.
//
// `updatedAt` is included because the frontend has NOTHING to date its content
// with: handout pages carried no schema.org `dateModified` and the sitemap had to
// omit <lastmod> entirely (fabricating one is what made Google discount the
// sitemap in 2026-08). Answer engines also weigh freshness heavily on exam
// material, where "is this still current?" is the decisive question.
export async function getHandout(
  code: string,
  examType: string,
): Promise<HandoutContent | null> {
  return HandoutModel.findOne({ code: code.toUpperCase(), examType })
    .select("code examType content updatedAt -_id")
    .lean<HandoutContent>();
}

// Lightweight list of every { code, examType } pair (no content) — used by the
// frontend's generateStaticParams to pre-render one static page per handout, and
// now also to give the sitemap a REAL <lastmod> per URL.
export async function listHandoutKeys(): Promise<HandoutKey[]> {
  return HandoutModel.find({}, { code: 1, examType: 1, updatedAt: 1, _id: 0 })
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
