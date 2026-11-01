import { Router } from "express";
import { deleteAccount, getProfile, newsLetter } from "./user.controller";
import { authGuard } from "../../common/middlewares/auth.middleware";
import { validate } from "../../common/middlewares/validate";
import { authLimiter } from "../../common/middlewares/rateLimit";
import { deleteAccountSchema, newsletterSchema } from "./user.schema";

export const userRouter = Router();

// userRouter.post("/register", registerUser);
userRouter.get("/me", authGuard, getProfile);

// Account deletion (Google Play requires an in-app path for any app with
// accounts). Re-auth proof lives in the body; see user.schema.ts.
userRouter.delete("/me", authGuard, validate(deleteAccountSchema), deleteAccount);

userRouter.post("/newsletter", authLimiter, validate(newsletterSchema), newsLetter);
