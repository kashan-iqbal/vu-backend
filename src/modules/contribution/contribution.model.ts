import mongoose, { Document, Schema } from "mongoose";

export interface IContribution extends Document {
  code: string;
  uploaderName: string;
  uploaderPhone: string;
  /** Legacy: set only by uploads made back when contributing required a login. */
  user?: mongoose.Types.ObjectId;
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
    // Who contributed it. Uploads are anonymous, so this is self-reported and
    // unverified — paired with `uniqueId` it's how an object in the bucket is
    // attributed to a person, but it proves nothing on its own.
    uploaderName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    uploaderPhone: {
      type: String,
      required: true,
      trim: true,
    },
    // Legacy: populated only by the pre-public uploads that required a login.
    // Kept (optional) so those existing records still read back intact.
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
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
