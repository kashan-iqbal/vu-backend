import { Router } from "express";
import { authGuard } from "../../common/middlewares/auth.middleware";
import { requireAdmin } from "../../common/middlewares/adminGuard";
import { validate } from "../../common/middlewares/validate";
import { gdbLimiter } from "../../common/middlewares/rateLimit";
import { gdbHelpSchema, gdbGrantSchema } from "./gdb.schema";
import {
  postGdbHelp,
  getGdbStatusController,
  grantGdbController,
} from "./gdb.controller";

export const gdbRouter = Router();

// Per-user daily cap (gdbLimiter) sits AFTER authGuard so it keys on req.user.userId.
gdbRouter.get("/status", authGuard, getGdbStatusController);
gdbRouter.post(
  "/help",
  authGuard,
  gdbLimiter,
  validate(gdbHelpSchema),
  postGdbHelp,
);

// Admin top-up (no payment system yet). Kept inside this module so the admin.*
// files stay untouched.
gdbRouter.post(
  "/grant",
  authGuard,
  requireAdmin,
  validate(gdbGrantSchema),
  grantGdbController,
);
