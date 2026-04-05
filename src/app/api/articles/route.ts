import { NextRequest } from "next/server";
import { successJson, errorJson, parseSearchParams } from "@/lib/api-utils";
import { articleFilterSchema } from "@/lib/schemas";
import { getArticles } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request.nextUrl.searchParams, articleFilterSchema);
  if (!parsed.success) {
    return errorJson(parsed.error, 400);
  }

  try {
    const { articles, cursor, has_more } = await getArticles(parsed.data);
    return successJson(articles, {
      total: articles.length,
      cursor,
      has_more,
      limit: parsed.data.limit,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch articles";
    return errorJson(message, 500);
  }
}
