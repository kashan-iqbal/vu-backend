import mongoose, { Document, Schema } from "mongoose";

export interface IFeedback extends Document {
  rating: number;
  comment?: string;
  // Where in the app it was given (e.g. "quiz-results", "topic-review",
  // "floating") — lets us see which surface drives responses.
  context?: string;
  // Optional link to the thing being rated (e.g. a quiz code). Free-form.
  reference?: string;
  // The logged-in user who left it (these surfaces are all behind auth).
  user?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    context: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    reference: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const FeedbackModel =
  mongoose.models.Feedback ||
  mongoose.model<IFeedback>("Feedback", FeedbackSchema, "feedback");
