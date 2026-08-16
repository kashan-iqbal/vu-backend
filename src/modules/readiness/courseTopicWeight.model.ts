import mongoose, { Schema, model, Document } from "mongoose";
import { quizType } from "../ai-quiz/quiz.model";

// Exam-weight of each topic for a course exam. Since past papers carry no topic
// labels, weight is seeded from how often a topic appears in the AI quiz bank
// (scripts/seedTopicWeights.ts). Read-only at request time.
export interface ICourseTopicWeight extends Document {
  code: string;
  type: string;
  topic_name: string;
  weight: number;
  createdAt: Date;
  updatedAt: Date;
}

const CourseTopicWeightSchema = new Schema<ICourseTopicWeight>(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    type: { type: String, enum: Object.values(quizType), required: true },
    topic_name: { type: String, required: true, trim: true },
    weight: { type: Number, required: true, default: 1, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

CourseTopicWeightSchema.index(
  { code: 1, type: 1, topic_name: 1 },
  { unique: true },
);

export const CourseTopicWeightModel =
  mongoose.models.CourseTopicWeight ||
  model<ICourseTopicWeight>(
    "CourseTopicWeight",
    CourseTopicWeightSchema,
    "coursetopicweights",
  );
