import { Schema, model, Document } from "mongoose";
import { quizType } from './quiz.model';
// models/wrongAnswer.model.ts

export interface IWrongAnswer extends Document {
  userId: string;
  quizId: number;
  code: string;        // ✅ added
  type: string;        // ✅ added
  topic_name: string;  // ✅ added
}

const WrongAnswerSchema = new Schema<IWrongAnswer>(
  {
    userId: {
      type: String,
      required: true,
      ref: "User",
    },
    quizId: {
      type: Number,
      required: true,
      ref: "Quiz",
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(quizType),
      required: true,
    },
    topic_name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

WrongAnswerSchema.index({ userId: 1, quizId: 1 }, { unique: true });

export const WrongAnswerModel = model<IWrongAnswer>("WrongAnswer", WrongAnswerSchema);