import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockResult } = vi.hoisted(() => {
  let resolvedResult: { data: unknown; error: unknown } = { data: [], error: null };

  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) =>
          Promise.resolve(resolvedResult).then(resolve);
      }
      return vi.fn().mockReturnValue(new Proxy({}, handler));
    },
  };

  return {
    mockFrom: vi.fn().mockReturnValue(new Proxy({}, handler)),
    mockResult: (result: { data: unknown; error: unknown }) => {
      resolvedResult = result;
    },
  };
});

vi.mock("@/lib/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

import { getArticles, getArticleById, markArticleRead, getDigestArticles } from "./articles";

describe("articles repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getArticles", () => {
    it("fetches articles and returns paginated result", async () => {
      const articles = Array.from({ length: 5 }, (_, i) => ({
        id: `art-${i}`,
        title: `Article ${i}`,
      }));
      mockResult({ data: articles, error: null });

      const result = await getArticles({ limit: 20 });
      expect(mockFrom).toHaveBeenCalledWith("articles");
      expect(result.articles).toHaveLength(5);
      expect(result.has_more).toBe(false);
      expect(result.cursor).toBeNull();
    });

    it("detects has_more when results exceed limit", async () => {
      const articles = Array.from({ length: 4 }, (_, i) => ({
        id: `art-${i}`,
        title: `Article ${i}`,
      }));
      mockResult({ data: articles, error: null });

      const result = await getArticles({ limit: 3 });
      expect(result.articles).toHaveLength(3);
      expect(result.has_more).toBe(true);
      expect(result.cursor).toBe("art-2");
    });

    it("returns empty list on no data", async () => {
      mockResult({ data: [], error: null });

      const result = await getArticles({ limit: 20 });
      expect(result.articles).toHaveLength(0);
      expect(result.has_more).toBe(false);
    });

    it("throws on error", async () => {
      mockResult({ data: null, error: { message: "DB failure" } });
      await expect(getArticles({ limit: 20 })).rejects.toThrow("Failed to fetch articles");
    });
  });

  describe("getArticleById", () => {
    it("returns article when found", async () => {
      const article = { id: "abc", title: "Test Article" };
      mockResult({ data: article, error: null });

      const result = await getArticleById("abc");
      expect(result).toEqual(article);
    });

    it("returns null when not found", async () => {
      mockResult({ data: null, error: { code: "PGRST116", message: "not found" } });
      const result = await getArticleById("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("markArticleRead", () => {
    it("returns updated article", async () => {
      const updated = { id: "abc", title: "Test", is_read: true };
      mockResult({ data: updated, error: null });

      const result = await markArticleRead("abc");
      expect(result.is_read).toBe(true);
    });

    it("throws when article not found", async () => {
      mockResult({ data: null, error: { code: "PGRST116", message: "not found" } });
      await expect(markArticleRead("bad-id")).rejects.toThrow("Article not found");
    });
  });

  describe("getDigestArticles", () => {
    it("fetches daily digest", async () => {
      const articles = [{ id: "1", title: "Top Article", engagement_score: 100 }];
      mockResult({ data: articles, error: null });

      const result = await getDigestArticles("daily");
      expect(result).toHaveLength(1);
    });

    it("fetches weekly digest", async () => {
      const articles = Array.from({ length: 10 }, (_, i) => ({ id: `${i}`, title: `Article ${i}` }));
      mockResult({ data: articles, error: null });

      const result = await getDigestArticles("weekly", 10);
      expect(result).toHaveLength(10);
    });
  });
});
