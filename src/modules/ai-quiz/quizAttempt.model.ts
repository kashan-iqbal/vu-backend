import mongoose, { Schema, model, Document } from "mongoose";
import { quizType } from "./quiz.model";

// Server-side record of one quiz sitting. This exists because the browser is no
// longer trusted with `correctAnswer`: the attempt holds the shuffled option order
// per question, so the server alone can map a student's tap back onto the stored
// answer and grade it. It is also the per-question answer history the app never
// had (topicstats only keeps per-topic totals).
//
// No TTL index deliberately — submitted attempts are the raw material for any
// future per-item scheduling work. If the collection ever needs trimming, expire
// on `status: "active"` only, never on submitted ones.

export interface IAttemptQuestion {
  quizId: number; // quiz.id (the custom numeric id, not _id)
  topic_name: string;
  /** order[displayIndex] = originalIndex. See quiz.shuffle.ts. */
  order: number[];
  /** ORIGINAL option index the student chose; null until answered. */
  selected: number | null;
  /** Graded server-side against quiz.correctAnswer; null until answered. */
  correct: boolean | null;
  answeredAt: Date | null;
}

export interface IQuizAttempt extends Document {
  userId: string;
  code: string;
  type: string;
  questions: IAttemptQuestion[];
  status: "active" | "submitted";
  startedAt: Date;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AttemptQuestionSchema = new Schema<IAttemptQuestion>(
  {
    quizId: { type: Number, required: true },
    topic_name: { type: String, required: true, trim: true },
    order: { type: [Number], required: true },
    selected: { type: Number, default: null },
    correct: { type: Boolean, default: null },
    answeredAt: { type: Date, default: null },
  },
  { _id: false },
);

const QuizAttemptSchema = new Schema<IQuizAttempt>(
  {
    userId: { type: String, required: true, ref: "User" },
    code: { type: String, required: true, uppercase: true, trim: true },
    type: { type: String, enum: Object.values(quizType), required: true },
    questions: { type: [AttemptQuestionSchema], required: true },
    status: {
      type: String,
      enum: ["active", "submitted"],
      default: "active",
      required: true,
    },
    startedAt: { type: Date, default: Date.now, required: true },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

// Every read is "this user's attempt by id", and the grade/submit paths filter on
// status. Scoped by userId so one student can never grade against another's attempt.
QuizAttemptSchema.index({ userId: 1, status: 1, updatedAt: -1 });
QuizAttemptSchema.index({ userId: 1, code: 1, type: 1, submittedAt: -1 });

export const QuizAttemptModel =
  mongoose.models.QuizAttempt ||
  model<IQuizAttempt>("QuizAttempt", QuizAttemptSchema, "quizattempts");
