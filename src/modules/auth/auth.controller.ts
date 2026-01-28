import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { EmailOtpModel } from "./emailOtp.model";
import { UserModel } from "../user/user.model";
import { sendEmail } from "../../common/utils/sendEmail";
import { PasswordResetOtpModel } from "./passwordResetOtp.model";


export async function sendOtp(req: Request, res: Response) {
    try {
        const { email } = req.body;

        const existUser = await UserModel.findOne({ email })

        if (existUser) {
            return res.json({ message: "Uesr already exit with that email " });
        }
        const otp = crypto.randomInt(100000, 999999).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await EmailOtpModel.findOneAndUpdate(
            { email },
            { otp, expiresAt, verified: false },
            { upsert: true }
        );

        await sendEmail(email, "Email Verification OTP", `Your OTP is: ${otp}`);

        res.json({ message: "OTP sent to email" });
    } catch (error) {
        console.log(error)
        res.send({ message: error.message })
    }
}

/**
 * VERIFY OTP
 */
export async function verifyOtp(req: Request, res: Response) {
    const { email, otp } = req.body;

    const record = await EmailOtpModel.findOne({ email, otp });

    if (!record || record.expiresAt < new Date()) {
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
            secure: true,
            sameSite: "none",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });


        res.json({
            message: "Login successful",
            succes: true
        });
    } catch (err: any) {
        res.status(401).json({ message: err.message });
    }
}


export const logoutUser = (req: Request, res: Response) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
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

    await PasswordResetOtpModel.findOneAndUpdate(
        { email },
        { otp, expiresAt, verified: false },
        { upsert: true }
    );

    await sendEmail(
        email,
        "Password Reset OTP",
        `Your password reset OTP is: ${otp}`
    );

    res.json({
        success: true,
        message: "Reset OTP sent to your email",
    });
}


export async function verifyResetOtp(req: Request, res: Response) {
    const { email, otp } = req.body;

    const record = await PasswordResetOtpModel.findOne({ email, otp });

    if (!record || record.expiresAt < new Date()) {
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
        otp,
        verified: true,
    });

    if (!record || record.expiresAt < new Date()) {
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