import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISubject extends Document {
  name: string;
  description?: string;
  subjectCode: string;
  mcqsIds: Types.ObjectId[];
  programId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  handoutLink:string | null;
  isVectoreExist : boolean;
}

const SubjectSchema = new Schema<ISubject>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,

    },

    description: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },

    subjectCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },
    programId: {
      type: Schema.Types.ObjectId,
      ref: "Mcqs",
      require: true
    },

    mcqsIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Mcqs",
      },
    ],
    handoutLink: {
      type: String,
      default: null,
    },

     isVectoreExist: {
    type: Boolean,
    default: null,}

  },
  {
    timestamps: true,
    versionKey: false,
  }
);

SubjectSchema.index(
  { name: 1, subjectCode: 1 },
  { unique: true }
);


export const SubjectModel =
  mongoose.models.Subject || mongoose.model<ISubject>("Subject", SubjectSchema);
