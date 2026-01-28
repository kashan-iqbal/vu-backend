import mongoose, { Document, Schema } from "mongoose";

/**
 * User Interface (TypeScript)
 */
export interface INewsLetter extends Document {
    email: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * User Schema
 */
const NewsLetterSchema= new Schema<INewsLetter>(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        }
    },
    {
        timestamps: true, 
        versionKey: false,
    }
);

/**
 * Model Export
 */
export const NewsLetterModel =
    mongoose.models.NewsLetterModel || mongoose.model<INewsLetter>("NewsLetter", NewsLetterSchema);
