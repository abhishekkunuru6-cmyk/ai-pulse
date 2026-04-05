import { NextRequest } from "next/server";
import { successJson, errorJson } from "@/lib/api-utils";
import { getTopicArticlesByIds } from "@/lib/repositories/topics";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  await params; // consume params even though we don't need slug anymore
  const searchParams = request.nextUrl.searchParams;
  const idsParam = searchParams.get("ids") ?? "";

  if (!idsParam) {
    return errorJson("Missing article IDs. Use the ids query parameter.", 400);
  }

  const articleIds = idsParam.split(",").filter(Boolean);
  if (articleIds.length === 0) {
    return errorJson("No valid article IDs provided.", 400);
  }

  try {
    const articles = await getTopicArticlesByIds(articleIds);
    return successJson({ articles });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch topic articles";
    return errorJson(message, 500);
  }
}
