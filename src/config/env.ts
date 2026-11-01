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

  // Google Sign-In, one OAuth client per platform. The `aud` claim on an ID
  // token names the client that issued it, so googleAuthController verifies
  // against all three (see googleAudiences()).
  //
  // All optional and empty-tolerant: the native IDs do not exist until the
  // mobile app is set up, and this schema calls process.exit(1) on a failure —
  // a required variable here would stop every current deployment from booting.
  // Read via process.env in auth.controller.ts; declared here as documentation.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_IOS_CLIENT_ID: z.string().optional(),
  GOOGLE_ANDROID_CLIENT_ID: z.string().optional(),

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

  // Vercel Deploy Hook, created in the Vercel dashboard (Project → Settings →
  // Git → Deploy Hooks). Content writes trigger a frontend rebuild through it,
  // because the indexable pages are statically generated with
  // dynamicParams = false and so only learn about new handouts at build time.
  // OPTIONAL and empty-tolerant on purpose: unset locally and in CI, where
  // rebuilding is a no-op, so development imports never burn build minutes.
  VERCEL_DEPLOY_HOOK_URL: z
    .union([z.string().url(), z.literal("")])
    .optional(),
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
