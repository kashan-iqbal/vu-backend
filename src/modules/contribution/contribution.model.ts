import mongoose, { Document, Schema } from "mongoose";

export interface IContribution extends Document {
  code: string;
  user: mongoose.Types.ObjectId;
  uniqueId: string;
  r2Key: string;
  originalName: string;
  size: number;
  contentType: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContributionSchema = new Schema<IContribution>(
  {
    // One PDF per course, globally: the first upload claims the code. The unique
    // index (not the controller's pre-check) is what actually enforces this —
    // it makes concurrent uploads for the same code safe.
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      unique: true,
    },
    // Who contributed it. Paired with `uniqueId` this is how an object sitting
    // in the bucket is traced back to a real user.
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // uuid v4 embedded in the R2 object key, so the stored file name itself
    // resolves to exactly one record.
    uniqueId: {
      type: String,
      required: true,
      unique: true,
    },
    r2Key: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
    },
    contentType: {
      type: String,
      required: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const ContributionModel =
  mongoose.models.Contribution ||
  mongoose.model<IContribution>(
    "Contribution",
    ContributionSchema,
    "contributions",
  );
