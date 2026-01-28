import { Router } from "express";
import { getProfile, newsLetter } from "./user.controller";
import { authGuard } from "../../common/middlewares/auth.middleware";

export const userRouter = Router();

// userRouter.post("/register", registerUser);
userRouter.get("/me", authGuard, getProfile);

userRouter.post("/newsletter", newsLetter);
