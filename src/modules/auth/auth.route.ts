import { Router } from "express";
import { sendOtp, verifyOtp, registerUser, loginUser, logoutUser, forgotPassword, verifyResetOtp, resetPassword } from "./auth.controller";

export const authRouter = Router();

authRouter.post("/send-otp", sendOtp);
authRouter.post("/verify-otp", verifyOtp);
authRouter.post("/register", registerUser);
authRouter.post("/login", loginUser);
authRouter.post("/logout", logoutUser);

authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/verify-reset-otp", verifyResetOtp);
authRouter.post("/reset-password", resetPassword);