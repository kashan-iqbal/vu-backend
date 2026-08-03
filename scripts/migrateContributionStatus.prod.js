// Production-safe variant of migrateContributionStatus.ts.
//
// The regular script needs ts-node (a devDependency, stripped from the EC2
// host by `npm ci --omit=dev`) and imports from src/ (also not shipped —
// deploy.yml only copies dist/, package.json, package-lock.json,
// ecosystem.config.js). This version is plain CommonJS and only needs
// `mongoose`, which IS a production dependency, and reads the collection
// directly by name instead of importing the compiled model — so it runs on
// the server with nothing extra installed.
//
// Usage on the EC2 host, from the app dir (same one PM2 runs from, so its
// .env with the real DATABASE_URL is right there):
//
//   node scripts/migrateContributionStatus.prod.js
//
// Safe to re-run — every step is idempotent.
require("dotenv").config();
const mongoose = require("mongoose");

const REJECTED = "rejected";
const PENDING = "pending";

async function dropIndexIfExists(collection, name) {
  try {
    await collection.dropIndex(name);
    console.log(`Dropped index ${name}.`);
  } catch (error) {
    if (error?.codeName === "IndexNotFound") {
      console.log(`No ${name} index found — skipping drop.`);
    } else {
      throw error;
    }
  }
}

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("DATABASE_URL is not set in this shell/.env");

  await mongoose.connect(uri);
  console.log(`Connected to ${uri.replace(/\/\/.*@/, "//<redacted>@")}`);

  const collection = mongoose.connection.collection("contributions");

  const backfillStatus = await collection.updateMany(
    { status: { $exists: false } },
    { $set: { status: PENDING } },
  );
  console.log(`Backfilled ${backfillStatus.modifiedCount} contribution(s) with status="pending".`);

  await dropIndexIfExists(collection, "code_1");
  await dropIndexIfExists(collection, "codeSlot_1");

  const backfillSlot = await collection.updateMany({ status: { $ne: REJECTED } }, [
    { $set: { codeSlot: "$code" } },
  ]);
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
