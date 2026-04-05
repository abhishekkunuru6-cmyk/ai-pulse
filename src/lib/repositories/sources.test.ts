import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockResult } = vi.hoisted(() => {
  let resolvedResult: { data: unknown; error: unknown } = { data: [], error: null };

  // Create a proxy that returns itself for any chained method call,
  // and resolves to the result when awaited
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) =>
          Promise.resolve(resolvedResult).then(resolve);
      }
      // Track calls for assertions
      const fn = vi.fn().mockReturnValue(new Proxy({}, handler));
      chainCalls[prop as string] = fn;
      return fn;
    },
  };

  const chainCalls: Record<string, ReturnType<typeof vi.fn>> = {};

  return {
    mockFrom: vi.fn().mockReturnValue(new Proxy({}, handler)),
    mockResult: (result: { data: unknown; error: unknown }) => {
      resolvedResult = result;
    },
    chainCalls,
  };
});

vi.mock("@/lib/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

import { getAllSources, getSourceById, createSource } from "./sources";

describe("sources repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllSources", () => {
    it("calls supabase with correct table and returns data", async () => {
      const mockData = [{ id: "1", name: "Test Source" }];
      mockResult({ data: mockData, error: null });

      const result = await getAllSources();
      expect(mockFrom).toHaveBeenCalledWith("sources");
      expect(result).toEqual(mockData);
    });

    it("throws on supabase error", async () => {
      mockResult({ data: null, error: { message: "DB error" } });
      await expect(getAllSources()).rejects.toThrow("Failed to fetch sources: DB error");
    });
  });

  describe("getSourceById", () => {
    it("returns source when found", async () => {
      const source = { id: "abc", name: "Test" };
      mockResult({ data: source, error: null });
      const result = await getSourceById("abc");
      expect(result).toEqual(source);
    });

    it("returns null when not found", async () => {
      mockResult({ data: null, error: { code: "PGRST116", message: "not found" } });
      const result = await getSourceById("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("createSource", () => {
    it("returns created source", async () => {
      const input = {
        name: "New",
        url: "https://new.com",
        category: "news" as const,
        type: "rss" as const,
        platform: "blog" as const,
        fetch_frequency: "daily" as const,
      };
      const created = { id: "new-id", ...input, status: "active" };
      mockResult({ data: created, error: null });

      const result = await createSource(input);
      expect(result).toEqual(created);
    });

    it("throws on duplicate URL", async () => {
      mockResult({ data: null, error: { code: "23505", message: "duplicate" } });
      await expect(
        createSource({
          name: "Dup",
          url: "https://dup.com",
          category: "news",
          type: "rss",
          platform: "blog",
          fetch_frequency: "daily",
        }),
      ).rejects.toThrow("A source with this URL already exists.");
    });

    it("throws generic error on other failures", async () => {
      mockResult({ data: null, error: { code: "OTHER", message: "server error" } });
      await expect(
        createSource({
          name: "Fail",
          url: "https://fail.com",
          category: "news",
          type: "rss",
          platform: "blog",
          fetch_frequency: "daily",
        }),
      ).rejects.toThrow("Failed to create source: server error");
    });
  });
});
