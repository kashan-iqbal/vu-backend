import mongoose, { Schema, model, Document } from "mongoose";
import { quizType } from "../ai-quiz/quiz.model";
import type { CrashActivity } from "./crashPlan.compute";

// A generated crash study plan for one user + course exam. Persisted so the plan
// (and its pre-drawn MCQ sets) stay stable across visits — regenerating upserts the
// single row. Isolated collection; never touched by the existing quiz/handout flows.

export interface ICrashQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  topic_name: string;
}

export interface ICrashBlock {
  startTime: Date;
  endTime: Date;
  topic: string | null;
  activityType: CrashActivity;
  whyThisMatters: string;
  accuracy: number | null;
  handoutRef?: { url: string; anchor: string | null };
  questions?: ICrashQuestion[];
}

export interface ICrashPlan extends Document {
  userId: string;
  code: string;
  type: string;
  hoursAvailable: number;
  generatedAt: Date;
  blocks: ICrashBlock[];
  createdAt: Date;
  updatedAt: Date;
}

const CrashQuestionSchema = new Schema<ICrashQuestion>(
  {
    id: { type: Number, required: true },
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctAnswer: { type: Number, required: true },
    topic_name: { type: String, required: true },
  },
  { _id: false },
);

const CrashBlockSchema = new Schema<ICrashBlock>(
  {
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    topic: { type: String, default: null },
    activityType: {
      type: String,
      enum: ["study", "quiz", "rest", "mock"],
      required: true,
    },
    whyThisMatters: { type: String, required: true },
    accuracy: { type: Number, default: null },
    handoutRef: {
      type: { url: String, anchor: { type: String, default: null } },
      default: undefined,
    },
    questions: { type: [CrashQuestionSchema], default: undefined },
  },
  { _id: false },
);

const CrashPlanSchema = new Schema<ICrashPlan>(
  {
    userId: { type: String, required: true, ref: "User" },
    code: { type: String, required: true, uppercase: true, trim: true },
    type: { type: String, enum: Object.values(quizType), required: true },
    hoursAvailable: { type: Number, required: true, min: 1 },
    generatedAt: { type: Date, required: true },
    blocks: { type: [CrashBlockSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

// One active plan per (user, course, exam); also the upsert key.
CrashPlanSchema.index({ userId: 1, code: 1, type: 1 }, { unique: true });

export const CrashPlanModel =
  mongoose.models.CrashPlan ||
  model<ICrashPlan>("CrashPlan", CrashPlanSchema, "crashplans");
