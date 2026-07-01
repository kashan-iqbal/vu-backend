import mongoose, { Document, Schema } from "mongoose";

/**
 * MCQ Type Enum
 */
export enum quizType {
  MIDTERM = "midterm",
  FINALTERM = "finalterm",
}

/**
 * MCQs Interface
 */
export interface Iquiz extends Document {
  id: number;                     // custom numeric ID (from script)
  question: string;
  type: quizType;
  code: string;                   // course code, e.g., "CS001"
  topic_name: string;
  options: string[];
  correctAnswer: number;          // 0, 1, 2, or 3
  explanation: string;            // explanation of correct answer
  createdAt: Date;
  updatedAt: Date;
}

/**
 * MCQs Schema
 */
const QuizSchema = new Schema<Iquiz>(
  {
    id: {
      type: Number,
      required: true,
      unique: true,               // ensure no duplicate custom IDs
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(quizType),
      required: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    topic_name: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => v.length === 4,
        message: "Exactly 4 options are required",
      },
    },
    correctAnswer: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    explanation: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);




export const QuizModel =
  mongoose.models.quiz || mongoose.model<Iquiz>("quiz", QuizSchema, "quiz");