import { z } from "zod/v4";

const filterConfigSchema = z.object({
  content_type: z
    .array(
      z.enum([
        "paper",
        "news",
        "video",
        "podcast",
        "social",
        "code",
        "tutorial",
        "discussion",
      ]),
    )
    .optional(),
  platform: z
    .array(
      z.enum([
        "arxiv",
        "reddit",
        "hackernews",
        "github",
        "huggingface",
        "youtube",
        "linkedin",
        "x",
        "blog",
        "newsletter",
        "discord",
        "lobsters",
        "pypi",
        "semantic_scholar",
        "papers_with_code",
        "openreview",
        "ollama",
        "substack",
      ]),
    )
    .optional(),
  time_range: z.enum(["today", "week", "month", "all"]).optional(),
  quality: z.enum(["top_rated", "all_rated", "unrated", "all"]).optional(),
  topics: z.array(z.string().min(1).max(50)).optional(),
  engagement: z.enum(["trending", "most_liked", "controversial", "under_the_radar"]).optional(),
  read_status: z.enum(["unread", "read", "saved"]).optional(),
});

export const createFilterPresetSchema = z.object({
  name: z.string().min(1).max(100),
  filter_config: filterConfigSchema,
});

export const deleteFilterPresetSchema = z.object({
  id: z.string().uuid(),
});

export type CreateFilterPresetInput = z.infer<typeof createFilterPresetSchema>;
