import { z } from "zod";

// Only the optional note travels in the body — the file is handled by multer and
// the course code is a route param.
export const contributionBodySchema = z.object({
  note: z.string().trim().max(500).optional(),
});

// Course codes look like ACC501 / BIO504T / MGMT614. Validated so a caller can't
// shape arbitrary object keys in the bucket.
export const contributionCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,5}[0-9]{3}[A-Z]?$/, "Invalid course code");
