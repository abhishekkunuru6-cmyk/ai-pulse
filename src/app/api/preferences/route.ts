import { successJson, errorJson } from "@/lib/api-utils";
import { getAllPreferences } from "@/lib/repositories";

export async function GET() {
  try {
    const preferences = await getAllPreferences();
    return successJson(preferences);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch preferences";
    return errorJson(message, 500);
  }
}
