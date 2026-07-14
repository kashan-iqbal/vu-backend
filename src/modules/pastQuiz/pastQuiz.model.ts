import mongoose, { Document, Schema } from "mongoose";

export enum PastQuizType {
  MIDTERM = "midterm",
  FINALTERM = "finalterm",
}

export interface IPastQuiz extends Document {
  id: number;
  question: string;
  type: PastQuizType;
  code: string;
  options: string[];
  correctAnswer: number;
  generated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PastQuizSchema = new Schema<IPastQuiz>(
  {
    // Source id from the scraped JSON. NOT globally unique: ids are
    // position-based timestamps reused across files, so uniqueness is only
    // guaranteed per (code, type). Enforced by the compound index below.
    // Mongo's own _id remains the true primary key.
    id: {
      type: Number,
      required: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(PastQuizType),
      required: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    options: {
      type: [String],
      required: true,
      validate: {
        // 2 options (True/False) up to 4 options are allowed.
        validator: (v: string[]) => v.length >= 2 && v.length <= 4,
        message: "Between 2 and 4 options are required",
      },
    },
    correctAnswer: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    generated: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Natural key: (code, type, id) is unique across the whole dataset even though
// `id` alone is not. Used as the upsert filter so imports are idempotent.
PastQuizSchema.index({ code: 1, type: 1, id: 1 }, { unique: true });

export const PastQuizModel =
  mongoose.models.PastQuiz || mongoose.model<IPastQuiz>("PastQuiz", PastQuizSchema, "pastquiz");