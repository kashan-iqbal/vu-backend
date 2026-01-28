import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * Result Interface
 */
export interface IResult extends Document {
  userId: Types.ObjectId;
  submitResultId: Types.ObjectId;
  totalMcqs: number;
  correctMcqs: number;
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result Schema
 */
const ResultSchema = new Schema<IResult>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    submitResultId: {
      type: Schema.Types.ObjectId,
      ref: "SubmitResult",
      required: true,
      unique: true, // one result per submission
    },

    totalMcqs: {
      type: Number,
      required: true,
    },

    correctMcqs: {
      type: Number,
      required: true,
    },

    score: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const ResultModel =
  mongoose.models.Result ||
  mongoose.model<IResult>("Result", ResultSchema);
