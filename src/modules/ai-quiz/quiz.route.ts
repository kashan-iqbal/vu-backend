import { Router } from "express";
import {

    getSmartQuiz,
    SubmitQuizResult,
    uploadCoursePdf,

} from "./quiz.controller";
import { authGuard } from "../../common/middlewares/auth.middleware";
import { validate } from "../../common/middlewares/validate";
import { uploadLimiter } from "../../common/middlewares/rateLimit";
import { pdfUpload } from "../../common/middlewares/pdfUpload";
import { submitQuizSchema } from "./quiz.schema";
import { uploadPdfSchema } from "./upload.schema";

export const quizRouter = Router();

// Contribute a course PDF (emailed to admin). Multer parses the multipart body
// first, then validate() checks the accompanying text fields.
quizRouter.post(
    "/upload-pdf",
    authGuard,
    uploadLimiter,
    pdfUpload,
    validate(uploadPdfSchema),
    uploadCoursePdf,
);

quizRouter.get("/:quizCode", authGuard, getSmartQuiz);




quizRouter.post("/submitQuiz", authGuard, validate(submitQuizSchema), SubmitQuizResult);


