import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";

// Cloudflare R2 speaks the S3 API. Region is always "auto" and the endpoint is
// derived from the account id.
//
// Storage is optional infrastructure: the app boots fine without it, and callers
// must check isR2Configured() before attempting an upload so we can return a
// clean 503 instead of throwing.
export function isR2Configured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET,
  );
}

let client: S3Client | null = null;

// Built lazily (and memoised) so importing this module never requires creds.
export function getR2Client(): S3Client {
  if (!isR2Configured()) {
    throw new Error("R2 is not configured");
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

export function getR2Bucket(): string {
  if (!env.R2_BUCKET) throw new Error("R2 is not configured");
  return env.R2_BUCKET;
}
