import { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";

// Validate `req.body` against a zod schema. On success we REPLACE req.body with
// the parsed (typed + trimmed) data, so controllers only ever receive clean
// primitives. This is what closes NoSQL operator injection: an attacker sending
// `{ "otp": { "$ne": "" } }` fails string parsing and is rejected here, so the
// object can never reach a Mongoose query filter.
export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path.join(".") || "body";
        if (!errors[field]) errors[field] = issue.message;
      }
      return res.status(400).json({ message: "Validation failed", errors });
    }

    req.body = result.data;
    next();
  };
}
