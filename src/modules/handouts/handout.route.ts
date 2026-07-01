import { Router } from "express";
import {
  createHandoutsController,
  getSingleHandout,
  listHandoutsController,
} from "./handout.controller";
import { authGuard } from '../../common/middlewares/auth.middleware';
import { requireApiKey } from "../../common/middlewares/apiKey";
import { validate } from "../../common/middlewares/validate";
import { createHandoutSchema } from "./handout.schema";

export const handoutRouter = Router();

// List all { code, examType } pairs (for SSG static params)
handoutRouter.get("/", authGuard, listHandoutsController);

// Single handout by course code + exam type
handoutRouter.get("/:code/:examType", authGuard, getSingleHandout);

// Upsert a handout (admin / bulk md-import script) — gated by the x-api-key
// shared secret since it's an unauthenticated content-write endpoint.
handoutRouter.post("/", requireApiKey, validate(createHandoutSchema), createHandoutsController);
