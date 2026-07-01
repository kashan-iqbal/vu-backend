import { z } from "zod";

// Shared field rules. Emails are lowercased here so the value used in Mongoose
// `findOne({ email })` filters matches the lowercased value stored on the model.
const email = z.string().trim().toLowerCase().email("Invalid email address");
const otp = z.string().trim().regex(/^\d{6}$/, "OTP must be 6 digits");

export const sendOtpSchema = z.object({ email });

export const verifyOtpSchema = z.object({ email, otp });

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email,
  password: z.string().min(6, "Password must be at least 6 characters"),
  phoneNo: z.string().trim().min(7, "Invalid phone number").max(20),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({ email });

export const verifyResetOtpSchema = z.object({ email, otp });

export const resetPasswordSchema = z.object({
  email,
  otp,
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export const googleAuthSchema = z.object({
  credential: z.string().min(1, "Google credential is required"),
});
