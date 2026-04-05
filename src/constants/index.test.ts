import { describe, it, expect } from "vitest";
import { PAGINATION, SOURCE_CATEGORIES, PLATFORMS, CONTENT_TYPES, TOPICS } from "./index";

describe("Constants", () => {
  it("has valid pagination defaults", () => {
    expect(PAGINATION.DEFAULT_LIMIT).toBe(20);
    expect(PAGINATION.MAX_LIMIT).toBe(50);
    expect(PAGINATION.MAX_LIMIT).toBeGreaterThan(PAGINATION.DEFAULT_LIMIT);
  });

  it("includes all expected source categories", () => {
    expect(SOURCE_CATEGORIES).toContain("research");
    expect(SOURCE_CATEGORIES).toContain("social");
    expect(SOURCE_CATEGORIES).toContain("code");
    expect(SOURCE_CATEGORIES).toContain("news");
    expect(SOURCE_CATEGORIES.length).toBeGreaterThanOrEqual(9);
  });

  it("includes all expected platforms", () => {
    expect(PLATFORMS).toContain("arxiv");
    expect(PLATFORMS).toContain("reddit");
    expect(PLATFORMS).toContain("hackernews");
    expect(PLATFORMS).toContain("github");
    expect(PLATFORMS.length).toBeGreaterThanOrEqual(15);
  });

  it("includes all expected content types", () => {
    expect(CONTENT_TYPES).toContain("paper");
    expect(CONTENT_TYPES).toContain("blog");
    expect(CONTENT_TYPES).toContain("code");
    expect(CONTENT_TYPES.length).toBeGreaterThanOrEqual(9);
  });

  it("includes all expected topics", () => {
    expect(TOPICS).toContain("llms");
    expect(TOPICS).toContain("ai-safety");
    expect(TOPICS).toContain("agents");
    expect(TOPICS.length).toBeGreaterThanOrEqual(10);
  });
});
