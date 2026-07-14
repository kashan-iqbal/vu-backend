import multer from "multer";
import { Request, Response, NextFunction } from "express";

export const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB — email attachment route
export const MAX_CONTRIBUTION_PDF_BYTES = 50 * 1024 * 1024; // 50 MB — R2 route

function humanMb(bytes: number) {
  return Math.round(bytes / (1024 * 1024));
}

// In-memory PDF upload — the file never touches disk; controllers read
// `req.file.buffer` (streamed into an email attachment or straight to R2).
// Rejects anything that isn't a PDF, and turns multer's size/type failures into
// clean 400s instead of falling through to the generic 500 error handler.
export function makePdfUpload(maxBytes: number) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes },
    fileFilter: (
      _req: Request,
      file: Express.Multer.File,
      cb: multer.FileFilterCallback,
    ) => {
      const isPdf =
        file.mimetype === "application/pdf" &&
        file.originalname.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        return cb(new Error("Only PDF files are allowed"));
      }
      cb(null, true);
    },
  });

  return function pdfUploadMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    upload.single("pdf")(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        const message =
          err.code === "LIMIT_FILE_SIZE"
            ? `PDF must be ${humanMb(maxBytes)} MB or smaller`
            : err.message;
        return res.status(400).json({ message });
      }
      if (err instanceof Error) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  };
}

// Existing quiz "email me the PDF" route.
export const pdfUpload = makePdfUpload(MAX_PDF_BYTES);

// Course-PDF contributions go to R2, so they aren't bound by the email cap.
export const pdfUpload50 = makePdfUpload(MAX_CONTRIBUTION_PDF_BYTES);
