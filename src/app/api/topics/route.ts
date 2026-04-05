import { NextRequest } from "next/server";
import { successJson, errorJson } from "@/lib/api-utils";
import { getTopicClusters } from "@/lib/repositories/topics";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const timeRange = (searchParams.get("time_range") ?? "week") as
    | "today"
    | "week"
    | "month"
    | "year"
    | "all";
  const limit = Math.min(Number(searchParams.get("limit")) || 25, 50);

  try {
    const clusters = await getTopicClusters(timeRange, limit);
    return successJson(clusters);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch topics";
    return errorJson(message, 500);
  }
}
