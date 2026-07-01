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

// App-wide backstop for everything else. Health checks are exempt so uptime
// monitors / load balancers don't get throttled.
export const globalLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
  skip: (req) => req.path === "/api/v1/health",

});
