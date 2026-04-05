import { NextRequest } from "next/server";
import { successJson, errorJson, parseSearchParams } from "@/lib/api-utils";
import { digestSchema } from "@/lib/schemas";
import { getDigestArticles } from "@/lib/repositories";

const DEFAULT_LIMITS: Record<string, number> = {
  daily: 15,
  weekly: 25,
  monthly: 25,
  yearly: 50,
  all: 50,
};

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request.nextUrl.searchParams, digestSchema);
  if (!parsed.success) {
    return errorJson(parsed.error, 400);
  }

  try {
    const { period } = parsed.data;
    const limit = parsed.data.limit ?? DEFAULT_LIMITS[period] ?? 15;
    const articles = await getDigestArticles(period, limit);
    return successJson(articles);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch digest";
    return errorJson(message, 500);
  }
}
