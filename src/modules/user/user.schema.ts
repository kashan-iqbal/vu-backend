import { z } from "zod";

export const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
});

// DELETE /user/me — re-authentication proof, not the account's identity (that
// comes from the authGuard-verified JWT, never from this body).
//
// Exactly one of the two applies, decided by the account's actual `provider` in
// the controller once it has loaded the user — a local account supplies
// `password`, a Google-only account (no password hash to check) supplies a
// FRESH `credential` (Google ID token) instead. Both are accepted here and
// z.transform-free so one schema covers either shape; `refine` only rejects the
// case where neither was sent.
export const deleteAccountSchema = z
  .object({
    password: z.string().min(1, "Password is required").optional(),
    credential: z.string().min(1, "Google credential is required").optional(),
  })
  .refine((body) => Boolean(body.password) || Boolean(body.credential), {
    message: "password or credential is required to confirm account deletion",
  });
