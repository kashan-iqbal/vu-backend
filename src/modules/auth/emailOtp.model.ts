import mongoose, { Document, Schema } from "mongoose";

export interface IEmailOtp extends Document {
    email: string;
    otp: string;
    expiresAt: Date;
    verified: boolean;
    attempts: number;
}

const EmailOtpSchema = new Schema<IEmailOtp>(
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

// TTL index: Mongo auto-deletes the document once `expiresAt` passes. This both
// cleans up stale OTPs and frees the email to request a fresh code.
EmailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailOtpModel =
    mongoose.models.EmailOtp ||
    mongoose.model<IEmailOtp>("EmailOtp", EmailOtpSchema);
