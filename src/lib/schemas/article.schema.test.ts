import { describe, it, expect } from "vitest";
import { articleFilterSchema, articleSearchSchema, articleRateSchema } from "./article.schema";

describe("articleFilterSchema", () => {
  it("accepts empty filter (defaults applied)", () => {
    const result = articleFilterSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
    }
  });

  it("accepts valid content_type filter", () => {
    const result = articleFilterSchema.safeParse({ content_type: "paper,blog" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content_type).toEqual(["paper", "blog"]);
    }
  });

  it("accepts valid platform filter", () => {
    const result = articleFilterSchema.safeParse({ platform: "reddit,hackernews" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.platform).toEqual(["reddit", "hackernews"]);
    }
  });

  it("accepts valid time_range", () => {
    const result = articleFilterSchema.safeParse({ time_range: "today" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid time_range", () => {
    const result = articleFilterSchema.safeParse({ time_range: "yesterday" });
    expect(result.success).toBe(false);
  });

  it("accepts valid quality filter", () => {
    const result = articleFilterSchema.safeParse({ quality: "top_rated" });
    expect(result.success).toBe(true);
  });

  it("clamps limit to max 50", () => {
    const result = articleFilterSchema.safeParse({ limit: 100 });
    expect(result.success).toBe(false);
  });

  it("accepts valid cursor", () => {
    const result = articleFilterSchema.safeParse({
      cursor: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid content_type", () => {
    const result = articleFilterSchema.safeParse({ content_type: "tweet" });
    expect(result.success).toBe(false);
  });
});

describe("articleSearchSchema", () => {
  it("accepts valid search query", () => {
    const result = articleSearchSchema.safeParse({ q: "transformer attention" });
    expect(result.success).toBe(true);
  });

  it("rejects empty query", () => {
    const result = articleSearchSchema.safeParse({ q: "" });
    expect(result.success).toBe(false);
  });

  it("rejects query over 200 chars", () => {
    const result = articleSearchSchema.safeParse({ q: "a".repeat(201) });
    expect(result.success).toBe(false);
  });
});

describe("articleRateSchema", () => {
  it("accepts thumbs up", () => {
    const result = articleRateSchema.safeParse({ rating: "up" });
    expect(result.success).toBe(true);
  });

  it("accepts thumbs down", () => {
    const result = articleRateSchema.safeParse({ rating: "down" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid rating", () => {
    const result = articleRateSchema.safeParse({ rating: "neutral" });
    expect(result.success).toBe(false);
  });
});
