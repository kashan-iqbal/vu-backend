import mongoose, { Document, Schema } from "mongoose";

export enum ContributionStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export interface IContribution extends Document {
  code: string;
  /**
   * Mirrors `code` while the upload occupies the one-per-course slot, unset
   * once rejected. MongoDB partial indexes only support $eq/$exists/$gt../$type
   * (no $ne), so "unique among non-rejected docs" can't be expressed as a
   * partial filter on `status` directly — a sparse unique index on this mirror
   * field gets the same effect instead. Kept in sync by the pre-save hook
   * below; never set it directly.
   */
  codeSlot?: string;
  status: ContributionStatus;
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
    // One PDF per course, globally: the first non-rejected upload claims the
    // code. Uniqueness is enforced by the sparse unique index on `codeSlot`
    // below, not on this field, so a rejected upload can free the code back
    // up for someone else to try again.
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    codeSlot: {
      type: String,
      uppercase: true,
      trim: true,
    },
    // Admin moderation state. Every upload starts pending; an admin then
    // approves it (keeps the file) or rejects it (deletes the R2 object but
    // keeps this record so contributor stats still count the rejection).
    status: {
      type: String,
      enum: Object.values(ContributionStatus),
      default: ContributionStatus.PENDING,
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

// Keeps codeSlot in sync with code/status on every save, so callers never set
// it directly and it can't drift out of sync.
ContributionSchema.pre("save", function () {
  this.codeSlot = this.status === ContributionStatus.REJECTED ? undefined : this.code;
});

// Powers the admin dashboard's uploads-per-day trend query.
ContributionSchema.index({ createdAt: 1 });

// Replaces the old plain-unique index on `code`: a rejected upload clears
// codeSlot (see the pre-save hook above), so this index no longer blocks a
// fresh upload for the same course. Requires a one-time migration on existing
// deployments — see scripts/migrateContributionStatus.ts.
ContributionSchema.index({ codeSlot: 1 }, { unique: true, sparse: true });

// Powers the Contributors tab, grouping a contributor's uploads by phone.
ContributionSchema.index({ uploaderPhone: 1 });

export const ContributionModel =
  mongoose.models.Contribution ||
  mongoose.model<IContribution>(
    "Contribution",
    ContributionSchema,
    "contributions",
  );
