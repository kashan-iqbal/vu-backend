import mongoose, { Schema, Document } from "mongoose";

export interface IPasswordResetOtp extends Document {
    email: string;
    otp: string;
    expiresAt: Date;
    verified: boolean;
    attempts: number;
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

        // Wrong-guess counter — used to lock out OTP brute-force.
        attempts: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

// TTL index: Mongo auto-deletes the document once `expiresAt` passes.
PasswordResetOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetOtpModel =
    mongoose.models.PasswordResetOtp ||
    mongoose.model<IPasswordResetOtp>(
        "PasswordResetOtp",
        PasswordResetOtpSchema
    );
