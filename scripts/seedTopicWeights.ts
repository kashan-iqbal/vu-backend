// Seed CourseTopicWeight from the AI quiz bank.
//
// Past papers carry no topic labels, so a topic's exam-weight is approximated by
// how often it appears in the quiz bank for that course exam. Idempotent: re-run
// any time the quiz bank changes.
//
//   npm run seed:topic-weights
import mongoose from "mongoose";
import { env } from "../src/config/env";
import { QuizModel } from "../src/modules/ai-quiz/quiz.model";
import { CourseTopicWeightModel } from "../src/modules/readiness/courseTopicWeight.model";

interface Row {
  _id: { code: string; type: string; topic_name: string };
  count: number;
}

async function main() {
  await mongoose.connect(env.DATABASE_URL);
  console.log("Connected.");

  const rows = (await QuizModel.aggregate([
    {
      $group: {
        _id: { code: "$code", type: "$type", topic_name: "$topic_name" },
        count: { $sum: 1 },
      },
    },
  ])) as Row[];

  if (rows.length === 0) {
    console.log("No quiz-bank questions found — nothing to seed.");
    await mongoose.disconnect();
    return;
  }

  const ops = rows.map((r) => ({
    updateOne: {
      filter: {
        code: r._id.code,
        type: r._id.type,
        topic_name: r._id.topic_name,
      },
      update: { $set: { weight: r.count } },
      upsert: true,
    },
  }));

  const res = await CourseTopicWeightModel.bulkWrite(ops, { ordered: false });
  console.log(
    `Seeded ${rows.length} topic weights ` +
      `(upserted: ${res.upsertedCount}, modified: ${res.modifiedCount}).`,
  );

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error("seedTopicWeights failed:", err);
  process.exit(1);
});
