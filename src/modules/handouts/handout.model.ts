import mongoose, { Document, Schema } from "mongoose";

/**
 * Exam type for a handout — mirrors the quiz `type` values.
 */
export enum ExamType {
  MIDTERM = "midterm",
  FINALTERM = "finalterm",
}

/**
 * A handout is the markdown summary for one course + exam type.
 */
export interface IHandout extends Document {
  code: string; // course code, e.g. "CS101"
  examType: ExamType; // "midterm" | "finalterm"
  content: string; // markdown content
  createdAt: Date;
  updatedAt: Date;
}

const HandoutSchema = new Schema<IHandout>(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    examType: {
      type: String,
      enum: Object.values(ExamType),
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  { timestamps: true, versionKey: false }
);

// One handout per course + exam type. This is also the primary lookup key,
// so the unique compound index keeps reads O(log n).
HandoutSchema.index({ code: 1, examType: 1 }, { unique: true });

export const HandoutModel =
  mongoose.models.Handout || mongoose.model<IHandout>("Handout", HandoutSchema);
