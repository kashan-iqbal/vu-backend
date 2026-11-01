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
  // PER USER when we can identify one, per IP otherwise.
  //
  // Keying this purely on IP meant carrier-grade NAT lumped whole networks into
  // one bucket: most students reach the API over Pakistani mobile data, where
  // thousands of devices share a few egress IPs, so they were all drawing down a
  // single 150-request budget. A quiz spends ~20 requests, so about seven
  // concurrent quiz-takers on the same carrier exhausted it and everyone after
  // them got a 429. That hits the web app too, not just mobile — it was simply
  // masked because most web traffic is anonymous reads of the handout and
  // pastquiz GETs, which are skipped below.
  //
  // `authUserId` comes from identifyUser, mounted app-wide BEFORE this limiter.
  // It cannot come from `req.user`: authGuard runs per route, i.e. after this
  // middleware, so `req.user` is always undefined here. (gdbLimiter can use
  // req.user because it sits after authGuard on its own route.)
  keyGenerator: (req) => req.authUserId ?? ipKeyGenerator(req.ip ?? ""),
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
