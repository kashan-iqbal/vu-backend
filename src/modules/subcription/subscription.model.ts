import mongoose, { Document, Schema, Types } from "mongoose";
import { McqsType } from "../mcqs/mcqs.model";

/**
 * Subscription Interface
 */
export interface ISubscription extends Document {
  userId: Types.ObjectId;
  subjectId: Types.ObjectId;
  paidAt: Date;
  type: McqsType;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Subscription Schema
 */
const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },

    paidAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    type: {
      type: String,
      enum: Object.values(McqsType),
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 3,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/**
 * Ensure one subscription per user per MCQs
 */
SubscriptionSchema.index(
  { userId: 1, mcqsId: 1 },
  { unique: true }
);

/**
 * Model Export
 */
export const SubscriptionModel =
  mongoose.models.Subscription ||
  mongoose.model<ISubscription>("Subscription", SubscriptionSchema);
