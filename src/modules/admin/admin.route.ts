import { Router } from "express";
import { authGuard } from "../../common/middlewares/auth.middleware";
import { requireAdmin } from "../../common/middlewares/adminGuard";
import { validate } from "../../common/middlewares/validate";
import { toggleUserStatusSchema } from "./admin.schema";
import {
  getOverview,
  getUsers,
  patchUserStatus,
  getContributions,
  approveContribution,
  rejectContribution,
  getContributors,
  getContributorDetail,
  getHandouts,
  getPastMcqs,
  getAiMcqs,
  getWrongAnswers,
  getFeedback,
} from "./admin.controller";

export const adminRouter = Router();

// Every route below is admin-only: authGuard decodes the JWT onto req.user,
// requireAdmin checks the role it carries.
adminRouter.use(authGuard, requireAdmin);

adminRouter.get("/stats/overview", getOverview);

adminRouter.get("/users", getUsers);
adminRouter.patch("/users/:id/status", validate(toggleUserStatusSchema), patchUserStatus);

adminRouter.get("/contributions", getContributions);
adminRouter.patch("/contributions/:id/approve", approveContribution);
adminRouter.patch("/contributions/:id/reject", rejectContribution);

adminRouter.get("/contributors", getContributors);
adminRouter.get("/contributors/:phone", getContributorDetail);

adminRouter.get("/handouts", getHandouts);
adminRouter.get("/mcqs/past", getPastMcqs);
adminRouter.get("/mcqs/ai", getAiMcqs);
adminRouter.get("/mcqs/wrong-answers", getWrongAnswers);
adminRouter.get("/feedback", getFeedback);
