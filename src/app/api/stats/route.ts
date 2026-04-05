import { successJson, errorJson } from "@/lib/api-utils";
import { getDashboardStats } from "@/lib/repositories";

export async function GET() {
  try {
    const stats = await getDashboardStats();
    return successJson(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch stats";
    return errorJson(message, 500);
  }
}
