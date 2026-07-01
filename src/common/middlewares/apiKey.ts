import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { env } from "../../config/env";

// Protects admin/script-only write endpoints (e.g. POST /handout) with a static
// shared secret sent in the `x-api-key` header. Uses a constant-time compare so
// the check doesn't leak the key via response timing.
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const provided = Buffer.from(req.header("x-api-key") ?? "");
  const expected = Buffer.from(env.HANDOUT_API_KEY);

  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  next();
}
