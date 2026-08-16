import mongoose, { Schema, model, Document } from "mongoose";

// The shared, user-agnostic answer cache. Keyed by the sha256 of the normalized
// prompt so the same GDB asked by 500 students is generated ONCE and served free
// to the rest. Stores the structured draft, not a finished submission.
export interface IGdbDraft {
  stance: string;
  supportingPoints: string[];
  counterpoint: string;
  conclusion: string;
  registerNote: string;
}

export interface IGdbCache extends Document {
  hash: string;
  normalizedPrompt: string;
  draft: IGdbDraft;
  modelName: string;
  hits: number;
  createdAt: Date;
  updatedAt: Date;
}

const DraftSchema = new Schema<IGdbDraft>(
  {
    stance: { type: String, default: "" },
    supportingPoints: { type: [String], default: [] },
    counterpoint: { type: String, default: "" },
    conclusion: { type: String, default: "" },
    registerNote: { type: String, default: "" },
  },
  { _id: false },
);

const GdbCacheSchema = new Schema<IGdbCache>(
  {
    hash: { type: String, required: true, unique: true },
    normalizedPrompt: { type: String, required: true },
    draft: { type: DraftSchema, required: true },
    modelName: { type: String, required: true },
    hits: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

export const GdbCacheModel =
  mongoose.models.GdbCache ||
  model<IGdbCache>("GdbCache", GdbCacheSchema, "gdbcaches");
