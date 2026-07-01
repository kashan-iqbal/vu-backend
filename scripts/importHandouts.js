// Standalone handout importer — plain Node, no TypeScript imports.
// Reads <CODE>_summary_<midterm|finalterm>.md files and upserts them into the
// SAME "handouts" collection the backend reads (model name "Handout").
//
// Usage (run from the backend/ folder):
//   node scripts/importHandouts.js                       # all of ../scraper/pdfs
//   node scripts/importHandouts.js ../scraper/pdfs/CS    # just the CS subject folder
//   node scripts/importHandouts.js ../scraper/pdfs/CS --dry-run   # preview, no writes

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const fs = require("fs");
const mongoose = require("mongoose");

// ── Handout model (mirrors backend/src/modules/handouts/handout.model.ts) ──
const HandoutSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    examType: { type: String, enum: ["midterm", "finalterm"], required: true },
    content: { type: String, required: true },
  },
  { timestamps: true, versionKey: false },
);
HandoutSchema.index({ code: 1, examType: 1 }, { unique: true });

const HandoutModel =
  mongoose.models.Handout || mongoose.model("Handout", HandoutSchema);

async function upsertHandout(code, examType, content) {
  return HandoutModel.findOneAndUpdate(
    { code: code.toUpperCase(), examType },
    { content },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

// ── File discovery / parsing ──
const SUMMARY_RE = /^(.+?)_summary_(midterm|finalterm)\.md$/i;

function findSummaryFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findSummaryFiles(full));
    } else if (SUMMARY_RE.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function parseFileName(fileName) {
  const match = fileName.match(SUMMARY_RE);
  if (!match) return null;
  return {
    code: match[1].toUpperCase(),
    examType: match[2].toLowerCase(), // "midterm" | "finalterm"
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const dirArg = args.find((a) => !a.startsWith("--"));

  // Default to <repo>/scraper/pdfs (backend/scripts -> repo root).
  const target = dirArg
    ? path.resolve(process.cwd(), dirArg)
    : path.resolve(__dirname, "../../scraper/pdfs");

  if (!fs.existsSync(target)) {
    console.error(`Directory not found: ${target}`);
    process.exit(1);
  }

  const files = findSummaryFiles(target);
  console.log(
    `Found ${files.length} summary file(s) under ${target}${dryRun ? "  (DRY RUN — no DB writes)" : ""}\n`,
  );

  if (!dryRun) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      console.error("DATABASE_URL is not set (check backend/.env)");
      process.exit(1);
    }
    await mongoose.connect(url);
    console.log("MongoDB connected\n");
  }

  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    const parsed = parseFileName(path.basename(file));
    if (!parsed) {
      console.warn(`  skip (bad name): ${path.basename(file)}`);
      skipped++;
      continue;
    }

    const content = fs.readFileSync(file, "utf8").trim();
    if (!content) {
      console.warn(`  skip (empty): ${path.basename(file)}`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(
        `  would import → ${parsed.code} / ${parsed.examType}  (${content.length} chars)`,
      );
    } else {
      await upsertHandout(parsed.code, parsed.examType, content);
      console.log(
        `  ✓ ${parsed.code} / ${parsed.examType}  (${content.length} chars)`,
      );
    }
    imported++;
  }

  console.log(
    `\nDone. ${dryRun ? "Would import" : "Imported/updated"} ${imported}, skipped ${skipped}.`,
  );

  if (!dryRun) await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
