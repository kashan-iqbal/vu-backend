import { z } from "zod";

export const toggleUserStatusSchema = z.object({
  isActive: z.boolean(),
});
