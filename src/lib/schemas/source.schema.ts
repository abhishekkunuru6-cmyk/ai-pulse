import { z } from "zod/v4";
import { SOURCE_CATEGORIES, PLATFORMS } from "@/constants";

const categoryEnum = z.enum(SOURCE_CATEGORIES);
const platformEnum = z.enum(PLATFORMS);
const sourceTypeEnum = z.enum(["api", "rss", "scrape", "manual"]);
const statusEnum = z.enum(["active", "paused", "deprecated"]);
const fetchFrequencyEnum = z.enum(["hourly", "every_4h", "every_6h", "every_12h", "daily", "weekly"]);

export const createSourceSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.url(),
  category: categoryEnum,
  type: sourceTypeEnum,
  platform: platformEnum,
  fetch_frequency: fetchFrequencyEnum,
  notes: z.string().max(1000).optional(),
});

export const updateSourceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  url: z.url().optional(),
  category: categoryEnum.optional(),
  type: sourceTypeEnum.optional(),
  platform: platformEnum.optional(),
  fetch_frequency: fetchFrequencyEnum.optional(),
  reliability_score: z.number().min(0).max(5).optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const updateSourceStatusSchema = z.object({
  status: statusEnum,
});

export const sourceFilterSchema = z.object({
  category: categoryEnum.optional(),
  status: statusEnum.optional(),
  platform: platformEnum.optional(),
});

export type CreateSourceInput = z.infer<typeof createSourceSchema>;
export type UpdateSourceInput = z.infer<typeof updateSourceSchema>;
export type UpdateSourceStatusInput = z.infer<typeof updateSourceStatusSchema>;
export type SourceFilterInput = z.infer<typeof sourceFilterSchema>;
