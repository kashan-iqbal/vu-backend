import 'dotenv/config';
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string(),
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

export const env = EnvSchema.parse(process.env);
