import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getR2Bucket } from "../../config/r2";
import { ContributionModel, ContributionStatus } from "./contribution.model";

// Course codes that already have a PDF — drives the "already uploaded" state on
// the contribute grid. Rejected uploads don't count: the code is free again.
export async function getUploadedCodes(): Promise<string[]> {
  return ContributionModel.find({
    status: { $ne: ContributionStatus.REJECTED },
  }).distinct("code");
}

export async function codeIsTaken(code: string): Promise<boolean> {
  return Boolean(
    await ContributionModel.exists({ code, status: { $ne: ContributionStatus.REJECTED } }),
  );
}

export function buildObjectKey(code: string, uniqueId: string): string {
  return `course-pdfs/${code}/${uniqueId}.pdf`;
}

export async function putObjectToR2(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

// Best-effort cleanup: used when the DB insert loses a race after the object is
// already stored. Never throws — an orphaned object is preferable to a 500.
export async function deleteObjectFromR2(key: string): Promise<void> {
  try {
    await getR2Client().send(
      new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key }),
    );
  } catch {
    // swallow — the caller is already handling a failure path
  }
}

export async function createContribution(doc: {
  code: string;
  uploaderName: string;
  uploaderPhone: string;
  uniqueId: string;
  r2Key: string;
  originalName: string;
  size: number;
  contentType: string;
  note?: string;
}) {
  return ContributionModel.create(doc);
}

// Admin review: keep the file, just mark it reviewed.
export async function approveContribution(id: string) {
  return ContributionModel.findByIdAndUpdate(
    id,
    { status: ContributionStatus.APPROVED },
    { new: true },
  ).lean();
}

// Admin review: delete the R2 object to free the storage, but keep the DB
// row (status flips to "rejected") so the contributor's reject count still
// shows up — and so the partial unique index frees the course code for a
// new upload.
export async function rejectContribution(id: string) {
  const doc = await ContributionModel.findById(id);
  if (!doc) return null;

  if (doc.status !== ContributionStatus.REJECTED) {
    await deleteObjectFromR2(doc.r2Key);
  }
  doc.status = ContributionStatus.REJECTED;
  await doc.save();
  return doc.toObject();
}
