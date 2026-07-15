import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getR2Bucket } from "../../config/r2";
import { ContributionModel } from "./contribution.model";

// Course codes that already have a PDF — drives the "already uploaded" state on
// the contribute grid.
export async function getUploadedCodes(): Promise<string[]> {
  return ContributionModel.find().distinct("code");
}

export async function codeIsTaken(code: string): Promise<boolean> {
  return Boolean(await ContributionModel.exists({ code }));
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
