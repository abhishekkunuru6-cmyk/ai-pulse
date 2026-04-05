import { NextRequest } from "next/server";
import { successJson, errorJson, parseSearchParams } from "@/lib/api-utils";
import { articleSearchSchema } from "@/lib/schemas";
import { searchArticles } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request.nextUrl.searchParams, articleSearchSchema);
  if (!parsed.success) {
    return errorJson(parsed.error, 400);
  }

  try {
    const { articles, cursor, has_more } = await searchArticles(
      parsed.data.q,
      parsed.data.cursor,
      parsed.data.limit,
    );
    return successJson(articles, {
      total: articles.length,
      cursor,
      has_more,
      limit: parsed.data.limit,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to search articles";
    return errorJson(message, 500);
  }
}
