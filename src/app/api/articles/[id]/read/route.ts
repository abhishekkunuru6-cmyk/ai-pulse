import { successJson, errorJson, validateUuidParam } from "@/lib/api-utils";
import { markArticleRead } from "@/lib/repositories";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const validation = validateUuidParam(id);
  if (!validation.valid) return errorJson(validation.error, 400);

  try {
    const article = await markArticleRead(id);
    return successJson(article);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to mark as read";
    if (message.includes("not found")) {
      return errorJson(message, 404);
    }
    return errorJson(message, 500);
  }
}
