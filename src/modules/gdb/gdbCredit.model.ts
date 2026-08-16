import mongoose, { Schema, model, Document } from "mongoose";

// Per-user spend meter for the paid GDB helper. One row per user (userId stored as
// String + ref, matching topicStat/crashPlan). A student may draw down `credits`
// (charged only on a real LLM call) or hold an active semester pass (unlimited,
// never charged, within the daily cap). Free allotment is seeded on first use.
export interface IGdbCredit extends Document {
  userId: string;
  credits: number;
  passSemester?: string;
  passExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GdbCreditSchema = new Schema<IGdbCredit>(
  {
    userId: { type: String, required: true, ref: "User", unique: true },
    credits: { type: Number, required: true, default: 0, min: 0 },
    passSemester: { type: String },
    passExpiresAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

export const GdbCreditModel =
  mongoose.models.GdbCredit ||
  model<IGdbCredit>("GdbCredit", GdbCreditSchema, "gdbcredits");
