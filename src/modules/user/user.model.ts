import mongoose, { Document, Schema } from "mongoose";

export enum UserRole {
    USER = "user",
    ADMIN = "admin",
}

export enum AuthProvider {
    LOCAL = "local",
    GOOGLE = "google",
}

export interface IUser extends Document {
    _id: mongoose.Types.ObjectId;
    name: string;
    email: string;
    password?: string;
    role: UserRole;
    isActive: boolean;
    phoneNo?: number;
    googleId?: string;
    avatar?: string;
    provider: AuthProvider;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 100,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        password: {
            type: String,
            minlength: 6,
            select: false,
            // NOT required anymore — Google users won't have one
        },
        role: {
            type: String,
            enum: Object.values(UserRole),
            default: UserRole.USER,
        },
        phoneNo: {
            type: Number,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true, // allows multiple null values
        },
        avatar: {
            type: String,
        },
        provider: {
            type: String,
            enum: Object.values(AuthProvider),
            default: AuthProvider.LOCAL,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// Powers the admin dashboard's signups-per-day trend query.
UserSchema.index({ createdAt: 1 });

export const UserModel =
    mongoose.models.User || mongoose.model<IUser>("User", UserSchema);