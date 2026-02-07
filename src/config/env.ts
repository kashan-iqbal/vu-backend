import 'dotenv/config';
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string(),
  QDRANT_URL: z.string(),
  FRONTEND_URL: z.string().url(),

});

export const env = EnvSchema.parse(process.env);
