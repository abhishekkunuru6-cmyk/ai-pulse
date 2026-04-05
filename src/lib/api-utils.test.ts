import { describe, it, expect } from "vitest";
import { z } from "zod/v4";
import { parseSearchParams } from "./api-utils";

describe("parseSearchParams", () => {
  const schema = z.object({
    name: z.string().min(1),
    limit: z.coerce.number().int().default(20),
  });

  it("parses valid params", () => {
    const params = new URLSearchParams("name=test&limit=10");
    const result = parseSearchParams(params, schema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("test");
      expect(result.data.limit).toBe(10);
    }
  });

  it("applies defaults for missing optional params", () => {
    const params = new URLSearchParams("name=test");
    const result = parseSearchParams(params, schema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
    }
  });

  it("returns error for invalid params", () => {
    const params = new URLSearchParams("name=");
    const result = parseSearchParams(params, schema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid parameter");
    }
  });
});
