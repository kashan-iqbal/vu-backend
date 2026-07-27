import { FeedbackModel } from "./feedback.model";

export async function createFeedback(doc: {
  rating: number;
  comment?: string;
  context?: string;
  reference?: string;
  user?: string;
}) {
  return FeedbackModel.create(doc);
}
