import { PastQuizModel, IPastQuiz } from "./pastQuiz.model";

export async function bulkUpsertPastQuiz(items: Partial<IPastQuiz>[]) {
  const bulkOps = items.map((item) => ({
    updateOne: {
      // (code, type, id) is the natural key; `id` alone is not unique.
      filter: { code: item.code, type: item.type, id: item.id },
      update: { $set: item },
      upsert: true,
    },
  }));

  const result = await PastQuizModel.bulkWrite(bulkOps);
  return {
    matched: result.matchedCount,
    upserted: result.upsertedCount,
    modified: result.modifiedCount,
  };
}

export async function getPastQuizByCodeAndType(code: string, type: string) {
  return PastQuizModel.find({ code: code.toUpperCase(), type }).lean();
}

/**
 * Distinct { code, type } pairs that have past-paper MCQs, with a count. Drives
 * the public /past-papers SSG pages + sitemap (content-aware, like handouts), so
 * we only ever publish a page that has real questions. `minCount` gates thin
 * pages out of the index.
 */
export async function getPastQuizKeys(minCount = 1) {
  const rows = await PastQuizModel.aggregate<{
    _id: { code: string; type: string };
    count: number;
  }>([
    { $group: { _id: { code: "$code", type: "$type" }, count: { $sum: 1 } } },
    { $match: { count: { $gte: minCount } } },
    { $sort: { "_id.code": 1, "_id.type": 1 } },
  ]);
  return rows.map((r) => ({
    code: r._id.code,
    examType: r._id.type,
    count: r.count,
  }));
}
