import { successJson, errorJson, validateUuidParam } from "@/lib/api-utils";
import { getArticleById } from "@/lib/repositories";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const validation = validateUuidParam(id);
  if (!validation.valid) return errorJson(validation.error, 400);

  try {
    const article = await getArticleById(id);
    if (!article) {
      return errorJson("Article not found", 404);
    }
    return successJson(article);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch article";
    return errorJson(message, 500);
  }
}
