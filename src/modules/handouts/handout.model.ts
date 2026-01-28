import mongoose, { Document, Schema } from "mongoose";

export interface IHandout extends Document {
    courseId: Schema.Types.ObjectId;
    content: string;
    expiresAt: Date;
    verified: boolean;
}

const HandoutSchema = new Schema<IHandout>(
    {
        courseId: {
            ref: "Subject",
            type: Schema.Types.ObjectId
        },

        content: {
            type: String,
            required: true,
        },


    },
    { timestamps: true }
);

export const HandoutModel =
    mongoose.models.Handout ||
    mongoose.model<IHandout>("Handout", HandoutSchema);





