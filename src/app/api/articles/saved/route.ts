import { successJson, errorJson } from "@/lib/api-utils";
import { getSavedArticles } from "@/lib/repositories";

export async function GET() {
  try {
    const articles = await getSavedArticles();
    return successJson(articles);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch saved articles";
    return errorJson(message, 500);
  }
}
