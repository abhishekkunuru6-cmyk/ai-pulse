import { z } from "zod/v4";
import { CONTENT_TYPES, PLATFORMS, TOPICS } from "@/constants";

const contentTypeEnum = z.enum(CONTENT_TYPES);
const platformEnum = z.enum(PLATFORMS);
const topicEnum = z.enum(TOPICS);

export const articleFilterSchema = z.object({
  content_type: z
    .string()
    .transform((s) => s.split(","))
    .pipe(z.array(contentTypeEnum))
    .optional(),
  platform: z
    .string()
    .transform((s) => s.split(","))
    .pipe(z.array(platformEnum))
    .optional(),
  time_range: z
    .enum(["today", "week", "month", "three_months", "six_months", "year", "all"])
    .optional(),
  time_from: z.string().datetime().optional(),
  time_to: z.string().datetime().optional(),
  quality: z.enum(["top_rated", "all_rated", "unrated", "all"]).optional(),
  topic: z
    .string()
    .transform((s) => s.split(","))
    .pipe(z.array(topicEnum))
    .optional(),
  engagement: z.enum(["trending", "most_liked", "controversial", "under_the_radar"]).optional(),
  read_status: z.enum(["unread", "read", "saved"]).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const articleSearchSchema = z.object({
  q: z.string().min(1).max(200),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const articleRateSchema = z.object({
  rating: z.enum(["up", "down", "none"]),
});

export const digestSchema = z.object({
  period: z.enum(["daily", "weekly", "monthly", "yearly", "all"]).default("daily"),
  limit: z.coerce.number().int().min(5).max(50).optional(),
});

export type DigestPeriod = "daily" | "weekly" | "monthly" | "yearly" | "all";

export type ArticleFilterInput = z.infer<typeof articleFilterSchema>;
export type ArticleSearchInput = z.infer<typeof articleSearchSchema>;
export type ArticleRateInput = z.infer<typeof articleRateSchema>;
export type DigestInput = z.infer<typeof digestSchema>;
