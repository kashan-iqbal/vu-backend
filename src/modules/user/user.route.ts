import { Router } from "express";
import { getProfile, newsLetter } from "./user.controller";
import { authGuard } from "../../common/middlewares/auth.middleware";
import { validate } from "../../common/middlewares/validate";
import { authLimiter } from "../../common/middlewares/rateLimit";
import { newsletterSchema } from "./user.schema";

export const userRouter = Router();

// userRouter.post("/register", registerUser);
userRouter.get("/me", authGuard, getProfile);

userRouter.post("/newsletter", authLimiter, validate(newsletterSchema), newsLetter);
