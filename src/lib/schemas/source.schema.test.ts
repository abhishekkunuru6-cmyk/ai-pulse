import { describe, it, expect } from "vitest";
import { createSourceSchema, updateSourceSchema, updateSourceStatusSchema } from "./source.schema";

describe("createSourceSchema", () => {
  const validInput = {
    name: "Test Source",
    url: "https://example.com/feed",
    category: "news",
    type: "rss",
    platform: "blog",
    fetch_frequency: "daily",
  };

  it("accepts valid input", () => {
    const result = createSourceSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("accepts optional notes", () => {
    const result = createSourceSchema.safeParse({ ...validInput, notes: "Great blog" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createSourceSchema.safeParse({ ...validInput, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid URL", () => {
    const result = createSourceSchema.safeParse({ ...validInput, url: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid category", () => {
    const result = createSourceSchema.safeParse({ ...validInput, category: "invalid" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid platform", () => {
    const result = createSourceSchema.safeParse({ ...validInput, platform: "myspace" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid fetch_frequency", () => {
    const result = createSourceSchema.safeParse({ ...validInput, fetch_frequency: "every_2h" });
    expect(result.success).toBe(false);
  });
});

describe("updateSourceSchema", () => {
  it("accepts partial update", () => {
    const result = updateSourceSchema.safeParse({ name: "Updated Name" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (no changes)", () => {
    const result = updateSourceSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("validates reliability_score range", () => {
    expect(updateSourceSchema.safeParse({ reliability_score: 3.5 }).success).toBe(true);
    expect(updateSourceSchema.safeParse({ reliability_score: 6 }).success).toBe(false);
    expect(updateSourceSchema.safeParse({ reliability_score: -1 }).success).toBe(false);
  });
});

describe("updateSourceStatusSchema", () => {
  it("accepts valid statuses", () => {
    expect(updateSourceStatusSchema.safeParse({ status: "active" }).success).toBe(true);
    expect(updateSourceStatusSchema.safeParse({ status: "paused" }).success).toBe(true);
    expect(updateSourceStatusSchema.safeParse({ status: "deprecated" }).success).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(updateSourceStatusSchema.safeParse({ status: "deleted" }).success).toBe(false);
  });
});
