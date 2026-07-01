import 'dotenv/config';
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string(),
  DEEPSEEK_API_KEY: z.string().optional(),
  QDRANT_URL: z.string(),
  QDRANT_API_KEY: z.string().optional(),
  FRONTEND_URL: z.string().url(),
  // Shared secret guarding admin/script write endpoints (POST /handout).
  HANDOUT_API_KEY: z.string().min(16),

});

export const env = EnvSchema.parse(process.env);
