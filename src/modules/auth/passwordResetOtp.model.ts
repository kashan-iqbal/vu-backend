import mongoose, { Schema, Document } from "mongoose";

export interface IPasswordResetOtp extends Document {
    email: string;
    otp: string;
    expiresAt: Date;
    verified: boolean;
}

const PasswordResetOtpSchema = new Schema<IPasswordResetOtp>(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
            index: true,
        },
        otp: {
            type: String,
            required: true,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        verified: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

export const PasswordResetOtpModel =
    mongoose.models.PasswordResetOtp ||
    mongoose.model<IPasswordResetOtp>(
        "PasswordResetOtp",
        PasswordResetOtpSchema
    );
