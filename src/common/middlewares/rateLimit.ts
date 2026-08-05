import { rateLimit } from "express-rate-limit";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Email-sending endpoints (send-otp, forgot-password) — strictest, to stop
// inbox bombing of a victim's address.
export const otpLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

// Credential / OTP-checking endpoints (login, verify, reset, google, newsletter)
// — bounds password and OTP brute-force.
export const authLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." },
});

// PDF upload → email relay. Strict, since each call sends a (potentially large)
// attachment email.
export const uploadLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many uploads. Please try again later." },
});

// Feedback submissions — enough headroom for a genuine user (rate + a couple of
// follow-ups) while capping spam.
export const feedbackLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many submissions. Please try again later." },
});

// App-wide backstop for everything else. Health checks are exempt so uptime
// monitors / load balancers don't get throttled.
export const globalLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
  // Exempt:
  //  - the health check (uptime monitors / load balancers)
  //  - public, read-only handout GETs. The frontend's SSG build + sitemap fetch
  //    ~282 handout pages in a single burst from one build IP; at limit 150 the
  //    overflow was 429'd and those pages froze as noindex "not found" pages.
  //    These endpoints expose no user data and are safe to serve unthrottled.
  //    The POST /handout upsert (write) stays limited — it's not a GET.
  skip: (req) =>
    req.path === "/api/v1/health" ||
    (req.method === "GET" && req.path.startsWith("/api/v1/handout")),
});
