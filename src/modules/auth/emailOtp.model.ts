import mongoose, { Document, Schema } from "mongoose";

export interface IEmailOtp extends Document {
    email: string;
    otp: string;
    expiresAt: Date;
    verified: boolean;
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
    },
    { timestamps: true }
);

export const EmailOtpModel =
    mongoose.models.EmailOtp ||
    mongoose.model<IEmailOtp>("EmailOtp", EmailOtpSchema);
