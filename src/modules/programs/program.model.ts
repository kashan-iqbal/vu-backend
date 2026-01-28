import mongoose, { Document, Schema, Types } from "mongoose";

export interface IProgram extends Document {
  name: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProgramSchema = new Schema<IProgram>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,

    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

ProgramSchema.index(
  { name: 1, code: 1 },
  { unique: true }
);


export const ProgramModel =
  mongoose.models.Programs || mongoose.model<IProgram>("Programs", ProgramSchema);
