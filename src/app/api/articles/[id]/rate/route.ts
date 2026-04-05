import { successJson, errorJson, parseBody, validateUuidParam } from "@/lib/api-utils";
import { articleRateSchema } from "@/lib/schemas";
import { rateArticle } from "@/lib/repositories";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const validation = validateUuidParam(id);
  if (!validation.valid) return errorJson(validation.error, 400);

  const parsed = await parseBody(request, articleRateSchema);
  if (!parsed.success) {
    return errorJson(parsed.error, 400);
  }

  try {
    if (parsed.data.rating === "none") {
      const { removeArticleRating } = await import("@/lib/repositories");
      await removeArticleRating(id);
      return successJson({ article_id: id, rating: null });
    }
    const preference = await rateArticle(id, parsed.data.rating);
    return successJson(preference);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to rate article";
    return errorJson(message, 500);
  }
}
