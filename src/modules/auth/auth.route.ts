import { Router } from "express";
import { sendOtp, verifyOtp, registerUser, loginUser, logoutUser, forgotPassword, verifyResetOtp, resetPassword, googleAuthController } from "./auth.controller";
import { validate } from "../../common/middlewares/validate";
import { authLimiter, otpLimiter } from "../../common/middlewares/rateLimit";
import {
    sendOtpSchema,
    verifyOtpSchema,
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    verifyResetOtpSchema,
    resetPasswordSchema,
    googleAuthSchema,
} from "./auth.schema";

export const authRouter = Router();

authRouter.post("/send-otp", otpLimiter, validate(sendOtpSchema), sendOtp);
authRouter.post("/verify-otp", authLimiter, validate(verifyOtpSchema), verifyOtp);
authRouter.post("/register", authLimiter, validate(registerSchema), registerUser);
authRouter.post("/login", authLimiter, validate(loginSchema), loginUser);
authRouter.post("/logout", logoutUser);

authRouter.post("/forgot-password", otpLimiter, validate(forgotPasswordSchema), forgotPassword);
authRouter.post("/verify-reset-otp", authLimiter, validate(verifyResetOtpSchema), verifyResetOtp);
authRouter.post("/reset-password", authLimiter, validate(resetPasswordSchema), resetPassword);

authRouter.post("/google", authLimiter, validate(googleAuthSchema), googleAuthController);
