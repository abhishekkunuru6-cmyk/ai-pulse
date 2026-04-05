import { NextRequest } from "next/server";
import { successJson, errorJson, parseSearchParams } from "@/lib/api-utils";
import { digestSchema } from "@/lib/schemas";
import { getDigestBySource } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request.nextUrl.searchParams, digestSchema);
  if (!parsed.success) {
    return errorJson(parsed.error, 400);
  }

  try {
    const perSource = Number(request.nextUrl.searchParams.get("per_source")) || 10;
    const clamped = Math.min(Math.max(perSource, 5), 50);
    const groups = await getDigestBySource(parsed.data.period, clamped);
    return successJson(groups);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch digest by source";
    return errorJson(message, 500);
  }
}
