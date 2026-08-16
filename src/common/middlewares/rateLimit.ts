import { rateLimit, ipKeyGenerator } from "express-rate-limit";

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

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

// Live-AI GDB helper — a PER-USER daily cap (not per-IP) that backstops LLM spend
// even for paid users. Must run after authGuard so req.user is set; falls back to
// the IPv6-safe IP key for the (guarded-out) anonymous case.
export const gdbLimiter = rateLimit({
  windowMs: ONE_DAY,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId ?? ipKeyGenerator(req.ip ?? ""),
  message: {
    message: "Daily GDB help limit reached. Please try again tomorrow.",
  },
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
  //  - public, read-only handout/pastquiz GETs. The frontend's SSG build +
  //    sitemap fetch hundreds of these pages in a single burst from one build
  //    IP; at limit 150 the overflow was 429'd and those pages froze as
  //    noindex "not found" pages. These endpoints expose no user data and are
  //    safe to serve unthrottled. The corresponding write endpoints (POST
  //    /handout, POST /pastquiz) stay limited — they're not GETs.
  //  - the admin dashboard. Every route under /admin is already gated by
  //    authGuard + requireAdmin, a stronger control than this IP-based limiter
  //    is meant to backstop — and normal admin use (switching tabs, paginating,
  //    filtering several data tables) burns through 150 req/15min easily,
  //    which was hit firsthand while building this feature.
  skip: (req) =>
    req.path === "/api/v1/health" ||
    (req.method === "GET" &&
      (req.path.startsWith("/api/v1/handout") ||
        req.path.startsWith("/api/v1/pastquiz"))) ||
    req.path.startsWith("/api/v1/admin"),
});
