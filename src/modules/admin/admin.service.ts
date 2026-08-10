import { UserModel } from "../user/user.model";
import { NewsLetterModel } from "../user/newletter.model";
import { ContributionModel, ContributionStatus } from "../contribution/contribution.model";
import * as contributionService from "../contribution/contribution.service";
import { HandoutModel } from "../handouts/handout.model";
import { PastQuizModel } from "../pastQuiz/pastQuiz.model";
import { QuizModel } from "../ai-quiz/quiz.model";
import { WrongAnswerModel } from "../ai-quiz/wrongAnswer.model";
import { FeedbackModel } from "../feedback/feedback.model";
import { parsePagination, buildMeta } from "../../common/utils/pagination";
import { env } from "../../config/env";

type Query = Record<string, unknown>;

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_WINDOW_DAYS = 30;

// User-supplied search strings go into a $regex — escape so they're matched
// literally instead of being interpreted as regex syntax.
function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function searchRegex(value: unknown) {
  return new RegExp(escapeRegex(String(value)), "i");
}

async function dailySeries(model: any, match: Record<string, unknown> = {}) {
  const since = new Date(Date.now() - TREND_WINDOW_DAYS * DAY_MS);
  return model.aggregate([
    { $match: { createdAt: { $gte: since }, ...match } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

export async function getOverviewStats() {
  const [
    users,
    contributions,
    handouts,
    pastMcqs,
    aiMcqs,
    feedback,
    newsletter,
    signupsPerDay,
    uploadsPerDay,
    feedbackPerDay,
    topMissedTopics,
  ] = await Promise.all([
    UserModel.countDocuments(),
    ContributionModel.countDocuments(),
    HandoutModel.countDocuments(),
    PastQuizModel.countDocuments(),
    QuizModel.countDocuments(),
    FeedbackModel.countDocuments(),
    NewsLetterModel.countDocuments(),
    dailySeries(UserModel),
    dailySeries(ContributionModel),
    dailySeries(FeedbackModel),
    WrongAnswerModel.aggregate([
      { $group: { _id: "$topic_name", missedCount: { $sum: 1 } } },
      { $sort: { missedCount: -1 } },
      { $limit: 5 },
    ]),
  ]);

  return {
    totals: { users, contributions, handouts, pastMcqs, aiMcqs, feedback, newsletter },
    trends: { signupsPerDay, uploadsPerDay, feedbackPerDay },
    topMissedTopics,
  };
}

export async function listUsers(query: Query) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};

  if (query.search) {
    const re = searchRegex(query.search);
    filter.$or = [{ name: re }, { email: re }];
  }
  if (query.role) filter.role = query.role;
  if (query.provider) filter.provider = query.provider;
  if (query.isActive === "true" || query.isActive === "false") {
    filter.isActive = query.isActive === "true";
  }

  const [items, total] = await Promise.all([
    UserModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    UserModel.countDocuments(filter),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

export async function setUserActiveStatus(id: string, isActive: boolean) {
  return UserModel.findByIdAndUpdate(id, { isActive }, { new: true }).lean();
}

// The bucket is public-read (R2_PUBLIC_URL), so the admin PDF preview is just
// this URL embedded in an <iframe> — no signed URL / proxy endpoint needed.
function withPdfUrl<T extends { r2Key: string }>(doc: T): T & { pdfUrl: string | null } {
  return { ...doc, pdfUrl: env.R2_PUBLIC_URL ? `${env.R2_PUBLIC_URL}/${doc.r2Key}` : null };
}

export async function listContributions(query: Query) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};

  if (query.search) {
    const re = searchRegex(query.search);
    filter.$or = [{ code: re }, { uploaderName: re }];
  }
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    ContributionModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ContributionModel.countDocuments(filter),
  ]);

  return { items: items.map(withPdfUrl), meta: buildMeta(total, page, limit) };
}

export async function approveContribution(id: string) {
  return contributionService.approveContribution(id);
}

export async function rejectContribution(id: string) {
  return contributionService.rejectContribution(id);
}

// ── Contributors (grouped by uploaderPhone) ──
export async function listContributors(query: Query) {
  const { page, limit, skip } = parsePagination(query);

  const [items, totalResult] = await Promise.all([
    ContributionModel.aggregate([
      {
        $group: {
          _id: "$uploaderPhone",
          name: { $first: "$uploaderName" },
          total: { $sum: 1 },
          // Docs from before this feature shipped have no `status` field at
          // all (Mongoose's schema default only applies to new documents,
          // not ones already in the DB) — $ifNull treats those as pending
          // rather than silently dropping out of every bucket.
          approved: {
            $sum: {
              $cond: [
                { $eq: [{ $ifNull: ["$status", ContributionStatus.PENDING] }, ContributionStatus.APPROVED] },
                1,
                0,
              ],
            },
          },
          rejected: {
            $sum: {
              $cond: [
                { $eq: [{ $ifNull: ["$status", ContributionStatus.PENDING] }, ContributionStatus.REJECTED] },
                1,
                0,
              ],
            },
          },
          pending: {
            $sum: {
              $cond: [
                { $eq: [{ $ifNull: ["$status", ContributionStatus.PENDING] }, ContributionStatus.PENDING] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { total: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]),
    ContributionModel.aggregate([
      { $group: { _id: "$uploaderPhone" } },
      { $count: "total" },
    ]),
  ]);

  const total = totalResult[0]?.total ?? 0;
  const renamed = items.map(({ _id, ...rest }) => ({ phone: _id as string, ...rest }));

  return { items: renamed, meta: buildMeta(total, page, limit) };
}

export async function getContributorDetail(phone: string) {
  const uploads = await ContributionModel.find({ uploaderPhone: phone })
    .sort({ createdAt: -1 })
    .lean();

  const summary = uploads.reduce(
    (acc, u) => {
      acc.total += 1;
      // Same as above: docs predating this feature have no status field.
      const status = (u.status as ContributionStatus | undefined) ?? ContributionStatus.PENDING;
      acc[status] += 1;
      return acc;
    },
    { total: 0, pending: 0, approved: 0, rejected: 0 },
  );

  return {
    phone,
    name: uploads[0]?.uploaderName ?? null,
    summary,
    uploads: uploads.map(withPdfUrl),
  };
}

export async function listHandoutsAdmin(query: Query) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};

  if (query.code) filter.code = String(query.code).toUpperCase();
  if (query.examType) filter.examType = query.examType;

  const [items, total] = await Promise.all([
    HandoutModel.aggregate([
      { $match: filter },
      { $addFields: { contentLength: { $strLenCP: "$content" } } },
      { $project: { content: 0 } },
      { $sort: { updatedAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]),
    HandoutModel.countDocuments(filter),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

export async function listPastMcqs(query: Query) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};

  if (query.code) filter.code = String(query.code).toUpperCase();
  if (query.type) filter.type = query.type;

  const [items, total] = await Promise.all([
    PastQuizModel.find(filter).sort({ _id: -1 }).skip(skip).limit(limit).lean(),
    PastQuizModel.countDocuments(filter),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

export async function listAiMcqs(query: Query) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};

  if (query.code) filter.code = String(query.code).toUpperCase();
  if (query.type) filter.type = query.type;
  if (query.topic) filter.topic_name = searchRegex(query.topic);

  const [items, total] = await Promise.all([
    QuizModel.find(filter).sort({ _id: -1 }).skip(skip).limit(limit).lean(),
    QuizModel.countDocuments(filter),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

export async function listWrongAnswers(query: Query) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};

  if (query.code) filter.code = String(query.code).toUpperCase();
  if (query.type) filter.type = query.type;

  const [items, total] = await Promise.all([
    WrongAnswerModel.find(filter).sort({ _id: -1 }).skip(skip).limit(limit).lean(),
    WrongAnswerModel.countDocuments(filter),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

export async function listFeedback(query: Query) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {};

  const rating = Number(query.rating);
  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) filter.rating = rating;
  if (query.context) filter.context = query.context;

  const [items, total] = await Promise.all([
    FeedbackModel.find(filter)
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FeedbackModel.countDocuments(filter),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}
