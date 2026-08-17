import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { EmailOtpModel } from "./emailOtp.model";
import { UserModel, AuthProvider } from "../user/user.model";
import { sendTemplatedEmail, sendWelcomeEmail } from "../../common/utils/sendEmail";
import { PasswordResetOtpModel } from "./passwordResetOtp.model";
import { OAuth2Client } from 'google-auth-library/build/src/auth/oauth2client';

// Max wrong OTP guesses before the code is invalidated and must be re-requested.
const MAX_OTP_ATTEMPTS = 5;


export async function sendOtp(req: Request, res: Response) {
    try {
        const { email } = req.body;


        const existUser = await UserModel.findOne({ email })

        if (existUser) {
            return res.json({ message: "User already exists with that email", success: false });
        }

        const exitingOtp = await EmailOtpModel.findOne({ email })

        if (exitingOtp) {
            return res.json({ message: "OTP already to sent to " + email, success: false });

        }
        const otp = crypto.randomInt(100000, 999999).toString();

        await sendTemplatedEmail(
            email,
            "Your ExamPrep AI verification code",
            "otp",
            {
                heading: "Verify your email",
                intro:
                    "Welcome to ExamPrep AI! Use the verification code below to confirm your email address and finish setting up your account.",
                otp,
                expiresMinutes: 5,
            },
            `Your ExamPrep AI verification code is ${otp}. It expires in 5 minutes.`,
        );

        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        const hashedOtp = await bcrypt.hash(otp, 10);

        await EmailOtpModel.findOneAndUpdate(
            { email },
            { otp: hashedOtp, expiresAt, verified: false, attempts: 0 },
            { upsert: true }
        );

        res.json({ message: "OTP sent to email", success: true });
    } catch (error: any) {
        res.send({ message: error.message, success: false });
    }
}

/**
 * VERIFY OTP
 */
export async function verifyOtp(req: Request, res: Response) {
    const { email, otp } = req.body;

    // Look up by email only (never put the user-supplied otp in the query) and
    // compare the hash, so the code can't be probed via NoSQL operators.
    const record = await EmailOtpModel.findOne({ email });

    if (!record || record.expiresAt < new Date()) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    if (record.attempts >= MAX_OTP_ATTEMPTS) {
        await EmailOtpModel.deleteOne({ _id: record._id });
        return res
            .status(429)
            .json({ message: "Too many incorrect attempts. Please request a new code." });
    }

    const isMatch = await bcrypt.compare(otp, record.otp);
    if (!isMatch) {
        record.attempts += 1;
        await record.save();
        return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    record.verified = true;
    await record.save();

    res.json({ message: "OTP verified" });
}


export async function registerUser(req: Request, res: Response) {
    const { name, email, password, phoneNo } = req.body;

    const otpRecord = await EmailOtpModel.findOne({ email, verified: true });
    if (!otpRecord) {
        return res.status(403).json({ message: "Email not verified" });
    }

    const existing = await UserModel.findOne({ email });
    if (existing) {
        return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await UserModel.create({
        name,
        email,
        password: hashedPassword,
        phoneNo
    });

    await EmailOtpModel.deleteOne({ email });

    // Welcome email — fire-and-forget so a mail hiccup never fails registration.
    sendWelcomeEmail(email, name).catch((err) =>
        console.error("Welcome email failed:", err),
    );

    res.status(201).json({ message: "User registered successfully", success: true });
}


export async function loginUser(req: Request, res: Response) {
    try {
        const { email, password } = req.body;


        const user = await UserModel.findOne({ email }).select("+password");
        if (!user) throw new Error("Invalid credentials");

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) throw new Error("Invalid credentials");

        const jwtSecret = process.env.JWT_SECRET as string;
        if (!jwtSecret) throw new Error("JWT_SECRET is not defined");

        const token = jwt.sign(
            { userId: user._id, role: user.role },
            jwtSecret,
            { expiresIn: process.env.JWT_EXPIRES_IN || "7d" } as jwt.SignOptions
        )


        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });


        res.json({
            message: "Login successful",
            success: true
        });
    } catch (err: any) {
        res.status(401).json({ message: err.message });
    }
}


export const logoutUser = (req: Request, res: Response) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    res.status(200).json({
        success: true,
        message: "Logged out successfully",
    });
};



export async function forgotPassword(req: Request, res: Response) {
    const { email } = req.body;

    const user = await UserModel.findOne({ email });
    if (!user) {
        return res.status(404).json({
            success: false,
            message: "User with this email does not exist",
        });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const hashedOtp = await bcrypt.hash(otp, 10);

    await PasswordResetOtpModel.findOneAndUpdate(
        { email },
        { otp: hashedOtp, expiresAt, verified: false, attempts: 0 },
        { upsert: true }
    );

    await sendTemplatedEmail(
        email,
        "Your ExamPrep AI password reset code",
        "otp",
        {
            heading: "Reset your password",
            intro:
                "We received a request to reset your ExamPrep AI password. Use the code below to continue.",
            otp,
            expiresMinutes: 5,
        },
        `Your ExamPrep AI password reset code is ${otp}. It expires in 5 minutes.`,
    );

    res.json({
        success: true,
        message: "Reset OTP sent to your email",
    });
}


export async function verifyResetOtp(req: Request, res: Response) {
    const { email, otp } = req.body;

    const record = await PasswordResetOtpModel.findOne({ email });

    if (!record || record.expiresAt < new Date()) {
        return res.status(400).json({
            success: false,
            message: "Invalid or expired OTP",
        });
    }

    if (record.attempts >= MAX_OTP_ATTEMPTS) {
        await PasswordResetOtpModel.deleteOne({ _id: record._id });
        return res.status(429).json({
            success: false,
            message: "Too many incorrect attempts. Please request a new code.",
        });
    }

    const isMatch = await bcrypt.compare(otp, record.otp);
    if (!isMatch) {
        record.attempts += 1;
        await record.save();
        return res.status(400).json({
            success: false,
            message: "Invalid or expired OTP",
        });
    }

    record.verified = true;
    await record.save();

    res.json({
        success: true,
        message: "OTP verified successfully",
    });
}

/**
 * 3️⃣ RESET PASSWORD
 */
export async function resetPassword(req: Request, res: Response) {
    const { email, otp, newPassword } = req.body;

    const record = await PasswordResetOtpModel.findOne({
        email,
        verified: true,
    });

    if (!record || record.expiresAt < new Date()) {
        return res.status(400).json({
            success: false,
            message: "OTP verification required",
        });
    }

    const isMatch = await bcrypt.compare(otp, record.otp);
    if (!isMatch) {
        return res.status(400).json({
            success: false,
            message: "OTP verification required",
        });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await UserModel.updateOne(
        { email },
        { password: hashedPassword }
    );

    await PasswordResetOtpModel.deleteOne({ email });

    res.json({
        success: true,
        message: "Password reset successfully",
    });
}




const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


export const googleAuthController = async (req: Request, res: Response) => {

    try {
        const { credential } = req.body;
        if (!credential) {
            return res.status(400).json({ message: "Google credential is required" });
        }

        // Verify the Google token
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            return res.status(400).json({ message: "Invalid Google token" });
        }

        const { sub: googleId, email, name, picture } = payload;

        // Check if user exists by googleId OR email
        let user = await UserModel.findOne({
            $or: [{ googleId }, { email }],
        });

        if (user) {
            // Existing user — link Google if they signed up via email before
            if (!user.googleId) {
                user.googleId = googleId;
                user.provider = AuthProvider.GOOGLE;
                if (picture) user.avatar = picture;
                await user.save();
            }
        } else {
            // Brand new user
            user = await UserModel.create({
                name: name || "Google User",
                email,
                googleId,
                avatar: picture,
                provider: AuthProvider.GOOGLE,
                // no password — that's fine now
            });

            // Welcome email — fire-and-forget so mail never blocks Google sign-up.
            sendWelcomeEmail(user.email, user.name).catch((err) =>
                console.error("Welcome email failed:", err),
            );
        }

        // Issue your normal JWT
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET!,
            { expiresIn: "7d" }
        );


        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });


        res.json({
            message: "Login successful",
            success: true
        });
    } catch (error) {
        console.error("Google auth error:", error);
        res.status(500).json({ message: "Google authentication failed" });
    }



}