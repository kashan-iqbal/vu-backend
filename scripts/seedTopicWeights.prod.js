// Production-safe variant of seedTopicWeights.ts.
//
// Same reason as migrateContributionStatus.prod.js: the regular script needs
// ts-node (a devDependency, stripped from the EC2 host by `npm ci --omit=dev`)
// and imports from src/ (not shipped — deploy.yml only copies dist/,
// package.json, package-lock.json, ecosystem.config.js). This version is
// plain CommonJS and only needs `mongoose`, a production dependency, and
// reads/writes collections directly by name instead of importing the
// compiled models — so it runs on the server with nothing extra installed.
//
// Usage on the EC2 host, from the app dir (same one PM2 runs from, so its
// .env with the real DATABASE_URL is right there):
//
//   node scripts/seedTopicWeights.prod.js
//
// Idempotent — safe to re-run any time the quiz bank changes.
require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("DATABASE_URL is not set in this shell/.env");

  await mongoose.connect(uri);
  console.log(`Connected to ${uri.replace(/\/\/.*@/, "//<redacted>@")}`);

  const quiz = mongoose.connection.collection("quiz");
  const weights = mongoose.connection.collection("coursetopicweights");

  const rows = await quiz
    .aggregate([
      {
        $group: {
          _id: { code: "$code", type: "$type", topic_name: "$topic_name" },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  if (rows.length === 0) {
    console.log("No quiz-bank questions found — nothing to seed.");
    await mongoose.disconnect();
    return;
  }

  const ops = rows.map((r) => ({
    updateOne: {
      filter: { code: r._id.code, type: r._id.type, topic_name: r._id.topic_name },
      update: { $set: { weight: r.count } },
      upsert: true,
    },
  }));

  const res = await weights.bulkWrite(ops, { ordered: false });
  console.log(
    `Seeded ${rows.length} topic weights (upserted: ${res.upsertedCount}, modified: ${res.modifiedCount}).`,
  );

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
