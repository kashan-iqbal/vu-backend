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
