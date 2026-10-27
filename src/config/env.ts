import 'dotenv/config';
import { z } from "zod";

// Hosting dashboards happily store NODE_ENV as `"production"` (quotes included),
// `production ` (trailing space from a paste), or an empty string. None of those
// are `undefined`, so a plain .default() never fires and boot dies on a Zod enum
// error that doesn't even print the offending value. Normalise before validating.
const nodeEnv = (raw: unknown) => {
  if (typeof raw !== "string") return "development";
  const cleaned = raw.trim().replace(/^["']+|["']+$/g, "").toLowerCase();
  return cleaned === "" ? "development" : cleaned;
};

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.preprocess(nodeEnv, z.enum(["development", "production", "test"])),
  DATABASE_URL: z.string().url(),
  DEEPSEEK_API_KEY: z.string().optional(),
  FRONTEND_URL: z.string().url(),
  // Shared secret guarding admin/script write endpoints (POST /handout).
  HANDOUT_API_KEY: z.string().min(16),

  // Cloudflare R2 (S3-compatible) for user-contributed course PDFs. All optional
  // so the app still boots before storage is provisioned; the upload route
  // reports "not configured" until every one of these is set. See isR2Configured().
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  // Only needed if the bucket is served publicly and you want readable links.
  // Tolerates an empty value so a blank placeholder in .env doesn't fail boot.
  R2_PUBLIC_URL: z.union([z.string().url(), z.literal("")]).optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Report variable names and reasons only - never the values, which hold the
  // DB URL, JWT secret and R2 keys.
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".") || "(root)";
    const received =
      key === "NODE_ENV" ? ` (received: ${JSON.stringify(process.env.NODE_ENV)})` : "";
    console.error(`  ${key}: ${issue.message}${received}`);
  }
  process.exit(1);
}

export const env = parsed.data;
