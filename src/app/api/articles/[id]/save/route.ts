import { successJson, errorJson, validateUuidParam } from "@/lib/api-utils";
import { toggleArticleSave } from "@/lib/repositories";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const validation = validateUuidParam(id);
  if (!validation.valid) return errorJson(validation.error, 400);

  try {
    const article = await toggleArticleSave(id);
    return successJson(article);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to toggle save";
    if (message.includes("not found")) {
      return errorJson(message, 404);
    }
    return errorJson(message, 500);
  }
}
