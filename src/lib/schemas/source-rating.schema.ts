import { z } from "zod/v4";

export const sourceRatingSchema = z.object({
  star_rating: z.number().int().min(1).max(5),
});

export type SourceRatingInput = z.infer<typeof sourceRatingSchema>;
