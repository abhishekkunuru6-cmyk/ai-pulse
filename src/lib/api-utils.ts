import { NextResponse } from "next/server";
import { createSuccessResponse, createErrorResponse } from "@/types/api";
import type { PaginationMeta } from "@/types/api";
import { z } from "zod/v4";

const uuidSchema = z.string().uuid();

export function validateUuidParam(id: string): { valid: true } | { valid: false; error: string } {
  const result = uuidSchema.safeParse(id);
  return result.success ? { valid: true } : { valid: false, error: "Invalid ID format" };
}

export function successJson<T>(data: T, meta?: PaginationMeta, status: number = 200) {
  return NextResponse.json(createSuccessResponse(data, meta), { status });
}

export function errorJson(message: string, status: number = 400) {
  return NextResponse.json(createErrorResponse(message), { status });
}

export function parseSearchParams<T extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: T,
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const raw: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  const result = schema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message).join("; ");
    return { success: false, error: `Invalid parameter: ${messages}` };
  }
  return { success: true, data: result.data };
}

export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ success: true; data: z.infer<T> } | { success: false; error: string }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join("; ");
      return { success: false, error: `Invalid input: ${messages}` };
    }
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: "Invalid JSON body" };
  }
}
