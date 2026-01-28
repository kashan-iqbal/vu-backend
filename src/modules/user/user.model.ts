import mongoose, { Document, Schema } from "mongoose";

/**
 * User Roles
 * Extend later: admin, vendor, finance, etc
 */
export enum UserRole {
    USER = "user",
    ADMIN = "admin",
}

/**
 * User Interface (TypeScript)
 */
export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    isActive: boolean;
    phoneNo: Number;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * User Schema
 */
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
            required: true,
            minlength: 6,
            select: false,
        },

        role: {
            type: String,
            enum: Object.values(UserRole),
            default: UserRole.USER,
        },
        phoneNo: {
            type: Number,
            length: 11,


        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true, // adds createdAt & updatedAt
        versionKey: false,
    }
);

/**
 * Model Export
 */
export const UserModel =
    mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
