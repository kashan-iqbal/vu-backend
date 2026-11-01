import { Request, Response, NextFunction } from "express";
import { env } from "../../config/env";

// Origin-check CSRF protection.
//
// The session cookie is `SameSite=None` in production, because the API and the
// site are on different hosts. SameSite=None means the browser attaches that
// cookie to cross-site requests — so any page on the internet could POST to this
// API with the student's session riding along. SameSite=Lax would have blocked
// that for free; None gives it up, and nothing replaced it.
//
// The rule applied here: a state-changing request that CARRIES THE SESSION COOKIE
// must prove it came from our own origin. Requests with no cookie are left alone —
// they cannot be CSRF, since there is no ambient credential to abuse. That is what
// keeps the API-key script endpoints (handout/pastQuiz POST) and the deliberately
// anonymous PDF upload working, as neither sends a cookie.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Origins allowed to make cookie-authenticated writes. */
function allowedOrigins(): string[] {
  const list = [env.FRONTEND_URL];

  // Local development runs the site on a different port than the API, and Next
  // uses both hostnames interchangeably.
  if (env.NODE_ENV !== "production") {
    list.push(
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3001",
    );
  }

  return list.filter(Boolean).map((o) => o.replace(/\/$/, ""));
}

/** Compare by parsed origin, so a trailing path or slash can't smuggle a match. */
function originMatches(candidate: string, allowed: string[]): boolean {
  try {
    const got = new URL(candidate).origin;
    return allowed.some((a) => {
      try {
        return new URL(a).origin === got;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export function csrfGuard(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();

  // No session cookie → no ambient credential → nothing to forge.
  const hasSessionCookie = Boolean((req as any).cookies?.token);
  if (!hasSessionCookie) return next();

  const allowed = allowedOrigins();

  // Browsers send Origin on every cross-origin request and on all same-origin
  // POSTs. Referer is the fallback for the rare client that omits Origin.
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.length > 0) {
    if (originMatches(origin, allowed)) return next();
    return res.status(403).json({ message: "Cross-site request blocked" });
  }

  const referer = req.headers.referer;
  if (typeof referer === "string" && referer.length > 0) {
    if (originMatches(referer, allowed)) return next();
    return res.status(403).json({ message: "Cross-site request blocked" });
  }

  // A cookie-bearing write with neither header is not something our own site
  // produces, so refuse rather than guess.
  return res.status(403).json({ message: "Missing origin on authenticated request" });
}
