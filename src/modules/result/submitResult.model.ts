import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * Single MCQ submission
 */
export interface ISubmittedMcq {
  mcqsId: Types.ObjectId;
  selectedOption: string;
}

/**
 * Submit Result Interface
 */
export interface ISubmitResult extends Document {
  userId: Types.ObjectId;
  mcqs: ISubmittedMcq[];
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Submit Result Schema
 */
const SubmitResultSchema = new Schema<ISubmitResult>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    mcqs: [
      {
        mcqsId: {
          type: Schema.Types.ObjectId,
          ref: "Mcqs",
          required: true,
        },
        selectedOption: {
          type: String,
          required: true,
        },
      },
    ],

    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const SubmitResultModel =
  mongoose.models.SubmitResult ||
  mongoose.model<ISubmitResult>("SubmitResult", SubmitResultSchema);
