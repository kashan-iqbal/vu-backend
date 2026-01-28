import { Schema, model, Types } from "mongoose";

export type ChatStage =
  | "UPLOAD"
  | "SUMMARY"
  | "CHAT"
  | "QUIZ"
  | "WEAK_TOPICS";

const WeakTopicSchema = new Schema(
  {
    topic: { type: String, required: true },
    score: { type: Number, default: 0 },
    wrongCount: { type: Number, default: 0 },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const AiChatSessionSchema = new Schema(
  {
    courseId: {
      type: Types.ObjectId,
      required: true,
      index: true,
    },

    userId: {
      type: Types.ObjectId,
      required: true,
      index: true,
    },

    sourceId: {
      type: String,
      required: true,
      index: true,
    },

    stage: {
      type: String,
      enum: ["UPLOAD", "SUMMARY", "CHAT", "QUIZ", "WEAK_TOPICS"],
      default: "SUMMARY",
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    lastScore: {
      type: Number,
      default: 0,
    },

    weakTopics: {
      type: [WeakTopicSchema],
      default: [],
    },
  },
  {
    timestamps: true, // createdAt & updatedAt
  }
);

// Prevent duplicate sessions for same user + course + source
AiChatSessionSchema.index(
  { userId: 1, courseId: 1, sourceId: 1 },
  { unique: true }
);

export const AiChatSession = model(
  "AiChatSession",
  AiChatSessionSchema
);
