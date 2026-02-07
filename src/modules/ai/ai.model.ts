// ============================================
// AI Chat Session Model (Refactored)
// ============================================

import { Schema, model, Types, Document } from "mongoose";

// ============================================
// Types
// ============================================

export type ChatStage =
  | "UPLOAD"
  | "SUMMARY"
  | "CHAT"
  | "QUIZ"
  | "WEAK_TOPICS";

export interface IWeakTopic {
  topic: string;
  score: number;
  wrongCount: number;
  lastSeenAt: Date;
}

export interface IAiChatSession extends Document {
  userId: Types.ObjectId;
  sourceId: string;
  stage: ChatStage;
  attempts: number;
  lastScore: number;
  weakTopics: IWeakTopic[];
  createdAt: Date;
  updatedAt: Date;
  examType: "MIDTERM" | "FINAL_TERM" | null;
  code: string;
}

// ============================================
// Schemas
// ============================================

const WeakTopicSchema = new Schema<IWeakTopic>(
  {
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    wrongCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const AiChatSessionSchema = new Schema<IAiChatSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
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
      min: 0,
    },

    lastScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    code: {
      trype: String,
    },
    weakTopics: {
      type: [WeakTopicSchema],
      default: [],
    },
    examType: {
      type: String,
      enum: ["MIDTERM", "FINAL_TERM"],
      default: null,
    },

  },
  {
    timestamps: true, // Adds createdAt & updatedAt
  }
);

// ============================================
// Indexes
// ============================================

// Compound index for unique sessions
AiChatSessionSchema.index(
  { userId: 1, },
  { unique: true }
);

// Index for querying by stage
AiChatSessionSchema.index({ stage: 1 });

// Index for finding recent sessions
AiChatSessionSchema.index({ updatedAt: -1 });

// ============================================
// Methods
// ============================================

AiChatSessionSchema.methods.updateWeakTopic = function (
  topic: string,
  isCorrect: boolean
) {
  const existingTopic = this.weakTopics.find((t: IWeakTopic) => t.topic === topic);

  if (existingTopic) {
    if (!isCorrect) {
      existingTopic.wrongCount += 1;
      existingTopic.score = Math.max(
        0,
        existingTopic.score - 10
      );
    } else {
      existingTopic.score = Math.min(
        100,
        existingTopic.score + 5
      );
    }
    existingTopic.lastSeenAt = new Date();
  } else if (!isCorrect) {
    this.weakTopics.push({
      topic,
      score: 0,
      wrongCount: 1,
      lastSeenAt: new Date(),
    });
  }

  return this.save();
};

AiChatSessionSchema.methods.getWeakestTopics = function (limit = 5) {
  return this.weakTopics
    .sort((a: IWeakTopic, b: IWeakTopic) => a.score - b.score)
    .slice(0, limit);
};

// ============================================
// Statics
// ============================================

AiChatSessionSchema.statics.findOrCreateSession = async function (
  userId: Types.ObjectId,
  courseId: Types.ObjectId,
  sourceId: string
) {
  let session = await this.findOne({ userId, courseId, sourceId });

  if (!session) {
    session = await this.create({
      userId,
      sourceId,
      stage: "UPLOAD",
    });
  }

  return session;
};

AiChatSessionSchema.statics.getUserSessions = async function (
  userId: Types.ObjectId,
  limit = 10
) {
  return this.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(limit);
};

// ============================================
// Model Export
// ============================================

export const AiChatSession = model<IAiChatSession>(
  "AiChatSession",
  AiChatSessionSchema
);