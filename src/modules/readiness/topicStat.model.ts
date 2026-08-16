import mongoose, { Schema, model, Document } from "mongoose";
import { quizType } from "../ai-quiz/quiz.model";

// Per-user, per-course-exam, per-topic running tally of quiz answers. This is the
// accuracy history the readiness engine needs — the app didn't persist attempts
// or corrects before, only a "currently wrong" set. Written additively on quiz
// submit; never read/altered by the existing quiz flow.
export interface ITopicStat extends Document {
  userId: string;
  code: string;
  type: string;
  topic_name: string;
  attempts: number;
  correct: number;
  createdAt: Date;
  updatedAt: Date;
}

const TopicStatSchema = new Schema<ITopicStat>(
  {
    userId: { type: String, required: true, ref: "User" },
    code: { type: String, required: true, uppercase: true, trim: true },
    type: { type: String, enum: Object.values(quizType), required: true },
    topic_name: { type: String, required: true, trim: true },
    attempts: { type: Number, required: true, default: 0, min: 0 },
    correct: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

// One tally row per (user, course, exam, topic); also the upsert key.
TopicStatSchema.index(
  { userId: 1, code: 1, type: 1, topic_name: 1 },
  { unique: true },
);

export const TopicStatModel =
  mongoose.models.TopicStat ||
  model<ITopicStat>("TopicStat", TopicStatSchema, "topicstats");
