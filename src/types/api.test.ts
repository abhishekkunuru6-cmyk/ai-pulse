import { describe, it, expect } from "vitest";
import { createSuccessResponse, createErrorResponse } from "./api";

describe("API response helpers", () => {
  it("creates a success response with data", () => {
    const result = createSuccessResponse({ id: "1", name: "test" });
    expect(result).toEqual({
      success: true,
      data: { id: "1", name: "test" },
      error: null,
    });
  });

  it("creates a success response with pagination meta", () => {
    const meta = { total: 100, cursor: "abc", has_more: true, limit: 20 };
    const result = createSuccessResponse([1, 2, 3], meta);
    expect(result.success).toBe(true);
    expect(result.meta).toEqual(meta);
    expect(result.error).toBeNull();
  });

  it("creates an error response", () => {
    const result = createErrorResponse("Something went wrong");
    expect(result).toEqual({
      success: false,
      data: null,
      error: "Something went wrong",
    });
  });
});
