import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * MCQ Type Enum
 */
export enum McqsType {
  MIDTERM = "midterm",
  FINALTERM = "finalterm",
}

/**
 * MCQs Interface
 */
export interface IMcqs extends Document {
  subjectId: Types.ObjectId;
  question: string;
  options: string[];
  correctAnswer: string;
  reasonToCorrect?: string;
  type: McqsType;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * MCQs Schema
 */
const McqsSchema = new Schema<IMcqs>(
  {
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },


    options: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => v.length >= 2,
        message: "At least two options are required",
      },
    },

    correctAnswer: {
      type: String,
      required: true,
    },

    reasonToCorrect: {
      type: String,
      default: null,
    },

    type: {
      type: String,
      enum: Object.values(McqsType),
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/**
 * Model Export
 */
export const McqsModel =
  mongoose.models.Mcqs ||
  mongoose.model<IMcqs>("Mcqs", McqsSchema);
