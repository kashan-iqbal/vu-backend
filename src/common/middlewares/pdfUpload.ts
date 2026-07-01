import multer from "multer";
import { Request, Response, NextFunction } from "express";

export const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB

// In-memory PDF upload — the file never touches disk; the controller streams the
// buffer straight into an email attachment. Rejects anything that isn't a PDF.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES },
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

// Wrap multer's single-file handler so size/type failures return a clean 400
// instead of falling through to the generic 500 error handler.
export function pdfUpload(req: Request, res: Response, next: NextFunction) {
  upload.single("pdf")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "PDF must be 25 MB or smaller"
          : err.message;
      return res.status(400).json({ message });
    }
    if (err instanceof Error) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}
