// One-time migration for the contribution moderation feature.
//
// Run this BEFORE restarting the app with the new code: the schema replaces
// the plain unique index on `code` with a sparse unique index on `codeSlot`
// (a mirror field that's unset once a contribution is rejected — MongoDB
// partial indexes don't support $ne, so a partial filter on `status` isn't
// an option; a sparse index on a mirror field gets the same effect). If the
// app boots first, Mongoose's autoIndex will try to create the new index
// while the old `code_1` one still exists, which can fail or leave things
// inconsistent.
//
//   npm run migrate:contribution-status
import mongoose from "mongoose";
import { env } from "../src/config/env";
import {
  ContributionModel,
  ContributionStatus,
} from "../src/modules/contribution/contribution.model";

async function dropIndexIfExists(collection: mongoose.mongo.Collection, name: string) {
  try {
    await collection.dropIndex(name);
    console.log(`Dropped index ${name}.`);
  } catch (error: any) {
    if (error?.codeName === "IndexNotFound") {
      console.log(`No ${name} index found — skipping drop.`);
    } else {
      throw error;
    }
  }
}

async function main() {
  await mongoose.connect(env.DATABASE_URL);
  console.log("Connected.");

  const backfillStatus = await ContributionModel.updateMany(
    { status: { $exists: false } },
    { $set: { status: ContributionStatus.PENDING } },
  );
  console.log(`Backfilled ${backfillStatus.modifiedCount} contribution(s) with status="pending".`);

  const collection = mongoose.connection.collection("contributions");

  await dropIndexIfExists(collection, "code_1");
  // In case a previous (failed) run of this script already created it.
  await dropIndexIfExists(collection, "codeSlot_1");

  const backfillSlot = await collection.updateMany(
    { status: { $ne: ContributionStatus.REJECTED } },
    [{ $set: { codeSlot: "$code" } }],
  );
  console.log(`Backfilled codeSlot on ${backfillSlot.modifiedCount} non-rejected contribution(s).`);

  await collection.createIndex({ codeSlot: 1 }, { unique: true, sparse: true, name: "codeSlot_1" });
  console.log("Created sparse unique index on codeSlot.");

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
