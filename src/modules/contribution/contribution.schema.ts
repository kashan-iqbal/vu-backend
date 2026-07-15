import { z } from "zod";

// The file is handled by multer and the course code is a route param; everything
// else about the uploader travels in the multipart body.
//
// Uploads are anonymous (no login), so name/phone are how a contribution is
// attributed. They are self-reported and unverified — a contact hint, not proof
// of identity.
export const contributionBodySchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  phone: z
    .string()
    .trim()
    .regex(/^03\d{9}$/, "Enter a valid 11-digit mobile number (03XXXXXXXXX)"),
  note: z.string().trim().max(500).optional(),
});

// Course codes look like ACC501 / BIO504T / MGMT614. This is a shape check only —
// the controller additionally rejects anything outside the allowlist in
// contribution.codes.ts.
export const contributionCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,5}[0-9]{3}[A-Z]?$/, "Invalid course code");
